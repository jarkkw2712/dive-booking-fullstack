const DEFAULT_COMPANY_SETTINGS = {
  name: "Dive Tour Company",
  phone: "081-000-0000",
  address: "Phuket, Thailand",
  taxId: "-",
  paymentInfo: "PromptPay: 000-000-0000",
  logoUrl: ""
};

function getCompanySettings() {
  const dbProfile = JSON.parse(localStorage.getItem("company_profile") || "null");
  if (dbProfile) {
    return {
      name: dbProfile.company_name || DEFAULT_COMPANY_SETTINGS.name,
      phone: dbProfile.phone || DEFAULT_COMPANY_SETTINGS.phone,
      address: dbProfile.address || DEFAULT_COMPANY_SETTINGS.address,
      taxId: dbProfile.tax_id || DEFAULT_COMPANY_SETTINGS.taxId,
      paymentInfo: [
        dbProfile.bank_name,
        dbProfile.bank_account,
        dbProfile.promptpay ? "PromptPay: " + dbProfile.promptpay : ""
      ].filter(Boolean).join(" | ") || DEFAULT_COMPANY_SETTINGS.paymentInfo,
      logoUrl: dbProfile.logo_url || ""
    };
  }
  return JSON.parse(localStorage.getItem("company_settings") || "null") || DEFAULT_COMPANY_SETTINGS;
}

function saveCompanySettings() {
  const data = {
    name: document.getElementById("companyName").value,
    phone: document.getElementById("companyPhone").value,
    address: document.getElementById("companyAddress").value,
    taxId: document.getElementById("companyTaxId").value,
    paymentInfo: document.getElementById("companyPaymentInfo").value,
    logoUrl: document.getElementById("companyLogoUrl").value
  };
  localStorage.setItem("company_settings", JSON.stringify(data));
  alert("บันทึก Company Template แล้ว");
  previewReceiptTemplate();
}

