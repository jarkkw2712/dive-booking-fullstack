-- Credit settlements are separate from the original Booking credit amount.
-- No existing financial history or report data is rewritten.
create table if not exists public.booking_credit_settlements (
  settlement_id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  booking_id uuid not null references public.bookings(booking_id) on delete restrict,
  origin_travel_date date,
  settlement_date date not null,
  payment_method_id text not null,
  payment_method_name text not null,
  payment_type text not null check (payment_type in ('cash','transfer')),
  amount numeric(14,2) not null check (amount > 0),
  created_by text not null,
  created_role text not null,
  created_at timestamptz not null default now()
);
create index if not exists booking_credit_settlements_booking_idx on public.booking_credit_settlements(booking_id,created_at);
create index if not exists booking_credit_settlements_date_idx on public.booking_credit_settlements(settlement_date,booking_id);
alter table public.booking_credit_settlements enable row level security;
revoke all on public.booking_credit_settlements from public,anon,authenticated;
revoke insert,update,delete on public.booking_credit_settlements from service_role;
grant select on public.booking_credit_settlements to service_role;

-- The surrounding Booking save and all pending receipts run in one transaction.
-- A Booking row lock serializes simultaneous edits/settlements of the same debt.
create or replace function public.upsert_booking_v31(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_booking_id uuid; v_result jsonb; v_pending jsonb; v_item jsonb; v_travel_date date;
  v_paid numeric(14,2); v_credit numeric(14,2); v_amount numeric;
  v_key uuid; v_date date; v_method public.master_payment_methods%rowtype;
  v_type text; v_existing public.booking_credit_settlements%rowtype;
  v_user text:=nullif(btrim(p_booking->>'settlementActor'),'');
  v_role text:=nullif(btrim(p_booking->>'settlementActorRole'),'');
begin
  v_pending:=coalesce(p_booking->'creditSettlementsPending','[]'::jsonb);
  if jsonb_typeof(v_pending)<>'array' or jsonb_array_length(v_pending)>100 then
    raise exception 'Invalid credit settlement entries';
  end if;
  if jsonb_array_length(v_pending)>0 and (v_user is null or v_role is null) then
    raise exception 'Credit settlement actor is required';
  end if;
  select booking_id into v_booking_id from public.bookings
    where booking_code=p_booking->>'bookingCode' for update;
  v_credit:=coalesce(nullif(p_booking->>'creditAmount','')::numeric,0);
  if v_credit<0 then raise exception 'Credit amount cannot be negative'; end if;
  if v_booking_id is not null then
    select coalesce(sum(amount),0) into v_paid from public.booking_credit_settlements where booking_id=v_booking_id;
    if v_credit<v_paid then raise exception 'Credit amount cannot be less than recorded settlements'; end if;
  end if;
  v_result:=public.upsert_booking_v30(p_booking);
  select booking_id,travel_date into strict v_booking_id,v_travel_date from public.bookings where booking_code=v_result->>'bookingCode' for update;
  select coalesce(sum(amount),0) into v_paid from public.booking_credit_settlements where booking_id=v_booking_id;
  if v_credit<v_paid then raise exception 'Credit amount cannot be less than recorded settlements'; end if;
  for v_item in select value from jsonb_array_elements(v_pending) loop
    v_key:=nullif(v_item->>'idempotencyKey','')::uuid;
    v_date:=nullif(v_item->>'date','')::date;
    v_amount:=nullif(v_item->>'amount','')::numeric;
    if v_key is null or v_date is null or v_amount is null or v_amount<=0 or v_amount>100000000 or round(v_amount,2)<>v_amount then
      raise exception 'Invalid credit settlement';
    end if;
    select * into v_method from public.master_payment_methods
      where method_id=v_item->>'methodId' and active_flag=true;
    if not found or v_method.method_id ~* '(unspecified|reconfirm)' then
      raise exception 'Select a valid active credit settlement method';
    end if;
    v_type:=case when lower(v_method.method_id)='cash' then 'cash'
      when lower(v_method.method_id) like '%bank_transfer%' then 'transfer'
      when v_method.payment_type in ('cash','transfer') then v_method.payment_type else null end;
    if v_type is null then raise exception 'Select a cash or transfer method'; end if;
    select * into v_existing from public.booking_credit_settlements where idempotency_key=v_key;
    if found then
      if v_existing.booking_id<>v_booking_id or v_existing.settlement_date<>v_date
        or v_existing.amount<>v_amount or v_existing.payment_method_id<>v_method.method_id then
        raise exception 'Settlement idempotency key already used with different data';
      end if;
      continue;
    end if;
    if v_paid+v_amount>v_credit then raise exception 'Credit settlements exceed credit amount'; end if;
    insert into public.booking_credit_settlements(idempotency_key,booking_id,origin_travel_date,settlement_date,payment_method_id,payment_method_name,payment_type,amount,created_by,created_role)
      values(v_key,v_booking_id,v_travel_date,v_date,v_method.method_id,v_method.method_name,v_type,v_amount,v_user,v_role);
    insert into public.audit_logs(booking_code,action,detail,changed_by,actor_username,actor_role,entity_type,entity_id,success,after_json)
      values(p_booking->>'bookingCode','CREDIT_SETTLEMENT_CREATED','Credit settlement added',v_user,v_user,v_role,'credit_settlement',v_key::text,true,
        jsonb_build_object('date',v_date,'amount',v_amount,'methodId',v_method.method_id,'methodName',v_method.method_name,'type',v_type));
    v_paid:=v_paid+v_amount;
  end loop;
  return v_result;
end $$;
revoke all on function public.upsert_booking_v31(jsonb) from public,anon,authenticated;
grant execute on function public.upsert_booking_v31(jsonb) to service_role;
