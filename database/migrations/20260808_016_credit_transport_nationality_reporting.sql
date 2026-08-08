-- Credit sales, payment-method snapshots, per-passenger pickup/transport and nationality.
alter table if exists bookings add column if not exists deposit_payment_method text, add column if not exists credit_amount numeric(14,2) not null default 0, add column if not exists credit_payment_method text;
alter table if exists master_transportation_methods add column if not exists default_price numeric(14,2) not null default 0;
alter table if exists passengers add column if not exists nationality_type text not null default 'thai', add column if not exists pickup_location text, add column if not exists transportation_method text, add column if not exists transportation_amount numeric(14,2) not null default 0;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='bookings_credit_amount_check') then alter table bookings add constraint bookings_credit_amount_check check(credit_amount>=0); end if;
  if not exists(select 1 from pg_constraint where conname='passengers_transportation_amount_check') then alter table passengers add constraint passengers_transportation_amount_check check(transportation_amount>=0); end if;
  if not exists(select 1 from pg_constraint where conname='passengers_nationality_type_check') then alter table passengers add constraint passengers_nationality_type_check check(nationality_type in('thai','foreign')); end if;
end $$;

create or replace function upsert_booking_v8(p_booking jsonb) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text; v_pass jsonb; v_no integer:=0;
begin
  v_result:=upsert_booking_v7(p_booking); v_code:=v_result->>'bookingCode';
  update bookings set deposit_payment_method=nullif(trim(p_booking->>'depositPaymentMethod'),''), credit_amount=greatest(coalesce((p_booking->>'creditAmount')::numeric,0),0), credit_payment_method=nullif(trim(p_booking->>'creditPaymentMethod'),''), updated_at=now() where booking_code=v_code;
  for v_pass in select value from jsonb_array_elements(coalesce(p_booking->'passengers','[]'::jsonb)) loop
    v_no:=v_no+1;
    update passengers p set nationality_type=case when v_pass->>'nationalityType'='foreign' then 'foreign' else 'thai' end, pickup_location=nullif(trim(v_pass->>'pickupLocation'),''), transportation_method=nullif(trim(v_pass->>'transportationMethod'),''), transportation_amount=greatest(coalesce((v_pass->>'transportationAmount')::numeric,0),0)
    from bookings b where p.booking_id=b.booking_id and b.booking_code=v_code and p.passenger_no=v_no;
  end loop;
  return v_result;
end $$;

create or replace function list_bookings_json_v7() returns jsonb language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_people jsonb; v_pass jsonb; v_code text; v_no integer; v_booking_row bookings%rowtype; v_person passengers%rowtype;
begin
  v_base:=list_bookings_json_v6();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    v_code:=v_booking->>'bookingCode'; select * into v_booking_row from bookings where booking_code=v_code; v_people:='[]'::jsonb; v_no:=0;
    for v_pass in select value from jsonb_array_elements(coalesce(v_booking->'passengers','[]'::jsonb)) loop
      v_no:=v_no+1; select p.* into v_person from passengers p where p.booking_id=v_booking_row.booking_id and p.passenger_no=v_no;
      v_people:=v_people||jsonb_build_array(v_pass||jsonb_build_object('nationalityType',coalesce(v_person.nationality_type,'thai'),'pickupLocation',coalesce(v_person.pickup_location,''),'transportationMethod',coalesce(v_person.transportation_method,''),'transportationAmount',coalesce(v_person.transportation_amount,0)));
    end loop;
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('depositPaymentMethod',coalesce(v_booking_row.deposit_payment_method,''),'creditAmount',coalesce(v_booking_row.credit_amount,0),'creditPaymentMethod',coalesce(v_booking_row.credit_payment_method,''),'passengers',v_people));
  end loop;
  return v_result;
end $$;
