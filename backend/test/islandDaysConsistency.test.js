import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const route=fs.readFileSync(new URL("../src/routes/bookings.js",import.meta.url),"utf8");
const saveSource=route.slice(route.indexOf("async function saveBookingRpc"),route.indexOf("const bookingCache="));

test("reports request the booking read model that includes Island Add-on days",()=>{
  const reports=fs.readFileSync(new URL("../src/routes/reports.js",import.meta.url),"utf8");
  const first=reports.indexOf('rpc("list_bookings_json_v27")');
  assert.ok(first>=0&&first<reports.indexOf('rpc("list_bookings_json_v26")'));
});

test("an old browser cannot silently replace saved Island Add-on days",async()=>{
  const calls=[];
  const context={supabaseAdmin:{rpc:async name=>{calls.push(name);if(name==="list_bookings_json_v27")return{data:[{bookingCode:"BK1",passengers:[{islandAddOns:[{id:"dive",days:3}]}]}]};return{data:{bookingCode:"BK1"}}}},missingBookingRpc:error=>["PGRST202","42883"].includes(error?.code),hasMultiDayIslandAddon:()=>false};
  vm.runInNewContext(`${saveSource};this.save=saveBookingRpc`,context);
  const blocked=await context.save({bookingCode:"BK1",passengers:[{islandAddOns:[{id:"dive",qty:2,price:100}]}]});
  assert.match(blocked.error.message,/รีเฟรช/);
  assert.deepEqual(calls,["list_bookings_json_v27"]);
  const saved=await context.save({bookingCode:"BK1",passengers:[{islandAddOns:[{id:"dive",qty:2,price:100,days:3}]}]});
  assert.equal(saved.data.bookingCode,"BK1");assert.equal(calls.at(-1),"upsert_booking_v30");
});
