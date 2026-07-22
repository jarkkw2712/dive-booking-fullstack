create or replace view v_financial_booking_summary as
select b.booking_id,b.booking_code,
 coalesce((select sum(case when i.invoice_type='credit_note' then -i.grand_total else i.grand_total end) from invoices i where i.booking_id=b.booking_id and i.status in ('issued','partially_paid','paid')),0)::numeric(14,2) invoiced_amount,
 coalesce((select sum(p.amount) from payments p where p.booking_id=b.booking_id and p.status='verified'),0)::numeric(14,2) verified_paid_amount,
 coalesce((select sum(r.amount) from refunds r where r.booking_id=b.booking_id and r.status='paid'),0)::numeric(14,2) refunded_amount
from bookings b;

create or replace view v_financial_outstanding as
select s.*,greatest(s.invoiced_amount-s.verified_paid_amount,0)::numeric(14,2) outstanding_amount,
 (s.verified_paid_amount-s.refunded_amount)::numeric(14,2) net_cash_received
from v_financial_booking_summary s;

