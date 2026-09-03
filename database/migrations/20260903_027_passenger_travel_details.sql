-- Per-passenger travel details. Existing bookings inherit their booking-level dates
-- and existing pickup text so no operational history disappears.
alter table if exists passengers
  add column if not exists passenger_travel_date date,
  add column if not exists passenger_return_date date,
  add column if not exists transportation_destination text;

update passengers p set
  passenger_travel_date=coalesce(p.passenger_travel_date,b.travel_date),
  passenger_return_date=coalesce(p.passenger_return_date,b.return_date),
  transportation_destination=coalesce(p.transportation_destination,p.pickup_location)
from bookings b where b.booking_id=p.booking_id;

create or replace function upsert_booking_v12(p_booking jsonb) returns jsonb
language plpgsql security definer as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_no integer:=0;
begin
  v_result:=upsert_booking_v11(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    update passengers set
      passenger_travel_date=coalesce(nullif(v_pass->>'passengerTravelDate','')::date,nullif(p_booking->>'travelDate','')::date),
      passenger_return_date=coalesce(nullif(v_pass->>'passengerReturnDate','')::date,nullif(p_booking->>'returnDate','')::date),
      transportation_destination=nullif(trim(coalesce(v_pass->>'transportationDestination',v_pass->>'pickupLocation','')),'')
    where booking_id=v_booking_id and passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v13() returns jsonb
language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_people jsonb; v_pass jsonb; v_booking_id uuid; v_person passengers%rowtype; v_no integer;
begin
  v_base:=list_bookings_json_v12();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_booking_id from bookings where booking_code=v_booking->>'bookingCode';
    v_people:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select * into v_person from passengers where booking_id=v_booking_id and passenger_no=v_no;
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object(
        'passengerTravelDate',coalesce(v_person.passenger_travel_date::text,''),
        'passengerReturnDate',coalesce(v_person.passenger_return_date::text,''),
        'transportationDestination',coalesce(v_person.transportation_destination,'')
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
