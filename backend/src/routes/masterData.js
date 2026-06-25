import express from "express";
import { requireAuth } from "../middleware/auth.js";
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

export default router;