function loadCompanySettingsToForm() {
  const c = getCompanySettings();
  const ids = {
    companyName: c.name,
    companyPhone: c.phone,
    companyAddress: c.address,
    companyTaxId: c.taxId,
    companyPaymentInfo: c.paymentInfo,
    companyLogoUrl: c.logoUrl
  };
  Object.entries(ids).forEach(([id,val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  });
}

function selectedOrDraftBooking() {
  if (typeof selectedBookingV3 !== "undefined" && selectedBookingV3) return selectedBookingV3;
  if (typeof buildBooking === "function") return buildBooking();
  return null;
}

function collectReceiptItems(booking) {
  const items = [];
  (booking.passengers || []).forEach((p, idx) => {
    if (p.program) {
      const qty = Number(p.program.qty || 1), price = Number(p.program.price || 0);
      items.push({ name: `${idx + 1}. ${[p.title,p.firstName,p.lastName].filter(Boolean).join(" ")} - ${p.program.name}`, qty, unitPrice: price, total: qty * price });
    }
    (p.preAddOns || []).filter(a => a.selected).forEach(a => {
      const qty = Number(a.qty || 1), price = Number(a.price || 0);
      items.push({ name: `Pre Add-on: ${a.customName || a.name}`, qty, unitPrice: price, total: qty * price });
    });
    (p.islandAddOns || []).forEach(a => {
      const qty = Number(a.qty || 1), price = Number(a.price || 0);
      items.push({ name: `Island Add-on: ${a.name}`, qty, unitPrice: price, total: qty * price });
    });
  });
  return items;
}

function renderReceiptDocument(booking, docType = "RECEIPT") {
  const c = getCompanySettings();
  const items = collectReceiptItems(booking);
  const subtotal = items.reduce((s,x) => s + Number(x.total || 0), 0);
  const total = Number(booking.totalAmount || subtotal || 0);
  const logo = c.logoUrl ? `<img class="receipt-logo" src="${c.logoUrl}" onerror="this.style.display='none'">` : `<div class="receipt-logo"></div>`;

  return `
    <div class="doc-toolbar">
      <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
      <button class="btn btn-soft" onclick="showPage('receiptTemplatePage')">Edit Template</button>
    </div>
    <div class="receipt-paper">
      <div class="receipt-header">
        <div class="receipt-brand">${logo}<div><h2>${c.name}</h2><div>${c.address}</div><div>Tel: ${c.phone}</div><div>Tax ID: ${c.taxId}</div></div></div>
        <div class="receipt-title"><h1>${docType}</h1><div>No: ${booking.receiptNo || "RC-" + (booking.bookingCode || "DRAFT")}</div><div>Booking: ${booking.bookingCode || "DRAFT"}</div><div>Date: ${new Date().toISOString().slice(0,10)}</div></div>
      </div>
      <div class="receipt-meta">
        <div class="receipt-box"><strong>Customer</strong><br>${[booking.leaderTitle,booking.leaderFirstName,booking.leaderLastName].filter(Boolean).join(" ")}<br>Phone: ${booking.phone || "-"}<br>Source: ${booking.source || "-"}</div>
        <div class="receipt-box"><strong>Trip</strong><br>Travel Date: ${booking.travelDate || "-"}<br>Return Date: ${booking.returnDate || "-"}<br>Status: ${booking.status || "-"}<br>Payment: ${booking.paymentMethod || "-"}</div>
      </div>
      <table class="receipt-table">
        <thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th></tr></thead>
        <tbody>${items.map(x => `<tr><td>${x.name}</td><td>${x.qty}</td><td>${Number(x.unitPrice).toLocaleString("th-TH")}</td><td>${Number(x.total).toLocaleString("th-TH")}</td></tr>`).join("")}</tbody>
      </table>
      <div class="receipt-total">
        <div class="line"><span>Subtotal</span><strong>${subtotal.toLocaleString("th-TH")}</strong></div>
        <div class="line"><span>Total</span><strong>${total.toLocaleString("th-TH")} บาท</strong></div>
      </div>
      <p><strong>Payment Info:</strong> ${c.paymentInfo}</p>
      ${docType === "RECEIPT" ? `<div class="paid-stamp">PAID</div>` : ""}
      <div class="signature-row"><div><div class="signature-line">ผู้รับเงิน</div></div><div><div class="signature-line">ลูกค้า / ผู้ชำระเงิน</div></div></div>
    </div>
  `;
}

function openDocumentWindow(html) {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Document</title><link rel="stylesheet" href="style.css"></head><body>${html}</body></html>`);
  w.document.close();
}

function printSelectedReceiptV3() {
  const b = selectedOrDraftBooking();
  if (!b) return alert("ไม่พบ Booking");
  openDocumentWindow(renderReceiptDocument(b, "RECEIPT"));
}
function printSelectedVoucherV3() {
  const b = selectedOrDraftBooking();
  if (!b) return alert("ไม่พบ Booking");
  openDocumentWindow(renderReceiptDocument(b, "VOUCHER"));
}
function printSelectedInvoiceV3() {
  const b = selectedOrDraftBooking();
  if (!b) return alert("ไม่พบ Booking");
  openDocumentWindow(renderReceiptDocument(b, "INVOICE"));
}

function previewReceiptTemplate() {
  const sample = selectedOrDraftBooking() || {
    bookingCode: "BK-SAMPLE", receiptNo: "RC-SAMPLE", leaderTitle: "นาย", leaderFirstName: "ตัวอย่าง", leaderLastName: "ลูกค้า",
    phone: "081-000-0000", source: "Facebook", travelDate: new Date().toISOString().slice(0,10), status: "confirmed", paymentMethod: "โอนผ่านธนาคาร",
    passengers: [{ title: "นาย", firstName: "ตัวอย่าง", lastName: "ลูกค้า", program: { name: "One Day Trip", qty: 1, price: 2500 }, preAddOns: [], islandAddOns: [] }],
    totalAmount: 2500
  };
  const root = document.getElementById("receiptPreviewRoot");
  if (root) root.innerHTML = renderReceiptDocument(sample, "RECEIPT");
}

function renderPrettyPrintCenterReport(data) {
  const rows = data.rows || [];
  const totalRevenue = rows.reduce((s,r) => s + Number(r.totalAmount || r.revenue || r.total_revenue || 0), 0);
  const totalPax = rows.reduce((s,r) => s + Number(r.pax || r.passengers || r.passenger_count || 0), 0);
  return `
    <div class="doc-toolbar"><button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button></div>
    <div class="report-paper">
      <div class="report-title"><div><h2>${(data.title || data.type || "Report").toUpperCase()}</h2><div>Date: ${data.date || ""}</div></div><div>${getCompanySettings().name}</div></div>
      <div class="report-summary">
        <div class="report-kpi"><div class="muted">Rows</div><strong>${rows.length}</strong></div>
        <div class="report-kpi"><div class="muted">Pax</div><strong>${totalPax.toLocaleString("th-TH")}</strong></div>
        <div class="report-kpi"><div class="muted">Revenue</div><strong>${totalRevenue.toLocaleString("th-TH")}</strong></div>
        <div class="report-kpi"><div class="muted">Generated</div><strong>${new Date().toLocaleTimeString("th-TH")}</strong></div>
      </div>
      ${buildReportTableV3(rows)}
    </div>`;
}

async function generatePrintCenterReport() {
  const date = document.getElementById("pcDate").value;
  const type = document.getElementById("pcReportType").value;
  if (!date) return alert("กรุณาเลือกวันที่");
  const root = document.getElementById("printCenterOutput");
  root.innerHTML = "Loading...";
  try {
    const data = await DataService.getPrintCenterReport(date, type);
    root.innerHTML = renderPrettyPrintCenterReport(data);
  } catch (error) {
    root.innerHTML = `<p class="muted">Generate Report ไม่สำเร็จ: ${error.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadCompanySettingsToForm);
