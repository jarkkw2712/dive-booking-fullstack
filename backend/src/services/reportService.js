const activeBooking=booking=>booking.status!=="cancelled";
const passengersOf=booking=>Array.isArray(booking.passengers)?booking.passengers:[];
const accommodationsOf=booking=>Array.isArray(booking.accommodations)&&booking.accommodations.length?booking.accommodations:passengersOf(booking).filter(person=>person.accommodationId);
const personName=person=>[person.title,person.firstName,person.lastName].filter(Boolean).join(" ");
const leaderName=booking=>[booking.leaderTitle,booking.leaderFirstName,booking.leaderLastName].filter(Boolean).join(" ");
const isoDate=(date,offset=0)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10)};
const money=value=>Number(value||0);
const sumMoney=(values,amount)=>values.reduce((sum,value)=>sum+Math.round(money(amount(value))*100),0)/100;
const accommodationQuantity=person=>person?.accommodationId?Math.max(Number(person.accommodationQty??1),0):0;
const accommodationUnitPrice=person=>Math.max(money(person?.accommodationPrice),0);
const accommodationNights=person=>{
  if(!person?.accommodationId||!tentSize(person))return 1;
  const nights=Number(person.accommodationNights??1);
  return Number.isInteger(nights)&&nights>0?nights:1;
};
const accommodationRevenue=person=>person?.accommodationBookedBy==="company"?accommodationQuantity(person)*accommodationNights(person)*accommodationUnitPrice(person):0;
const accommodationLabel={none:"ไม่นอน",park_house:"บ้านพักอุทยาน",park_tent:"เต็นท์อุทยาน"};
const passengerTypeLabel={adult:"ผู้ใหญ่",child:"เด็ก",infant:"ทารก",foc:"FOC"};

function equipmentSummary(entries){
  const totals=new Map();
  for(const {booking} of entries)for(const person of passengersOf(booking))for(const addon of person.preAddOns||[]){
    if(addon.selected===false)continue;
    const key=addon.id||addon.name||"other",current=totals.get(key)||{code:key,name:addon.name||key,qty:0};
    current.qty+=Number(addon.qty||1);totals.set(key,current);
  }
  return [...totals.values()].sort((a,b)=>a.name.localeCompare(b.name,"th"));
}

function accommodationSummary(entries){
  const people=entries.flatMap(({booking})=>accommodationsOf(booking));
  return{
    parkHouse:people.filter(person=>person.accommodationId==="park_house").reduce((sum,person)=>sum+accommodationQuantity(person),0),
    parkTent:people.filter(person=>person.accommodationId==="park_tent").reduce((sum,person)=>sum+accommodationQuantity(person),0),
    none:people.filter(person=>!person.accommodationId).length,
    customerSelfBooked:people.filter(person=>person.accommodationId&&person.accommodationBookedBy!=="company").reduce((sum,person)=>sum+accommodationQuantity(person),0),
    companyBooked:people.filter(person=>person.accommodationId&&person.accommodationBookedBy==="company").reduce((sum,person)=>sum+accommodationQuantity(person),0),
    customerReferenceValue:people.filter(person=>person.accommodationBookedBy!=="company").reduce((sum,person)=>sum+accommodationQuantity(person)*accommodationNights(person)*accommodationUnitPrice(person),0),
    companyRevenue:people.reduce((sum,person)=>sum+accommodationRevenue(person),0),
    note:"ลูกค้าจองเองเก็บเพื่อการปฏิบัติงานและไม่รวมรายได้; เราจองให้คิดจำนวน × ราคา (เต็นท์คูณจำนวนคืนที่พนักงานกรอก)"
  };
}

function movements(bookings,date){
  return bookings.filter(activeBooking).flatMap(booking=>{
    const result=[];
    if(booking.travelDate===date)result.push({booking,direction:"ลงเกาะ",movement:"arrival"});
    if(booking.returnDate===date)result.push({booking,direction:"ขึ้นจากเกาะ",movement:"departure"});
    return result;
  });
}

function passengerRows(entries,{includeHealth=false}={}){
  return entries.flatMap(({booking,direction,date})=>passengersOf(booking).map(person=>({
    date:date||booking.travelDate,direction,
    bookingCode:booking.bookingCode,
    passenger:personName(person),
    passengerType:passengerTypeLabel[person.passengerType||"adult"]||"ผู้ใหญ่",
    nationality:person.nationalityType==="foreign"?"ต่างชาติ":"ไทย",
    age:person.age||"",
    phone:person.phone||booking.phone||"",
    pickupLocation:person.pickupLocation||"",transportationMethod:person.transportationMethod||booking.transportationMethod||"",returnTransportationMethod:person.returnTransportationMethod||person.transportationMethod||booking.transportationMethod||"",transportationQuantity:transportQuantity(person.transportationQuantity),returnTransportationQuantity:transportQuantity(person.returnTransportationQuantity),transportationAmount:transportAmount(person.transportationAmount,person.transportationQuantity),returnTransportationAmount:transportAmount(person.returnTransportationAmount,person.returnTransportationQuantity),passengerTravelDate:person.passengerTravelDate||booking.travelDate||"",outboundDestination:person.outboundDestination||person.transportationDestination||person.pickupLocation||"",passengerReturnDate:person.passengerReturnDate||booking.returnDate||"",returnDestination:person.returnDestination||"",
    program:person.program?.name||"",
    island:person.island||"",
    accommodation:person.accommodationName||bookingAccommodationText(booking)||accommodationLabel[person.parkAccommodationType||"none"]||"",
    accommodationBookedBy:person.accommodationId?(person.accommodationBookedBy==="company"?"เราจองให้":"ลูกค้าจองเอง"):accommodationsOf(booking).length?"ดูรายการที่พักของ Booking":"",
    accommodationQty:accommodationQuantity(person),
    accommodationPrice:accommodationUnitPrice(person),
    accommodationTotal:accommodationRevenue(person),
    accommodationReference:person.parkAccommodationReference||"",
    accommodationArrangement:person.accommodationId?(person.accommodationBookedBy==="company"?"เราจองให้":"ลูกค้าจองเอง"):"",
    ...(includeHealth?{foodAllergy:person.foodAllergy||"",medicalNote:person.medicalNote||""}:{}),
    status:booking.status
  })));
}

function financeMap(financialRows){
  return new Map((financialRows||[]).map(row=>[row.booking_code||row.bookingCode,row]));
}

const reportDays=(from,to)=>{const days=[];for(let day=from;day<=to&&days.length<366;day=isoDate(day,1))days.push(day);return days};
const namedPaymentAccounts=["นฤมล","เรืองโรจน์","รุ่งฤดี","ลัดดาวรรณ์","รุจิโรจน์"];
const paymentDefaultName={general:"นฤมล",equipment:"ลัดดาวรรณ์",island:"เรืองโรจน์",transport:"ลัดดาวรรณ์"};
const paymentDefaultField={general:"default_general",equipment:"default_equipment",island:"default_island",transport:"default_transport"};
const normalized=value=>String(value||"").trim().toLocaleLowerCase("th-TH");
const paymentMeta=(name,methods=[])=>methods.find(method=>method.method_name===name)||null;
const paymentKind=(name,methods=[])=>{const method=paymentMeta(name,methods),code=normalized(method?.method_id);if(code==="cash")return"cash";if(code.includes("bank_transfer"))return"transfer";if(method?.payment_type==="cash")return"cash";if(method?.payment_type==="transfer")return"transfer";return/cash|สด/i.test(String(name||""))?"cash":"transfer"};
const bookingSavedPaymentMethod=(booking,kind)=>{
  const field=kind==="deposit"?"depositPaymentMethod":"creditPaymentMethod",saved=String(booking?.[field]||"").trim();
  if(saved)return saved;
  const allocations=Object.entries(booking?.paymentBreakdown?.[kind]||{}).filter(([,amount])=>money(amount)>0);
  if(allocations.length===1)return allocations[0][0];
  return kind==="deposit"&&money(booking?.depositAmount)>0?(booking?.paymentMethod||""):"";
};
const defaultPayment=(methods,scope)=>{const active=methods.filter(method=>method.active_flag!==false);return active.find(method=>method[paymentDefaultField[scope]]===true)?.method_name||active.find(method=>String(method.method_name||"").trim()===paymentDefaultName[scope])?.method_name||""};
const namedAccount=name=>namedPaymentAccounts.find(account=>String(name||"").includes(account))||"";
const accountTransferTotal=(lines,account,methods)=>sumMoney(lines.filter(line=>namedAccount(line.paymentMethod)===account&&paymentKind(line.paymentMethod,methods)==="transfer"),line=>line.amount);
const isBoatProgram=program=>normalized(program?.programId||program?.id)==="boat_ticket";
const packageDetail=program=>{
  const id=normalized(program?.programId||program?.id);
  if(id==="one_day")return"oneDay";
  if(id==="do")return"dayTripOvernight";
  return"";
};
const isTentAddon=addon=>normalized(addon?.id||addon?.code)==="tent";
const isVanMethod=(name,methods=[])=>{
  const key=normalized(name),master=methods.find(row=>normalized(row.method_name)===key||normalized(row.method_id)===key),code=normalized(master?.method_id||"");
  return code.includes("van")||code.includes("pv")||/รถตู้|\bvan\b/i.test(String(name||""));
};
const lineAmount=(qty,price)=>money(qty||1)*money(price);
const paymentCents=value=>Math.max(0,Math.round(money(value)*100));
function proportionalPaymentShares(amount,capacities){
  const total=capacities.reduce((sum,value)=>sum+value,0);
  if(!amount||!total)return capacities.map(()=>0);
  const shares=capacities.map(value=>Math.floor(amount*value/total));
  let remainder=amount-shares.reduce((sum,value)=>sum+value,0);
  const order=capacities.map((value,index)=>({index,fraction:amount*value/total-shares[index]})).sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
  for(const {index} of order){if(!remainder)break;if(shares[index]<capacities[index]){shares[index]++;remainder--}}
  return shares;
}
function splitProgramRevenueLines(booking,lines,{includeDeposit=false,includeCredit=true}={}){
  const breakdown=booking.paymentBreakdown||{};
  if(breakdown.version!==2)return lines;
  const capacities=lines.map(line=>paymentCents(line.amount)),gross=capacities.reduce((sum,value)=>sum+value,0);
  if(!gross)return lines;
  const primary=breakdown.primary?.method||booking.paymentMethod||"",secondary=breakdown.secondary?.method||"";
  const deposit=includeDeposit?Math.min(paymentCents(booking.depositAmount),gross):0;
  const credit=includeCredit?Math.min(paymentCents(booking.creditAmount),gross-deposit):0;
  const secondaryAmount=secondary?Math.min(paymentCents(breakdown.secondary?.amount),gross-deposit-credit):0;
  const portions=[...(deposit?[{method:bookingSavedPaymentMethod(booking,"deposit")||primary,amount:deposit}]:[]),...(credit?[{method:bookingSavedPaymentMethod(booking,"credit")||primary,amount:credit}]:[]),...(secondaryAmount?[{method:secondary,amount:secondaryAmount}]:[]),{method:primary,amount:gross-deposit-credit-secondaryAmount}];
  const remaining=[...capacities],result=[];
  for(const portion of portions){const shares=proportionalPaymentShares(portion.amount,remaining);shares.forEach((share,index)=>{if(share)result.push({...lines[index],amount:share/100,paymentMethod:portion.method});remaining[index]-=share})}
  return result;
}
function bookingProgramPaymentLabel(booking){
  const breakdown=booking.paymentBreakdown||{};
  if(breakdown.version!==2)return booking.paymentMethod||"";
  const gross=sumMoney(passengersOf(booking).filter(person=>person.program),person=>lineAmount(person.program.qty,person.program.price));
  const due=Math.max(paymentCents(gross)-paymentCents(booking.depositAmount)-paymentCents(booking.creditAmount),0);
  const secondary=breakdown.secondary?.method?Math.min(paymentCents(breakdown.secondary.amount),due):0;
  const primary=`หลัก ${breakdown.primary?.method||booking.paymentMethod||"ไม่ระบุ"} ${(due-secondary)/100} บาท`;
  return secondary?`${primary} / สำรอง ${breakdown.secondary.method} ${secondary/100} บาท`:primary;
}
const transportQuantity=value=>{const quantity=Number(value??1);return Number.isInteger(quantity)&&quantity>0?quantity:1};
const transportAmount=(price,quantity)=>money(price)*transportQuantity(quantity);
const equipmentBillableUnits=addon=>money(addon.qty||1)*money(addon.nights??1);

