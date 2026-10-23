export function can(user,permission){
  return user?.role==="admin"||user?.permissions?.[permission]===true;
}

const moneyField=/(?:amount|price|rate|revenue|cost|balance|outstanding|subtotal|total|discount|paymentbreakdown|credit)/i;
const bankReferenceField=/(?:reference_no|referenceNo|bank_name|bankName|bank_account|bankAccount|slip_url|slipUrl|promptpay)/i;

function omitFields(value,shouldOmit){
  if(Array.isArray(value))return value.map(item=>omitFields(item,shouldOmit));
  if(!value||typeof value!=="object")return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,shouldOmit(key)?null:omitFields(item,shouldOmit)]));
}

export function bookingForUser(booking,user){
  if(can(user,"viewMoney"))return booking;
  return omitFields(booking,key=>moneyField.test(key));
}

export function bankReferencesForUser(data,user){
  if(can(user,"viewBankReference"))return data;
  return omitFields(data,key=>bankReferenceField.test(key));
}
