import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sanitizeAuditValue } from "../src/services/auditSanitizer.js";

test("audit sanitizer redacts credentials recursively",()=>{
  const clean=sanitizeAuditValue({username:"staff",password:"secret",nested:{accessToken:"abc",note:"ok"},service_role_key:"key"});
  assert.equal(clean.username,"staff");
  assert.equal(clean.password,"[REDACTED]");
  assert.equal(clean.nested.accessToken,"[REDACTED]");
  assert.equal(clean.nested.note,"ok");
  assert.equal(clean.service_role_key,"[REDACTED]");
});

test("comprehensive audit migration is append-only and indexed",()=>{
  const sql=fs.readFileSync(path.resolve("../database/migrations/20260801_015_comprehensive_audit.sql"),"utf8");
  for(const expected of ["audit_logs_immutable","prevent_audit_history_change","actor_user_id","request_id","ip_address","status_code","revoke update,delete,truncate"])
    assert.match(sql,new RegExp(expected,"i"));
});

test("mutation middleware covers all state-changing HTTP methods",()=>{
  const service=fs.readFileSync(path.resolve("src/services/auditService.js"),"utf8");
  for(const method of ["POST","PUT","PATCH","DELETE"])assert.match(service,new RegExp(`\\"${method}\\"`));
  assert.match(service,/res\.on\("finish"/);
  assert.match(service,/success:res\.statusCode<400/);
});

test("unified audit endpoint includes system, auth and financial histories",()=>{
  const route=fs.readFileSync(path.resolve("src/routes/auditLogs.js"),"utf8");
  assert.match(route,/requirePermission\("viewAudit"\)/);
  for(const table of ["audit_logs","auth_audit_logs","financial_events"])assert.match(route,new RegExp(table));
});
