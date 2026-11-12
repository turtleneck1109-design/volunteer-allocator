/* Assignment audit: reads a copy of the reference activity, never applies uploaded positions. */
(function(root){
'use strict';
const text=x=>String(x??'').trim(),norm=x=>text(x).replace(/\s+/g,'');
const criteria=[
 {key:'identity',name:'名单准确完整',weight:30,note:'未知人员、姓名学号冲突、重复安排；全量核对另查遗漏。'},
 {key:'capacity',name:'岗位名额',weight:25,note:'按缺额与超额人数占总名额的比例扣分。'},
 {key:'binding',name:'关联同组',weight:20,note:'按拆分的绑定单元及原始关联问题比例扣分。'},
 {key:'roles',name:'任职位置',weight:10,note:'检查已设置组长和独立区长的位置，同组号可共用组长。'},
 {key:'internal',name:'内部均衡',weight:5,note:'内部人员尽量均分，组长不计入。'},
 {key:'photo',name:'摄影均衡',weight:5,note:'摄影人员按岗位容量限制尽量均分。'},
 {key:'run',name:'小闪电均衡',weight:5,note:'小闪电人员按岗位容量限制尽量均分。'}
];
const defaultWeights=()=>Object.fromEntries(criteria.map(c=>[c.key,c.weight]));
function weights(value){return Object.fromEntries(criteria.map(c=>{const n=value?.[c.key];return [c.key,typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=100?n:c.weight]}))}
function validateWeights(value){if(criteria.some(c=>typeof value?.[c.key]!=='number'||!Number.isInteger(value[c.key])||value[c.key]<0||value[c.key]>100))throw Error('各项权重请填写 0～100 的整数');if(!criteria.some(c=>value[c.key]>0))throw Error('至少一项权重须大于 0');return weights(value)}
function infer(headers){
 const find=names=>headers.findIndex(h=>names.includes(norm(h).replace(/^Q\d+[.、．]?/i,'')));
 return {name:find(['姓名','您的姓名','志愿者姓名']),student:find(['学号','您的学号','学生学号']),group:find(['小组','小组名称','岗位','岗位名称','子岗位','组号'])};
}
function headerIndex(rows){let best=0,score=-1;rows.slice(0,20).forEach((r,i)=>{const m=infer(r),n=(m.name>=0?2:0)+(m.student>=0?2:0)+(m.group>=0?1:0);if(n>score){best=i;score=n}});return best}
function groupMatches(value,groups){
 const v=norm(value);if(!v)return [];
 if(['储备','储备名单'].includes(v))return ['reserve'];if(['独立区长','独立管理'].includes(v))return ['independent'];
 const exact=groups.filter(g=>[g.id,g.name,g.no+'组 · '+g.name,g.no+'组-'+g.name].some(s=>norm(s)===v));
 return (exact.length?exact:groups.filter(g=>[norm(g.no),norm(g.no)+'组'].includes(v))).map(g=>g.id);
}
function records(sheets){return sheets.filter(s=>s.enabled).flatMap(s=>s.rows.slice(s.header+1).flatMap((r,i)=>{
 const get=k=>s.map[k]>=0?text(r[s.map[k]]):'';if(!r.some(x=>text(x)))return [];
 return [{name:get('name'),student:get('student'),group:s.target?'':get('group'),target:s.target||'',source:s.file+' / '+s.name+' 第'+(s.header+i+2)+'行'}];}))}
function audit(reference,rows,scope,V,customWeights=reference.verificationWeights){
 const scoringWeights=weights(customWeights);
 const s=V.copy(reference),issues=[],add=(severity,kind,message,source='')=>issues.push({severity,kind,message,source});
 const ready=s.people.length&&s.groups.length&&s.confirmed.dedup&&!V.duplicateSets(s).length;
 if(!ready)return {score:null,status:'请先导入原始名单、小组名额，并完成查重确认',issues,components:[],groups:[],matched:0,rows:rows.length};
 V.resolveFamily(s);const assignments=new Map(),covered=new Set(),groupRows=new Map(s.groups.map(g=>[g.id,0]));let identityFaults=0;
 rows.forEach(r=>{
  const candidates=r.target?([ ...s.groups.map(g=>g.id),'reserve','independent'].includes(r.target)?[r.target]:[]):groupMatches(r.group,s.groups);
  const target=candidates.length===1?candidates[0]:null;
  if(!target){identityFaults++;add('error','小组匹配',candidates.length?'组号对应多个子岗位，请选择具体岗位':'未识别所属小组，请指定工作表小组或小组列',r.source)}
  if(target&&groupRows.has(target)){covered.add(target);groupRows.set(target,groupRows.get(target)+1)}
  const candidatesP=r.student?s.people.filter(p=>norm(p.student)===norm(r.student)):s.people.filter(p=>norm(p.name)===norm(r.name)&&norm(r.name));
  if(candidatesP.length!==1){identityFaults++;const withdrawn=(s.withdrawn||[]).some(p=>r.student?norm(p.student)===norm(r.student):norm(p.name)===norm(r.name)&&norm(r.name));add('error','人员匹配',withdrawn?'该人员已放弃参加':candidatesP.length?'同名或同学号多人，无法唯一匹配':'原始名单中找不到：'+(r.name||r.student||'姓名、学号均为空'),r.source);return}
  const p=candidatesP[0];if(r.name&&norm(r.name)!==norm(p.name)){identityFaults++;add('error','姓名学号冲突',r.student+' 对应 '+p.name+'，上传姓名为 '+r.name,r.source);return}
  if(!r.student)add('warning','缺少学号',p.name+' 仅按唯一姓名匹配，建议补齐学号',r.source);
  if(assignments.has(p.id)){identityFaults++;add('error','重复安排',p.name+' 重复出现；首次位置：'+assignments.get(p.id).source,r.source);return}
  if(target)assignments.set(p.id,{target,source:r.source});
 });
 const checkedGroups=scope==='all'?s.groups:s.groups.filter(g=>covered.has(g.id));
 const expected=s.people.filter(p=>!p.independent);const missing=scope==='all'?expected.filter(p=>!assignments.has(p.id)):[];
 missing.forEach(p=>add('error','遗漏人员',p.name+'（'+(p.student||'无学号')+'）未在上传名单中；储备人员也应提交'));
 identityFaults+=missing.length;
 const relationProblems=V.relationIssues(s).filter(i=>scope==='all'||i.ids.some(id=>assignments.has(id)));relationProblems.forEach(i=>add('error','原始关联待处理',i.message));
 const units=V.units(s).filter(u=>u.length>1);let broken=0;
 units.forEach(u=>{const places=u.map(p=>assignments.get(p.id)?.target).filter(Boolean);if(!places.length)return;
  if(new Set(places).size>1||(scope==='all'&&places.length!==u.length)){broken++;add('error','绑定拆分',u.map(p=>p.name).join('、')+' 未全部安排在同一岗位')}
  else if(places.length!==u.length)add('warning','绑定待核对',u.map(p=>p.name).join('、')+' 未全部出现在本次局部名单中');
 });
 let capLoss=0;const groupResults=checkedGroups.map(g=>{const count=groupRows.get(g.id),over=Math.max(0,count-g.cap),short=Math.max(0,g.cap-count);capLoss+=over+short;
  if(over)add('error','超出名额',g.no+'组 · '+g.name+' 超出 '+over+' 人');if(short)add('warning','岗位缺员',g.no+'组 · '+g.name+' 尚缺 '+short+' 人');
  return {id:g.id,name:g.no+'组 · '+g.name,count,cap:g.cap,internal:0,photo:0,run:0};});
 const leaders=new Set(s.groups.map(g=>g.leader).filter(Boolean)),roleGroups=new Map();checkedGroups.forEach(g=>{if(g.leader)roleGroups.set(norm(g.no),g)});let roleFaults=0;
 if(scope==='partial')for(const [no,g] of roleGroups){if(!assignments.has(g.leader)&&s.groups.some(other=>norm(other.no)===no&&!covered.has(other.id))){roleGroups.delete(no);add('warning','任职待核对',no+'组仍有子岗位未上传，组长可能在其他子岗位，暂不扣分')}}
 roleGroups.forEach(g=>{const assigned=assignments.get(g.leader),target=s.groups.find(x=>x.id===assigned?.target);if(!target||norm(target.no)!==norm(g.no)){roleFaults++;add('error','组长位置',g.no+'组的组长 '+(s.people.find(p=>p.id===g.leader)?.name||'未匹配')+' 未安排在本组')}});
 if(checkedGroups.some(g=>!g.leader))add('warning','任职未设置','部分岗位尚未设置组长，这些岗位的组长检查未计分');
 s.people.forEach(p=>{const a=assignments.get(p.id);if(a?.target==='independent'&&!p.independent){roleFaults++;add('error','独立区长',p.name+' 尚未设置为独立管理区长')}if(p.independent&&a&&a.target!=='independent'){roleFaults++;add('error','独立区长',p.name+' 已设为独立区长，不应再占组内或储备名额')}
  const g=groupResults.find(g=>g.id===a?.target);if(g){g.internal+=Number(p.cat==='internal'&&!leaders.has(p.id));g.photo+=Number(p.photo);g.run+=Number(p.run)}});
 const components=[],part=(key,loss,denominator,note)=>{const max=scoringWeights[key],name=criteria.find(c=>c.key===key).name;components.push({key,name,max,score:Math.round(max*(1-Math.min(1,loss/Math.max(1,denominator)))*10)/10,note})};
 part('identity',identityFaults,Math.max(rows.length,scope==='all'?expected.length:0),'未知、冲突、重复记录；全量核对另检查遗漏');
 part('capacity',capLoss,checkedGroups.reduce((n,g)=>n+g.cap,0),'按缺额与超额人数占总名额的比例扣分');
 if(units.length||relationProblems.length)part('binding',broken+relationProblems.length,units.length+relationProblems.length,'已绑定的情侣、家属及团体须同一子岗位');
 if(roleGroups.size||roleFaults)part('roles',roleFaults,roleGroups.size,'同组号子岗位可共用组长，组长只占一次名额');
 for(const [key,label] of [['internal','内部均衡'],['photo','摄影均衡'],['run','小闪电均衡']]){
  const total=groupResults.reduce((n,g)=>n+g[key],0);if(!total||groupResults.length<2)continue;
  // Equal target, capped by each position's capacity. This is a soft indicator, not a feasibility proof.
  let remaining=total;const targets=groupResults.map(()=>0);let open=groupResults.map((g,i)=>i);
  while(open.length){const average=remaining/open.length,capped=open.filter(i=>groupResults[i].cap<average);if(!capped.length){open.forEach(i=>targets[i]=average);break}capped.forEach(i=>{targets[i]=groupResults[i].cap;remaining-=targets[i]});open=open.filter(i=>!capped.includes(i))}
  const loss=groupResults.reduce((n,g,i)=>n+Math.abs(g[key]-targets[i]),0)/(2*total);
  part(key,loss,1,'容量限制下尽量均分；绑定关系可能导致差异');
 }
 const max=components.reduce((n,c)=>n+c.max,0),rawScore=max?Math.round(100*components.reduce((n,c)=>n+c.score,0)/max):null,errors=issues.filter(i=>i.severity==='error').length;
 const score=max?(rows.length?Math.min(rawScore,errors?59:100):0):null;
 return {score,rawScore,weights:scoringWeights,weightTotal:max,status:!max?'当前可检查项权重均为 0，请调整权重':errors?'有必须修正的问题':score>=90?'规则检查良好':score>=70?'可优化':'建议调整',issues,components,groups:groupResults,matched:assignments.size,rows:rows.length,scope,missing:missing.length,errors,covered:covered.size};
}
root.Verification={criteria,defaultWeights,weights,validateWeights,infer,headerIndex,groupMatches,records,audit};
})(typeof module==='object'?module.exports:globalThis);
