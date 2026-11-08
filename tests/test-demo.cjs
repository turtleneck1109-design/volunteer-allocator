const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {V}=require('../src/core.js'),{Demo}=require('../src/demo.js');
const nodes=new Map(),storage=new Map();let writes=0,failNext=false;
const database={transaction(){writes++;const tx={objectStore(name){return {add(value){tx.snapshot=V.copy(value)},put(value,key){tx.current=value}}}};setTimeout(()=>{if(failNext){failNext=false;tx.error=Error('storage failure');tx.onerror()}else{storage.set(tx.snapshot.id,tx.snapshot);storage.set('current',tx.current);tx.oncomplete()}},5);return tx}};
const ctx={V,Demo,console,setTimeout,clearTimeout,database,assert,document:{addEventListener(){},querySelector(){return null},getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},close(){}});return nodes.get(id)}},window:{addEventListener(){}},localStorage:{setItem(){throw Error('Demo wrote page preference')}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
const run=code=>vm.runInContext(code,ctx),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
(async()=>{
 run(`render=()=>{};renderWorkspace=()=>{};toast=()=>{};errorBox=e=>{globalThis.lastError=e.message};closeModal=()=>{};db=database;`);
 // Actual import parser, duplicate merge, relation rules, roles and allocator all process the fixture.
 for(const mode of ['import','allocate','result']){
  run(`globalThis.scene=buildDemoScene('${mode}')`);
  if(mode==='import'){
   assert.equal(json('scene.imports.length'),6);
   run(`const originalState=S;S=scene.state;for(const sheet of scene.imports){const records=parseSheet(sheet);if(sheet.type==='groups')S.groups.push(...records);else S.people.push(...records)}globalThis.duplicateCount=V.duplicateSets(S).length;S=originalState;`);
   assert.equal(json('duplicateCount'),3);
  }else{
   assert.equal(json('scene.state.people.length'),48);assert.equal(json('scene.state.groups.length'),5);
   assert.deepEqual(json('V.relationErrors(scene.state)'),[]);
   if(mode==='result'){assert.deepEqual(json('V.validate(scene.state,true)'),[]);assert.equal(json('scene.state.people.filter(p=>p.group).length'),42);assert.equal(json('scene.state.people.filter(p=>p.reserve).length'),6);assert.equal(json('scene.state.withdrawn.length'),1)}
   else assert.equal(json('scene.state.stage'),'internal');
  }
 }
 run(`S=V.blank();S.name='原活动';S.people=[V.person({id:'real',name:'原名单人员',email:'private@example.test'})];pendingImports=[{id:'pending-real',rows:[['姓名'],['尚未导入']]}];page='overview';query='原';pageNo=3;pageSize=8;selected=new Set(['real']);exportCols=['name','email'];exportSelection=['real-group'];exportInitialized=true;undoStack=[{state:V.copy(S),imports:[]}];dirty=true;`);
 const original=json('S'),pending=json('pendingImports');
 // Existing writes must finish before entering; their snapshots cannot leak into demo history.
 const inFlight=run("saveSnapshot('先前保存')");assert.equal(await run('enterDemo()'),true);await inFlight;
 const persisted=storage.get(storage.get('current'));assert.deepEqual(persisted.state,original);assert.deepEqual(persisted.pendingImports,pending);
 const afterEntry=writes;assert.equal(json('history.length'),1);assert.equal(json('demoSession.original.history.length'),2);
 run(`S.name='已修改演示';changed();setPageSize(2);`);await run("saveSnapshot('演示快照')");
 run(`globalThis.exported=null;download=(name,data)=>globalThis.exported=JSON.parse(data);backup();`);
 assert(!JSON.stringify(json('exported')).includes('原名单人员'));
 await run('loadHistory()');await run("restoreProject({size:1,text(){throw Error('must not read file')}})");await run("handleFiles([{name:'real.xlsx'}])");
 assert.equal(writes,afterEntry);assert.equal(json('history.length'),2);
 assert.equal(await run("resetProject('clear','演示清空')"),true);assert.equal(writes,afterEntry);
 assert.equal(run("resetDemo('allocate')"),true);assert.equal(json('S.people.length'),48);
 assert.equal(run("resetDemo('import')"),true);assert.equal(json('pendingImports.length'),6);
 assert.equal(run('exitDemo()'),true);assert.deepEqual(json('S'),original);assert.deepEqual(json('pendingImports'),pending);
 assert.equal(json('query'),'原');assert.equal(json('pageNo'),3);assert.equal(json('pageSize'),8);assert.deepEqual(json('[...selected]'),['real']);assert.deepEqual(json('exportCols'),['name','email']);assert.equal(json('undoStack.length'),1);
 assert.equal(writes,afterEntry);assert.deepEqual(storage.get(storage.get('current')).state,original);
 // Failed persistence leaves the activity and UI usable; no demo is activated.
 failNext=true;assert.equal(await run('enterDemo()'),false);assert.equal(run('demoSession'),null);assert.deepEqual(json('S'),original);assert.equal(run('busy'),false);
 // No storage is safe only for a truly blank activity.
 run('db=null');await run('enterDemo()');assert.equal(run('demoSession'),null);
 run('S=V.blank();pendingImports=[];dirty=false');assert.equal(await run('enterDemo()'),true);assert.equal(run('exitDemo()'),true);
 console.log('通过：三个演示场景、真实分配规则、保存隔离、并发保存、导出隔离、退出恢复、存储失败保护。');
})().catch(e=>{console.error(e);process.exitCode=1});
