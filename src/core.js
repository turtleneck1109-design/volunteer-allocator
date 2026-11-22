/* Volunteer allocation core. No network or DOM dependencies. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const normalize=x=>String(x??'').trim();
const CATS={internal:'内部人员',team:'团体人员',couple:'情侣人员',family:'家属人员',normal:'普通人员'};
function blank(){return {version:1,name:'新活动',people:[],groups:[],sources:[],distinct:[],confirmed:{},teamDone:[],stage:'import',revision:0};}
function person(data={}){return {id:uid(),name:'',student:'',idNumber:'',email:'',cat:'normal',autoCoupleFrom:'',photo:false,run:false,teams:[],pairs:[],familyName:'',familyStudent:'',familyTarget:null,familyTogether:null,familyAbsent:false,partnerName:'',partnerStudent:'',partnerTarget:null,group:null,reserve:false,independent:false,area:false,locked:false,raw:{},origins:[],...data};}
function upgradeRelations(s){const upgrade=p=>{p.partnerStudent??='';p.familyStudent??='';p.familyTogether??=null;p.familyAbsent??=false;if(!Object.prototype.hasOwnProperty.call(p,'partnerName')){p.partnerName=p.cat==='couple'?(p.familyName||''):'';p.partnerTarget=p.cat==='couple'?(p.familyTarget||null):null;if(p.cat==='couple'){p.familyName='';p.familyTarget=null}}p.partnerTarget??=null};s.people.forEach(upgrade);(s.sources||[]).forEach(src=>{if(src.type!=='groups')(src.records||[]).forEach(upgrade)});return s}
// Identity review is separate from dedup: only an exact name + student pair can share a number.
function identityKey(p){return JSON.stringify([normalize(p.name),normalize(p.student)])}
function cleanIdNumber(value){const v=normalize(value);return /^(无|暂无|未填|未填写|未提供|不详|未知|没有|不使用|null|undefined|n\/a|-+|—+)$/i.test(v)?'':v.toUpperCase()}
function isIdNumberHeader(header){const h=normalize(header).replace(/^Q?\d+[.、．:：]?\s*/i,'').replace(/[（(][^）)]*[）)]/g,'').replace(/您的|您|请填写|请填|的|\s/g,'');return /^(身份证号|身份证号码|身份证件号|身份证件号码|证件号|证件号码)$/.test(h)}
function recordIdNumbers(p){if(p.idNumberEdited||p.idNumberMapped!==undefined)return [cleanIdNumber(p.idNumber)].filter(Boolean);return [...new Set([cleanIdNumber(p.idNumber),...Object.entries(p.raw||{}).filter(([k])=>isIdNumberHeader(k)).map(([,v])=>cleanIdNumber(v))].filter(Boolean))]}
function identityReview(s){
 const sourceRows=new Map();for(const source of s.sources||[]){const rows=new Map();for(const r of source.records||[])for(const o of r.origins||[])rows.set(JSON.stringify([o.file,o.sheet,o.row]),r);sourceRows.set(source.id,rows)}
 const valuesFor=p=>{if(p.idNumberEdited)return recordIdNumbers(p);return [...new Set([...recordIdNumbers(p),...(p.origins||[]).flatMap(o=>{const sourceId=o.sourceId||(s.sources||[]).filter(src=>src.file===o.file&&src.sheet===o.sheet).map(src=>src.id).filter((id,i,all)=>all.length===1)[0];const r=sourceRows.get(sourceId)?.get(JSON.stringify([o.file,o.sheet,o.row]));return r?recordIdNumbers(r):[]})])]};
 const buckets=new Map(),distinct=new Set(s.distinct||[]);for(const p of s.people){const key=normalize(p.name)&&normalize(p.student)?identityKey(p):p.id;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p)}
 const entries=[];for(const rows of buckets.values()){
  const separated=rows.some(a=>rows.some(b=>distinct.has([a.id,b.id].sort().join('|'))));
  for(const people of separated?rows.map(p=>[p]):[rows]){const values=[...new Set(people.flatMap(valuesFor))];const waived=people.every(p=>p.idNumberReview?.decision==='keep'&&p.idNumberReview.identity===identityKey(p));entries.push({ids:people.map(p=>p.id),name:people[0].name,student:people[0].student,values,status:values.length>1?'conflict':values.length?'complete':waived?'kept':'missing'})}
 }
 return entries;
}
function identityReviewErrors(s,force=false){if(!force&&!s.identityCheckRequired)return [];const pending=identityReview(s).filter(x=>['missing','conflict'].includes(x.status));return pending.length?['请先处理身份证号核对：'+pending.length+' 项缺失或冲突（'+pending.slice(0,8).map(x=>x.name).join('、')+'）']:[]}
function resolveIdentityReview(s,id,decision,value=''){
 const entry=identityReview(s).find(x=>x.ids.includes(id));if(!entry)throw Error('人员不存在');
 if(!['fill','keep','delete','distinct'].includes(decision))throw Error('无效的核对操作');
 const number=cleanIdNumber(value);if(decision==='fill'&&!number)throw Error('请输入身份证号');
 if(decision==='keep'&&entry.status!=='missing')throw Error('仅缺失号码可明确保留；号码冲突请先核对');
 if(decision==='distinct'&&entry.ids.length<2)throw Error('只有一条记录，不能标记为不同的人');
 s.identityCheckRequired=true;
 if(decision==='distinct'){markDistinct(s,entry.ids);delete s.confirmed.dedup;delete s.confirmed.overview;return entry.ids}
 if(decision==='delete'){for(const personId of entry.ids)withdraw(s,personId,entry.status==='conflict'?'身份证号冲突，经确认移出':'身份证号缺失，经确认移出');return entry.ids}
 for(const personId of entry.ids){const p=s.people.find(p=>p.id===personId);if(decision==='fill'){p.idNumber=number;p.idNumberEdited=true;delete p.idNumberReview}else p.idNumberReview={decision:'keep',identity:identityKey(p),at:new Date().toISOString()}}
 delete s.confirmed.dedup;delete s.confirmed.overview;return entry.ids;
}
function duplicateSets(s){
 const parent=new Map(s.people.map(p=>[p.id,p.id])),members=new Map(s.people.map(p=>[p.id,[p.id]]));
 const find=id=>parent.get(id)===id?id:find(parent.get(id));
 const distinct=new Set(s.distinct),edges=[];
 for(let i=0;i<s.people.length;i++)for(let j=i+1;j<s.people.length;j++){
  const a=s.people[i],b=s.people[j],sameStudent=!!a.student&&a.student===b.student;
  if(sameStudent||a.name===b.name)edges.push({a:a.id,b:b.id,strong:sameStudent});
 }
 // Resolve exact identifiers first. Explicitly distinct identities cannot be bridged by another row.
 edges.sort((a,b)=>Number(b.strong)-Number(a.strong));
 for(const edge of edges){const a=find(edge.a),b=find(edge.b);if(a===b)continue;
  if(members.get(a).some(x=>members.get(b).some(y=>distinct.has([x,y].sort().join('|')))))continue;
  parent.set(b,a);members.set(a,[...members.get(a),...members.get(b)]);members.delete(b);
 }
 const buckets=new Map();s.people.forEach(p=>{const id=find(p.id);if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(p)});
 return [...buckets.values()].filter(rows=>rows.length>1);
}
function markDistinct(s,ids){for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)s.distinct.push([ids[i],ids[j]].sort().join('|'));s.distinct=[...new Set(s.distinct)];}
function merge(s,ids,keepId,relations=true){upgradeRelations(s);const rows=s.people.filter(p=>ids.includes(p.id)),keep=rows.find(p=>p.id===keepId);if(!keep)throw Error('请选择保留记录');if(s.distinct.some(key=>{const [a,b]=key.split('|');return ids.includes(a)&&ids.includes(b)}))throw Error('这些记录已确认是不同的人，不能合并');const idValues=[...new Set(identityReview(s).filter(e=>e.ids.some(id=>ids.includes(id))).flatMap(e=>e.values))];if(idValues.length>1)throw Error('身份证号不一致，请先核对身份，或确认为不同的人');const identityOverride=rows.find(p=>p.idNumberEdited&&cleanIdNumber(p.idNumber));const familyTogether=relations?familyChoice(rows):keep.familyTogether;if(relations){for(const key of ['familyName','familyStudent','partnerName','partnerStudent']){const names=[...new Set(rows.map(p=>p[key]).filter(Boolean))];if(names.length>1)throw Error(keep.name+'：重复记录存在不同的'+(key==='familyStudent'?'家属学号':key==='partnerStudent'?'情侣学号':key==='partnerName'?'伴侣姓名':'家属关联姓名')+'，请先编辑确认')}}if(relations&&rows.some(p=>p.familyAbsent)&&rows.some(p=>p.familyTarget&&!p.familyAbsent))throw Error('家属参加状态冲突，请先编辑确认');if(identityOverride){keep.idNumber=identityOverride.idNumber;keep.idNumberEdited=true}keep.familyAbsent=relations?rows.some(p=>p.familyAbsent):keep.familyAbsent;keep.familyTogether=familyTogether;keep.photo=rows.some(p=>p.photo);keep.run=rows.some(p=>p.run);keep.origins=rows.flatMap(p=>p.origins);if(idValues.length&&!identityOverride){keep.idNumberEdited=false;const sourced=identityReview({...s,people:[{...keep,idNumber:'',raw:{},idNumberMapped:false}]}).flatMap(e=>e.values);if(!sourced.includes(idValues[0])){keep.idNumber=idValues[0];keep.idNumberMapped=true}}if(relations){for(const prefix of ['partner','family'])keep[prefix+'Student']=keep[prefix+'Student']||rows.find(p=>p[prefix+'Student'])?.[prefix+'Student']||'';keep.teams=[...new Set(rows.flatMap(p=>p.teams))];keep.pairs=[...new Set(rows.flatMap(p=>p.pairs))];for(const prefix of ['family','partner']){const linked=rows.find(p=>p[prefix+'Name']||p[prefix+'Target']);if(linked&&!keep[prefix+'Name']&&!keep[prefix+'Target']){keep[prefix+'Name']=linked[prefix+'Name'];keep[prefix+'Target']=linked[prefix+'Target']}}}s.people.forEach(p=>{for(const field of ['familyTarget','partnerTarget'])if(ids.includes(p[field]))p[field]=keepId});s.people=s.people.filter(p=>!ids.includes(p.id)||p.id===keepId);s.distinct=[...new Set(s.distinct.map(key=>key.split('|').map(id=>ids.includes(id)?keepId:id).sort()).filter(([a,b])=>a!==b).map(ids=>ids.join('|')))];}
// A family relationship remains in the roster even when same-position binding is declined.
function familyBinding(s,p){return !p.familyAbsent&&p.familyTogether!==false&&(!p.familyTarget||!s.people.some(x=>x.id===p.familyTarget&&(x.familyTogether===false||x.familyAbsent)))}
function familyChoice(rows){const values=[...new Set(rows.map(p=>p.familyTogether).filter(v=>typeof v==='boolean'))];if(values.length>1)throw Error('重复记录的“是否与家属分到一组”答案冲突，请先编辑确认');return values[0]??null}
function units(s,mode='all'){upgradeRelations(s);const map=new Map(s.people.map(p=>[p.id,p.id]));const find=x=>map.get(x)===x?x:(map.set(x,find(map.get(x))),map.get(x));const join=(a,b)=>{if(map.has(a)&&map.has(b))map.set(find(b),find(a))};const keys=new Map();s.people.forEach(p=>{[...p.teams.map(t=>'t:'+t),...(mode==='hard'?[]:p.pairs.map(t=>'p:'+t))].forEach(k=>{if(keys.has(k)){const other=s.people.find(x=>x.id===keys.get(k));if(!k.startsWith('p:')||mode==='all'||p.group&&other?.group)join(p.id,keys.get(k))}else keys.set(k,p.id)});if(p.familyTarget&&familyBinding(s,p))join(p.id,p.familyTarget);if(p.partnerTarget&&(mode==='all'||mode==='active'&&p.group&&s.people.some(x=>x.id===p.partnerTarget&&x.group)))join(p.id,p.partnerTarget)});const result=new Map();s.people.forEach(p=>{let key=find(p.id);if(!result.has(key))result.set(key,[]);result.get(key).push(p)});return [...result.values()];}
function hardUnits(s){return units(s,'hard')}
function activeUnits(s){return units(s,'active')}
function relationIssues(s){upgradeRelations(s);const issues=[],pairs=new Map(),partners=new Map(s.people.map(p=>[p.id,new Set()]));
 const add=(message,ps)=>issues.push({message,ids:ps.map(p=>p.id)}),edge=(a,b)=>{if(partners.has(a)&&partners.has(b)){partners.get(a).add(b);partners.get(b).add(a)}};
 s.people.forEach(p=>{p.pairs.forEach(k=>{if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(p)});
 if(p.cat==='family'&&familyBinding(s,p)&&!p.familyName&&!p.familyStudent&&!p.familyTarget)add(p.name+'：缺少关联志愿者',[p]);
 for(const [prefix,label] of [['family','家属关联'],['partner','伴侣']]){if(prefix==='family'&&!familyBinding(s,p))continue;const name=p[prefix+'Name'],target=p[prefix+'Target'];if(name&&!target)add(p.name+'：请确认'+label+'“'+name+'”',[p,...s.people.filter(x=>x.name===name)]);if(target&&!partners.has(target))add(p.name+'：'+label+'人员不存在',[p]);if(target===p.id)add(p.name+'：不能关联自己',[p])}
 if(p.familyStudent&&familyBinding(s,p)){const candidates=s.people.filter(x=>x.id!==p.id&&normalize(x.student)===normalize(p.familyStudent)),target=s.people.find(x=>x.id===p.familyTarget);if(!target)add(p.name+'：请确认家属学号“'+p.familyStudent+'”',[p,...candidates]);else if(normalize(target.student)!==normalize(p.familyStudent))add(p.name+'：家属学号与关联人员不一致',[p,target]);}
 if(p.partnerStudent){const candidates=s.people.filter(x=>x.id!==p.id&&normalize(x.student)===normalize(p.partnerStudent));const target=s.people.find(x=>x.id===p.partnerTarget);if(!target)add(p.name+'：请确认情侣学号“'+p.partnerStudent+'”',[p,...candidates]);else if(normalize(target.student)!==normalize(p.partnerStudent))add(p.name+'：情侣学号与关联人员不一致',[p,target]);}if(p.partnerTarget)edge(p.id,p.partnerTarget);if(p.cat==='team'&&!p.teams.length)add(p.name+'：缺少团体名称',[p]);});
 pairs.forEach((ps,key)=>{if(ps.length!==2)add('情侣编号 '+key+'：应为2人，实际'+ps.length+'人',ps);else edge(ps[0].id,ps[1].id)});
 s.people.forEach(p=>{const peers=partners.get(p.id);if(p.cat==='couple'&&!p.pairs.length&&!p.partnerName&&!p.partnerStudent&&!p.partnerTarget&&!peers.size)add(p.name+'：请填写情侣姓名、情侣学号或配对编号',[p]);if(peers.size>1)add(p.name+'：关联了多位伴侣，请检查姓名或配对编号',[p,...s.people.filter(x=>peers.has(x.id))])});return issues;
}
function relationErrors(s){return [...new Set(relationIssues(s).map(i=>i.message))]}
function issueIds(s){const ids=new Set(relationIssues(s).flatMap(i=>i.ids)),us=units(s);let changed=true;while(changed){const before=ids.size;us.forEach(u=>{if(u.some(p=>ids.has(p.id)))u.forEach(p=>ids.add(p.id))});s.people.forEach(p=>{for(const prefix of ['partner','family'])if((prefix!=='family'||familyBinding(s,p))&&p[prefix+'Name']){const peers=s.people.filter(x=>x.name===p[prefix+'Name']);if(ids.has(p.id)||peers.some(x=>ids.has(x.id))){ids.add(p.id);peers.forEach(x=>ids.add(x.id))}}});changed=ids.size!==before}return ids}
function deferIssues(s){const ids=issueIds(s);s.people.forEach(p=>{if(ids.has(p.id)){p.deferred=true;p.group=null;p.reserve=false;p.independent=false;p.locked=false}});s.groups.forEach(g=>{if(ids.has(g.leader))g.leader=null;if(ids.has(g.area))g.area=null});return ids.size}
function refreshDeferred(s){const ids=issueIds(s);s.people.forEach(p=>{if(p.deferred&&!ids.has(p.id))p.deferred=false})}
function syncCoupleCategories(s){upgradeRelations(s);const peers=new Map(s.people.map(p=>[p.id,new Set()])),invalid=new Set(),pairs=new Map();const join=(a,b)=>{if(a===b||!peers.has(b)){invalid.add(a);return}peers.get(a).add(b);peers.get(b).add(a)};
 s.people.forEach(p=>{if((p.partnerName||p.partnerStudent)&&!p.partnerTarget||p.partnerStudent&&p.partnerTarget&&!s.people.some(x=>x.id===p.partnerTarget&&normalize(x.student)===normalize(p.partnerStudent)))invalid.add(p.id);if(p.partnerTarget)join(p.id,p.partnerTarget);p.pairs.forEach(key=>{if(!pairs.has(key))pairs.set(key,[]);pairs.get(key).push(p.id)})});
 pairs.forEach(ids=>{if(ids.length===2)join(ids[0],ids[1]);else ids.forEach(id=>invalid.add(id))});
 const valid=id=>{const linked=peers.get(id);if(invalid.has(id)||linked.size!==1)return false;const other=[...linked][0];return !invalid.has(other)&&peers.get(other).size===1};
 s.people.forEach(p=>{if(p.autoCoupleFrom==='normal'&&p.cat!=='couple')p.autoCoupleFrom='';if(valid(p.id)){if(p.cat==='normal'){p.cat='couple';p.autoCoupleFrom='normal'}}else if(p.autoCoupleFrom==='normal'){p.cat='normal';p.autoCoupleFrom=''}});
}
function resolveFamily(s){upgradeRelations(s);s.people.forEach(p=>{for(const prefix of ['family','partner']){if(prefix==='family'&&p.familyAbsent)continue;const student=p[prefix+'Student'];if(student){if(!p[prefix+'Target']){const matches=s.people.filter(x=>x.id!==p.id&&normalize(x.student)===normalize(student));if(matches.length===1&&(!p[prefix+'Name']||normalize(matches[0].name)===normalize(p[prefix+'Name']))){p[prefix+'Target']=matches[0].id;p[prefix+'Name']=matches[0].name}}continue}if(p[prefix+'Name']&&!p[prefix+'Target']){const matches=s.people.filter(x=>x.id!==p.id&&x.name===p[prefix+'Name']);if(matches.length===1)p[prefix+'Target']=matches[0].id;}}});syncCoupleCategories(s);}
function roleErrors(s){let errors=[];if(!s.groups.length)errors.push('请先设置小组');const used=new Map(),groupLeaders=new Map();s.groups.forEach(g=>{if(!g.name||!g.no)errors.push('小组名称和组号不能为空');if(!Number.isInteger(g.cap)||g.cap<1)errors.push(g.name+'：名额必须为正整数');const leader=s.people.find(p=>p.id===g.leader);if(!leader)errors.push(g.name+'：请选择组长');else{if(leader.deferred)errors.push(leader.name+'：关联待处理，暂不能任职');if(leader.cat!=='internal')errors.push(g.name+'：组长须来自内部名单');if(used.has(leader.id)&&used.get(leader.id)!==normalize(g.no))errors.push(leader.name+'：不能兼任不同组号的组长');if(groupLeaders.has(normalize(g.no))&&groupLeaders.get(normalize(g.no))!==leader.id)errors.push(g.no+'组：同组项目请选择同一位组长');groupLeaders.set(normalize(g.no),leader.id);if(leader.independent)errors.push(leader.name+'：独立区长不能兼任组长');used.set(leader.id,normalize(g.no))}if(g.area&&!s.people.some(p=>p.id===g.area&&p.cat==='internal'&&!p.deferred))errors.push(g.name+'：区长须来自内部名单');});hardUnits(s).forEach(u=>{if(u.length>1&&u.some(p=>p.independent))errors.push(u.map(p=>p.name).join('、')+'：独立区长有同组关系，请编入小组')});return errors;}
function validate(s,requireAssigned=false){const errors=[];s.groups.forEach(g=>{const n=s.people.filter(p=>p.group===g.id).length;if(n>g.cap)errors.push(g.name+'：超出 '+(n-g.cap)+' 人');if(g.leader){const p=s.people.find(p=>p.id===g.leader);if(p&&!s.groups.some(project=>project.id===p.group&&normalize(project.no)===normalize(g.no)&&project.leader===p.id))errors.push(p.name+'：组长必须留在指定组');}});s.people.forEach(p=>{if(p.group&&!s.groups.some(g=>g.id===p.group))errors.push(p.name+'：小组不存在');if(p.group&&p.reserve)errors.push(p.name+'：分组与储备冲突');if(p.independent&&(p.group||p.reserve))errors.push(p.name+'：独立区长不应编组或储备');if(p.cat==='family'&&(p.reserve||p.independent))errors.push(p.name+'：家属必须安排正式岗位，不能作为储备或独立管理');if(requireAssigned&&!p.group&&!p.reserve&&!p.independent)errors.push(p.name+'：尚未安排');});activeUnits(s).forEach(u=>{const positions=new Set(u.map(p=>p.independent?'independent':p.group||(p.reserve?'reserve':'pending')));if(positions.size>1)errors.push(u.map(p=>p.name).join('、')+'：绑定成员尚未全部同组')});return [...new Set(errors)];}
function placeLeaders(s){const identityErrors=identityReviewErrors(s);if(identityErrors.length)throw Error(identityErrors.join('\n'));
 const errors=roleErrors(s);if(errors.length)throw Error(errors.join('\n'));
 const candidate=copy(s),arrivals=[];
 candidate.people.forEach(p=>{p.area=candidate.groups.some(g=>g.area===p.id);if(!p.area)p.independent=false;else if(p.independent){p.group=null;p.reserve=false}});
 for(const u of hardUnits(candidate)){
  const projects=candidate.groups.filter(g=>u.some(p=>p.id===g.leader));if(!projects.length)continue;
  if(new Set(projects.map(g=>normalize(g.no))).size>1)throw Error('同一绑定组合的组长指定了不同小组');
  const ids=new Set(u.map(p=>p.id)),lead=u.find(p=>projects.some(g=>g.leader===p.id));
  const fits=g=>candidate.people.filter(p=>p.group===g.id&&!ids.has(p.id)).length+u.length<=g.cap;
  const home=projects.find(g=>g.id===lead.group&&fits(g))||projects.find(fits);
  if(!home)throw Error(projects[0].no+'组：剩余名额不足以容纳组长及绑定成员，请先调整本组');
  u.forEach(p=>{if(p.group!==home.id||p.reserve)arrivals.push(p.id);p.group=home.id;p.reserve=false;p.locked=true});
 }
 const faults=validate(candidate);if(faults.length)throw Error(faults.join('\n'));
 const moved=new Set(arrivals);s.people=[...candidate.people.filter(p=>!moved.has(p.id)),...arrivals.map(id=>candidate.people.find(p=>p.id===id))];
}
function updatePerson(s,id,patch){
 const p=s.people.find(p=>p.id===id);if(!p)throw Error('人员不存在');
 const before=copy(p),oldUnit=copy(units(s).find(u=>u.some(p=>p.id===id))||[p]);
 const allowed=['name','student','idNumber','email','cat','teams','pairs','photo','run','partnerTarget','partnerName','partnerStudent','familyTarget','familyName','familyStudent','familyTogether','familyAbsent'];
 const next={...p,...Object.fromEntries(allowed.filter(k=>Object.hasOwn(patch,k)).map(k=>[k,patch[k]]))};
 if(typeof next.familyAbsent!=='boolean')throw Error('家属参加状态无效');if(next.familyAbsent)next.familyTarget=null;
 if(next.familyTogether!==null&&typeof next.familyTogether!=='boolean')throw Error('家属同组选项无效');if(!normalize(next.name))throw Error('姓名不能为空');if(!CATS[next.cat])throw Error('人员类别无效');
 if(next.cat!=='internal'&&s.groups.some(g=>g.leader===id||g.area===id))throw Error('请先在任职页取消该人员的任职，再修改类别');
 const changed=allowed.filter(k=>JSON.stringify(before[k])!==JSON.stringify(next[k]));if(Object.hasOwn(patch,'idNumber')&&!p.idNumberEdited&&!changed.includes('idNumber'))changed.push('idNumber');if(!changed.length)return {changed:false,affected:[]};
 if(next.cat!==p.cat)next.autoCoupleFrom='';Object.assign(p,next);if(changed.includes('idNumber')){p.idNumber=cleanIdNumber(p.idNumber);p.idNumberEdited=true;delete p.idNumberReview;s.identityCheckRequired=true}if(changed.some(k=>k==='name'||k==='student'))delete p.idNumberReview;
 if(changed.every(k=>k==='email'))return {changed:true,affected:[id],allocationChanged:false};
 for(const prefix of ['partner','family'])if(changed.includes(prefix+'Student')&&!Object.hasOwn(patch,prefix+'Target'))p[prefix+'Target']=null;
 if(changed.includes('student'))s.people.forEach(x=>{for(const prefix of ['partner','family'])if(x[prefix+'Target']===id&&x[prefix+'Student'])x[prefix+'Student']=p.student});
 if(changed.includes('name'))s.people.forEach(x=>{for(const prefix of ['partner','family'])if(x[prefix+'Target']===id)x[prefix+'Name']=p.name});
 resolveFamily(s);refreshDeferred(s);
 const relationKeys=['teams','pairs','partnerTarget','partnerName','partnerStudent','familyTarget','familyName','familyStudent','familyTogether','familyAbsent'];
 const allocationChanged=changed.some(k=>k==='cat'||relationKeys.includes(k));
 if(changed.some(k=>['name','student','idNumber','cat',...relationKeys].includes(k)))delete s.confirmed.dedup;
 if(changed.some(k=>k!=='email'))delete s.confirmed.overview;
 const affected=new Set([id]);
 if(allocationChanged){
  oldUnit.forEach(x=>affected.add(x.id));units(s).filter(u=>u.some(x=>affected.has(x.id))).flat().forEach(x=>affected.add(x.id));
  const people=s.people.filter(x=>affected.has(x.id)),stages=['internal','team','couple','normal'];
  const rank=x=>x.cat==='internal'||x.cat==='family'?0:x.teams.length?1:x.cat==='couple'||x.pairs.length||x.partnerName||x.partnerStudent||x.partnerTarget?2:3;
  const first=Math.min(...[before,...oldUnit,...people].map(rank));stages.slice(first).forEach(k=>delete s.confirmed[k]);
  const teams=new Set([before,...oldUnit,...people].flatMap(x=>x.teams));s.teamDone=s.teamDone.filter(t=>!teams.has(t));
  if(people.some(x=>s.groups.some(g=>g.leader===x.id)))delete s.confirmed.roles;
  people.forEach(x=>{if(!s.groups.some(g=>g.leader===x.id))x.locked=false});
 }
 return {changed:true,affected:[...affected],allocationChanged};
}
function familyAdmissionErrors(s){const pending=s.people.filter(p=>p.cat==='family'&&!p.group);if(!pending.length)return [];const free=s.groups.reduce((n,g)=>n+Math.max(0,g.cap-s.people.filter(p=>p.group===g.id).length),0);return ['家属须全部录取为正式志愿者：还有 '+pending.length+' 人未入组（'+pending.slice(0,10).map(p=>p.name).join('、')+'）。当前空位 '+free+' 个'+(free<pending.length?'，至少还缺 '+(pending.length-free)+' 个名额':'，请检查关联或调整小组容量')+'；请在内部与家属阶段安排，不可转入储备。']}
function familyRecoveryUnit(u){return u.some(p=>p.cat==='family')&&u.every(p=>!p.group&&!p.independent&&!p.deferred)}
function eligible(u,stage,team){if(u.some(p=>p.deferred)||u.every(p=>p.independent))return false;if(stage==='internal')return u.some(p=>p.cat==='internal'||p.cat==='family');if(stage==='team')return u.some(p=>p.teams.includes(team));if(stage==='couple')return false;if(stage==='normal')return u.every(p=>p.cat!=='internal'&&p.cat!=='family'&&!p.teams.length);return false;}
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function sourceOrder(s,p){const origins=p.origins||[];const source=o=>s.sources.find(src=>src.id===o.sourceId||(!o.sourceId&&src.file===o.file&&src.sheet===o.sheet));const ordinary=['normal','couple'].includes(p.cat)?origins.filter(o=>source(o)?.type==='normal'):[];const positions=(ordinary.length?ordinary:origins).map(o=>{const i=s.sources.indexOf(source(o));return (i<0?s.sources.length:i)*10000000+(Number(o.row)||0)});return positions.length?Math.min(...positions):s.sources.length*10000000+s.people.indexOf(p)}
function withdraw(s,id,reason=''){const p=s.people.find(p=>p.id===id);if(!p)throw Error('人员不存在');s.withdrawn??=[];s.withdrawn.push({...copy(p),withdrawalReason:normalize(reason),withdrawnAt:new Date().toISOString()});s.people=s.people.filter(x=>x.id!==id);s.people.forEach(x=>{for(const key of ['partnerTarget','familyTarget'])if(x[key]===id)x[key]=null});s.groups.forEach(g=>{if(g.leader===id)g.leader=null;if(g.area===id)g.area=null});s.confirmed={};s.teamDone=[];return p}
function restoreWithdrawn(s,id){const i=(s.withdrawn||[]).findIndex(p=>p.id===id);if(i<0)throw Error('记录不存在');const p=s.withdrawn.splice(i,1)[0];delete p.withdrawalReason;delete p.withdrawnAt;delete p.idNumberReview;Object.assign(p,{group:null,reserve:false,locked:false,independent:false,area:false,deferred:false});for(const key of ['partnerTarget','familyTarget'])if(!s.people.some(x=>x.id===p[key]))p[key]=null;s.people.push(p);resolveFamily(s);s.confirmed={};s.teamDone=[]}
function allocationCandidates(s,stage,team=''){
 const leaders=new Set(s.groups.map(g=>g.leader));
 return hardUnits(s).filter(u=>eligible(u,stage,team)&&(!u.some(p=>p.locked||leaders.has(p.id))||stage==='internal'&&familyRecoveryUnit(u)&&!u.some(p=>leaders.has(p.id))));
}
// Admission is decided before packing. Couple links can change the destination, never the queue position.
function packAdmitted(s,admitted,fixed,stage,random){
 const admittedIds=new Set(admitted.map(p=>p.id)),fixedIds=new Set(fixed.map(p=>p.id)),leaders=new Set(s.groups.map(g=>g.leader));
 const counts=Object.fromEntries(s.groups.map(g=>[g.id,{n:0,internal:0,photo:0,run:0}]));
 const adjust=(g,people,sign)=>{const c=counts[g];for(const p of people){c.n+=sign;c.internal+=sign*Number(p.cat==='internal'&&!leaders.has(p.id));c.photo+=sign*Number(p.photo);c.run+=sign*Number(p.run)}};
 for(const p of fixed)adjust(p.group,[p],1);
 if(s.groups.some(g=>counts[g.id].n>g.cap))throw Error('已固定人员超过小组容量');
 const assignment={},bundles=[];
 for(const unit of units({...s,people:[...fixed,...admitted]})){
  const moving=unit.filter(p=>admittedIds.has(p.id)),homes=[...new Set(unit.filter(p=>fixedIds.has(p.id)).map(p=>p.group))];
  if(homes.length>1)return null;
  if(!moving.length)continue;
  if(homes.length){const home=homes[0],g=s.groups.find(g=>g.id===home);if(counts[home].n+moving.length>g.cap)return null;adjust(home,moving,1);moving.forEach(p=>assignment[p.id]=home)}
  else bundles.push(moving);
 }
 const score=(g,unit)=>{const c=counts[g.id];return (stage==='internal'?c.internal*200:0)+(c.n/g.cap)*20+(unit.some(p=>p.photo)?c.photo*8:0)+(unit.some(p=>p.run)?c.run*8:0)+random()};
 // Pack larger same-group bundles first; singles fill remaining places without fragmentation.
 bundles.sort((a,b)=>b.length-a.length);const groups=bundles.filter(u=>u.length>1),singles=bundles.filter(u=>u.length===1);let nodes=0;
 const search=index=>{if(index===groups.length)return true;if(++nodes>60000)return false;const unit=groups[index],seen=new Set();const options=s.groups.filter(g=>counts[g.id].n+unit.length<=g.cap).map(g=>({g,score:score(g,unit)})).sort((a,b)=>a.score-b.score);
  for(const {g} of options){const free=g.cap-counts[g.id].n;if(seen.has(free))continue;seen.add(free);adjust(g.id,unit,1);unit.forEach(p=>assignment[p.id]=g.id);if(search(index+1))return true;adjust(g.id,unit,-1);unit.forEach(p=>delete assignment[p.id])}return false};
 if(!search(0))return null;
 for(const unit of singles){const options=s.groups.filter(g=>counts[g.id].n<g.cap).map(g=>({g,score:score(g,unit)})).sort((a,b)=>a.score-b.score);if(!options.length)return null;adjust(options[0].g.id,unit,1);assignment[unit[0].id]=options[0].g.id}
 const values=Object.values(counts),spread=key=>Math.max(0,...values.map(x=>x[key]))-Math.min(...values.map(x=>x[key]));
 return {assignment,score:(stage==='internal'?spread('internal')*1000:0)+spread('photo')*30+spread('run')*30+spread('n')};
}
function allocate(s,stage,team='',seed=Date.now(),tries=80){
 if(stage==='couple')return {unplaced:[],attempts:0,batches:[]}; // Compatibility for old saved workflows; no separate priority stage.
 const identityErrors=identityReviewErrors(s);if(identityErrors.length)throw Error(identityErrors.join('\n'));
 if(stage!=='internal'&&familyAdmissionErrors(s).length)throw Error(familyAdmissionErrors(s).join('\n'));
 const errors=[...relationIssues(s).filter(i=>i.ids.some(id=>!s.people.find(p=>p.id===id)?.deferred)).map(i=>i.message),...roleErrors(s)];if(errors.length)throw Error(errors.join('\n'));
 const candidates=allocationCandidates(s,stage,team),ids=new Set(candidates.flatMap(u=>u.map(p=>p.id))),fixed=s.people.filter(p=>p.group&&!ids.has(p.id));
 const ordered=candidates.map(u=>u.slice().sort((a,b)=>sourceOrder(s,a)-sourceOrder(s,b))).sort((a,b)=>(stage==='internal'?Number(b.some(p=>p.cat==='family'))-Number(a.some(p=>p.cat==='family')):0)||sourceOrder(s,a[0])-sourceOrder(s,b[0]));
 const remaining=Object.fromEntries(s.groups.map(g=>[g.id,g.cap-fixed.filter(p=>p.group===g.id).length]));if(Object.values(remaining).some(n=>n<0))throw Error('已固定人员超过小组容量');
 const random=rng(seed);let best=null;
 for(let t=0;t<Math.max(1,tries);t++){
  const admitted=[],missed=[],spaces={...remaining};let budget=Object.values(spaces).reduce((a,b)=>a+b,0);
  for(const unit of ordered){
   if(stage==='normal'){
    if(unit.length<=budget){admitted.push(...unit);budget-=unit.length}else missed.push(...unit.map(p=>p.id));
   }else{
    const options=s.groups.filter(g=>spaces[g.id]>=unit.length).map(g=>({g,score:(1-spaces[g.id]/g.cap)*20+random()})).sort((a,b)=>a.score-b.score);
    if(options.length){admitted.push(...unit);spaces[options[0].g.id]-=unit.length}else missed.push(...unit.map(p=>p.id));
   }
  }
  const packed=packAdmitted(s,admitted,fixed,stage,random);if(!packed){if(stage==='normal')break;continue;}
  const score=missed.filter(id=>s.people.find(p=>p.id===id)?.cat==='family').length*10000000+missed.length*100000+packed.score;
  if(!best||score<best.score)best={...packed,score,missed};
 }
 if(!best)throw Error('已按顺序确定录取人员，但当前岗位空位或已固定位置无法安排已录取的情侣／绑定成员同组。请调整已有分组或名额后重试；没有跳过前面的人，也没有改动本次分配。');
 s.people.forEach(p=>{if(ids.has(p.id)){p.group=best.assignment[p.id]||null;p.reserve=stage==='normal'&&!p.group&&p.cat!=='family'}});
 const byId=new Map(s.people.map(p=>[p.id,p]));s.people=[...s.people.filter(p=>!ids.has(p.id)),...ordered.flatMap(u=>u.map(p=>byId.get(p.id)))];s.seed=seed;if(stage==='normal'){s.coupleQueueVersion=2;delete s.confirmed.couple}
 return {unplaced:best.missed,attempts:Math.max(1,tries),batches:ordered.map(u=>u.map(p=>p.id))};
}

