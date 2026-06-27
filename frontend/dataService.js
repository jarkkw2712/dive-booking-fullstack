// Backend API adapter for latest UI
const API_CONFIG = { API_BASE: "https://dive-booking-api.onrender.com/api" };

function getApiToken() {
  return localStorage.getItem("token") || "";
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  const token = getApiToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_CONFIG.API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "API Error");
  return data;
}

const DataService = {
  mode() { return "backend"; },

  async testConnection() {
    const health = await apiFetch("/health");
    return { ok: true, mode: "backend", health };
  },

  async listBookings() {
    return await apiFetch("/bookings");
  },

  async saveBooking(booking) {
    console.log("[DataService] save via backend", booking);
    return await apiFetch("/bookings", {
      method: "POST",
      body: JSON.stringify(booking)
    });
  },

  async updateBooking(bookingCode, booking) {
    console.log("[DataService] update via backend", bookingCode, booking);
    return await apiFetch(`/bookings/${encodeURIComponent(bookingCode)}`, {
      method: "PUT",
      body: JSON.stringify(booking)
    });
  },

  async cancelBooking(bookingCode, reason) {
    return await apiFetch(`/bookings/${encodeURIComponent(bookingCode)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
  },

  async listAuditLogs() {
    return await apiFetch("/audit-logs");
  },

  async getRolePermissions() {
    return await apiFetch("/permissions");
  },

  async saveRolePermission(roleId, permissionKey, allowed) {
    return await apiFetch("/permissions", {
      method: "PUT",
      body: JSON.stringify({ roleId, permissionKey, allowed })
    });
  },

  async getMasterData() {
    return await apiFetch("/master-data");
  },

  async saveMasterData(masterData) {
    return await apiFetch("/master-data", {
      method: "PUT",
      body: JSON.stringify(masterData)
    });
  },
  async getCompanyProfile() {
    return await apiFetch("/company-profile");
  },

  async saveCompanyProfile(profile) {
    return await apiFetch("/company-profile", {
      method: "PUT",
      body: JSON.stringify(profile)
    });
  },
  async listMasterDataPro(category) {
    return await apiFetch(`/master-data-pro/${encodeURIComponent(category)}`);
  },

  async saveMasterDataProItem(category, item) {
    return await apiFetch(`/master-data-pro/${encodeURIComponent(category)}`, {
      method: "POST",
      body: JSON.stringify(item)
    });
  },

  async updateMasterDataProItem(category, id, item) {
    return await apiFetch(`/master-data-pro/${encodeURIComponent(category)}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(item)
    });
  },
  async listUsers() {
    return await apiFetch("/users");
  },

  async saveUser(user) {
    return await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(user)
    });
  },

  async updateUser(userId, user) {
    return await apiFetch(`/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify(user)
    });
  },

  async listRoles() {
    return await apiFetch("/roles");
  },

  async getPermissionMatrix() {
    return await apiFetch("/permissions/matrix");
  },

  async savePermissionMatrix(matrix) {
    return await apiFetch("/permissions/matrix", {
      method: "PUT",
      body: JSON.stringify({ matrix })
    });
  }
};
