const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {V}=require('../src/core.js'),{Demo}=require('../src/demo.js');
const nodes=new Map(),app={inert:false};
const node=()=>({innerHTML:'',textContent:'',scrollTop:0,value:0,max:0,focus(){},setAttribute(){},remove(){},classList:{add(){},remove(){}}});
const ctx={V,Demo,console,Date,setTimeout,clearTimeout,document:{addEventListener(){},createElement:node,body:{appendChild(el){nodes.set(el.id,el)}},getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelector(){return app},querySelectorAll(){return []}},window:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
const run=code=>vm.runInContext(code,ctx),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
(async()=>{
 run(`globalThis.scene=buildDemoScene('allocate');globalThis.plan=Demo.playbackPlan(scene.state,V)`);
 assert.equal(json('plan.total'),48);assert.equal(json('plan.initial.people.filter(p=>p.group||p.reserve).length'),0);
 assert.deepEqual(json('plan.steps.map(s=>s.label)'),['组长与家属','内部','星火学生会','青禾志愿队','情侣','普通','储备']);
 assert.equal(new Set(json('plan.steps.flatMap(s=>s.moves.flatMap(m=>m.ids))')).size,48);
 run(`S=V.copy(plan.initial);globalThis.applied=[];for(const step of plan.steps){for(const move of step.moves){applyDemoMove(move,step.state);applied.push(...move.ids);if(S.groups.some(g=>S.people.filter(p=>p.group===g.id).length>g.cap))throw Error('超出容量')}S=V.copy(step.state);if(V.validate(S).length)throw Error(V.validate(S).join(';'))}`);
 assert.equal(json('S.people.filter(p=>p.group).length'),42);assert.equal(json('S.people.filter(p=>p.reserve).length'),6);
 assert.deepEqual(json('V.validate(plan.final,true)'),[]);
 // Immediate pause/play controls reach every in-flight browser animation.
 run(`globalThis.calls=[];demoPlayback={paused:false,cancelled:false,speed:'slow',done:0,total:48,animations:new Set([{pause(){calls.push('pause')},play(){calls.push('play')},updatePlaybackRate(rate){calls.push(rate)}}])};pauseDemoPlayback();setDemoPlaybackSpeed('slower');`);
 assert.deepEqual(json('calls'),['pause',.65]);assert.equal(run('demoPlayback.paused'),true);run('pauseDemoPlayback()');assert.deepEqual(json('calls'),['pause',.65,'play']);
 // A pause blocks progress even at a step boundary, and cancelling releases the wait.
 run(`demoPlayback.paused=true;globalThis.finished=false;globalThis.waiter=waitDemoPlayback(demoPlayback,0).then(()=>{finished=true},e=>{if(e!==DEMO_PLAYBACK_CANCELLED)throw e})`);
 await new Promise(resolve=>setTimeout(resolve,70));assert.equal(run('finished'),false);run('demoPlayback.cancelled=true');await run('waiter');assert.equal(run('finished'),false);
 // Run the actual timeline without wall-clock animation; simulate cancellation during a flight.
 run(`demoPlayback=null;render=()=>{};renderDemoPlaybackBoard=()=>{};updateDemoPlaybackControls=()=>{};closeModal=()=>{};toast=()=>{};errorBox=e=>{throw e};waitDemoPlayback=async(run)=>{if(run.cancelled)throw DEMO_PLAYBACK_CANCELLED};flyDemoUnit=async()=>{};demoSession={original:{},mode:'result'};db=null;`);
 await run('startDemoPlayback()');assert.equal(run('busy'),false);assert.equal(app.inert,false);assert.equal(run('demoPlayback'),null);assert.deepEqual(json('V.validate(S,true)'),[]);assert.equal(json('S.people.filter(p=>p.group).length'),42);assert.equal(json('history.filter(h=>h.label.startsWith("演示播放")).length'),8);
 run(`flyDemoUnit=async(run)=>{run.cancelled=true}`);await run('startDemoPlayback()');assert.equal(run('busy'),false);assert.equal(app.inert,false);assert.equal(json('S.people.filter(p=>p.group).length'),5);assert.equal(json('history.length'),1);
 console.log('通过：自动演示七阶段、48人逐批移动、绑定与容量、即时暂停/继续、暂停等待、取消还原与演示历史隔离。');
})().catch(e=>{console.error(e);process.exitCode=1});
