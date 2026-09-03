-- Separate outbound/return destinations and retain per-booking Island Add-on
-- document choices. Historical values are copied forward without deletion.
alter table if exists passengers
  add column if not exists outbound_destination text,
  add column if not exists return_destination text;

update passengers set outbound_destination=coalesce(outbound_destination,transportation_destination)
where outbound_destination is null;

alter table if exists booking_addons
  add column if not exists show_register boolean not null default false,
  add column if not exists show_money_receipt boolean not null default true,
  add column if not exists show_equipment_slip boolean not null default false,
  add column if not exists show_van_receipt boolean not null default false,
  add column if not exists show_boat_ticket boolean not null default false;

create or replace function upsert_booking_v13(p_booking jsonb) returns jsonb
language plpgsql security definer as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_add jsonb; v_pid uuid; v_addon_row_id uuid; v_no integer:=0; v_add_no integer;
begin
  v_result:=upsert_booking_v12(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    select passenger_id into v_pid from passengers where booking_id=v_booking_id and passenger_no=v_no;
    update passengers set
      outbound_destination=nullif(trim(coalesce(v_pass->>'outboundDestination',v_pass->>'transportationDestination','')),''),
      return_destination=nullif(trim(v_pass->>'returnDestination'),'')
    where passenger_id=v_pid;
    v_add_no:=0;
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      v_add_no:=v_add_no+1;
      select addon_row_id into v_addon_row_id from booking_addons
      where passenger_id=v_pid and addon_source='island'
      order by created_at,addon_row_id offset v_add_no-1 limit 1;
      update booking_addons set
        show_register=coalesce((v_add->'documentVisibility'->>'show_register')::boolean,false),
        show_money_receipt=coalesce((v_add->'documentVisibility'->>'show_money_receipt')::boolean,true),
        show_equipment_slip=coalesce((v_add->'documentVisibility'->>'show_equipment_slip')::boolean,false),
        show_van_receipt=coalesce((v_add->'documentVisibility'->>'show_van_receipt')::boolean,false),
        show_boat_ticket=coalesce((v_add->'documentVisibility'->>'show_boat_ticket')::boolean,false)
      where addon_row_id=v_addon_row_id;
    end loop;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v14() returns jsonb
language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_people jsonb; v_pass jsonb; v_booking_id uuid; v_person passengers%rowtype; v_island jsonb; v_no integer;
begin
  v_base:=list_bookings_json_v13();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_booking_id from bookings where booking_code=v_booking->>'bookingCode';
    v_people:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select * into v_person from passengers where booking_id=v_booking_id and passenger_no=v_no;
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',ba.addon_id,'name',ba.addon_name_snapshot,'qty',ba.qty,'price',ba.unit_price,
        'defaultPrice',ba.default_price,'paymentMethod',coalesce(ba.payment_method,''),'receivedBy',coalesce(ba.received_by,''),
        'documentVisibility',jsonb_build_object('show_register',ba.show_register,'show_money_receipt',ba.show_money_receipt,
          'show_equipment_slip',ba.show_equipment_slip,'show_van_receipt',ba.show_van_receipt,'show_boat_ticket',ba.show_boat_ticket)
      ) order by ba.created_at,ba.addon_row_id),'[]'::jsonb) into v_island
      from booking_addons ba where ba.passenger_id=v_person.passenger_id and ba.addon_source='island';
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object(
        'outboundDestination',coalesce(v_person.outbound_destination,''),
        'returnDestination',coalesce(v_person.return_destination,''),
        'islandAddOns',v_island
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
