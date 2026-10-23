import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expenseCategories,expenseClassification } from "../src/services/expenseTaxonomy.js";

const testDir=path.dirname(fileURLToPath(import.meta.url));

test("expense taxonomy offers every approved category and an other option",()=>{
  assert.deepEqual(expenseCategories.map(row=>row.name),[
    "งานทัวร์และอุทยาน","อาหารและวัสดุสิ้นเปลือง","การเดินทางและขนส่ง","พนักงานและค่าแรง",
    "บำรุงรักษาและซ่อมแซม","เงินเดือนและเงินเบิกล่วงหน้า","เงินคืนลูกค้า","อื่น ๆ"
  ]);
  for(const code of ["national_park_fee","park_food_expense","boat_trip_fee","ice","boat_towing","vehicle_expense","day_trip_staff_fee","tour_guide_fee","assistant_fee","other_staff_wages","technician_labor","vehicle_parts","vehicle_repair","salary_advance","salary_payment","customer_refund"])
    assert.ok(expenseCategories.some(group=>group.items.some(item=>item.code===code)),code);
  for(const group of expenseCategories)assert.ok(group.items.some(item=>item.code==="other"),group.code);
});

test("saved expenses validate their category pair while preserving legacy fee codes",()=>{
  assert.deepEqual(expenseClassification({code:"thai_adult_fee"}),{groupCode:"tour_operations",itemCode:"national_park_fee"});
  assert.deepEqual(expenseClassification({code:"other_1",groupCode:"customer_refunds",itemCode:"customer_refund"}),{groupCode:"customer_refunds",itemCode:"customer_refund"});
  assert.throws(()=>expenseClassification({code:"other_2",groupCode:"transportation",itemCode:"salary_payment"}));
  assert.throws(()=>expenseClassification({code:"other_3",groupCode:"other",itemCode:"other",detail:""}));
});

test("classification migration preserves financial snapshots and appends metadata",()=>{
  const sql=fs.readFileSync(path.resolve(testDir,"../../database/migrations/20261023_050_categorized_daily_expenses.sql"),"utf8");
  for(const field of ["expense_group_code","expense_item_code","expense_detail","add column if not exists","save_daily_operating_expenses","v_current_daily_operating_expenses"])
    assert.ok(sql.includes(field),field);
  assert.doesNotMatch(sql,/delete\s+from|truncate|update\s+public\.daily_expense_items\s+set\s+(?:amount|qty|unit_price|category_name_snapshot)/i);
});
