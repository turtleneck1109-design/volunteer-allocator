const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {V}=require('../src/core.js'),{AllocationPlayback}=require('../src/playback.js');
function fixture(){
 const s=V.blank();s.name='动画分配测试';s.confirmed={import:true,dedup:true,roles:true};s.stage='internal';
 s.groups=[{id:'g1',no:'1',name:'签到',cap:7,leader:'l1'},{id:'g2',no:'2',name:'补给',cap:7,leader:'l2'}];
 s.people=[...['l1','l2','i1','i2'].map(id=>V.person({id,name:id,cat:'internal'})),...['t1','t2'].map(id=>V.person({id,name:id,cat:'team',teams:['团体A']})),...['c1','c2'].map(id=>V.person({id,name:id,cat:'couple',pairs:['pair']})),...Array.from({length:12},(_,i)=>V.person({id:'n'+i,name:'普通'+i}))];
 V.placeLeaders(s);s.people.find(p=>p.id==='n0').group='g2';return s;
}
const s=fixture(),before=JSON.stringify(s),plan=AllocationPlayback.remaining(s,V);
assert.equal(JSON.stringify(s),before);assert.equal(plan.total,17);
assert.deepEqual(plan.steps.map(s=>s.label),['内部','团体A','情侣','普通','储备']);
assert.deepEqual(V.validate(plan.final,true),[]);
assert(plan.final.people.filter(p=>['l1','l2','n0'].includes(p.id)).every(p=>p.group===s.people.find(x=>x.id===p.id).group));
assert(plan.steps.every(step=>step.moves.every(move=>!move.ids.includes('n0'))));
assert.deepEqual(plan.steps.find(s=>s.label==='团体A').moves.map(m=>m.ids),[['t1','t2']]);
assert.deepEqual(plan.steps.find(s=>s.label==='情侣').moves.map(m=>m.ids),[['c1','c2']]);
assert.deepEqual(plan.steps.filter(s=>['普通','储备'].includes(s.label)).flatMap(s=>s.moves.flatMap(m=>m.ids)),Array.from({length:11},(_,i)=>'n'+(i+1)));
assert.equal(AllocationPlayback.remaining(plan.final,V).total,0);
const huge=fixture();huge.people.push(...Array.from({length:15},(_,i)=>V.person({id:'big'+i,name:'大团体'+i,cat:'team',teams:['大团体']})));
const partial=AllocationPlayback.remaining(huge,V);assert.equal(partial.pending,15);assert(partial.final.people.filter(p=>p.id.startsWith('big')).every(p=>!p.group&&!p.reserve));
// Actual app orchestration and IndexedDB transaction completion/failure, without animation delays.
const nodes=new Map(),app={inert:false},storage=new Map();let writes=0,failAt=0;
const node=()=>({innerHTML:'',textContent:'',focus(){},setAttribute(){},remove(){},classList:{add(){},remove(){}}});
const database={transaction(){const number=++writes;const tx={objectStore(){return {add(value){tx.snapshot=V.copy(value)},put(value){tx.current=value}}}};setTimeout(()=>{if(number===failAt){tx.error=Error('disk full');tx.onerror()}else{storage.set(tx.snapshot.id,tx.snapshot);storage.set('current',tx.current);tx.oncomplete()}},1);return tx}};
const ctx={V,AllocationPlayback,console,Date,setTimeout,clearTimeout,database,fixture,document:{addEventListener(){},createElement:node,body:{appendChild(el){nodes.set(el.id,el)}},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelector(){return app},querySelectorAll(){return []}},window:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
const run=code=>vm.runInContext(code,ctx),json=code=>JSON.parse(run(`JSON.stringify(${code})`)),persisted=()=>storage.get(storage.get('current')).state;
function reset(){run(`S=fixture();pendingImports=[];history=[];db=database;demoSession=null;demoPlayback=null;busy=false;page='internal';globalThis.errors=[];globalThis.flights=[];render=()=>{};renderDemoPlaybackBoard=()=>{};updateDemoPlaybackControls=()=>{};toast=()=>{};errorBox=e=>errors.push(e.message);waitDemoPlayback=async run=>{if(run.cancelled)throw DEMO_PLAYBACK_CANCELLED};flyDemoUnit=async(run,ids)=>{flights.push(ids)};`);failAt=0}
(async()=>{
 reset();await run('autoRemaining()');assert.deepEqual(json('V.validate(S,true)'),[]);assert.deepEqual(json('S'),persisted());assert.equal(json('history.length'),7);assert.equal(json('flights.flat().length'),17);assert.equal(run('busy'),false);assert.equal(app.inert,false);
 // Stop during team flight: keep the successfully persisted internal stage, discard current team.
 reset();run(`flyDemoUnit=async(run,ids)=>{if(run.label==='团体A')run.cancelled=true}`);assert.equal(await run('autoRemaining()'),false);
 assert.equal(run('S.confirmed.internal'),true);assert.equal(json('S.people.filter(p=>p.teams.length&&p.group).length'),0);assert.deepEqual(json('S'),persisted());assert.equal(json('history.length'),2);const checkpoint=json('S');
 run('flyDemoUnit=async(run,ids)=>flights.push(ids)');await run('autoRemaining()');assert.deepEqual(json('V.validate(S,true)'),[]);assert(!json('flights.flat()').some(id=>['l1','l2','i1','i2','n0'].includes(id)));assert.equal(app.inert,false);
 // Save failure after internal completes restores only the last durable stage.
 reset();failAt=writes+3;assert.equal(await run('autoRemaining()'),false);assert.equal(run('S.confirmed.internal'),true);assert.equal(json('S.people.filter(p=>p.teams.length&&p.group).length'),0);assert.deepEqual(json('S'),persisted());assert.equal(json('errors.length'),1);assert.equal(app.inert,false);
 // Failed initial backup cannot move anyone or mount a running controller.
 reset();const original=json('S');failAt=writes+1;assert.equal(await run('autoRemaining()'),false);assert.deepEqual(json('S'),original);assert.equal(run('demoPlayback'),null);assert.equal(app.inert,false);
 // Instant finish unpauses, ends the current animation and saves all subsequent stages.
 reset();run(`globalThis.finishedAnimation=false;demoPlayback={kind:'remaining',paused:true,cancelled:false,animations:new Set([{finish(){finishedAnimation=true}}])};finishAllocationPlayback()`);assert.equal(run('demoPlayback.paused'),false);assert.equal(run('demoPlayback.skip'),true);assert.equal(run('finishedAnimation'),true);
 reset();run(`mountAllocationPlayer=run=>{run.skip=true};flyDemoUnit=async()=>{throw Error('should not animate')}`);await run('autoRemaining()');assert.deepEqual(json('V.validate(S,true)'),[]);assert.deepEqual(json('S'),persisted());assert.equal(json('errors.length'),0);
 console.log('通过：剩余分配动画计划、原有位置保留、绑定同移、源顺序、阶段保存、停止与继续、保存失败还原及立即完成。');
})().catch(e=>{console.error(e);process.exitCode=1});
