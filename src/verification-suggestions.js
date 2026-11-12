/* Read-only candidate search. Every displayed plan is audited using the existing score. */
(function(root){
'use strict';
async function suggest(reference,rows,scope,V,A,options={}){
 const base=A.audit(reference,rows,scope,V),result={plans:[],tested:0,limited:false,baseScore:base.score};
 if(base.score===null)return {...result,message:'请先完成基础数据核对。'};
 if(scope!=='all')return {...result,message:'具体调组建议需要全量核对（包含储备），避免把未上传岗位当作空位。'};
 if(base.score===100&&!base.errors)return {...result,message:'当前可检查项已达满分，无需为提分调整；不代表全局最优。'};
 const blockers=new Set(['人员匹配','姓名学号冲突','小组匹配','重复安排','遗漏人员','原始关联待处理','独立区长']);
 if(base.issues.some(i=>i.severity==='error'&&blockers.has(i.kind)))return {...result,message:'请先处理人员匹配、重复、遗漏或原始关联问题，再生成可靠的调组建议。'};
 const s=V.copy(reference);V.resolveFamily(s);
 const norm=x=>String(x??'').trim().replace(/\s+/g,''),byId=new Map(),positions=new Map();
 rows.forEach((r,index)=>{const p=s.people.find(p=>r.student?norm(p.student)===norm(r.student):norm(p.name)===norm(r.name));if(!p)return;byId.set(p.id,index);positions.set(p.id,r.target||A.groupMatches(r.group,s.groups)[0])});
 const units=V.units(s).filter(u=>u.every(p=>byId.has(p.id)&&!p.independent));
 const counts=new Map(s.groups.map(g=>[g.id,0]));positions.forEach(t=>{if(counts.has(t))counts.set(t,counts.get(t)+1)});
 const targetName=id=>s.groups.find(g=>g.id===id)?s.groups.find(g=>g.id===id).no+'组 · '+s.groups.find(g=>g.id===id).name:id==='reserve'?'储备':'独立区长';
 const budget=options.budget??1200,limit=options.limit??3,seen=new Set();let scans=0;
 const canGo=(u,target)=>{
  if(target==='reserve')return u.every(p=>p.cat==='normal'||p.cat==='family')&&!u.some(p=>s.groups.some(g=>g.leader===p.id));
  const g=s.groups.find(g=>g.id===target);return !!g&&u.every(p=>s.groups.filter(x=>x.leader===p.id).every(role=>norm(role.no)===norm(g.no)));
 };
 async function consider(changes){
  if(options.cancelled?.())throw Error('建议分析已取消');
  if(++scans%12===0)await new Promise(resolve=>setTimeout(resolve,0));
  const edits=changes.flatMap(([u,target])=>u.filter(p=>positions.get(p.id)!==target).map(p=>({id:p.id,target})));if(!edits.length)return;
  const key=edits.map(e=>e.id+'>'+e.target).sort().join('|');if(seen.has(key))return;seen.add(key);
  const nextCounts=new Map(counts);for(const e of edits){const old=positions.get(e.id);if(nextCounts.has(old))nextCounts.set(old,nextCounts.get(old)-1);if(nextCounts.has(e.target))nextCounts.set(e.target,nextCounts.get(e.target)+1)}
  // Never introduce or worsen over-capacity in any destination; existing unrelated errors may remain.
  if(s.groups.some(g=>nextCounts.get(g.id)>Math.max(g.cap,counts.get(g.id))))return;
  if(result.tested>=budget){result.limited=true;return}
  const next=rows.map(r=>({...r}));edits.forEach(e=>{next[byId.get(e.id)]={...next[byId.get(e.id)],target:e.target,group:''}});
  const after=A.audit(s,next,scope,V);result.tested++;
  if(base.components.some(c=>!after.components.some(x=>x.name===c.name)))return;
  if(after.errors>base.errors||after.score<base.score||after.rawScore<base.rawScore)return;
  if(after.score===base.score&&after.rawScore===base.rawScore&&after.errors===base.errors)return;
  const improved=after.components.flatMap(c=>{const old=base.components.find(x=>x.name===c.name);return old&&c.score>old.score?[c.name+' '+old.score+' → '+c.score]:[]});
  const plan={edits:edits.map(e=>{const p=s.people.find(p=>p.id===e.id);return {...e,name:p.name,student:p.student,from:targetName(positions.get(p.id)),to:targetName(e.target),source:rows[byId.get(e.id)].source}}),before:base.score,after:after.score,gain:after.score-base.score,rawGain:after.rawScore-base.rawScore,errorsBefore:base.errors,errorsAfter:after.errors,reasons:improved,remainingErrors:after.errors};
  if(after.errors<base.errors)plan.reasons.unshift('必须修正的问题 '+base.errors+' → '+after.errors+' 项');
  result.plans.push(plan);result.plans.sort((a,b)=>a.errorsAfter-b.errorsAfter||b.gain-a.gain||b.rawGain-a.rawGain||a.edits.length-b.edits.length);result.plans=result.plans.slice(0,limit);
 }
 // First consider whole-unit moves, including repairing an already split unit.
 for(const unit of units){for(const target of [...s.groups.map(g=>g.id),'reserve']){if(target==='reserve'&&!unit.some(p=>counts.has(positions.get(p.id))&&counts.get(positions.get(p.id))>s.groups.find(g=>g.id===positions.get(p.id)).cap))continue;if(canGo(unit,target))await consider([[unit,target]]);if(result.limited)break}if(result.limited)break}
 // Swaps allow improvement even when all positions are full. Bound people move as a unit.
 if(!result.limited)for(let i=0;i<units.length;i++){if(i%10===0){await new Promise(resolve=>setTimeout(resolve,0));if(options.cancelled?.())throw Error('建议分析已取消')}const a=units[i],pa=new Set(a.map(p=>positions.get(p.id)));if(pa.size!==1)continue;
  for(let j=i+1;j<units.length;j++){const b=units[j],pb=new Set(b.map(p=>positions.get(p.id)));if(pb.size!==1)continue;const fromA=[...pa][0],fromB=[...pb][0];if(fromA===fromB||!canGo(a,fromB)||!canGo(b,fromA))continue;
   await consider([[a,fromB],[b,fromA]]);if(result.limited)break;
  }if(result.limited)break;
 }
 result.message=result.plans.length?'各方案独立对比原上传名单；交换须整套执行，提分不能相加。':result.limited?'本次搜索范围内未找到提分方案，可先处理报告问题后重新验证。':'未在单次调组或两组交换范围内找到更优方案；不代表全局最优。';
 return result;
}
root.VerificationSuggestions={suggest};
})(typeof module==='object'?module.exports:globalThis);
