create or replace function next_financial_document_no(p_type text, p_prefix text)
returns text language plpgsql as $$
declare v_year integer := extract(year from current_date); v_number bigint;
begin
  insert into financial_document_counters(document_type, document_year, last_number)
  values(upper(p_type), v_year, 1)
  on conflict(document_type, document_year)
  do update set last_number=financial_document_counters.last_number+1
  returning last_number into v_number;
  return upper(p_prefix)||'-'||v_year::text||'-'||lpad(v_number::text, 6, '0');
end $$;

create or replace function financial_booking_summary(p_booking_code text)
returns jsonb language sql stable as $$
with b as (
  select booking_id, booking_code from bookings where booking_code=p_booking_code
), totals as (
  select b.booking_id,
    coalesce((select sum(case when invoice_type='credit_note' then -grand_total else grand_total end)
      from invoices where booking_id=b.booking_id and status in ('issued','partially_paid','paid')),0)::numeric(14,2) invoiced,
    coalesce((select sum(amount) from payments where booking_id=b.booking_id and status='verified'),0)::numeric(14,2) paid,
    coalesce((select sum(amount) from refunds where booking_id=b.booking_id and status='paid'),0)::numeric(14,2) refunded
  from b
)
select coalesce(jsonb_build_object(
  'bookingCode',b.booking_code,'invoicedAmount',t.invoiced,'verifiedPaidAmount',t.paid,
  'refundedAmount',t.refunded,'outstandingAmount',greatest(t.invoiced-t.paid,0),
  'netCashReceived',t.paid-t.refunded
),'{}'::jsonb)
from b join totals t using(booking_id) $$;

create or replace function create_financial_invoice(
  p_booking_code text, p_invoice jsonb, p_actor text, p_role text
) returns jsonb language plpgsql as $$
declare v_booking_id uuid; v_invoice_id uuid; v_no text; v_item jsonb;
  v_subtotal numeric(14,2):=0; v_discount numeric(14,2):=0; v_vat_rate numeric(7,4):=0;
  v_vat numeric(14,2):=0; v_total numeric(14,2):=0; v_existing invoices%rowtype;
begin
  if nullif(p_invoice->>'idempotencyKey','') is not null then
    select * into v_existing from invoices where idempotency_key=p_invoice->>'idempotencyKey';
    if found then return to_jsonb(v_existing); end if;
  end if;
  select booking_id into v_booking_id from bookings where booking_code=p_booking_code and status<>'cancelled' for update;
  if v_booking_id is null then raise exception 'Active booking not found'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_invoice->'items','[]'::jsonb)) loop
    if coalesce((v_item->>'qty')::numeric,0)<=0 or coalesce((v_item->>'unitPrice')::numeric,-1)<0 then raise exception 'Invalid invoice item amount'; end if;
    v_subtotal:=v_subtotal+round((v_item->>'qty')::numeric*(v_item->>'unitPrice')::numeric,2);
    v_discount:=v_discount+coalesce((v_item->>'discountAmount')::numeric,0);
  end loop;
  if v_subtotal<=0 then raise exception 'Invoice requires at least one positive item'; end if;
  v_vat_rate:=coalesce((p_invoice->>'vatRate')::numeric,0);
  v_vat:=round(greatest(v_subtotal-v_discount,0)*v_vat_rate/100,2);
  v_total:=greatest(v_subtotal-v_discount,0)+v_vat;
  v_no:=next_financial_document_no('invoice','INV');
  insert into invoices(invoice_no,booking_id,booking_code,invoice_type,issue_date,due_date,currency,subtotal,discount_amount,vat_rate,vat_amount,grand_total,status,notes,idempotency_key,created_by,created_role)
  values(v_no,v_booking_id,p_booking_code,coalesce(p_invoice->>'invoiceType','initial'),coalesce((p_invoice->>'issueDate')::date,current_date),nullif(p_invoice->>'dueDate','')::date,'THB',v_subtotal,v_discount,v_vat_rate,v_vat,v_total,'issued',p_invoice->>'notes',nullif(p_invoice->>'idempotencyKey',''),p_actor,p_role)
  returning invoice_id into v_invoice_id;
  for v_item in select * from jsonb_array_elements(p_invoice->'items') loop
    insert into invoice_items(invoice_id,source_type,source_id,passenger_name_snapshot,item_code_snapshot,item_name_snapshot,description,qty,unit_price,discount_amount,line_total)
    values(v_invoice_id,coalesce(v_item->>'sourceType','manual'),nullif(v_item->>'sourceId',''),nullif(v_item->>'passengerName',''),nullif(v_item->>'itemCode',''),v_item->>'itemName',nullif(v_item->>'description',''),(v_item->>'qty')::numeric,(v_item->>'unitPrice')::numeric,coalesce((v_item->>'discountAmount')::numeric,0),greatest(round((v_item->>'qty')::numeric*(v_item->>'unitPrice')::numeric,2)-coalesce((v_item->>'discountAmount')::numeric,0),0));
  end loop;
  insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,detail,after_json,created_by,created_role)
  values(v_booking_id,p_booking_code,'INVOICE_ISSUED','invoice',v_invoice_id,v_total,jsonb_build_object('invoiceNo',v_no),p_invoice,p_actor,p_role);
  return (select to_jsonb(i) from invoices i where invoice_id=v_invoice_id);
