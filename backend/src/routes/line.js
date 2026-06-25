import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.post("/daily-management", requirePermission("printDailyReport"), async (req,res)=>{
  const { date } = req.body;
  if(!date) return res.status(400).json({error:"date is required"});

  const { data, error } = await supabaseAdmin
    .from("v_daily_management_report")
    .select("*")
    .eq("travel_date", date)
    .maybeSingle();

  if(error) return res.status(500).json({error:error.message});

  const summary = data || {travel_date:date, booking_count:0, passenger_count:0, total_revenue:0};
  const message = `📅 Daily Report ${date}\nBookings: ${summary.booking_count || 0}\nPassengers: ${summary.passenger_count || 0}\nRevenue: ${Number(summary.total_revenue || 0).toLocaleString("th-TH")} บาท`;

  // LINE Messaging API placeholder
  // Put channel access token and group/user id in .env, then enable this.
  if(!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_TO_ID){
    return res.json({sent:false, message, note:"LINE env not configured"});
  }

  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body:JSON.stringify({
      to: process.env.LINE_TO_ID,
      messages:[{type:"text", text:message}]
    })
  });

  const lineData = await lineRes.text();
  res.json({sent:lineRes.ok, message, lineResponse:lineData});
});

export default router;
