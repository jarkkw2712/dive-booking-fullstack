insert into role_permissions(role_id, permission_key, allowed, updated_at)
select r.role_id, p.permission_key,
  case
    when r.role_id = 'admin' then true
    when r.role_id = 'finance' then true
    when r.role_id in ('management','ceo') and p.permission_key in ('viewFinancial','viewBankReference','exportFinancialReport') then true
    when r.role_id = 'counter' and p.permission_key in ('viewFinancial','receivePayment','issueReceipt') then true
    when r.role_id = 'island_staff' and p.permission_key in ('viewFinancial','receivePayment') then true
    else false
  end,
  now()
from app_roles r
cross join (values
 ('viewFinancial'),('createInvoice'),('voidInvoice'),('receivePayment'),
 ('verifyPayment'),('reversePayment'),('issueReceipt'),('voidReceipt'),
 ('createRefund'),('approveRefund'),('markRefundPaid'),('viewBankReference'),
 ('exportFinancialReport')
) p(permission_key)
on conflict(role_id, permission_key) do update
set allowed=excluded.allowed, updated_at=excluded.updated_at;

