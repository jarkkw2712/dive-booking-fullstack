const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
test('Register alone shows note and allergy; money receipt hides credit and account table',()=>{
  const profiles=app.slice(app.indexOf('const documentProfiles='),app.indexOf('\n',app.indexOf('const documentProfiles=')));
  const raw=app.slice(app.indexOf('renderReceipt=function(booking,type="MONEY_RECEIPT")'),app.indexOf('\n',app.indexOf('renderReceipt=function(booking,type="MONEY_RECEIPT")')));
  const amounts=app.slice(app.indexOf('function documentPaymentAmounts('),app.indexOf('function allocateReceiptRow('));
  const summary=app.slice(app.indexOf('function documentFinancialSummary('),app.indexOf('function renderIslandPurchaseOrder('));
  const context={renderReceipt:null,getCompanySettings:()=>({}),documentPaxSummary:()=>[],documentGroupedItems:()=>[{name:'โปรแกรม',qty:1,unit:1000,total:1000}],documentInfoLine:()=>'',money:value=>String(value),escapeHtml:value=>String(value),paymentTypeLabel:()=> 'เงินสด',bookingSavedPaymentMethod:()=> 'เงินสด',currentUser:{username:'test'},booking:{bookingCode:'BK-TEST',depositAmount:0,creditAmount:500,bookingNote:'หมายเหตุทดสอบ',passengers:[{foodAllergy:'แพ้กุ้ง'}]}};
  vm.runInNewContext(`${profiles}\n${raw}\n${amounts}\n${summary}\nregister=renderReceipt(booking,'REGISTER');receipt=renderReceipt(booking,'MONEY_RECEIPT');`,context);
  assert.match(context.register,/หมายเหตุทดสอบ/);assert.match(context.register,/แพ้กุ้ง/);assert.doesNotMatch(context.receipt,/หมายเหตุทดสอบ|แพ้กุ้ง|ขายเชื่อ|payment-allocation-table/);
  assert.doesNotMatch(context.register,/มัดจำ/);assert.doesNotMatch(context.receipt,/มัดจำ/);assert.match(context.receipt,/ยอดรวม/);assert.match(context.receipt,/ยอดสุทธิ/);
  context.booking.depositAmount=100;vm.runInNewContext(`receiptWithDeposit=renderReceipt(booking,'MONEY_RECEIPT')`,context);assert.match(context.receiptWithDeposit,/มัดจำ/);assert.match(context.receiptWithDeposit,/>900 บาท/);
});
test('passenger matrix leaves empty categories blank without changing the passenger total',()=>{
  const source=app.slice(app.indexOf('function documentPaxMatrix('),app.indexOf('const renderReceiptWithVerticalPax'));
  const context={};vm.runInNewContext(`${source};html=documentPaxMatrix({passengers:[{passengerType:'adult',nationalityType:'thai'}]})`,context);
  assert.doesNotMatch(context.html,/<td>0<\/td>/);assert.equal((context.html.match(/<td>1<\/td>/g)||[]).length,2);
});
