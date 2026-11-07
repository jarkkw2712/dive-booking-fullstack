-- Keep the original payment as financial history; cancellation never deletes it.
alter table public.booking_credit_settlements
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists voided_role text,
  add column if not exists void_reason text;

-- The existing save function locks the Booking and checks its settled total.
-- Change only its two total queries, and fail safely if its body is unexpected.
do $$
declare definition text; updated text; needle text := 'where booking_id=v_booking_id;';
begin
  select pg_get_functiondef('public.upsert_booking_v31(jsonb)'::regprocedure) into definition;
  if (length(definition)-length(replace(definition,'where booking_id=v_booking_id and voided_at is null;','')))/length('where booking_id=v_booking_id and voided_at is null;') = 2 then return; end if;
  if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 2 then
    raise exception 'Unexpected upsert_booking_v31 definition; no changes applied';
  end if;
  updated:=replace(definition,needle,'where booking_id=v_booking_id and voided_at is null;');
  execute updated;
end $$;

create or replace function public.void_booking_credit_settlement(p_booking_code text,p_key uuid,p_reason text,p_actor text,p_role text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_booking_id uuid; v_row public.booking_credit_settlements%rowtype;
begin
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 or nullif(btrim(p_actor),'') is null or nullif(btrim(p_role),'') is null then
    raise exception 'Cancellation reason and actor are required';
  end if;
  select booking_id into v_booking_id from public.bookings where booking_code=p_booking_code for update;
  if v_booking_id is null then raise exception 'Booking not found'; end if;
  select * into v_row from public.booking_credit_settlements where booking_id=v_booking_id and idempotency_key=p_key for update;
  if not found then raise exception 'Credit settlement not found'; end if;
  if v_row.voided_at is not null then return jsonb_build_object('success',true,'alreadyVoided',true); end if;
  update public.booking_credit_settlements set voided_at=now(),voided_by=p_actor,voided_role=p_role,void_reason=btrim(p_reason) where settlement_id=v_row.settlement_id;
  insert into public.audit_logs(booking_code,action,detail,changed_by,actor_username,actor_role,entity_type,entity_id,success,before_json,after_json)
  values(p_booking_code,'CREDIT_SETTLEMENT_VOIDED',btrim(p_reason),p_actor,p_actor,p_role,'credit_settlement',p_key::text,true,
    jsonb_build_object('date',v_row.settlement_date,'amount',v_row.amount,'methodId',v_row.payment_method_id),jsonb_build_object('voided',true,'reason',btrim(p_reason)));
  return jsonb_build_object('success',true,'alreadyVoided',false);
end $$;
revoke all on function public.void_booking_credit_settlement(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.void_booking_credit_settlement(text,uuid,text,text,text) to service_role;
