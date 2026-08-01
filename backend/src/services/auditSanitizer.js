const sensitiveKey=/password|token|secret|authorization|cookie|api.?key|service.?role/i;

export function sanitizeAuditValue(value,depth=0){
  if(depth>6)return "[MAX_DEPTH]";
  if(value===null||value===undefined||typeof value==="number"||typeof value==="boolean")return value??null;
  if(typeof value==="string")return value.length>2000?`${value.slice(0,2000)}...[TRUNCATED]`:value;
  if(Array.isArray(value))return value.slice(0,200).map(item=>sanitizeAuditValue(item,depth+1));
  if(typeof value==="object")return Object.fromEntries(Object.entries(value).slice(0,200).map(([key,item])=>[key,sensitiveKey.test(key)?"[REDACTED]":sanitizeAuditValue(item,depth+1)]));
  return String(value);
}
