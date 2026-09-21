-- Separate outbound and return transportation methods per passenger.
-- Existing rows inherit their original transportation method; no travel history is deleted.
alter table if exists passengers
  add column if not exists return_transportation_method text;

update passengers
set return_transportation_method=transportation_method
where return_transportation_method is null;

create or replace function upsert_booking_v16(p_booking jsonb) returns jsonb
language plpgsql security definer as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_no integer:=0;
begin
  v_result:=upsert_booking_v15(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    update passengers set
      return_transportation_method=nullif(trim(coalesce(v_pass->>'returnTransportationMethod',v_pass->>'transportationMethod','')),'')
    where booking_id=v_booking_id and passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v16() returns jsonb
language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_people jsonb; v_pass jsonb; v_booking_id uuid; v_person passengers%rowtype; v_no integer;
begin
  v_base:=list_bookings_json_v15();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_booking_id from bookings where booking_code=v_booking->>'bookingCode';
    v_people:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select * into v_person from passengers where booking_id=v_booking_id and passenger_no=v_no;
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object(
        'returnTransportationMethod',coalesce(v_person.return_transportation_method,v_person.transportation_method,'')
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