function unlockOverview(s){s.people.forEach(p=>p.locked=false);s.overviewEditing=true;delete s.confirmed.overview;s.stage='overview'}
function finalizeOverview(s){const identityErrors=identityReviewErrors(s);if(identityErrors.length)throw Error(identityErrors.join('\n'));const errors=[...roleErrors(s),...relationErrors(s),...familyAdmissionErrors(s),...validate(s,true)];if(duplicateSets(s).length)errors.unshift('还有重复记录需要确认');if(errors.length)throw Error([...new Set(errors)].join('\n'));s.people.forEach(p=>p.locked=true);s.overviewEditing=false;s.confirmed.overview=true;s.stage='overview'}
function move(s,selected,target,anchor=null,after=false){const us=activeUnits(s),ids=new Set(us.filter(u=>u.some(p=>selected.includes(p.id))).flatMap(u=>u.map(p=>p.id))),moving=s.people.filter(p=>ids.has(p.id));if(!moving.length)throw Error('请选择人员');if(moving.some(p=>p.deferred))throw Error('请先修复待处理人员的关联，再移动');if(anchor&&ids.has(anchor))return false;const destination=p=>p.group||(p.reserve?'reserve':p.independent?'independent':'pending');const reorder=moving.every(p=>destination(p)===target);if(!reorder&&moving.some(p=>p.locked))throw Error('包含锁定人员，请先解锁');if(moving.some(p=>s.groups.some(g=>g.leader===p.id&&!s.groups.some(project=>project.id===target&&normalize(project.no)===normalize(g.no)&&project.leader===p.id))))throw Error('组长只能留在指定小组');if(moving.some(p=>p.independent)&&target!=='independent')throw Error('请先将独立区长改为编入小组');const g=s.groups.find(g=>g.id===target);if(!g&&!['pending','reserve'].includes(target))throw Error('目标小组不存在');if(target==='reserve'&&moving.some(p=>p.cat==='family'))throw Error('家属须录取为正式志愿者，不能移入储备');if(g&&s.people.filter(p=>p.group===target&&!ids.has(p.id)).length+moving.length>g.cap)throw Error('目标组容量不足，未移动任何人');const check={...s,people:s.people.map(p=>ids.has(p.id)?{...p,group:g?.id||null,reserve:target==='reserve'}:p)};const splits=activeUnits(check).filter(u=>u.some(p=>ids.has(p.id))&&new Set(u.map(p=>p.group||(p.reserve?'reserve':'pending'))).size>1);if(splits.length)throw Error('双方录取后须同组，请选择伴侣所在组，或同时选中双方移动');let remaining=s.people.filter(p=>!ids.has(p.id)),index=anchor?remaining.findIndex(p=>p.id===anchor):remaining.reduce((r,p,i)=>destination(p)===target?i+1:r,-1);if(anchor&&index<0)throw Error('排序目标不存在');if(anchor&&after)index++;if(index<0)index=remaining.length;moving.forEach(p=>{p.group=g?.id||null;p.reserve=target==='reserve';if(!reorder)p.locked=!s.overviewEditing;});s.people=[...remaining.slice(0,index),...moving,...remaining.slice(index)];delete s.confirmed.overview;return true;}
function swap(s,selected,other){
 const changed=copy(s),allUnits=activeUnits(changed),pos=p=>p.group||(p.reserve?'reserve':'pending');
 const chosen=allUnits.filter(u=>u.some(p=>selected.includes(p.id)));let a,b;
 if(other!==undefined){a=chosen.flat();b=allUnits.find(u=>u.some(p=>p.id===other));}
 else{
  if(!chosen.length)throw Error('请先在两个小组中选择要交换的人员');
  if(chosen.some(u=>new Set(u.map(pos)).size!==1))throw Error('绑定成员分散在不同位置，请先调整到同一组再交换');
  const positions=[...new Set(chosen.flat().map(pos))];
  if(positions.length!==2)throw Error(positions.length<2?'请再选择另一个小组中的人员，然后点击交换':'一次只能交换两个小组中的人员，请取消多余小组的选择');
  a=chosen.flat().filter(p=>pos(p)===positions[0]);b=chosen.flat().filter(p=>pos(p)===positions[1]);
 }
 if(!a?.length||!b?.length)throw Error('请选择交换对象');
 if(a.some(p=>b.some(q=>q.id===p.id)))throw Error('不能与同一绑定组合交换');
 const apos=new Set(a.map(pos)),bpos=new Set(b.map(pos));
 if(apos.size!==1||bpos.size!==1)throw Error('所选人员必须来自同一位置');
 const ga=[...apos][0],gb=[...bpos][0];if(ga===gb)throw Error('请选择另一个组或储备区');
 if([...a,...b].some(p=>p.deferred))throw Error('包含待处理人员，请先修复关联再交换');
 if([...a,...b].some(p=>p.locked))throw Error('包含锁定人员，请先解锁再交换');
 if([...a,...b].some(p=>p.independent||changed.groups.some(g=>g.leader===p.id)))throw Error('不能交换组长或独立区长，请在任职页面调整');
 const aset=new Set(a.map(p=>p.id)),bset=new Set(b.map(p=>p.id));
 changed.people.forEach(p=>{const target=aset.has(p.id)?gb:bset.has(p.id)?ga:null;if(target){p.group=['pending','reserve'].includes(target)?null:target;p.reserve=target==='reserve';p.locked=!changed.overviewEditing;}});
 const errors=validate(changed);if(errors.length)throw Error(errors.join('\n'));
 s.people=[...changed.people.filter(p=>!aset.has(p.id)&&!bset.has(p.id)),...changed.people.filter(p=>aset.has(p.id)||bset.has(p.id))];delete s.confirmed.overview;
}

