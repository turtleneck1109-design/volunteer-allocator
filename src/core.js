/* Volunteer allocation core. No network or DOM dependencies. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const normalize=x=>String(x??'').trim();
const CATS={internal:'内部人员',team:'团体人员',couple:'情侣人员',family:'家属人员',normal:'普通人员'};
function blank(){return {version:1,name:'新活动',people:[],groups:[],sources:[],distinct:[],confirmed:{},teamDone:[],stage:'import',revision:0};}
function person(data={}){return {id:uid(),name:'',student:'',email:'',cat:'normal',autoCoupleFrom:'',intent:'不报名',photo:false,run:false,teams:[],pairs:[],familyName:'',familyTarget:null,partnerName:'',partnerTarget:null,group:null,reserve:false,independent:false,area:false,locked:false,raw:{},origins:[],...data};}
function upgradeRelations(s){const upgrade=p=>{if(!Object.prototype.hasOwnProperty.call(p,'partnerName')){p.partnerName=p.cat==='couple'?(p.familyName||''):'';p.partnerTarget=p.cat==='couple'?(p.familyTarget||null):null;if(p.cat==='couple'){p.familyName='';p.familyTarget=null}}p.partnerTarget??=null};s.people.forEach(upgrade);(s.sources||[]).forEach(src=>{if(src.type!=='groups')(src.records||[]).forEach(upgrade)});return s}
function duplicateSets(s){const map=new Map(s.people.map(p=>[p.id,p.id]));const find=x=>map.get(x)===x?x:find(map.get(x));const seen=new Set(s.distinct);for(let i=0;i<s.people.length;i++)for(let j=i+1;j<s.people.length;j++){const a=s.people[i],b=s.people[j];if(seen.has([a.id,b.id].sort().join('|')))continue;if((a.student&&a.student===b.student)||a.name===b.name){map.set(find(b.id),find(a.id));}}const buckets=new Map();s.people.forEach(p=>{let r=find(p.id);if(!buckets.has(r))buckets.set(r,[]);buckets.get(r).push(p)});return [...buckets.values()].filter(x=>x.length>1)}
function markDistinct(s,ids){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)s.distinct.push([ids[i],ids[j]].sort().join('|'));s.distinct=[...new Set(s.distinct)];}
function merge(s,ids,keepId,relations=true){upgradeRelations(s);const rows=s.people.filter(p=>ids.includes(p.id)),keep=rows.find(p=>p.id===keepId);if(!keep)throw Error('请选择保留记录');if(relations){for(const key of ['familyName','partnerName']){const names=[...new Set(rows.map(p=>p[key]).filter(Boolean))];if(names.length>1)throw Error(keep.name+'：重复记录存在不同的'+(key==='partnerName'?'伴侣':'家属关联')+'姓名，请先编辑确认')}}keep.photo=rows.some(p=>p.photo);keep.run=rows.some(p=>p.run);keep.origins=rows.flatMap(p=>p.origins);if(relations){keep.teams=[...new Set(rows.flatMap(p=>p.teams))];keep.pairs=[...new Set(rows.flatMap(p=>p.pairs))];for(const prefix of ['family','partner']){const linked=rows.find(p=>p[prefix+'Name']||p[prefix+'Target']);if(linked&&!keep[prefix+'Name']&&!keep[prefix+'Target']){keep[prefix+'Name']=linked[prefix+'Name'];keep[prefix+'Target']=linked[prefix+'Target']}}}s.people.forEach(p=>{for(const field of ['familyTarget','partnerTarget'])if(ids.includes(p[field]))p[field]=keepId});s.people=s.people.filter(p=>!ids.includes(p.id)||p.id===keepId);}
function units(s){upgradeRelations(s);const map=new Map(s.people.map(p=>[p.id,p.id]));const find=x=>map.get(x)===x?x:(map.set(x,find(map.get(x))),map.get(x));const join=(a,b)=>{if(map.has(a)&&map.has(b))map.set(find(b),find(a))};const keys=new Map();s.people.forEach(p=>{[...p.teams.map(t=>'t:'+t),...p.pairs.map(t=>'p:'+t)].forEach(k=>{if(keys.has(k))join(p.id,keys.get(k));else keys.set(k,p.id)});if(p.familyTarget)join(p.id,p.familyTarget);if(p.partnerTarget)join(p.id,p.partnerTarget)});const result=new Map();s.people.forEach(p=>{let key=find(p.id);if(!result.has(key))result.set(key,[]);result.get(key).push(p)});return [...result.values()];}
function relationIssues(s){upgradeRelations(s);const issues=[],pairs=new Map(),partners=new Map(s.people.map(p=>[p.id,new Set()]));
 const add=(message,ps)=>issues.push({message,ids:ps.map(p=>p.id)}),edge=(a,b)=>{if(partners.has(a)&&partners.has(b)){partners.get(a).add(b);partners.get(b).add(a)}};
 s.people.forEach(p=>{p.pairs.forEach(k=>{if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(p)});
 if(p.cat==='family'&&!p.familyName&&!p.familyTarget)add(p.name+'：缺少关联志愿者',[p]);
 for(const [prefix,label] of [['family','家属关联'],['partner','伴侣']]){const name=p[prefix+'Name'],target=p[prefix+'Target'];if(name&&!target)add(p.name+'：请确认'+label+'“'+name+'”',[p,...s.people.filter(x=>x.name===name)]);if(target&&!partners.has(target))add(p.name+'：'+label+'人员不存在',[p]);if(target===p.id)add(p.name+'：不能关联自己',[p])}
 if(p.partnerTarget)edge(p.id,p.partnerTarget);if(p.cat==='team'&&!p.teams.length)add(p.name+'：缺少团体名称',[p]);});
 pairs.forEach((ps,key)=>{if(ps.length!==2)add('情侣编号 '+key+'：应为2人，实际'+ps.length+'人',ps);else edge(ps[0].id,ps[1].id)});
 s.people.forEach(p=>{const peers=partners.get(p.id);if(p.cat==='couple'&&!p.pairs.length&&!p.partnerName&&!p.partnerTarget&&!peers.size)add(p.name+'：请填写关联志愿者姓名或配对编号',[p]);if(peers.size>1)add(p.name+'：关联了多位伴侣，请检查姓名或配对编号',[p,...s.people.filter(x=>peers.has(x.id))])});return issues;
}
function relationErrors(s){return [...new Set(relationIssues(s).map(i=>i.message))]}
function issueIds(s){const ids=new Set(relationIssues(s).flatMap(i=>i.ids)),us=units(s);let changed=true;while(changed){const before=ids.size;us.forEach(u=>{if(u.some(p=>ids.has(p.id)))u.forEach(p=>ids.add(p.id))});s.people.forEach(p=>{for(const prefix of ['partner','family'])if(p[prefix+'Name']){const peers=s.people.filter(x=>x.name===p[prefix+'Name']);if(ids.has(p.id)||peers.some(x=>ids.has(x.id))){ids.add(p.id);peers.forEach(x=>ids.add(x.id))}}});changed=ids.size!==before}return ids}
function deferIssues(s){const ids=issueIds(s);s.people.forEach(p=>{if(ids.has(p.id)){p.deferred=true;p.group=null;p.reserve=false;p.independent=false;p.locked=false}});s.groups.forEach(g=>{if(ids.has(g.leader))g.leader=null;if(ids.has(g.area))g.area=null});return ids.size}
function refreshDeferred(s){const ids=issueIds(s);s.people.forEach(p=>{if(p.deferred&&!ids.has(p.id))p.deferred=false})}
function syncCoupleCategories(s){upgradeRelations(s);const peers=new Map(s.people.map(p=>[p.id,new Set()])),invalid=new Set(),pairs=new Map();const join=(a,b)=>{if(a===b||!peers.has(b)){invalid.add(a);return}peers.get(a).add(b);peers.get(b).add(a)};
 s.people.forEach(p=>{if(p.partnerName&&!p.partnerTarget)invalid.add(p.id);if(p.partnerTarget)join(p.id,p.partnerTarget);p.pairs.forEach(key=>{if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(p.id)})});
 pairs.forEach(ids=>{if(ids.length===2)join(ids[0],ids[1]);else ids.forEach(id=>invalid.add(id))});
 const valid=id=>{const linked=peers.get(id);if(invalid.has(id)||linked.size!==1)return false;const other=[...linked][0];return !invalid.has(other)&&peers.get(other).size===1};
 s.people.forEach(p=>{if(p.autoCoupleFrom==='normal'&&p.cat!=='couple')p.autoCoupleFrom='';if(valid(p.id)){if(p.cat==='normal'){p.cat='couple';p.autoCoupleFrom='normal'}}else if(p.autoCoupleFrom==='normal'){p.cat='normal';p.autoCoupleFrom=''}});
}
function resolveFamily(s){upgradeRelations(s);s.people.forEach(p=>{for(const prefix of ['family','partner']){if(p[prefix+'Name']&&!p[prefix+'Target']){const matches=s.people.filter(x=>x.id!==p.id&&x.name===p[prefix+'Name']);if(matches.length===1)p[prefix+'Target']=matches[0].id;}}});syncCoupleCategories(s);}
function roleErrors(s){let errors=[];if(!s.groups.length)errors.push('请先设置小组');const used=new Map(),groupLeaders=new Map();s.groups.forEach(g=>{if(!g.name||!g.no)errors.push('小组名称和组号不能为空');if(!Number.isInteger(g.cap)||g.cap<1)errors.push(g.name+'：名额必须为正整数');const leader=s.people.find(p=>p.id===g.leader);if(!leader)errors.push(g.name+'：请选择组长');else{if(leader.deferred)errors.push(leader.name+'：关联待处理，暂不能任职');if(leader.cat!=='internal')errors.push(g.name+'：组长须来自内部名单');if(used.has(leader.id)&&used.get(leader.id)!==normalize(g.no))errors.push(leader.name+'：不能兼任不同组号的组长');if(groupLeaders.has(normalize(g.no))&&groupLeaders.get(normalize(g.no))!==leader.id)errors.push(g.no+'组：同组项目请选择同一位组长');groupLeaders.set(normalize(g.no),leader.id);if(leader.independent)errors.push(leader.name+'：独立区长不能兼任组长');used.set(leader.id,normalize(g.no))}if(g.area&&!s.people.some(p=>p.id===g.area&&p.cat==='internal'&&!p.deferred))errors.push(g.name+'：区长须来自内部名单');});units(s).forEach(u=>{if(u.length>1&&u.some(p=>p.independent))errors.push(u.map(p=>p.name).join('、')+'：独立区长有同组关系，请编入小组')});return errors;}
function validate(s,requireAssigned=false){const errors=[];s.groups.forEach(g=>{const n=s.people.filter(p=>p.group===g.id).length;if(n>g.cap)errors.push(g.name+'：超出 '+(n-g.cap)+' 人');if(g.leader){const p=s.people.find(p=>p.id===g.leader);if(p&&!s.groups.some(project=>project.id===p.group&&normalize(project.no)===normalize(g.no)&&project.leader===p.id))errors.push(p.name+'：组长必须留在指定组');}});s.people.forEach(p=>{if(p.group&&!s.groups.some(g=>g.id===p.group))errors.push(p.name+'：小组不存在');if(p.group&&p.reserve)errors.push(p.name+'：分组与储备冲突');if(p.independent&&(p.group||p.reserve))errors.push(p.name+'：独立区长不应编组或储备');if(requireAssigned&&!p.group&&!p.reserve&&!p.independent)errors.push(p.name+'：尚未安排');});units(s).forEach(u=>{const positions=new Set(u.map(p=>p.independent?'independent':p.group||(p.reserve?'reserve':'pending')));if(positions.size>1)errors.push(u.map(p=>p.name).join('、')+'：绑定成员尚未全部同组')});return [...new Set(errors)];}
function placeLeaders(s){const errors=roleErrors(s);if(errors.length)throw Error(errors.join('\n'));const candidate=copy(s);candidate.people.forEach(p=>{p.group=null;p.reserve=false;p.locked=false;p.area=candidate.groups.some(g=>g.area===p.id);if(!p.area)p.independent=false;});for(const u of units(candidate)){const gs=candidate.groups.filter(g=>u.some(p=>p.id===g.leader));if(new Set(gs.map(g=>normalize(g.no))).size>1)throw Error('同一绑定组合的组长指定了不同小组');if(gs.length){const home=gs.find(g=>candidate.people.filter(p=>p.group===g.id).length+u.length<=g.cap);if(!home)throw Error(gs[0].no+'组：没有项目能容纳组长及其绑定成员');u.forEach(p=>{p.group=home.id;p.locked=true})}}const faults=validate(candidate);if(faults.length)throw Error(faults.join('\n'));const leaders=new Set(candidate.groups.map(g=>g.leader));s.people=[...candidate.people.filter(p=>leaders.has(p.id)),...candidate.people.filter(p=>p.group&&!leaders.has(p.id)),...candidate.people.filter(p=>!p.group)];}
function eligible(u,stage,team){if(u.some(p=>p.deferred)||u.every(p=>p.independent))return false;if(stage==='internal')return u.some(p=>p.cat==='internal');if(stage==='team')return u.some(p=>p.teams.includes(team));if(stage==='couple')return u.some(p=>p.pairs.length||p.partnerName||p.partnerTarget||p.cat==='couple');if(stage==='normal')return true;return false;}
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function sourceOrder(s,p){const positions=(p.origins||[]).map(o=>{const i=s.sources.findIndex(src=>src.id===o.sourceId||(!o.sourceId&&src.file===o.file&&src.sheet===o.sheet));return (i<0?s.sources.length:i)*10000000+(Number(o.row)||0)});return positions.length?Math.min(...positions):s.sources.length*10000000+s.people.indexOf(p)}
function withdraw(s,id,reason=''){const p=s.people.find(p=>p.id===id);if(!p)throw Error('人员不存在');s.withdrawn??=[];s.withdrawn.push({...copy(p),withdrawalReason:normalize(reason),withdrawnAt:new Date().toISOString()});s.people=s.people.filter(x=>x.id!==id);s.people.forEach(x=>{for(const key of ['partnerTarget','familyTarget'])if(x[key]===id)x[key]=null});s.groups.forEach(g=>{if(g.leader===id)g.leader=null;if(g.area===id)g.area=null});s.confirmed={};s.teamDone=[];return p}
function restoreWithdrawn(s,id){const i=(s.withdrawn||[]).findIndex(p=>p.id===id);if(i<0)throw Error('记录不存在');const p=s.withdrawn.splice(i,1)[0];delete p.withdrawalReason;delete p.withdrawnAt;Object.assign(p,{group:null,reserve:false,locked:false,independent:false,area:false,deferred:false});for(const key of ['partnerTarget','familyTarget'])if(!s.people.some(x=>x.id===p[key]))p[key]=null;s.people.push(p);resolveFamily(s);s.confirmed={};s.teamDone=[]}
function allocate(s,stage,team='',seed=Date.now(),tries=80){
 const errors=[...relationIssues(s).filter(i=>i.ids.some(id=>!s.people.find(p=>p.id===id)?.deferred)).map(i=>i.message),...roleErrors(s)];if(errors.length)throw Error(errors.join('\n'));
 const leaderIds=new Set(s.groups.map(g=>g.leader));const allUnits=units(s),candidates=allUnits.filter(u=>eligible(u,stage,team)&&!u.some(p=>p.locked||leaderIds.has(p.id)));
 const ids=new Set(candidates.flatMap(u=>u.map(p=>p.id)));const fixed=s.people.filter(p=>p.group&&!ids.has(p.id));const random=rng(seed);let best=null;
 for(let t=0;t<tries;t++){
  let counts=Object.fromEntries(s.groups.map(g=>[g.id,{n:0,internal:0,photo:0,run:0}]));fixed.forEach(p=>{const c=counts[p.group];if(c){c.n++;c.internal+=p.cat==='internal'&&!leaderIds.has(p.id)?1:0;c.photo+=p.photo?1:0;c.run+=p.run?1:0}});
  if(s.groups.some(g=>counts[g.id].n>g.cap))throw Error('已固定人员超过小组容量');
  let ordered=candidates.map(u=>u.slice().sort((a,b)=>sourceOrder(s,a)-sourceOrder(s,b))).sort((a,b)=>sourceOrder(s,a[0])-sourceOrder(s,b[0])),assignment={},missed=[];
  for(const u of ordered){const n=u.length,ic=u.filter(p=>p.cat==='internal'&&!leaderIds.has(p.id)).length,ph=u.filter(p=>p.photo).length,ru=u.filter(p=>p.run).length;let options=s.groups.filter(g=>counts[g.id].n+n<=g.cap).map(g=>{const c=counts[g.id];return {g,score:(stage==='internal'?c.internal*200+ic:0)+(c.n/g.cap)*20+(ph?c.photo*8:0)+(ru?c.run*8:0)+random()}}).sort((a,b)=>a.score-b.score);if(!options.length){missed.push(...u.map(p=>p.id));continue}let g=options[0].g;u.forEach(p=>assignment[p.id]=g.id);counts[g.id].n+=n;counts[g.id].internal+=ic;counts[g.id].photo+=ph;counts[g.id].run+=ru;}
  const values=Object.values(counts),spread=key=>Math.max(...values.map(x=>x[key]))-Math.min(...values.map(x=>x[key]));const score=missed.length*100000+(stage==='internal'?spread('internal')*1000:0)+spread('photo')*30+spread('run')*30+spread('n');if(!best||score<best.score)best={score,assignment,missed,order:ordered.flatMap(u=>u.map(p=>p.id))};
 }
 s.people.forEach(p=>{if(ids.has(p.id)){p.group=best.assignment[p.id]||null;p.reserve=stage==='normal'&&!p.group}});const byId=new Map(s.people.map(p=>[p.id,p]));s.people=[...s.people.filter(p=>!ids.has(p.id)),...best.order.map(id=>byId.get(id))];s.seed=seed;return {unplaced:best.missed,attempts:tries};
}
function move(s,selected,target,anchor=null,after=false){const us=units(s),ids=new Set(us.filter(u=>u.some(p=>selected.includes(p.id))).flatMap(u=>u.map(p=>p.id))),moving=s.people.filter(p=>ids.has(p.id));if(!moving.length)throw Error('请选择人员');if(moving.some(p=>p.deferred))throw Error('请先修复待处理人员的关联，再移动');if(anchor&&ids.has(anchor))return false;const destination=p=>p.group||(p.reserve?'reserve':p.independent?'independent':'pending');const reorder=moving.every(p=>destination(p)===target);if(!reorder&&moving.some(p=>p.locked))throw Error('包含锁定人员，请先解锁');if(moving.some(p=>s.groups.some(g=>g.leader===p.id&&!s.groups.some(project=>project.id===target&&normalize(project.no)===normalize(g.no)&&project.leader===p.id))))throw Error('组长只能留在指定小组');if(moving.some(p=>p.independent)&&target!=='independent')throw Error('请先将独立区长改为编入小组');const g=s.groups.find(g=>g.id===target);if(!g&&!['pending','reserve'].includes(target))throw Error('目标小组不存在');if(g&&s.people.filter(p=>p.group===target&&!ids.has(p.id)).length+moving.length>g.cap)throw Error('目标组容量不足，未移动任何人');let remaining=s.people.filter(p=>!ids.has(p.id)),index=anchor?remaining.findIndex(p=>p.id===anchor):remaining.reduce((r,p,i)=>destination(p)===target?i+1:r,-1);if(anchor&&index<0)throw Error('排序目标不存在');if(anchor&&after)index++;if(index<0)index=remaining.length;moving.forEach(p=>{p.group=g?.id||null;p.reserve=target==='reserve';if(!reorder)p.locked=true;});s.people=[...remaining.slice(0,index),...moving,...remaining.slice(index)];return true;}
function swap(s,selected,other){const a=units(s).filter(u=>u.some(p=>selected.includes(p.id))).flat(),b=units(s).find(u=>u.some(p=>p.id===other));if(!a.length||!b)throw Error('请选择交换对象');if(a.some(p=>b.some(q=>q.id===p.id)))throw Error('不能与同一绑定组合交换');const pos=p=>p.group||(p.reserve?'reserve':'pending'),apos=new Set(a.map(pos)),bpos=new Set(b.map(pos));if(apos.size!==1||bpos.size!==1)throw Error('所选人员必须来自同一位置');const ga=[...apos][0],gb=[...bpos][0];if(ga===gb)throw Error('请选择另一个组或储备区');if([...a,...b].some(p=>p.deferred||p.locked||p.independent||s.groups.some(g=>g.leader===p.id)))throw Error('不能交换组长、独立区长或锁定人员');const changed=copy(s);const aset=new Set(a.map(p=>p.id)),bset=new Set(b.map(p=>p.id));changed.people.forEach(p=>{let target=aset.has(p.id)?gb:bset.has(p.id)?ga:null;if(target){p.group=['pending','reserve'].includes(target)?null:target;p.reserve=target==='reserve';p.locked=true;}});const errors=validate(changed);if(errors.length)throw Error(errors.join('\n'));s.people=[...changed.people.filter(p=>!aset.has(p.id)&&!bset.has(p.id)),...changed.people.filter(p=>aset.has(p.id)||bset.has(p.id))];}
function validateFile(s){if(!s||s.version!==1||!Array.isArray(s.people)||!Array.isArray(s.groups)||!Array.isArray(s.sources)||!Array.isArray(s.distinct)||!Array.isArray(s.teamDone)||!s.confirmed||typeof s.name!=='string')throw Error('项目格式不兼容');const ids=new Set();s.people.forEach(p=>{if(typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!CATS[p.cat]||!Array.isArray(p.teams)||!Array.isArray(p.pairs)||!Array.isArray(p.origins)||!p.raw)throw Error('人员格式错误');ids.add(p.id)});const gs=new Set();s.groups.forEach(g=>{if(typeof g.id!=='string'||gs.has(g.id)||!Number.isInteger(g.cap)||g.cap<1)throw Error('小组格式错误');gs.add(g.id)});s.people.forEach(p=>{if(p.group&&!gs.has(p.group))throw Error('人员引用不存在的小组');if(p.familyTarget&&!ids.has(p.familyTarget))throw Error('家属关联编号不存在');if(p.partnerTarget&&!ids.has(p.partnerTarget))throw Error('情侣关联编号不存在')});return upgradeRelations(s);}
function removeSources(state,sourceIds){
 const s=upgradeRelations(copy(state)),removed=new Set(sourceIds),sources=new Map(s.sources.map(src=>[src.id,src]));
 if(!sourceIds.length||sourceIds.some(id=>!sources.has(id)))throw Error('导入记录已变化，请重新选择');
 const sourceFor=o=>{if(o.sourceId)return o.sourceId;const hits=s.sources.filter(src=>src.type!=='groups'&&src.file===o.file&&src.sheet===o.sheet);if(hits.length>1&&hits.some(src=>removed.has(src.id)))throw Error('旧版同名导入无法唯一定位，请从历史恢复导入前版本');return hits.length===1?hits[0].id:null};
 const recordFor=o=>{const src=sources.get(sourceFor(o));return src?.records?.find(r=>r.origins.some(x=>x.row===o.row&&x.file===o.file&&x.sheet===o.sheet))};
 const stats={people:0,groups:0,retained:0,unassigned:0,roles:0};
 s.people=s.people.flatMap(p=>{
  const deleted=p.origins.filter(o=>removed.has(sourceFor(o)));if(!deleted.length)return [p];
  const remaining=p.origins.filter(o=>!removed.has(sourceFor(o)));if(!remaining.length){stats.people++;return []}
  const oldRecords=p.origins.map(recordFor),remainingRecords=remaining.map(recordFor);
  if(oldRecords.some(r=>!r)||remainingRecords.some(r=>!r))throw Error('旧版合并记录“'+p.name+'”缺少完整来源数据。为避免误删其他来源，请从历史恢复导入前版本，或重新导入该文件');
  stats.retained++;const oldPrimary=p.primarySourceId||sourceFor(p.origins[0]);
  if(removed.has(oldPrimary)){
   const replacement=remainingRecords[0];Object.assign(p,copy(replacement),{id:p.id,autoCoupleFrom:replacement.autoCoupleFrom||'',group:p.group,reserve:p.reserve,independent:p.independent,area:p.area,locked:false,origins:remaining,primarySourceId:sourceFor(remaining[0])});
   p.teams=[...new Set(remainingRecords.flatMap(r=>r.teams))];p.pairs=[...new Set(remainingRecords.flatMap(r=>r.pairs))];p.photo=remainingRecords.some(r=>r.photo);p.run=remainingRecords.some(r=>r.run);
   for(const prefix of ['family','partner']){const linked=remainingRecords.find(r=>r[prefix+'Name']||r[prefix+'Target']);p[prefix+'Name']=linked?.[prefix+'Name']||'';p[prefix+'Target']=linked?.[prefix+'Target']||null;}
  }else{
   for(const field of ['teams','pairs']){const before=new Set(oldRecords.flatMap(r=>r[field])),after=new Set(remainingRecords.flatMap(r=>r[field]));p[field]=p[field].filter(value=>!before.has(value)||after.has(value))}
   for(const field of ['photo','run'])if(oldRecords.some(r=>r[field])&&!remainingRecords.some(r=>r[field]))p[field]=false;
   for(const prefix of ['family','partner'])if(p[prefix+'Name']&&oldRecords.some(r=>r[prefix+'Name']===p[prefix+'Name'])&&!remainingRecords.some(r=>r[prefix+'Name']===p[prefix+'Name'])){p[prefix+'Name']='';p[prefix+'Target']=null}
   p.origins=remaining;
  }
  return [p];
 });
 const groupSources=sourceIds.map(id=>sources.get(id)).filter(src=>src.type==='groups');
 for(const src of groupSources){if(!Array.isArray(src.records)&&!s.groups.some(g=>g.sourceId===src.id))throw Error('旧版小组信息没有来源标记，请从历史恢复导入前版本；新导入的表格支持单独撤销')}
 const groupIds=new Set(groupSources.flatMap(src=>[...(src.records||[]).map(g=>g.id),...s.groups.filter(g=>g.sourceId===src.id).map(g=>g.id)]));
 stats.groups=s.groups.filter(g=>groupIds.has(g.id)).length;s.groups=s.groups.filter(g=>!groupIds.has(g.id));
 const peopleIds=new Set(s.people.map(p=>p.id));s.groups.forEach(g=>{for(const field of ['leader','area'])if(g[field]&&!s.people.some(p=>p.id===g[field]&&p.cat==='internal')){g[field]=null;stats.roles++}});
 s.people.forEach(p=>{if(groupIds.has(p.group)){p.group=null;p.reserve=false;stats.unassigned++}for(const field of ['familyTarget','partnerTarget'])if(p[field]&&!peopleIds.has(p[field]))p[field]=null;p.area=s.groups.some(g=>g.area===p.id);if(!p.area)p.independent=false;p.locked=false;});
 s.sources=s.sources.filter(src=>!removed.has(src.id));s.distinct=s.distinct.filter(pair=>pair.split('|').every(id=>peopleIds.has(id)));s.confirmed={};s.teamDone=[];s.stage='import';resolveFamily(s);
 return {state:s,stats};
}
function assignLeaders(state,includeAll=false){
 const s=copy(state);resolveFamily(s);const issues=issueIds(s),us=units(s),unitOf=new Map();us.forEach((u,i)=>u.forEach(p=>unitOf.set(p.id,i)));
 const groups=new Map();s.groups.forEach(g=>{const no=normalize(g.no);if(!no||!Number.isInteger(g.cap)||g.cap<1)throw Error('请先填写有效组号和名额');if(!groups.has(no))groups.set(no,[]);groups.get(no).push(g)});if(!groups.size)throw Error('请先添加或导入小组');
 const byId=new Map(s.people.map(p=>[p.id,p])),reserved=new Set(),chosen=new Map();
 const usable=u=>!u.some(p=>p.deferred||p.independent||issues.has(p.id));
 for(const [no,projects] of groups){const ids=[...new Set(projects.map(g=>g.leader).filter(Boolean))];if(ids.length>1)throw Error(no+'组已有不同组长，请先统一选择');if(!ids.length)continue;const p=byId.get(ids[0]),index=unitOf.get(ids[0]),u=us[index];if(!p||p.cat!=='internal'||!usable(u))throw Error(no+'组已有组长不可用，请先调整');if(reserved.has(index))throw Error('已有组长或其绑定成员跨组任职，请先调整');if(!projects.some(g=>g.cap>=u.length))throw Error(no+'组名额不足以容纳已有组长及其绑定成员');reserved.add(index);chosen.set(no,p.id)}
 const candidates=us.flatMap((u,index)=>{if(reserved.has(index)||!usable(u))return [];const people=u.filter(p=>p.cat==='internal');const willing=people.filter(p=>/小组长|两者/.test(p.intent));const p=willing[0]||(includeAll?people[0]:null);return p?[{index,person:p,willing:willing.length>0,size:u.length}]:[]});
 const empty=[...groups.keys()].filter(no=>!chosen.has(no)).sort((a,b)=>Math.max(...groups.get(a).map(g=>g.cap))-Math.max(...groups.get(b).map(g=>g.cap)));
 const assignedUnit=new Map(),assignedGroup=new Map();
 function fill(no,all,seen){const options=candidates.filter(c=>(all||c.willing)&&groups.get(no).some(g=>g.cap>=c.size)).sort((a,b)=>Number(b.willing)-Number(a.willing)||a.size-b.size);for(const c of options){if(seen.has(c.index))continue;seen.add(c.index);const owner=assignedUnit.get(c.index);if(owner===undefined||fill(owner,all,seen)){assignedUnit.set(c.index,no);assignedGroup.set(no,c);return true}}return false}
 empty.forEach(no=>fill(no,false,new Set()));if(includeAll)empty.filter(no=>!assignedGroup.has(no)).forEach(no=>fill(no,true,new Set()));
 assignedGroup.forEach((c,no)=>chosen.set(no,c.person.id));let changed=0;s.groups.forEach(g=>{const id=chosen.get(normalize(g.no));if(id&&g.leader!==id){g.leader=id;changed++}});
 return {groups:s.groups,assigned:assignedGroup.size,retained:groups.size-empty.length,missing:empty.filter(no=>!assignedGroup.has(no)),changed,available:candidates.length};
}

function deleteGroup(state,id){
 const s=copy(state),group=s.groups.find(g=>g.id===id);if(!group)throw Error('该项目已不存在');
 const affected=new Set(units(s).filter(u=>u.some(p=>p.group===id)).flat().map(p=>p.id));
 s.groups=s.groups.filter(g=>g.id!==id);
 let releasedArea=0;s.people.forEach(p=>{if(affected.has(p.id)){p.group=null;p.reserve=false;p.locked=false}p.area=s.groups.some(g=>g.area===p.id);if(p.independent&&!p.area){p.independent=false;p.locked=false;releasedArea++}});
 s.sources.filter(src=>src.type==='groups').forEach(src=>{const removed=(src.records||[]).find(g=>g.id===id);if(!removed)return;src.records=src.records.filter(g=>g.id!==id);src.count=src.records.length;if(src.importSheet&&Number.isInteger(removed.importRow)){src.importSheet.excludedRows=[...new Set([...(src.importSheet.excludedRows||[]),removed.importRow])]}});
 for(const key of ['roles','internal','team','couple','normal','overview'])delete s.confirmed[key];s.teamDone=[];s.stage='roles';s.revision++;
 if(s.exportPrefs?.groups)s.exportPrefs.groups=s.exportPrefs.groups.filter(gid=>gid!==id);if(s.mailDraft?.recipients)delete s.mailDraft.recipients[id];
 return {state:s,group,returned:affected.size,releasedArea,siblings:s.groups.filter(g=>normalize(g.no)===normalize(group.no)).length};
}

function remainingPlan(state){
 const s=copy(state),steps=[],notes=[];
 if(!s.confirmed.dedup||duplicateSets(s).length)throw Error('请先完成导入和查重确认，再一键生成剩余分配。');
 resolveFamily(s);deferIssues(s);refreshDeferred(s);
 const snapshot=label=>{s.revision++;steps.push({label,state:copy(s)})};
 if(!s.confirmed.roles){const plan=assignLeaders(s,false);if(plan.missing.length)throw Error('报名组长人数或可用名额不足，以下组尚无组长：'+plan.missing.join('、')+'。请先补选组长后再运行。');s.groups=plan.groups;placeLeaders(s);s.confirmed.roles=true;s.stage='internal';snapshot('全自动 · 任职');}
 const teams=[...new Set(s.people.flatMap(p=>p.teams))];
 for(const [stage,team] of [['internal',''],...teams.map(t=>['team',t]),['couple',''],['normal','']]){
  if(stage==='team'?s.teamDone.includes(team):s.confirmed[stage])continue;
  const result=allocate(s,stage,team);const relevant=units(s).filter(u=>eligible(u,stage,team)).flat();
  const pending=relevant.filter(p=>!p.group&&!p.independent&&!(stage==='normal'&&p.reserve));
  if(pending.length){notes.push((team||stage)+'：'+pending.length+' 人待人工调整');pending.forEach(p=>p.locked=true)}
  relevant.filter(p=>p.group||p.reserve).forEach(p=>p.locked=true);
  if(!pending.length){if(stage==='team')s.teamDone=[...new Set([...s.teamDone,team])];else s.confirmed[stage]=true;}
  s.confirmed.team=teams.every(t=>s.teamDone.includes(t));s.stage=stage;
  snapshot('全自动 · '+(team||({internal:'内部',couple:'情侣',normal:'普通'}[stage]))+(pending.length?'（待调整）':''));
 }
 s.stage='overview';delete s.confirmed.overview;
 const faults=validate(s);if(faults.length)throw Error(faults.join('\n'));
 snapshot('全自动分配草案 · 待最终检查');
 return {state:s,steps,notes,pending:s.people.filter(p=>!p.group&&!p.reserve&&!p.independent).length};
}

root.V={sourceOrder,withdraw,restoreWithdrawn,remainingPlan,deleteGroup,assignLeaders,copy,uid,normalize,upgradeRelations,syncCoupleCategories,CATS,blank,person,duplicateSets,markDistinct,merge,units,relationIssues,issueIds,deferIssues,refreshDeferred,relationErrors,resolveFamily,roleErrors,validate,placeLeaders,eligible,allocate,move,swap,validateFile,removeSources};
})(typeof module==='object'?module.exports:globalThis);