end $$;

create or replace function create_financial_payment(
  p_booking_code text, p_payment jsonb, p_actor text, p_role text
) returns jsonb language plpgsql as $$
declare v_booking_id uuid; v_payment_id uuid; v_no text; v_amount numeric(14,2); v_alloc jsonb;
  v_alloc_total numeric(14,2):=0; v_invoice invoices%rowtype; v_existing payments%rowtype;
begin
  if nullif(p_payment->>'idempotencyKey','') is not null then
    select * into v_existing from payments where idempotency_key=p_payment->>'idempotencyKey';
    if found then return to_jsonb(v_existing); end if;
  end if;
  select booking_id into v_booking_id from bookings where booking_code=p_booking_code and status<>'cancelled' for update;
  if v_booking_id is null then raise exception 'Active booking not found'; end if;
  v_amount:=coalesce((p_payment->>'amount')::numeric,0);
  if v_amount<=0 then raise exception 'Payment amount must be positive'; end if;
  v_no:=next_financial_document_no('payment','PAY');
  insert into payments(payment_no,booking_id,booking_code,payment_date,amount,method_id,method_snapshot,bank_name,reference_no,slip_url,status,remark,received_by,received_role,idempotency_key)
  values(v_no,v_booking_id,p_booking_code,coalesce((p_payment->>'paymentDate')::date,current_date),v_amount,nullif(p_payment->>'methodId',''),coalesce(nullif(p_payment->>'methodSnapshot',''),'cash'),nullif(p_payment->>'bankName',''),nullif(p_payment->>'referenceNo',''),nullif(p_payment->>'slipUrl',''),'pending',nullif(p_payment->>'remark',''),p_actor,p_role,nullif(p_payment->>'idempotencyKey','')) returning payment_id into v_payment_id;
  for v_alloc in select * from jsonb_array_elements(coalesce(p_payment->'allocations','[]'::jsonb)) loop
    select * into v_invoice from invoices where invoice_id=(v_alloc->>'invoiceId')::uuid and booking_id=v_booking_id and status in ('issued','partially_paid') for update;
    if not found then raise exception 'Allocatable invoice not found'; end if;
    if coalesce((v_alloc->>'amount')::numeric,0)<=0 then raise exception 'Allocation amount must be positive'; end if;
    if (v_alloc->>'amount')::numeric > v_invoice.grand_total-coalesce((select sum(pa.amount) from payment_allocations pa join payments px on px.payment_id=pa.payment_id where pa.invoice_id=v_invoice.invoice_id and px.status in ('pending','verified')),0) then raise exception 'Allocation exceeds invoice outstanding amount'; end if;
    v_alloc_total:=v_alloc_total+(v_alloc->>'amount')::numeric;
    insert into payment_allocations(payment_id,invoice_id,amount) values(v_payment_id,v_invoice.invoice_id,(v_alloc->>'amount')::numeric);
  end loop;
  if v_alloc_total>v_amount then raise exception 'Allocations exceed payment amount'; end if;
  insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,method,reference_no,detail,after_json,created_by,created_role)
  values(v_booking_id,p_booking_code,'PAYMENT_RECEIVED','payment',v_payment_id,v_amount,p_payment->>'methodSnapshot',p_payment->>'referenceNo',jsonb_build_object('paymentNo',v_no),p_payment,p_actor,p_role);
  return (select to_jsonb(p) from payments p where payment_id=v_payment_id);
