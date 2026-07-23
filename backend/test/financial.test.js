import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateInvoice, validatePayment, validateRefund, calculateFinancialTotals } from "../src/validators/financialValidator.js";
import { requirePermission } from "../src/middleware/auth.js";
import { requireAuth } from "../src/middleware/auth.js";
import jwt from "jsonwebtoken";
import { hashPassword,verifyPassword,validatePasswordPolicy,createPasswordResetToken,hashResetToken } from "../src/services/passwordService.js";
import { configuredEmailProvider } from "../src/services/emailService.js";

test("invoice accepts numeric money and immutable snapshot fields",()=>{
  const input={items:[{itemName:"One Day Trip",qty:2,unitPrice:2500}]};
  assert.equal(validateInvoice(input),input);
});
test("invoice rejects invalid quantity",()=>assert.throws(()=>validateInvoice({items:[{itemName:"Trip",qty:0,unitPrice:1}]}),/positive/));
test("partial payment accepts a positive two-decimal amount",()=>assert.equal(validatePayment({amount:2000,methodId:"cash"}).amount,2000));
test("deposit and partial payments produce correct outstanding",()=>{
  assert.deepEqual(calculateFinancialTotals({invoicedAmount:12900,verifiedPaidAmount:7000,refundedAmount:0}),{outstandingAmount:5900,netCashReceived:7000});
});
test("refund changes net received but does not rewrite invoice history",()=>{
  assert.deepEqual(calculateFinancialTotals({invoicedAmount:12900,verifiedPaidAmount:12900,refundedAmount:900}),{outstandingAmount:0,netCashReceived:12000});
});
test("bank transfer requires reference",()=>assert.throws(()=>validatePayment({amount:500,methodId:"bank_transfer"}),/reference/));
test("refund requires immutable reason",()=>assert.throws(()=>validateRefund({amount:100,method:"cash"}),/reason/));
test("backend permission middleware rejects missing financial permission",()=>{
  const middleware=requirePermission("verifyPayment");let status=0,payload;
  middleware({user:{role:"counter",permissions:{verifyPayment:false}}},{status(code){status=code;return this},json(value){payload=value}},()=>assert.fail("must not pass"));
  assert.equal(status,403);assert.match(payload.error,/verifyPayment/);
});
test("admin cannot be locked out by permission row",()=>{
  const middleware=requirePermission("approveRefund");let passed=false;
  middleware({user:{role:"admin",permissions:{}}},{},()=>{passed=true});assert.equal(passed,true);
});
test("financial migration enforces idempotency and immutable history",()=>{
  const migration=fs.readFileSync(path.resolve("../database/migrations/20260722_002_financial_foundation.sql"),"utf8");
  assert.match(migration,/idempotency_key text unique/);
  assert.match(migration,/invoice_items_immutable/);
  assert.match(migration,/financial_events_immutable/);
  assert.doesNotMatch(migration,/on delete cascade/i);
});
test("transactional functions reject over-allocation and generate numbers server-side",()=>{
  const migration=fs.readFileSync(path.resolve("../database/migrations/20260722_003_financial_functions.sql"),"utf8");
  assert.match(migration,/Allocation exceeds invoice outstanding amount/);
  assert.match(migration,/next_financial_document_no/);
  assert.doesNotMatch(migration,/Date\.now/);
});
test("per-user passwords use salted scrypt hashes",async()=>{
  const hash1=await hashPassword("Sabina!Secure2026"),hash2=await hashPassword("Sabina!Secure2026");
  assert.notEqual(hash1,hash2);assert.equal(await verifyPassword("Sabina!Secure2026",hash1),true);assert.equal(await verifyPassword("wrong-password",hash1),false);assert.equal(hash1.includes("Sabina!Secure2026"),false);
});
test("password policy rejects weak employee passwords",()=>{
  assert.throws(()=>validatePasswordPolicy("password123"),/12 characters/);
  assert.throws(()=>validatePasswordPolicy("alllowercasepassword"),/at least 3/);
});
test("password reset stores only a deterministic token hash",()=>{
  const {token,tokenHash}=createPasswordResetToken();assert.equal(tokenHash,hashResetToken(token));assert.equal(tokenHash.includes(token),false);
});
test("authentication migration adds expiring one-time reset tokens",()=>{
  const migration=fs.readFileSync(path.resolve("../database/migrations/20260722_006_per_user_authentication.sql"),"utf8");assert.match(migration,/password_reset_tokens/);assert.match(migration,/expires_at>now\(\)/);assert.match(migration,/used_at is null/);assert.match(migration,/consume_password_reset/);
});
test("forced-change token cannot access business routes",()=>{
  const original=process.env.JWT_SECRET;process.env.JWT_SECRET="unit-test-jwt-secret";
  const token=jwt.sign({userId:"user-1",mustChangePassword:true},process.env.JWT_SECRET);
  let status=0,payload,nextCalled=false;requireAuth({headers:{authorization:`Bearer ${token}`},originalUrl:"/api/bookings"},{status(code){status=code;return this},json(value){payload=value}},()=>{nextCalled=true});
  assert.equal(nextCalled,false);assert.equal(status,403);assert.match(payload.error,/Password change required/);
  if(original===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=original;
});
test("Resend is primary and SMTP remains the no-key fallback",()=>{
  assert.equal(configuredEmailProvider({RESEND_API_KEY:"re_test"}),"resend");
  assert.equal(configuredEmailProvider({}),"smtp");
});
