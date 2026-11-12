const assert=require('assert'),{V}=require('../src/core.js'),{Verification:A}=require('../src/verification.js'),{VerificationSuggestions:G}=require('../src/verification-suggestions.js');
function fixture(){const s=V.blank();s.confirmed.dedup=true;s.groups=[{id:'g1',no:'1',name:'签到',cap:3,leader:'a'},{id:'g2',no:'2',name:'补给',cap:3,leader:'d'}];s.people=['a','b','c','d','e','f'].map((id,i)=>V.person({id,name:id,student:'00'+i,cat:['a','d'].includes(id)?'internal':'normal',photo:['b','c'].includes(id)}));const rows=s.people.map((p,i)=>({name:p.name,student:p.student,target:i<3?'g1':'g2',source:'第'+(i+2)+'行'}));return {s,rows}}
function apply(rows,s,plan){return rows.map(r=>{const p=s.people.find(p=>p.student===r.student),e=plan.edits.find(e=>e.id===p.id);return e?{...r,target:e.target,group:''}:{...r}})}
(async()=>{
 let {s,rows}=fixture(),original=JSON.stringify({s,rows}),base=A.audit(s,rows,'all',V),result=await G.suggest(s,rows,'all',V,A);
 assert(result.plans.length);assert.equal(JSON.stringify({s,rows}),original);assert(result.plans[0].gain>0);assert.equal(result.plans[0].edits.length,2);
 for(const plan of result.plans){const after=A.audit(s,apply(rows,s,plan),'all',V);assert.equal(after.score,plan.after);assert.equal(after.score-base.score,plan.gain);assert.equal(after.errors,0);assert(plan.edits.every(e=>!['a','d'].includes(e.id)))}
 // Split couple: recommend reunion, moving the bound unit together; spare room makes a single move possible.
 ({s,rows}=fixture());s.people[1].pairs=['p'];s.people[2].pairs=['p'];s.people[1].cat=s.people[2].cat='couple';rows[2].target='g2';result=await G.suggest(s,rows,'all',V,A);assert(result.plans.length);assert(result.plans.some(p=>p.edits.some(e=>e.id==='c'&&e.target==='g1')));assert.equal(result.plans[0].errorsAfter,0);assert(result.plans.every(p=>A.audit(s,apply(rows,s,p),'all',V).errors<=A.audit(s,rows,'all',V).errors));
 // A correctly bound pair must move atomically, never one person to manufacture balance.
 rows[2].target='g1';result=await G.suggest(s,rows,'all',V,A);for(const p of result.plans){const edited=p.edits.filter(e=>['b','c'].includes(e.id));assert(edited.length===0||edited.length===2)}
 // Identity uncertainty / partial uploads: do not guess or move unseen people.
 ({s,rows}=fixture());assert.equal((await G.suggest(s,[...rows,rows[0]],'all',V,A)).plans.length,0);assert.equal((await G.suggest(s,rows,'partial',V,A)).plans.length,0);assert.equal((await G.suggest(s,rows.slice(1),'all',V,A)).plans.length,0);
 result=await G.suggest(s,rows,'all',V,A,{budget:1});assert(result.limited);assert(result.tested<=1);
 await assert.rejects(()=>G.suggest(s,rows,'all',V,A,{cancelled:()=>true}),/取消/);
 // A full, balanced allocation remains unchanged with an honest no-plan explanation.
 s.people[2].photo=false;s.people[4].photo=true;result=await G.suggest(s,rows,'all',V,A);assert.equal(result.plans.length,0);assert(/不代表全局最优/.test(result.message));
 console.log('通过：具体调组及满组交换、预计分数逐项复算、绑定整体移动、组长保护、不改原名单、歧义拦截、搜索上限与取消。');
})().catch(e=>{console.error(e);process.exitCode=1});
