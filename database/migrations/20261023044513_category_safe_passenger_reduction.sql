-- Preserve the identity of survivors when a category reduction removes a
-- passenger from the middle of the list. The legacy v27 RPC remains available
-- for older clients; this RPC requires an explicit original-row mapping.
create or replace function public.upsert_booking_v28(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_booking_id uuid;
  v_existing_count integer;
  v_new_count integer;
  v_people jsonb:=coalesce(p_booking->'passengers','[]'::jsonb);
  v_retained jsonb:=p_booking->'retainedPassengerNos';
  v_seen integer[]:='{}'::integer[];
  v_source jsonb;
  v_source_no integer;
  v_removed jsonb;
  v_result jsonb;
  v_pass jsonb;
  v_stop jsonb;
  v_existing public.passengers%rowtype;
  v_passenger_id uuid;
  v_no integer:=0;
  v_stop_no integer;
begin
  if jsonb_typeof(v_people) is distinct from 'array'
    or jsonb_typeof(v_retained) is distinct from 'array' then
    raise exception 'passengers and retainedPassengerNos must be arrays';
  end if;
  v_new_count:=jsonb_array_length(v_people);
  if v_new_count<1 or jsonb_array_length(v_retained)<>v_new_count then
    raise exception 'Passenger mapping does not match the submitted passengers';
  end if;

  -- Serialize concurrent edits and refuse an obsolete form before any write.
  select b.booking_id into v_booking_id from public.bookings b
    where b.booking_code=p_booking->>'bookingCode' for update;
  if v_booking_id is null then raise exception 'Booking not found'; end if;
  select count(*) into v_existing_count from public.passengers
    where booking_id=v_booking_id;
  if not coalesce((p_booking->>'allowPassengerReduction')::boolean,false)
    or nullif(p_booking->>'expectedPassengerCount','')::integer is distinct from v_existing_count
    or v_new_count>=v_existing_count then
    raise exception 'Passenger count changed. Reload the Booking and confirm the reduction again.';
  end if;
  if v_retained->>0 is distinct from '1' then
    raise exception 'The trip leader must remain the first passenger';
  end if;

  -- 0 denotes a new passenger added in the same edit. Positive ordinals must
  -- refer to distinct rows from the booking as it was loaded.
  for v_source in select value from jsonb_array_elements(v_retained) loop
    if jsonb_typeof(v_source)<>'number' or v_source::text !~ '^[0-9]+$' then
      raise exception 'Invalid retained passenger number';
    end if;
    v_source_no:=(v_source::text)::integer;
    if v_source_no>v_existing_count or (v_source_no>0 and v_source_no=any(v_seen)) then
      raise exception 'Passenger mapping is stale or duplicated. Reload the Booking.';
    end if;
    if v_source_no>0 then v_seen:=array_append(v_seen,v_source_no); end if;
  end loop;

  -- Check the original source row, not its new ordinal, for travel data that
  -- must not be silently erased by an older form.
  for v_pass in select value from jsonb_array_elements(v_people) loop
    v_no:=v_no+1;
    v_source_no:=(v_retained->>(v_no-1))::integer;
    if v_source_no=0 then continue; end if;
    select * into v_existing from public.passengers
      where booking_id=v_booking_id and passenger_no=v_source_no;
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

  -- Snapshot the actual removed passengers and their billable/route history.
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
  where p.booking_id=v_booking_id and not (p.passenger_no=any(v_seen));

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
    format('Passenger count reduced from %s to %s by category',v_existing_count,v_new_count),
    jsonb_build_object('previousCount',v_existing_count,'removedPassengers',v_removed),
    jsonb_build_object('newCount',v_new_count,'retainedPassengerNos',v_retained,'passengers',v_people),
    nullif(p_booking->>'createdBy',''),nullif(p_booking->>'createdBy',''),
    'booking',p_booking->>'bookingCode'
  );
  return v_result;
end $$;

revoke all on function public.upsert_booking_v28(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_booking_v28(jsonb) to service_role;
notify pgrst, 'reload schema';
