const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{V}=require('../src/core.js');
function fixture(){const s=V.blank();s.overviewEditing=true;s.confirmed={roles:true,overview:true};s.groups=[{id:'g1',no:'1',name:'岗位一',cap:2},{id:'g2',no:'2',name:'岗位二',cap:2},{id:'g3',no:'3',name:'岗位三',cap:2}];s.people=['a','b','c','d','e'].map((id,i)=>V.person({id,name:id,student:String(i+1),group:i<2?'g1':i<4?'g2':'g3'}));return s}
const group=(s,id)=>s.people.find(p=>p.id===id).group;
let s=fixture();V.swap(s,['a','c']);assert.equal(group(s,'a'),'g2');assert.equal(group(s,'c'),'g1');assert.equal(group(s,'b'),'g1');assert.deepEqual(s.people.filter(p=>p.group==='g1').map(p=>p.id),['b','c']);assert(!s.people.some(p=>p.locked));assert(s.confirmed.roles&&!s.confirmed.overview);
s=fixture();V.swap(s,['d','a','c','b']);assert.equal(group(s,'a'),'g2');assert.equal(group(s,'b'),'g2');assert.equal(group(s,'c'),'g1');assert.equal(group(s,'d'),'g1');
s=fixture();s.people[0].pairs=['pair'];s.people[1].pairs=['pair'];s.people[2].teams=['team'];s.people[3].teams=['team'];V.swap(s,['a','c']);assert.equal(group(s,'b'),'g2');assert.equal(group(s,'d'),'g1');
function rejects(edit,ids,pattern){const state=fixture();edit(state);const before=JSON.stringify(state);assert.throws(()=>V.swap(state,ids),pattern);assert.equal(JSON.stringify(state),before)}
rejects(()=>{},[],/选择/);rejects(()=>{},['a','b'],/另一个/);rejects(()=>{},['a','c','e'],/两个/);
rejects(()=>{},['a','b','c'],/超出/);rejects(s=>s.people[0].locked=true,['a','c'],/锁定/);
rejects(s=>s.groups[0].leader='a',['a','c'],/组长/);rejects(s=>s.people[0].deferred=true,['a','c'],/待处理/);
rejects(s=>{s.people[0].pairs=['p'];s.people[2].pairs=['p']},['a','c'],/绑定成员分散/);
rejects(s=>{s.people[0].cat='family';s.people[2].group=null;s.people[2].reserve=true},['a','c'],/家属/);
s=fixture();s.groups[1].cap=3;V.swap(s,['a','b','c']);assert.equal(s.people.filter(p=>p.group==='g2').length,3);
s=fixture();s.overviewEditing=false;V.swap(s,['a','c']);assert(s.people.filter(p=>['a','c'].includes(p.id)).every(p=>p.locked));
// UI swaps the two selections without opening a target dialog, and records one undo checkpoint.
const ctx={V,fixture,console,document:{addEventListener(){}},window:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);const run=c=>vm.runInContext(c,ctx);
run(`render=()=>{};changed=()=>{};toast=()=>{};globalThis.lastError='';errorBox=e=>lastError=e.message;modal=()=>{throw Error('不应弹出目标选择')};S=fixture();selected=new Set(['a','c']);swapSelected()`);
assert.equal(run(`S.people.find(p=>p.id==='a').group`),'g2');assert.equal(run('selected.size'),0);assert.equal(run('undoStack.length'),1);assert.equal(run(`undoStack[0].state.people.find(p=>p.id==='a').group`),'g1');
run(`S=fixture();selected=new Set(['a','b','c']);globalThis.before=JSON.stringify(S);swapSelected()`);assert(run('lastError.includes("超出")'));assert(run('JSON.stringify(S)===before'));assert.equal(run('selected.size'),3);assert.equal(run('undoStack.length'),1);
console.log('通过：选中双方直接交换、批量及绑定交换、满组同时校验、失败原子性、任职锁定保护、顺序与撤销。');
