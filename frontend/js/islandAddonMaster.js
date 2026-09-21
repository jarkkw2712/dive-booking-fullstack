masterDataConfig.island_addons={id:"island_addon_id",name:"island_addon_name",price:"default_price"};
documentProfiles.DIVE_RECEIPT={title:"ใบเสร็จดำน้ำ",price:true,diveOnly:true};
documentVisibilityFields["ใบเสร็จดำน้ำ"]="show_dive_receipt";
documentVisibilityLabels.show_dive_receipt="ใบเสร็จดำน้ำ";

const configureMasterDataForIsland=configureMasterDataPriceField;
configureMasterDataPriceField=function(){configureMasterDataForIsland();const island=mdCat==="island_addons",visible=["addons","island_addons","transportation_methods","accommodations"].includes(mdCat);document.getElementById("mdpDocumentVisibility").classList.toggle("hidden",!visible);document.getElementById("mdpIslandPurchaseVisibility").classList.toggle("hidden",!["addons","island_addons"].includes(mdCat));document.getElementById("mdpDiveReceiptVisibility").classList.toggle("hidden",!island)};
const openMasterDataEditorForIsland=openMasterDataEditor;
openMasterDataEditor=function(){openMasterDataEditorForIsland();document.getElementById("mdpShowDiveReceipt").checked=mdCat==="island_addons";if(mdCat==="island_addons"){document.getElementById("mdpShowMoneyReceipt").checked=true;document.getElementById("mdpShowEquipmentSlip").checked=false;document.getElementById("mdpShowIslandPurchaseOrder").checked=true}configureMasterDataPriceField()};
const editMasterDataItemForIsland=editMasterDataProItem;
editMasterDataProItem=function(index){editMasterDataItemForIsland(index);const row=mdRows[index]||{};document.getElementById("mdpShowDiveReceipt").checked=row.show_dive_receipt!==false;configureMasterDataPriceField()};
const masterVisibilityForIsland=masterDataDocumentVisibility;
masterDataDocumentVisibility=function(){return{...masterVisibilityForIsland(),show_dive_receipt:document.getElementById("mdpShowDiveReceipt").checked}};

function islandMasterConfiguration(item){return item.documentVisibility||(master.islandAddOns||[]).find(row=>row.island_addon_id===item.id)||{show_money_receipt:true,show_island_purchase_order:true,show_dive_receipt:true}}
const addonConfigurationBeforeIslandMaster=addonConfiguration;
addonConfiguration=function(item){const islandMaster=(master.islandAddOns||[]).some(row=>row.island_addon_id===item.id);return item.source==="island"||islandMaster?islandDocumentVisibility(item):addonConfigurationBeforeIslandMaster(item)};
islandDocumentVisibility=function(item){const config=islandMasterConfiguration(item);return{show_register:config.show_register===true,show_money_receipt:config.show_money_receipt!==false,show_equipment_slip:config.show_equipment_slip===true,show_van_receipt:config.show_van_receipt===true,show_boat_ticket:config.show_boat_ticket===true,show_island_purchase_order:config.show_island_purchase_order!==false,show_dive_receipt:config.show_dive_receipt!==false}};

