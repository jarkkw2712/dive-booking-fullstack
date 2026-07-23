# Print Center reports

All reports exclude cancelled bookings. The selected date is interpreted as the operational date.

| Report | Primary user | Operational purpose |
| --- | --- | --- |
| Counter | Counter staff | One row per booking with leader, phone, passenger count, booking status, payment method, expected amount, and sales source |
| Boat | Boat crew | Passenger manifest for both outbound (`ลงเกาะ`) and return (`ขึ้นจากเกาะ`) movements, including health notes |
| Island | Island staff | Passenger-level arrivals and departures by island; return-date passengers are explicitly listed as `ขึ้นจากเกาะ` |
| Insurance | Counter/operations | Outbound passenger identity, age, contact, program, island, allergies, and medical notes |
| Driver | Counter/transport | Group leader, phone, passenger count, program, island, direction, and booking note |
| Management / CEO | Management and CEO | Selected-day KPIs plus a seven-day daily forecast of bookings, passengers, statuses, expected revenue, actual receipts, and outstanding |

## Equipment issue totals

Print Center reports total selected Pre Add-ons by item and quantity for passengers travelling to the island on the selected date. This is the equipment issue list for operations (for example fins, masks, and life jackets). Return passengers are not counted again as newly issued equipment.

## Park accommodation

Accommodation is recorded per passenger as no overnight stay, national-park house, or national-park tent. The record also stores who made the reservation, the park reference, and an operational note.

National-park accommodation is informational only and is never included in Sabina revenue, invoices, expected revenue, or outstanding calculations. Customers normally reserve and pay the park directly.

The live entry workflow is intentionally simple. Staff select an accommodation maintained in Master Data, choose either customer booked or company booked, and enter any tent credit manually (default zero). The credit reduces the booking and invoice; if payment was already received, Financial shows the remaining refund due and creates a normal auditable refund request.

Boat Ticket outbound and approximate return dates can be recorded and edited later if the passenger changes plans on the island.

## Revenue definitions

- `รายได้คาดการณ์` is the booking total for non-cancelled bookings travelling on that date.
- `รับเงินจริง` is net verified cash received from the financial ledger.
- `ค้างรับ` is expected booking revenue less net cash received, never below zero.
- The seven-day forecast starts on the selected date and ends six days later.

Existing booking totals are used as immutable operational snapshots. Changing a Master Data default price does not rewrite prior bookings or reports.
