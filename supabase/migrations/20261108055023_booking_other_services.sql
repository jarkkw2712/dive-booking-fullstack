-- Other services are isolated from the legacy report amounts. This migration
-- introduces storage only; application rollout requires its own reviewed RPCs.
create table if not exists public.booking_other_services (
  service_id uuid primary key,
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  description text not null check (length(btrim(description)) between 1 and 250),
  amount numeric(14,2) not null check (amount >= 0),
  payment_method text not null,
  document_visibility jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_other_services_booking_idx on public.booking_other_services(booking_id) where active;
alter table public.booking_other_services enable row level security;
revoke all on public.booking_other_services from public, anon, authenticated;
revoke insert, update, delete on public.booking_other_services from service_role;
grant select on public.booking_other_services to service_role;

create table if not exists public.other_service_document_defaults (
  singleton boolean primary key default true check (singleton),
  document_visibility jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.other_service_document_defaults enable row level security;
revoke all on public.other_service_document_defaults from public, anon, authenticated;
revoke insert, update, delete on public.other_service_document_defaults from service_role;
grant select on public.other_service_document_defaults to service_role;
insert into public.other_service_document_defaults(singleton) values(true) on conflict(singleton) do nothing;

-- Serialise all service changes with the parent Booking and reject stale edits.
alter table public.bookings add column if not exists other_services_revision bigint not null default 0;

create or replace function public.upsert_booking_v32(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid; v_result jsonb; v_item jsonb; v_service_id uuid; v_amount numeric;
  v_before jsonb; v_after jsonb; v_ids uuid[]:='{}'; v_revision bigint:=0;
  v_actor text:=nullif(btrim(p_booking->>'settlementActor'),'');
  v_role text:=nullif(btrim(p_booking->>'settlementActorRole'),'');
  v_updated integer;
begin
  select booking_id,other_services_revision into v_id,v_revision from public.bookings where booking_code=p_booking->>'bookingCode' for update;
  if p_booking ? 'otherServices' then
    if jsonb_typeof(p_booking->'otherServices')<>'array' or jsonb_array_length(p_booking->'otherServices')>100 then raise exception 'Invalid other services'; end if;
    if v_actor is null or v_role is null then raise exception 'Actor required'; end if;
    if coalesce(v_revision,0)<>coalesce(nullif(p_booking->>'otherServicesRevision','')::bigint,0) then raise exception 'รายการค่าบริการถูกแก้ไขโดยผู้อื่น กรุณาเปิด Booking ใหม่'; end if;
  end if;
  v_result:=public.upsert_booking_v31(p_booking);
  select booking_id into strict v_id from public.bookings where booking_code=v_result->>'bookingCode' for update;
  if not (p_booking ? 'otherServices') then return v_result; end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by service_id),'[]'::jsonb) into v_before from public.booking_other_services s where booking_id=v_id and active;
  for v_item in select value from jsonb_array_elements(p_booking->'otherServices') loop
    v_service_id:=nullif(v_item->>'serviceId','')::uuid;
    v_amount:=nullif(v_item->>'amount','')::numeric;
    if v_service_id is null or v_service_id=any(v_ids) or length(btrim(coalesce(v_item->>'description',''))) not between 1 and 250 or v_amount is null or v_amount<0 or v_amount>100000000 or round(v_amount,2)<>v_amount then raise exception 'Invalid other service'; end if;
    if not exists(select 1 from public.master_payment_methods where method_name=v_item->>'paymentMethod') then raise exception 'Invalid other service payment method'; end if;
    if jsonb_typeof(coalesce(v_item->'documentVisibility','{}'::jsonb))<>'object' then raise exception 'Invalid other service visibility'; end if;
    if exists(select 1 from jsonb_each(coalesce(v_item->'documentVisibility','{}'::jsonb)) where key not in ('show_register','show_money_receipt','show_equipment_slip','show_van_receipt','show_boat_ticket','show_island_purchase_order','show_dive_receipt') or jsonb_typeof(value)<>'boolean') then raise exception 'Invalid other service visibility'; end if;
    v_ids:=array_append(v_ids,v_service_id);
    insert into public.booking_other_services(service_id,booking_id,description,amount,payment_method,document_visibility)
      values(v_service_id,v_id,btrim(v_item->>'description'),v_amount,v_item->>'paymentMethod',coalesce(v_item->'documentVisibility','{}'::jsonb))
    on conflict(service_id) do update set description=excluded.description,amount=excluded.amount,payment_method=excluded.payment_method,document_visibility=excluded.document_visibility,active=true,updated_at=now()
      where booking_other_services.booking_id=v_id;
    get diagnostics v_updated=row_count;
    if v_updated<>1 then raise exception 'Other service belongs to another Booking'; end if;
  end loop;
  update public.booking_other_services set active=false,updated_at=now() where booking_id=v_id and active and not(service_id=any(v_ids));
  select coalesce(jsonb_agg(to_jsonb(s) order by service_id),'[]'::jsonb) into v_after from public.booking_other_services s where booking_id=v_id and active;
  if v_before is distinct from v_after then
    update public.bookings set other_services_revision=other_services_revision+1 where booking_id=v_id;
    insert into public.audit_logs(booking_code,action,detail,changed_by,actor_username,actor_role,entity_type,entity_id,success,before_json,after_json)
      values(p_booking->>'bookingCode','BOOKING_OTHER_SERVICES_UPDATED','Updated other service items',v_actor,v_actor,v_role,'booking',v_id::text,true,v_before,v_after);
  end if;
  return v_result;
end $$;
revoke all on function public.upsert_booking_v32(jsonb) from public,anon,authenticated;
grant execute on function public.upsert_booking_v32(jsonb) to service_role;

create or replace function public.list_bookings_json_v28() returns jsonb
language sql stable security definer set search_path=public as $$
select coalesce(jsonb_agg(item || jsonb_build_object(
  'otherServicesRevision',coalesce(b.other_services_revision,0),
  'otherServices',coalesce((select jsonb_agg(jsonb_build_object('serviceId',s.service_id,'description',s.description,'amount',s.amount,'paymentMethod',s.payment_method,'documentVisibility',s.document_visibility) order by s.created_at,s.service_id) from public.booking_other_services s where s.booking_id=b.booking_id and s.active),'[]'::jsonb)
) order by ordinality),'[]'::jsonb)
from jsonb_array_elements(public.list_bookings_json_v27()) with ordinality x(item,ordinality)
left join public.bookings b on b.booking_code=item->>'bookingCode';
$$;
revoke all on function public.list_bookings_json_v28() from public,anon,authenticated;
grant execute on function public.list_bookings_json_v28() to service_role;

create or replace function public.set_other_service_document_defaults(p_visibility jsonb,p_actor text,p_role text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_before jsonb; v_after jsonb;
begin
  if jsonb_typeof(p_visibility)<>'object' or nullif(btrim(p_actor),'') is null or nullif(btrim(p_role),'') is null then raise exception 'Invalid other service defaults'; end if;
  if exists(select 1 from jsonb_each(p_visibility) where key not in ('show_register','show_money_receipt','show_equipment_slip','show_van_receipt','show_boat_ticket','show_island_purchase_order','show_dive_receipt') or jsonb_typeof(value)<>'boolean') then raise exception 'Invalid document visibility'; end if;
  select document_visibility into v_before from public.other_service_document_defaults where singleton for update;
  update public.other_service_document_defaults set document_visibility=p_visibility,updated_at=now() where singleton returning document_visibility into v_after;
  if v_before is distinct from v_after then
    insert into public.audit_logs(action,detail,changed_by,actor_username,actor_role,entity_type,entity_id,success,before_json,after_json)
    values('OTHER_SERVICE_DEFAULTS_UPDATED','Updated other service document defaults',p_actor,p_actor,p_role,'other_service_defaults','singleton',true,v_before,v_after);
  end if;
  return v_after;
end $$;
revoke all on function public.set_other_service_document_defaults(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.set_other_service_document_defaults(jsonb,text,text) to service_role;