function prepareGroups(s,rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('请至少添加一个小组');
 return rows.map((row,i)=>{const no=normalize(row.no),name=normalize(row.name),cap=Number(row.cap),region=normalize(row.region);
  if(!no||!name)throw Error('第'+(i+1)+'行：请填写组号和项目名称');
  if(!Number.isSafeInteger(cap)||cap<1)throw Error('第'+(i+1)+'行：名额须为正整数');
  const sibling=s.groups.find(g=>normalize(g.no)===no);
  return {id:uid(),no,name,cap,region,leader:sibling?.leader||null,area:sibling?.area||null};
 });
}
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
  const oldIdentity={idNumber:p.idNumber,idNumberEdited:p.idNumberEdited,idNumberReview:p.idNumberReview};const oldStudents={partner:p.partnerStudent,family:p.familyStudent};const oldRecords=p.origins.map(recordFor),remainingRecords=remaining.map(recordFor);
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
  for(const prefix of ['partner','family']){const key=prefix+'Student';if(removed.has(oldPrimary)||oldRecords.some(r=>r[key]&&r[key]===oldStudents[prefix])){p[key]=remainingRecords.find(r=>r[key])?.[key]||'';if(p[key])p[prefix+'Target']=null;else if(oldStudents[prefix]&&!remainingRecords.some(r=>r[prefix+'Name']||r[prefix+'Target'])){p[prefix+'Name']='';p[prefix+'Target']=null}}}
  if(removed.has(oldPrimary)||oldRecords.some(r=>r.familyTogether===p.familyTogether&&typeof p.familyTogether==='boolean'))p.familyTogether=familyChoice(remainingRecords);
  if(oldIdentity.idNumberEdited)Object.assign(p,oldIdentity);
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
function deleteGroup(state,id){
 const s=copy(state),group=s.groups.find(g=>g.id===id);if(!group)throw Error('该项目已不存在');
 const affected=new Set(activeUnits(s).filter(u=>u.some(p=>p.group===id)).flat().map(p=>p.id));
 s.groups=s.groups.filter(g=>g.id!==id);
 let releasedArea=0;s.people.forEach(p=>{if(affected.has(p.id)){p.group=null;p.reserve=false;p.locked=false}p.area=s.groups.some(g=>g.area===p.id);if(p.independent&&!p.area){p.independent=false;p.locked=false;releasedArea++}});
 s.sources.filter(src=>src.type==='groups').forEach(src=>{const removed=(src.records||[]).find(g=>g.id===id);if(!removed)return;src.records=src.records.filter(g=>g.id!==id);src.count=src.records.length;if(src.importSheet&&Number.isInteger(removed.importRow)){src.importSheet.excludedRows=[...new Set([...(src.importSheet.excludedRows||[]),removed.importRow])]}});
 for(const key of ['roles','internal','team','couple','normal','overview'])delete s.confirmed[key];s.teamDone=[];s.stage='roles';s.revision++;
 if(s.exportPrefs?.groups)s.exportPrefs.groups=s.exportPrefs.groups.filter(gid=>gid!==id);if(s.mailDraft?.recipients)delete s.mailDraft.recipients[id];
 return {state:s,group,returned:affected.size,releasedArea,siblings:s.groups.filter(g=>normalize(g.no)===normalize(group.no)).length};
}

