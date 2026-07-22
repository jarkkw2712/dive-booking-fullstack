import { supabaseAdmin } from "../services/supabase.js";

function unwrap(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export const financialRepository = {
  rpc(name, args) { return supabaseAdmin.rpc(name, args).then(unwrap); },
  list(table, bookingCode) {
    const order = table === "receipts" ? "issued_at" : table === "financial_events" ? "created_at" : "created_at";
    return supabaseAdmin.from(table).select("*").eq("booking_code", bookingCode).order(order, { ascending: false }).then(unwrap);
  },
  listInvoiceItems(invoiceIds) {
    if (!invoiceIds.length) return Promise.resolve([]);
    return supabaseAdmin.from("invoice_items").select("*").in("invoice_id", invoiceIds).order("created_at").then(unwrap);
  },
  listAllocations(paymentIds) {
    if (!paymentIds.length) return Promise.resolve([]);
    return supabaseAdmin.from("payment_allocations").select("*").in("payment_id", paymentIds).then(unwrap);
  },
  report(type, date) {
    if (type === "outstanding") return supabaseAdmin.from("v_financial_outstanding").select("*").gt("outstanding_amount", 0).then(unwrap);
    if (type === "refunds") return supabaseAdmin.from("refunds").select("*").eq("refund_date", date).order("created_at").then(unwrap);
    if (type === "payment-verification") return supabaseAdmin.from("payments").select("*").eq("status", "pending").order("created_at").then(unwrap);
    if (type === "deposits") return supabaseAdmin.from("payments").select("*").eq("payment_date", date).in("status", ["pending","verified"]).order("created_at").then(unwrap);
    const method = type === "daily-cash" ? "cash" : "bank_transfer";
    return supabaseAdmin.from("payments").select("*").eq("payment_date", date).eq("status", "verified").eq("method_id", method).order("created_at").then(unwrap);
  }
};