function transportationRevenueLines(booking,paymentMethods,transportationMethods=[]){
  const rows=[];
  for(const person of passengersOf(booking)){
    const outboundMethod=person.transportationMethod||booking.transportationMethod||"",outboundQuantity=transportQuantity(person.transportationQuantity),outboundAmount=transportAmount(person.transportationAmount,outboundQuantity);
    if(outboundMethod||outboundAmount){const from=person.outboundDestination||person.transportationDestination||person.pickupLocation||"ไม่ระบุ",to=person.outboundTo||"ไม่ระบุ";rows.push({source:"transport",direction:"ขาไป",method:outboundMethod,quantity:outboundQuantity,amount:outboundAmount,paymentMethod:person.transportationPaymentMethod||defaultPayment(paymentMethods,isVanMethod(outboundMethod,transportationMethods)?"transport":"general")||booking.paymentMethod||"",operationalDate:person.passengerTravelDate||booking.travelDate||"",from,to,destination:`${from} → ${to}`})}
    const returnMethod=person.returnTransportationMethod||"",returnQuantity=transportQuantity(person.returnTransportationQuantity),returnAmount=transportAmount(person.returnTransportationAmount,returnQuantity);
    if(returnMethod||returnAmount){const from=person.returnDestination||"ไม่ระบุ",to=person.returnTo||"ไม่ระบุ";rows.push({source:"transport",direction:"ขากลับ",method:returnMethod,quantity:returnQuantity,amount:returnAmount,paymentMethod:person.returnTransportationPaymentMethod||defaultPayment(paymentMethods,isVanMethod(returnMethod,transportationMethods)?"transport":"general")||booking.paymentMethod||"",operationalDate:person.passengerReturnDate||booking.returnDate||"",from,to,destination:`${from} → ${to}`})}
    for(const [index,stop] of (person.extraTransportStops||[]).entries()){
      const method=stop.method||"",quantity=transportQuantity(stop.quantity),amount=transportAmount(stop.amount,quantity);
      if(!method&&!amount)continue;
      const from=stop.from||"ไม่ระบุ",to=stop.to||"ไม่ระบุ";
      rows.push({source:"transport",direction:`จุดแวะ ${index+1}`,method,quantity,amount,paymentMethod:stop.paymentMethod||defaultPayment(paymentMethods,isVanMethod(method,transportationMethods)?"transport":"general")||booking.paymentMethod||"",operationalDate:stop.date||"",from,to,destination:`${from} → ${to}`});
    }
  }
  return rows;
}

function serviceRevenueLines(booking,paymentMethods){
  const rows=[];
  for(const person of passengersOf(booking)){
    if(person.program)rows.push({source:isBoatProgram(person.program)?"boat":"package",packageDetail:packageDetail(person.program),amount:lineAmount(person.program.qty,person.program.price),paymentMethod:booking.paymentMethod||defaultPayment(paymentMethods,"general")});
    for(const addon of person.preAddOns||[]){if(addon.selected===false)continue;rows.push({source:isTentAddon(addon)?"tent":"equipment",amount:lineAmount(equipmentBillableUnits(addon),addon.price),paymentMethod:addon.paymentMethod||defaultPayment(paymentMethods,"equipment")||booking.paymentMethod||""})}
    for(const addon of person.islandAddOns||[])rows.push({source:"island",amount:lineAmount(addon.qty,addon.price),paymentMethod:addon.paymentMethod||defaultPayment(paymentMethods,"island")||booking.paymentMethod||""});
  }
  for(const accommodation of accommodationsOf(booking))if(accommodation.accommodationBookedBy==="company")rows.push({source:"accommodation",amount:accommodationRevenue(accommodation),paymentMethod:booking.paymentMethod||defaultPayment(paymentMethods,"general")});
  rows.push(...transportationRevenueLines(booking,paymentMethods));
  return rows;
}

// Deposits and credit sales have their own report columns. Deduct both from
// cash/transfer sale lines (programs first) so neither amount is counted twice.
// Keep amounts in cents while allocating to avoid fractional-baht drift.
function tourRevenueLines(booking,paymentMethods){
  const lines=serviceRevenueLines(booking,paymentMethods).filter(line=>line.source!=="transport").map(line=>({...line}));
  for(const allocated of [booking.depositAmount,booking.creditAmount]){
    let remaining=paymentCents(allocated);
    for(const group of [lines.filter(line=>line.source==="boat"||line.source==="package"),lines.filter(line=>line.source!=="boat"&&line.source!=="package")]){
      const cents=group.map(line=>paymentCents(line.amount)),gross=cents.reduce((sum,value)=>sum+value,0),deduction=Math.min(remaining,gross);
      if(!deduction)continue;
      const deductions=proportionalPaymentShares(deduction,cents);
      group.forEach((line,index)=>{line.amount=(cents[index]-deductions[index])/100});
      remaining-=deduction;
    }
  }
  const programs=lines.filter(line=>line.source==="boat"||line.source==="package");
  return[...splitProgramRevenueLines(booking,programs,{includeCredit:false}),...lines.filter(line=>line.source!=="boat"&&line.source!=="package")];
}

