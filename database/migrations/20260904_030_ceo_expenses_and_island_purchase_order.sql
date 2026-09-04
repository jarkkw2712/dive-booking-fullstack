-- Daily CEO operating expenses are revisioned: saving creates a new batch and
-- preserves every older version for audit/anti-corruption review.
create table if not exists daily_expense_batches(
  batch_id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  revision integer not null check(revision>0),
  note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique(expense_date,revision)
);
create table if not exists daily_expense_items(
  item_id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references daily_expense_batches(batch_id) on delete restrict,
  category_code text not null,
  category_name_snapshot text not null,
  qty numeric(12,2) not null default 1 check(qty>=0),
  unit_price numeric(14,2) not null default 0 check(unit_price>=0),
  amount numeric(14,2) generated always as (qty*unit_price) stored,
  created_at timestamptz not null default now()
);
create index if not exists idx_daily_expense_batches_date on daily_expense_batches(expense_date,revision desc);
create index if not exists idx_daily_expense_items_batch on daily_expense_items(batch_id);
alter table daily_expense_batches enable row level security;
alter table daily_expense_items enable row level security;

create or replace function save_daily_operating_expenses(p_date date,p_items jsonb,p_note text,p_actor text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_batch uuid; v_revision integer; v_item jsonb;
begin
  if p_date is null or coalesce(trim(p_actor),'')='' then raise exception 'Date and actor are required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'Items must be an array'; end if;
  perform pg_advisory_xact_lock(hashtext(p_date::text));
  select coalesce(max(revision),0)+1 into v_revision from daily_expense_batches where expense_date=p_date;
  insert into daily_expense_batches(expense_date,revision,note,created_by) values(p_date,v_revision,nullif(trim(p_note),''),p_actor) returning batch_id into v_batch;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(trim(v_item->>'name'),'')<>'' then
      insert into daily_expense_items(batch_id,category_code,category_name_snapshot,qty,unit_price)
      values(v_batch,coalesce(nullif(trim(v_item->>'code'),''),'other'),trim(v_item->>'name'),greatest(coalesce((v_item->>'qty')::numeric,0),0),greatest(coalesce((v_item->>'unitPrice')::numeric,0),0));
    end if;
  end loop;
  return v_batch;
end $$;
revoke all on function save_daily_operating_expenses(date,jsonb,text,text) from public,anon,authenticated;
grant execute on function save_daily_operating_expenses(date,jsonb,text,text) to service_role;

create or replace view v_current_daily_operating_expenses as
select b.expense_date,b.batch_id,b.revision,b.note,b.created_by,b.created_at,
       i.item_id,i.category_code,i.category_name_snapshot,i.qty,i.unit_price,i.amount
from daily_expense_batches b
join (select expense_date,max(revision) revision from daily_expense_batches group by expense_date) latest
  on latest.expense_date=b.expense_date and latest.revision=b.revision
left join daily_expense_items i on i.batch_id=b.batch_id;
revoke all on v_current_daily_operating_expenses from public,anon,authenticated;
grant select on v_current_daily_operating_expenses to service_role;

insert into role_permissions(role_id,permission_key,allowed,updated_at)
select role_id,'manageOperatingExpenses',role_id in ('admin','management','ceo'),now() from app_roles
on conflict(role_id,permission_key) do nothing;
insert into role_permissions(role_id,permission_key,allowed,updated_at)
select role_id,'printIslandPurchaseOrder',role_id in ('admin','island_staff','management','ceo'),now() from app_roles
on conflict(role_id,permission_key) do nothing;

alter table if exists master_addons add column if not exists show_island_purchase_order boolean not null default false;
alter table if exists booking_addons add column if not exists show_island_purchase_order boolean not null default false;

create or replace function upsert_booking_v15(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_add jsonb; v_pid uuid; v_row uuid; v_no integer:=0; v_used uuid[]:='{}'::uuid[];
begin
  v_result:=upsert_booking_v14(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1; v_used:='{}'::uuid[];
    select passenger_id into v_pid from passengers where booking_id=v_booking_id and passenger_no=v_no;
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      select addon_row_id into v_row from booking_addons where passenger_id=v_pid and addon_source='island' and addon_row_id<>all(v_used)
        and addon_name_snapshot=coalesce(v_add->>'name','Other') and qty=coalesce((v_add->>'qty')::integer,1)
        and unit_price=coalesce((v_add->>'price')::numeric,0) order by addon_row_id limit 1;
      if v_row is null then select addon_row_id into v_row from booking_addons where passenger_id=v_pid and addon_source='island' and addon_row_id<>all(v_used) order by addon_row_id limit 1; end if;
      if v_row is not null then
        v_used:=array_append(v_used,v_row);
        update booking_addons set show_island_purchase_order=coalesce((v_add->'documentVisibility'->>'show_island_purchase_order')::boolean,false) where addon_row_id=v_row;
      end if;
    end loop;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v15() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_base jsonb; v_result jsonb:='[]'; v_booking jsonb; v_people jsonb; v_pass jsonb; v_bid uuid; v_pid uuid; v_island jsonb; v_no integer;
begin
  v_base:=list_bookings_json_v14();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_bid from bookings where booking_code=v_booking->>'bookingCode'; v_people:='[]'; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1; select passenger_id into v_pid from passengers where booking_id=v_bid and passenger_no=v_no;
      select coalesce(jsonb_agg(jsonb_build_object('id',ba.addon_id,'name',ba.addon_name_snapshot,'qty',ba.qty,'price',ba.unit_price,'defaultPrice',ba.default_price,'paymentMethod',coalesce(ba.payment_method,''),'receivedBy',coalesce(ba.received_by,''),'documentVisibility',jsonb_build_object('show_register',ba.show_register,'show_money_receipt',ba.show_money_receipt,'show_equipment_slip',ba.show_equipment_slip,'show_van_receipt',ba.show_van_receipt,'show_boat_ticket',ba.show_boat_ticket,'show_island_purchase_order',ba.show_island_purchase_order)) order by ba.created_at,ba.addon_row_id),'[]') into v_island from booking_addons ba where ba.passenger_id=v_pid and ba.addon_source='island';
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object('islandAddOns',v_island));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
