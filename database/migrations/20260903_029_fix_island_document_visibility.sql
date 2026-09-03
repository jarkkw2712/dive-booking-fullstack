-- Match each saved Island Add-on back to its database row by immutable booking
-- snapshot values. This avoids UUID ordering from assigning visibility to the
-- wrong row when a booking contains multiple custom Island Add-ons.
create or replace function upsert_booking_v14(p_booking jsonb) returns jsonb
language plpgsql security definer as $$
declare
  v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_add jsonb;
  v_pid uuid; v_addon_row_id uuid; v_no integer:=0; v_used uuid[]:='{}'::uuid[];
begin
  v_result:=upsert_booking_v13(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1; v_used:='{}'::uuid[];
    select passenger_id into v_pid from passengers where booking_id=v_booking_id and passenger_no=v_no;
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      select addon_row_id into v_addon_row_id from booking_addons
      where passenger_id=v_pid and addon_source='island'
        and addon_row_id<>all(v_used)
        and addon_name_snapshot=coalesce(v_add->>'name','Other')
        and qty=coalesce((v_add->>'qty')::integer,1)
        and unit_price=coalesce((v_add->>'price')::numeric,0)
      order by addon_row_id limit 1;
      if v_addon_row_id is null then
        select addon_row_id into v_addon_row_id from booking_addons
        where passenger_id=v_pid and addon_source='island' and addon_row_id<>all(v_used)
        order by addon_row_id limit 1;
      end if;
      if v_addon_row_id is not null then
        v_used:=array_append(v_used,v_addon_row_id);
        update booking_addons set
          show_register=coalesce((v_add->'documentVisibility'->>'show_register')::boolean,false),
          show_money_receipt=coalesce((v_add->'documentVisibility'->>'show_money_receipt')::boolean,true),
          show_equipment_slip=coalesce((v_add->'documentVisibility'->>'show_equipment_slip')::boolean,false),
          show_van_receipt=coalesce((v_add->'documentVisibility'->>'show_van_receipt')::boolean,false),
          show_boat_ticket=coalesce((v_add->'documentVisibility'->>'show_boat_ticket')::boolean,false)
        where addon_row_id=v_addon_row_id;
      end if;
    end loop;
  end loop;
  return v_result;
end $$;
