// Backend auth adapter for latest UI
const AUTH_USERS = [
  { username: "admin", password: "1234", role: "admin", displayName: "Admin Owner" },
  { username: "counter", password: "1234", role: "counter", displayName: "Counter Staff" },
  { username: "island", password: "1234", role: "island_staff", displayName: "Island Staff" },
  { username: "boat", password: "1234", role: "boat_crew", displayName: "Boat Crew" },
  { username: "manager", password: "1234", role: "management", displayName: "Management" }
];

const AuthService = {
  mode() { return "backend"; },

  async login(username, password) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    localStorage.setItem("token", data.token);
    localStorage.setItem("current_user", JSON.stringify(data.user));
    localStorage.setItem("current_role", data.user.role);
    return data.user;
  },

  async logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("current_user");
    localStorage.removeItem("current_role");
  },

  async getSessionUser() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("current_user") || "null");
    if (!token || !user) return null;

    try {
      const fresh = await apiFetch("/auth/me");
      localStorage.setItem("current_user", JSON.stringify(fresh.user));
      localStorage.setItem("current_role", fresh.user.role);
      return fresh.user;
    } catch (e) {
      await this.logout();
      return null;
    }
  }
};
