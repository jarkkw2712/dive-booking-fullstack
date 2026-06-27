import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("role_permissions")
    .select("role_id, permission_key, allowed");

  if (error) return res.status(500).json({ error: error.message });

  const result = {};
  for (const row of data || []) {
    if (!result[row.role_id]) result[row.role_id] = {};
    result[row.role_id][row.permission_key] = row.allowed;
  }

  res.json(result);
});

router.put("/", requirePermission("editPermissions"), async (req, res) => {
  const { roleId, permissionKey, allowed } = req.body;

  const { error } = await supabaseAdmin
    .from("role_permissions")
    .upsert({
      role_id: roleId,
      permission_key: permissionKey,
      allowed,
      updated_at: new Date().toISOString()
    }, { onConflict: "role_id,permission_key" });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});


router.get("/matrix", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("role_permissions")
    .select("role_id, permission_key, allowed");

  if (error) return res.status(500).json({ error: error.message });

  const matrix = {};
  for (const row of data || []) {
    if (!matrix[row.role_id]) matrix[row.role_id] = {};
    matrix[row.role_id][row.permission_key] = row.allowed;
  }

  res.json(matrix);
});

router.put("/matrix", requirePermission("editPermissions"), async (req, res) => {
  const matrix = req.body.matrix || {};
  const rows = [];

  Object.entries(matrix).forEach(([roleId, perms]) => {
    Object.entries(perms || {}).forEach(([permissionKey, allowed]) => {
      rows.push({
        role_id: roleId,
        permission_key: permissionKey,
        allowed: !!allowed,
        updated_at: new Date().toISOString()
      });
    });
  });

  const { error } = await supabaseAdmin
    .from("role_permissions")
    .upsert(rows, { onConflict: "role_id,permission_key" });

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from("audit_logs").insert({
    booking_code: "SYSTEM",
    action: "UPDATE_PERMISSION_MATRIX",
    detail: "Update role permission matrix",
    changed_by: req.user?.username || ""
  });

  res.json({ success: true });
});


export default router;