function tourExpenseReferenceReport(bookings,date,toDate,paymentMethods){
  const days=reportDays(date,toDate),rows=days.map(day=>{
    const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day),services=daily.flatMap(booking=>tourRevenueLines(booking,paymentMethods));
    const sum=(source,kind)=>sumMoney(services.filter(line=>(!source||line.source===source)&&(!kind||paymentKind(line.paymentMethod,paymentMethods)===kind)),line=>line.amount);
    const detailSum=(detail,kind)=>sumMoney(services.filter(line=>line.source==="package"&&line.packageDetail===detail&&paymentKind(line.paymentMethod,paymentMethods)===kind),line=>line.amount);
    const packageSum=kind=>sumMoney(services.filter(line=>line.source==="package"&&!line.packageDetail&&paymentKind(line.paymentMethod,paymentMethods)===kind),line=>line.amount);
    const deposits=daily.map(booking=>({amount:money(booking.depositAmount),method:bookingSavedPaymentMethod(booking,"deposit")||booking.paymentMethod||""}));
    const accountLines=[...services,...deposits.map(row=>({amount:row.amount,paymentMethod:row.method,source:"deposit"}))],accountTotals=Object.fromEntries(namedPaymentAccounts.map(account=>[account,sumMoney(accountLines.filter(line=>namedAccount(line.paymentMethod)===account),line=>line.amount)]));
    return{
      date:day,boatCash:sum("boat","cash"),boatTransfer:sum("boat","transfer"),packageCash:packageSum("cash"),packageTransfer:packageSum("transfer"),
      tentCash:sum("tent","cash"),tentTransfer:sum("tent","transfer"),accommodationCash:sum("accommodation","cash"),accommodationTransfer:sum("accommodation","transfer"),oneDayCash:detailSum("oneDay","cash"),oneDayTransfer:detailSum("oneDay","transfer"),dayTripOvernightCash:detailSum("dayTripOvernight","cash"),dayTripOvernightTransfer:detailSum("dayTripOvernight","transfer"),
      deposit:sumMoney(deposits,row=>row.amount),credit:sumMoney(daily,booking=>booking.creditAmount),
      naruemonTransfer:sumMoney(services.filter(line=>["boat","package","tent"].includes(line.source)&&namedAccount(line.paymentMethod)==="นฤมล"&&paymentKind(line.paymentMethod,paymentMethods)==="transfer"),line=>line.amount),
      rungruedeeTransfer:accountTransferTotal(accountLines,"รุ่งฤดี",paymentMethods),
      rujirojDepositCash:sumMoney(deposits.filter(row=>namedAccount(row.method)==="รุจิโรจน์"&&paymentKind(row.method,paymentMethods)==="cash"),row=>row.amount),
      rujirojDepositTransfer:sumMoney(deposits.filter(row=>namedAccount(row.method)==="รุจิโรจน์"&&paymentKind(row.method,paymentMethods)==="transfer"),row=>row.amount),
      totalRevenue:sumMoney(daily.flatMap(booking=>serviceRevenueLines(booking,paymentMethods)).filter(line=>line.source!=="transport"),line=>line.amount),accounts:accountTotals
    };
  }),moneyFields=["boatCash","boatTransfer","packageCash","packageTransfer","tentCash","tentTransfer","accommodationCash","accommodationTransfer","oneDayCash","oneDayTransfer","dayTripOvernightCash","dayTripOvernightTransfer","deposit","credit","naruemonTransfer","rungruedeeTransfer","rujirojDepositCash","rujirojDepositTransfer","totalRevenue"],totals=Object.fromEntries(moneyFields.map(field=>[field,sumMoney(rows,row=>row[field])]));
  totals.accounts=Object.fromEntries(namedPaymentAccounts.map(account=>[account,sumMoney(rows,row=>row.accounts?.[account])]));
  const monthly=tourMonthlyReferenceReport(bookings,date,toDate,paymentMethods);
  return{date,type:"tour_expense_reference",title:"รายงานทัวร์และค่าใช้จ่าย",purpose:"ยอดตามวันเดินทางไป แยกมัดจำและขายเชื่อจากยอดสด/โอน ไม่รวมค่าเดินทาง",range:{from:date,to:toDate},rows,totals,monthlyRows:monthly.rows,monthlyTotals:monthly.totals,accountNames:namedPaymentAccounts,sourceNotes:["วันที่อ้างอิงวันเดินทางไปของ Booking","ตั๋วเรือใช้ Program code boat_ticket; แพ็คเกจไม่รวม One Day Trip และ Day Trip Overnight","One Day Trip ใช้ code one_day และ Day Trip Overnight ใช้ code DO; ทั้งคู่มีคอลัมน์แยก ไม่รวมซ้ำในแพ็คเกจ","ยอดสด/โอนหักมัดจำและขายเชื่อก่อน โดยตัดจาก Program ก่อน แล้วจึงตัดจากรายการอื่น","โอนนฤมลรวมยอดโอนตั๋วเรือ แพ็คเกจ One Day Trip Day Trip Overnight และเต็นท์หลังหักมัดจำ/ขายเชื่อ; โอนรุ่งฤดีคือยอดขายสุทธิและมัดจำที่เข้าบัญชีรุ่งฤดี ไม่บวกซ้ำในรวมรายได้","รวมรายได้นับยอดขายครั้งเดียว รวมมัดจำ ขายเชื่อ อุปกรณ์และ Island Add-on แต่ไม่รวมค่าเดินทาง","เต็นท์ใช้อุปกรณ์ code tent"]};
}

function tentFeeReferenceReport(bookings,date,toDate){
  const rows=[];for(const booking of bookings.filter(booking=>activeBooking(booking)&&booking.travelDate>=date&&booking.travelDate<=toDate)){
    const tents=passengersOf(booking).flatMap(person=>(person.preAddOns||[]).filter(addon=>addon.selected!==false&&isTentAddon(addon))),people=tents.reduce((sum,addon)=>sum+money(addon.qty||1),0);if(!people)continue;
    const start=new Date(`${booking.travelDate}T00:00:00Z`),end=booking.returnDate?new Date(`${booking.returnDate}T00:00:00Z`):start,nights=Math.max(Math.round((end-start)/86400000),0),program=uniqueValues(passengersOf(booking),person=>person.program?.name);
    rows.push({leader:leaderName(booking),program,travelDate:booking.travelDate||"",returnDate:booking.returnDate||"",nights,people,rate:80,total:nights*people*80,note:booking.bookingNote||""});
  }
  return{date,type:"tent_fee_reference",title:"รายงานค่าธรรมเนียมเต็นท์",purpose:"อุปกรณ์ code tent × จำนวนคืน × 80 บาท",range:{from:date,to:toDate},rows,totals:{people:rows.reduce((sum,row)=>sum+row.people,0),amount:rows.reduce((sum,row)=>sum+row.total,0)},sourceNotes:["วันที่อ้างอิงวันเดินทางไป","จำนวนคนอ้างอิง Qty ของอุปกรณ์ code tent","อัตราคงที่ 80 บาทต่อคนต่อคืน"]};
}

function packageRatesFor(program,rates=[]){const programId=String(program?.programId||program?.id||"").trim();return(rates||[]).filter(rate=>rate.active_flag!==false&&String(rate.program_id||"").trim()===programId)}
const packageCostField={park_food:"parkFood",park_fee:"parkFee",park_tent:"parkTent",sabina_food:"sabinaFood",longtail:"longtail",equipment:"equipment",refreshment:"refreshment",guide:"guide",sabina_tent:"sabinaTent",insurance:"insurance",agent:"agentCost"};
function packageCostReport(bookings,date,packageCostRates=[]){
  const rows=[],tentAllocationWarnings=[];
  for(const booking of bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date)){
    const groups=new Map();
    const bookingStays=Array.isArray(booking.accommodations)?booking.accommodations:[];
    const allBookingStaysTent=bookingStays.length>0&&bookingStays.every(stay=>Boolean(tentSize(stay)));
    const mixedBookingStays=bookingStays.some(stay=>tentSize(stay))&&bookingStays.some(stay=>!tentSize(stay));
    const hasIndividualStay=passengersOf(booking).some(person=>person.accommodationId||["park_tent","park_house"].includes(person.parkAccommodationType));
    for(const person of passengersOf(booking)){
      const program=person.program;if(!program||isBoatProgram(program))continue;
      const price=money(program.price),key=program.programId||program.name,row=groups.get(key)||{leader:leaderName(booking),program:program.name||program.programId||"",programData:program,qty:0,tentQty:0,amount:0,prices:new Map(),note:booking.bookingNote||""};
      const qty=Math.max(money(program.qty||1),0);row.qty+=qty;row.amount+=qty*price;row.prices.set(price,(row.prices.get(price)||0)+qty);
      if(tentSize(person)||person.parkAccommodationType==="park_tent")row.tentQty+=qty;
      groups.set(key,row);
    }
    if(groups.size&&mixedBookingStays&&!hasIndividualStay)tentAllocationWarnings.push(`${leaderName(booking)} (${booking.bookingCode||"ไม่ระบุเลข Booking"})`);
    for(const source of groups.values()){
      const tentQty=hasIndividualStay?source.tentQty:allBookingStaysTent?source.qty:0;
      const priceBreakdown=[...source.prices].map(([price,qty])=>({price,qty}));
      const result={leader:source.leader,program:source.program,qty:source.qty,tentQty,price:priceBreakdown.length===1?priceBreakdown[0].price:null,priceBreakdown,amount:source.amount,parkFood:0,parkFee:0,parkTent:0,parkTotal:0,sabinaFood:0,longtail:0,equipment:0,refreshment:0,guide:0,sabinaTent:0,insurance:0,agentCost:0,sabinaTotal:0,balance:0,note:source.note,missingRates:false};
      const rates=packageRatesFor(source.programData,packageCostRates);result.missingRates=!rates.length;
      for(const rate of rates){const field=packageCostField[rate.cost_code];if(field)result[field]+=(rate.cost_code==="park_tent"||rate.cost_code==="sabina_tent"?tentQty:source.qty)*money(rate.unit_rate)}
      result.parkTotal=result.parkFood+result.parkFee+result.parkTent;
      result.sabinaTotal=result.sabinaFood+result.longtail+result.equipment+result.refreshment+result.guide+result.sabinaTent+result.insurance+result.agentCost;
      result.balance=result.amount-result.parkTotal-result.sabinaTotal;rows.push(result);
    }
  }
  const fields=["qty","amount","parkFood","parkFee","parkTent","parkTotal","sabinaFood","longtail","equipment","refreshment","guide","sabinaTent","insurance","agentCost","sabinaTotal","balance"],totals=Object.fromEntries(fields.map(field=>[field,rows.reduce((sum,row)=>sum+money(row[field]),0)]));
  return{date,type:"package_cost_reference",title:"แพ็คเกจ",purpose:"ยอดขายและต้นทุนแพ็คเกจประจำวัน",range:{from:date,to:date},rows:rows.map((row,index)=>({no:index+1,...row})),totals,tentAllocationWarnings,missingRatePrograms:[...new Set(rows.filter(row=>row.missingRates).map(row=>row.program))],sourceNotes:["วันที่อ้างอิงวันเดินทางไปเกาะ","หนึ่ง Booking และหนึ่ง Program แสดงหนึ่งบรรทัด แม้ราคาผู้ใหญ่และเด็กต่างกัน","ไม่รวมโปรแกรมตั๋วเรือ","ต้นทุนทั่วไปคำนวณจากจำนวนผู้เดินทาง × ค่าคงที่ใน Master Data; ค่าเต็นท์คำนวณเฉพาะคนที่ระบุว่าพักเต็นท์ หรือทั้งคณะเมื่อ Booking ระบุที่พักเป็นเต็นท์ทั้งหมด","ถ้า Booking มีทั้งเต็นท์และที่พักอื่นโดยไม่ระบุคนพักเต็นท์ จะไม่เดาจำนวนและแจ้งเตือน"]};
}

