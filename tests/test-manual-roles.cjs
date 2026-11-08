const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{V}=require('../src/core.js');
const s=V.blank();s.confirmed.dedup=true;s.groups=[{id:'a',no:'1',name:'岗位甲',cap:4},{id:'b',no:'1',name:'岗位乙',cap:4},{id:'c',no:'2',name:'岗位丙',cap:4}];
s.people=[V.person({id:'l',name:'甲',cat:'internal',intent:'不报名'}),V.person({id:'m',name:'乙',cat:'internal',intent:'是'}),V.person({id:'n',name:'丙',cat:'internal',intent:'报名小组长'}),V.person({id:'x',name:'普通',group:'c',locked:true})];
assert.throws(()=>V.remainingPlan(s),/手动选择/);assert(s.groups.every(g=>!g.leader));
const nodes=new Map();const ctx={V,console,document:{addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:''});return nodes.get(id)}},window:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);ctx.state=s;
vm.runInContext(`
S=V.copy(state);renderRoles();const html=$('mainContent').innerHTML;
for(const id of ['l','m','n'])if(!html.includes('value="'+id+'"'))throw Error('内部人员未列入手选');
if(html.includes('自动分配组长')||html.includes('全部内部人员'))throw Error('旧入口仍存在');
render=()=>{};setRole('a','leader','l');setRole('c','leader','m');
if(S.groups[1].leader!=='l')throw Error('同组岗位未同步');
V.placeLeaders(S);const ordinary=S.people.find(p=>p.id==='x');if(ordinary.group!=='c'||!ordinary.locked)throw Error('重新确认清空无关安排');
const before=JSON.stringify(S.people);V.placeLeaders(S);if(JSON.stringify(S.people)!==before)throw Error('重复确认改动顺序或分组');
if(templateRows(false).内部人员[0].some(h=>/报名|是否小组长/.test(h)))throw Error('模板仍有报名字段');
if('intent' in inferMap(['姓名','是否小组长']))throw Error('仍匹配已删除字段');
`,ctx);
console.log('通过：所有内部人员手选组长、同组同步、禁止自动选组长、重复确认保留既有分配及顺序、移除报名字段。');
