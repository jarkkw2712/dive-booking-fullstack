// =========================================================
// Sprint 1.5 - User Management + Permission Matrix
// =========================================================

let userRows = [];
let roleRows = [];
let permissionMatrixData = {};
const PERMISSION_LABELS_PRO = {
  createBooking: "สร้าง Booking",
  editBooking: "แก้ไข Booking",
  cancelBooking: "ยกเลิก Booking",
  editMasterData: "แก้ Master Data",
  editPermissions: "กำหนด Permission",
  systemAdmin: "System Admin",
  addIslandAddOn: "ซื้อเพิ่มบนเกาะ",
  printReceipt: "พิมพ์ Receipt",
  printCounterReport: "Counter Report",
  printBoatReport: "Boat Report",
  printDailyReport: "Daily Report",
  viewAudit: "ดู Audit",
  viewMoney: "เห็นยอดเงิน",
  manageUsers: "จัดการ Users"
};

async function loadRolesForUserEditor() {
  roleRows = await DataService.listRoles();
  const sel = document.getElementById("userRole");
  if (!sel) return;
  sel.innerHTML = roleRows.map(r => `<option value="${r.role_id}">${r.role_name || r.role_id}</option>`).join("");
}

async function loadUsers() {
  try {
    await loadRolesForUserEditor();
    userRows = await DataService.listUsers();
    renderUsers();
  } catch (error) {
    document.getElementById("userListRoot").innerHTML = `<div class="setting-status-error">โหลด Users ไม่สำเร็จ: ${error.message}</div>`;
  }
}

function renderUsers() {
  const root = document.getElementById("userListRoot");
  if (!root) return;

  if (!userRows.length) {
    root.innerHTML = `<p class="muted">ยังไม่มี User</p>`;
    return;
  }

  root.innerHTML = `
    <table class="master-data-table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Display Name</th>
          <th>Role</th>
          <th>Active</th>
          <th>Created</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${userRows.map(u => `
          <tr>
            <td>${u.username}</td>
            <td>${u.display_name}</td>
            <td><span class="user-role-badge">${u.role_id}</span></td>
            <td>${u.active_flag ? `<span class="status-active">ใช้งาน</span>` : `<span class="status-inactive">ปิด</span>`}</td>
            <td>${u.created_at || ""}</td>
            <td><button class="btn btn-soft" onclick='editUser(${JSON.stringify(u).replace(/'/g, "&apos;")})'>Edit</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function openUserEditor() {
  await loadRolesForUserEditor();
  document.getElementById("userEditor").classList.remove("hidden");
  document.getElementById("userEditorTitle").innerText = "เพิ่ม User";
  document.getElementById("userEditingId").value = "";
  document.getElementById("userUsername").value = "";
  document.getElementById("userDisplayName").value = "";
  document.getElementById("userActive").value = "true";
}

function closeUserEditor() {
  document.getElementById("userEditor").classList.add("hidden");
}

async function editUser(user) {
  await loadRolesForUserEditor();
  document.getElementById("userEditor").classList.remove("hidden");
  document.getElementById("userEditorTitle").innerText = "แก้ไข User";
  document.getElementById("userEditingId").value = user.user_id;
  document.getElementById("userUsername").value = user.username;
  document.getElementById("userDisplayName").value = user.display_name;
  document.getElementById("userRole").value = user.role_id;
  document.getElementById("userActive").value = user.active_flag ? "true" : "false";
}

async function saveUser() {
  const userId = document.getElementById("userEditingId").value;
  const payload = {
    username: document.getElementById("userUsername").value.trim(),
    display_name: document.getElementById("userDisplayName").value.trim(),
    role_id: document.getElementById("userRole").value,
    active_flag: document.getElementById("userActive").value === "true"
  };

  if (!payload.username || !payload.display_name) {
    alert("กรุณากรอก username และ display name");
    return;
  }

  try {
    if (userId) {
      await DataService.updateUser(userId, payload);
    } else {
      await DataService.saveUser(payload);
    }
    alert("บันทึก User แล้ว");
    closeUserEditor();
    await loadUsers();
  } catch (error) {
    alert("บันทึก User ไม่สำเร็จ: " + error.message);
  }
}

async function loadPermissionMatrixPro() {
  try {
    roleRows = await DataService.listRoles();
    permissionMatrixData = await DataService.getPermissionMatrix();
    renderPermissionMatrixPro();
  } catch (error) {
    document.getElementById("permissionMatrixProRoot").innerHTML = `<div class="setting-status-error">โหลด Permission ไม่สำเร็จ: ${error.message}</div>`;
  }
}

function allPermissionKeys() {
  const fromData = new Set();
  Object.values(permissionMatrixData || {}).forEach(rolePerms => {
    Object.keys(rolePerms || {}).forEach(k => fromData.add(k));
  });
  Object.keys(PERMISSION_LABELS_PRO).forEach(k => fromData.add(k));
  return Array.from(fromData);
}

function renderPermissionMatrixPro() {
  const root = document.getElementById("permissionMatrixProRoot");
  const keys = allPermissionKeys();

  root.innerHTML = `
    <table class="permission-matrix">
      <thead>
        <tr>
          <th>Permission</th>
          ${roleRows.map(r => `<th>${r.role_name || r.role_id}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${keys.map(key => `
          <tr>
            <td>${PERMISSION_LABELS_PRO[key] || key}<br><span class="muted">${key}</span></td>
            ${roleRows.map(role => `
              <td>
                <input
                  type="checkbox"
                  id="permpro_${role.role_id}_${key}"
                  ${permissionMatrixData?.[role.role_id]?.[key] ? "checked" : ""}
                  ${role.role_id === "admin" && key === "editPermissions" ? "disabled" : ""}
                >
              </td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function savePermissionMatrixPro() {
  const keys = allPermissionKeys();
  const matrix = {};

  roleRows.forEach(role => {
    matrix[role.role_id] = {};
    keys.forEach(key => {
      const el = document.getElementById(`permpro_${role.role_id}_${key}`);
      matrix[role.role_id][key] = !!el?.checked;
    });
  });

  // กันล็อกตัวเอง
  if (!matrix.admin) matrix.admin = {};
  matrix.admin.editPermissions = true;
  matrix.admin.manageUsers = true;
  matrix.admin.editMasterData = true;

  try {
    await DataService.savePermissionMatrix(matrix);
    alert("บันทึก Permission Matrix แล้ว");
    await loadPermissionMatrixPro();
  } catch (error) {
    alert("บันทึก Permission ไม่สำเร็จ: " + error.message);
  }
}

const originalShowPageUserPerm = window.showPage;
if (typeof originalShowPageUserPerm === "function") {
  window.showPage = function(id) {
    originalShowPageUserPerm(id);
    if (id === "userManagementPage") loadUsers();
    if (id === "permissionMatrixPage") loadPermissionMatrixPro();
  };
}