function islandAddonRowsForEditor(){
  const saved=passengers[0]?.islandAddOns||[],masterRows=master.islandAddOns||[],used=new Set(),rows=[];
  for(const source of masterRows){
    const savedIndex=saved.findIndex((item,index)=>!used.has(index)&&item.id===source.island_addon_id);
    if(savedIndex>=0){used.add(savedIndex);saved[savedIndex].source="island";rows.push({item:saved[savedIndex],savedIndex,selected:true,masterId:source.island_addon_id});}
    else rows.push({item:{id:source.island_addon_id,name:source.island_addon_name,qty:1,price:Number(source.default_price||0),defaultPrice:Number(source.default_price||0),paymentMethod:"",source:"island"},savedIndex:-1,selected:false,masterId:source.island_addon_id});
  }
  saved.forEach((item,savedIndex)=>{if(!used.has(savedIndex)){item.source="island";rows.push({item,savedIndex,selected:true,masterId:item.id||"",historical:true});}});
  return rows;
}
function toggleIslandAddonSelection(savedIndex,masterId,checked){
  const leader=passengers[0];if(!leader)return;leader.islandAddOns??=[];
  if(!checked&&savedIndex>=0)leader.islandAddOns.splice(savedIndex,1);
  else if(checked&&savedIndex<0){const source=(master.islandAddOns||[]).find(row=>row.island_addon_id===masterId);if(source)leader.islandAddOns.push({id:source.island_addon_id,name:source.island_addon_name,qty:1,price:Number(source.default_price||0),defaultPrice:Number(source.default_price||0),paymentMethod:"",receivedBy:currentUser?.displayName||"",source:"island",documentVisibility:islandDocumentVisibility({id:source.island_addon_id})});}
  renderPassengers();refreshSummary();
}
updateIslandAddon=function(index,field,value){const item=passengers[0]?.islandAddOns?.[index];if(!item)return;if(["qty","price"].includes(field))item[field]=Math.max(Number(value||0),0);else item[field]=value;refreshSummary()};
islandAddonEditor=function(){
  const rows=islandAddonRowsForEditor(),paymentOptions=item=>(master.paymentMethods||[]).map(method=>`<option value="${escapeHtml(method.method_name)}" ${item.paymentMethod===method.method_name?"selected":""}>${escapeHtml(method.method_name)}</option>`).join("");
  return`<b>Island Add-on / รายการดำน้ำ</b><p class="muted">รายการจาก Master Data จะแสดงทั้งหมด ติ๊กรายการที่ลูกค้าซื้อแล้วกรอกจำนวนและราคาได้ทันที</p>${rows.map(row=>{const item=row.item,disabled=row.selected?"":"disabled",old=row.historical?" (รายการเดิม)":"";return`<div class="island-addon-row ${row.selected?"selected":""}"><label class="island-addon-select"><input type="checkbox" data-master-id="${escapeHtml(row.masterId)}" ${row.selected?"checked":""} onchange="toggleIslandAddonSelection(${row.savedIndex},this.dataset.masterId,this.checked)"> <strong>${escapeHtml(item.name||row.masterId||"Island Add-on")}${old}</strong></label><div class="form-grid island-addon-fields"><div><label>จำนวน</label><input type="number" min="1" value="${Number(item.qty||1)}" ${disabled} onchange="updateIslandAddon(${row.savedIndex},'qty',this.value)"></div><div><label>ราคา</label><input type="number" min="0" step="0.01" value="${Number(item.price||0)}" ${disabled} onchange="updateIslandAddon(${row.savedIndex},'price',this.value)"></div><div><label>ช่องทางชำระเงิน</label><select ${disabled} onchange="updateIslandAddon(${row.savedIndex},'paymentMethod',this.value)"><option value="">ไม่ระบุ</option>${paymentOptions(item)}</select></div></div></div>`}).join("")||'<p class="muted island-addon-empty">ยังไม่มี Island Add-on ที่ใช้งาน กรุณาเพิ่มที่หน้า Master Data</p>'}`;
};

const groupedItemsBeforeDiveReceipt=documentGroupedItems;
documentGroupedItems=function(booking,profile){if(!profile?.diveOnly)return groupedItemsBeforeDiveReceipt(booking,profile);const groups=new Map();for(const person of booking.passengers||[])for(const item of person.islandAddOns||[]){if(!addonVisibleOnDocument({...item,source:"island"},profile))continue;const qty=Number(item.qty||1),unit=Number(item.price||0),name=item.name||"Island Add-on",key=`${item.id||name}:${unit}`,row=groups.get(key)||{name,qty:0,unit,total:0};row.qty+=qty;row.total+=qty*unit;groups.set(key,row)}return[...groups.values()]};
