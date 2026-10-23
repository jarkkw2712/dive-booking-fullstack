import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateAuthenticatedUser } from "../src/middleware/auth.js";
import { bankReferencesForUser, bookingForUser } from "../src/services/permissionViews.js";

const payload={userId:"u1",role:"counter",sessionVersion:2,permissions:{editOperatingExpenses:false}};
const activeUser={user_id:"u1",role_id:"counter",active_flag:true,session_version:2,username:"staff",display_name:"Staff"};

test("each request uses current role permissions, not stale JWT permissions",async()=>{
  const result=await validateAuthenticatedUser(payload,async()=>activeUser,async()=>({editOperatingExpenses:true,viewOperatingExpenses:true}));
  assert.equal(result.permissions.editOperatingExpenses,true);
  assert.equal(result.username,"staff");
  await assert.rejects(validateAuthenticatedUser(payload,async()=>({...activeUser,role_id:"finance"}),async()=>({})),/SESSION_REVOKED/);
});

test("bookings hide monetary values and bank references when permission is off",()=>{
  const source={bookingCode:"BK1",totalAmount:1000,passengers:[{firstName:"Guest",program:{price:900}}],payments:[{amount:200,reference_no:"SECRET",slip_url:"PRIVATE"}]};
  const restricted=bankReferencesForUser(bookingForUser(source,{role:"boat_crew",permissions:{viewMoney:false,viewBankReference:false}}),{role:"boat_crew",permissions:{viewBankReference:false}});
  assert.equal(restricted.bookingCode,"BK1");
  assert.equal(restricted.passengers[0].firstName,"Guest");
  assert.equal(restricted.totalAmount,null);
  assert.equal(restricted.passengers[0].program.price,null);
  assert.equal(restricted.payments[0].reference_no,null);
  assert.equal(restricted.payments[0].slip_url,null);
  assert.equal(source.totalAmount,1000);
});

test("permission migration seeds Counter expense access and closes direct client RPC access",()=>{
  const sql=fs.readFileSync(new URL("../../database/migrations/20261023_049_permission_matrix_hardening.sql",import.meta.url),"utf8");
  assert.match(sql,/role_id in \('ceo','management','counter'\)/);
  assert.match(sql,/printManagementReport/);
  assert.match(sql,/revoke all on function %s from public, anon, authenticated/);
  assert.match(sql,/security_invoker=true/);
  assert.match(sql,/on conflict\(role_id,permission_key\) do nothing/);
});