end $$;

create or replace function void_financial_document(p_entity text,p_id uuid,p_reason text,p_actor text,p_role text)
returns jsonb language plpgsql as $$
declare v_invoice invoices%rowtype; v_receipt receipts%rowtype;
begin
 if nullif(trim(p_reason),'') is null then raise exception 'Void reason is required'; end if;
 if p_entity='invoice' then
   select * into v_invoice from invoices where invoice_id=p_id for update; if not found then raise exception 'Invoice not found'; end if;
   if v_invoice.status='void' then return to_jsonb(v_invoice); end if;
   if exists(select 1 from payment_allocations pa join payments p on p.payment_id=pa.payment_id where pa.invoice_id=p_id and p.status in ('pending','verified')) then raise exception 'Invoice with active allocations cannot be voided'; end if;
   update invoices set status='void',void_reason=p_reason,voided_by=p_actor,voided_at=now(),updated_at=now() where invoice_id=p_id;
   insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,reason,before_json,after_json,created_by,created_role) values(v_invoice.booking_id,v_invoice.booking_code,'INVOICE_VOIDED','invoice',p_id,v_invoice.grand_total,p_reason,to_jsonb(v_invoice),(select to_jsonb(i) from invoices i where i.invoice_id=p_id),p_actor,p_role);
   return (select to_jsonb(i) from invoices i where i.invoice_id=p_id);
 elsif p_entity='receipt' then
   select * into v_receipt from receipts where receipt_id=p_id for update; if not found then raise exception 'Receipt not found'; end if;
   if v_receipt.status='void' then return to_jsonb(v_receipt); end if;
   update receipts set status='void',void_reason=p_reason,voided_by=p_actor,voided_at=now() where receipt_id=p_id;
   insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,reason,before_json,after_json,created_by,created_role) values(v_receipt.booking_id,v_receipt.booking_code,'RECEIPT_VOIDED','receipt',p_id,p_reason,to_jsonb(v_receipt),(select to_jsonb(r) from receipts r where r.receipt_id=p_id),p_actor,p_role);
   return (select to_jsonb(r) from receipts r where r.receipt_id=p_id);
 end if;
 raise exception 'Unsupported document entity';
end $$;

create or replace function set_financial_payment_status(p_payment_id uuid,p_action text,p_reason text,p_actor text,p_role text)
returns jsonb language plpgsql as $$
declare v payments%rowtype; v_new text;
begin
  select * into v from payments where payment_id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  v_new:=case p_action when 'verify' then 'verified' when 'reject' then 'rejected' when 'reverse' then 'reversed' else null end;
  if v_new is null then raise exception 'Invalid payment action'; end if;
  if p_action='verify' and v.status<>'pending' then raise exception 'Only pending payments can be verified'; end if;
  if p_action='reverse' and v.status<>'verified' then raise exception 'Only verified payments can be reversed'; end if;
  update payments set status=v_new,
    verified_by=case when p_action='verify' then p_actor else verified_by end,
    verified_at=case when p_action='verify' then now() else verified_at end,
    reversed_by=case when p_action='reverse' then p_actor else reversed_by end,
    reversed_at=case when p_action='reverse' then now() else reversed_at end,
    reversal_reason=case when p_action='reverse' then p_reason else reversal_reason end
  where payment_id=p_payment_id;
  update invoices i set status=case
    when coalesce((select sum(pa.amount) from payment_allocations pa join payments p on p.payment_id=pa.payment_id where pa.invoice_id=i.invoice_id and p.status='verified'),0)>=i.grand_total then 'paid'
    when coalesce((select sum(pa.amount) from payment_allocations pa join payments p on p.payment_id=pa.payment_id where pa.invoice_id=i.invoice_id and p.status='verified'),0)>0 then 'partially_paid'
    else 'issued' end, updated_at=now()
  where i.invoice_id in(select invoice_id from payment_allocations where payment_id=p_payment_id) and i.status<>'void';
  insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,reason,before_json,after_json,created_by,created_role)
  values(v.booking_id,v.booking_code,'PAYMENT_'||upper(v_new),'payment',v.payment_id,v.amount,p_reason,to_jsonb(v),(select to_jsonb(p) from payments p where p.payment_id=v.payment_id),p_actor,p_role);
  return (select to_jsonb(p) from payments p where p.payment_id=v.payment_id);
