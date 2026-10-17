-- Equipment rental duration. Existing booking_addons.qty remains the physical
-- equipment count; all historical rows are one night by default.
alter table if exists public.booking_addons
  add column if not exists nights integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.booking_addons'::regclass
      and conname='booking_addons_nights_check'
  ) then
    alter table public.booking_addons add constraint booking_addons_nights_check
      check (nights between 1 and 365);
  end if;
end $$;

create or replace function public.upsert_booking_v24(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb; v_booking_id uuid; v_pass jsonb; v_add jsonb;
  v_passenger_id uuid; v_addon_row_id uuid; v_no integer:=0;
  v_used uuid[]:='{}'::uuid[]; v_nights integer;
begin
  -- v23 keeps all existing Booking, payment, passenger and accommodation rules.
  v_result:=upsert_booking_v23(p_booking);
  select booking_id into v_booking_id from bookings
  where booking_code=v_result->>'bookingCode';

  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    v_used:='{}'::uuid[];
    select passenger_id into v_passenger_id from passengers
    where booking_id=v_booking_id and passenger_no=v_no;

    -- v23 does not store an input-row ordinal. Refuse indistinguishable rows
    -- with different durations rather than attaching nights to the wrong row.
    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_pass->'preAddOns','[]'::jsonb)) as row(item)
      where coalesce((row.item->>'selected')::boolean,false)
      group by row.item->>'id',row.item->>'qty',row.item->>'price'
      having count(distinct coalesce(nullif(row.item->>'nights','')::integer,1))>1
    ) then
      raise exception 'Duplicate equipment rows with different nights must use distinct quantities or prices';
    end if;

    for v_add in select value from jsonb_array_elements(coalesce(v_pass->'preAddOns','[]'::jsonb)) loop
      if not coalesce((v_add->>'selected')::boolean,false) then continue; end if;
      v_nights:=coalesce(nullif(v_add->>'nights','')::integer,1);
      if v_nights not between 1 and 365 then
        raise exception 'Equipment nights must be between 1 and 365';
      end if;

      select addon_row_id into v_addon_row_id from booking_addons
      where passenger_id=v_passenger_id and addon_source='pre'
        and addon_id=coalesce(v_add->>'id','other')
        and qty=coalesce((v_add->>'qty')::integer,1)
        and unit_price=coalesce((v_add->>'price')::numeric,0)
        and addon_row_id<>all(v_used)
      order by created_at,addon_row_id limit 1;
      if v_addon_row_id is null then
        raise exception 'Saved equipment row not found for %',coalesce(v_add->>'id','other');
      end if;
      update booking_addons set nights=v_nights where addon_row_id=v_addon_row_id;
      v_used:=array_append(v_used,v_addon_row_id);
    end loop;
  end loop;
  return v_result;
end $$;

-- Decorate the existing fast, set-based v23 read model. Match add-on rows in
-- exactly the same order used by list_bookings_json_v22 (created_at, row id).
create or replace function public.list_bookings_json_v24() returns jsonb
language sql stable security definer set search_path=public as $$
with base as (
  select item,ordinality as booking_no
  from jsonb_array_elements(list_bookings_json_v23()) with ordinality as x(item,ordinality)
), addon_nights as (
  select p.booking_id,p.passenger_no,ba.nights,
    row_number() over(partition by ba.passenger_id order by ba.created_at,ba.addon_row_id) as addon_no
  from booking_addons ba
  join passengers p on p.passenger_id=ba.passenger_id
  where ba.addon_source='pre'
), decorated_people as (
  select base.booking_no,person.ordinality as passenger_no,
    person.item||jsonb_build_object('preAddOns',coalesce((
      select jsonb_agg(addon.item||jsonb_build_object('nights',coalesce(an.nights,1)) order by addon.ordinality)
      from jsonb_array_elements(coalesce(person.item->'preAddOns','[]'::jsonb))
        with ordinality as addon(item,ordinality)
      left join addon_nights an on an.booking_id=b.booking_id
        and an.passenger_no=person.ordinality and an.addon_no=addon.ordinality
    ),'[]'::jsonb)) as item
  from base
  left join bookings b on b.booking_code=base.item->>'bookingCode'
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

grant execute on function public.upsert_booking_v24(jsonb) to service_role;
grant execute on function public.list_bookings_json_v24() to service_role;

comment on column public.booking_addons.nights is
  'Equipment rental nights; qty remains physical item count, billable qty is qty x nights. Historical rows default to one night.';
