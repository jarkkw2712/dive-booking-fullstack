import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", requirePermission("manageUsers"), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("user_id, username, display_name, role_id, active_flag, created_at")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post("/", requirePermission("manageUsers"), async (req, res) => {
  const payload = {
    username: req.body.username,
    display_name: req.body.display_name,
    role_id: req.body.role_id,
    active_flag: req.body.active_flag !== false
  };

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert(payload)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from("audit_logs").insert({
    booking_code: "SYSTEM",
    action: "CREATE_USER",
    detail: `Create user ${payload.username}`,
    changed_by: req.user?.username || ""
  });

  res.json(data);
});

router.put("/:userId", requirePermission("manageUsers"), async (req, res) => {
  const payload = {
    username: req.body.username,
    display_name: req.body.display_name,
    role_id: req.body.role_id,
    active_flag: req.body.active_flag !== false
  };

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update(payload)
    .eq("user_id", req.params.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from("audit_logs").insert({
    booking_code: "SYSTEM",
    action: "UPDATE_USER",
    detail: `Update user ${payload.username}`,
    changed_by: req.user?.username || ""
  });

  res.json(data);
});

export default router;
