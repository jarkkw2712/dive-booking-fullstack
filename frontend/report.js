function requireReportPermission(action, msg) {
  if (typeof requirePermission === "function") return requirePermission(action, msg);
  return true;
}

function addOnName(a){ return a.id === 'other' && a.customName ? a.customName : a.name; }
function setPrintDoc(id) {
  document.querySelectorAll(".print-doc").forEach(x => x.classList.remove("active-print"));
  document.getElementById(id).classList.add("active-print");
}

function canPrintOperationalReport(b) {
  if (b.status !== "checked-in") {
    alert(`Booking ${b.bookingCode || "DRAFT"} ยังไม่ใช่สถานะ checked-in\n\nจะพิมพ์ Operation Report ได้เฉพาะสถานะ checked-in เท่านั้น`);
    return false;
  }
  return true;
}

function printCurrentReceipt() { printReceipt(buildBooking()); }
function printCurrentCounterReport() { const b = buildBooking(); if (!validateBookingBeforeOperationalReport(b)) return; printCounterReport(b); }
function printCurrentBoatReport() { const b = buildBooking(); if (!validateBookingBeforeOperationalReport(b)) return; printBoatReport(b); }

function renderPrintPage() {
  const root = document.getElementById("printBookingList");
  if (!root) return;

  const date = document.getElementById("printDateFilter")?.value || "";
  const data = getBookingsByDate(date);

  root.innerHTML = data.length ? data.map(b => `
    <div class="booking-row booking-card-wrap">
      ${statusBadge(b.status)}
      <strong>${b.bookingCode}</strong><br>
      ลูกค้า: ${[b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" ") || "-"}<br>
      วันที่: ${b.travelDate || "-"} ${b.returnDate ? "→ " + b.returnDate : ""}<br>
      จำนวน: ${b.passengers?.length || 0} คน | ยอด: ${can("viewMoney") ? money(b.totalAmount) + " บาท" : "-"}<br><br>
      <button class="btn btn-soft" onclick='printReceipt(${JSON.stringify(b)})'>พิมพ์ใบเสร็จ</button>
      <button class="btn btn-soft" onclick='printCounterReport(${JSON.stringify(b)})'>Counter Report</button>
      <button class="btn btn-warning" onclick='printBoatReport(${JSON.stringify(b)})'>Boat Report</button>
    </div>
  `).join("") : "ไม่พบ Booking";
}

function printReceipt(b) {
  if (!requireReportPermission('printReceipt', 'Role นี้ไม่มีสิทธิ์พิมพ์ใบเสร็จ')) return;
  setPrintDoc("receiptDoc");

  const itemMap = {};
  b.passengers.forEach(p => {
    const pk = `${p.program.name}_${p.program.price}`;
    if (!itemMap[pk]) itemMap[pk] = { name: p.program.name, qty: 0, price: p.program.price, total: 0 };
    itemMap[pk].qty += Number(p.program.qty || 0);
    itemMap[pk].total += Number(p.program.qty || 0) * Number(p.program.price || 0);

    p.preAddOns.filter(a => a.selected).forEach(a => {
      const key = `${addOnName(a)}_${a.price}`;
      if (!itemMap[key]) itemMap[key] = { name: addOnName(a), qty: 0, price: a.price, total: 0 };
      itemMap[key].qty += Number(a.qty || 0);
      itemMap[key].total += Number(a.qty || 0) * Number(a.price || 0);
    });

    (p.islandAddOns || []).forEach(a => {
      const key = `${addOnName(a)}_${a.price}_island`;
      if (!itemMap[key]) itemMap[key] = { name: `${addOnName(a)} (ซื้อบนเกาะ)`, qty: 0, price: a.price, total: 0 };
      itemMap[key].qty += Number(a.qty || 0);
      itemMap[key].total += Number(a.qty || 0) * Number(a.price || 0);
    });
  });

  document.getElementById("receiptDoc").innerHTML = `
    <div class="print-header">
      <div><div class="print-title">ใบเสร็จรับเงิน</div><div>Receipt</div></div>
      <div class="right"><strong>บริษัท ดำน้ำ จำกัด</strong><br>โทร: 08x-xxx-xxxx</div>
    </div>
    <strong>เลขที่:</strong> ${b.receiptNo}<br>
    <strong>Booking:</strong> ${b.bookingCode}<br>
    <strong>ลูกค้า:</strong> ${[b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" ") || "-"}<br>
    <strong>วันที่เดินทาง:</strong> ${b.travelDate || "-"} ${b.returnDate ? "→ " + b.returnDate : ""}<br>
    <strong>ชำระโดย:</strong> ${b.paymentMethod || "-"}
    <table class="print-table">
      <tr><th>รายการ</th><th class="right">จำนวน</th><th class="right">ราคา</th><th class="right">รวม</th></tr>
      ${Object.values(itemMap).map(i => `
        <tr><td>${i.name}</td><td class="right">${i.qty}</td><td class="right">${money(i.price)}</td><td class="right">${money(i.total)}</td></tr>
      `).join("")}
    </table>
    <h2 class="right">รวม ${money(b.totalAmount)} บาท</h2>
    <br><br>ผู้รับเงิน ____________________ ลูกค้า ____________________
  `;
  window.print();
}

