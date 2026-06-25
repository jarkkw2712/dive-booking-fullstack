import express from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req,res)=>{
  const { data, error } = await supabaseAdmin.rpc("list_bookings_json");
  if(error) return res.status(500).json({error:error.message});
  let rows = data || [];
  if(req.query.travelDate) rows = rows.filter(b => b.travelDate === req.query.travelDate);
  res.json(rows);
});

router.post("/", requirePermission("createBooking"), async (req,res)=>{
  const { data, error } = await supabaseAdmin.rpc("upsert_booking_from_json", { p_booking: req.body });
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});

router.put("/:bookingCode", requirePermission("editBooking"), async (req,res)=>{
  const booking = {...req.body, bookingCode:req.params.bookingCode};
  const { data, error } = await supabaseAdmin.rpc("upsert_booking_from_json", { p_booking: booking });
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});

router.post("/:bookingCode/cancel", requirePermission("cancelBooking"), async (req,res)=>{
  const { reason } = req.body;
  const { data, error } = await supabaseAdmin.rpc("cancel_booking_by_code", { p_booking_code:req.params.bookingCode, p_reason:reason });
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});

export default router;
