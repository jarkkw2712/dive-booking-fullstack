import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('booking saves reject mixed equipment payment methods and preserve other categories',()=>{
  const route=fs.readFileSync(new URL('../src/routes/bookings.js',import.meta.url),'utf8'),source=route.slice(route.indexOf('function equipmentPaymentConsistencyError'),route.indexOf('async function saveBookingRpc'));
  const context={};vm.runInNewContext(`${source};this.check=equipmentPaymentConsistencyError`,context);
  const b={passengers:[{preAddOns:[{selected:true,paymentMethod:'เงินสด'},{selected:true,paymentMethod:'ลัดดาวรรณ์'}],islandAddOns:[{paymentMethod:'อื่น'}]}]};
  assert.match(context.check(b),/หลายช่องทาง/);
  b.passengers[0].preAddOns[1].paymentMethod='เงินสด';assert.equal(context.check(b),'');
  b.passengers[0].preAddOns[1]={selected:false,paymentMethod:'ลัดดาวรรณ์'};assert.equal(context.check(b),'');
  assert.equal((route.match(/equipmentPaymentConsistencyError\(req\.body\|\|\{\}\)/g)||[]).length,2);
});