function printCounterReport(b) {
  if (!requireReportPermission('printCounterReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Counter Report')) return;
  if (!validateBookingBeforeOperationalReport(b)) return;
  setPrintDoc("counterReportDoc");
  document.getElementById("counterReportDoc").innerHTML = `
    <div class="print-header">
      <div><div class="print-title">Counter Report</div><div>สำหรับเคาน์เตอร์</div></div>
      <div class="right">Booking: ${b.bookingCode}<br>วันที่: ${b.travelDate || "-"}</div>
    </div>
    <strong>หัวหน้าทริป:</strong> ${[b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" ") || "-"}<br>
    <strong>โทร:</strong> ${b.phone || "-"}<br>
    <strong>ช่องทาง:</strong> ${b.source || "-"}<br>
    <strong>Agent:</strong> ${b.agentName || "-"}<br>
    <strong>หมายเหตุ:</strong> ${b.bookingNote || "-"}
    <table class="print-table">
      <tr><th>#</th><th>ผู้เดินทาง</th><th>Program/Add-on</th><th>หมายเหตุ</th><th class="right">ยอด</th></tr>
      ${b.passengers.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${fullName(p) || "-"}<br>โทร: ${p.phone || "-"}</td>
          <td>
            Program: ${p.program.name} x ${p.program.qty} = ${money(programTotal(p))}<br>
            ${p.preAddOns.filter(a => a.selected).map(a => `${addOnName(a)} x ${a.qty} = ${money(a.qty * a.price)}`).join("<br>")}
            ${(p.islandAddOns || []).map(a => `<br>${addOnName(a)} x ${a.qty} = ${money(a.qty * a.price)} (ซื้อบนเกาะ)`).join("")}
          </td>
          <td>แพ้อาหาร: ${p.foodAllergy || "-"}<br>${p.medicalNote || "-"}</td>
          <td class="right">${money(getPersonTotal(p))}</td>
        </tr>
      `).join("")}
    </table>
    <h2 class="right">รวม ${money(b.totalAmount)} บาท</h2>
  `;
  window.print();
}

function qtyIsland(p, id) {
  return (p.islandAddOns || []).filter(a => a.id === id).reduce((sum, a) => sum + Number(a.qty || 0), 0);
}

function tentQty(p) {
  const pre = p.preAddOns.filter(a => a.selected && a.id === "tent").reduce((sum, a) => sum + Number(a.qty || 0), 0);
  return pre + qtyIsland(p, "tent");
}

function printBoatReport(b) {
  if (!requireReportPermission('printBoatReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Boat Report')) return;
  if (!validateBookingBeforeOperationalReport(b)) return;
  setPrintDoc("boatReportDoc");
  let total = { fin: 0, mask: 0, life_jacket: 0, tent: 0 };

  b.passengers.forEach(p => {
    total.fin += qtyIsland(p, "fin");
    total.mask += qtyIsland(p, "mask");
    total.life_jacket += qtyIsland(p, "life_jacket");
    total.tent += tentQty(p);
  });

  document.getElementById("boatReportDoc").innerHTML = `
    <div class="print-header">
      <div><div class="print-title">Boat / Crew Report</div><div>สำหรับคนเรือ</div></div>
      <div class="right">Booking: ${b.bookingCode}<br>วันที่: ${b.travelDate || "-"}<br>จำนวน: ${b.passengers.length} คน</div>
    </div>
    <table class="print-table">
      <tr><th>#</th><th>ชื่อ</th><th>จุดหมาย</th><th>Program</th><th>Fin</th><th>หน้ากาก</th><th>ชูชีพ</th><th>เต็นท์</th><th>หมายเหตุ</th></tr>
      ${b.passengers.map((p, i) => `
        <tr>
          <td>${i + 1}</td><td>${fullName(p) || "-"}</td><td>${p.island || "ไม่ระบุ"}</td><td>${p.program.name}</td>
          <td class="center">${qtyIsland(p, "fin") || "-"}</td>
          <td class="center">${qtyIsland(p, "mask") || "-"}</td>
          <td class="center">${qtyIsland(p, "life_jacket") || "-"}</td>
          <td class="center">${tentQty(p) || "-"}</td>
          <td>แพ้อาหาร: ${p.foodAllergy || "-"}<br>สุขภาพ: ${p.medicalNote || "-"}</td>
        </tr>
      `).join("")}
    </table>
    <h3>สรุปอุปกรณ์</h3>
    <table class="print-table">
      <tr><th>Fin</th><td>${total.fin}</td></tr>
      <tr><th>หน้ากากดำน้ำ</th><td>${total.mask}</td></tr>
      <tr><th>ชูชีพ</th><td>${total.life_jacket}</td></tr>
      <tr><th>เต็นท์</th><td>${total.tent}</td></tr>
    </table>
  `;
  window.print();
}


function normalizedPassengerName(p) {
  return [p.title, p.firstName, p.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function validateNoDuplicatePassengersForDate(date, extraBooking = null) {
  let data = getBookings().filter(b => b.travelDate === date && b.status === "checked-in");

  // กรณี user กำลัง print จากหน้า booking ที่ยังไม่ได้ save ล่าสุด
  if (extraBooking && extraBooking.status === "checked-in" && extraBooking.travelDate === date) {
    data = data.filter(b => b.bookingCode !== extraBooking.bookingCode);
    data.push(extraBooking);
  }

  const seen = {};
  const duplicates = [];

  data.forEach(b => {
    (b.passengers || []).forEach(p => {
      const key = normalizedPassengerName(p);
      if (!key) return;

      const displayName = [p.title, p.firstName, p.lastName].filter(Boolean).join(" ");

      if (!seen[key]) {
        seen[key] = [];
      }

      seen[key].push({
        bookingCode: b.bookingCode,
        name: displayName
      });
    });
  });

  Object.values(seen).forEach(records => {
    if (records.length > 1) {
      duplicates.push(records);
    }
  });

  if (duplicates.length > 0) {
    const detail = duplicates.map(group => {
      const name = group[0].name;
      const bookings = group.map(x => x.bookingCode).join(", ");
      return `- ${name} พบซ้ำใน Booking: ${bookings}`;
    }).join("\\n");

    alert(
      "ไม่สามารถออก Report ได้ เพราะพบชื่อผู้เดินทางซ้ำในวันเดียวกัน\\n\\n" +
      detail +
      "\\n\\nกรุณาตรวจสอบ/แก้ไขชื่อ หรือสถานะ Booking ก่อนออก Report"
    );

    return false;
  }

  return true;
}

function validateBookingBeforeOperationalReport(b) {
  if (!canPrintOperationalReport(b)) return false;

  if (!b.travelDate) {
    alert("Booking นี้ยังไม่มีวันเดินทาง");
    return false;
  }

  return validateNoDuplicatePassengersForDate(b.travelDate, b);
}


function getDailyBookings() {
  const date = document.getElementById("printDateFilter").value;
  if (!date) {
    alert("กรุณาเลือกวันที่ก่อน");
    return [];
  }
  return getBookings().filter(b => b.travelDate === date);
}

function getDailyCheckedInBookings() {
  const date = document.getElementById("printDateFilter").value;
  if (!date) {
    alert("กรุณาเลือกวันที่ก่อน");
    return [];
  }
  return getBookings().filter(b => b.travelDate === date && b.status === "checked-in");
}

function alertIfNoCheckedIn(data) {
  if (!data.length) {
    alert("ไม่พบ Booking สถานะ checked-in ในวันที่เลือก\n\nหมายเหตุ: Daily Report จะออกเฉพาะ Booking ที่ checked-in เท่านั้น");
    return true;
  }
  return false;
}

function printDailyCounterReport() {
  if (!requireReportPermission('printDailyReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Daily Report')) return;
  const data = getDailyCheckedInBookings();
  if (alertIfNoCheckedIn(data)) return;
  if (!validateNoDuplicatePassengersForDate(document.getElementById("printDateFilter").value)) return;
  setPrintDoc("dailyReportDoc");
  document.getElementById("dailyReportDoc").innerHTML = `
    <div class="print-header"><div><div class="print-title">Daily Counter Report</div></div><div class="right">วันที่: ${document.getElementById("printDateFilter").value}</div></div>
    <table class="print-table">
      <tr><th>Booking</th><th>หัวหน้าทริป</th><th>โทร</th><th>จำนวนคน</th><th>Program</th><th class="right">ยอด</th><th>หมายเหตุ</th></tr>
      ${data.map(b => `<tr><td>${b.bookingCode}</td><td>${[b.leaderTitle,b.leaderFirstName,b.leaderLastName].filter(Boolean).join(" ")}</td><td>${b.phone||"-"}</td><td>${b.passengers.length}</td><td>${b.passengers.map(p=>p.program.name).join(", ")}</td><td class="right">${money(b.totalAmount)}</td><td>${b.bookingNote||"-"}</td></tr>`).join("")}
    </table>`;
  window.print();
}

function printDailyBoatReport() {
  if (!requireReportPermission('printDailyReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Daily Report')) return;
  const data = getDailyCheckedInBookings();
  if (alertIfNoCheckedIn(data)) return;
  if (!validateNoDuplicatePassengersForDate(document.getElementById("printDateFilter").value)) return;
  setPrintDoc("dailyReportDoc");

  let rows = "", total = { fin: 0, mask: 0, life_jacket: 0, tent: 0 };
  data.forEach(b => b.passengers.forEach(p => {
    total.fin += qtyIsland(p, "fin");
    total.mask += qtyIsland(p, "mask");
    total.life_jacket += qtyIsland(p, "life_jacket");
    total.tent += tentQty(p);
    rows += `<tr><td>${b.bookingCode}</td><td>${fullName(p)}</td><td>${p.island||"ไม่ระบุ"}</td><td>${p.program.name}</td><td class="center">${qtyIsland(p,"fin")||"-"}</td><td class="center">${qtyIsland(p,"mask")||"-"}</td><td class="center">${qtyIsland(p,"life_jacket")||"-"}</td><td class="center">${tentQty(p)||"-"}</td><td>${p.medicalNote||"-"}</td></tr>`;
  }));

  document.getElementById("dailyReportDoc").innerHTML = `
    <div class="print-header"><div><div class="print-title">Daily Boat Report</div></div><div class="right">วันที่: ${document.getElementById("printDateFilter").value}</div></div>
    <table class="print-table"><tr><th>Booking</th><th>ชื่อ</th><th>จุดหมาย</th><th>Program</th><th>Fin</th><th>หน้ากาก</th><th>ชูชีพ</th><th>เต็นท์</th><th>หมายเหตุ</th></tr>${rows}</table>
    <h3>สรุปอุปกรณ์รวม</h3>
    <table class="print-table"><tr><th>Fin</th><td>${total.fin}</td></tr><tr><th>หน้ากาก</th><td>${total.mask}</td></tr><tr><th>ชูชีพ</th><td>${total.life_jacket}</td></tr><tr><th>เต็นท์</th><td>${total.tent}</td></tr></table>`;
  window.print();
}

function printDailyDriverReport() {
  if (!requireReportPermission('printDailyReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Daily Report')) return;
  const data = getDailyCheckedInBookings();
  if (alertIfNoCheckedIn(data)) return;
  if (!validateNoDuplicatePassengersForDate(document.getElementById("printDateFilter").value)) return;
  setPrintDoc("dailyReportDoc");
  document.getElementById("dailyReportDoc").innerHTML = `
    <div class="print-header"><div><div class="print-title">Daily Driver Report</div></div><div class="right">วันที่: ${document.getElementById("printDateFilter").value}</div></div>
    <table class="print-table"><tr><th>Booking</th><th>หัวหน้าทริป</th><th>โทร</th><th>จำนวน</th><th>จุดหมาย</th></tr>
    ${data.map(b => `<tr><td>${b.bookingCode}</td><td>${[b.leaderTitle,b.leaderFirstName,b.leaderLastName].filter(Boolean).join(" ")}</td><td>${b.phone||"-"}</td><td>${b.passengers.length}</td><td>${[...new Set(b.passengers.map(p=>p.island||"ไม่ระบุ"))].join(", ")}</td></tr>`).join("")}</table>`;
  window.print();
}

function printDailyInsuranceReport() {
  if (!requireReportPermission('printDailyReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Daily Report')) return;
  const data = getDailyCheckedInBookings();
  if (alertIfNoCheckedIn(data)) return;
  if (!validateNoDuplicatePassengersForDate(document.getElementById("printDateFilter").value)) return;
  setPrintDoc("dailyReportDoc");
  let rows = "";
  data.forEach(b => b.passengers.forEach(p => {
    rows += `<tr><td>${b.bookingCode}</td><td>${p.title||"-"}</td><td>${p.firstName||"-"}</td><td>${p.lastName||"-"}</td><td>${p.age||"-"}</td></tr>`;
  }));
  document.getElementById("dailyReportDoc").innerHTML = `
    <div class="print-header"><div><div class="print-title">Daily Insurance Passenger List</div></div><div class="right">วันที่: ${document.getElementById("printDateFilter").value}</div></div>
    <table class="print-table"><tr><th>Booking</th><th>คำนำหน้า</th><th>ชื่อ</th><th>นามสกุล</th><th>อายุ</th></tr>${rows}</table>`;
  window.print();
}

function printDailyManagementReport() {
  if (!requireReportPermission('printDailyReport', 'Role นี้ไม่มีสิทธิ์พิมพ์ Daily Report')) return;
  const data = getDailyCheckedInBookings();
  if (alertIfNoCheckedIn(data)) return;
  if (!validateNoDuplicatePassengersForDate(document.getElementById("printDateFilter").value)) return;
  setPrintDoc("dailyReportDoc");

  const totalBooking = data.length;
  const totalPax = data.reduce((s,b)=>s+b.passengers.length,0);
  const programRevenue = data.reduce((s,b)=>s+Number(b.programRevenue||0),0);
  const preAddOnRevenue = data.reduce((s,b)=>s+Number(b.preAddOnRevenue||0),0);
  const islandAddOnRevenue = data.reduce((s,b)=>s+Number(b.islandAddOnRevenue||0),0);
  const totalRevenue = data.reduce((s,b)=>s+Number(b.totalAmount||0),0);

  const sourceMap = {}, programMap = {};
  data.forEach(b => {
    sourceMap[b.source || "ไม่ระบุ"] = (sourceMap[b.source || "ไม่ระบุ"] || 0) + 1;
    b.passengers.forEach(p => programMap[p.program.name] = (programMap[p.program.name] || 0) + 1);
  });

  document.getElementById("dailyReportDoc").innerHTML = `
    <div class="print-header"><div><div class="print-title">Daily Management Report</div></div><div class="right">วันที่: ${document.getElementById("printDateFilter").value}</div></div>
    <table class="print-table">
      <tr><th>จำนวน Booking</th><td>${totalBooking}</td></tr>
      <tr><th>จำนวนลูกค้า</th><td>${totalPax}</td></tr>
      <tr><th>รายได้ Program</th><td>${money(programRevenue)} บาท</td></tr>
      <tr><th>รายได้ Add-on ก่อนเดินทาง</th><td>${money(preAddOnRevenue)} บาท</td></tr>
      <tr><th>รายได้ซื้อบนเกาะ</th><td>${money(islandAddOnRevenue)} บาท</td></tr>
      <tr><th>รายได้รวม</th><td><strong>${money(totalRevenue)} บาท</strong></td></tr>
    </table>
    <h3>ช่องทางลูกค้า</h3>
    <table class="print-table">${Object.entries(sourceMap).map(([k,v])=>`<tr><th>${k}</th><td>${v} Booking</td></tr>`).join("")}</table>
    <h3>ยอดขายแยก Program</h3>
    <table class="print-table">${Object.entries(programMap).map(([k,v])=>`<tr><th>${k}</th><td>${v} คน</td></tr>`).join("")}</table>`;
  window.print();
}
