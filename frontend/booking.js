const priceReasons = [
  "ราคา Default",
  "ผู้บริหารอนุมัติ",
  "Agent ราคาพิเศษ",
  "โปรโมชัน",
  "ลูกค้าเก่า",
  "เด็ก / ผู้สูงอายุ",
  "Compensate ลูกค้า",
  "ซื้อเพิ่มบนเกาะ",
  "อื่นๆ"
];



const AUTH_USERS = [
  { username: "admin", password: "1234", role: "admin", displayName: "Admin Owner" },
  { username: "counter", password: "1234", role: "counter", displayName: "Counter Staff" },
  { username: "island", password: "1234", role: "island_staff", displayName: "Island Staff" },
  { username: "boat", password: "1234", role: "boat_crew", displayName: "Boat Crew" },
  { username: "manager", password: "1234", role: "management", displayName: "Management" }
];

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("current_user") || "null");
}

async function login() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const error = document.getElementById("loginError");

  try {
    const user = await AuthService.login(username, password);
    writeAuthAudit("LOGIN", `${user.displayName} login`);
    await loadRolePermissionsFromDataService();
    applyAuthUI();
    applyRoleUI();
  } catch (err) {
    error.innerText = err.message || "Login ไม่สำเร็จ";
    error.style.display = "block";
  }
}

async function logout() {
  const user = getCurrentUser();
  if (user) writeAuthAudit("LOGOUT", `${user.displayName} logout`);
  await AuthService.logout();
  applyAuthUI();
}

function applyAuthUI() {
  const user = getCurrentUser();
  const loginScreen = document.getElementById("loginScreen");
  const userBox = document.getElementById("userBox");

  if (!user) {
    document.body.classList.add("locked");
    if (loginScreen) loginScreen.style.display = "flex";
    if (userBox) userBox.innerHTML = "";
    return;
  }

  document.body.classList.remove("locked");
  if (loginScreen) loginScreen.style.display = "none";
  if (userBox) {
    userBox.innerHTML = `
      <strong>${user.displayName}</strong><br>
      Username: ${user.username}<br>
      Role: ${rolePermissionsFor(user.role)?.label || user.role}
    `;
  }
}

function writeAuthAudit(action, detail) {
  const logs = JSON.parse(localStorage.getItem("audit_logs") || "[]");
  logs.push({
    id: "AUDIT" + Date.now(),
    bookingCode: "SYSTEM",
    action,
    detail,
    changedByRole: getCurrentUser()?.role || "-",
    changedByRoleName: getCurrentUser()?.displayName || "-",
    changedAt: new Date().toISOString()
  });
  localStorage.setItem("audit_logs", JSON.stringify(logs));
}


const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    label: "Admin / Owner",
    createBooking: true,
    editBooking: true,
    cancelBooking: true,
    editMasterData: true,
    editPermissions: true,
    systemAdmin: true,
    addIslandAddOn: true,
    printReceipt: true,
    printCounterReport: true,
    printBoatReport: true,
    printDailyReport: true,
    viewAudit: true,
    viewMoney: true
  },
  counter: {
    label: "Counter",
    createBooking: true,
    editBooking: true,
    cancelBooking: false,
    editMasterData: false,
    editPermissions: false,
    systemAdmin: false,
    addIslandAddOn: false,
    printReceipt: true,
    printCounterReport: true,
    printBoatReport: false,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: true
  },
  island_staff: {
    label: "Island Staff",
    createBooking: false,
    editBooking: true,
    cancelBooking: false,
    editMasterData: false,
    editPermissions: false,
    systemAdmin: false,
    addIslandAddOn: true,
    printReceipt: false,
    printCounterReport: false,
    printBoatReport: false,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: true
  },
  boat_crew: {
    label: "Boat / Crew",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    editPermissions: false,
    systemAdmin: false,
    addIslandAddOn: false,
    printReceipt: false,
    printCounterReport: false,
    printBoatReport: true,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: false
  },
  management: {
    label: "Management",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    editPermissions: false,
    systemAdmin: false,
    addIslandAddOn: false,
    printReceipt: false,
    printCounterReport: true,
    printBoatReport: true,
    printDailyReport: true,
    viewAudit: true,
    viewMoney: true
  },
  guest: {
    label: "Guest",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    editPermissions: false,
    systemAdmin: false,
    addIslandAddOn: false,
    printReceipt: false,
    printCounterReport: false,
    printBoatReport: false,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: false
  }
};


async function loadRolePermissionsFromDataService() {
  if (typeof DataService === "undefined") return;

  try {
    const perms = await DataService.getRolePermissions();
    if (perms) {
      const current = deepClone(DEFAULT_ROLE_PERMISSIONS);

      Object.keys(perms).forEach(role => {
        if (!current[role]) current[role] = {};
        Object.keys(perms[role]).forEach(key => {
          if (key !== "label") current[role][key] = perms[role][key];
        });
      });

      localStorage.setItem("role_permissions", JSON.stringify(current));
    }
  } catch (error) {
    console.warn("Cannot load role permissions from DataService", error);
  }
}

function getRolePermissions() {
  const saved = localStorage.getItem("role_permissions");
  if (!saved) {
    localStorage.setItem("role_permissions", JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    return deepClone(DEFAULT_ROLE_PERMISSIONS);
  }

  const parsed = JSON.parse(saved);
  const merged = deepClone(DEFAULT_ROLE_PERMISSIONS);

  Object.keys(parsed).forEach(role => {
    merged[role] = { ...(merged[role] || {}), ...parsed[role] };
  });

  localStorage.setItem("role_permissions", JSON.stringify(merged));
  return merged;
}

function saveRolePermissions(data) {
  localStorage.setItem("role_permissions", JSON.stringify(data));
}

function rolePermissionsFor(role) {
  return getRolePermissions()[role] || getRolePermissions().guest;
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("current_user") || "null");
}

async function login() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const error = document.getElementById("loginError");

  try {
    const user = await AuthService.login(username, password);
    writeAuthAudit("LOGIN", `${user.displayName} login`);
    await loadRolePermissionsFromDataService();
    applyAuthUI();
    applyRoleUI();
  } catch (err) {
    error.innerText = err.message || "Login ไม่สำเร็จ";
    error.style.display = "block";
  }
}

async function logout() {
  const user = getCurrentUser();
  if (user) writeAuthAudit("LOGOUT", `${user.displayName} logout`);
  await AuthService.logout();
  applyAuthUI();
}

