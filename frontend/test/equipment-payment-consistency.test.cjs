const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');

test('adding equipment inherits the previously selected group payment method',()=>{
  const source=app.slice(app.indexOf('function setEquipmentPaymentMethod'),app.indexOf('function setIslandPaymentMethod'));
  const context={passengers:[{preAddOns:[{selected:true,paymentMethod:'เงินสด'},{selected:false,paymentMethod:'ลัดดาวรรณ์'}]}],bookingGroupPaymentSelection:{equipment:'เงินสด'},bookingDefaultPaymentMethod:()=> 'ลัดดาวรรณ์',refreshSummary:()=>{},alert:()=>{throw Error('unexpected alert')}};
  vm.runInNewContext(`${source};setEquipmentSelected(0,1,true,{checked:true})`,context);
  assert.equal(context.passengers[0].preAddOns[1].paymentMethod,'เงินสด');
  vm.runInNewContext(`setEquipmentPaymentMethod('ลัดดาวรรณ์')`,context);
  assert.deepEqual(context.passengers[0].preAddOns.map(item=>item.paymentMethod),['ลัดดาวรรณ์','ลัดดาวรรณ์']);
});

test('mixed historical equipment cannot be silently saved',()=>{
  const source=app.slice(app.indexOf('const validateBookingBeforeEquipmentPaymentConsistency'),app.indexOf('const expenseRowsRoot='));
  const context={validateBooking:()=>''};vm.runInNewContext(source,context);
  const booking={passengers:[{preAddOns:[{selected:true,paymentMethod:'เงินสด'},{selected:true,paymentMethod:'ลัดดาวรรณ์'}]}]};
  assert.match(context.validateBooking(booking),/หลายช่องทาง/);
  booking.passengers[0].preAddOns[1].paymentMethod='เงินสด';assert.equal(context.validateBooking(booking),'');
});
test('loading an old booking does not erase conflicting payment methods when centralizing equipment',()=>{
  const source=app.slice(app.indexOf('function centralizeGroupPurchases()'),app.indexOf('function ',app.indexOf('function centralizeGroupPurchases()')+10));
  const context={passengers:[{preAddOns:[{id:'mask',selected:true,qty:1,price:50,nights:1,paymentMethod:'เงินสด'}],islandAddOns:[]},{preAddOns:[{id:'mask',selected:true,qty:1,price:50,nights:1,paymentMethod:'ลัดดาวรรณ์'}],islandAddOns:[]}],equipmentNights:item=>item.nights||1,structuredClone};
  vm.runInNewContext(`${source};centralizeGroupPurchases()`,context);
  assert.equal(context.passengers[0].preAddOns.length,2);assert.deepEqual(context.passengers[0].preAddOns.map(item=>item.paymentMethod),['เงินสด','ลัดดาวรรณ์']);
});
test('opening a booking preserves multiple saved rows with the same equipment code',()=>{
  const source=app.slice(app.indexOf('function loadBookingToForm(b)'),app.indexOf('async function loadTimeline',app.indexOf('function loadBookingToForm(b)')));
  const nodes={},context={editingCode:null,pendingNewBookingCode:null,passengers:[],master:{addOns:[{addon_id:'mask',addon_name:'หน้ากาก',default_price:50}]},document:{getElementById:id=>nodes[id]??=( {value:'',classList:{add(){},remove(){}}})},setSelectValueWithHistory(){},createPassenger:()=>({}),updatePassengerCountInputs(){},toggleReturnDate(){},renderPassengers(){},refreshSummary(){}};
  const booking={bookingCode:'BK1',passengers:[{preAddOns:[{id:'mask',selected:true,paymentMethod:'เงินสด'},{id:'mask',selected:true,paymentMethod:'ลัดดาวรรณ์'}]}]};
  const result={...context,booking};vm.runInNewContext(`${source};loadBookingToForm(booking);result=passengers[0].preAddOns`,result);
  assert.equal(result.result.length,2);assert.deepEqual(Array.from(result.result,item=>item.paymentMethod),['เงินสด','ลัดดาวรรณ์']);
});
