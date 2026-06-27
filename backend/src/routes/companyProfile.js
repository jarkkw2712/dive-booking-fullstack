import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

const DEFAULT_PROFILE_ID = "default";

router.get("/", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("company_profile")
    .select("*")
    .eq("profile_id", DEFAULT_PROFILE_ID)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  res.json(data || {
    profile_id: DEFAULT_PROFILE_ID,
    company_name: "Dive Tour Company",
    tax_id: "-",
    address: "Phuket, Thailand",
    phone: "081-000-0000"
  });
});

router.put("/", requirePermission("editMasterData"), async (req, res) => {
  const payload = {
    profile_id: DEFAULT_PROFILE_ID,
    company_name: req.body.company_name || "",
    tax_id: req.body.tax_id || "",
    address: req.body.address || "",
    phone: req.body.phone || "",
    email: req.body.email || "",
    website: req.body.website || "",
    line_oa: req.body.line_oa || "",
    facebook: req.body.facebook || "",
    logo_url: req.body.logo_url || "",
    signature_url: req.body.signature_url || "",
    stamp_url: req.body.stamp_url || "",
    bank_name: req.body.bank_name || "",
    bank_account: req.body.bank_account || "",
    bank_account_name: req.body.bank_account_name || "",
    promptpay: req.body.promptpay || "",
    promptpay_qr_url: req.body.promptpay_qr_url || "",
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from("company_profile")
    .upsert(payload, { onConflict: "profile_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true, profile: data });
});

export default router;
