-- Category-specific payment defaults and per-leg transportation payment snapshots.
-- Safe to run repeatedly. Existing bookings and financial history are preserved.

alter table if exists master_payment_methods
  add column if not exists default_general boolean not null default false,
  add column if not exists default_equipment boolean not null default false,
  add column if not exists default_island boolean not null default false,
  add column if not exists default_transport boolean not null default false;

-- Create the named transfer accounts only when an account with the same display
-- name does not already exist. Existing customer-defined codes always win.
insert into master_payment_methods(method_id,method_name,payment_type,show_on_money_receipt,active_flag,sort_order)
select v.method_id,v.method_name,'transfer',true,true,v.sort_order
from (values
  ('bank_transfer_naruemon','นฤมล',30),
  ('bank_transfer_rueangroj','เรืองโรจน์',40),
  ('bank_transfer_rungruedee','รุ่งฤดี',50),
  ('bank_transfer_laddawan','ลัดดาวรรณ์',60),
  ('bank_transfer_rujiroj','รุจิโรจน์',70)
) as v(method_id,method_name,sort_order)
where not exists(
  select 1 from master_payment_methods current
  where lower(trim(current.method_name))=lower(trim(v.method_name))
)
on conflict(method_id) do nothing;

-- The stable code determines cash/transfer for reports. Retain payment_type as a
-- compatibility snapshot for historical/custom methods.
update master_payment_methods set payment_type='cash'
where lower(trim(method_id))='cash' and payment_type<>'cash';
update master_payment_methods set payment_type='transfer'
where position('bank_transfer' in lower(trim(method_id)))>0 and payment_type<>'transfer';

-- Seed the requested defaults without overwriting later administrator choices.
update master_payment_methods set default_general=true
where method_id=(select method_id from master_payment_methods where trim(method_name)='นฤมล' order by sort_order,method_id limit 1)
  and not exists(select 1 from master_payment_methods where default_general);
update master_payment_methods set default_equipment=true
where method_id=(select method_id from master_payment_methods where trim(method_name)='ลัดดาวรรณ์' order by sort_order,method_id limit 1)
  and not exists(select 1 from master_payment_methods where default_equipment);
update master_payment_methods set default_island=true
where method_id=(select method_id from master_payment_methods where trim(method_name)='เรืองโรจน์' order by sort_order,method_id limit 1)
  and not exists(select 1 from master_payment_methods where default_island);
update master_payment_methods set default_transport=true
where method_id=(select method_id from master_payment_methods where trim(method_name)='ลัดดาวรรณ์' order by sort_order,method_id limit 1)
  and not exists(select 1 from master_payment_methods where default_transport);

alter table if exists passengers
  add column if not exists transportation_payment_method text,
  add column if not exists return_transportation_payment_method text;

create or replace function upsert_booking_v20(p_booking jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_code text; v_booking_id uuid; v_pass jsonb; v_no integer:=0;
begin
  v_result:=upsert_booking_v19(p_booking); v_code:=v_result->>'bookingCode';
  select booking_id into v_booking_id from bookings where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    update passengers set
      transportation_payment_method=nullif(trim(coalesce(v_pass->>'transportationPaymentMethod','')),''),
      return_transportation_payment_method=nullif(trim(coalesce(v_pass->>'returnTransportationPaymentMethod','')),'')
    where booking_id=v_booking_id and passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v20() returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_base jsonb; v_result jsonb:='[]'; v_booking jsonb; v_people jsonb; v_pass jsonb; v_bid uuid; v_person passengers%rowtype; v_no integer;
begin
  v_base:=list_bookings_json_v19();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select booking_id into v_bid from bookings where booking_code=v_booking->>'bookingCode';
    v_people:='[]'; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1;
      select * into v_person from passengers where booking_id=v_bid and passenger_no=v_no;
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object(
        'transportationPaymentMethod',coalesce(v_person.transportation_payment_method,''),
        'returnTransportationPaymentMethod',coalesce(v_person.return_transportation_payment_method,'')
      ));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('passengers',v_people));
  end loop;
  return v_result;
end $$;
