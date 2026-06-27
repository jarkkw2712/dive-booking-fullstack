let selectedBookingV3 = null;
let bookingListCacheV3 = [];

function statusBadgeHtml(status) {
  return `<span class="status-badge status-${status || 'unknown'}">${status || '-'}</span>`;
}

function bookingTextForSearch(b) {
  return [
    b.bookingCode,
    b.leaderFirstName,
    b.leaderLastName,
    b.phone,
    b.status,
    b.source,
    b.agentName
  ].filter(Boolean).join(" ").toLowerCase();
}

async function loadBookingListV3() {
  try {
    if (typeof loadBookingCache === "function") {
      bookingListCacheV3 = await loadBookingCache();
    } else {
      bookingListCacheV3 = await DataService.listBookings();
    }

    const date = document.getElementById("blDate")?.value || "";
    const status = document.getElementById("blStatus")?.value || "";
    const search = (document.getElementById("blSearch")?.value || "").toLowerCase().trim();

    let rows = bookingListCacheV3 || [];
    if (date) rows = rows.filter(b => b.travelDate === date);
    if (status) rows = rows.filter(b => b.status === status);
    if (search) rows = rows.filter(b => bookingTextForSearch(b).includes(search));

    const root = document.getElementById("bookingListV3");
    if (!root) return;

    root.innerHTML = rows.map(b => `
      <div class="booking-item-v3 ${selectedBookingV3?.bookingCode === b.bookingCode ? "active" : ""}" onclick='selectBookingV3(${JSON.stringify(b).replace(/'/g, "&apos;")})'>
        ${statusBadgeHtml(b.status)}
        <strong>${b.bookingCode}</strong><br>
        ${[b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" ")}<br>
        <span class="muted">${b.travelDate || "-"} | ${b.passengers?.length || 0} คน | ${Number(b.totalAmount || 0).toLocaleString("th-TH")} บาท</span>
      </div>
    `).join("") || `<p class="muted">ไม่พบ Booking</p>`;
  } catch (error) {
    alert("โหลด Booking List ไม่สำเร็จ: " + error.message);
  }
}

function selectBookingV3(b) {
  selectedBookingV3 = b;
  renderBookingDetailV3(b);
  loadBookingListV3();
}

function renderBookingDetailV3(b) {
  const root = document.getElementById("bookingDetailV3");
  if (!root) return;

  const programRevenue = Number(b.programRevenue || 0);
  const preRevenue = Number(b.preAddOnRevenue || 0);
  const islandRevenue = Number(b.islandAddOnRevenue || 0);
  const total = Number(b.totalAmount || 0);

  root.innerHTML = `
    <div>${statusBadgeHtml(b.status)}</div>
    <h2>${b.bookingCode}</h2>
    <p><strong>${[b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" ")}</strong></p>
    <p>${b.travelDate || "-"} ${b.returnDate ? "→ " + b.returnDate : ""}</p>
    <p>Phone: ${b.phone || "-"} | Source: ${b.source || "-"}</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="muted">Pax</div><strong>${b.passengers?.length || 0}</strong></div>
      <div class="kpi"><div class="muted">Program</div><strong>${programRevenue.toLocaleString("th-TH")}</strong></div>
      <div class="kpi"><div class="muted">Add-on</div><strong>${(preRevenue + islandRevenue).toLocaleString("th-TH")}</strong></div>
      <div class="kpi"><div class="muted">Total</div><strong>${total.toLocaleString("th-TH")}</strong></div>
    </div>

    <h3>Passengers</h3>
    ${(b.passengers || []).map((p, i) => `
      <div class="service">
        <strong>${i + 1}. ${[p.title, p.firstName, p.lastName].filter(Boolean).join(" ")}</strong><br>
        Program: ${p.program?.name || "-"} | Island: ${p.island || "-"}<br>
        Pre Add-on: ${(p.preAddOns || []).filter(a => a.selected).map(a => `${a.name} x ${a.qty}`).join(", ") || "-"}<br>
        Island Add-on: ${(p.islandAddOns || []).map(a => `${a.name} x ${a.qty}`).join(", ") || "-"}
      </div>
    `).join("")}
  `;
}

function editSelectedBookingV3() {
  if (!selectedBookingV3) return alert("กรุณาเลือก Booking ก่อน");
  if (typeof loadBooking === "function") {
    loadBooking(selectedBookingV3);
  } else {
    alert("ไม่พบ function loadBooking ในระบบเดิม");
  }
}

function printSelectedReceiptV3() {
  if (!selectedBookingV3) return alert("กรุณาเลือก Booking ก่อน");
  if (typeof printReceipt === "function") {
    printReceipt(selectedBookingV3);
  } else if (typeof printCurrentReceipt === "function") {
    loadBooking(selectedBookingV3);
    printCurrentReceipt();
  } else {
    window.print();
  }
}

async function loadSelectedTimelineV3() {
  if (!selectedBookingV3) return alert("กรุณาเลือก Booking ก่อน");

  const root = document.getElementById("timelineV3");
  root.innerHTML = `<p class="muted">Loading timeline...</p>`;

  try {
    const logs = await DataService.getBookingTimeline(selectedBookingV3.bookingCode);
    root.innerHTML = `<h3>Timeline</h3>` + (logs || []).map(x => `
      <div class="timeline-row">
        <strong>${x.action || "-"}</strong><br>
        <span class="muted">${x.changed_at || x.changedAt || ""}</span><br>
        ${x.detail || ""}
      </div>
    `).join("") || `<p class="muted">ยังไม่มี Timeline</p>`;
  } catch (error) {
    root.innerHTML = `<p class="muted">โหลด Timeline ไม่สำเร็จ: ${error.message}</p>`;
  }
}

async function generatePrintCenterReport() {
  const date = document.getElementById("pcDate").value;
  const type = document.getElementById("pcReportType").value;

  if (!date) return alert("กรุณาเลือกวันที่");

  const root = document.getElementById("printCenterOutput");
  root.innerHTML = "Loading...";

  try {
    const data = await DataService.getPrintCenterReport(date, type);
    const rows = data.rows || [];

    root.innerHTML = `
      <h2>${data.title || type} - ${date}</h2>
      <p>Rows: ${rows.length}</p>
      ${buildReportTableV3(rows)}
    `;
  } catch (error) {
    root.innerHTML = `<p class="muted">Generate Report ไม่สำเร็จ: ${error.message}</p>`;
  }
}

function buildReportTableV3(rows) {
  if (!rows.length) return `<p class="muted">ไม่มีข้อมูล</p>`;

  const keys = Object.keys(rows[0]);
  return `
    <table>
      <thead><tr>${keys.map(k => `<th>${k}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${keys.map(k => `<td>${r[k] ?? ""}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}
