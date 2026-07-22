import { financialRepository as repo } from "../repositories/financialRepository.js";
import { validateInvoice, validatePayment, validateRefund } from "../validators/financialValidator.js";

const actor = user => ({ actor: user.username || user.displayName || "unknown", role: user.role || "unknown" });

export const financialService = {
  summary(code) { return repo.rpc("financial_booking_summary", { p_booking_code: code }); },
  async timeline(code) { return repo.list("financial_events", code); },
  async bundle(code) {
    const [summary, invoices, payments, receipts, refunds, timeline] = await Promise.all([
      this.summary(code), repo.list("invoices", code), repo.list("payments", code),
      repo.list("receipts", code), repo.list("refunds", code), repo.list("financial_events", code)
    ]);
    const [items,allocations] = await Promise.all([repo.listInvoiceItems(invoices.map(row => row.invoice_id)),repo.listAllocations(payments.filter(row=>!["rejected","reversed"].includes(row.status)).map(row=>row.payment_id))]);
    return { summary, invoices: invoices.map(row => ({ ...row, items: items.filter(item => item.invoice_id === row.invoice_id) })), payments, allocations, receipts, refunds, timeline };
  },
  createInvoice(code, body, user) { const a=actor(user); return repo.rpc("create_financial_invoice", { p_booking_code:code,p_invoice:validateInvoice(body),p_actor:a.actor,p_role:a.role }); },
  createPayment(code, body, user) { const a=actor(user); return repo.rpc("create_financial_payment", { p_booking_code:code,p_payment:validatePayment(body),p_actor:a.actor,p_role:a.role }); },
  paymentAction(id, action, reason, user) { const a=actor(user); return repo.rpc("set_financial_payment_status", { p_payment_id:id,p_action:action,p_reason:reason||null,p_actor:a.actor,p_role:a.role }); },
  issueReceipt(id, body, user) { const a=actor(user); return repo.rpc("issue_financial_receipt", { p_payment_id:id,p_snapshot:body.documentSnapshot||{},p_idempotency_key:body.idempotencyKey||null,p_actor:a.actor,p_role:a.role }); },
  voidDocument(entity, id, reason, user) { const a=actor(user); return repo.rpc("void_financial_document", { p_entity:entity,p_id:id,p_reason:reason,p_actor:a.actor,p_role:a.role }); },
  createRefund(code, body, user) { const a=actor(user); return repo.rpc("create_financial_refund", { p_booking_code:code,p_refund:validateRefund(body),p_actor:a.actor,p_role:a.role }); },
  refundAction(id, action, user) { const a=actor(user); return repo.rpc("set_financial_refund_status", { p_refund_id:id,p_action:action,p_actor:a.actor,p_role:a.role }); },
  report(type, date) { return repo.report(type, date); }
};
