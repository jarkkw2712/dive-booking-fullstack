const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const code=fs.readFileSync(path.resolve(__dirname,"../js/bookingListFilters.js"),"utf8");
const context=vm.createContext({});
vm.runInContext(code,context);
const master={
  programs:[{program_id:"boat_ticket",program_name:"ตั๋วเรือ"},{program_id:"day_trip",program_name:"One Day Trip"}],
  accommodations:[{accommodation_id:"small_tent",accommodation_name:"เต็นท์เล็ก"},{accommodation_id:"house",accommodation_name:"บ้านพัก"}],
  addOns:[{addon_id:"fin",addon_name:"ฟิน"}],
  islandAddOns:[{island_addon_id:"dive",island_addon_name:"ดำน้ำ"}],
  bookingOriginals:[{original_id:"sabina",original_name:"ซาบีน่า"}],
  customerSources:[{source_id:"fb",source_name:"Facebook"}],
  transportationMethods:[{method_id:"van",method_name:"รถตู้"}],
  islands:[{island_id:"mai_ngam",island_name:"อ่าวไม้งาม"}],
  paymentMethods:[{method_id:"cash",method_name:"เงินสด"},{method_id:"bank_naruemon",method_name:"โอนนฤมล"}]
};
const extra={agents:[{agent_id:"agent_a",agent_name:"เอเจนต์ A"}],statuses:[{status_id:"confirmed",status_name:"ยืนยันแล้ว"}]};
const bookings=[
  {bookingCode:"BK1",status:"confirmed",bookingOriginal:"ซาบีน่า",source:"Facebook",agentName:"เอเจนต์ A",paymentMethod:"เงินสด",depositAmount:1000,depositPaymentMethod:"โอนนฤมล",accommodations:[{accommodationId:"small_tent",accommodationName:"เต็นท์เล็ก"},{accommodationId:"house",accommodationName:"บ้านพัก"}],passengers:[{program:{programId:"boat_ticket",name:"ตั๋วเรือ"},transportationMethod:"รถตู้",returnTransportationMethod:"รถยนต์ส่วนตัว",island:"อ่าวไม้งาม",preAddOns:[{id:"fin",name:"ฟิน",selected:true,paymentMethod:"เงินสด"},{id:"mask",name:"หน้ากาก",selected:false}],islandAddOns:[{id:"dive",name:"ดำน้ำ",paymentMethod:"โอนนฤมล"}]}]},
  {bookingCode:"BK2",status:"pending",source:"Line",paymentMethod:"เงินสด",passengers:[{program:{programId:"day_trip",name:"One Day Trip"},preAddOns:[],islandAddOns:[]}]}
];
function matches(booking,filters){const prepared=context.bookingListPrepareFacets(filters,master,extra,bookings);return context.bookingListMatchesFacets(booking,prepared)}

test("Booking List offers Master Data values plus historical booking values",()=>{
  const programs=context.bookingListFacetOptions(master,extra,bookings,"programs");
  assert.deepEqual(Array.from(programs.map(row=>row.label)),["ตั๋วเรือ","One Day Trip"]);
  const agents=context.bookingListFacetOptions(master,extra,bookings,"agents");
  assert.equal(agents[0].label,"เอเจนต์ A");
  const sources=context.bookingListFacetOptions(master,extra,bookings,"customerSources");
  assert.ok(sources.some(row=>row.value==="Line"&&row.label.includes("รายการเดิม")));
});
test("facets match saved IDs or names, with OR within a category and AND across categories",()=>{
  assert.equal(matches(bookings[0],[{metric:"programs",value:"boat_ticket"},{metric:"accommodations",value:"house"}]),true);
  assert.equal(matches(bookings[1],[{metric:"programs",value:"boat_ticket"}]),false);
  assert.equal(matches(bookings[0],[{metric:"programs",value:"boat_ticket"},{metric:"programs",value:"day_trip"},{metric:"agents",value:"agent_a"}]),true);
  assert.equal(matches(bookings[1],[{metric:"programs",value:"boat_ticket"},{metric:"agents",value:"agent_a"}]),false);
});
test("equipment excludes unselected rows and travel searches both directions",()=>{
  assert.equal(matches(bookings[0],[{metric:"addons",value:"fin"}]),true);
  assert.equal(matches(bookings[0],[{metric:"addons",value:"mask"}]),false);
  assert.equal(matches(bookings[0],[{metric:"islandAddOns",value:"dive"}]),true);
  assert.equal(matches(bookings[0],[{metric:"transportationMethods",value:"van"}]),true);
  assert.equal(matches(bookings[0],[{metric:"transportationMethods",value:"รถยนต์ส่วนตัว"}]),true);
});
test("payment filter includes deposit, selected item and main payment methods",()=>{
  assert.equal(matches(bookings[0],[{metric:"paymentMethods",value:"bank_naruemon"}]),true);
  assert.equal(matches(bookings[0],[{metric:"paymentMethods",value:"cash"}]),true);
  assert.equal(matches(bookings[1],[{metric:"paymentMethods",value:"bank_naruemon"}]),false);
});
test("origin, customer source, island and status follow their respective master categories",()=>{
  for(const filter of [{metric:"bookingOriginals",value:"sabina"},{metric:"customerSources",value:"fb"},{metric:"islands",value:"mai_ngam"},{metric:"statuses",value:"confirmed"}])assert.equal(matches(bookings[0],[filter]),true);
  assert.equal(matches(bookings[1],[{metric:"statuses",value:"confirmed"}]),false);
  assert.equal(matches(bookings[1],[{metric:"customerSources",value:"Line"}]),true);
});
test("Booking List has separate search, results and detail panels",()=>{
  const html=fs.readFileSync(path.resolve(__dirname,"../index.html"),"utf8");
  const css=fs.readFileSync(path.resolve(__dirname,"../css/style.css"),"utf8");
  for(const id of ["blMetric","blValue","blActiveFilters","blResultSummary","bookingList","bookingDetail"])assert.match(html,new RegExp(`id="${id}"`));
  for(const name of ["booking-list-search-panel","booking-list-results-panel","booking-list-detail-panel"])assert.match(html,new RegExp(name));
  assert.match(css,/\.booking-list-workspace\{display:grid;grid-template-columns:[^}]* [^}]* [^}]*;/);
});
