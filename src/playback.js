(function(root){
'use strict';
// Build an animation timeline from actual allocation snapshots; never invent assignments.
function timeline(initial,states,final,V){
 let previous=initial;const steps=[];
 const position=p=>p.independent?'independent':p.group||(p.reserve?'reserve':'pending');
 for(const step of states){
  const old=new Map(previous.people.map(p=>[p.id,p])),changed=new Set(step.state.people.filter(p=>position(p)!==position(old.get(p.id))).map(p=>p.id));
  const units=V.units(step.state),byUnit=new Map();units.forEach(unit=>unit.forEach(p=>byUnit.set(p.id,unit)));
  const seen=new Set(),moves=[];
  for(const p of step.state.people){
   if(!changed.has(p.id)||seen.has(p.id))continue;
   const ids=byUnit.get(p.id).filter(x=>changed.has(x.id)).map(x=>x.id);ids.forEach(id=>seen.add(id));
   const targets=new Set(ids.map(id=>position(step.state.people.find(x=>x.id===id))));
   if(targets.size!==1)throw Error('绑定成员目标不一致，请检查关联');
   moves.push({ids,target:[...targets][0]});
  }
  const reserves=moves.filter(move=>move.target==='reserve');
  if(reserves.length){
   const intermediate=V.copy(step.state),reserved=new Set(reserves.flatMap(move=>move.ids));
   intermediate.people.forEach(p=>{if(reserved.has(p.id))Object.assign(p,V.copy(old.get(p.id)))});delete intermediate.confirmed.normal;
   steps.push({...step,state:intermediate,moves:moves.filter(move=>move.target!=='reserve')});
   steps.push({label:'储备',saveLabel:'全自动 · 储备',state:V.copy(step.state),moves:reserves});
  }else steps.push({...step,moves});
  previous=step.state;
 }
 return {initial:V.copy(initial),steps,final:V.copy(final),total:steps.flatMap(step=>step.moves).reduce((n,move)=>n+move.ids.length,0)};
}
function remaining(state,V){
 const fixed=V.copy(state);
 // "Remaining" preserves occupied positions even when an earlier stage was reopened.
 fixed.people.forEach(p=>{if(p.group||p.reserve||p.independent)p.locked=true});
 const plan=V.remainingPlan(fixed);
 const states=plan.steps.filter(step=>step.state.stage!=='overview').map(step=>({...step,saveLabel:step.label,label:step.label.replace('全自动 · ','')}));
 return {...timeline(state,states,plan.state,V),pending:plan.pending,notes:plan.notes};
}
root.AllocationPlayback={timeline,remaining};
})(typeof module==='object'?module.exports:globalThis);
