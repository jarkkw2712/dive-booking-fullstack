const ALLOWED_METHODS = new Set(["cash", "bank_transfer", "promptpay", "card", "other"]);

function positiveMoney(value, field) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    throw new Error(`${field} must be a positive amount with at most 2 decimals`);
  }
  return amount;
}

export function validateInvoice(input = {}) {
  if (!Array.isArray(input.items) || !input.items.length) throw new Error("Invoice items are required");
  input.items.forEach((item, index) => {
    if (!String(item.itemName || "").trim()) throw new Error(`Item ${index + 1} name is required`);
    positiveMoney(item.qty, `Item ${index + 1} quantity`);
    const price = Number(item.unitPrice);
    if (!Number.isFinite(price) || price < 0) throw new Error(`Item ${index + 1} price is invalid`);
  });
  return input;
}

export function validatePayment(input = {}) {
  positiveMoney(input.amount, "Payment amount");
  if (!ALLOWED_METHODS.has(input.methodId || input.methodSnapshot)) throw new Error("Unsupported payment method");
  if ((input.methodId || input.methodSnapshot) === "bank_transfer" && !String(input.referenceNo || "").trim()) {
    throw new Error("Bank reference is required for transfer payments");
  }
  return input;
}

export function validateRefund(input = {}) {
  positiveMoney(input.amount, "Refund amount");
  if (!String(input.reason || "").trim()) throw new Error("Refund reason is required");
  if (!String(input.method || "").trim()) throw new Error("Refund method is required");
  return input;
}

export function calculateFinancialTotals({ invoicedAmount = 0, verifiedPaidAmount = 0, refundedAmount = 0 } = {}) {
  const invoiced = Number(invoicedAmount);
  const paid = Number(verifiedPaidAmount);
  const refunded = Number(refundedAmount);
  return {
    outstandingAmount: Math.max(invoiced - paid, 0),
    netCashReceived: paid - refunded
  };
}