function remainingPlan(state){const identityErrors=identityReviewErrors(state);if(identityErrors.length)throw Error(identityErrors.join('\n'));
 const s=copy(state),steps=[],notes=[];
 if(!s.confirmed.dedup||duplicateSets(s).length)throw Error('请先完成导入和查重确认，再一键生成剩余分配。');
 resolveFamily(s);deferIssues(s);refreshDeferred(s);
 const snapshot=label=>{s.revision++;steps.push({label,state:copy(s)})};
 if(!s.confirmed.roles){const errors=roleErrors(s);if(errors.length)throw Error('请先手动选择并确认组长：\n'+errors.join('\n'));placeLeaders(s);s.confirmed.roles=true;s.stage='internal';snapshot('全自动 · 任职');}
 if(familyAdmissionErrors(s).length){delete s.confirmed.internal;hardUnits(s).filter(familyRecoveryUnit).flat().forEach(p=>{p.reserve=false;p.locked=false})}
 const teams=[...new Set(s.people.flatMap(p=>p.teams))];
 for(const [stage,team] of [['internal',''],...teams.map(t=>['team',t]),['normal','']]){
  if(stage==='team'?s.teamDone.includes(team):s.confirmed[stage])continue;
  const result=allocate(s,stage,team);const relevant=hardUnits(s).filter(u=>eligible(u,stage,team)).flat();
  const pending=[...new Map([...relevant.filter(p=>!p.group&&!p.independent&&!(stage==='normal'&&p.reserve)),...(stage==='internal'?s.people.filter(p=>p.cat==='family'&&!p.group):[])].map(p=>[p.id,p])).values()];
  if(pending.length){notes.push((team||stage)+'：'+pending.length+' 人待人工调整');pending.forEach(p=>p.locked=true)}
  relevant.filter(p=>p.group||p.reserve).forEach(p=>p.locked=true);
  if(!pending.length){if(stage==='team')s.teamDone=[...new Set([...s.teamDone,team])];else s.confirmed[stage]=true;}
  s.confirmed.team=teams.every(t=>s.teamDone.includes(t));s.stage=stage;
  snapshot('全自动 · '+(team||({internal:'内部与家属',normal:'普通与情侣'}[stage]))+(pending.length?'（待调整）':''));
  if(stage==='internal'&&familyAdmissionErrors(s).length){notes.push(...familyAdmissionErrors(s));break}
 }
 s.stage='overview';delete s.confirmed.overview;
 const faults=validate(s);if(faults.length)throw Error(faults.join('\n'));
 snapshot('全自动分配草案 · 待最终检查');
 return {state:s,steps,notes,pending:s.people.filter(p=>!p.group&&!p.reserve&&!p.independent).length};
}

root.V={hardUnits,activeUnits,allocationCandidates,cleanIdNumber,isIdNumberHeader,identityReview,identityReviewErrors,resolveIdentityReview,familyAdmissionErrors,familyRecoveryUnit,unlockOverview,finalizeOverview,prepareGroups,familyBinding,sourceOrder,withdraw,restoreWithdrawn,remainingPlan,deleteGroup,updatePerson,copy,uid,normalize,upgradeRelations,syncCoupleCategories,CATS,blank,person,duplicateSets,markDistinct,merge,units,relationIssues,issueIds,deferIssues,refreshDeferred,relationErrors,resolveFamily,roleErrors,validate,placeLeaders,eligible,allocate,move,swap,validateFile,removeSources};
})(typeof module==='object'?module.exports:globalThis);
