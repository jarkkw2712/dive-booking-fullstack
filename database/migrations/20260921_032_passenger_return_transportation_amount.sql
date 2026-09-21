-- Store outbound and return transportation prices independently.
-- Historical bookings keep a zero return price so existing totals are not doubled.
alter table if exists passengers
  add column if not exists return_transportation_amount numeric(14,2) not null default 0
  check (return_transportation_amount >= 0);

create or replace function upsert_booking_v17(p_booking jsonb) returns jsonb
language plpgsql security definer as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_no integer:=0;
begin
  v_result:=upsert_booking_v16(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    update passengers set
      return_transportation_amount=greatest(coalesce((v_pass->>'returnTransportationAmount')::numeric,0),0)
    where booking_id=v_booking_id and passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v17() returns jsonb
language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_people jsonb; v_pass jsonb; v_booking_id uuid; v_person passengers%rowtype; v_no integer;
begin
  v_base:=list_bookings_json_v16();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_booking_id from bookings where booking_code=v_booking->>'bookingCode';
    v_people:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select * into v_person from passengers where booking_id=v_booking_id and passenger_no=v_no;
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object(
        'returnTransportationAmount',coalesce(v_person.return_transportation_amount,0)
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
