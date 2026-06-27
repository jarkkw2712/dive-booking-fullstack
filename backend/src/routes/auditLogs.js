import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", requirePermission("viewAudit"), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(1000);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

export default router;
