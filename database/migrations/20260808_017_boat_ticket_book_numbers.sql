-- Separate boat-ticket book/serial references while preserving receipt references.
alter table if exists bookings add column if not exists boat_ticket_book_no text, add column if not exists boat_ticket_no text;
create index if not exists bookings_boat_ticket_reference_idx on bookings(boat_ticket_book_no,boat_ticket_no);

create or replace function upsert_booking_v9(p_booking jsonb) returns jsonb language plpgsql security definer as $$
declare v_result jsonb; v_code text;
begin
  v_result:=upsert_booking_v8(p_booking); v_code:=v_result->>'bookingCode';
  update bookings set boat_ticket_book_no=nullif(trim(p_booking->>'boatTicketBookNo'),''),boat_ticket_no=nullif(trim(p_booking->>'boatTicketNo'),''),updated_at=now() where booking_code=v_code;
  return v_result;
end $$;

create or replace function list_bookings_json_v8() returns jsonb language plpgsql security definer as $$
declare v_base jsonb; v_result jsonb:='[]'::jsonb; v_booking jsonb; v_book text; v_no text;
begin
  v_base:=list_bookings_json_v7();
  for v_booking in select value from jsonb_array_elements(coalesce(v_base,'[]'::jsonb)) loop
    select boat_ticket_book_no,boat_ticket_no into v_book,v_no from bookings where booking_code=v_booking->>'bookingCode';
    v_result:=v_result||jsonb_build_array(v_booking||jsonb_build_object('boatTicketBookNo',coalesce(v_book,''),'boatTicketNo',coalesce(v_no,'')));
  end loop;
  return v_result;
end $$;