function applyAuthUI() {
  const user = getCurrentUser();
  const loginScreen = document.getElementById("loginScreen");
  const userBox = document.getElementById("userBox");

  if (!user) {
    document.body.classList.add("locked");
    if (loginScreen) loginScreen.style.display = "flex";
    if (userBox) userBox.innerHTML = "";
    return;
  }

  document.body.classList.remove("locked");
  if (loginScreen) loginScreen.style.display = "none";
  if (userBox) {
    userBox.innerHTML = `
      <strong>${user.displayName}</strong><br>
      Username: ${user.username}<br>
      Role: ${rolePermissionsFor(user.role)?.label || user.role}
    `;
  }
}

function writeAuthAudit(action, detail) {
  const logs = JSON.parse(localStorage.getItem("audit_logs") || "[]");
  logs.push({
    id: "AUDIT" + Date.now(),
    bookingCode: "SYSTEM",
    action,
    detail,
    changedByRole: getCurrentUser()?.role || "-",
    changedByRoleName: getCurrentUser()?.displayName || "-",
    changedAt: new Date().toISOString()
  });
  localStorage.setItem("audit_logs", JSON.stringify(logs));
}


const ROLE_PERMISSIONS = {
  admin: {
    label: "Admin / Owner",
    createBooking: true,
    editBooking: true,
    cancelBooking: true,
    editMasterData: true,
    addIslandAddOn: true,
    printReceipt: true,
    printCounterReport: true,
    printBoatReport: true,
    printDailyReport: true,
    viewAudit: true,
    viewMoney: true
  },
  counter: {
    label: "Counter",
    createBooking: true,
    editBooking: true,
    cancelBooking: false,
    editMasterData: false,
    addIslandAddOn: false,
    printReceipt: true,
    printCounterReport: true,
    printBoatReport: false,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: true
  },
  island_staff: {
    label: "Island Staff",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    addIslandAddOn: true,
    printReceipt: false,
    printCounterReport: false,
    printBoatReport: false,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: false
  },
  boat_crew: {
    label: "Boat / Crew",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    addIslandAddOn: false,
    printReceipt: false,
    printCounterReport: false,
    printBoatReport: true,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: false
  },
  management: {
    label: "Management",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    addIslandAddOn: false,
    printReceipt: false,
    printCounterReport: true,
    printBoatReport: true,
    printDailyReport: true,
    viewAudit: true,
    viewMoney: true
  },
  guest: {
    label: "Guest",
    createBooking: false,
    editBooking: false,
    cancelBooking: false,
    editMasterData: false,
    addIslandAddOn: false,
    printReceipt: false,
    printCounterReport: false,
    printBoatReport: false,
    printDailyReport: false,
    viewAudit: false,
    viewMoney: false
  }
};

function getCurrentRole() {
  return getCurrentUser()?.role || "guest";
}

function can(action) {
  const role = getCurrentRole();
  return !!rolePermissionsFor(role)?.[action];
}

function requirePermission(action, message = "คุณไม่มีสิทธิ์ทำรายการนี้") {
  if (!can(action)) {
    alert(message);
    return false;
  }
  return true;
}

function setCurrentRole(role) {
  alert("Role ถูกกำหนดจากบัญชี Login เท่านั้น ไม่สามารถเปลี่ยนเองได้");
}

function roleName() {
  return rolePermissionsFor(getCurrentRole())?.label || getCurrentRole();
}

function applyRoleUI() {
  const role = getCurrentRole();
  const hint = document.getElementById("roleHint");
  if (hint) {
    const p = rolePermissionsFor(role);
    hint.innerHTML = `กำลังใช้งานเป็น: <strong>${p.label}</strong><br>` +
      [
        p.createBooking ? "สร้าง Booking" : null,
        p.editBooking ? "แก้ไข Booking" : null,
        p.addIslandAddOn ? "เพิ่มซื้อบนเกาะ" : null,
        p.printDailyReport ? "Daily Report" : null,
        p.editMasterData ? "แก้ Master Data" : null,
        p.editPermissions ? "กำหนดสิทธิ์" : null
      ].filter(Boolean).join(" / ");
  }

  const saveNewBtn = document.getElementById("saveNewBtn");
  const saveEditBtn = document.getElementById("saveEditBtn");
  const cancelBtn = document.getElementById("cancelBookingBtn");

  if (saveNewBtn) saveNewBtn.classList.toggle("no-access", !can("createBooking"));
  if (saveEditBtn) saveEditBtn.classList.toggle("no-access", !can("editBooking"));
  if (cancelBtn) cancelBtn.classList.toggle("no-access", !can("cancelBooking"));

  const settingBtn = Array.from(document.querySelectorAll(".sidebar button")).find(b => b.textContent.includes("ตั้งค่า"));
  if (settingBtn) settingBtn.classList.toggle("no-access", !can("editMasterData"));

  const permBtn = Array.from(document.querySelectorAll(".sidebar button")).find(b => b.textContent.includes("กำหนดสิทธิ์"));
  if (permBtn) permBtn.classList.toggle("no-access", !can("editPermissions"));

  const systemBtn = Array.from(document.querySelectorAll(".sidebar button")).find(b => b.textContent.includes("System Admin"));
  if (systemBtn) systemBtn.classList.toggle("no-access", !can("systemAdmin"));
}


let bookingCache = [];
let passengers = [];
let currentBooking = null;
let editingBookingCode = null;
let islandTargetPassengerIndex = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function statusLabel(status) {
  const map = {
    pending: "Pending",
    confirmed: "Confirmed",
    "checked-in": "Checked-in",
    completed: "Completed",
    cancelled: "Cancelled"
  };
  return map[status] || status || "Unknown";
}

function statusClass(status) {
  const normalized = (status || "unknown").replace("_", "-");
  if (["pending", "confirmed", "checked-in", "completed", "cancelled"].includes(normalized)) {
    return `status-${normalized}`;
  }
  return "status-unknown";
}

function statusBadge(status) {
  return `<div class="status-badge ${statusClass(status)}">${statusLabel(status)}</div>`;
}

function money(n) {
  return Number(n || 0).toLocaleString("th-TH");
}

function fullName(p) {
  return [p.title, p.firstName, p.lastName].filter(Boolean).join(" ");
}


function addOnName(a) {
  return a.id === "other" && a.customName ? a.customName : a.name;
}

function leaderFullName() {
  return [
    document.getElementById("leaderTitle").value,
    document.getElementById("leaderFirstName").value,
    document.getElementById("leaderLastName").value
  ].filter(Boolean).join(" ");
}


async function loadBookingCache() {
  try {
    if (typeof DataService !== "undefined") {
      bookingCache = await DataService.listBookings();
    } else {
      bookingCache = JSON.parse(localStorage.getItem("bookings") || "[]");
    }
    return bookingCache;
  } catch (error) {
    console.error(error);
    alert("โหลดข้อมูล Booking ไม่สำเร็จ: " + error.message);
    bookingCache = JSON.parse(localStorage.getItem("bookings") || "[]");
    return bookingCache;
  }
}

