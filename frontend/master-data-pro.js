// =========================================================
// Sprint 1.4 - Master Data Pro
// =========================================================

let currentMasterCategory = "programs";
let currentMasterRows = [];

const MASTER_CATEGORY_LABEL = {
  programs: "Programs",
  addons: "Add-ons",
  agents: "Agents",
  boats: "Boats",
  islands: "Islands",
  price_reasons: "Price Reasons",
  payment_methods: "Payment Methods",
  statuses: "Statuses"
};

async function loadMasterDataPro(category) {
  currentMasterCategory = category;
  document.getElementById("mdpTitle").innerText = MASTER_CATEGORY_LABEL[category] || category;
  closeMasterDataEditor();

  try {
    currentMasterRows = await DataService.listMasterDataPro(category);
    renderMasterDataProTable();
  } catch (error) {
    document.getElementById("masterDataProRoot").innerHTML =
      `<div class="setting-status-error">โหลดไม่สำเร็จ: ${error.message}</div>`;
  }
}

function refreshCurrentMasterDataPro() {
  loadMasterDataPro(currentMasterCategory);
}

function masterRowId(row) {
  return row.id || row.program_id || row.addon_id || row.agent_id || row.boat_id || row.island_id || row.reason_id || row.method_id || row.status_id;
}

function masterRowName(row) {
  return row.name || row.program_name || row.addon_name || row.agent_name || row.boat_name || row.island_name || row.reason_name || row.method_name || row.status_name;
}

function masterRowPrice(row) {
  return row.default_price ?? row.price ?? "";
}

function renderMasterDataProTable() {
  const root = document.getElementById("masterDataProRoot");
  if (!root) return;

  if (!currentMasterRows.length) {
    root.innerHTML = `<p class="muted">ยังไม่มีข้อมูล</p>`;
    return;
  }

  root.innerHTML = `
    <table class="master-data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>ชื่อ</th>
          <th>ราคา</th>
          <th>Sort</th>
          <th>Active</th>
          <th>หมายเหตุ</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${currentMasterRows.map(row => `
          <tr>
            <td>${masterRowId(row) || ""}</td>
            <td>${masterRowName(row) || ""}</td>
            <td>${masterRowPrice(row) || ""}</td>
            <td>${row.sort_order ?? ""}</td>
            <td>${row.active_flag === false ? `<span class="status-inactive">ปิด</span>` : `<span class="status-active">ใช้งาน</span>`}</td>
            <td>${row.description || ""}</td>
            <td><button class="btn btn-soft" onclick='editMasterDataProItem(${JSON.stringify(row).replace(/'/g, "&apos;")})'>Edit</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function openMasterDataEditor() {
  document.getElementById("masterDataEditor").classList.remove("hidden");
  document.getElementById("masterEditorTitle").innerText = `เพิ่ม ${MASTER_CATEGORY_LABEL[currentMasterCategory]}`;
  document.getElementById("mdpEditingId").value = "";
  document.getElementById("mdpCode").value = "";
  document.getElementById("mdpName").value = "";
  document.getElementById("mdpPrice").value = "0";
  document.getElementById("mdpSort").value = "0";
  document.getElementById("mdpDescription").value = "";
  document.getElementById("mdpActive").value = "true";
}

function closeMasterDataEditor() {
  const el = document.getElementById("masterDataEditor");
  if (el) el.classList.add("hidden");
}

function editMasterDataProItem(row) {
  document.getElementById("masterDataEditor").classList.remove("hidden");
  document.getElementById("masterEditorTitle").innerText = `แก้ไข ${MASTER_CATEGORY_LABEL[currentMasterCategory]}`;
  document.getElementById("mdpEditingId").value = masterRowId(row);
  document.getElementById("mdpCode").value = masterRowId(row);
  document.getElementById("mdpName").value = masterRowName(row);
  document.getElementById("mdpPrice").value = masterRowPrice(row) || 0;
  document.getElementById("mdpSort").value = row.sort_order || 0;
  document.getElementById("mdpDescription").value = row.description || "";
  document.getElementById("mdpActive").value = row.active_flag === false ? "false" : "true";
}

function buildMasterItemPayload() {
  return {
    code: document.getElementById("mdpCode").value.trim(),
    name: document.getElementById("mdpName").value.trim(),
    default_price: Number(document.getElementById("mdpPrice").value || 0),
    sort_order: Number(document.getElementById("mdpSort").value || 0),
    description: document.getElementById("mdpDescription").value,
    active_flag: document.getElementById("mdpActive").value === "true"
  };
}

async function saveMasterDataProItem() {
  const id = document.getElementById("mdpEditingId").value;
  const payload = buildMasterItemPayload();

  if (!payload.code || !payload.name) {
    alert("กรุณากรอก ID และชื่อ");
    return;
  }

  try {
    if (id) {
      await DataService.updateMasterDataProItem(currentMasterCategory, id, payload);
    } else {
      await DataService.saveMasterDataProItem(currentMasterCategory, payload);
    }

    alert("บันทึก Master Data แล้ว");
    closeMasterDataEditor();
    await loadMasterDataPro(currentMasterCategory);

    // reload old master data cache so booking form sees latest program/addon
    if (typeof loadMasterData === "function") {
      try { await loadMasterData(); } catch(e) {}
    }
  } catch (error) {
    alert("บันทึกไม่สำเร็จ: " + error.message);
  }
}

const originalShowPageMasterPro = window.showPage;
if (typeof originalShowPageMasterPro === "function") {
  window.showPage = function(id) {
    originalShowPageMasterPro(id);
    if (id === "masterDataProPage") {
      loadMasterDataPro(currentMasterCategory);
    }
  };
}
