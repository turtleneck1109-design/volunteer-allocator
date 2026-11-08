const assert=require('node:assert/strict'),{V}=require('../src/core.js');
function fixture(){const s=V.blank();s.confirmed={import:true,dedup:true,roles:true,internal:true,team:true,couple:true,normal:true,overview:true};s.teamDone=['甲队','乙队'];s.groups=[{id:'g',no:'1',name:'岗位',cap:10,leader:'l'}];s.people=[V.person({id:'l',name:'组长',cat:'internal',group:'g',locked:true}),V.person({id:'p',name:'人员',email:'old@example.test',group:'g',locked:true}),V.person({id:'q',name:'另一人',group:'g',locked:true})];return s}
let s=fixture(),flags=V.copy(s.confirmed),before=s.people.map(p=>[p.id,p.group,p.locked]);
V.updatePerson(s,'p',{email:'new@example.test'});assert.deepEqual(s.confirmed,flags);assert.deepEqual(s.people.map(p=>[p.id,p.group,p.locked]),before);assert.equal(s.people[1].email,'new@example.test');
V.placeLeaders(s);assert.deepEqual(s.people.map(p=>[p.id,p.group,p.locked]),before);
s=fixture();V.updatePerson(s,'p',{student:'corrected'});assert(!s.confirmed.dedup);assert(s.confirmed.roles);assert(s.confirmed.normal);assert(s.people.every(p=>p.locked));
s=fixture();V.updatePerson(s,'p',{partnerName:'另一人',partnerTarget:'q',cat:'couple'});assert(!s.confirmed.couple);assert(!s.confirmed.normal);assert(!s.confirmed.overview);assert(s.confirmed.roles&&s.confirmed.internal);assert.deepEqual(s.teamDone,['甲队','乙队']);assert(s.people[0].locked);assert(s.people.slice(1).every(p=>p.group==='g'&&!p.locked));
V.updatePerson(s,'q',{name:'更正姓名'});assert.equal(s.people[1].partnerName,'更正姓名');
s=fixture();assert.throws(()=>V.updatePerson(s,'l',{cat:'normal'}),/取消.*任职/);assert.equal(s.people[0].cat,'internal');
s=fixture();assert.throws(()=>V.updatePerson(s,'p',{name:''}),/不能为空/);assert.equal(s.people[1].name,'人员');
console.log('通过：邮箱修改保留全部确认/锁定/分组、身份核对不重排、关联变更仅解锁相关人员、任职类别保护、姓名联动。');
const fs=require('node:fs'),vm=require('node:vm'),nodes=new Map();
const ctx={V,console,FormData:class{constructor(data){this.data=data}get(key){return this.data[key]??''}has(key){return Boolean(this.data[key])}},document:{addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)}},window:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);ctx.fixture=fixture();
vm.runInContext(`(async()=>{
 S=V.copy(fixture);modal=()=>{};personInfo=()=>'';render=()=>{};closeModal=()=>{};saveSnapshot=async()=>true;errorBox=e=>{throw e};
 const flags=JSON.stringify(S.confirmed),locations=JSON.stringify(S.people.map(p=>[p.id,p.group,p.locked]));
 editPerson('p');await $('personForm').onsubmit({preventDefault(){},target:{name:'人员',email:'changed@example.test',cat:'normal'}});
 if(JSON.stringify(S.confirmed)!==flags||JSON.stringify(S.people.map(p=>[p.id,p.group,p.locked]))!==locations)throw Error('编辑表单破坏已有确认或安排');
 if(personOf('p').email!=='changed@example.test')throw Error('编辑表单未保存邮箱');
 console.log('通过：人员编辑保存事件实际调用保留确认和位置，邮箱更新正确。');
})()`,ctx).catch(e=>{console.error(e);process.exitCode=1});
