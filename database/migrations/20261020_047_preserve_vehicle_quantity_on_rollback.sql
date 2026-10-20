-- Protect vehicle quantity from old v25 clients during an application rollback.
-- This only adds a rejection guard; it retains the existing save logic.
create or replace function public.upsert_booking_v25(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb; v_booking_id uuid; v_pass jsonb; v_stop jsonb;
  v_passenger_id uuid; v_no integer:=0; v_stop_no integer;
begin
  if jsonb_typeof(coalesce(p_booking->'passengers','[]'::jsonb))<>'array' then
    raise exception 'passengers must be an array';
  end if;

  -- v24 recreates passenger rows. Refuse an old browser payload rather than
  -- silently deleting routes that a newer client has already saved.
  if exists (
    select 1 from bookings b
    join passengers p on p.booking_id=b.booking_id
    left join lateral (
      select item from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb))
        with ordinality as incoming(item,ordinality)
      where incoming.ordinality=p.passenger_no
    ) incoming on true
    where b.booking_code=p_booking->>'bookingCode'
      and (
        (p.outbound_to is not null and not coalesce(incoming.item ? 'outboundTo',false))
        or (p.return_to is not null and not coalesce(incoming.item ? 'returnTo',false))
        or (exists(select 1 from passenger_transport_stops s where s.passenger_id=p.passenger_id)
          and not coalesce(incoming.item ? 'extraTransportStops',false))
      )
  ) then
    raise exception 'Booking has new route details. Refresh the page before saving.';
  end if;

  -- A rolled-back backend may call v25 directly. Keep saved vehicle counts.
  if exists (
    select 1 from bookings b
    join passengers p on p.booking_id=b.booking_id
    left join lateral (
      select item from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb))
        with ordinality as incoming(item,ordinality)
      where incoming.ordinality=p.passenger_no
    ) incoming on true
    where b.booking_code=p_booking->>'bookingCode'
      and (
        (p.transportation_quantity<>1 and not coalesce(incoming.item ? 'transportationQuantity',false))
        or (p.return_transportation_quantity<>1 and not coalesce(incoming.item ? 'returnTransportationQuantity',false))
        or exists (
          select 1 from passenger_transport_stops s
          left join lateral (
            select item from jsonb_array_elements(coalesce(incoming.item->'extraTransportStops','[]'::jsonb))
              with ordinality as supplied(item,ordinality)
            where supplied.ordinality=s.stop_no
          ) supplied on true
          where s.passenger_id=p.passenger_id and s.quantity<>1
            and not coalesce(supplied.item ? 'quantity',false)
        )
      )
  ) then
    raise exception 'Booking has vehicle quantities. Refresh the page before saving.';
  end if;

  v_result:=upsert_booking_v24(p_booking);
  select booking_id into v_booking_id from bookings
    where booking_code=v_result->>'bookingCode';

  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    select passenger_id into v_passenger_id from passengers
      where booking_id=v_booking_id and passenger_no=v_no;
    update passengers set
      outbound_to=nullif(trim(v_pass->>'outboundTo'),''),
      return_to=nullif(trim(v_pass->>'returnTo'),'')
    where passenger_id=v_passenger_id;

    if jsonb_typeof(coalesce(v_pass->'extraTransportStops','[]'::jsonb))<>'array'
      or jsonb_array_length(coalesce(v_pass->'extraTransportStops','[]'::jsonb))>30 then
      raise exception 'extraTransportStops must be an array of at most 30 rows';
    end if;
    v_stop_no:=0;
    for v_stop in select value from jsonb_array_elements(coalesce(v_pass->'extraTransportStops','[]'::jsonb)) loop
      if jsonb_typeof(v_stop)<>'object' then
        raise exception 'Each transport stop must be an object';
      end if;
      v_stop_no:=v_stop_no+1;
      insert into passenger_transport_stops(
        passenger_id,stop_no,travel_date,from_location,to_location,
        transportation_method,amount,payment_method
      ) values (
        v_passenger_id,v_stop_no,nullif(v_stop->>'date','')::date,
        nullif(trim(v_stop->>'from'),''),nullif(trim(v_stop->>'to'),''),
        nullif(trim(v_stop->>'method'),''),
        coalesce(nullif(v_stop->>'amount','')::numeric,0),
        nullif(trim(v_stop->>'paymentMethod'),'')
      );
    end loop;
  end loop;
  return v_result;
end $$;

revoke all on function public.upsert_booking_v25(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_booking_v25(jsonb) to service_role;
notify pgrst, 'reload schema';
