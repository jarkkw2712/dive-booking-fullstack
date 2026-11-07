const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('print report display names are prefixed, alphabetically sorted and preserve the selection and permissions',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const fn=source.slice(source.indexOf('function configureReportOptions()'),source.indexOf('const reportColumnLabels='));
  const make=(value,text,permission='allowed')=>({value,textContent:text,dataset:{anyPermission:permission},classList:{toggle(){}},hidden:false,disabled:false});
  const options=[make('management','CEO / Management — สรุปวันนี้และ 7 วัน'),make('equipment_summary','ใบรายงานอุปกรณ์ (รายวัน)'),make('equipment_summary_range','ใบรายงานอุปกรณ์ (ช่วงวันที่)'),make('front_charge','ใบหน้าชาร์จ (รายวัน)'),make('register_summary_range','ใบสรุปยอดยืนยันการจอง (ช่วงวันที่)'),make('van_daily_reference','รายงานรถตู้','denied')];
  const select={options,value:'equipment_summary',querySelector(selector){return this.options.find(option=>selector.includes(`"${option.value}"`))||null},appendChild(option){this.options.splice(this.options.indexOf(option),1);this.options.push(option)},get selectedOptions(){return this.options.filter(option=>option.value===this.value)}};
  const context={document:{getElementById:()=>select},hasAnyPermission:permission=>permission!=='denied'};
  vm.runInNewContext(`${fn};configureReportOptions();configureReportOptions()`,context);
  assert.equal(select.value,'equipment_summary');assert.equal(options.length,6);
  for(const option of options)assert.match(option.textContent,/^ใบ(?:รายงาน|สรุป) \S/);
  const keys=options.map(option=>option.textContent.replace(/^ใบ(?:รายงาน|สรุป)\s+/,''));assert.deepEqual(keys,[...keys].sort((a,b)=>a.localeCompare(b,'th',{numeric:true})));
  assert.equal(options.find(option=>option.value==='van_daily_reference').disabled,true);
});
