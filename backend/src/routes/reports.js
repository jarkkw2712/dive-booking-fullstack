import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/daily-management", requirePermission("printDailyReport"), async (req,res)=>{
  const { date } = req.query;
  if(!date) return res.status(400).json({error:"date is required"});

  const { data, error } = await supabaseAdmin
    .from("v_daily_management_report")
    .select("*")
    .eq("travel_date", date)
    .maybeSingle();

  if(error) return res.status(500).json({error:error.message});
  res.json(data || {travel_date:date, booking_count:0, passenger_count:0, total_revenue:0});
});

export default router;