function tentSize(person){const value=normalized(`${person.accommodationId||""} ${person.accommodationName||""}`),price=accommodationUnitPrice(person);if(/บ้าน|house|bungalow/.test(value))return"";if(!/tent|เต็นท์|เตนท์/.test(value))return"";if(/ใหญ่|large/.test(value))return"large";if(/เล็ก|small/.test(value))return"small";return price>500?"large":"small"}
function boatTentReport(bookings,date,paymentMethods=[],masterPrograms=[]){
  const rows=[];
  const boatMaster=masterPrograms.find(program=>normalized(program.program_id)==="boat_ticket");
  for(const booking of bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date)){
    const people=passengersOf(booking),boatPeople=people.filter(person=>person.program&&isBoatProgram(person.program));if(!boatPeople.length)continue;
    const qty=boatPeople.reduce((sum,person)=>sum+Math.max(money(person.program?.qty||1),0),0),amount=sumMoney(boatPeople,person=>lineAmount(person.program?.qty,person.program?.price)),price=money(boatMaster?.default_price??boatPeople[0].program?.defaultPrice??boatPeople[0].program?.price),defaultAmount=qty*price;
    let smallTentQty=0,largeTentQty=0,tentAmount=0;
    for(const person of accommodationsOf(booking)){if(!person.accommodationId||person.accommodationBookedBy!=="company")continue;const size=tentSize(person);if(!size)continue;const accommodationQty=accommodationQuantity(person);if(size==="large")largeTentQty+=accommodationQty;else smallTentQty+=accommodationQty;tentAmount+=accommodationRevenue(person)}
    const programLines=splitProgramRevenueLines(booking,people.filter(person=>person.program).map(person=>({source:isBoatProgram(person.program)?"boat":"package",amount:lineAmount(person.program.qty,person.program.price),paymentMethod:booking.paymentMethod})),{includeDeposit:true}).filter(line=>line.source==="boat");
    const boatCash=sumMoney(programLines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash"),line=>line.amount),boatTransfer=sumMoney(programLines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer"),line=>line.amount);
    const tentKind=paymentKind(booking.paymentMethod,paymentMethods),tentCash=tentKind==="cash"?tentAmount:0,tentTransfer=tentKind==="transfer"?tentAmount:0;
    rows.push({returnDate:booking.returnDate||"",leader:leaderName(booking),qty,price,boatCash,boatTransfer,discount:Math.max(defaultAmount-amount,0),balance:amount,smallTentQty,largeTentQty,tentCash,tentTransfer,totalCash:boatCash+tentCash,totalTransfer:boatTransfer+tentTransfer,customerSource:booking.source||booking.contactEmail||"",bookingCode:booking.bookingCode||""});
  }
  const fields=["qty","boatCash","boatTransfer","discount","balance","smallTentQty","largeTentQty","tentCash","tentTransfer","totalCash","totalTransfer"],totals=Object.fromEntries(fields.map(field=>[field,rows.reduce((sum,row)=>sum+money(row[field]),0)]));
  return{date,type:"boat_tent_reference",title:"ตั๋วเรือ - เต็นท์",purpose:"ยอดตั๋วเรือและเต็นท์ประจำวัน",range:{from:date,to:date},rows,totals,sourceNotes:["วันที่อ้างอิงวันเดินทางไปเกาะ","จำนวนรวมผู้โดยสารตั๋วเรือ; ราคาอ้างอิงราคาเริ่มต้นตั๋วเรือจาก Master Data","จำนวนเงินและคงเหลือเป็นยอดขายตั๋วเรือสุทธิที่บันทึกจริง ไม่ใช่จำนวน × ราคาเริ่มต้น; ส่วนลดเป็นผลต่างจากยอดราคาเริ่มต้น","เต็นท์อ้างอิงจากที่พักที่เราเป็นผู้จอง ไม่ใช่อุปกรณ์; ยอดเงินคิดจำนวนเต็นท์ × จำนวนคืนที่พนักงานกรอก × ราคาต่อคืน","สด/โอนอ้างอิงช่องทางชำระเงินของ Booking"]};
}

function vanRevenueLines(bookings,paymentMethods,transportationMethods){
  return bookings.filter(activeBooking).flatMap(booking=>transportationRevenueLines(booking,paymentMethods,transportationMethods)).filter(line=>isVanMethod(line.method,transportationMethods));
}
function vanDailyReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods){
  const lines=vanRevenueLines(bookings,paymentMethods,transportationMethods);
  const days=reportDays(date,toDate),rows=days.map(day=>{const daily=lines.filter(line=>line.operationalDate===day),cash=daily.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash").reduce((sum,line)=>sum+line.amount,0),transfer=daily.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((sum,line)=>sum+line.amount,0);return{date:day,cash,transfer,total:cash+transfer}}),totals={cash:rows.reduce((sum,row)=>sum+row.cash,0),transfer:rows.reduce((sum,row)=>sum+row.transfer,0),total:rows.reduce((sum,row)=>sum+row.total,0)};
  const periodLines=lines.filter(line=>line.operationalDate>=date&&line.operationalDate<=toDate),summary={vanLegs:periodLines.length,unpricedLegs:periodLines.filter(line=>line.amount<=0).length};
  const monthly=vanMonthlyReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods);
  return{date,type:"van_daily_reference",title:"รายงานรถตู้",purpose:"ยอดค่ารถตู้ตามวันให้บริการของแต่ละขา แยกเงินสดและเงินโอน",range:{from:date,to:toDate},rows,totals,summary,monthlyRows:monthly.rows,monthlyTotals:monthly.totals,sourceNotes:["นับขาไป ขากลับ และจุดแวะเพิ่มเติมตามวันให้บริการรายบุคคล","ระบุรถตู้จากรหัสวิธีการเดินทางใน Master Data หรือชื่อรถตู้ของรายการเดิม","เงินสด/โอนใช้ช่องทางชำระของแต่ละขาและ code ใน Payment Method Master"]};
}

function transportWorkOrderReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods,{type,title,purpose,methodMatches}){
  const groups=new Map();
  for(const booking of bookings.filter(activeBooking))for(const leg of transportationRevenueLines(booking,paymentMethods,transportationMethods)){
    if(!methodMatches(leg.method,transportationMethods)||!leg.operationalDate||leg.operationalDate<date||leg.operationalDate>toDate)continue;
    const key=JSON.stringify([booking.bookingCode,leg.direction,leg.operationalDate,leg.from,leg.to,leg.method]);
    const row=groups.get(key)||{date:leg.operationalDate,direction:leg.direction,leader:leaderName(booking),phone:booking.phone||"",pax:0,vehicles:0,method:leg.method,from:leg.from,to:leg.to,location:leg.destination,note:booking.bookingNote||"",bookingCode:booking.bookingCode,amount:0};
    row.pax++;row.vehicles=Math.max(row.vehicles,leg.quantity);row.amount=Math.round((row.amount+leg.amount)*100)/100;groups.set(key,row);
  }
  const rows=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.bookingCode.localeCompare(b.bookingCode)||a.direction.localeCompare(b.direction)).map((row,index)=>({no:index+1,...row}));
  return{date,type,title,purpose,range:{from:date,to:toDate},rows,summary:{jobs:rows.length,pax:rows.reduce((sum,row)=>sum+row.pax,0),vehicles:rows.reduce((sum,row)=>sum+row.vehicles,0),amount:sumMoney(rows,row=>row.amount)},sourceNotes:["วันปฏิบัติงานอ้างอิงวันเดินทางรายบุคคลของแต่ละขาและจุดแวะ","ผู้โดยสารนับจากรายชื่อในเส้นทาง; จำนวนรถใช้ค่าสูงสุดในกลุ่มเส้นทางเดียวกันเพื่อไม่ให้นับซ้ำ","ค่ารถรวมคำนวณจากจำนวนรถ × ราคาต่อคันของแต่ละรายการ"]};
}
function vanWorkOrderReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods){return transportWorkOrderReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods,{type:"van_work_order_reference",title:"ใบงานรับ-ส่งรถตู้",purpose:"รายการปฏิบัติงานรถตู้แยกขาไป ขากลับ และจุดแวะ",methodMatches:isVanMethod})}
function songthaewWorkOrderReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods){const report=transportWorkOrderReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods,{type:"songthaew_work_order_reference",title:"รายงานรถสองแถว",purpose:"งานรับ-ส่ง บขส. และลิกไนท์ แยกขาไป ขากลับ และจุดแวะ",methodMatches:(method,methods)=>!isVanMethod(method,methods)&&["lignite","bks"].includes(transportationBucket(method,methods))});report.sourceNotes.push("รวมวิธีเดินทางที่ชื่อใน Master Data เป็น บขส. หรือ ลิกไนท์; ไม่รวมรายการที่รหัสระบุว่าเป็นรถตู้");return report}

function agentReferenceReport(bookings,date,toDate,masterAgents=[]){
  const agentOrder=new Map((masterAgents||[]).map((agent,index)=>[String(agent.agent_name||"").trim(),Number(agent.sort_order??index)])),groups=new Map();
  const selected=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate>=date&&booking.travelDate<=toDate);
  for(const booking of selected){
    const agent=String(booking.agentName||"").trim()||"ไม่ระบุ Agent",people=passengersOf(booking),counts=passengerCounts(booking);
    let boatAmount=0,packageAmount=0;
    for(const person of people){if(!person.program)continue;const amount=lineAmount(person.program.qty,person.program.price);if(isBoatProgram(person.program))boatAmount+=amount;else packageAmount+=amount}
    const group=groups.get(agent)||{agent,rows:[]};
    group.rows.push({date:booking.travelDate||"",leader:leaderName(booking),adult:counts.adult,child:counts.child,infant:counts.infant,foc:counts.foc,boatAmount,packageAmount,total:boatAmount+packageAmount,paymentDate:"",bookingCode:booking.bookingCode||""});
    groups.set(agent,group);
  }
  const totalFields=["adult","child","infant","foc","boatAmount","packageAmount","total"];
  const pages=[...groups.values()].sort((a,b)=>(agentOrder.get(a.agent)??Number.MAX_SAFE_INTEGER)-(agentOrder.get(b.agent)??Number.MAX_SAFE_INTEGER)||a.agent.localeCompare(b.agent,"th")).map(group=>{
    group.rows.sort((a,b)=>a.date.localeCompare(b.date)||a.bookingCode.localeCompare(b.bookingCode));
    return{...group,totals:Object.fromEntries(totalFields.map(field=>[field,group.rows.reduce((sum,row)=>sum+money(row[field]),0)]))};
  });
  return{date,type:"agent_reference",title:"รายงานเอเย่น",purpose:"สรุปยอดโปรแกรมแยกตาม Agent และวันเดินทางไป",range:{from:date,to:toDate},pages,summary:{agents:pages.length,bookings:selected.length,total:pages.reduce((sum,page)=>sum+page.totals.total,0)}};
}

