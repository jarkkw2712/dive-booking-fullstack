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

test("dive receipt keeps items with different day counts on distinct lines",()=>{
  const source=island.slice(island.indexOf("const groupedItemsBeforeDiveReceipt"));
  const context={documentGroupedItems:()=>[],addonVisibleOnDocument:()=>true,islandAddonDays:item=>Number(item.days??1),islandAddonBillableQty:item=>Number(item.qty??1)*Number(item.days??1)};
  vm.runInNewContext(`${source}\nresult=documentGroupedItems({passengers:[{islandAddOns:[{id:"dive",name:"ดำน้ำ",days:1,qty:1,price:100},{id:"dive",name:"ดำน้ำ",days:3,qty:1,price:100}]}]},{diveOnly:true})`,context);
  assert.equal(context.result.length,2);assert.deepEqual([...context.result].map(row=>row.total),[100,300]);
  assert.match(context.result[0].name,/1 วัน/);assert.match(context.result[1].name,/3 วัน/);
});
