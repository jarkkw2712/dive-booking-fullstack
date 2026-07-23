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

## Revenue definitions

- `รายได้คาดการณ์` is the booking total for non-cancelled bookings travelling on that date.
- `รับเงินจริง` is net verified cash received from the financial ledger.
- `ค้างรับ` is expected booking revenue less net cash received, never below zero.
- The seven-day forecast starts on the selected date and ends six days later.

Existing booking totals are used as immutable operational snapshots. Changing a Master Data default price does not rewrite prior bookings or reports.