const transportationMethodName=(value,methods=[])=>{const key=normalized(value),master=(methods||[]).find(item=>normalized(item.method_id)===key||normalized(item.method_name)===key);return normalized(master?.method_name||value)};
const transportationBucket=(value,methods=[])=>{const name=transportationMethodName(value,methods);if(/ลิกไนท์|lignite/.test(name))return"lignite";if(/บขส\.?|สถานีขนส่ง/.test(name))return"bks";if(/รถส่วนตัว|รถยนต์ส่วนตัว|private\s*car/.test(name))return"privateCar";if(/รถตู้|\bvan\b/.test(name))return"van";return"other"};
function customerTravelDailyReferenceReport(bookings,date,toDate,transportationMethods=[]){
  const pages=reportDays(date,toDate).map(day=>{
    const groups=new Map();
    for(const booking of bookings.filter(activeBooking))for(const person of passengersOf(booking)){
      const returnDate=person.passengerReturnDate||booking.returnDate||"";if(returnDate!==day)continue;
      const key=booking.bookingCode||leaderName(booking),row=groups.get(key)||{bookingCode:booking.bookingCode||"",leader:leaderName(booking),arrivalDates:new Set(),pax:0,adult:0,child:0,infant:0,foc:0,lignite:0,bks:0,privateCar:0,van:0,otherMethods:new Map(),bookingNote:booking.bookingNote||""};
      const arrivalDate=person.passengerTravelDate||booking.travelDate||"";if(arrivalDate)row.arrivalDates.add(arrivalDate);row.pax++;
      const type=["adult","child","infant","foc"].includes(person.passengerType)?person.passengerType:"adult";row[type]++;
      const method=person.returnTransportationMethod||person.transportationMethod||booking.transportationMethod||"ไม่ระบุ",bucket=transportationBucket(method,transportationMethods);row[bucket==="other"?"van":bucket]++;
      if(bucket==="other"){const name=transportationMethodName(method,transportationMethods);row.otherMethods.set(name,(row.otherMethods.get(name)||0)+1)}groups.set(key,row);
    }
    const rows=[...groups.values()].sort((a,b)=>[...a.arrivalDates].join(",").localeCompare([...b.arrivalDates].join(","))||a.bookingCode.localeCompare(b.bookingCode)).map((row,index)=>{const other=[...row.otherMethods].map(([name,count])=>`${name} ${count} คน`).join(", "),note=[row.bookingNote,other?`นับเป็นรถตู้: ${other}`:""].filter(Boolean).join(" · ");return{no:index+1,arrivalDate:[...row.arrivalDates].sort().join(", "),leader:row.leader,pax:row.pax,adult:row.adult,child:row.child,infant:row.infant,foc:row.foc,lignite:row.lignite,bks:row.bks,privateCar:row.privateCar,van:row.van,note}});
    const totals=Object.fromEntries(["pax","adult","child","infant","foc","lignite","bks","privateCar","van"].map(field=>[field,rows.reduce((sum,row)=>sum+row[field],0)]));
    return{date:day,rows,totals};
  });
  return{date,type:"customer_travel_daily_reference",title:"ตารางเดินทางลูกค้ารายวัน",purpose:"รายชื่อลูกค้าที่เดินทางกลับ แยกจำนวนตามประเภทผู้เดินทางและวิธีเดินทาง",range:{from:date,to:toDate},pages,summary:{days:pages.length,pax:pages.reduce((sum,page)=>sum+page.totals.pax,0)}};
}

