import { financialService as service } from "../services/financialService.js";

const run = handler => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (error) {
    const message = error?.message || "Financial operation failed";
    const clientError = /required|invalid|unsupported|positive|exceed|not found|pending|verified|approved|allocat/i.test(message);
    res.status(clientError ? 400 : 500).json({ error: message });
  }
};

export const financialController = {
  bundle: run(req => service.bundle(req.params.code)),
  summary: run(req => service.summary(req.params.code)),
  timeline: run(req => service.timeline(req.params.code)),
  createInvoice: run(req => service.createInvoice(req.params.code, req.body, req.user)),
  createPayment: run(req => service.createPayment(req.params.code, req.body, req.user)),
  verifyPayment: run(req => service.paymentAction(req.params.id, "verify", req.body.reason, req.user)),
  rejectPayment: run(req => service.paymentAction(req.params.id, "reject", req.body.reason, req.user)),
  reversePayment: run(req => service.paymentAction(req.params.id, "reverse", req.body.reason, req.user)),
  issueReceipt: run(req => service.issueReceipt(req.params.id, req.body, req.user)),
  voidInvoice: run(req => service.voidDocument("invoice", req.params.id, req.body.reason, req.user)),
  voidReceipt: run(req => service.voidDocument("receipt", req.params.id, req.body.reason, req.user)),
  createRefund: run(req => service.createRefund(req.params.code, req.body, req.user)),
  approveRefund: run(req => service.refundAction(req.params.id, "approve", req.user)),
  rejectRefund: run(req => service.refundAction(req.params.id, "reject", req.user)),
  payRefund: run(req => service.refundAction(req.params.id, "mark-paid", req.user)),
  report: run(req => service.report(req.params.type, req.query.date || new Date().toISOString().slice(0,10)))
};
