const assert=require('node:assert/strict'),{V}=require('../src/core.js');
for(const order of [['a','b','c','d'],['c','b','d','a'],['b','a','d','c']]){
 const s=V.blank(),rows={a:V.person({id:'a',name:'同名测试',student:'001'}),b:V.person({id:'b',name:'同名测试',student:'002'}),c:V.person({id:'c',name:'同名测试',student:'001'}),d:V.person({id:'d',name:'同名测试',student:'002'})};
 s.people=order.map(id=>rows[id]);V.markDistinct(s,['a','b']);
 const sets=V.duplicateSets(s).map(g=>g.map(p=>p.id).sort().join(','));assert.deepEqual(sets.sort(),['a,c','b,d']);
 const before=JSON.stringify(s);assert.throws(()=>V.merge(s,['a','b','c'],'a'),/不同的人/);assert.equal(JSON.stringify(s),before);
 V.merge(s,['a','c'],'c');V.merge(s,['b','d'],'d');assert.deepEqual(V.duplicateSets(s),[]);assert(s.distinct.includes('c|d'));
 const restored=V.validateFile(V.copy(s));restored.people.push(V.person({id:'e',name:'同名测试',student:'001'}));assert.deepEqual(V.duplicateSets(restored).map(g=>g.map(p=>p.id).sort()),[['c','e']]);
}
const s=V.blank();s.people=['a','b','c'].map(id=>V.person({id,name:'无学号同名'}));V.markDistinct(s,['a','b']);assert(V.duplicateSets(s).every(g=>!(g.some(p=>p.id==='a')&&g.some(p=>p.id==='b'))));
console.log('通过：同名不同人不可传递合并、优先关联同学号、保留来源变更后继承区别、项目保存重开保留区别。');
