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


router.get("/print-center", requirePermission("printDailyReport"), async (req, res) => {
  const { date, type } = req.query;
  if (!date) return res.status(400).json({ error: "date is required" });

  const { data: bookings, error } = await supabaseAdmin.rpc("list_bookings_json");
  if (error) return res.status(500).json({ error: error.message });

  const daily = (bookings || []).filter(b => b.travelDate === date && b.status === "checked-in");
  let rows = [];

  if (type === "counter") {
    rows = daily.map(b => ({
      bookingCode: b.bookingCode,
      leader: [b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" "),
      phone: b.phone,
      pax: b.passengers?.length || 0,
      totalAmount: b.totalAmount,
      paymentMethod: b.paymentMethod,
      note: b.bookingNote
    }));
  } else if (type === "boat") {
    rows = daily.flatMap(b => (b.passengers || []).map(p => ({
      bookingCode: b.bookingCode,
      passenger: [p.title, p.firstName, p.lastName].filter(Boolean).join(" "),
      program: p.program?.name,
      island: p.island,
      preAddOns: (p.preAddOns || []).filter(a => a.selected).map(a => `${a.name} x ${a.qty}`).join(", "),
      islandAddOns: (p.islandAddOns || []).map(a => `${a.name} x ${a.qty}`).join(", ")
    })));
  } else if (type === "driver") {
    rows = daily.map(b => ({
      bookingCode: b.bookingCode,
      leader: [b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" "),
      phone: b.phone,
      pax: b.passengers?.length || 0,
      travelDate: b.travelDate,
      source: b.source,
      note: b.bookingNote
    }));
  } else if (type === "insurance") {
    rows = daily.flatMap(b => (b.passengers || []).map(p => ({
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone || b.phone,
      travelDate: b.travelDate,
      program: p.program?.name
    })));
  } else if (type === "management") {
    rows = [{
      date,
      bookings: daily.length,
      passengers: daily.reduce((s,b)=>s+(b.passengers?.length||0),0),
      revenue: daily.reduce((s,b)=>s+Number(b.totalAmount||0),0),
      programRevenue: daily.reduce((s,b)=>s+Number(b.programRevenue||0),0),
      addonRevenue: daily.reduce((s,b)=>s+Number(b.preAddOnRevenue||0)+Number(b.islandAddOnRevenue||0),0)
    }];
  } else {
    rows = daily.map(b => ({
      bookingCode: b.bookingCode,
      leader: [b.leaderTitle, b.leaderFirstName, b.leaderLastName].filter(Boolean).join(" "),
      status: b.status,
      pax: b.passengers?.length || 0,
      totalAmount: b.totalAmount
    }));
  }

  res.json({
    title: `${type || "report"} report`,
    date,
    type,
    rows
  });
});

export default router;
