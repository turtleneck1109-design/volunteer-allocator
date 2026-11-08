const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{V}=require('../src/core.js');
const nodes=new Map(),members={innerHTML:'',scrollTop:70,scrollLeft:12};
const input={value:'',selectionStart:1,selectionEnd:3,focusCalls:0,focus(){this.focusCalls++}};
nodes.set('search',input);
nodes.set('mainContent',{set innerHTML(value){throw Error('搜索不得重新创建整个工作区')}});
const card={dataset:{drop:'g'},querySelector(){return members}};
const ctx={V,assert,console,document:{addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:false});return nodes.get(id)},querySelectorAll(selector){return selector==='.group-card[data-drop]'?[card]:[]}},window:{addEventListener(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext(`
S=V.blank();page='overview';S.groups=[{id:'g',no:'1',name:'起点',cap:10},{id:'g2',no:'2',name:'终点',cap:10}];
S.people=[
 V.person({id:'a',name:'张甲',student:'001',group:'g',locked:true}),
 V.person({id:'b',name:'张乙',student:'002',group:'g2',cat:'team',teams:['测试团体']}),
 V.person({id:'c',name:'张丙',student:'003'}),
 V.person({id:'d',name:'张丁',student:'004',reserve:true}),
 V.person({id:'e',name:'张戊',student:'005',deferred:true}),
 V.person({id:'f',name:'张己',student:'006',independent:true,cat:'internal'}),
 V.person({id:'g',name:'Alex',student:'AB007'})
];S.withdrawn=[V.person({id:'w',name:'张退出'})];S.confirmed={roles:true,normal:true};
const before=JSON.stringify(S);bindDrag=()=>{};
const originalInput=$('search');originalInput.value='张';searchInput({target:originalInput});
assert.equal($('search'),originalInput);assert.equal(originalInput.selectionStart,1);assert.equal(originalInput.selectionEnd,3);assert.equal(originalInput.focusCalls,0);
assert.equal($('searchCount').textContent,'找到 6 人');assert.equal($('searchResultsButton').hidden,false);
assert.equal(searchResults().length,6);assert.ok($('deferredPool').innerHTML.includes('张戊'));
assert.ok($('pendingMembers').innerHTML.includes('张丙'));assert.ok($('reserveMembers').innerHTML.includes('张丁'));
filter='team';refreshCards();assert.equal($('searchCount').textContent,'找到 1 人');assert.ok(!$('deferredPool').innerHTML.includes('张戊'));
let destination='';locateSearchResult=id=>{destination=id};jumpToSearch();assert.equal(destination,'b');assert.equal(filter,'team');
filter='';query='  ａＬｅＸ  ';refreshCards();assert.equal(searchResults()[0].id,'g');
query=' ａｂ００７ ';refreshCards();assert.equal(searchResults()[0].id,'g');
query='不存在';refreshCards();assert.equal($('searchCount').textContent,'找到 0 人');assert.equal($('searchResultsButton').hidden,true);
query='张';refreshCards();searchComposing=true;originalInput.value='zhang';searchInput({target:originalInput,isComposing:true});assert.equal(query,'zhang');assert.equal($('searchCount').textContent,'找到 0 人');
let prevented=0;destination='';searchKeydown({key:'Enter',isComposing:true,preventDefault(){prevented++}});assert.equal(destination,'');assert.equal(prevented,0);
originalInput.value='张甲';searchCompositionEnd({target:originalInput,isComposing:true});assert.equal(query,'张甲');assert.equal($('searchCount').textContent,'找到 1 人');
searchKeydown({key:'Enter',keyCode:229,preventDefault(){prevented++}});assert.equal(destination,'');
searchKeydown({key:'Enter',target:originalInput,preventDefault(){prevented++}});assert.equal(destination,'a');assert.equal(prevented,1);
// Missing/stale composition-end: a normal input or keyup must commit the current text.
searchComposing=true;originalInput.value='张乙';searchInput({target:originalInput,isComposing:false});assert.equal(query,'张乙');assert.equal(searchComposing,false);
assert.equal($('searchCount').textContent,'找到 1 人');assert.equal(shownGroups().map(g=>g.id).join(','),'g2');assert.ok($('groupArea').innerHTML.includes('终点'));assert.ok(!$('groupArea').innerHTML.includes('起点'));
searchComposing=true;originalInput.value='张丙';searchKeyup({target:originalInput,key:'ArrowRight',isComposing:false});assert.equal(query,'张丙');assert.equal(searchComposing,false);assert.equal($('searchCount').textContent,'找到 1 人');assert.equal(shownGroups().length,0);
pageSize=1;pageNo=4;originalInput.value='张乙';searchInput({target:originalInput});assert.equal(pageNo,1);assert.equal(groupPage('g2'),1);assert.equal(shownGroups()[0].id,'g2');
clearSearch();assert.equal(query,'');assert.equal(originalInput.value,'');assert.equal($('searchCount').textContent,'共 7 人');assert.equal($('clearSearchButton').hidden,true);
assert.equal(JSON.stringify(S),before);
`,ctx);
console.log('通过：搜索保留输入节点/光标、中文合成输入不被打断、回车候选保护、全名单实时计数、来源筛选一致、跨页匹配小组直接展示、合成结束及补发事件同步全文、清空搜索不改分配。');