async function persistNewBooking(booking) {
  if (typeof DataService !== "undefined") {
    return await DataService.saveBooking(booking);
  }
  const data = JSON.parse(localStorage.getItem("bookings") || "[]");
  data.push(booking);
  localStorage.setItem("bookings", JSON.stringify(data));
  return booking;
}

async function persistUpdatedBooking(bookingCode, booking) {
  if (typeof DataService !== "undefined") {
    return await DataService.updateBooking(bookingCode, booking);
  }
  const data = JSON.parse(localStorage.getItem("bookings") || "[]")
    .map(b => b.bookingCode === bookingCode ? booking : b);
  localStorage.setItem("bookings", JSON.stringify(data));
  return booking;
}

async function persistCancelBooking(bookingCode, reason) {
  if (typeof DataService !== "undefined") {
    return await DataService.cancelBooking(bookingCode, reason);
  }
  const data = JSON.parse(localStorage.getItem("bookings") || "[]")
    .map(b => b.bookingCode === bookingCode ? {
      ...b,
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date().toISOString()
    } : b);
  localStorage.setItem("bookings", JSON.stringify(data));
  return true;
}


function getBookings() {
  return bookingCache && bookingCache.length
    ? bookingCache
    : JSON.parse(localStorage.getItem("bookings") || "[]");
}

function setBookings(data) {
  bookingCache = data;
  localStorage.setItem("bookings", JSON.stringify(data));
}


function updateSaveMode() {
  const isEdit = !!editingBookingCode;
  const saveNewBtn = document.getElementById("saveNewBtn");
  const saveEditBtn = document.getElementById("saveEditBtn");
  const cancelBtn = document.getElementById("cancelBookingBtn");

  if (saveNewBtn) saveNewBtn.style.display = (!isEdit && can("createBooking")) ? "block" : "none";
  if (saveEditBtn) saveEditBtn.style.display = (isEdit && can("editBooking")) ? "block" : "none";
  if (cancelBtn) cancelBtn.style.display = (isEdit && can("cancelBooking")) ? "block" : "none";

  applyRoleUI();
}

function startNewBooking() {
  const hasData =
    passengers.length > 0 ||
    document.getElementById("leaderFirstName").value ||
    document.getElementById("leaderLastName").value ||
    document.getElementById("travelDate").value;

  if (hasData && !confirm("ต้องการเริ่ม Booking ใหม่ใช่ไหม? ข้อมูลบนหน้าฟอร์มปัจจุบันจะถูกล้าง แต่ Booking ที่เคยบันทึกไว้จะยังอยู่")) {
    return;
  }

  editingBookingCode = null;
  currentBooking = null;

  document.getElementById("tripType").value = "one_way";
  document.getElementById("travelDate").value = "";
  document.getElementById("returnDate").value = "";
  document.getElementById("leaderTitle").value = "";
  document.getElementById("leaderFirstName").value = "";
  document.getElementById("leaderLastName").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("paxCount").value = 1;
  document.getElementById("source").value = "ลูกค้าเก่า";
  document.getElementById("agentName").value = "";
  document.getElementById("status").value = "confirmed";
  document.getElementById("bookingNote").value = "";
  document.getElementById("paymentMethod").value = "เงินสด";
  document.getElementById("passengerText").value = "";

  const warning = document.getElementById("parseWarning");
  const success = document.getElementById("parseSuccess");
  if (warning) warning.style.display = "none";
  if (success) success.style.display = "none";

  toggleReturnDate();
  passengers = [createDefaultPassenger(0)];
  renderPassengers();
  refreshSummary();
  updateSaveMode();
}


