-- Passenger route endpoints and additional transport legs.
-- Historical unknown destinations remain NULL; never infer "Sabina".
alter table if exists public.passengers
  add column if not exists outbound_to text,
  add column if not exists return_to text;

create table if not exists public.passenger_transport_stops (
  stop_id bigserial primary key,
  passenger_id uuid not null references public.passengers(passenger_id) on delete cascade,
  stop_no integer not null check (stop_no between 1 and 30),
  travel_date date,
  from_location text,
  to_location text,
  transportation_method text,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  payment_method text,
  unique (passenger_id,stop_no)
);

create index if not exists passenger_transport_stops_date_idx
  on public.passenger_transport_stops(travel_date);

alter table public.passenger_transport_stops enable row level security;

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

create or replace function public.list_bookings_json_v25() returns jsonb
language sql stable security definer set search_path=public as $$
with base as (
  select item,ordinality as booking_no
  from jsonb_array_elements(list_bookings_json_v24()) with ordinality as x(item,ordinality)
)
select coalesce(jsonb_agg(
  base.item||jsonb_build_object('passengers',coalesce((
    select jsonb_agg(person.item||jsonb_build_object(
      'outboundTo',coalesce(p.outbound_to,''),
      'returnTo',coalesce(p.return_to,''),
      'extraTransportStops',coalesce((
        select jsonb_agg(jsonb_build_object(
          'date',coalesce(s.travel_date::text,''),
          'from',coalesce(s.from_location,''),
          'to',coalesce(s.to_location,''),
          'method',coalesce(s.transportation_method,''),
          'amount',s.amount,
          'paymentMethod',coalesce(s.payment_method,'')
        ) order by s.stop_no)
        from passenger_transport_stops s where s.passenger_id=p.passenger_id
      ),'[]'::jsonb)
    ) order by person.ordinality)
    from jsonb_array_elements(coalesce(base.item->'passengers','[]'::jsonb))
      with ordinality as person(item,ordinality)
    left join bookings b on b.booking_code=base.item->>'bookingCode'
    left join passengers p on p.booking_id=b.booking_id and p.passenger_no=person.ordinality
  ),'[]'::jsonb)) order by base.booking_no
),'[]'::jsonb)
from base;
$$;

revoke all on function public.upsert_booking_v25(jsonb) from public, anon, authenticated;
revoke all on function public.list_bookings_json_v25() from public, anon, authenticated;
grant execute on function public.upsert_booking_v25(jsonb) to service_role;
grant execute on function public.list_bookings_json_v25() to service_role;
notify pgrst, 'reload schema';
