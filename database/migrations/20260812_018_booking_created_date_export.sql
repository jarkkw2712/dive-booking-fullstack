-- Expose the immutable booking creation timestamp for operational exports.
create or replace function list_bookings_json_v9() returns jsonb language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_created timestamptz;
begin
  v_base:=list_bookings_json_v8();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select created_at into v_created from bookings where booking_code=v_booking->>'bookingCode';
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('createdAt',v_created));
  end loop;
  return v_result;
end $$;
