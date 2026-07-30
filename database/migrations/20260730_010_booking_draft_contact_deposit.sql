-- Allow incomplete draft bookings and capture counter contact/deposit references.
alter table if exists bookings alter column travel_date drop not null;

alter table if exists bookings
  add column if not exists contact_email text,
  add column if not exists deposit_amount numeric(14,2) not null default 0,
  add column if not exists receipt_book_no text,
  add column if not exists manual_receipt_no text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='bookings_deposit_amount_check') then
    alter table bookings add constraint bookings_deposit_amount_check check(deposit_amount>=0);
  end if;
end $$;

create or replace function upsert_booking_v4(p_booking jsonb)
returns jsonb language plpgsql security definer as $$
declare v_payload jsonb:=p_booking; v_result jsonb; v_code text; v_deposit numeric(14,2);
begin
  if coalesce(p_booking->>'travelDate','')='' then
    v_payload:=jsonb_set(v_payload,'{travelDate}','null'::jsonb,true);
  end if;
  if coalesce(p_booking->>'returnDate','')='' then
    v_payload:=jsonb_set(v_payload,'{returnDate}','null'::jsonb,true);
  end if;
  v_deposit:=greatest(coalesce((p_booking->>'depositAmount')::numeric,0),0);
  v_result:=upsert_booking_with_accommodation(v_payload);
  v_code:=v_result->>'bookingCode';
  update bookings set
    contact_email=nullif(lower(trim(p_booking->>'contactEmail')),''),
    deposit_amount=v_deposit,
    receipt_book_no=nullif(trim(p_booking->>'receiptBookNo'),''),
    manual_receipt_no=nullif(trim(p_booking->>'manualReceiptNo'),''),
    updated_at=now()
  where booking_code=v_code;
  return v_result;
end $$;

create or replace function list_bookings_json_v4()
returns jsonb language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_row record;
begin
  v_base:=list_bookings_json_v3();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select contact_email,deposit_amount,receipt_book_no,manual_receipt_no
    into v_row from bookings where booking_code=v_booking->>'bookingCode';
    v_booking:=v_booking||jsonb_build_object(
      'contactEmail',coalesce(v_row.contact_email,''),
      'depositAmount',coalesce(v_row.deposit_amount,0),
      'receiptBookNo',coalesce(v_row.receipt_book_no,''),
      'manualReceiptNo',coalesce(v_row.manual_receipt_no,'')
    );
    v_result:=v_result||jsonb_build_array(v_booking);
  end loop;
  return v_result;
end $$;
