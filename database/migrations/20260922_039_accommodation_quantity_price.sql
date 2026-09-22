-- Accommodation quantity, price snapshots, and financial integration.
-- Safe to run repeatedly. Existing booking history is never repriced.

alter table if exists master_accommodations
  add column if not exists default_price numeric(14,2) not null default 0;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.master_accommodations'::regclass
      and conname='master_accommodations_default_price_nonnegative'
  ) then
    alter table master_accommodations
      add constraint master_accommodations_default_price_nonnegative check(default_price>=0);
  end if;
end $$;

do $$
declare v_add_qty boolean;
begin
  select not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='passengers' and column_name='accommodation_qty'
  ) into v_add_qty;

  alter table passengers
    add column if not exists accommodation_qty integer not null default 0,
    add column if not exists accommodation_unit_price numeric(14,2) not null default 0,
    add column if not exists accommodation_default_price numeric(14,2) not null default 0;

  -- Existing selections represented one unit. Run this backfill only when the
  -- quantity column is first created, so rerunning the migration changes nothing.
  if v_add_qty then
    update passengers set accommodation_qty=1
    where accommodation_id is not null and accommodation_qty=0;
  end if;
end $$;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.passengers'::regclass
      and conname='passengers_accommodation_values_nonnegative'
  ) then
    alter table passengers
      add constraint passengers_accommodation_values_nonnegative check(
        accommodation_qty>=0
        and accommodation_unit_price>=0
        and accommodation_default_price>=0
      );
  end if;
end $$;

alter table if exists invoice_items
  drop constraint if exists invoice_items_source_type_check;
alter table if exists invoice_items
  add constraint invoice_items_source_type_check
  check(source_type in (
    'program','pre_addon','island_addon','accommodation',
    'transport_outbound','transport_return','manual'
  ));

create or replace function upsert_booking_v21(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_no integer:=0;
  v_accommodation_id text; v_qty integer; v_price numeric(14,2); v_default_price numeric(14,2);
begin
  v_result:=upsert_booking_v20(p_booking);
  v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;

  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    v_accommodation_id:=nullif(trim(coalesce(v_pass->>'accommodationId','')),'');
    if v_accommodation_id is null then
      v_qty:=0; v_price:=0; v_default_price:=0;
    else
      v_qty:=greatest(coalesce(nullif(v_pass->>'accommodationQty','')::integer,1),0);
      v_price:=greatest(coalesce(nullif(v_pass->>'accommodationPrice','')::numeric,0),0);
      v_default_price:=greatest(coalesce(nullif(v_pass->>'accommodationDefaultPrice','')::numeric,v_price),0);
    end if;

    update passengers set
      accommodation_qty=v_qty,
      accommodation_unit_price=v_price,
      accommodation_default_price=v_default_price
    where booking_id=v_booking_id and passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v21() returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_base jsonb; v_result jsonb:='[]'; v_booking jsonb; v_people jsonb; v_pass jsonb;
  v_bid uuid; v_person passengers%rowtype; v_no integer;
begin
  v_base:=list_bookings_json_v20();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_bid from bookings where booking_code=v_booking->>'bookingCode';
    v_people:='[]'; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select * into v_person from passengers where booking_id=v_bid and passenger_no=v_no;
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object(
        'accommodationQty',coalesce(v_person.accommodation_qty,0),
        'accommodationPrice',coalesce(v_person.accommodation_unit_price,0),
        'accommodationDefaultPrice',coalesce(v_person.accommodation_default_price,0)
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;

comment on column master_accommodations.default_price is 'Default unit price copied into new booking accommodation rows';
comment on column passengers.accommodation_unit_price is 'Immutable-by-convention price snapshot for this booking passenger row';
