import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { buildPrintCenterReport } from "../services/reportService.js";

const router=express.Router();
router.use(requireAuth);
const dailyPermissions=["printCounterReport","printDailyReport"];
const reportPermissions={
  register_summary:dailyPermissions,register_summary_range:dailyPermissions,receipt_summary:dailyPermissions,equipment_summary:dailyPermissions,
  counter:dailyPermissions,boat:["printBoatReport","printDailyReport"],island:["addIslandAddOn","printBoatReport","printDailyReport"],
  insurance:["printInsuranceReport"],driver:dailyPermissions,management:["printDailyReport"],
  tour_expense_reference:dailyPermissions,tent_fee_reference:dailyPermissions,van_daily_reference:dailyPermissions,van_work_order_reference:dailyPermissions,
  agent_reference:dailyPermissions,customer_travel_daily_reference:dailyPermissions,
  tour_monthly_reference:dailyPermissions,van_monthly_reference:dailyPermissions
};
const paymentReportTypes=new Set(["receipt_summary","tour_expense_reference","van_daily_reference","van_work_order_reference","tour_monthly_reference","van_monthly_reference"]);

router.get("/print-center",async(req,res)=>{
  try{
    const {date,type,to}=req.query;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||"")))return res.status(400).json({error:"Valid date is required"});
    if(to&&!/^\d{4}-\d{2}-\d{2}$/.test(String(to)))return res.status(400).json({error:"Valid end date is required"});
    if(!reportPermissions[type])return res.status(400).json({error:"Invalid report type"});
    if(req.user?.role!=="admin"&&!reportPermissions[type].some(permission=>req.user?.permissions?.[permission]))return res.status(403).json({error:"Permission denied for this report"});
    let bookingResult=await supabaseAdmin.rpc("list_bookings_json_v20");
    if(bookingResult.error)bookingResult=await supabaseAdmin.rpc("list_bookings_json_v19");
    const financialResult=type==="management"?await supabaseAdmin.from("v_financial_outstanding").select("booking_code,net_cash_received,outstanding_amount"):{data:[],error:null};
    const expenseResult=type==="management"?await supabaseAdmin.from("v_current_daily_operating_expenses").select("expense_date,category_code,category_name_snapshot,qty,unit_price,amount,revision,created_by").gte("expense_date",date).lte("expense_date",to||date):{data:[],error:null};
    const addOnMasterResult=type==="management"?await supabaseAdmin.from("master_addons").select("addon_id,addon_name,sort_order").eq("active_flag",true).order("sort_order"):{data:[],error:null};
    const accommodationMasterResult=type==="management"?await supabaseAdmin.from("master_accommodations").select("accommodation_id,accommodation_name,sort_order").eq("active_flag",true).order("sort_order"):{data:[],error:null};
    const paymentResult=paymentReportTypes.has(type)?await supabaseAdmin.from("master_payment_methods").select("method_id,method_name,payment_type,default_general,default_equipment,default_island,default_transport,sort_order").eq("active_flag",true).order("sort_order"):{data:[],error:null};
    const agentMasterResult=type==="agent_reference"?await supabaseAdmin.from("master_agents").select("agent_id,agent_name,sort_order").order("sort_order"):{data:[],error:null};
    const transportationMasterResult=type==="customer_travel_daily_reference"?await supabaseAdmin.from("master_transportation_methods").select("method_id,method_name,sort_order").order("sort_order"):{data:[],error:null};
    for(const result of [bookingResult,financialResult,expenseResult,addOnMasterResult,accommodationMasterResult,paymentResult,agentMasterResult,transportationMasterResult])if(result.error)throw result.error;
    const dailyOnly=["register_summary","receipt_summary","equipment_summary","customer_travel_daily_reference"].includes(type);
    res.json(buildPrintCenterReport({bookings:bookingResult.data||[],financialRows:financialResult.data||[],expenseRows:expenseResult.data||[],paymentMethods:paymentResult.data||[],masterAddOns:addOnMasterResult.data||[],masterAccommodations:accommodationMasterResult.data||[],masterAgents:agentMasterResult.data||[],transportationMethods:transportationMasterResult.data||[],date,toDate:dailyOnly?date:(to||date),type}));
  }catch(error){console.error("Print center report failed",error);res.status(500).json({error:error.message})}
});

export default router;
