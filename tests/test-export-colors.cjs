const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{V}=require('../src/core.js'),XLSX=require('../vendor/xlsx.full.min.js');
const nodes={},ctx={V,XLSX,TextEncoder,TextDecoder,Uint8Array,console,document:{addEventListener(){},getElementById(id){return nodes[id]??={innerHTML:''}}},window:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);const run=s=>vm.runInContext(s,ctx);
run(`S=V.blank();S.name='颜色测试';S.groups=[{id:'g',no:'1',name:'测试岗位',cap:20,leader:'leader',area:'area'}];
S.people=[['area','内部区长','internal',true,true],['leader','摄影组长','internal',true,false],['both','摄影小闪电','normal',true,true],['photo','普通摄影','normal',true,false],['run','普通小闪电','normal',false,true],['internal','内部人员','internal'],['team','团体人员','team'],['couple','情侣人员','couple'],['family','家属人员','family'],['normal','普通人员','normal']].map(([id,name,cat,photo=false,run=false])=>V.person({id,name,cat,photo,run,student:'000'+id,group:'g'}));
S.people.push(V.person({id:'reserve',name:'储备摄影',reserve:true,photo:true}));S.withdrawn=[V.person({id:'gone',name:'退出团体',cat:'team',withdrawnAt:'2026-11-21',withdrawalReason:'个人原因'})];exportCols=['student','name','email','photo','run'];exportSelection=['g'];exportInitialized=true;exportSpecial='reserve';S.exportWithdrawn=true;`);
let bytes=run('workbookFor(S.groups,true,true)'),wb=XLSX.read(bytes,{type:'array',cellStyles:true});
assert.equal(wb.Sheets[wb.SheetNames[0]].A7.s.patternType,'none','默认不填色');
run('S.exportRowColors=true');bytes=run('workbookFor(S.groups,true,true)');wb=XLSX.read(bytes,{type:'array',cellStyles:true});const ws=wb.Sheets[wb.SheetNames[0]];
const colors=['D8B4FE','FFE680','99E6D8','BAE6B5','FFD19A','CCE5FF','E1D5F5','FFC9DC','FFE2BB'];
colors.forEach((color,i)=>{for(const col of ['A','B','C','D','E'])assert.equal(ws[col+(i+7)].s.fgColor.rgb,color,`整行包括空白列 ${col}${i+7}`)});
assert.equal(ws.A16.s.patternType,'none','无特殊身份普通人员不填色');assert.equal(ws.A6.s.patternType,'none','表头不误涂');assert.equal(ws.A7.v,'000area','前导零不变');assert.equal(ws['!autofilter'].ref,'A6:E16');
assert.equal(wb.Sheets['储备名单'].A6.s.fgColor.rgb,'BAE6B5');assert.equal(wb.Sheets['放弃参加名单'].A6.s.fgColor.rgb,'E1D5F5');
run(`renderExportContent();saveExportPreset('彩色名单');S.exportRowColors=false;checkpoint=()=>{};changed=()=>{};renderExport=()=>{};toast=()=>{};applyExportPreset(S.exportPresets[0].id);`);
assert(run('S.exportRowColors'));assert(nodes.mainContent.innerHTML.includes('整行颜色标识'));assert.equal((nodes.mainContent.innerHTML.match(/class="export-colored-row"/g)||[]).length,11);
assert(!run(`exportRowAttributes(S.people.find(p=>p.id==='normal'))`));run('S=JSON.parse(JSON.stringify(S));recoverExport()');assert(run('S.exportRowColors'));
// Old presets intentionally restore the old uncolored output, without altering roster/column data.
run(`S.exportPresets.push({id:'old',name:'旧方案',cols:['name','student'],mode:'book'});applyExportPreset('old')`);assert.equal(run('S.exportRowColors'),false);
// Same writer covers per-group files and email attachments; reject no columns as before.
run(`S.exportRowColors=true;exportCols=['name'];`);const one=XLSX.read(run('workbookFor([S.groups[0]])'),{type:'array',cellStyles:true});assert.equal(one.Sheets[one.SheetNames[0]].A7.s.fgColor.rgb,'D8B4FE');assert.equal(one.SheetNames.length,1);
// Preserve pre-existing number formats when adding fills.
run(`globalThis.styled=XLSX.utils.book_new();globalThis.sheet=XLSX.utils.aoa_to_sheet([[42],['普通']]);sheet.A1.z='0.00';sheet['!exportRowColors']={1:'FFE680'};XLSX.utils.book_append_sheet(styled,sheet,'格式');`);const fmt=XLSX.read(run('writeExportWorkbook(styled)'),{type:'array',cellStyles:true,cellNF:true}).Sheets['格式'];assert.equal(fmt.A1.z,'0.00');assert.equal(fmt.A1.v,42);assert.equal(fmt.A1.s.fgColor.rgb,'FFE680');assert.equal(fmt.A2.s.patternType,'none');
console.log('通过：9类整行颜色、身份优先级、普通留白、空白单元格、前导零与原格式、储备/放弃名单、多表和单表、开关/预览/方案持久化。');
