-- Vehicle quantity per passenger travel leg. Existing rows mean one vehicle.
-- Unit prices remain in the existing numeric amount columns.
alter table if exists public.passengers
  add column if not exists transportation_quantity integer not null default 1,
  add column if not exists return_transportation_quantity integer not null default 1;

alter table if exists public.passenger_transport_stops
  add column if not exists quantity integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.passengers'::regclass and conname='passengers_transportation_quantity_check') then
    alter table public.passengers add constraint passengers_transportation_quantity_check check (transportation_quantity between 1 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.passengers'::regclass and conname='passengers_return_transportation_quantity_check') then
    alter table public.passengers add constraint passengers_return_transportation_quantity_check check (return_transportation_quantity between 1 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.passenger_transport_stops'::regclass and conname='passenger_transport_stops_quantity_check') then
    alter table public.passenger_transport_stops add constraint passenger_transport_stops_quantity_check check (quantity between 1 and 30);
  end if;
end $$;

create or replace function public.upsert_booking_v26(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb; v_booking_id uuid; v_pass jsonb; v_stop jsonb;
  v_passenger_id uuid; v_no integer:=0; v_stop_no integer;
begin
  if jsonb_typeof(coalesce(p_booking->'passengers','[]'::jsonb))<>'array' then
    raise exception 'passengers must be an array';
  end if;

  -- v25 recreates passenger and stop rows. Refuse older payloads that omit
  -- previously saved non-default quantities instead of resetting them to one.
  if exists (
    select 1 from public.bookings b
    join public.passengers p on p.booking_id=b.booking_id
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
          select 1 from public.passenger_transport_stops s
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

  v_result:=public.upsert_booking_v25(p_booking);
  select booking_id into v_booking_id from public.bookings
    where booking_code=v_result->>'bookingCode';

  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    select passenger_id into v_passenger_id from public.passengers
      where booking_id=v_booking_id and passenger_no=v_no;
    update public.passengers set
      transportation_quantity=coalesce(nullif(v_pass->>'transportationQuantity','')::integer,1),
      return_transportation_quantity=coalesce(nullif(v_pass->>'returnTransportationQuantity','')::integer,1)
    where passenger_id=v_passenger_id;

    v_stop_no:=0;
    for v_stop in select value from jsonb_array_elements(coalesce(v_pass->'extraTransportStops','[]'::jsonb)) loop
      v_stop_no:=v_stop_no+1;
      update public.passenger_transport_stops set
        quantity=coalesce(nullif(v_stop->>'quantity','')::integer,1)
      where passenger_id=v_passenger_id and stop_no=v_stop_no;
    end loop;
  end loop;
  return v_result;
end $$;

create or replace function public.list_bookings_json_v26() returns jsonb
language sql stable security definer set search_path=public as $$
with base as (
  select item,ordinality as booking_no
  from jsonb_array_elements(public.list_bookings_json_v25()) with ordinality as x(item,ordinality)
)
select coalesce(jsonb_agg(
  base.item||jsonb_build_object('passengers',coalesce((
    select jsonb_agg(person.item||jsonb_build_object(
      'transportationQuantity',coalesce(p.transportation_quantity,1),
      'returnTransportationQuantity',coalesce(p.return_transportation_quantity,1),
      'extraTransportStops',coalesce((
        select jsonb_agg(stop.item||jsonb_build_object('quantity',coalesce(s.quantity,1)) order by stop.ordinality)
        from jsonb_array_elements(coalesce(person.item->'extraTransportStops','[]'::jsonb))
          with ordinality as stop(item,ordinality)
        left join public.passenger_transport_stops s on s.passenger_id=p.passenger_id and s.stop_no=stop.ordinality
      ),'[]'::jsonb)
    ) order by person.ordinality)
    from jsonb_array_elements(coalesce(base.item->'passengers','[]'::jsonb))
      with ordinality as person(item,ordinality)
    left join public.bookings b on b.booking_code=base.item->>'bookingCode'
    left join public.passengers p on p.booking_id=b.booking_id and p.passenger_no=person.ordinality
  ),'[]'::jsonb)) order by base.booking_no
),'[]'::jsonb)
from base;
$$;

revoke all on function public.upsert_booking_v26(jsonb) from public, anon, authenticated;
revoke all on function public.list_bookings_json_v26() from public, anon, authenticated;
grant execute on function public.upsert_booking_v26(jsonb) to service_role;
grant execute on function public.list_bookings_json_v26() to service_role;
notify pgrst, 'reload schema';
