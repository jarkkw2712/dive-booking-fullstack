const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const app=fs.readFileSync(path.resolve(__dirname,"../js/app.js"),"utf8");
const source=app.slice(app.indexOf("let dailyExpenseRows=[];"),app.indexOf("let islandBoatRows=[];"));
const date="2026-10-15";
const oldRow=(code,qty,unitPrice)=>({item_id:`id-${code}`,category_code:code,category_name_snapshot:code,qty,unit_price:unitPrice,amount:qty*unitPrice,revision:1,created_by:"tester"});

test("old park fees, tent and ice become four additional rows without changing the saved amount",()=>{
  const saved=[oldRow("boat_fee",1,100),oldRow("thai_adult_fee",4,100),oldRow("thai_child_fee",2,50),oldRow("foreign_adult_fee",0,500),oldRow("foreign_child_fee",0,250),oldRow("tent_fee",1,80),oldRow("ice",3,50),oldRow("other_old",1,40)];
  const context={bookings:[],saved,date};
  vm.runInNewContext(`${source}\ndailyExpenseRows=normalizeSavedExpenses(saved,date);result={rows:dailyExpenseRows.map(row=>({code:row.code,name:row.name,amount:expenseTotal(row),itemCode:row.itemCode,breakdown:row.breakdown})),park:parkFeeRows.map(row=>({code:row.code,qty:row.qty,unitPrice:row.unitPrice}))};`,context);
  const rows=JSON.parse(JSON.stringify(context.result.rows));
  assert.equal(rows.reduce((sum,row)=>sum+row.amount,0),saved.reduce((sum,row)=>sum+row.amount,0));
  assert.equal(rows.find(row=>row.code==="park_boat_total").amount,100);
  assert.equal(rows.find(row=>row.code==="park_people_total").amount,500);
  assert.equal(rows.find(row=>row.itemCode==="park_tent_fee").amount,80);
  assert.equal(rows.find(row=>row.itemCode==="ice").amount,150);
  assert.equal(rows.find(row=>row.code==="park_people_total").breakdown.length,7);
});

test("the park fee insert button upserts exactly two rows and updates them after quantity changes",()=>{
  const bookings=[{travelDate:date,status:"confirmed",passengers:[{passengerType:"adult",nationalityType:"thai"}]}];
  const context={bookings,date};
  vm.runInNewContext(`${source}\ndailyExpenseRows=normalizeSavedExpenses([],date);insertParkFeeRows(false);insertParkFeeRows(false);parkFeeRows.find(row=>row.code==="thai_adult_fee").qty=2;insertParkFeeRows(false);result=dailyExpenseRows.map(row=>({code:row.code,amount:expenseTotal(row)}));`,context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)),[{code:"park_boat_total",amount:100},{code:"park_people_total",amount:200}]);
});

test("park people fees exclude boat-ticket passengers but keep other programs and boat fee separate",()=>{
  const bookings=[
    {travelDate:date,status:"confirmed",passengers:[
      {passengerType:"adult",nationalityType:"thai",program:{programId:"boat_ticket"}},
      {passengerType:"child",nationalityType:"foreign",program:{programId:"boat_ticket"}},
      {passengerType:"adult",nationalityType:"thai",program:{programId:"one_day"}},
      {passengerType:"child",nationalityType:"foreign",program:{programId:"DO"}},
      {passengerType:"foc",nationalityType:"thai",program:{programId:"one_day"}}
    ]},
    {travelDate:date,status:"cancelled",passengers:[{passengerType:"adult",nationalityType:"thai",program:{programId:"one_day"}}]}
  ];
  const context={bookings,date};
  vm.runInNewContext(`${source}\nresult=defaultDailyExpenses(date).map(row=>({code:row.code,qty:row.qty,amount:expenseTotal(row)}));`,context);
  const rows=JSON.parse(JSON.stringify(context.result));
  assert.equal(rows.find(row=>row.code==="boat_fee").qty,1);
  assert.equal(rows.find(row=>row.code==="thai_adult_fee").qty,1);
  assert.equal(rows.find(row=>row.code==="foreign_child_fee").qty,1);
  assert.equal(rows.find(row=>row.code==="foc_fee").qty,1);
  assert.equal(rows.filter(row=>row.code!=="boat_fee").reduce((sum,row)=>sum+row.amount,0),350);
});
