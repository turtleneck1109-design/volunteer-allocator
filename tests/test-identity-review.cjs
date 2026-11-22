const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{V}=require('../src/core.js');
const make=rows=>({...V.blank(),identityCheckRequired:true,people:rows.map(V.person)});
const entry=(s,id)=>V.identityReview(s).find(e=>e.ids.includes(id));
let s=make([{id:'a',name:'甲',student:'001',idNumber:'000123X',idNumberMapped:true},{id:'dup',name:'甲',student:'001',idNumberMapped:false},{id:'homonym',name:'甲',student:'002'},{id:'wrong-name',name:'乙',student:'001'},{id:'no-student',name:'甲'}]);
const before=V.copy(s);assert.equal(entry(s,'dup').status,'complete');assert.deepEqual(entry(s,'dup').values,['000123X']);for(const id of ['homonym','wrong-name','no-student'])assert.equal(entry(s,id).status,'missing');assert.deepEqual(s,before);
assert(V.identityReviewErrors(s).length);assert.throws(()=>V.placeLeaders(s),/身份证/);assert.throws(()=>V.allocate(s,'normal'),/身份证/);assert.throws(()=>V.remainingPlan(s),/身份证/);assert.throws(()=>V.finalizeOverview(s),/身份证/);
// Missing placeholders never count as a number. Legacy headers infer only the person's own ID.
s=make([{id:'a',name:'甲',student:'001',raw:{'Q6. 您的身份证号':'000123x','家属身份证号':'OTHER'}},{id:'b',name:'乙',raw:{'Q6. 您的证件号':'暂无'}},{id:'c',name:'丙',idNumberMapped:false,raw:{'身份证号':'SHOULD-NOT-INFER'}},{id:'d',name:'丁',raw:{'家属身份证号':'OTHER','证件类型':'身份证'}}]);
assert.deepEqual(entry(s,'a').values,['000123X']);for(const id of ['b','c','d'])assert.equal(entry(s,id).status,'missing');
V.updatePerson(s,'a',{idNumber:''});assert.equal(entry(s,'a').status,'missing');assert.equal(s.people[0].raw['Q6. 您的身份证号'],'000123x');
// Decisions are explicit, per identity, persistent, and preserve allocation/locks for metadata edits.
s=make([{id:'a',name:'甲',student:'001',group:'g',locked:true},{id:'dup',name:'甲',student:'001'},{id:'b',name:'乙',student:'002'}]);s.groups=[{id:'g',no:'1',name:'服务',cap:3,leader:null,area:null}];s.confirmed={dedup:true,roles:true,internal:true,overview:true};
V.resolveIdentityReview(s,'a','keep');assert.equal(entry(s,'dup').status,'kept');assert.equal(entry(s,'b').status,'missing');assert.equal(s.people[0].locked,true);assert.equal(s.people[0].group,'g');assert.equal(s.confirmed.roles,true);assert(!s.confirmed.dedup);assert.equal(entry(V.validateFile(V.copy(s)),'a').status,'kept');
V.updatePerson(s,'a',{name:'甲改名'});assert.equal(entry(s,'a').status,'missing');assert.equal(entry(s,'dup').status,'kept');
V.resolveIdentityReview(s,'a','fill',' 000456x ');assert.equal(entry(s,'a').values[0],'000456X');assert.equal(s.people[0].group,'g');assert.equal(s.people[0].locked,true);assert.equal(s.confirmed.roles,true);
assert.throws(()=>V.resolveIdentityReview(s,'b','fill','无'),/请输入/);
// Explicitly different identities cannot inherit a number via a third record.
s=make([{id:'a',name:'甲',student:'001',idNumber:'FIRST'},{id:'b',name:'甲',student:'001'},{id:'c',name:'甲',student:'001'}]);V.markDistinct(s,['a','b']);assert.equal(entry(s,'b').status,'missing');assert.equal(entry(s,'c').status,'missing');
// Conflicting values cannot be waived or silently merged; correction applies to exact matching rows.
s=make([{id:'a',name:'甲',student:'001',idNumber:'FIRST'},{id:'b',name:'甲',student:'001',idNumber:'SECOND'}]);assert.equal(entry(s,'a').status,'conflict');assert.throws(()=>V.resolveIdentityReview(s,'a','keep'),/冲突/);assert.throws(()=>V.merge(s,['a','b'],'a'),/身份证/);V.resolveIdentityReview(s,'a','fill','VERIFIED');assert.equal(entry(s,'a').status,'complete');V.merge(s,['a','b'],'b');assert.equal(s.people.length,1);assert.deepEqual(entry(s,'b').values,['VERIFIED']);
s=make([{id:'a',name:'甲',student:'001',idNumber:'FIRST'},{id:'b',name:'甲',student:'001',idNumber:'SECOND'}]);V.resolveIdentityReview(s,'a','distinct');assert.equal(V.identityReview(s).length,2);assert.deepEqual(V.identityReviewErrors(s),[]);assert.deepEqual(V.duplicateSets(s),[]);
// Delete exact duplicate rows together, leave namesakes, retain reason, and re-review restored records.
s=make([{id:'a',name:'甲',student:'001'},{id:'dup',name:'甲',student:'001'},{id:'other',name:'甲',student:'002'}]);V.resolveIdentityReview(s,'a','delete');assert.deepEqual(s.people.map(p=>p.id),['other']);assert.equal(s.withdrawn.length,2);assert(s.withdrawn.every(p=>p.withdrawalReason.includes('身份证号缺失')));V.restoreWithdrawn(s,'a');assert.equal(entry(s,'a').status,'missing');
// Source merge and removal keep provenance: deleting the only ID source makes it missing again.
function sourceState(){const out=make([{id:'a',name:'甲',student:'001',idNumber:'SOURCE-ID',idNumberMapped:true,origins:[{sourceId:'ordinary',file:'普通',sheet:'表',row:2}]},{id:'b',name:'甲',student:'001',idNumberMapped:false,origins:[{sourceId:'couple',file:'情侣',sheet:'表',row:2}]}]);out.sources=out.people.map((p,i)=>({id:i?'couple':'ordinary',file:i?'情侣':'普通',sheet:'表',type:'normal',records:[V.copy(p)]}));V.merge(out,['a','b'],'b');return out}
s=sourceState();assert.deepEqual(entry(s,'b').values,['SOURCE-ID']);let removed=V.removeSources(s,['ordinary']).state;assert.equal(entry(removed,'b').status,'missing');V.resolveIdentityReview(s,'b','fill','MANUAL');removed=V.removeSources(s,['couple']).state;assert.deepEqual(entry(removed,'b').values,['MANUAL']);assert.equal(removed.people[0].idNumberEdited,true);

