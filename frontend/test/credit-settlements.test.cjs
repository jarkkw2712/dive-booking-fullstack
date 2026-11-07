const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');

test('credit settlement UI is disabled at zero and stages multiple partial payments until Booking save',()=>{
  const source=fs.readFileSync(path.join(root,'js','creditSettlements.js'),'utf8');
  const elements={};for(const id of ['creditSettlementPanel','creditSettlementFields','creditAmount','creditSettlementStatus','creditSettlementMethod','creditSettlementHistory','creditSettlementMessage','creditSettlementDate','creditSettlementAmount','creditSettlementAdd'])elements[id]={value:'',innerHTML:'',textContent:'',disabled:false,classList:{toggle(){}},addEventListener(event,handler){this[event]=handler}};
  let key=0;const context={document:{getElementById:id=>elements[id]},master:{paymentMethods:[{method_id:'cash',method_name:'เงินสด',active_flag:true},{method_id:'bank_transfer',method_name:'นฤมล',active_flag:true}]},editingCode:null,hasPermission:()=>true,paymentTypeLabel:name=>name==='เงินสด'?'เงินสด':'โอนธนาคาร',escapeHtml:String,money:value=>String(value),crypto:{randomUUID:()=>`key-${++key}`},structuredClone,API:{creditSettlements:async()=>[]},window:{},buildBooking:()=>({creditAmount:Number(elements.creditAmount.value)}),validateBooking:()=>'',startNewBooking:()=>{},loadBookingToForm:()=>{},saveBooking:async()=>true,updateBooking:async()=>true};
  vm.runInNewContext(source,context);assert.equal(elements.creditSettlementFields.disabled,true);
  elements.creditAmount.value='1650';elements.creditAmount.input();assert.equal(elements.creditSettlementFields.disabled,false);
  elements.creditSettlementDate.value='2026-10-28';elements.creditSettlementMethod.value='cash';elements.creditSettlementAmount.value='1000';elements.creditSettlementAdd.click();
  assert.equal(context.buildBooking().creditSettlementsPending[0].amount,1000);assert.equal(elements.creditSettlementAmount.value,'');
  elements.creditSettlementDate.value='2026-11-01';elements.creditSettlementMethod.value='bank_transfer';elements.creditSettlementAmount.value='650';elements.creditSettlementAdd.click();
  assert.deepEqual(Array.from(context.buildBooking().creditSettlementsPending,row=>row.amount),[1000,650]);
  elements.creditSettlementAmount.value='1';elements.creditSettlementAdd.click();assert.match(elements.creditSettlementMessage.textContent,/เกิน/);
  assert.match(context.validateBooking({creditAmount:1650}),/เพิ่มรายการชำระ/);
});

test('receipt summary paints settlement rows red without additional printed description',()=>{
  const app=fs.readFileSync(path.join(root,'js','app.js'),'utf8'),css=fs.readFileSync(path.join(root,'css','style.css'),'utf8'),source=app.slice(app.indexOf('function dailySummaryReportHtml'),app.indexOf('function frontChargeReportHtml'));
  const context={escapeHtml:v=>String(v??''),money:v=>String(Number(v||0)),getCompanySettings:()=>({company_name:'Sabina'})};
  vm.runInNewContext(`${source}\nhtml=dailySummaryReportHtml({type:'receipt_summary',title:'รายงาน',date:'2026-10-28',rows:[{no:1,agent:'',leader:'นาย A',program:'ตั๋วเรือ',balanceCash:1000,totalCash:1000,grandTotal:1000,creditSettlement:true}],receiptTotals:{balanceCash:1000,totalCash:1000,grandTotal:1000}})`,context);
  assert.match(context.html,/class="credit-settlement-row"/);assert.match(context.html,/นาย A/);assert.doesNotMatch(context.html,/ยอดชำระจากขายเชื่อ/);assert.match(css,/credit-settlement-row td\{color:#b00020!important/);
});

test('a saved payment can be deleted without entering a reason and no longer counts toward paid total',async()=>{
  const source=fs.readFileSync(path.join(root,'js','creditSettlements.js'),'utf8'),elements={};
  for(const id of ['creditSettlementPanel','creditSettlementFields','creditAmount','creditSettlementStatus','creditSettlementMethod','creditSettlementHistory','creditSettlementMessage','creditSettlementDate','creditSettlementAmount','creditSettlementAdd'])elements[id]={value:'',innerHTML:'',textContent:'',disabled:false,classList:{toggle(){}},addEventListener(event,handler){this[event]=handler}};
  elements.creditAmount.value='1650';let voided=false,submitted;
  const context={document:{getElementById:id=>elements[id]},master:{paymentMethods:[{method_id:'cash',method_name:'เงินสด',active_flag:true}]},editingCode:'BK1',hasPermission:()=>true,paymentTypeLabel:()=> 'เงินสด',escapeHtml:String,money:String,crypto:{randomUUID:()=> 'new'},structuredClone,prompt:()=> 'กรอกผิด',confirm:()=>true,alert:()=>{},API:{creditSettlements:async()=>[{idempotency_key:'key',settlement_date:'2026-10-28',payment_method_name:'เงินสด',amount:1000,voided_at:voided?'2026-11-07':null,void_reason:voided?'กรอกผิด':null}],voidCreditSettlement:async(...args)=>{submitted=args;voided=true}},window:{},buildBooking:()=>({creditAmount:1650}),validateBooking:()=>'',startNewBooking:()=>{},loadBookingToForm:()=>{},saveBooking:async()=>true,updateBooking:async()=>true};
  vm.runInNewContext(source,context);context.loadBookingToForm({bookingCode:'BK1'});await new Promise(resolve=>setImmediate(resolve));
  assert.match(elements.creditSettlementHistory.innerHTML,/>ลบ<\/button>/);assert.match(elements.creditSettlementStatus.textContent,/1000 บาท/);
  await elements.creditSettlementHistory.click({target:{closest:selector=>selector==='[data-void-credit]'?{dataset:{voidCredit:'key'}}:null}});
  assert.deepEqual(submitted,['BK1','key']);assert.match(elements.creditSettlementHistory.innerHTML,/ลบแล้ว/);assert.match(elements.creditSettlementStatus.textContent,/ชำระแล้ว \/ รอบันทึก 0 บาท/);
});