function showPage(id) {
  if (id === "settingPage" && !requirePermission("editMasterData", "Role นี้ไม่มีสิทธิ์แก้ Master Data")) return;
  if (id === "permissionPage" && !requirePermission("editPermissions", "Role นี้ไม่มีสิทธิ์กำหนดสิทธิ์")) return;
  if (id === "systemPage" && !requirePermission("systemAdmin", "Role นี้ไม่มีสิทธิ์เข้า System Admin")) return;
  if (id === "bookingPage" && !can("createBooking") && !can("editBooking") && !can("addIslandAddOn")) {
    alert("Role นี้ไม่มีสิทธิ์เข้าแก้ไข Booking");
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (id === "managePage") {
    awaitLoadAndRenderManage();
  }
  if (id === "printPage") {
    awaitLoadAndRenderPrint();
  }
  if (id === "settingPage") renderMasterDataForm();
  if (id === "permissionPage") renderPermissionMatrix();
  if (id === "systemPage" && typeof renderDataTables === "function") renderDataTables();
}


async function awaitLoadAndRenderManage() {
  await loadBookingCache();
  renderManageBookings();
}

async function awaitLoadAndRenderPrint() {
  await loadBookingCache();
  renderPrintPage();
}


function toggleReturnDate() {
  const isRoundTrip = document.getElementById("tripType").value === "round_trip";
  const returnDate = document.getElementById("returnDate");
  returnDate.disabled = !isRoundTrip;
  if (!isRoundTrip) returnDate.value = "";
  refreshSummary();
}

function createDefaultPassenger(index = 0) {
  const md = getMasterData();
  const program = md.programs[0];

  return {
    title: index === 0 ? document.getElementById("leaderTitle").value : "",
    firstName: index === 0 ? document.getElementById("leaderFirstName").value : "",
    lastName: index === 0 ? document.getElementById("leaderLastName").value : "",
    age: "",
    phone: index === 0 ? document.getElementById("phone").value : "",
    island: "",
    medicalNote: "",
    foodAllergy: "",
    isLeader: index === 0,
    program: {
      programId: program.id,
      name: program.name,
      qty: 1,
      price: program.price,
      defaultPrice: program.price,
      priceReason: "ราคา Default",
      priceReasonOther: ""
    },

    // Pre Add-on ใช้ master เดียวกับ Island Add-on
    // แต่จะเปิดให้แก้ได้เฉพาะ Program = ตั๋วเรือ
    preAddOns: md.addOns.map(x => ({
      ...x,
      selected: false,
      qty: 1,
      price: x.defaultPrice,
      customName: "",
      priceReason: "ราคา Default",
      priceReasonOther: ""
    })),

    islandAddOns: []
  };
}

function generatePassengers() {
  syncPassengerCount();
}

function syncPassengerCount() {
  const target = Number(document.getElementById("paxCount").value || 1);
  const current = passengers.length;

  if (target < 1) {
    document.getElementById("paxCount").value = Math.max(current, 1);
    alert("จำนวนผู้เดินทางต้องไม่น้อยกว่า 1");
    return;
  }

  // ถ้ายังไม่มีผู้เดินทางเลย ให้สร้างใหม่
  if (current === 0) {
    passengers = [];
    for (let i = 0; i < target; i++) {
      passengers.push(createDefaultPassenger(i));
    }
    renderPassengers();
    refreshSummary();
    return;
  }

  // เพิ่มคน: ไม่ล้างข้อมูลเดิม แค่เพิ่มคนใหม่ต่อท้าย
  if (target > current) {
    for (let i = current; i < target; i++) {
      passengers.push(createDefaultPassenger(i));
    }
    renderPassengers();
    refreshSummary();
    return;
  }

  // ลดคน: ต้อง confirm และลบคนท้ายๆ
  if (target < current) {
    const removed = passengers
      .slice(target)
      .map((p, i) => `${target + i + 1}. ${fullName(p) || "ยังไม่กรอกชื่อ"}`)
      .join("\\n");

    const ok = confirm(
      `ตอนนี้มีผู้เดินทาง ${current} คน ต้องการลดเหลือ ${target} คนใช่ไหม?\\n\\nระบบจะลบคนท้ายๆ ต่อไปนี้:\\n${removed}`
    );

    if (!ok) {
      document.getElementById("paxCount").value = current;
      return;
    }

    passengers = passengers.slice(0, target);
    if (passengers[0]) passengers[0].isLeader = true;
    renderPassengers();
    refreshSummary();
    return;
  }

  // จำนวนเท่าเดิม ไม่ต้องทำอะไร
  renderPassengers();
  refreshSummary();
}

function syncLeader() {
  if (!passengers[0]) return;
  passengers[0].title = document.getElementById("leaderTitle").value;
  passengers[0].firstName = document.getElementById("leaderFirstName").value;
  passengers[0].lastName = document.getElementById("leaderLastName").value;
  passengers[0].phone = document.getElementById("phone").value;
  renderPassengers();
}

function parsePassengerText() {
  const text = document.getElementById("passengerText").value.trim();
  const warning = document.getElementById("parseWarning");
  const success = document.getElementById("parseSuccess");
  warning.style.display = "none";
  success.style.display = "none";

  if (!text) {
    warning.innerText = "⚠ กรุณาวางรายชื่อก่อน";
    warning.style.display = "block";
    return;
  }

  const lines = text.split("\n").map(x => x.trim()).filter(Boolean);
  const parsed = [];
  const errors = [];

  lines.forEach((line, index) => {
    const clean = line
      .replace(/^\d+[\.\)]\s*/, "")
      .replace(/^[-•]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

    const match = clean.match(/^(นาย|นาง|นางสาว|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s+(\S+)\s+(.+)$/);
    if (!match) {
      errors.push(`บรรทัดที่ ${index + 1}: "${line}"`);
      return;
    }

    let title = match[1];
    if (title === "ด.ช.") title = "เด็กชาย";
    if (title === "ด.ญ.") title = "เด็กหญิง";

    parsed.push({ title, firstName: match[2], lastName: match[3] });
  });

  if (errors.length) {
    warning.innerHTML = "⚠ Parse ไม่สำเร็จ กรุณาใช้ Format: 1. นาย ชื่อ นามสกุล<br><br>" + errors.join("<br>");
    warning.style.display = "block";
    return;
  }

  passengers = parsed.map((p, index) => {
    const passenger = createDefaultPassenger(index);
    passenger.title = p.title;
    passenger.firstName = p.firstName;
    passenger.lastName = p.lastName;
    passenger.isLeader = index === 0;
    passenger.phone = index === 0 ? document.getElementById("phone").value : "";
    return passenger;
  });

  document.getElementById("paxCount").value = passengers.length;
  document.getElementById("leaderTitle").value = passengers[0].title;
  document.getElementById("leaderFirstName").value = passengers[0].firstName;
  document.getElementById("leaderLastName").value = passengers[0].lastName;

  renderPassengers();
  refreshSummary();

  success.innerText = `✓ สร้างผู้เดินทาง ${passengers.length} คนสำเร็จ`;
  success.style.display = "block";
}


function normalizePassengerAddOns(p) {
  const md = getMasterData();

  if (!p.preAddOns || !Array.isArray(p.preAddOns)) {
    p.preAddOns = md.addOns.map(x => ({
      ...x,
      selected: false,
      qty: 1,
      price: x.defaultPrice,
      customName: "",
      priceReason: "ราคา Default",
      priceReasonOther: ""
    }));
  } else {
    // เติม add-on master ที่ยังไม่มีใน booking เก่า
    md.addOns.forEach(master => {
      if (!p.preAddOns.some(a => a.id === master.id)) {
        p.preAddOns.push({
          ...master,
          selected: false,
          qty: 1,
          price: master.defaultPrice,
          customName: "",
          priceReason: "ราคา Default",
          priceReasonOther: ""
        });
      }
    });
  }

  if (!isBoatTicketProgram(p)) {
    p.preAddOns = p.preAddOns.map(a => ({
      ...a,
      selected: false,
      qty: 1,
      price: a.defaultPrice,
      customName: a.customName || "",
      priceReason: "ราคา Default",
      priceReasonOther: ""
    }));
  }

  return p;
}

function renderPassengers() {
  const md = getMasterData();
  const root = document.getElementById("passengerList");
  root.innerHTML = "";

  passengers = passengers.map(normalizePassengerAddOns);

  passengers.forEach((p, pi) => {
    const div = document.createElement("div");
    div.className = "passenger";
    div.innerHTML = `
      <div class="passenger-head">
        <h3>ผู้เดินทาง ${pi + 1} ${p.isLeader ? '<span class="leader">หัวหน้าทริป</span>' : ""}</h3>
        ${!p.isLeader ? `<button class="btn btn-soft" type="button" onclick="copyLeaderPackage(${pi})">ใช้ Program/Add-on เหมือนหัวหน้าทริป</button>` : ""}
      </div>

      <div class="three-grid">
        <div>
          <label>คำนำหน้า</label>
          <select onchange="updatePassenger(${pi}, 'title', this.value)">
            ${["", "นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง", "อื่นๆ"].map(x =>
              `<option value="${x}" ${p.title === x ? "selected" : ""}>${x || "ไม่ระบุ"}</option>`
            ).join("")}
          </select>
        </div>
        <div><label>ชื่อ</label><input value="${p.firstName || ""}" oninput="updatePassenger(${pi}, 'firstName', this.value)"></div>
        <div><label>นามสกุล</label><input value="${p.lastName || ""}" oninput="updatePassenger(${pi}, 'lastName', this.value)"></div>
      </div>

      <div class="form-grid mt">
        <div><label>อายุ</label><input value="${p.age || ""}" oninput="updatePassenger(${pi}, 'age', this.value)"></div>
        <div><label>เบอร์โทร</label><input value="${p.phone || ""}" oninput="updatePassenger(${pi}, 'phone', this.value)"></div>
        <div>
          <label>จุดหมาย</label>
          <select onchange="updatePassenger(${pi}, 'island', this.value)">
            ${["", "อ่าวไม้งาม", "อ่าวช่องขาด"].map(x =>
              `<option value="${x}" ${p.island === x ? "selected" : ""}>${x || "ไม่ระบุ"}</option>`
            ).join("")}
          </select>
        </div>
        <div><label>แพ้อาหาร</label><input value="${p.foodAllergy || ""}" oninput="updatePassenger(${pi}, 'foodAllergy', this.value)"></div>
        <div class="full"><label>โรคประจำตัว / หมายเหตุ</label><textarea oninput="updatePassenger(${pi}, 'medicalNote', this.value)">${p.medicalNote || ""}</textarea></div>
      </div>

      <div class="service">
        <div class="service-top"><strong>Program หลัก</strong><span class="tag">Program Revenue</span></div>
        <label>เลือก Program</label>
        <select onchange="updateProgram(${pi}, this.value)">
          ${md.programs.map(x =>
            `<option value="${x.id}" ${p.program.programId === x.id ? "selected" : ""}>${x.name} - ${money(x.price)} บาท</option>`
          ).join("")}
        </select>
        <div class="mini-grid">
          <div><label>จำนวน</label><input type="number" min="1" value="${p.program.qty}" onchange="updateProgramField(${pi}, 'qty', Number(this.value || 1))"></div>
          <div><label>ราคา/หน่วย</label><input type="number" value="${p.program.price}" onchange="updateProgramField(${pi}, 'price', Number(this.value || 0))"></div>
          <div><label>เหตุผลแก้ราคา</label><select onchange="updateProgramField(${pi}, 'priceReason', this.value)">${priceReasons.map(r => `<option ${p.program.priceReason === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        </div>
        <label>หมายเหตุราคา Program</label>
        <input value="${p.program.priceReasonOther || ""}" oninput="updateProgramField(${pi}, 'priceReasonOther', this.value)">
      </div>

      <div class="service">
        <div class="service-top"><strong>Add-on ก่อนเดินทาง</strong><span class="tag">Pre-booked Add-on</span></div>
        ${renderPreAddOns(p, pi)}
      </div>

      <div class="service">
        <div class="service-top"><strong>ซื้อเพิ่มบนเกาะ</strong><span class="tag">Island Add-on</span></div>
        <button class="btn btn-primary btn-full" onclick="openIslandPanel(${pi})">+ เพิ่ม/แก้ไขซื้อเพิ่มบนเกาะ</button>
        ${renderIslandSummary(p)}
      </div>
    `;
    root.appendChild(div);
  });
}

function isBoatTicketProgram(p) {
  return p.program && p.program.programId === "boat_ticket";
}

function renderPreAddOns(p, pi) {
  const editable = isBoatTicketProgram(p);

  return `
    ${editable ? `
      <p class="muted">Pre Add-on เปิดให้เลือกได้ เพราะ Program เป็น “ตั๋วเรือ”</p>
    ` : `
      <div class="warning" style="display:block;">
        Program นี้เป็น Package แล้ว จึงล็อก Pre Add-on เพื่อป้องกันการคิดซ้ำกับสิ่งที่รวมอยู่ในแพ็กเกจ
      </div>
    `}

    ${p.preAddOns.map((a, ai) => `
      <div class="service ${!editable ? "disabled-card" : ""}">
        <label class="check">
          <input type="checkbox" ${a.selected ? "checked" : ""} ${!editable ? "disabled" : ""} onchange="togglePreAddOn(${pi}, ${ai}, this.checked)">
          ${a.name}
        </label>
        <div class="muted">ราคา default: ${money(a.defaultPrice)} บาท</div>

        <div class="mini-grid">
          <div>
            <label>จำนวน</label>
            <input type="number" min="1" value="${a.qty}" ${!editable ? "disabled" : ""} onchange="updatePreAddOn(${pi}, ${ai}, 'qty', Number(this.value || 1))">
          </div>
          <div>
            <label>ราคา/หน่วย</label>
            <input type="number" value="${a.price}" ${!editable ? "disabled" : ""} onchange="updatePreAddOn(${pi}, ${ai}, 'price', Number(this.value || 0))">
          </div>
          <div>
            ${a.id === "other" ? `
              <label>ชื่อรายการ</label>
              <input value="${a.customName || ""}" ${!editable ? "disabled" : ""} oninput="updatePreAddOn(${pi}, ${ai}, 'customName', this.value)">
            ` : `
              <label>เหตุผลแก้ราคา</label>
              <select ${!editable ? "disabled" : ""} onchange="updatePreAddOn(${pi}, ${ai}, 'priceReason', this.value)">
                ${priceReasons.map(r => `<option ${a.priceReason === r ? "selected" : ""}>${r}</option>`).join("")}
              </select>
            `}
          </div>
        </div>

        <label>หมายเหตุ</label>
        <input value="${a.priceReasonOther || ""}" ${!editable ? "disabled" : ""} oninput="updatePreAddOn(${pi}, ${ai}, 'priceReasonOther', this.value)">
      </div>
    `).join("")}
  `;
}

function renderIslandSummary(p) {
  if (!p.islandAddOns || !p.islandAddOns.length) return `<p class="muted">ยังไม่มีรายการซื้อเพิ่มบนเกาะ</p>`;
  return p.islandAddOns.map(a => `
    <div class="line">
      <span>${addOnName(a)} x ${a.qty}<br><span class="muted">${a.paymentMethod} | ผู้รับเงิน: ${a.receivedBy || "-"}</span></span>
      <strong>${money(a.qty * a.price)}</strong>
    </div>
  `).join("");
}

function updatePassenger(pi, key, value) {
  passengers[pi][key] = value;
  refreshSummary();
}

function updateProgram(pi, programId) {
  const program = getMasterData().programs.find(x => x.id === programId);
  passengers[pi].program = {
    programId: program.id,
    name: program.name,
    qty: 1,
    price: program.price,
    defaultPrice: program.price,
    priceReason: "ราคา Default",
    priceReasonOther: ""
  };

  // ถ้าเลือก Program ที่ไม่ใช่ “ตั๋วเรือ” ให้ล้างและล็อก Pre Add-on
  // เพราะถือว่าอยู่ใน Package แล้ว ไม่ควรติ๊กซ้ำ
  if (program.id !== "boat_ticket") {
    passengers[pi].preAddOns = passengers[pi].preAddOns.map(a => ({
      ...a,
      selected: false,
      qty: 1,
      price: a.defaultPrice,
      customName: a.customName || "",
      priceReason: "ราคา Default",
      priceReasonOther: ""
    }));
  }

  renderPassengers();
  refreshSummary();
}

function updateProgramField(pi, key, value) {
  passengers[pi].program[key] = value;
  refreshSummary();
}

function togglePreAddOn(pi, ai, checked) {
  passengers[pi].preAddOns[ai].selected = checked;
  refreshSummary();
}

function updatePreAddOn(pi, ai, key, value) {
  passengers[pi].preAddOns[ai][key] = value;
  refreshSummary();
}

function copyLeaderPackage(pi) {
  if (!passengers[0] || !passengers[pi]) return;

  passengers[pi].program = deepClone(passengers[0].program);
  passengers[pi].preAddOns = deepClone(passengers[0].preAddOns);

  // ใช้ business rule เดียวกันหลัง copy:
  // ถ้า Program ที่ copy มาไม่ใช่ตั๋วเรือ ต้องไม่ให้มี Pre Add-on ติดมาด้วย
  if (passengers[pi].program.programId !== "boat_ticket") {
    passengers[pi].preAddOns = passengers[pi].preAddOns.map(a => ({
      ...a,
      selected: false,
      qty: 1,
      price: a.defaultPrice,
      customName: a.customName || "",
      priceReason: "ราคา Default",
      priceReasonOther: ""
    }));
  }

  writeAudit("COPY_LEADER_PACKAGE", `คัดลอก Program/Add-on จากหัวหน้าทริปให้ ${fullName(passengers[pi]) || "ผู้เดินทาง " + (pi + 1)}`);
  renderPassengers();
  refreshSummary();
}

function openIslandPanel(pi) {
  if (!requirePermission('addIslandAddOn', 'Role นี้ไม่มีสิทธิ์เพิ่มซื้อบนเกาะ')) return;
  islandTargetPassengerIndex = pi;
  const p = passengers[pi];
  document.getElementById("islandPanelPassenger").innerText = fullName(p) || `ผู้เดินทาง ${pi + 1}`;
  document.getElementById("islandPaymentMethod").value = "เงินสด";
  document.getElementById("islandReceivedBy").value = "";

  const md = getMasterData();
  const existing = p.islandAddOns || [];

  document.getElementById("islandAddOnForm").innerHTML = md.addOns.map((item, i) => {
    const found = existing.find(x => x.id === item.id);
    return `
      <div class="service">
        <label class="check">
          <input id="island_checked_${i}" type="checkbox" ${found ? "checked" : ""}>
          ${item.name}
        </label>
        <div class="mini-grid">
          <div><label>จำนวน</label><input id="island_qty_${i}" type="number" min="1" value="${found?.qty || 1}"></div>
          <div><label>ราคา</label><input id="island_price_${i}" type="number" value="${found?.price ?? item.defaultPrice}"></div>
          <div>${item.id === "other" ? `<label>ชื่อรายการ</label><input id="island_other_${i}" value="${found?.name || ""}">` : ""}</div>
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("islandPanel").classList.remove("hidden");
}

function closeIslandPanel() {
  document.getElementById("islandPanel").classList.add("hidden");
}

function saveIslandAddOns() {
  const pi = islandTargetPassengerIndex;
  if (pi === null) return;

  const md = getMasterData();
  const paymentMethod = document.getElementById("islandPaymentMethod").value;
  const receivedBy = document.getElementById("islandReceivedBy").value;

  passengers[pi].islandAddOns = [];

  md.addOns.forEach((item, i) => {
    const checked = document.getElementById(`island_checked_${i}`).checked;
    if (!checked) return;

    let name = item.name;
    if (item.id === "other") {
      name = document.getElementById(`island_other_${i}`).value || "อื่นๆ";
    }

    passengers[pi].islandAddOns.push({
      id: item.id,
      name,
      qty: Number(document.getElementById(`island_qty_${i}`).value || 1),
      price: Number(document.getElementById(`island_price_${i}`).value || 0),
      defaultPrice: item.defaultPrice,
      paymentMethod,
      receivedBy,
      addedAt: new Date().toISOString(),
      addedLocation: "island"
    });
  });

  writeAudit("SAVE_ISLAND_ADDON", `${fullName(passengers[pi])} บันทึกซื้อเพิ่มบนเกาะ`);
  closeIslandPanel();
  renderPassengers();
  refreshSummary();
}

function programTotal(p) {
  return Number(p.program.qty || 0) * Number(p.program.price || 0);
}

function preAddOnTotal(p) {
  return p.preAddOns.filter(a => a.selected).reduce((s, a) => s + Number(a.qty || 0) * Number(a.price || 0), 0);
}

function islandAddOnTotal(p) {
  return (p.islandAddOns || []).reduce((s, a) => s + Number(a.qty || 0) * Number(a.price || 0), 0);
}

function getPersonTotal(p) {
  return programTotal(p) + preAddOnTotal(p) + islandAddOnTotal(p);
}

function refreshSummary() {
  document.getElementById("sumCode").innerText = editingBookingCode || "DRAFT";
  const statusEl = document.getElementById("sumStatus");
  if (statusEl) statusEl.innerHTML = `<span class="status-badge ${statusClass(document.getElementById("status").value)}" style="position:static;display:inline-block;">${statusLabel(document.getElementById("status").value)}</span>`;
  document.getElementById("sumName").innerText = leaderFullName() || "-";

  const tripType = document.getElementById("tripType").value;
  const travelDate = document.getElementById("travelDate").value || "-";
  const returnDate = document.getElementById("returnDate").value || "-";
  document.getElementById("sumDate").innerText = tripType === "round_trip" ? `${travelDate} → ${returnDate}` : travelDate;

  document.getElementById("sumPax").innerText = passengers.length || 1;
  document.getElementById("sumSource").innerText = document.getElementById("source").value || "-";

  const box = document.getElementById("summaryPeople");
  box.innerHTML = "";

  let grand = 0;
  passengers.forEach((p, i) => {
    grand += getPersonTotal(p);
    const div = document.createElement("div");
    div.className = "person-summary";
    div.innerHTML = `
      <strong>${i + 1}. ${fullName(p) || "ยังไม่กรอกชื่อ"}</strong>
      <div class="line"><span>Program: ${p.program.name} x ${p.program.qty}</span><strong>${money(programTotal(p))}</strong></div>
      ${p.preAddOns.filter(a => a.selected).map(a => `<div class="line"><span>${addOnName(a)} x ${a.qty}</span><strong>${money(a.qty * a.price)}</strong></div>`).join("")}
      ${(p.islandAddOns || []).map(a => `<div class="line"><span>${addOnName(a)} x ${a.qty}<br><span class="muted">ซื้อบนเกาะ</span></span><strong>${money(a.qty * a.price)}</strong></div>`).join("")}
      <div class="line"><strong>รวมรายคน</strong><strong>${money(getPersonTotal(p))}</strong></div>
    `;
    box.appendChild(div);
  });
  document.getElementById("grandTotal").innerText = money(grand);
}


function validateBookingForm() {
  const errors = [];

  if (!document.getElementById("travelDate").value) errors.push("กรุณาระบุวันเดินทางไป");
  if (document.getElementById("tripType").value === "round_trip" && !document.getElementById("returnDate").value) errors.push("กรุณาระบุวันเดินทางกลับ");
  if (!document.getElementById("leaderFirstName").value.trim()) errors.push("กรุณาระบุชื่อหัวหน้าทริป");
  if (!document.getElementById("leaderLastName").value.trim()) errors.push("กรุณาระบุนามสกุลหัวหน้าทริป");
  if (!passengers.length) errors.push("กรุณาสร้างรายชื่อผู้เดินทางอย่างน้อย 1 คน");

  passengers.forEach((p, i) => {
    if (!p.firstName || !p.lastName) errors.push(`ผู้เดินทางคนที่ ${i + 1} ยังไม่มีชื่อ/นามสกุล`);
  });

  if (errors.length) {
    alert("ไม่สามารถบันทึกได้ กรุณาตรวจสอบ:\n\n" + errors.join("\n"));
    return false;
  }
  return true;
}

function buildBooking() {
  return {
    bookingCode: editingBookingCode || "BK" + Date.now(),
    receiptNo: currentBooking?.receiptNo || "RC" + new Date().toISOString().slice(0,10).replaceAll("-", "") + "-" + Math.floor(Math.random() * 900 + 100),
    tripType: document.getElementById("tripType").value,
    travelDate: document.getElementById("travelDate").value,
    returnDate: document.getElementById("returnDate").value,
    leaderTitle: document.getElementById("leaderTitle").value,
    leaderFirstName: document.getElementById("leaderFirstName").value,
    leaderLastName: document.getElementById("leaderLastName").value,
    phone: document.getElementById("phone").value,
    source: document.getElementById("source").value,
    agentName: document.getElementById("agentName").value,
    status: document.getElementById("status").value,
    bookingNote: document.getElementById("bookingNote").value,
    paymentMethod: document.getElementById("paymentMethod").value,
    passengers,
    totalAmount: passengers.reduce((s, p) => s + getPersonTotal(p), 0),
    programRevenue: passengers.reduce((s, p) => s + programTotal(p), 0),
    preAddOnRevenue: passengers.reduce((s, p) => s + preAddOnTotal(p), 0),
    islandAddOnRevenue: passengers.reduce((s, p) => s + islandAddOnTotal(p), 0),
    updatedAt: new Date().toISOString()
  };
}

async function saveBooking() {
  if (!requirePermission('createBooking', 'Role นี้ไม่มีสิทธิ์สร้าง Booking')) return;
  if (!validateBookingForm()) return;

  try {
    currentBooking = buildBooking();
    currentBooking.createdAt = new Date().toISOString();

    await persistNewBooking(currentBooking);
    await loadBookingCache();

    editingBookingCode = currentBooking.bookingCode;
    alert("บันทึก Booking ใหม่แล้ว ระบบเปลี่ยนเป็นโหมดแก้ไขแล้ว");
    refreshSummary();
    updateSaveMode();
  } catch (error) {
    console.error(error);
    alert("บันทึก Booking ไม่สำเร็จ: " + error.message);
  }
}

async function updateExistingBooking() {
  if (!validateBookingForm()) return;
  if (!can('editBooking') && !can('addIslandAddOn')) {
    alert('Role นี้ไม่มีสิทธิ์บันทึกการแก้ไข Booking');
    return;
  }
  if (!editingBookingCode) {
    alert("ยังไม่ได้เลือก Booking มาแก้ไข");
    return;
  }

  try {
    currentBooking = buildBooking();
    await persistUpdatedBooking(editingBookingCode, currentBooking);
    await loadBookingCache();

    writeAudit("UPDATE_BOOKING", "แก้ไข Booking และบันทึกทับ");
    alert("บันทึกการแก้ไขแล้ว");
    refreshSummary();
    updateSaveMode();
  } catch (error) {
    console.error(error);
    alert("บันทึกการแก้ไขไม่สำเร็จ: " + error.message);
  }
}


async function cancelCurrentBooking() {
  if (!requirePermission("cancelBooking", "เฉพาะ Admin เท่านั้นที่ยกเลิก Booking ได้")) return;
  if (!editingBookingCode) {
    alert("ยังไม่ได้เลือก Booking ที่ต้องการยกเลิก");
    return;
  }

  const reason = prompt("กรุณาระบุเหตุผลการยกเลิก Booking");
  if (!reason) {
    alert("ต้องระบุเหตุผลการยกเลิก");
    return;
  }

  try {
    const booking = buildBooking();
    booking.status = "cancelled";
    booking.cancelReason = reason;
    booking.cancelledAt = new Date().toISOString();
    booking.cancelledByRole = getCurrentRole();

    await persistCancelBooking(editingBookingCode, reason);
    await loadBookingCache();

    currentBooking = booking;
    document.getElementById("status").value = "cancelled";
    writeAudit("CANCEL_BOOKING", `ยกเลิก Booking เหตุผล: ${reason}`);

    alert("ยกเลิก Booking แล้ว ข้อมูลจะยังอยู่ในระบบ แต่จะไม่ออก Report");
    refreshSummary();
    renderManageBookings();
    renderPrintPage();
    updateSaveMode();
  } catch (error) {
    console.error(error);
    alert("ยกเลิก Booking ไม่สำเร็จ: " + error.message);
  }
}


function loadBooking(b) {
  currentBooking = b;
  editingBookingCode = b.bookingCode;
  passengers = b.passengers || [];

  document.getElementById("tripType").value = b.tripType || "one_way";
  document.getElementById("travelDate").value = b.travelDate || "";
  document.getElementById("returnDate").value = b.returnDate || "";
  toggleReturnDate();

  document.getElementById("leaderTitle").value = b.leaderTitle || "";
  document.getElementById("leaderFirstName").value = b.leaderFirstName || "";
  document.getElementById("leaderLastName").value = b.leaderLastName || "";
  document.getElementById("phone").value = b.phone || "";
  document.getElementById("source").value = b.source || "ลูกค้าเก่า";
  document.getElementById("agentName").value = b.agentName || "";
  document.getElementById("status").value = b.status || "confirmed";
  document.getElementById("bookingNote").value = b.bookingNote || "";
  document.getElementById("paymentMethod").value = b.paymentMethod || "เงินสด";
  document.getElementById("paxCount").value = passengers.length || 1;

  renderPassengers();
  refreshSummary();
  updateSaveMode();
  showPage("bookingPage");
}

function getBookingsByDate(date) {
  const data = getBookings();
  return date ? data.filter(b => b.travelDate === date) : data;
}

function clearManageDate() {
  document.getElementById("manageDateFilter").value = "";
  renderManageBookings();
}

function renderManageBookings() {
  const root = document.getElementById("manageBookingList");
  const date = document.getElementById("manageDateFilter")?.value || "";
  const data = getBookingsByDate(date);

  root.innerHTML = data.length ? data.map(b => `
    <div class="booking-row booking-card-wrap">
      ${statusBadge(b.status)}
      <strong>${b.bookingCode}</strong><br>
      ลูกค้า: ${[b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" ") || "-"}<br>
      วันที่: ${b.travelDate || "-"} ${b.returnDate ? "→ " + b.returnDate : ""}<br>
      จำนวน: ${b.passengers?.length || 0} คน | ยอด: ${can("viewMoney") ? money(b.totalAmount) + " บาท" : "-"}<br>${b.cancelReason ? "เหตุผลยกเลิก: " + b.cancelReason + "<br>" : ""}<br>
      ${can("editBooking") ? `<button class="btn btn-primary" onclick='loadBooking(${JSON.stringify(b)})'>แก้ไข</button>` : ""}
      ${can("addIslandAddOn") ? `<button class="btn btn-warning" onclick='loadBooking(${JSON.stringify(b)}); alert("เลือกผู้เดินทางแล้วกด + เพิ่ม/แก้ไขซื้อเพิ่มบนเกาะ")'>ซื้อเพิ่มบนเกาะ</button>` : ""}
      ${can("viewAudit") ? `<button class="btn btn-soft" onclick="showAuditLogs('${b.bookingCode}')">Audit Log</button>` : ""}
      ${b.status !== "cancelled" && can("cancelBooking") ? `<button class="btn btn-danger" onclick='loadBooking(${JSON.stringify(b)}); setTimeout(cancelCurrentBooking, 50)'>ยกเลิก</button>` : ""}
    </div>
  `).join("") : "ไม่พบ Booking";
}

function writeAudit(action, detail) {
  const logs = JSON.parse(localStorage.getItem("audit_logs") || "[]");
  logs.push({
    id: "AUDIT" + Date.now(),
    bookingCode: editingBookingCode || "DRAFT",
    action,
    detail,
    changedByRole: getCurrentRole(),
    changedByRoleName: getCurrentUser()?.displayName || roleName(),
    changedAt: new Date().toISOString()
  });
  localStorage.setItem("audit_logs", JSON.stringify(logs));
}

function showAuditLogs(code) {
  const logs = JSON.parse(localStorage.getItem("audit_logs") || "[]").filter(x => x.bookingCode === code);
  if (!logs.length) {
    alert("ยังไม่มี Audit Log");
    return;
  }
  alert(logs.map((x, i) => `${i+1}. ${x.changedAt}\nโดย: ${x.changedByRoleName || x.changedByRole || '-'}\n${x.action}: ${x.detail}`).join("\n\n"));
}


const PERMISSION_ACTIONS = [
  { key: "createBooking", label: "สร้าง Booking" },
  { key: "editBooking", label: "บันทึก/แก้ไข Booking" },
  { key: "cancelBooking", label: "ยกเลิก Booking" },
  { key: "addIslandAddOn", label: "ซื้อเพิ่มบนเกาะ" },
  { key: "printReceipt", label: "พิมพ์ใบเสร็จ" },
  { key: "printCounterReport", label: "Counter Report" },
  { key: "printBoatReport", label: "Boat Report" },
  { key: "printDailyReport", label: "Daily Report" },
  { key: "viewAudit", label: "ดู Audit Log" },
  { key: "viewMoney", label: "เห็นยอดเงิน" },
  { key: "editMasterData", label: "แก้ Master Data" },
  { key: "editPermissions", label: "กำหนดสิทธิ์" },
  { key: "systemAdmin", label: "System Admin / Backup" }
];

function renderPermissionMatrix() {
  const root = document.getElementById("permissionMatrix");
  if (!root) return;

  const perms = getRolePermissions();
  const roles = ["admin", "counter", "island_staff", "boat_crew", "management"];

  root.innerHTML = `
    <table class="permission-table">
      <thead>
        <tr>
          <th>สิทธิ์</th>
          ${roles.map(role => `<th>${perms[role].label}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${PERMISSION_ACTIONS.map(action => `
          <tr>
            <td>${action.label}</td>
            ${roles.map(role => `
              <td>
                <input
                  type="checkbox"
                  id="perm_${role}_${action.key}"
                  ${perms[role]?.[action.key] ? "checked" : ""}
                  ${role === "admin" && action.key === "editPermissions" ? "disabled" : ""}
                >
              </td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function savePermissionsFromForm() {
  if (!requirePermission("editPermissions", "Role นี้ไม่มีสิทธิ์กำหนดสิทธิ์")) return;

  const current = getRolePermissions();
  const roles = ["admin", "counter", "island_staff", "boat_crew", "management"];

  roles.forEach(role => {
    PERMISSION_ACTIONS.forEach(action => {
      const el = document.getElementById(`perm_${role}_${action.key}`);
      if (el) current[role][action.key] = el.checked;
    });
  });

  // กันพลาด: Admin ต้องมีสิทธิ์กำหนดสิทธิ์เสมอ
  current.admin.editPermissions = true;
  current.admin.editMasterData = true;

  saveRolePermissions(current);

  if (typeof DataService !== "undefined" && DataService.mode && DataService.mode() === "supabase") {
    for (const role of roles) {
      for (const action of PERMISSION_ACTIONS) {
        await DataService.saveRolePermission(role, action.key, current[role][action.key]);
      }
    }
  }

  writeAudit("UPDATE_PERMISSIONS", "แก้ไขสิทธิ์ Role");
  alert("บันทึกสิทธิ์แล้ว");
  applyRoleUI();
}

function resetPermissions() {
  if (!requirePermission("editPermissions", "Role นี้ไม่มีสิทธิ์ reset สิทธิ์")) return;
  saveRolePermissions(deepClone(DEFAULT_ROLE_PERMISSIONS));
  renderPermissionMatrix();
  writeAudit("RESET_PERMISSIONS", "Reset สิทธิ์เป็นค่าเริ่มต้น");
  alert("Reset สิทธิ์แล้ว");
  applyRoleUI();
}



async function initializeApp() {
  try {
    const user = await AuthService.getSessionUser();
    if (user) {
      await loadRolePermissionsFromDataService();
    }
  } catch (error) {
    console.warn("Session restore failed", error);
  }

  generatePassengers();
  toggleReturnDate();
  applyAuthUI();
  applyRoleUI();
  updateSaveMode();
  loadBookingCache();
}


initializeApp();
