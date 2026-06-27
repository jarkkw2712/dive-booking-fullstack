import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req,res)=>{
  const [programs, addOns] = await Promise.all([
    supabaseAdmin.from("master_programs").select("*").eq("active_flag", true).order("sort_order"),
    supabaseAdmin.from("master_addons").select("*").eq("active_flag", true).order("sort_order")
  ]);
  if(programs.error) return res.status(500).json({error:programs.error.message});
  if(addOns.error) return res.status(500).json({error:addOns.error.message});
  res.json({programs:programs.data, addOns:addOns.data});
});


router.put("/", requirePermission("editMasterData"), async (req, res) => {
  const { programs = [], addOns = [] } = req.body;

  for (const p of programs) {
    const { error } = await supabaseAdmin.from("master_programs").upsert({
      program_id: p.id || p.program_id,
      program_name: p.name || p.program_name,
      default_price: p.price ?? p.default_price,
      active_flag: true
    });
    if (error) return res.status(500).json({ error: error.message });
  }

  for (const a of addOns) {
    const { error } = await supabaseAdmin.from("master_addons").upsert({
      addon_id: a.id || a.addon_id,
      addon_name: a.name || a.addon_name,
      default_price: a.defaultPrice ?? a.default_price,
      active_flag: true
    });
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

export default router;
