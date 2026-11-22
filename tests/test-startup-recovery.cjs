const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {V}=require('../src/core.js');
const code=fs.readFileSync('src/app.js','utf8').replace(/boot\(\);\s*$/,'');
function fixture(){
 const nodes=new Map(),timers=new Map();let timerId=0,request;
 const state=V.blank();state.name='原项目';state.people=[V.person({name:'保留人员'})];
 const snapshot={id:'current-id',state,time:'2026/11/22 10:00',created:1,pendingImports:[]};
 let allReads=0,closed=0;
 const connection={close(){closed++},transaction(name){return {objectStore(){return {get(key){const req={};queueMicrotask(()=>{req.result=name==='meta'?'current-id':snapshot;req.onsuccess?.()});return req},getAll(){allReads++;const req={};queueMicrotask(()=>{req.result=[snapshot];req.onsuccess?.()});return req}}}}}};
 const ctx={V,console,queueMicrotask,localStorage:{getItem(){return null}},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},indexedDB:{open(){return request={}}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},close(){}});return nodes.get(id)},addEventListener(){}},window:{addEventListener(){}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const run=s=>vm.runInContext(s,ctx);
 run('render=()=>{globalThis.rendered=S.name};closeModal=()=>{};toast=()=>{};modal=(title,html)=>{globalThis.dialog=html};');
 return {run,ctx,nodes,connection,snapshot,get allReads(){return allReads},get closed(){return closed},get request(){return request},timeout(){const entry=[...timers].find(([,t])=>t.ms===10000);assert(entry);timers.delete(entry[0]);entry[1].fn()}};
}
async function tick(){await new Promise(r=>setImmediate(r))}
(async()=>{
 // Boot reads only the current snapshot, not every historical copy of a large roster.
 let f=fixture(),pending=f.run('boot()');assert.match(f.nodes.get('mainContent').innerHTML,/读取当前项目/);
 f.request.result=f.connection;f.request.onsuccess();await pending;
 assert.equal(f.run('S.name'),'原项目');assert.equal(f.allReads,0);assert.equal(f.run('busy'),false);assert.equal(f.run('historyLoaded'),false);
 await f.run('loadHistory()');assert.equal(f.allReads,1);assert.equal(f.run('historyLoaded'),true);
 // A stalled open must leave actionable recovery UI; no database deletion.
 f=fixture();pending=f.run('boot()');f.timeout();await pending;
 assert.equal(f.run('startupStatus'),'error');assert.match(f.nodes.get('mainContent').innerHTML,/超时/);
 f.run('clearProject()');assert.match(f.ctx.dialog,/打开空白临时活动/);
 const late=f.request;f.run('startTemporaryProject()');f.run("S.name='临时编辑'");late.result=f.connection;late.onsuccess();await tick();
 assert.equal(f.run('S.name'),'临时编辑');assert.equal(f.closed,1);
 assert.equal(await f.run("saveSnapshot('临时保存')"),true);
 assert.equal(f.run('dirty'),true);assert.equal(f.run('history.length'),1);
 assert.equal(await f.run("resetProject('clear','临时编辑')"),true);assert.equal(f.run('S.people.length'),0);assert.equal(f.run('history.length'),3);
 // User can leave a still pending load; late successful reads cannot replace the new work.
 f=fixture();pending=f.run('boot()');const old=f.request;f.run('startTemporaryProject()');f.run("S.name='新工作'");old.result=f.connection;old.onsuccess();await pending;
 assert.equal(f.run('S.name'),'新工作');assert.equal(f.closed,1);
 // Invalid current data shows a recovery screen and retains stored records.
 f=fixture();f.snapshot.state={version:999};pending=f.run('boot()');f.request.result=f.connection;f.request.onsuccess();await pending;
 assert.equal(f.run('startupStatus'),'error');assert.equal(f.run('busy'),false);assert.equal(f.snapshot.state.version,999);
 // A hung write aborts, never reports success, and releases reset/save callers.
 f=fixture();f.ctx.tx={abort(){this.aborted=true;this.onabort()}};
 pending=f.run('storageTransaction(tx)').then(()=>false,()=>true);f.timeout();assert.equal(await pending,true);assert.equal(f.ctx.tx.aborted,true);
 // Built page starts once, after all modules, before its large PDF font payload.
 const html=fs.readFileSync('dist/志愿者分组-完整测试版.html','utf8');
 assert.equal((html.match(/<script>boot\(\);<\/script>/g)||[]).length,1);
 assert(html.indexOf('<script>boot();</script>')<html.indexOf('<script id="rollCallFont"'));
 assert(html.indexOf('let verificationSuggestionToken=0')<html.indexOf('<script>boot();</script>'));
 console.log('通过：按需恢复当前快照、存储超时、清空恢复入口、临时保存、迟到响应隔离、损坏项目恢复、写入超时中断、字体不阻塞启动。');
})().catch(e=>{console.error(e);process.exitCode=1});
