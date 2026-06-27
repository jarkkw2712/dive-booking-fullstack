import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .select("*")
    .order("role_id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

export default router;
