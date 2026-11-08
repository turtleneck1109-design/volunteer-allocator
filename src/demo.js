(function(root){
'use strict';
// All names and identifiers below are fictional. Email uses the reserved .test domain.
function sheets(){
 const headers=['学号','姓名','邮箱','摄影标志','小闪电标志','学院'];
 const row=(id,name,photo=false,run=false)=>['DEMO'+String(id).padStart(3,'0'),name,'demo'+id+'@example.test',photo?'是':'否',run?'是':'否','示例学院'+(id%3+1)];
 const internal=Array.from({length:12},(_,i)=>row(i+1,'示例内部'+String(i+1).padStart(2,'0'),i===5||i===9,i===7||i===10));
 const team=Array.from({length:8},(_,i)=>[...row(i+13,'示例团体'+String(i+1).padStart(2,'0'),i===1||i===5,i===2||i===6),i<4?'星火学生会':'青禾志愿队']);
 const couple=[[...row(21,'示例情侣一',true),'示例搭档一'],[...row(22,'示例情侣二',false,true),'示例搭档二']];
 const family=[[...row(23,'示例家属一'),'示例内部02'],[...row(24,'示例家属二'),'示例内部06']];
 const normal=Array.from({length:24},(_,i)=>row(i+25,i===0?'示例搭档一':i===1?'示例搭档二':'示例志愿者'+String(i+1).padStart(2,'0'),i%7===0,i%6===0));
 // Deliberate cross-form duplicates for the import/dedup tutorial.
 normal.push([...internal[0]],[...team[0].slice(0,6)],[...couple[0].slice(0,6)]);
 return [
  {type:'groups',name:'小组信息',rows:[['组号','小组名称','总名额','所属区域'],['1','起点咨询',8,'起点'],['1','起点检录',6,'起点'],['2','赛道补给',10,'赛道'],['3','终点引导',8,'终点'],['4','机动服务',10,'全场']]},
  {type:'internal',name:'内部人员',rows:[headers,...internal]},
  {type:'team',name:'团体人员',rows:[[...headers,'团体名称'],...team]},
  {type:'couple',name:'情侣人员',rows:[[...headers,'情侣姓名'],...couple]},
  {type:'family',name:'家属人员',rows:[[...headers,'关联志愿者姓名'],...family]},
  {type:'normal',name:'普通人员',rows:[headers,...normal]}
 ];
}
function playbackPlan(appointed,V){
 const initial=V.copy(appointed);initial.people.forEach(p=>Object.assign(p,{group:null,reserve:false,locked:false,independent:false}));
 initial.confirmed={import:true,dedup:true};initial.teamDone=[];initial.stage='internal';
 const plan=V.remainingPlan(appointed);if(plan.pending)throw Error('演示名单有未完成分配');
 const states=[{label:'组长与家属',state:V.copy(appointed)},...plan.steps.filter(step=>step.state.stage!=='overview').map(step=>({...step,label:step.label.replace('全自动 · ','')}))];
 let previous=initial;const steps=[];
 const position=p=>p.group||(p.reserve?'reserve':'pending');
 for(const step of states){
  const old=new Map(previous.people.map(p=>[p.id,p])),changed=new Set(step.state.people.filter(p=>position(p)!==position(old.get(p.id))).map(p=>p.id));
  const units=V.units(step.state),seen=new Set(),moves=[];
  for(const p of step.state.people){if(!changed.has(p.id)||seen.has(p.id))continue;const unit=units.find(u=>u.some(x=>x.id===p.id));const ids=unit.filter(x=>changed.has(x.id)).map(x=>x.id);ids.forEach(id=>seen.add(id));const targets=new Set(ids.map(id=>position(step.state.people.find(x=>x.id===id))));if(targets.size!==1)throw Error('演示绑定成员目标不一致');moves.push({ids,target:[...targets][0]})}
  const reserves=moves.filter(move=>move.target==='reserve');
  if(reserves.length){const intermediate=V.copy(step.state),reserved=new Set(reserves.flatMap(move=>move.ids));intermediate.people.forEach(p=>{if(reserved.has(p.id))Object.assign(p,V.copy(old.get(p.id)))});delete intermediate.confirmed.normal;steps.push({label:step.label,state:intermediate,moves:moves.filter(move=>move.target!=='reserve')});steps.push({label:'储备',state:V.copy(step.state),moves:reserves})}
  else steps.push({...step,moves});
  previous=step.state;
 }
 return {initial,steps,final:plan.state,total:steps.flatMap(step=>step.moves).reduce((n,move)=>n+move.ids.length,0)};
}
root.Demo={sheets,playbackPlan};
})(typeof module==='object'?module.exports:globalThis);
