-- Persist the selected equipment payment channel after the existing booking
-- RPC recreates child rows. All writes remain in the same transaction.
create or replace function public.upsert_booking_v29(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_booking_id uuid;
  v_pass jsonb;
  v_add jsonb;
  v_passenger_id uuid;
  v_addon_row_id uuid;
  v_used uuid[];
  v_no integer := 0;
begin
  if jsonb_typeof(coalesce(p_booking->'passengers','[]'::jsonb)) <> 'array' then
    raise exception 'passengers must be an array';
  end if;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'preAddOns','[]'::jsonb)) loop
      if coalesce((v_add->>'selected')::boolean,false)
         and nullif(btrim(v_add->>'paymentMethod'),'') is null then
        raise exception 'Equipment payment method is required. Refresh the Booking before saving.';
      end if;
    end loop;
  end loop;

  if coalesce((p_booking->>'allowPassengerReduction')::boolean,false) then
    if jsonb_typeof(p_booking->'retainedPassengerNos') = 'array' then
      v_result := public.upsert_booking_v28(p_booking);
    else
      v_result := public.upsert_booking_v27(p_booking);
    end if;
  else
    v_result := public.upsert_booking_v26(p_booking);
  end if;

  select booking_id into strict v_booking_id from public.bookings
    where booking_code = v_result->>'bookingCode';
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no := v_no + 1;
    v_used := '{}'::uuid[];
    select passenger_id into strict v_passenger_id from public.passengers
      where booking_id = v_booking_id and passenger_no = v_no;
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'preAddOns','[]'::jsonb)) loop
      if not coalesce((v_add->>'selected')::boolean,false) then continue; end if;
      select addon_row_id into v_addon_row_id from public.booking_addons
        where passenger_id = v_passenger_id and addon_source = 'pre'
          and addon_id = coalesce(v_add->>'id','other')
          and qty = coalesce(nullif(v_add->>'qty','')::integer,1)
          and nights = coalesce(nullif(v_add->>'nights','')::integer,1)
          and unit_price = coalesce(nullif(v_add->>'price','')::numeric,0)
          and addon_row_id <> all(v_used)
        order by created_at,addon_row_id limit 1;
      if v_addon_row_id is null then
        raise exception 'Saved equipment row not found for %',coalesce(v_add->>'id','other');
      end if;
      update public.booking_addons
        set payment_method = btrim(v_add->>'paymentMethod')
        where addon_row_id = v_addon_row_id;
      v_used := array_append(v_used,v_addon_row_id);
      v_addon_row_id := null;
    end loop;
  end loop;
  return v_result;
end $$;

revoke all on function public.upsert_booking_v29(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_booking_v29(jsonb) to service_role;

-- Older saves recorded the submitted channel in the immutable audit payload,
-- while the equipment row itself was left blank. Restore only exact, unique
-- matches from each Booking's latest saved payload; never infer cash/transfer.
with latest as (
  select distinct on (booking_code) booking_code,after_json
  from public.audit_logs
  where action = 'UPSERT_BOOKING' and jsonb_typeof(after_json->'passengers') = 'array'
  order by booking_code,changed_at desc,audit_id desc
), submitted as (
  select l.booking_code,person.ordinality::integer as passenger_no,
    addon.item->>'id' as addon_id,
    coalesce(nullif(addon.item->>'qty','')::integer,1) as qty,
    coalesce(nullif(addon.item->>'nights','')::integer,1) as nights,
    coalesce(nullif(addon.item->>'price','')::numeric,0) as price,
    nullif(btrim(addon.item->>'paymentMethod'),'') as method
  from latest l
  cross join lateral jsonb_array_elements(l.after_json->'passengers') with ordinality as person(item,ordinality)
  cross join lateral jsonb_array_elements(coalesce(person.item->'preAddOns','[]'::jsonb)) as addon(item)
  where coalesce((addon.item->>'selected')::boolean,false)
), unique_submitted as (
  select s.*,count(*) over(partition by booking_code,passenger_no,addon_id,qty,nights,price) as matches
  from submitted s where method is not null
), exact_match as (
  select ba.addon_row_id,s.method
  from unique_submitted s
  join public.bookings b on b.booking_code = s.booking_code
  join public.passengers p on p.booking_id = b.booking_id and p.passenger_no = s.passenger_no
  join public.booking_addons ba on ba.passenger_id = p.passenger_id and ba.addon_source = 'pre'
    and ba.addon_id = s.addon_id and ba.qty = s.qty
    and ba.nights = s.nights and ba.unit_price = s.price
  where s.matches = 1 and nullif(btrim(ba.payment_method),'') is null
    and (select count(*) from public.booking_addons other_row
      where other_row.passenger_id = p.passenger_id and other_row.addon_source = 'pre'
        and other_row.addon_id = s.addon_id and other_row.qty = s.qty
        and other_row.nights = s.nights and other_row.unit_price = s.price) = 1
), restored as (
  update public.booking_addons ba set payment_method = m.method
  from exact_match m where ba.addon_row_id = m.addon_row_id
  returning ba.addon_row_id,ba.passenger_id,ba.payment_method
)
insert into public.audit_logs(booking_code,action,detail,after_json)
select b.booking_code,'EQUIPMENT_PAYMENT_METHOD_RESTORED',
  'Restored saved equipment payment method from latest Booking audit payload',
  jsonb_build_object('addonRowId',r.addon_row_id,'paymentMethod',r.payment_method)
from restored r join public.passengers p on p.passenger_id = r.passenger_id
  join public.bookings b on b.booking_id = p.booking_id;

notify pgrst, 'reload schema';
