import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrintCenterReport} from '../src/services/reportService.js';

test('other service metadata alone never changes any existing Print Center report',()=>{
  const date='2026-11-08';
  const booking={bookingCode:'TEST-OTHER-SERVICE',status:'confirmed',travelDate:date,returnDate:date,leaderFirstName:'ตัวอย่าง',totalAmount:1000,paymentMethod:'เงินสด',passengers:[{firstName:'ตัวอย่าง',passengerType:'adult',program:{programId:'boat_ticket',name:'ตั๋วเรือ',price:1000,qty:1},preAddOns:[],islandAddOns:[]}]};
  const reportTypes=['register_summary','register_summary_range','front_charge','receipt_summary','equipment_summary','equipment_summary_range','management','tour_expense_reference','tent_fee_reference','van_daily_reference','van_work_order_reference','songthaew_work_order_reference','package_cost_reference','boat_tent_reference','agent_reference','customer_travel_daily_reference'];
  for(const type of reportTypes){
    const common={date,toDate:date,type,paymentMethods:[{method_id:'cash',method_name:'เงินสด',payment_type:'cash'}]};
    const original=buildPrintCenterReport({...common,bookings:[booking]});
    const withService=buildPrintCenterReport({...common,bookings:[{...booking,otherServices:[{description:'ค่าบริการพิเศษ',amount:500,paymentMethod:'เงินสด',documentVisibility:{show_money_receipt:true}}]}]});
    assert.deepEqual(withService,original,`Report ${type} must not include other services`);
  }
});
