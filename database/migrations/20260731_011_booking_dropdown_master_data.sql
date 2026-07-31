-- Master-driven booking dropdowns and transportation method snapshot.
create table if not exists master_customer_sources(
  source_id text primary key,
  source_name text not null,
  description text,
  active_flag boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists master_transportation_methods(
  method_id text primary key,
  method_name text not null,
  description text,
  active_flag boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists master_payment_methods(
  method_id text primary key,
  method_name text not null,
  description text,
  active_flag boolean not null default true,
  sort_order integer not null default 0
);

insert into master_customer_sources(source_id,source_name,sort_order) values
  ('existing_customer','ลูกค้าเก่า',10),
  ('facebook','Facebook',20),
  ('thai_travel_fair','ไทยเที่ยวไทย',30),
  ('agent','Agent',40),
  ('management','ผู้บริหาร',50),
  ('walk_in','Walk-in',60)
on conflict(source_id) do nothing;

insert into master_transportation_methods(method_id,method_name,sort_order) values
  ('private_car','รถยนต์ส่วนตัว',10),
  ('van','รถตู้',20),
  ('coach','รถทัวร์',30)
on conflict(method_id) do nothing;

insert into master_payment_methods(method_id,method_name,sort_order) values
  ('cash','เงินสด',10),
  ('bank_transfer','โอนผ่านธนาคาร',20)
on conflict(method_id) do nothing;

alter table if exists bookings
  add column if not exists transportation_method text;

create or replace function upsert_booking_v5(p_booking jsonb)
returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text;
begin
  v_result:=upsert_booking_v4(p_booking);
  v_code:=v_result->>'bookingCode';
  update bookings set
    transportation_method=nullif(trim(p_booking->>'transportationMethod'),''),
    updated_at=now()
  where booking_code=v_code;
  return v_result;
end $$;

create or replace function list_bookings_json_v5()
returns jsonb language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_method text;
begin
  v_base:=list_bookings_json_v4();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select transportation_method into v_method
    from bookings where booking_code=v_booking->>'bookingCode';
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object(
      'transportationMethod',coalesce(v_method,'')
    ));
  end loop;
  return v_result;
end $$;