function reportMonths(date,toDate){const months=[];let cursor=date.slice(0,7);const last=toDate.slice(0,7);while(cursor<=last&&months.length<120){months.push(cursor);const [year,month]=cursor.split("-").map(Number),next=new Date(Date.UTC(year,month,1));cursor=next.toISOString().slice(0,7)}return months}
function tourMonthlyReferenceReport(bookings,date,toDate,paymentMethods){
  const rows=reportMonths(date,toDate).map(month=>{
    const selected=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate>=date&&booking.travelDate<=toDate&&String(booking.travelDate).slice(0,7)===month);
    const services=selected.flatMap(booking=>tourRevenueLines(booking,paymentMethods));
    const deposits=selected.map(booking=>({amount:money(booking.depositAmount),paymentMethod:bookingSavedPaymentMethod(booking,"deposit")||booking.paymentMethod||""}));
    const cash=sumMoney(services.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash"),line=>line.amount);
    const transfer=sumMoney(services.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer"),line=>line.amount);
    return{month,cash,transfer,deposit:sumMoney(deposits,line=>line.amount),credit:sumMoney(selected,booking=>booking.creditAmount),rungruedeeTransfer:accountTransferTotal([...services,...deposits],"รุ่งฤดี",paymentMethods)};
  });
  const fields=["cash","transfer","deposit","credit","rungruedeeTransfer"],totals=Object.fromEntries(fields.map(field=>[field,sumMoney(rows,row=>row[field])]));
  return{date,type:"tour_monthly_reference",title:"รายงานสรุปรายการทัวร์",purpose:"สรุปรายเดือนตามวันเดินทางไป",range:{from:date,to:toDate},rows,totals,sourceNotes:["มัดจำและขายเชื่อแยกจากยอดสด/โอน ไม่บวกซ้ำ","โอนรุ่งฤดีรวมยอดขายสุทธิและมัดจำที่เข้าบัญชีรุ่งฤดี โดยไม่นับมัดจำซ้ำ","ตัดคอลัมน์เบิกทัวร์และคงเหลือตามข้อกำหนด"]};
}
function vanMonthlyReferenceReport(bookings,date,toDate,paymentMethods,transportationMethods=[]){
  const vanLines=vanRevenueLines(bookings,paymentMethods,transportationMethods).filter(line=>line.operationalDate>=date&&line.operationalDate<=toDate);
  const rows=reportMonths(date,toDate).map(month=>{const lines=vanLines.filter(line=>line.operationalDate.slice(0,7)===month),cash=lines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="cash").reduce((sum,line)=>sum+line.amount,0),transfer=lines.filter(line=>paymentKind(line.paymentMethod,paymentMethods)==="transfer").reduce((sum,line)=>sum+line.amount,0);return{month,cash,transfer,total:cash+transfer}});
  const totals={cash:rows.reduce((sum,row)=>sum+row.cash,0),transfer:rows.reduce((sum,row)=>sum+row.transfer,0),total:rows.reduce((sum,row)=>sum+row.total,0)};
  return{date,type:"van_monthly_reference",title:"รายงานสรุปรายการรถตู้",purpose:"สรุปค่ารถตู้รายเดือนตามวันให้บริการของแต่ละขาและจุดแวะ",range:{from:date,to:toDate},rows,totals,sourceNotes:["นับขาไป ขากลับ และจุดแวะตามวันเดินทางรายบุคคลของแต่ละรายการ","เงินสด/โอนพิจารณาจาก code ใน Payment Method Master"]};
}
const incomeCategory=name=>{const value=String(name||"").toLowerCase();if(value.includes("น้ำแข็ง"))return"น้ำแข็ง";if(value.includes("น้ำเกาะ"))return"ค่าน้ำเกาะ";if(value.includes("น้ำ"))return"ค่าน้ำ";if(value.includes("หน้ากาก"))return"หน้ากาก";if(value.includes("ชูชีพ"))return"ชูชีพ";if(value.includes("ฟิน")||value.includes("ตีนกบ"))return"ฟิน";if(value.includes("เต็นท์"))return"เต็นท์";if(value.includes("เหมาเรือ"))return"เหมาเรือ";if(value.includes("ระวาง"))return"ค่าระวาง";return"อื่นๆ"};
function managementReport(bookings,financialRows,expenseRows,date,toDate=date,masterAddOns=[],masterAccommodations=[]){
  const finances=financeMap(financialRows);
  const expensesByDay=new Map();for(const expense of expenseRows||[]){const day=expense.expense_date||expense.expenseDate,current=expensesByDay.get(day)||[];current.push(expense);expensesByDay.set(day,current)}
  const days=reportDays(date,toDate);
  const rows=days.map(day=>{
    const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);
    const dailyPeople=daily.flatMap(passengersOf);
    const dailyArrivals=daily.map(booking=>({booking,direction:"ลงเกาะ",movement:"arrival"}));
    const lodging=accommodationSummary(dailyArrivals);
    const expectedRevenue=daily.reduce((sum,booking)=>sum+money(booking.totalAmount),0);
    const deposits=daily.reduce((sum,booking)=>sum+money(booking.depositAmount),0);
    const actualReceived=daily.reduce((sum,booking)=>sum+money(finances.get(booking.bookingCode)?.net_cash_received),0);
    const operatingExpenses=(expensesByDay.get(day)||[]).reduce((sum,item)=>sum+money(item.amount),0);
    return{
      date:day,
      bookings:daily.length,
      pax:dailyPeople.length,
      adult:dailyPeople.filter(person=>(person.passengerType||"adult")==="adult").length,
      child:dailyPeople.filter(person=>person.passengerType==="child").length,
      infant:dailyPeople.filter(person=>person.passengerType==="infant").length,
      foreign:dailyPeople.filter(person=>person.nationalityType==="foreign").length,
      foc:dailyPeople.filter(person=>person.passengerType==="foc").length,
      pending:daily.filter(booking=>booking.status==="pending").length,
      confirmed:daily.filter(booking=>booking.status==="confirmed").length,
      checkedIn:daily.filter(booking=>booking.status==="checked-in").length,
      parkHouse:lodging.parkHouse,
      parkTent:lodging.parkTent,
      equipmentUnits:equipmentSummary(dailyArrivals).reduce((sum,item)=>sum+item.qty,0),
      expectedRevenue,
      deposits,
      actualReceived,
      outstanding:Math.max(expectedRevenue-actualReceived,0),operatingExpenses,netAfterExpenses:expectedRevenue-operatingExpenses
    };
  });
  const today=rows[0]||{};
  const categoryNames=["ค่าตั๋วเรือ","ที่พัก","มัดจำ","ขายเชื่อ","ค่าน้ำ","ค่าน้ำเกาะ","หน้ากาก","ชูชีพ","ฟิน","น้ำแข็ง","เต็นท์","เหมาเรือ","ค่าระวาง","อื่นๆ","รวมรายได้"];
  const incomeMatrix=categoryNames.map(category=>({category,values:Object.fromEntries(days.map(day=>{const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===day);let amount=0;if(category==="ค่าตั๋วเรือ")amount=daily.flatMap(passengersOf).reduce((sum,p)=>sum+money(p.program?.qty||1)*money(p.program?.price),0);else if(category==="ที่พัก")amount=daily.reduce((sum,booking)=>sum+sumMoney(accommodationsOf(booking),accommodationRevenue),0);else if(category==="มัดจำ")amount=daily.reduce((sum,b)=>sum+money(b.depositAmount),0);else if(category==="ขายเชื่อ")amount=daily.reduce((sum,b)=>sum+money(b.creditAmount),0);else if(category==="รวมรายได้")amount=daily.reduce((sum,b)=>sum+money(b.totalAmount),0);else amount=daily.flatMap(passengersOf).reduce((sum,p)=>sum+(p.preAddOns||[]).filter(a=>a.selected&&incomeCategory(a.name)===category).reduce((value,a)=>value+equipmentBillableUnits(a)*money(a.price),0)+(p.islandAddOns||[]).filter(a=>incomeCategory(a.name)===category).reduce((value,a)=>value+money(a.qty||1)*money(a.price),0),0);return[day,amount]}))}));
  const parkPersonCodes=new Set(["thai_adult_fee","thai_child_fee","thai_infant_fee","foreign_adult_fee","foreign_child_fee","foreign_infant_fee","foc_fee","park_people_total"]);
  const baseExpenseNames=["ค่าธรรมเนียมเรือ","ค่าธรรมเนียมอุทยาน","ค่าธรรมเนียมกางเต็นท์","ค่าน้ำแข็ง"];
  const expenseLabel=item=>{const code=item.category_code||item.categoryCode||"",itemCode=item.expense_item_code||item.expenseItemCode||"";if(code==="boat_fee"||code==="park_boat_total"||itemCode==="boat_park_fee")return"ค่าธรรมเนียมเรือ";if(parkPersonCodes.has(code)||itemCode==="national_park_fee")return"ค่าธรรมเนียมอุทยาน";if(code==="tent_fee"||itemCode==="park_tent_fee")return"ค่าธรรมเนียมกางเต็นท์";if(code==="ice"||itemCode==="ice")return"ค่าน้ำแข็ง";const name=item.category_name_snapshot||item.categoryName||"ค่าใช้จ่ายอื่น",detail=item.expense_detail||item.expenseDetail||"";return detail&&detail!==name?`${name} — ${detail}`:name};
  const expenseNames=[...baseExpenseNames,...new Set((expenseRows||[]).map(expenseLabel).filter(name=>!baseExpenseNames.includes(name)))];
  const expenseMatrix=expenseNames.map(category=>({category,values:Object.fromEntries(days.map(day=>[day,(expensesByDay.get(day)||[]).filter(item=>expenseLabel(item)===category).reduce((sum,item)=>sum+money(item.amount),0)]))}));
  const arrivalEntries=movements(bookings,date).filter(row=>row.movement==="arrival"),usedEquipment=equipmentSummary(arrivalEntries),equipmentByCode=new Map(usedEquipment.map(item=>[item.code,item]));
  const equipment=[...(masterAddOns||[]).map(item=>equipmentByCode.get(item.addon_id)||{code:item.addon_id,name:item.addon_name,qty:0}),...usedEquipment.filter(item=>!(masterAddOns||[]).some(master=>master.addon_id===item.code))];
  const arrivalAccommodations=arrivalEntries.flatMap(({booking})=>accommodationsOf(booking)),accommodationItems=(masterAccommodations||[]).map(item=>{const selected=arrivalAccommodations.filter(person=>person.accommodationId===item.accommodation_id);return{code:item.accommodation_id,name:item.accommodation_name,qty:selected.reduce((sum,person)=>sum+accommodationQuantity(person),0),defaultPrice:money(item.default_price),amount:selected.reduce((sum,person)=>sum+accommodationRevenue(person),0)}});
  return{
    title:"Management / CEO Daily & 7-Day Forecast",
    purpose:"สรุปภาพรวมสำหรับ CEO และผู้บริหาร พร้อมประมาณการ 7 วัน",
    rows,
    summary:{
      bookings:today.bookings,
      pax:today.pax,
      arrivals:movements(bookings,date).filter(row=>row.movement==="arrival").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      departures:movements(bookings,date).filter(row=>row.movement==="departure").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      expectedRevenue:today.expectedRevenue,
      deposits:today.deposits,
      actualReceived:today.actualReceived,
      outstanding:today.outstanding,
      sevenDayExpected:rows.reduce((sum,row)=>sum+row.expectedRevenue,0),operatingExpenses:today.operatingExpenses||0,netAfterExpenses:today.netAfterExpenses||0,totalOperatingExpenses:rows.reduce((sum,row)=>sum+row.operatingExpenses,0),totalNetAfterExpenses:rows.reduce((sum,row)=>sum+row.netAfterExpenses,0),
    },
    range:{from:date,to:toDate},incomeMatrix,expenseMatrix,expenseDetails:(expenseRows||[]).map(item=>({date:item.expense_date||item.expenseDate,name:expenseLabel(item),groupCode:item.expense_group_code||item.expenseGroupCode||"",itemCode:item.expense_item_code||item.expenseItemCode||"",qty:Number(item.qty||0),unitPrice:money(item.unit_price??item.unitPrice),amount:money(item.amount)})),
    equipment,
    accommodation:accommodationSummary(arrivalEntries),accommodationItems
  };
}

