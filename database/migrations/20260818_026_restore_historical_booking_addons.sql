-- Preserve historical booking add-ons even when their Master Data row was renamed or removed.
-- The booking snapshot remains the source of truth for the historical name and price.
create or replace function list_bookings_json_v12() returns jsonb
language plpgsql security definer as $$
declare
  v_base jsonb; v_result jsonb := '[]'::jsonb; v_booking jsonb; v_people jsonb;
  v_pass jsonb; v_addons jsonb; v_booking_id uuid; v_passenger_id uuid; v_no integer;
begin
  v_base := list_bookings_json_v11();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_booking_id from bookings where booking_code=v_booking->>'bookingCode';
    v_people := '[]'::jsonb; v_no := 0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no := v_no + 1;
      select passenger_id into v_passenger_id from passengers where booking_id=v_booking_id and passenger_no=v_no;
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',ba.addon_id,
        'name',coalesce(nullif(ba.addon_name_snapshot,''),ma.addon_name,ba.addon_id),
        'selected',true,'qty',ba.qty,'price',ba.unit_price,'defaultPrice',ba.default_price,
        'customName',case when ba.addon_id='other' then coalesce(ba.addon_name_snapshot,'') else '' end
      ) order by ba.created_at), '[]'::jsonb)
      into v_addons
      from booking_addons ba left join master_addons ma on ma.addon_id=ba.addon_id
      where ba.passenger_id=v_passenger_id and ba.addon_source='pre';
      v_people := v_people || jsonb_build_array(v_pass || jsonb_build_object('preAddOns',v_addons));
    end loop;
    v_result := v_result || jsonb_build_array(v_booking || jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
