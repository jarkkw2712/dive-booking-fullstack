(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.parseSmartPasteText=api.parseSmartPasteText;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function parseSmartPasteText(text){
    const lines=String(text||"").normalize("NFC").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return{ok:false,error:"กรุณาวางรายชื่อผู้เดินทาง"};
    const passengers=[];
    for(const original of lines){
      const line=original.replace(/^\s*(?:\d+\s*[.)\-:]|[-•])\s*/,"").replace(/\s+/g," ").trim();
      const match=line.match(/^(นางสาว|เด็กชาย|เด็กหญิง|นาย|นาง)\s+([^\s]+)\s+(.+)$/u);
      if(!match||!match[3].trim())return{ok:false,error:`รูปแบบไม่ถูกต้อง: ${original}`};
      passengers.push({title:match[1],firstName:match[2],lastName:match[3].trim()});
    }
    return{ok:true,passengers};
  }
  return{parseSmartPasteText};
});
