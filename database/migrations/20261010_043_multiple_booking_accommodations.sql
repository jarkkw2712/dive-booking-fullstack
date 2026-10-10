-- Multiple accommodation rows per Booking.
-- Existing passenger accommodation snapshots remain intact for audit/history.

alter table if exists bookings
  add column if not exists accommodations jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.bookings'::regclass
      and conname='bookings_accommodations_array_check'
  ) then
    alter table bookings add constraint bookings_accommodations_array_check
      check(jsonb_typeof(accommodations)='array');
  end if;
end $$;

-- Backfill only Bookings that do not yet have the new list. Identical historical
-- rows are grouped so no existing amount is lost or counted twice.
update bookings b
set accommodations=legacy.rows
from (
  select p.booking_id,
    jsonb_agg(jsonb_build_object(
      'accommodationId',p.accommodation_id,
      'accommodationName',coalesce(ma.accommodation_name,p.accommodation_id),
      'accommodationBookedBy',coalesce(p.accommodation_booked_by,'customer'),
      'accommodationQty',p.qty,
      'accommodationPrice',p.unit_price,
      'accommodationDefaultPrice',p.default_price
    ) order by coalesce(ma.sort_order,9999),coalesce(ma.accommodation_name,p.accommodation_id)) as rows
  from (
    select booking_id,accommodation_id,accommodation_booked_by,
      sum(greatest(accommodation_qty,0))::integer as qty,
      greatest(accommodation_unit_price,0) as unit_price,
      greatest(accommodation_default_price,0) as default_price
    from passengers
    where accommodation_id is not null and trim(accommodation_id)<>''
    group by booking_id,accommodation_id,accommodation_booked_by,
      accommodation_unit_price,accommodation_default_price
  ) p
  left join master_accommodations ma on ma.accommodation_id=p.accommodation_id
  group by p.booking_id
) legacy
where b.booking_id=legacy.booking_id and b.accommodations='[]'::jsonb;

create or replace function upsert_booking_v23(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb; v_code text; v_accommodations jsonb;
begin
  v_result:=upsert_booking_v21(p_booking);
  v_code:=v_result->>'bookingCode';
  v_accommodations:=coalesce(p_booking->'accommodations','[]'::jsonb);
  if jsonb_typeof(v_accommodations)<>'array' then
    raise exception 'accommodations must be a JSON array';
  end if;

  update bookings set accommodations=v_accommodations where booking_code=v_code;
  return v_result||jsonb_build_object('accommodations',v_accommodations);
end $$;

create or replace function list_bookings_json_v23() returns jsonb
language sql stable security definer set search_path=public as $$
with base as (
  select item,ordinality
  from jsonb_array_elements(list_bookings_json_v22()) with ordinality as x(item,ordinality)
)
select coalesce(jsonb_agg(
  base.item||jsonb_build_object('accommodations',coalesce(b.accommodations,'[]'::jsonb))
  order by base.ordinality
),'[]'::jsonb)
from base
left join bookings b on b.booking_code=base.item->>'bookingCode';
$$;

grant execute on function upsert_booking_v23(jsonb) to service_role;
grant execute on function list_bookings_json_v23() to service_role;

comment on column bookings.accommodations is
  'Booking-level accommodation rows. Customer-booked rows are operational only; company-booked rows contribute qty x price.';
comment on function upsert_booking_v23(jsonb) is
  'Persists multiple booking-level accommodation rows while preserving the v21 passenger write contract.';
comment on function list_bookings_json_v23() is
  'Adds booking-level accommodation rows to the fast v22 Booking read model.';
