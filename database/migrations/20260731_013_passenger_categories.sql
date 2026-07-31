-- Passenger categories for adult/child/infant/FOC composition.
alter table if exists passengers
  add column if not exists passenger_type text not null default 'adult';

do $$
begin
  if not exists(select 1 from pg_constraint where conname='passengers_passenger_type_check') then
    alter table passengers add constraint passengers_passenger_type_check
      check(passenger_type in('adult','child','infant','foc'));
  end if;
end $$;

create or replace function upsert_booking_v7(p_booking jsonb)
returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text; v_pass jsonb; v_no integer:=0;
begin
  v_result:=upsert_booking_v6(p_booking);
  v_code:=v_result->>'bookingCode';
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    update passengers p set
      passenger_type=case when v_pass->>'passengerType' in('adult','child','infant','foc')
        then v_pass->>'passengerType' else 'adult' end
    from bookings b
    where p.booking_id=b.booking_id and b.booking_code=v_code and p.passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v6()
returns jsonb language plpgsql security definer as $$
declare
  v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_passengers jsonb; v_pass jsonb;
  v_booking_code text; v_no integer; v_type text;
begin
  v_base:=list_bookings_json_v5();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    v_booking_code:=v_booking->>'bookingCode'; v_passengers:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select p.passenger_type into v_type
      from passengers p join bookings b on b.booking_id=p.booking_id
      where b.booking_code=v_booking_code and p.passenger_no=v_no limit 1;
      v_passengers:=v_passengers||jsonb_build_array(v_pass||jsonb_build_object(
        'passengerType',coalesce(v_type,'adult')
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(jsonb_set(v_booking,'{passengers}',v_passengers));
  end loop;
  return v_result;
end $$;
