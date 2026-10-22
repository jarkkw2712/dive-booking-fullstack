-- An explicit, audited reduction of a saved Booking's passenger list.
-- v26/v25 continue to reject missing travel fields from stale clients.
-- v27 is only called after the operator confirms removal from the tail.
create or replace function public.upsert_booking_v27(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_booking_id uuid;
  v_existing_count integer;
  v_new_count integer;
  v_people jsonb:=coalesce(p_booking->'passengers','[]'::jsonb);
  v_removed jsonb;
  v_result jsonb;
  v_pass jsonb;
  v_stop jsonb;
  v_existing public.passengers%rowtype;
  v_passenger_id uuid;
  v_no integer:=0;
  v_stop_no integer;
begin
  if jsonb_typeof(v_people) is distinct from 'array' then
    raise exception 'passengers must be an array';
  end if;
  v_new_count:=jsonb_array_length(v_people);
  if v_new_count<1 then
    raise exception 'A Booking must have at least one passenger';
  end if;

  -- Serialize concurrent edits and reject a stale form before removing rows.
  select b.booking_id into v_booking_id from public.bookings b
    where b.booking_code=p_booking->>'bookingCode' for update;
  if v_booking_id is null then
    raise exception 'Booking not found';
  end if;
  select count(*) into v_existing_count from public.passengers
    where booking_id=v_booking_id;
  if not coalesce((p_booking->>'allowPassengerReduction')::boolean,false)
    or nullif(p_booking->>'expectedPassengerCount','')::integer is distinct from v_existing_count
    or v_new_count>=v_existing_count then
    raise exception 'Passenger count changed. Reload the Booking and confirm the reduction again.';
  end if;

  -- All surviving rows still need the newest route and vehicle fields. Only
  -- rows beyond v_new_count are intentionally absent from this payload.
  for v_pass in select value from jsonb_array_elements(v_people) loop
    v_no:=v_no+1;
    select * into v_existing from public.passengers
      where booking_id=v_booking_id and passenger_no=v_no;
    if (v_existing.outbound_to is not null and not (v_pass ? 'outboundTo'))
      or (v_existing.return_to is not null and not (v_pass ? 'returnTo'))
      or (v_existing.transportation_quantity<>1 and not (v_pass ? 'transportationQuantity'))
      or (v_existing.return_transportation_quantity<>1 and not (v_pass ? 'returnTransportationQuantity'))
      or (exists(select 1 from public.passenger_transport_stops s
            where s.passenger_id=v_existing.passenger_id)
          and not (v_pass ? 'extraTransportStops')) then
      raise exception 'Booking has new travel details. Refresh the page before saving.';
    end if;
    if exists (
      select 1 from public.passenger_transport_stops s
      left join lateral (
        select item from jsonb_array_elements(coalesce(v_pass->'extraTransportStops','[]'::jsonb))
          with ordinality as supplied(item,ordinality)
        where supplied.ordinality=s.stop_no
      ) supplied on true
      where s.passenger_id=v_existing.passenger_id and s.quantity<>1
        and not coalesce(supplied.item ? 'quantity',false)
    ) then
      raise exception 'Booking has vehicle quantities. Refresh the page before saving.';
    end if;
  end loop;

  -- Keep a snapshot of removed people and their billable/route records in
  -- immutable audit history before the existing upsert recreates child rows.
  select coalesce(jsonb_agg(jsonb_build_object(
    'passenger',to_jsonb(p),
    'programs',coalesce((select jsonb_agg(to_jsonb(bp)) from public.booking_programs bp
      where bp.passenger_id=p.passenger_id),'[]'::jsonb),
    'addons',coalesce((select jsonb_agg(to_jsonb(ba)) from public.booking_addons ba
      where ba.passenger_id=p.passenger_id),'[]'::jsonb),
    'transportStops',coalesce((select jsonb_agg(to_jsonb(s)) from public.passenger_transport_stops s
      where s.passenger_id=p.passenger_id),'[]'::jsonb)
  ) order by p.passenger_no),'[]'::jsonb) into v_removed
  from public.passengers p
  where p.booking_id=v_booking_id and p.passenger_no>v_new_count;

  -- v24 persists the complete booking, including equipment nights. Reapply
  -- the v25/v26 travel fields for the retained passengers in this transaction.
  v_result:=public.upsert_booking_v24(p_booking);
  v_no:=0;
  for v_pass in select value from jsonb_array_elements(v_people) loop
    v_no:=v_no+1;
    select passenger_id into v_passenger_id from public.passengers
      where booking_id=v_booking_id and passenger_no=v_no;
    update public.passengers set
      outbound_to=nullif(trim(v_pass->>'outboundTo'),''),
      return_to=nullif(trim(v_pass->>'returnTo'),''),
      transportation_quantity=coalesce(nullif(v_pass->>'transportationQuantity','')::integer,1),
      return_transportation_quantity=coalesce(nullif(v_pass->>'returnTransportationQuantity','')::integer,1)
    where passenger_id=v_passenger_id;

    if jsonb_typeof(coalesce(v_pass->'extraTransportStops','[]'::jsonb)) is distinct from 'array'
      or jsonb_array_length(coalesce(v_pass->'extraTransportStops','[]'::jsonb))>30 then
      raise exception 'extraTransportStops must be an array of at most 30 rows';
    end if;
    v_stop_no:=0;
    for v_stop in select value from jsonb_array_elements(coalesce(v_pass->'extraTransportStops','[]'::jsonb)) loop
      if jsonb_typeof(v_stop) is distinct from 'object' then
        raise exception 'Each transport stop must be an object';
      end if;
      v_stop_no:=v_stop_no+1;
      insert into public.passenger_transport_stops(
        passenger_id,stop_no,travel_date,from_location,to_location,
        transportation_method,amount,payment_method,quantity
      ) values (
        v_passenger_id,v_stop_no,nullif(v_stop->>'date','')::date,
        nullif(trim(v_stop->>'from'),''),nullif(trim(v_stop->>'to'),''),
        nullif(trim(v_stop->>'method'),''),
        coalesce(nullif(v_stop->>'amount','')::numeric,0),
        nullif(trim(v_stop->>'paymentMethod'),''),
        coalesce(nullif(v_stop->>'quantity','')::integer,1)
      );
    end loop;
  end loop;

  insert into public.audit_logs(
    booking_code,action,detail,before_json,after_json,changed_by,
    actor_username,entity_type,entity_id
  ) values (
    p_booking->>'bookingCode','PASSENGER_COUNT_REDUCED',
    format('Passenger count reduced from %s to %s',v_existing_count,v_new_count),
    jsonb_build_object('previousCount',v_existing_count,'removedPassengers',v_removed),
    jsonb_build_object('newCount',v_new_count,'passengers',v_people),
    nullif(p_booking->>'createdBy',''),nullif(p_booking->>'createdBy',''),
    'booking',p_booking->>'bookingCode'
  );
  return v_result;
end $$;

revoke all on function public.upsert_booking_v27(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_booking_v27(jsonb) to service_role;
notify pgrst, 'reload schema';
