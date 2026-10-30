const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const island=fs.readFileSync(path.join(root,"js","islandAddonMaster.js"),"utf8");
const app=fs.readFileSync(path.join(root,"js","app.js"),"utf8");

test("Island Add-on defaults to one day and bills days times quantity times unit price",()=>{
  const context={};
  vm.runInNewContext(`${island.slice(island.indexOf("const islandAddonDays"),island.indexOf("documentProfiles.DIVE_RECEIPT"))}\nresult=[islandAddonBillableQty({qty:2,days:3}),islandAddonBillableQty({qty:2})]`,context);
  assert.deepEqual([...context.result],[6,2]);
  assert.match(island,/label>จำนวนวัน<\/label>/);
  assert.match(island,/updateIslandAddon\(\$\{row\.savedIndex\},'days'/);
  assert.match(app,/islandAddOnRevenue:isl/);
  assert.match(app,/islandAddonBillableQty\(item\)\*Number\(item\.price\|\|0\)/);
});
