// Pure Booking List facets. The UI filters its already-loaded bookings; no API call per search.
const bookingListMetricConfig={
  programs:{label:"โปรแกรม",masterKey:"programs",id:"program_id",name:"program_name"},
  accommodations:{label:"ที่พัก",masterKey:"accommodations",id:"accommodation_id",name:"accommodation_name"},
  addons:{label:"อุปกรณ์ / Add-ons",masterKey:"addOns",id:"addon_id",name:"addon_name"},
  islandAddOns:{label:"Island Add-on / ดำน้ำ",masterKey:"islandAddOns",id:"island_addon_id",name:"island_addon_name"},
  agents:{label:"Agents",masterKey:"agents",id:"agent_id",name:"agent_name"},
  bookingOriginals:{label:"ต้นฉบับ",masterKey:"bookingOriginals",id:"original_id",name:"original_name"},
  customerSources:{label:"ช่องทางลูกค้า",masterKey:"customerSources",id:"source_id",name:"source_name"},
  transportationMethods:{label:"วิธีการเดินทาง",masterKey:"transportationMethods",id:"method_id",name:"method_name"},
  islands:{label:"เกาะ",masterKey:"islands",id:"island_id",name:"island_name"},
  paymentMethods:{label:"ช่องทางชำระเงิน",masterKey:"paymentMethods",id:"method_id",name:"method_name"},
  statuses:{label:"สถานะ",masterKey:"statuses",id:"status_id",name:"status_name"}
};
function bookingListNormalize(value){return String(value??"").trim().toLocaleLowerCase("th-TH")}
function bookingListFieldValues(booking,metric){
  const people=booking.passengers||[];
  if(metric==="programs")return people.flatMap(person=>[person.program?.programId,person.program?.name]);
  if(metric==="accommodations"){
    const rows=booking.accommodations?.length?booking.accommodations:people.filter(person=>person.accommodationId);
    return rows.flatMap(row=>[row.accommodationId,row.accommodationName]);
  }
  if(metric==="addons")return people.flatMap(person=>(person.preAddOns||[]).filter(item=>item.selected!==false).flatMap(item=>[item.id,item.name]));
  if(metric==="islandAddOns")return people.flatMap(person=>(person.islandAddOns||[]).filter(item=>item.selected!==false).flatMap(item=>[item.id,item.name]));
  if(metric==="agents")return[booking.agentName];
  if(metric==="bookingOriginals")return[booking.bookingOriginal];
  if(metric==="customerSources")return[booking.source];
  if(metric==="transportationMethods")return[booking.transportationMethod,...people.flatMap(person=>[person.transportationMethod,person.returnTransportationMethod,...(person.extraTransportStops||[]).map(stop=>stop.method)])];
  if(metric==="islands")return[booking.island,...people.map(person=>person.island)];
  if(metric==="statuses")return[booking.status];
  if(metric==="paymentMethods"){
    const allocations=Object.values(booking.paymentBreakdown||{}).flatMap(row=>Object.entries(row||{}).filter(([,amount])=>Number(amount)>0).map(([name])=>name));
    return[booking.paymentMethod,Number(booking.depositAmount)>0?booking.depositPaymentMethod:null,Number(booking.creditAmount)>0?booking.creditPaymentMethod:null,...allocations,...people.flatMap(person=>[
      Number(person.transportationAmount)>0?person.transportationPaymentMethod:null,
      Number(person.returnTransportationAmount)>0?person.returnTransportationPaymentMethod:null,
      ...(person.preAddOns||[]).filter(item=>item.selected!==false).map(item=>item.paymentMethod),
      ...(person.islandAddOns||[]).filter(item=>item.selected!==false).map(item=>item.paymentMethod),
      ...(person.extraTransportStops||[]).filter(stop=>Number(stop.amount)>0).map(stop=>stop.paymentMethod)
    ])];
  }
  return[];
}
function bookingListFacetOptions(masterData,extraMasters,rows,metric){
  const config=bookingListMetricConfig[metric];if(!config)return[];
  const source=extraMasters[config.masterKey]||masterData[config.masterKey]||[];
  const options=source.filter(row=>row.active_flag!==false).map(row=>({value:String(row[config.id]??row[config.name]??""),label:String(row[config.name]??row[config.id]??""),aliases:[row[config.id],row[config.name]].map(bookingListNormalize).filter(Boolean)})).filter(option=>option.value);
  const historical=new Set();
  for(const booking of rows)for(const raw of bookingListFieldValues(booking,metric)){
    const key=bookingListNormalize(raw);if(!key||historical.has(key)||options.some(option=>option.aliases.includes(key)))continue;
    historical.add(key);options.push({value:String(raw),label:`${raw} (รายการเดิม)`,aliases:[key]});
  }
  return options;
}
function bookingListPrepareFacets(filters,masterData,extraMasters,allBookings){
  const groups=new Map();
  for(const filter of filters){
    if(!groups.has(filter.metric))groups.set(filter.metric,new Set());
    const aliases=filter.aliases?.length?filter.aliases:bookingListFacetOptions(masterData,extraMasters,allBookings,filter.metric).find(item=>item.value===filter.value)?.aliases;
    for(const alias of aliases||[bookingListNormalize(filter.value)])groups.get(filter.metric).add(alias);
  }
  return groups;
}
function bookingListMatchesFacets(booking,preparedFacets){
  for(const [metric,aliases] of preparedFacets){
    const selected=new Set(bookingListFieldValues(booking,metric).map(bookingListNormalize).filter(Boolean));
    if(!selected.size)return false;
    if(![...aliases].some(alias=>selected.has(alias)))return false;
  }
  return true;
}