const passengerCounts=booking=>passengersOf(booking).reduce((counts,person)=>{const type=person.passengerType||"adult";counts[type]=(counts[type]||0)+1;return counts},{adult:0,child:0,infant:0,foc:0});
const uniqueValues=(people,getter)=>[...new Set(people.map(getter).filter(Boolean))].join(", ");
const accommodationText=person=>person.accommodationId?`${person.accommodationName||person.accommodationId} x ${accommodationQuantity(person)} (${person.accommodationBookedBy==="company"?"เราจองให้":"ลูกค้าจองเอง"})`:"";
const bookingAccommodationText=booking=>uniqueValues(accommodationsOf(booking),accommodationText);
const programShort=name=>String(name||"").replace(/(\d+)\s*(?:วัน|days?)\s*(\d+)\s*(?:คืน|nights?)/gi,"$1D$2N");
function dailyRegisterSummary(bookings,date){
  const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),totals={adult:0,child:0,infant:0,foc:0};
  const rows=daily.map((booking,index)=>{const people=passengersOf(booking),counts=passengerCounts(booking);for(const key of Object.keys(totals))totals[key]+=counts[key];return{no:index+1,leader:leaderName(booking),returnDate:booking.returnDate||"",adult:counts.adult,child:counts.child,infant:counts.infant,foc:counts.foc,program:uniqueValues(people,p=>programShort(p.program?.name)),island:uniqueValues(people,p=>p.island),accommodation:bookingAccommodationText(booking),transportation:uniqueValues(people,p=>p.transportationMethod)||booking.transportationMethod||"",agent:booking.agentName||"",note:booking.bookingNote||""}});
  return{date,type:"register_summary",title:"ใบสรุปยอดยืนยันการจอง",purpose:"รายงานประจำวัน",rows,registerTotals:totals,manualTotals:{guide:"",mogan:"",parkOfficer:"",grandTotal:""},summary:{bookings:daily.length,pax:Object.values(totals).reduce((sum,value)=>sum+value,0)}};
}
function rangeRegisterSummary(bookings,date,toDate){
  const selected=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate>=date&&booking.travelDate<=toDate),totals={adult:0,child:0,infant:0,foc:0};
  const rows=selected.sort((a,b)=>String(a.travelDate).localeCompare(String(b.travelDate))||String(a.bookingCode).localeCompare(String(b.bookingCode))).map((booking,index)=>{const people=passengersOf(booking),counts=passengerCounts(booking);for(const key of Object.keys(totals))totals[key]+=counts[key];return{no:index+1,travelDate:booking.travelDate||"",leader:leaderName(booking),returnDate:booking.returnDate||"",adult:counts.adult,child:counts.child,infant:counts.infant,foc:counts.foc,program:uniqueValues(people,p=>programShort(p.program?.name)),island:uniqueValues(people,p=>p.island),accommodation:bookingAccommodationText(booking),transportation:uniqueValues(people,p=>p.transportationMethod)||booking.transportationMethod||"",agent:booking.agentName||"",note:booking.bookingNote||""}});
  return{date,type:"register_summary_range",title:"ใบสรุปยอดยืนยันการจอง (ช่วงวันที่)",purpose:`รายงานช่วงวันที่ ${date} ถึง ${toDate}`,range:{from:date,to:toDate},rows,registerTotals:totals,manualTotals:{guide:"",mogan:"",parkOfficer:"",grandTotal:""},summary:{bookings:selected.length,pax:Object.values(totals).reduce((sum,value)=>sum+value,0)}};
}
function frontChargeReport(bookings,date){
  const selected=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date).sort((a,b)=>String(a.bookingCode||"").localeCompare(String(b.bookingCode||"")));
  const rows=[],totals={people:0,adult:0,child:0,infant:0,foc:0};
  for(const [bookingIndex,booking] of selected.entries()){
    const groups=new Map();
    for(const person of passengersOf(booking)){
      const returnDate=person.passengerReturnDate||booking.returnDate||"",transportation=person.returnTransportationMethod||"",key=JSON.stringify([returnDate,transportation]);
      if(!groups.has(key))groups.set(key,{returnDate,transportation,people:[]});
      groups.get(key).people.push(person);
    }
    if(!groups.size)groups.set("empty",{returnDate:booking.returnDate||"",transportation:"",people:[]});
    const accommodation=bookingAccommodationText(booking)||uniqueValues(passengersOf(booking),person=>accommodationLabel[person.parkAccommodationType||""]);
    const island=uniqueValues(passengersOf(booking),person=>person.island);
    const orderedGroups=[...groups.values()].sort((a,b)=>Number(!a.returnDate)-Number(!b.returnDate)||a.returnDate.localeCompare(b.returnDate)||Number(!a.transportation)-Number(!b.transportation)||a.transportation.localeCompare(b.transportation,"th"));
    for(const [groupIndex,group] of orderedGroups.entries()){
      const counts=passengerCounts({passengers:group.people});
      for(const type of ["adult","child","infant","foc"])totals[type]+=counts[type];
      totals.people+=group.people.length;
      rows.push({bookingNo:bookingIndex+1,bookingRowSpan:orderedGroups.length,isFirstGroup:groupIndex===0,bookingPeople:passengersOf(booking).length,travelDate:booking.travelDate||"",returnDate:group.returnDate,leader:leaderName(booking),phone:booking.phone||"",people:group.people.length,...counts,program:uniqueValues(group.people,person=>programShort(person.program?.name)),island,accommodation,transportation:group.transportation,agent:booking.agentName||"",note:booking.bookingNote||"",bookingCode:booking.bookingCode||""});
    }
  }
  return{date,type:"front_charge",title:"ใบหน้าชาร์จ",purpose:"รายการ Booking ตามวันเดินทางไป โดยแยกวันและวิธีเดินทางกลับของผู้เดินทาง",rows,totals,summary:{bookings:selected.length,pax:totals.people}};
}
const receiptCents=value=>Math.round(Math.max(money(value),0)*100);
const receiptAmount=cents=>cents/100;
function receiptDocumentLines(booking,{masterAddOns,masterIslandAddOns,masterAccommodations,transportationMethods,paymentMethods=[]}){
  const addons=new Map(masterAddOns.map(row=>[row.addon_id,row]));
  const islandAddons=new Map(masterIslandAddOns.map(row=>[row.island_addon_id,row]));
  const accommodations=new Map(masterAccommodations.map(row=>[row.accommodation_id,row]));
  const transport=new Map(transportationMethods.map(row=>[row.method_name,row]));
  const lines=[];
  const add=(source,amount,paymentMethod)=>{const cents=receiptCents(amount);if(cents)lines.push({source,amount:receiptAmount(cents),paymentMethod})};
  for(const person of passengersOf(booking)){
    if(person.program)add("program",lineAmount(person.program.qty,person.program.price),booking.paymentMethod);
    const outbound=person.transportationMethod||booking.transportationMethod||"";
    if(transport.get(outbound)?.show_money_receipt===true)add("transport",transportAmount(person.transportationAmount,person.transportationQuantity),person.transportationPaymentMethod||defaultPayment(paymentMethods,isVanMethod(outbound,transportationMethods)?"transport":"general")||booking.paymentMethod);
    if(transport.get(person.returnTransportationMethod||"")?.show_money_receipt===true)add("transport",transportAmount(person.returnTransportationAmount,person.returnTransportationQuantity),person.returnTransportationPaymentMethod||defaultPayment(paymentMethods,isVanMethod(person.returnTransportationMethod,transportationMethods)?"transport":"general")||booking.paymentMethod);
    for(const stop of person.extraTransportStops||[])if(transport.get(stop.method||"")?.show_money_receipt===true)add("transport",transportAmount(stop.amount,stop.quantity),stop.paymentMethod||defaultPayment(paymentMethods,isVanMethod(stop.method,transportationMethods)?"transport":"general")||booking.paymentMethod);
    for(const addon of person.preAddOns||[]){
      if(!addon.selected)continue;
      const visibility=addons.get(addon.id)?.show_money_receipt??addon.documentVisibility?.show_money_receipt??true;
      if(visibility===true)add("equipment",lineAmount(equipmentBillableUnits(addon),addon.price),addon.paymentMethod||defaultPayment(paymentMethods,"equipment")||booking.paymentMethod);
    }
    for(const addon of person.islandAddOns||[]){
      const visibility=islandAddons.get(addon.id)?.show_money_receipt??addon.documentVisibility?.show_money_receipt??true;
      if(visibility!==false)add("island",lineAmount(addon.qty,addon.price),addon.paymentMethod||defaultPayment(paymentMethods,"island")||booking.paymentMethod);
    }
  }
  for(const accommodation of accommodationsOf(booking)){
    if(!accommodation.accommodationId)continue;
    if(accommodations.get(accommodation.accommodationId)?.show_money_receipt??true)add("accommodation",accommodationRevenue(accommodation),booking.paymentMethod);
  }
  return lines;
}
const receiptDocumentTotal=(booking,masters)=>receiptDocumentLines(booking,masters).reduce((sum,line)=>sum+receiptCents(line.amount),0);
function receiptV2BalanceSplit(booking,masters,deposit,credit,paymentMethods){
  const lines=receiptDocumentLines(booking,{...masters,paymentMethods}).map(line=>({...line}));
  let deduction=deposit+credit;
  for(const group of [lines.filter(line=>line.source==="program"),lines.filter(line=>line.source!=="program")]){
    const capacities=group.map(line=>receiptCents(line.amount)),shares=proportionalPaymentShares(Math.min(deduction,capacities.reduce((sum,value)=>sum+value,0)),capacities);
    group.forEach((line,index)=>{line.amount=receiptAmount(capacities[index]-shares[index])});
    deduction-=shares.reduce((sum,value)=>sum+value,0);
  }
  const program=splitProgramRevenueLines(booking,lines.filter(line=>line.source==="program"),{includeCredit:false});
  const remaining=[...program,...lines.filter(line=>line.source!=="program")];
  return remaining.reduce((result,line)=>{result[paymentKind(line.paymentMethod,paymentMethods)==="cash"?"cash":"transfer"]+=receiptCents(line.amount);return result},{cash:0,transfer:0});
}
function receiptPaymentSplit(amount,source,selected,paymentMethods){
  const cents=receiptCents(amount),parts=Object.entries(source||{}).filter(([,value])=>receiptCents(value)>0);
  if(!parts.length)return paymentKind(selected,paymentMethods)==="cash"?{cash:cents,transfer:0}:{cash:0,transfer:cents};
  const total=parts.reduce((sum,[,value])=>sum+receiptCents(value),0);
  let remaining=cents,cash=0,transfer=0;
  parts.forEach(([name,value],index)=>{
    const share=index===parts.length-1?remaining:Math.min(Math.round(cents*receiptCents(value)/total),remaining);
    if(paymentKind(name,paymentMethods)==="cash")cash+=share;else transfer+=share;
    remaining-=share;
  });
  return{cash,transfer};
}
function dailyReceiptSummary(bookings,date,paymentMethods,masters){
  const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date),totals={depositCash:0,depositTransfer:0,creditCash:0,creditTransfer:0,balanceCash:0,balanceTransfer:0,totalCash:0,totalTransfer:0,grandTotal:0};
  const rows=daily.map((booking,index)=>{
    const total=receiptDocumentTotal(booking,masters),deposit=Math.min(receiptCents(booking.depositAmount),total),credit=Math.min(receiptCents(booking.creditAmount),total-deposit),balance=total-deposit-credit,breakdown=booking.paymentBreakdown||{};
    const depositSplit=receiptPaymentSplit(receiptAmount(deposit),breakdown.deposit,bookingSavedPaymentMethod(booking,"deposit"),paymentMethods);
    const creditSplit=receiptPaymentSplit(receiptAmount(credit),breakdown.credit,bookingSavedPaymentMethod(booking,"credit"),paymentMethods);
    const balanceSplit=breakdown.version===2?receiptV2BalanceSplit(booking,masters,deposit,credit,paymentMethods):receiptPaymentSplit(receiptAmount(balance),breakdown.remaining,booking.paymentMethod,paymentMethods);
    const row={no:index+1,agent:booking.agentName||"",leader:leaderName(booking),program:uniqueValues(passengersOf(booking),p=>programShort(p.program?.name)),depositCash:receiptAmount(depositSplit.cash),depositTransfer:receiptAmount(depositSplit.transfer),creditCash:receiptAmount(creditSplit.cash),creditTransfer:receiptAmount(creditSplit.transfer),balanceCash:receiptAmount(balanceSplit.cash),balanceTransfer:receiptAmount(balanceSplit.transfer),totalCash:receiptAmount(depositSplit.cash+creditSplit.cash+balanceSplit.cash),totalTransfer:receiptAmount(depositSplit.transfer+creditSplit.transfer+balanceSplit.transfer),grandTotal:receiptAmount(total)};
    for(const key of Object.keys(totals))totals[key]+=row[key];
    return row;
  });
  for(const key of Object.keys(totals))totals[key]=receiptAmount(receiptCents(totals[key]));
  return{date,type:"receipt_summary",title:"ใบสรุปยอดใบสำคัญรับเงิน",purpose:"รายงานประจำวัน",rows,receiptTotals:totals,summary:{bookings:daily.length,pax:daily.reduce((sum,booking)=>sum+passengersOf(booking).length,0)}};
}
function dailyEquipmentSummary(bookings,date,masterAddOns=[],paymentMethods=[]){
  const daily=bookings.filter(booking=>activeBooking(booking)&&booking.travelDate===date)
    .filter(booking=>passengersOf(booking).some(person=>(person.preAddOns||[]).some(addon=>addon.selected!==false)))
    .sort((a,b)=>String(a.bookingCode||"").localeCompare(String(b.bookingCode||"")));
  const orderedMaster=[...masterAddOns].sort((a,b)=>Number(a.sort_order??9999)-Number(b.sort_order??9999)||String(a.addon_name||"").localeCompare(String(b.addon_name||""),"th"));
  const equipmentColumns=orderedMaster.map(item=>({code:item.addon_id,name:item.addon_name||item.addon_id}));
  const seen=new Set(equipmentColumns.map(item=>item.code)),historical=new Map();
  for(const booking of daily)for(const person of passengersOf(booking))for(const addon of person.preAddOns||[]){
    if(addon.selected===false)continue;
    const code=addon.id||addon.name||"other";
    if(!seen.has(code))historical.set(code,{code,name:addon.name||code});
  }
  equipmentColumns.push(...[...historical.values()].sort((a,b)=>a.name.localeCompare(b.name,"th")));
  const rows=daily.map((booking,index)=>{
    const people=passengersOf(booking),equipment=Object.fromEntries(equipmentColumns.map(item=>[item.code,0]));
    let cashCents=0,transferCents=0,unknownCents=0;
    for(const person of people)for(const addon of person.preAddOns||[]){
      if(addon.selected===false)continue;
      const code=addon.id||addon.name||"other";
      equipment[code]=(equipment[code]||0)+money(addon.qty||1);
      const cents=Math.round(equipmentBillableUnits(addon)*money(addon.price)*100);
      const method=String(addon.paymentMethod||"").trim();
      if(!method)unknownCents+=cents;
      else if(paymentKind(method,paymentMethods)==="cash")cashCents+=cents;
      else transferCents+=cents;
    }
    return{no:index+1,bookingCode:booking.bookingCode||"",leader:leaderName(booking),pax:people.length,
      program:uniqueValues(people,person=>programShort(person.program?.name)),equipment,
      cash:cashCents/100,transfer:transferCents/100,unknown:unknownCents/100,total:(cashCents+transferCents+unknownCents)/100};
  });
  const equipmentTotals={equipment:Object.fromEntries(equipmentColumns.map(item=>[item.code,rows.reduce((sum,row)=>sum+money(row.equipment[item.code]),0)])),
    cash:sumMoney(rows,row=>row.cash),transfer:sumMoney(rows,row=>row.transfer),unknown:sumMoney(rows,row=>row.unknown),total:sumMoney(rows,row=>row.total),
    pax:rows.reduce((sum,row)=>sum+row.pax,0)};
  return{date,type:"equipment_summary",title:"ใบรายงานอุปกรณ์",purpose:"จำนวนอุปกรณ์ที่เบิกและรายได้อุปกรณ์ตามวันเดินทางไป",
    equipmentColumns,rows,equipmentTotals,summary:{bookings:rows.length,pax:equipmentTotals.pax}};
}

