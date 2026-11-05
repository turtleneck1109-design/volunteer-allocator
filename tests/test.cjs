const fs=require('fs'),vm=require('vm'),assert=require('assert');
const XLSX=require('../vendor/xlsx.full.min.js'),{V}=require('../src/core.js');
const context={V,XLSX,console,TextEncoder,Uint8Array,DataView,Date,Map,Set,Math,JSON,Number,String,Array,Object,Error,RegExp,Blob,btoa:s=>Buffer.from(s,'binary').toString('base64'),document:{addEventListener(){},getElementById(){return {value:'',innerHTML:'',textContent:''}}},window:{addEventListener(){}}};vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),context);
vm.runInContext(`
 const sheets=templateRows(true),wb=XLSX.utils.book_new();Object.entries(sheets).forEach(([name,rows])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name));
 const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});globalThis.sampleBytes=new Uint8Array(bytes);const parsed=workbookSheets(bytes,'测试.xlsx');
 S=V.blank();parsed.forEach(sheet=>{const records=parseSheet(sheet);if(sheet.type==='groups')S.groups.push(...records);else S.people.push(...records)});
 if(S.people.length!==32)throw Error('样例导入人数不正确：'+S.people.length);
 const duplicates=V.duplicateSets(S);if(duplicates.length!==1)throw Error('查重失败');
 const keep=duplicates[0].find(p=>p.cat==='internal');V.merge(S,duplicates[0].map(p=>p.id),keep.id,true);V.resolveFamily(S);
 if(S.people.length!==31||V.relationErrors(S).length)throw Error('查重或家属绑定失败');
 S.groups.forEach((g,i)=>g.leader=S.people.filter(p=>p.intent==='小组长')[i].id);S.groups[0].area=S.people.find(p=>p.intent==='区长').id;
 V.placeLeaders(S);if(S.people.filter(p=>p.group).length!==4)throw Error('组长和家属未正确安排');
 V.allocate(S,'internal','',123);V.units(S).filter(u=>V.eligible(u,'internal')).flat().forEach(p=>p.locked=true);
 for(const team of allTeams()){V.allocate(S,'team',team,123);V.units(S).filter(u=>V.eligible(u,'team',team)).flat().forEach(p=>p.locked=true)}
 V.allocate(S,'couple','',123);V.units(S).filter(u=>V.eligible(u,'couple')).flat().forEach(p=>p.locked=true);
 V.allocate(S,'normal','',123);if(V.validate(S,true).length)throw Error(V.validate(S,true).join(','));
 if(S.people.filter(p=>p.group).length!==24||S.people.filter(p=>p.reserve).length!==7)throw Error('储备人数不正确');
 exportCols=['name','student','role','photo'];const out=workbookFor(S.groups,true);const read=XLSX.read(out,{type:'array'});if(read.SheetNames.length!==4)throw Error('导出工作表数错误');
 const p=S.people.find(p=>p.cat==='normal'&&p.group),old=V.copy(S);p.locked=false;V.move(S,[p.id],'reserve');if(!p.reserve)throw Error('人工移动失败');S=old;
 const testLeader=S.people.find(p=>p.id===S.groups[0].leader);let blocked=false;try{V.move(S,[testLeader.id],S.groups[1].id)}catch(e){blocked=true}if(!blocked)throw Error('允许错误移动组长');
 V.validateFile(S);globalThis.testState=V.copy(S);globalThis.exportBytes=out;globalThis.zipBytes=zipFiles([{name:'中文名单.xlsx',data:out}]);
 globalThis.emlText=makeEml({g:S.groups[0],p:testLeader,email:'leader@example.com',subject:'测试活动',body:'中文正文'});
 console.log('通过：模板导入、跨表查重、家属姓名关联、任职、四阶段分配、容量、储备、手动移动、组长保护、Excel往返。');
`,context);
fs.writeFileSync(__dirname+'/test-input.xlsx',context.sampleBytes);
fs.writeFileSync(__dirname+'/test-export.xlsx',context.exportBytes);fs.writeFileSync(__dirname+'/test-package.zip',context.zipBytes);fs.writeFileSync(__dirname+'/test-mail.eml',context.emlText);
const state=context.testState,full=state.groups[0],unit=V.units(state).find(u=>u[0].teams.length);unit.forEach(p=>p.locked=false);const before=JSON.stringify(state);assert.throws(()=>V.move(state,unit.map(p=>p.id),full.id));assert.equal(JSON.stringify(state),before);
const huge=V.blank();huge.groups=[{id:'g',no:'1',name:'小组',cap:2,leader:'l',area:null}];huge.people=[V.person({id:'l',name:'组长',cat:'internal',group:'g',locked:true}),...['a','b','c'].map(id=>V.person({id,name:id,cat:'team',teams:['大团体']}))];const r=V.allocate(huge,'team','大团体',1,5);assert.equal(r.unplaced.length,3);assert(!huge.people.slice(1).some(p=>p.reserve||p.group));
const dup=V.blank();dup.people=[V.person({name:'同名',student:'1'}),V.person({name:'同名',student:'2'})];assert.equal(V.duplicateSets(dup).length,1);V.markDistinct(dup,dup.people.map(p=>p.id));assert.equal(V.duplicateSets(dup).length,0);
console.log('通过：容量拒绝且不部分修改、过大团体保留待处理、同名不同人确认。');
vm.runInContext(`
S=V.blank();const autoSheet={type:'groups',header:0,merges:[{s:{r:1,c:0},e:{r:2,c:0}}],map:{no:-1,region:0,groupName:1,cap:2},rows:[['区域','岗位名称','需求'],['起点','垃圾回收',30],['','检录',30],[],['赛道','收容',7],['','合计',67]]};
let numbered=parseSheet(autoSheet);if(numbered.map(g=>g.no).join(',')!=='1,2,3')throw Error('无组号列自动编号失败');if(numbered[1].region!=='起点')throw Error('合并区域未保留');
S.groups=[{id:'old',no:'5',name:'已有组',cap:10}];numbered=parseSheet(autoSheet);if(numbered.map(g=>g.no).join(',')!=='6,7,8')throw Error('续号失败');
const explicit={type:'groups',header:0,merges:[],map:{no:0,groupName:1,cap:2,region:-1},rows:[['组号','名称','人数'],['','未编号',3],['6','岗位A',2],['6','岗位B',4],['','第二个未编号',1]]};
numbered=parseSheet(explicit);if(numbered.map(g=>g.no).join(',')!=='7,6,6,8'||numbered[1].cap!==2||numbered[2].cap!==4||numbered[1].id===numbered[2].id)throw Error('已有组号保留或跳过冲突失败');
if(nextGroupNumber()!==6)throw Error('手动添加组号建议错误');
console.log('通过：无组号自动编号、空行合计排除、区域合并、续号、避让已有编号、重复组号按项目独立保留。');
`,context);
vm.runInContext(`(async()=>{
 render=()=>{};closeModal=()=>{};toast=()=>{};
 let captured=[],failAt=0,calls=0;
 saveSnapshot=async(label,state=S,imports=pendingImports)=>{calls++;if(calls===failAt)return false;captured.push({label,state:V.copy(state),pendingImports:V.copy(imports)});return true};
 const initial=()=>{S=V.blank();S.name='旧活动';S.people=[V.person({name:'测试人员'})];S.groups=[{id:'g',no:'1',name:'测试组',cap:5}];pendingImports=[{name:'未确认表格',rows:[['姓名'],['测试人员']]}];selected=new Set([S.people[0].id]);query='旧搜索';currentTeam='旧团体';page='overview'};
 initial();if(!await resetProject('clear','旧活动'))throw Error('清空失败');if(S.name!=='旧活动'||S.people.length||S.groups.length||pendingImports.length||selected.size||page!=='import')throw Error('清空状态不完整');if(captured[0].state.people.length!==1||captured[0].pendingImports.length!==1||captured[1].pendingImports.length)throw Error('清空前备份或空白快照错误');
 initial();calls=0;captured=[];if(!await resetProject('new','新的活动'))throw Error('新建失败');if(S.name!=='新的活动'||captured[0].state.name!=='旧活动')throw Error('活动名称错误');
 for(const n of [1,2]){initial();calls=0;failAt=n;const before=JSON.stringify(S);if(await resetProject('clear','旧活动'))throw Error('保存失败却返回成功');if(JSON.stringify(S)!==before||pendingImports.length!==1||busy)throw Error('保存失败后修改了当前活动')}
 console.log('通过：新建与清空、待导入表格备份、状态重置、任一保存失败不清空。');
})()`,context).catch(e=>{console.error(e);process.exitCode=1});
