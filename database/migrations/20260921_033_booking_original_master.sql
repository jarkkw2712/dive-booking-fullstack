-- Booking original/source master and immutable booking snapshot.
create table if not exists master_booking_originals(
  original_id text primary key,
  original_name text not null,
  active_flag boolean not null default true,
  sort_order integer not null default 0,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into master_booking_originals(original_id,original_name,sort_order) values
  ('sabina','ซาบีน่า',10),('nui','หนุ่ย',20)
on conflict (original_id) do nothing;

alter table if exists bookings add column if not exists booking_original text;

create or replace function upsert_booking_v18(p_booking jsonb) returns jsonb
language plpgsql security definer as $$
declare v_result jsonb; v_code text;
begin
  v_result:=upsert_booking_v17(p_booking); v_code:=v_result->>'bookingCode';
  update bookings set booking_original=nullif(trim(coalesce(p_booking->>'bookingOriginal','')),''),updated_at=now() where booking_code=v_code;
  return v_result||jsonb_build_object('bookingOriginal',coalesce(p_booking->>'bookingOriginal',''));
end $$;

create or replace function list_bookings_json_v18() returns jsonb
language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_original text;
begin
  v_base:=list_bookings_json_v17();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_original into v_original from bookings where booking_code=v_booking->>'bookingCode';
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('bookingOriginal',coalesce(v_original,'')));
  end loop;
  return v_result;
end $$;
