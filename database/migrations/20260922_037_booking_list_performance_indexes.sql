-- Booking list/read-path indexes. Safe to run repeatedly and does not change business data.
create index if not exists passengers_booking_passenger_no_idx
  on passengers(booking_id,passenger_no);
create index if not exists booking_programs_passenger_idx
  on booking_programs(passenger_id);
create index if not exists booking_addons_passenger_source_idx
  on booking_addons(passenger_id,addon_source);
create index if not exists bookings_travel_status_idx
  on bookings(travel_date,status);
create index if not exists bookings_return_status_idx
  on bookings(return_date,status);
