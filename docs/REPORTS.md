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
| รายงานทัวร์และค่าใช้จ่าย | Counter / accounting | Daily boat-ticket, package and tent income split by cash/transfer, with deposits, credit and named-account references |
| รายงานค่าธรรมเนียมเต็นท์ | Operations / accounting | Tent equipment quantity multiplied by trip nights and the fixed 80-baht person-night fee |
| รายงานรถตู้ (เฉพาะรถตู้) | Transport / accounting | Daily van income split by cash and transfer |
| ใบงานรับ-ส่งรถตู้ | Driver / operations | Outbound and return van jobs using each passenger leg date, destination, leader and phone |

The four reports above are in the Print/PDF section and are formatted for A4. `รายงานสรุปรายการทัวร์` is appended to the tour/expense PDF and `รายงานสรุปรายการรถตู้` is appended to the van PDF; both group the same selected range by month and include a final total row. The Excel section contains only the detailed Booking export.

## Reference report data sources

- The report date is the Booking outbound travel date, except van work orders, which use the individual outbound or return leg date.
- Boat tickets are Program code `boat_ticket`; all other Programs are packages.
- Tent rows are selected equipment whose code is exactly `tent` after lowercasing.
- Payment type comes from Payment Method code: exact `cash` is cash; a code containing `bank_transfer` is transfer. The saved type remains a compatibility fallback for older/custom methods.
- Program/boat uses the main Booking payment method. Equipment, Island Add-on, outbound transport and return transport use their own saved payment methods.
- Default receiving accounts are general=`นฤมล`, Island/dive=`เรืองโรจน์`, equipment and van=`ลัดดาวรรณ์`. Administrators can change one default per category in Payment Method Master Data.
- Named-account summaries recognize `นฤมล`, `เรืองโรจน์`, `รุ่งฤดี`, `ลัดดาวรรณ์`, and `รุจิโรจน์` from the Payment Method display name. They include both matching service lines and deposits using `depositPaymentMethod`.
- Deposits and credit are reference columns and are not added again to revenue, preventing double counting.
- The monthly tour Excel columns are Month, Cash, Transfer, Deposit, Credit and Transfer-Rung Ruedee. `เบิกทัวร์` and `คงเหลือ` are intentionally excluded.

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