export function buildPrintCenterReport({bookings=[],financialRows=[],expenseRows=[],paymentMethods=[],masterPrograms=[],masterAddOns=[],masterIslandAddOns=[],masterAccommodations=[],masterAgents=[],transportationMethods=[],packageCostRates=[],date,toDate,type}){
  const active=bookings.filter(activeBooking);
  toDate=toDate||(type==="management"?isoDate(date,6):date);
  const selectedDays=reportDays(date,toDate),entries=selectedDays.flatMap(day=>movements(active,day).map(row=>({...row,date:day})));
  const arrivals=entries.filter(row=>row.movement==="arrival");
  if(type==="register_summary")return dailyRegisterSummary(active,date);
  if(type==="register_summary_range")return rangeRegisterSummary(active,date,toDate);
  if(type==="front_charge")return frontChargeReport(active,date);
  if(type==="receipt_summary")return dailyReceiptSummary(active,date,paymentMethods,{masterAddOns,masterIslandAddOns,masterAccommodations,transportationMethods});
  if(type==="equipment_summary")return dailyEquipmentSummary(active,date,masterAddOns,paymentMethods);
  if(type==="management")return{date,type,...managementReport(active,financialRows,expenseRows,date,toDate,masterAddOns,masterAccommodations)};
  if(type==="tour_expense_reference")return tourExpenseReferenceReport(active,date,toDate,paymentMethods);
  if(type==="tent_fee_reference")return tentFeeReferenceReport(active,date,toDate);
  if(type==="package_cost_reference")return packageCostReport(active,date,packageCostRates);
  if(type==="boat_tent_reference")return boatTentReport(active,date,paymentMethods,masterPrograms);
  if(type==="van_daily_reference")return vanDailyReferenceReport(active,date,toDate,paymentMethods,transportationMethods);
  if(type==="van_work_order_reference")return vanWorkOrderReferenceReport(active,date,toDate,paymentMethods,transportationMethods);
  if(type==="songthaew_work_order_reference")return songthaewWorkOrderReferenceReport(active,date,toDate,paymentMethods,transportationMethods);
  if(type==="agent_reference")return agentReferenceReport(active,date,toDate,masterAgents);
  if(type==="customer_travel_daily_reference")return customerTravelDailyReferenceReport(active,date,toDate,transportationMethods);
  if(type==="tour_monthly_reference")return tourMonthlyReferenceReport(active,date,toDate,paymentMethods);
  if(type==="van_monthly_reference")return vanMonthlyReferenceReport(active,date,toDate,paymentMethods,transportationMethods);

  let title="",purpose="",rows=[],insuranceSummary=null;
  if(type==="counter"){
    title="Counter Daily Booking Report";
    purpose="ตรวจรายการจอง ติดต่อผู้โดยสาร และติดตามสถานะหน้าเคาน์เตอร์";
    rows=active.filter(booking=>booking.travelDate>=date&&booking.travelDate<=toDate).map(booking=>({
      date:booking.travelDate,
      bookingCode:booking.bookingCode,leader:leaderName(booking),phone:booking.phone||"",email:booking.contactEmail||"",
      pax:passengersOf(booking).length,status:booking.status,paymentMethod:bookingProgramPaymentLabel(booking),
      transportationMethod:booking.transportationMethod||"",
      totalAmount:money(booking.totalAmount),depositAmount:money(booking.depositAmount),
      depositPaymentMethod:bookingSavedPaymentMethod(booking,"deposit")||booking.paymentMethod||"",creditAmount:money(booking.creditAmount),creditPaymentMethod:bookingSavedPaymentMethod(booking,"credit"),
      balanceAmount:Math.max(money(booking.totalAmount)-money(booking.depositAmount)-money(booking.creditAmount),0),
      agent:booking.agentName||booking.source||""
    }));
  }else if(type==="boat"){
    title="Boat Passenger Manifest";
    purpose="รายชื่อและจำนวนผู้โดยสารสำหรับทีมเรือ แยกเที่ยวลงเกาะและขึ้นจากเกาะ";
    rows=passengerRows(entries,{includeHealth:true});
  }else if(type==="island"){
    title="Island Arrival & Departure Report";
    purpose="รายชื่อผู้ลงเกาะและผู้ขึ้นจากเกาะสำหรับพนักงานประจำเกาะ";
    rows=passengerRows(entries,{includeHealth:true});
  }else if(type==="insurance"){
    title="ใบส่งประกัน";
    purpose="รายชื่อผู้เดินทางสำหรับส่งทำประกัน แยกตามหัวหน้าทริป";
    const people=arrivals.flatMap(({booking})=>passengersOf(booking));
    const isChildTitle=person=>["เด็กชาย","เด็กหญิง"].includes(String(person.title||"").trim());
    insuranceSummary={adult:people.filter(person=>!isChildTitle(person)).length,child:people.filter(isChildTitle).length,total:people.length};
    rows=arrivals.flatMap(({booking})=>passengersOf(booking).map((person,index)=>({leader:index===0?leaderName(booking):"",passenger:personName(person)})));
  }else if(type==="driver"){
    title="Driver Transfer Report";
    purpose="รายการรับส่งหัวหน้ากลุ่ม เบอร์ติดต่อ และจำนวนผู้โดยสาร";
    rows=entries.map(({booking,direction,date})=>({
      date:date||booking.travelDate,direction,bookingCode:booking.bookingCode,leader:leaderName(booking),phone:booking.phone||"",
      pax:passengersOf(booking).length,program:[...new Set(passengersOf(booking).map(person=>person.program?.name).filter(Boolean))].join(", "),
      island:[...new Set(passengersOf(booking).map(person=>person.island).filter(Boolean))].join(", "),
      accommodation:bookingAccommodationText(booking),
      note:booking.bookingNote||""
    }));
  }else{
    throw new Error("Invalid report type");
  }

  const uniqueBookings=new Map(entries.map(({booking})=>[booking.bookingCode,booking]));
  const reportBookings=type==="counter"?active.filter(booking=>booking.travelDate>=date&&booking.travelDate<=toDate):[...uniqueBookings.values()];
  const reportPax=["counter","driver"].includes(type)?reportBookings.reduce((sum,booking)=>sum+passengersOf(booking).length,0):rows.length;
  return{
    date,type,title,purpose,range:{from:date,to:toDate},rows,equipment:equipmentSummary(arrivals),accommodation:accommodationSummary(arrivals),insuranceSummary,
    summary:{
      bookings:reportBookings.length,
      pax:reportPax,
      arrivals:arrivals.reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      departures:entries.filter(row=>row.movement==="departure").reduce((sum,row)=>sum+passengersOf(row.booking).length,0),
      expectedRevenue:reportBookings.reduce((sum,booking)=>sum+money(booking.totalAmount),0)
    }
  };
}
