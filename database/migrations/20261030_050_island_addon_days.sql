-- Island Add-on duration uses the existing booking_addons.nights column as
-- service days. Historical island rows already have the default value 1.
create or replace function public.upsert_booking_v30(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb; v_booking_id uuid; v_pass jsonb; v_add jsonb;
  v_passenger_id uuid; v_addon_row_id uuid; v_used uuid[];
  v_no integer:=0; v_days integer;
begin
  if jsonb_typeof(coalesce(p_booking->'passengers','[]'::jsonb)) <> 'array' then
    raise exception 'passengers must be an array';
  end if;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      v_days:=coalesce(nullif(v_add->>'days','')::integer,1);
      if v_days not between 1 and 365 then raise exception 'Island Add-on days must be between 1 and 365'; end if;
      if coalesce(nullif(v_add->>'qty','')::integer,1)<1 then raise exception 'Island Add-on quantity must be positive'; end if;
    end loop;
  end loop;

  v_result:=public.upsert_booking_v29(p_booking);
  select booking_id into strict v_booking_id from public.bookings
    where booking_code=v_result->>'bookingCode';
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1; v_used:='{}'::uuid[];
    select passenger_id into strict v_passenger_id from public.passengers
      where booking_id=v_booking_id and passenger_no=v_no;
    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'islandAddOns','[]'::jsonb)) loop
      v_days:=coalesce(nullif(v_add->>'days','')::integer,1);
      select addon_row_id into v_addon_row_id from public.booking_addons
        where passenger_id=v_passenger_id and addon_source='island'
          and addon_id=coalesce(v_add->>'id','other')
          and qty=coalesce(nullif(v_add->>'qty','')::integer,1)
          and unit_price=coalesce(nullif(v_add->>'price','')::numeric,0)
          and addon_row_id<>all(v_used)
        order by created_at,addon_row_id limit 1;
      if v_addon_row_id is null then
        raise exception 'Saved Island Add-on row not found for %',coalesce(v_add->>'id','other');
      end if;
      update public.booking_addons set nights=v_days where addon_row_id=v_addon_row_id;
      v_used:=array_append(v_used,v_addon_row_id);
      v_addon_row_id:=null;
    end loop;
  end loop;
  return v_result;
end $$;

create or replace function public.list_bookings_json_v27() returns jsonb
language sql stable security definer set search_path=public as $$
with base as (
  select item,ordinality as booking_no
  from jsonb_array_elements(public.list_bookings_json_v26()) with ordinality as x(item,ordinality)
), island_days as (
  select p.booking_id,p.passenger_no,ba.nights,
    row_number() over(partition by ba.passenger_id order by ba.created_at,ba.addon_row_id) as addon_no
  from public.booking_addons ba
  join public.passengers p on p.passenger_id=ba.passenger_id
  where ba.addon_source='island'
), decorated_people as (
  select base.booking_no,person.ordinality as passenger_no,
    person.item||jsonb_build_object('islandAddOns',coalesce((
      select jsonb_agg(addon.item||jsonb_build_object('days',coalesce(d.nights,1)) order by addon.ordinality)
      from jsonb_array_elements(coalesce(person.item->'islandAddOns','[]'::jsonb))
        with ordinality as addon(item,ordinality)
      left join island_days d on d.booking_id=b.booking_id
        and d.passenger_no=person.ordinality and d.addon_no=addon.ordinality
    ),'[]'::jsonb)) as item
  from base
  left join public.bookings b on b.booking_code=base.item->>'bookingCode'
  cross join lateral jsonb_array_elements(coalesce(base.item->'passengers','[]'::jsonb))
    with ordinality as person(item,ordinality)
)
select coalesce(jsonb_agg(
  base.item||jsonb_build_object('passengers',coalesce((
    select jsonb_agg(person.item order by person.passenger_no)
    from decorated_people person where person.booking_no=base.booking_no
  ),'[]'::jsonb)) order by base.booking_no
),'[]'::jsonb)
from base;
$$;

revoke all on function public.upsert_booking_v30(jsonb) from public, anon, authenticated;
revoke all on function public.list_bookings_json_v27() from public, anon, authenticated;
grant execute on function public.upsert_booking_v30(jsonb) to service_role;
grant execute on function public.list_bookings_json_v27() to service_role;

comment on column public.booking_addons.nights is
  'Service duration: equipment rental nights or Island Add-on days; historical rows default to one.';
