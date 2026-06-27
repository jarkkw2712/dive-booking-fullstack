function requireSystemAdmin() {
  if (typeof requirePermission === "function") {
    return requirePermission("systemAdmin", "Role นี้ไม่มีสิทธิ์ใช้ System Admin");
  }
  return true;
}

async function getAllStorageData() {
  return {
    exportedAt: new Date().toISOString(),
    appVersion: "dive-booking-v2-11-phase1",
    bookings: (typeof DataService !== "undefined" ? await DataService.listBookings() : JSON.parse(localStorage.getItem("bookings") || "[]")),
    audit_logs: JSON.parse(localStorage.getItem("audit_logs") || "[]"),
    master_data: JSON.parse(localStorage.getItem("master_data") || "null"),
    role_permissions: JSON.parse(localStorage.getItem("role_permissions") || "null"),
    current_role: localStorage.getItem("current_role")
  };
}

async function exportBackup() {
  if (!requireSystemAdmin()) return;
  const data = await getAllStorageData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `dive-booking-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  if (typeof writeAudit === "function") writeAudit("EXPORT_BACKUP", "Export backup JSON");
}

function importBackup(event) {
  if (!requireSystemAdmin()) return;
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm("Import backup จะเขียนทับข้อมูลในเครื่องนี้ ต้องการทำต่อไหม?")) {
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.bookings) localStorage.setItem("bookings", JSON.stringify(data.bookings));
      if (data.audit_logs) localStorage.setItem("audit_logs", JSON.stringify(data.audit_logs));
      if (data.master_data) localStorage.setItem("master_data", JSON.stringify(data.master_data));
      if (data.role_permissions) localStorage.setItem("role_permissions", JSON.stringify(data.role_permissions));
      alert("Import backup สำเร็จ");
      location.reload();
    } catch (err) {
      alert("ไฟล์ backup ไม่ถูกต้อง");
    }
  };
  reader.readAsText(file);
}

function resetStorageKey(key) {
  if (!requireSystemAdmin()) return;
  const labelMap = {
    bookings: "Bookings",
    audit_logs: "Audit Logs",
    master_data: "Master Data",
    role_permissions: "Permissions",
    current_user: "Current Login Session"
  };

  if (!confirm(`ต้องการล้าง ${labelMap[key] || key} ใช่ไหม?`)) return;
  localStorage.removeItem(key);
  if (key === "current_user") localStorage.removeItem("current_role");
  alert(`ล้าง ${labelMap[key] || key} แล้ว`);
  location.reload();
}

function factoryReset() {
  if (!requireSystemAdmin()) return;
  if (!confirm("Factory Reset จะล้างข้อมูลทั้งหมด ต้องการทำต่อไหม?")) return;
  if (!confirm("ยืนยันอีกครั้ง: ข้อมูลทั้งหมดจะถูกล้าง")) return;
  localStorage.clear();
  alert("Factory Reset แล้ว");
  location.reload();
}

function flattenPassengers(bookings) {
  const rows = [];
  bookings.forEach(b => {
    (b.passengers || []).forEach((p, i) => {
      rows.push({
        bookingCode: b.bookingCode,
        travelDate: b.travelDate,
        status: b.status,
        passengerNo: i + 1,
        title: p.title,
        firstName: p.firstName,
        lastName: p.lastName,
        age: p.age,
        phone: p.phone,
        island: p.island,
        program: p.program?.name,
        total: typeof getPersonTotal === "function" ? getPersonTotal(p) : ""
      });
    });
  });
  return rows;
}

function flattenAddOns(bookings) {
  const rows = [];
  bookings.forEach(b => {
    (b.passengers || []).forEach(p => {
      (p.preAddOns || []).filter(a => a.selected).forEach(a => {
        rows.push({
          bookingCode: b.bookingCode,
          travelDate: b.travelDate,
          status: b.status,
          passenger: [p.title, p.firstName, p.lastName].filter(Boolean).join(" "),
          source: "pre",
          addon: typeof addOnName === "function" ? addOnName(a) : a.name,
          qty: a.qty,
          price: a.price,
          total: Number(a.qty || 0) * Number(a.price || 0)
        });
      });

      (p.islandAddOns || []).forEach(a => {
        rows.push({
          bookingCode: b.bookingCode,
          travelDate: b.travelDate,
          status: b.status,
          passenger: [p.title, p.firstName, p.lastName].filter(Boolean).join(" "),
          source: "island",
          addon: a.name,
          qty: a.qty,
          price: a.price,
          total: Number(a.qty || 0) * Number(a.price || 0),
          paymentMethod: a.paymentMethod,
          receivedBy: a.receivedBy
        });
      });
    });
  });
  return rows;
}

function renderDataTables() {
  if (!document.getElementById("dataTableRoot")) return;
  showDataTable("bookings");
}

function showDataTable(type) {
  if (!requireSystemAdmin()) return;
  const bookings = JSON.parse(localStorage.getItem("bookings") || "[]");
  let rows = [];

  if (type === "bookings") {
    rows = bookings.map(b => ({
      bookingCode: b.bookingCode,
      travelDate: b.travelDate,
      returnDate: b.returnDate,
      status: b.status,
      leader: [b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" "),
      phone: b.phone,
      source: b.source,
      pax: b.passengers?.length || 0,
      totalAmount: b.totalAmount,
      paymentMethod: b.paymentMethod
    }));
  }

  if (type === "passengers") rows = flattenPassengers(bookings);
  if (type === "addons") rows = flattenAddOns(bookings);
  if (type === "audit_logs") rows = JSON.parse(localStorage.getItem("audit_logs") || "[]");
  if (type === "master_data") rows = [JSON.parse(localStorage.getItem("master_data") || "null") || {}];
  if (type === "role_permissions") rows = [JSON.parse(localStorage.getItem("role_permissions") || "null") || {}];

  document.getElementById("dataTableInfo").innerText = `${type}: ${rows.length} rows`;
  document.getElementById("dataTableRoot").innerHTML = buildHtmlTable(rows);
}

function buildHtmlTable(rows) {
  if (!rows.length) return "<p class='muted'>ไม่มีข้อมูล</p>";
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  return `
    <table class="data-table">
      <thead><tr>${keys.map(k => `<th>${k}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${keys.map(k => {
              const val = row[k];
              const text = typeof val === "object" ? JSON.stringify(val, null, 2) : (val ?? "");
              return `<td class="code-cell">${text}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}


async function testSupabaseConnection() {
  try {
    if (typeof DataService === "undefined") {
      alert("ไม่พบ DataService");
      return;
    }
    const result = await DataService.testConnection();
    console.log("Supabase connection test:", result);
    alert("ผล Test Supabase อยู่ใน Console แล้ว\n\n" + JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
    alert("Test Supabase ไม่สำเร็จ: " + error.message);
  }
}
