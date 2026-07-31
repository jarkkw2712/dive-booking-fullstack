-- Preserve flexible customer contact text exactly as entered (LINE, Facebook, email, etc.).
create or replace function upsert_booking_v6(p_booking jsonb)
returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text;
begin
  v_result:=upsert_booking_v5(p_booking);
  v_code:=v_result->>'bookingCode';
  update bookings set
    contact_email=nullif(trim(p_booking->>'contactEmail'),''),
    updated_at=now()
  where booking_code=v_code;
  return v_result;
end $$;