end $$;

create or replace function issue_financial_receipt(p_payment_id uuid,p_snapshot jsonb,p_idempotency_key text,p_actor text,p_role text)
returns jsonb language plpgsql as $$
declare v payments%rowtype; v_id uuid; v_no text; v_existing receipts%rowtype;
begin
  if nullif(p_idempotency_key,'') is not null then select * into v_existing from receipts where idempotency_key=p_idempotency_key; if found then return to_jsonb(v_existing); end if; end if;
  select * into v from payments where payment_id=p_payment_id and status='verified' for update;
  if not found then raise exception 'Verified payment not found'; end if;
  v_no:=next_financial_document_no('receipt','RC');
  insert into receipts(receipt_no,payment_id,booking_id,booking_code,document_snapshot,issued_by,issued_role,idempotency_key)
  values(v_no,v.payment_id,v.booking_id,v.booking_code,coalesce(p_snapshot,'{}'::jsonb),p_actor,p_role,nullif(p_idempotency_key,'')) returning receipt_id into v_id;
  insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,detail,after_json,created_by,created_role)
  values(v.booking_id,v.booking_code,'RECEIPT_ISSUED','receipt',v_id,v.amount,jsonb_build_object('receiptNo',v_no),p_snapshot,p_actor,p_role);
  return (select to_jsonb(r) from receipts r where receipt_id=v_id);
end $$;

create or replace function create_financial_refund(p_booking_code text,p_refund jsonb,p_actor text,p_role text)
returns jsonb language plpgsql as $$
declare v_booking_id uuid; v_id uuid; v_no text; v_amount numeric(14,2); v_existing refunds%rowtype;
begin
  if nullif(p_refund->>'idempotencyKey','') is not null then select * into v_existing from refunds where idempotency_key=p_refund->>'idempotencyKey'; if found then return to_jsonb(v_existing); end if; end if;
  select booking_id into v_booking_id from bookings where booking_code=p_booking_code for update;
  if v_booking_id is null then raise exception 'Booking not found'; end if;
  v_amount:=coalesce((p_refund->>'amount')::numeric,0); if v_amount<=0 then raise exception 'Refund amount must be positive'; end if;
  if v_amount>coalesce((select sum(amount) from payments where booking_id=v_booking_id and status='verified'),0)-coalesce((select sum(amount) from refunds where booking_id=v_booking_id and status in ('approved','paid')),0) then raise exception 'Refund exceeds refundable amount'; end if;
  v_no:=next_financial_document_no('refund','RF');
  insert into refunds(refund_no,booking_id,booking_code,payment_id,amount,refund_date,method,reason,created_by,created_role,idempotency_key)
  values(v_no,v_booking_id,p_booking_code,nullif(p_refund->>'paymentId','')::uuid,v_amount,coalesce((p_refund->>'refundDate')::date,current_date),p_refund->>'method',p_refund->>'reason',p_actor,p_role,nullif(p_refund->>'idempotencyKey','')) returning refund_id into v_id;
  insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,method,reason,after_json,created_by,created_role)
  values(v_booking_id,p_booking_code,'REFUND_REQUESTED','refund',v_id,v_amount,p_refund->>'method',p_refund->>'reason',p_refund,p_actor,p_role);
  return (select to_jsonb(r) from refunds r where refund_id=v_id);
