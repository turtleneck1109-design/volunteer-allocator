const assert=require('assert'),{V}=require('../src/core.js'),{Verification:A}=require('../src/verification.js'),{VerificationSuggestions:G}=require('../src/verification-suggestions.js');
const s=V.blank();s.confirmed.dedup=true;s.groups=[{id:'g1',no:'1',name:'签到',cap:3,leader:'a'},{id:'g2',no:'2',name:'补给',cap:3,leader:'d'}];s.people=['a','b','c','d','e','f'].map((id,i)=>V.person({id,name:id,student:'00'+i,cat:i%3===0?'internal':'normal',photo:['b','c'].includes(id)}));const rows=s.people.map((p,i)=>({name:p.name,student:p.student,target:i<3?'g1':'g2',source:'第'+(i+2)+'行'}));
(async()=>{
 assert.equal(A.audit(s,rows,'all',V).score,96);
 const original=JSON.stringify(s),defaults=A.defaultWeights();assert.equal(Object.values(defaults).reduce((a,b)=>a+b),100);
 const custom={...defaults,photo:50};let r=A.audit(s,rows,'all',V,custom);assert.equal(r.weightTotal,115);assert.equal(r.score,78);assert.equal(JSON.stringify(s),original);
 s.verificationWeights=custom;const plans=await G.suggest(s,rows,'all',V,A);assert(plans.plans.length);assert.equal(plans.baseScore,78);assert.equal(plans.plans[0].after,100);assert.equal(plans.plans[0].gain,22);
 for(const plan of plans.plans){const revised=rows.map(row=>{const p=s.people.find(p=>p.student===row.student),e=plan.edits.find(e=>e.id===p.id);return e?{...row,target:e.target}:row});assert.equal(A.audit(s,revised,'all',V).score,plan.after)}
 s.verificationWeights={...custom,photo:0};assert.equal(A.audit(s,rows,'all',V).score,100);assert.equal((await G.suggest(s,rows,'all',V,A)).plans.length,0);
 // Zero weight never hides identity errors or disables the hard-error score cap.
 s.verificationWeights={...defaults,identity:0,capacity:0};r=A.audit(s,[...rows,rows[0]],'all',V);assert(r.issues.some(i=>i.kind==='重复安排'));assert(r.score<=59);
 const zero=Object.fromEntries(Object.keys(defaults).map(k=>[k,0]));assert.throws(()=>A.validateWeights(zero),/至少/);for(const n of [-1,101,NaN,1.5,Infinity,'5'])assert.throws(()=>A.validateWeights({...defaults,photo:n}),/整数/);
 // A positive but inapplicable weight cannot produce NaN or a misleading score.
 s.verificationWeights={...zero,binding:50};r=A.audit(s,rows,'all',V);assert.equal(r.score,null);assert.equal(r.weightTotal,0);assert.equal((await G.suggest(s,rows,'all',V,A)).plans.length,0);
 assert.deepEqual(A.weights({photo:-4}),defaults);assert.deepEqual(A.weights(),defaults);
 console.log('通过：自定义权重折算、零权重、未适用项、错误上限、输入校验及建议提分使用同一权重。');
})().catch(e=>{console.error(e);process.exitCode=1});
