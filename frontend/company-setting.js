// =========================================================
// Sprint 1.3 - Company Profile / System Setting
// =========================================================

function profileToForm(profile) {
  const map = {
    csCompanyName: profile.company_name,
    csTaxId: profile.tax_id,
    csAddress: profile.address,
    csPhone: profile.phone,
    csEmail: profile.email,
    csWebsite: profile.website,
    csLineOa: profile.line_oa,
    csFacebook: profile.facebook,
    csLogoUrl: profile.logo_url,
    csSignatureUrl: profile.signature_url,
    csStampUrl: profile.stamp_url,
    csBankName: profile.bank_name,
    csBankAccount: profile.bank_account,
    csBankAccountName: profile.bank_account_name,
    csPromptPay: profile.promptpay,
    csPromptPayQrUrl: profile.promptpay_qr_url
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  });
}

function formToProfile() {
  return {
    company_name: document.getElementById("csCompanyName").value,
    tax_id: document.getElementById("csTaxId").value,
    address: document.getElementById("csAddress").value,
    phone: document.getElementById("csPhone").value,
    email: document.getElementById("csEmail").value,
    website: document.getElementById("csWebsite").value,
    line_oa: document.getElementById("csLineOa").value,
    facebook: document.getElementById("csFacebook").value,
    logo_url: document.getElementById("csLogoUrl").value,
    signature_url: document.getElementById("csSignatureUrl").value,
    stamp_url: document.getElementById("csStampUrl").value,
    bank_name: document.getElementById("csBankName").value,
    bank_account: document.getElementById("csBankAccount").value,
    bank_account_name: document.getElementById("csBankAccountName").value,
    promptpay: document.getElementById("csPromptPay").value,
    promptpay_qr_url: document.getElementById("csPromptPayQrUrl").value
  };
}

async function loadCompanyProfileToForm() {
  const status = document.getElementById("companySettingStatus");
  try {
    const profile = await DataService.getCompanyProfile();
    localStorage.setItem("company_profile", JSON.stringify(profile));
    profileToForm(profile);
    if (status) status.innerHTML = `<div class="setting-status-ok">โหลด Company Profile แล้ว</div>`;
  } catch (error) {
    console.warn(error);
    const fallback = JSON.parse(localStorage.getItem("company_profile") || "null");
    if (fallback) profileToForm(fallback);
    if (status) status.innerHTML = `<div class="setting-status-error">โหลดจาก Backend ไม่สำเร็จ: ${error.message}</div>`;
  }
}

async function saveCompanyProfile() {
  const status = document.getElementById("companySettingStatus");
  const profile = formToProfile();

  try {
    const saved = await DataService.saveCompanyProfile(profile);
    localStorage.setItem("company_profile", JSON.stringify(saved.profile || profile));
    if (status) status.innerHTML = `<div class="setting-status-ok">บันทึก Company Profile แล้ว</div>`;
    alert("บันทึกข้อมูลบริษัทแล้ว");
  } catch (error) {
    if (status) status.innerHTML = `<div class="setting-status-error">บันทึกไม่สำเร็จ: ${error.message}</div>`;
    alert("บันทึกไม่สำเร็จ: " + error.message);
  }
}

function previewCompanyReceipt() {
  const profile = formToProfile();
  localStorage.setItem("company_profile", JSON.stringify(profile));

  const sample = {
    bookingCode: "BK-SAMPLE",
    receiptNo: "RC-SAMPLE",
    leaderTitle: "นาย",
    leaderFirstName: "ตัวอย่าง",
    leaderLastName: "ลูกค้า",
    phone: "081-000-0000",
    source: "Facebook",
    travelDate: new Date().toISOString().slice(0, 10),
    status: "confirmed",
    paymentMethod: "โอนผ่านธนาคาร",
    passengers: [{
      title: "นาย",
      firstName: "ตัวอย่าง",
      lastName: "ลูกค้า",
      program: { name: "One Day Trip", qty: 1, price: 2500 },
      preAddOns: [],
      islandAddOns: []
    }],
    totalAmount: 2500
  };

  const root = document.getElementById("companyReceiptPreview");
  if (root && typeof renderReceiptDocument === "function") {
    root.innerHTML = renderReceiptDocument(sample, "RECEIPT");
  }
}

// Load company profile when page is opened
const originalShowPageCompany = window.showPage;
if (typeof originalShowPageCompany === "function") {
  window.showPage = function(id) {
    originalShowPageCompany(id);
    if (id === "companySettingPage") {
      loadCompanyProfileToForm();
    }
  };
}