end $$;

create or replace function set_financial_refund_status(p_refund_id uuid,p_action text,p_actor text,p_role text)
returns jsonb language plpgsql as $$
declare v refunds%rowtype; v_new text;
begin
 select * into v from refunds where refund_id=p_refund_id for update; if not found then raise exception 'Refund not found'; end if;
 v_new:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' when 'mark-paid' then 'paid' else null end; if v_new is null then raise exception 'Invalid refund action'; end if;
 if p_action in ('approve','reject') and v.status<>'requested' then raise exception 'Refund is not pending'; end if;
 if p_action='mark-paid' and v.status<>'approved' then raise exception 'Refund is not approved'; end if;
 update refunds set status=v_new,approved_by=case when p_action='approve' then p_actor else approved_by end,approved_at=case when p_action='approve' then now() else approved_at end,paid_by=case when p_action='mark-paid' then p_actor else paid_by end,paid_at=case when p_action='mark-paid' then now() else paid_at end where refund_id=p_refund_id;
 insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,before_json,after_json,created_by,created_role)
 values(v.booking_id,v.booking_code,'REFUND_'||upper(replace(v_new,'-','_')),'refund',v.refund_id,v.amount,to_jsonb(v),(select to_jsonb(r) from refunds r where r.refund_id=v.refund_id),p_actor,p_role);
 return (select to_jsonb(r) from refunds r where r.refund_id=v.refund_id);
end $$;

create or replace function capture_island_addon_financial_adjustment()
returns trigger language plpgsql as $$
declare v_delta numeric(14,2); v_invoice_id uuid; v_invoice_no text; v_type text; v_total numeric(14,2);
begin
  v_delta:=coalesce(new.island_addon_revenue,0)-coalesce(old.island_addon_revenue,0);
  if v_delta=0 or not exists(select 1 from invoices where booking_id=new.booking_id and invoice_type='initial' and status in ('issued','partially_paid','paid')) then return new; end if;
  v_total:=abs(v_delta); v_type:=case when v_delta>0 then 'adjustment' else 'credit_note' end; v_invoice_no:=next_financial_document_no('invoice','INV');
  insert into invoices(invoice_no,booking_id,booking_code,invoice_type,issue_date,currency,subtotal,grand_total,status,notes,created_by,created_role)
  values(v_invoice_no,new.booking_id,new.booking_code,v_type,current_date,'THB',v_total,v_total,'issued','Automatic island add-on adjustment','booking-rpc','system') returning invoice_id into v_invoice_id;
  insert into invoice_items(invoice_id,source_type,item_code_snapshot,item_name_snapshot,description,qty,unit_price,line_total)
  values(v_invoice_id,'island_addon','island-adjustment',case when v_delta>0 then 'Island add-on adjustment' else 'Island add-on credit' end,'Snapshot of island add-on revenue change',1,v_total,v_total);
  insert into financial_events(booking_id,booking_code,event_type,entity_type,entity_id,amount,detail,before_json,after_json,created_by,created_role)
  values(new.booking_id,new.booking_code,case when v_delta>0 then 'ISLAND_ADJUSTMENT_CREATED' else 'ISLAND_CREDIT_CREATED' end,'invoice',v_invoice_id,v_delta,jsonb_build_object('invoiceNo',v_invoice_no),jsonb_build_object('islandAddOnRevenue',old.island_addon_revenue),jsonb_build_object('islandAddOnRevenue',new.island_addon_revenue),'booking-rpc','system');
  return new;
end $$;

drop trigger if exists bookings_island_financial_adjustment on bookings;
create trigger bookings_island_financial_adjustment after update of island_addon_revenue on bookings
for each row execute function capture_island_addon_financial_adjustment();
