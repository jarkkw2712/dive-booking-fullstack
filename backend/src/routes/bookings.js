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


router.post("/check-duplicate", async (req, res) => {
  try {
    const booking = req.body;
    const travelDate = booking.travelDate;
    const passengers = booking.passengers || [];

    if (!travelDate || !passengers.length) {
      return res.json({ duplicates: [] });
    }

    const { data: allBookings, error } = await supabaseAdmin.rpc("list_bookings_json");
    if (error) return res.status(500).json({ error: error.message });

    const targetNames = passengers.map(p => ({
      name: [p.title, p.firstName, p.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().toLowerCase(),
      phone: p.phone || booking.phone || ""
    })).filter(x => x.name);

    const duplicates = [];

    for (const b of allBookings || []) {
      if (b.bookingCode === booking.bookingCode) continue;
      if (b.travelDate !== travelDate) continue;
      if (b.status === "cancelled") continue;

      for (const p of b.passengers || []) {
        const existingName = [p.title, p.firstName, p.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().toLowerCase();
        const existingPhone = p.phone || b.phone || "";

        for (const t of targetNames) {
          if (existingName && existingName === t.name) {
            duplicates.push({
              booking_code: b.bookingCode,
              passenger_name: [p.title, p.firstName, p.lastName].filter(Boolean).join(" "),
              phone: existingPhone,
              reason: "same_name_same_date"
            });
          } else if (t.phone && existingPhone && t.phone === existingPhone) {
            duplicates.push({
              booking_code: b.bookingCode,
              passenger_name: [p.title, p.firstName, p.lastName].filter(Boolean).join(" "),
              phone: existingPhone,
              reason: "same_phone_same_date"
            });
          }
        }
      }
    }

    res.json({ duplicates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:bookingCode/timeline", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .eq("booking_code", req.params.bookingCode)
    .order("changed_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

export default router;