// Legacy/manual records without recoverable source snapshots retain a number when merged.
s=make([{id:'a',name:'甲',student:'001',raw:{'身份证号':'LEGACY'}},{id:'b',name:'甲',student:'001'}]);V.merge(s,['a','b'],'b');assert.deepEqual(entry(s,'b').values,['LEGACY']);
// App parser/mapping, template, exports, stage guard, UI gate and atomic decision persistence.
const nodes=new Map(),ctx={V,console,document:{addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:''});return nodes.get(id)}},window:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);const run=code=>vm.runInContext(code,ctx);const json=code=>JSON.parse(run(`JSON.stringify(${code})`));
ctx.mergedSourceState=sourceState();run(`S=mergedSourceState;V.withdraw(S,'b','测试退出')`);assert.equal(run("unifiedValue(S.withdrawn[0],'证件号')"),'SOURCE-ID');
run(`S=V.blank();globalThis.headers=['Q6. 您家属的身份证号','Q5. 您的证件类型','Q7. 您的身份证号','Q1. 您的学号','Q2. 您的姓名'];globalThis.mapping=inferMap(headers);globalThis.sheet={type:'normal',file:'普通.xlsx',name:'Sheet1',header:0,map:mapping,rows:[headers,['OTHER','身份证','000123x','00001','甲']]};globalThis.record=parseSheet(sheet)[0]`);
assert.equal(run('mapping.idNumber'),2);assert.equal(run('record.idNumber'),'000123X');assert.equal(run('record.idNumberMapped'),true);assert.equal(run('record.student'),'00001');assert.equal(run("inferMap(['家属身份证号','证件类型']).idNumber"),-1);
run(`S.people=[record];`);assert.equal(run("unifiedValue(record,'证件号')"),'000123X');run(`V.resolveIdentityReview(S,record.id,'fill','CHANGED')`);assert.equal(run("unifiedValue(record,'证件号')"),'CHANGED');assert.equal(run("record.raw['Q7. 您的身份证号']"),'000123x');
run(`S=V.blank();S.people=[V.person({id:'manual-only',name:'手工人员'})];V.resolveIdentityReview(S,'manual-only','fill','000009X')`);assert(run("availableColumns().some(([key])=>key==='unified:证件号')"));assert.equal(run("unifiedValue(S.people[0],'证件号')"),'000009X');run("V.withdraw(S,'manual-only','测试')");assert.equal(run("unifiedValue(S.withdrawn[0],'证件号')"),'000009X');
for(const type of ['内部人员','团体人员','情侣人员','家属人员','普通人员'])assert(run(`templateRows(false).${type}[0].includes('身份证号')`));
run(`sheet.map.idNumber=-1;globalThis.without=parseSheet(sheet)[0];`);assert.equal(run('without.idNumber'),'');assert.equal(run('without.idNumberMapped'),false);assert.equal(run("V.identityReview({...V.blank(),people:[without]})[0].status"),'missing');
run(`S=V.blank();S.people=[V.person({id:'pending',name:'待核对',student:'001'})];page='dedup';render=()=>{};renderStats=()=>{};errorBox=e=>{globalThis.lastError=e.message};toast=()=>{};closeModal=()=>{};globalThis.saved=[];saveSnapshot=async (label,next=S)=>{saved.push(V.copy(next));return true};renderDedup()`);
assert(nodes.get('mainContent').innerHTML.includes('缺少身份证号'));assert(!nodes.get('mainContent').innerHTML.includes('<h2>重复记录</h2>'));
(async()=>{
 await run('confirmStage()');assert(run('lastError.includes("身份证")'));assert.equal(run('saved.length'),0);assert.equal(run('page'),'dedup');
 const original=json('S');run(`saveSnapshot=async()=>false`);assert.equal(await run("applyIdentityDecision('pending','delete','',S.revision)"),false);assert.deepEqual(json('S'),original);assert.equal(run('busy'),false);
 run(`globalThis.saves=0;saveSnapshot=async()=>++saves<2`);assert.equal(await run("applyIdentityDecision('pending','keep','',S.revision)"),false);assert.deepEqual(json('S'),original);
 run(`saveSnapshot=async()=>true`);assert.equal(await run("applyIdentityDecision('pending','keep','',S.revision+1)"),false);assert.deepEqual(json('S'),original);
 assert.equal(await run("applyIdentityDecision('pending','keep','',S.revision)"),true);assert.equal(run('V.identityReview(S)[0].status'),'kept');run('renderDedup()');assert(nodes.get('mainContent').innerHTML.includes('<h2>重复记录</h2>'));await run('confirmStage()');assert.equal(run('page'),'roles');assert.equal(run('S.confirmed.dedup'),true);
 console.log('通过：身份证列映射/文本保留、精确姓名学号复用、同名隔离、显式不同身份、缺失/冲突/手工核对、删除恢复、来源撤销、旧项目、分组保护、导出一致、查重前置与快照失败原子性。');
})().catch(e=>{console.error(e);process.exitCode=1});
