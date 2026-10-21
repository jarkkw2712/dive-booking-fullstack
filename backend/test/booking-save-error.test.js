import test from "node:test";
import assert from "node:assert/strict";
import { bookingSaveError } from "../src/services/bookingSaveError.js";

test("stale route details are a conflict with a useful correction path",()=>{
  const failure=bookingSaveError({message:"Booking has new route details. Refresh the page before saving."});
  assert.equal(failure.status,409);
  assert.match(failure.message,/ประเภทผู้เดินทาง/);
});

test("migration and unrelated errors keep their existing status",()=>{
  assert.equal(bookingSaveError({message:"missing RPC"},true).status,503);
  assert.equal(bookingSaveError({message:"unexpected"}).status,500);
});
