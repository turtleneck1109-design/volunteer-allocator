const fs=require('fs'),vm=require('vm'),assert=require('assert'),{V}=require('../src/core.js'),XLSX=require('../vendor/xlsx.full.min.js');
const ctx={V,XLSX,console,document:{addEventListener(){}},window:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext(`
const headers=['Q2. 请确定是否按时参加此次活动','Q3. 您的学号','Q4. 您的姓名','Q5. 您的姓名拼音','Q6. 您的性别','Q13. 您的邮箱','是否报名摄影志愿者','是否报名小闪电','请填写情侣姓名','关联志愿者姓名'];
const m=inferMap(headers);if(m.name!==2||m.student!==1||m.email!==5||m.photo!==6||m.run!==7||m.partner!==8||m.family!==9)throw Error('列名包含匹配失败 '+JSON.stringify(m));
if(inferMap(['您的姓名拼音','您的情侣姓名','情侣性别']).name!==-1||inferMap(['情侣性别']).partner!==-1||inferMap(['是否按时参加活动']).photo!==-1)throw Error('误匹配');
if(!bool('是')||bool('否')||bool('不是')||!bool(' YES '))throw Error('是/否识别失败');
const sheet={header:0,type:'couple',name:'情侣',file:'虚构测试.xlsx',map:m,rows:[headers,['是','0001','测试甲','Jia','男','test@example.com','否','是','测试乙','']]};
const parsed=parseSheet(sheet)[0];if(parsed.partnerName!=='测试乙'||parsed.photo||!parsed.run||parsed.name!=='测试甲')throw Error('情侣姓名/标志导入失败');
if(recommendedRecord([{id:'n',cat:'normal'},{id:'t',cat:'team'}])!=='t'||recommendedRecord([{id:'n',cat:'normal'},{id:'c',cat:'couple'}])!=='c')throw Error('查重优先级错误');
console.log('通过：问卷列名匹配、不误选拼音/性别/出席字段、情侣两种姓名列、是/否与查重建议。');
S=V.blank();S.name='界面测试 · 虚构数据';S.stage='internal';page='internal';
S.groups=[{id:'g1',no:'1',name:'起点服务',cap:15,region:'起点',leader:'l1',area:null},{id:'g2',no:'2',name:'赛道补给',cap:15,region:'赛道',leader:'l2',area:null}];
S.people=[V.person({id:'l1',name:'测试组长甲',cat:'internal',intent:'小组长',group:'g1',locked:true}),V.person({id:'l2',name:'测试组长乙',cat:'internal',intent:'小组长',group:'g2',locked:true}),...Array.from({length:8},(_,i)=>V.person({id:'i'+i,name:'内部测试'+(i+1),cat:'internal',student:'I00'+i,photo:i===1,run:i===2,raw:{姓名:'内部测试'+(i+1),学院:'测试学院'}})),V.person({id:'t1',name:'团体测试甲',cat:'team',teams:['测试学生会']}),V.person({id:'t2',name:'团体测试乙',cat:'team',teams:['测试学生会']}),V.person({id:'bad',name:'待处理测试甲',cat:'couple',partnerName:'未找到姓名',teams:['待处理团体']}),V.person({id:'linked',name:'待处理关联乙',cat:'team',teams:['待处理团体']}),V.person({id:'normal',name:'普通测试甲'})];
V.resolveFamily(S);V.deferIssues(S);S.confirmed={import:true,dedup:true,roles:true};
const pending={id:'fake-sheet',fileId:'fake-file',file:'虚构问卷测试.xlsx',name:'普通志愿者',type:'normal',header:0,merges:[],map:inferMap(headers),rows:[headers,...Array.from({length:35},(_,i)=>['是','N'+i,'虚构人员'+(i+1),'Test','女','person@example.com',i%2?'是':'否',i%3?'否':'是','',''])]};
globalThis.fixture={format:'volunteer-project',version:1,state:V.copy(S),pendingImports:[pending],snapshots:[]};
const next=V.copy(S);V.allocate(next,'internal','',5);if(next.people.filter(p=>p.cat==='internal'&&!p.group).length)throw Error('暂存后阻挡其他分配');if(next.people.find(p=>p.id==='bad').group||next.people.find(p=>p.id==='linked').group)throw Error('异常被分配');
if(!V.validate(next,true).length)throw Error('未解决异常误判最终完成');
const html=pendingHtml(S.people.filter(p=>!p.group&&!p.deferred));if(html.indexOf('内部测试1')>html.indexOf('其他人员')||!html.includes('团体测试甲'))throw Error('阶段优先列表错误');
`,ctx);
fs.writeFileSync(__dirname+'/feedback-fixture.json',JSON.stringify(ctx.fixture));
let s=V.copy(ctx.fixture.state);assert.deepEqual([...V.issueIds(s)].sort(),['bad','linked']);assert.throws(()=>V.move(s,['bad'],'g1'),/先修复/);
s.people.find(p=>p.id==='bad').partnerName='普通测试甲';V.resolveFamily(s);V.refreshDeferred(s);assert.equal(V.relationErrors(s).length,0);assert(s.people.every(p=>!p.deferred));assert.equal(s.people.find(p=>p.id==='normal').cat,'couple');
s=V.blank();s.people=[V.person({id:'a',name:'甲',cat:'couple',partnerName:'乙'}),V.person({id:'b',name:'乙'}),V.person({id:'c',name:'乙'}),V.person({id:'d',name:'家属',cat:'family',familyTarget:'b'})];V.resolveFamily(s);assert.deepEqual([...V.issueIds(s)].sort(),['a','b','c','d']);
s.people[0].partnerTarget='c';V.resolveFamily(s);assert.equal(V.relationErrors(s).length,0);
console.log('通过：异常关联扩散标记、暂存后继续分配、禁止异常混入小组、最终检查、修复自动释放、待分配阶段优先、重名关联候选及家属标记。');
vm.runInContext(`
for(const [file,name,type,recognized] of [['2026情侣招募.xlsx','Sheet1','couple',true],['学生会报名.xlsx','Sheet1','team',true],['普通志愿者.csv','Sheet1','normal',true],['内部名单.xlsx','家属人员','family',true],['总表.xlsx','Sheet1','normal',false],['情侣及家属.xlsx','Sheet1','normal',false]]){const hint=inferCategory(file,name);if(hint.type!==type||hint.recognized!==recognized)throw Error('文件类别识别失败 '+file)}
const oldPending={file:'情侣名单.xlsx',name:'Sheet1',type:'normal',typeConfirmed:false};initializeImportCategory(oldPending);if(oldPending.type!=='couple'||!oldPending.typeConfirmed)throw Error('待导入表格未自动变绿');
const manual={file:'情侣名单.xlsx',name:'Sheet1',type:'family',typeConfirmed:true};initializeImportCategory(manual);if(manual.type!=='family')throw Error('覆盖了手动选择');
console.log('通过：文件名识别、工作表优先、模糊类别标黄、已加载表格识别、保留手动选择。');
`,ctx);
vm.runInContext(`
S=V.blank();const previewSheet={id:'preview',type:'groups',header:0,map:{no:-1,groupName:1,cap:2,region:0},merges:[{s:{r:1,c:0},e:{r:2,c:0}}],rows:[['区域','岗位名称','名额'],['起点','岗位甲',10],['','岗位乙',20]]};const previewBefore=JSON.stringify(previewSheet),previewRecords=parseSheet(previewSheet);const updated=prepareGroupImport(previewSheet,previewRecords,[{no:'3',name:'新岗位甲',cap:'12',region:'新区甲'},{no:'3',name:'新岗位乙',cap:'18',region:'新区乙'}]);if(JSON.stringify(previewSheet)!==previewBefore)throw Error('预览污染原表');const reopened=parseSheet(updated.sheet);if(reopened.map(g=>g.no).join(',')!=='3,3'||reopened[0].name!=='新岗位甲'||reopened[0].cap!==12||reopened[1].region!=='新区乙')throw Error('弹窗编辑未保存或被合并单元格覆盖');let failed=false;try{prepareGroupImport(previewSheet,previewRecords,[{no:'1',name:'甲',cap:0},{no:'2',name:'乙',cap:4}])}catch(e){failed=true}if(!failed)throw Error('允许无效名额');console.log('通过：小组确认弹窗编辑、重复组号、区域独立修改、重新打开保持修改、原表隔离、无效名额校验。');
`,ctx);

vm.runInContext(`
for(const header of ['Q2. 您情侣的姓名','Q2. 您的情侣的姓名','请填写您的伴侣的姓名','另一半的姓名']){const mapping=inferMap([header,'Q3. 您的姓名']);if(mapping.partner!==0||mapping.name!==1)throw Error('问卷姓名识别失败 '+header)}
if(inferMap(['Q2. 关联志愿者的姓名']).family!==0)throw Error('家属关联表述未匹配');
if(inferMap(['Q2. 您情侣的性别']).partner!==-1||inferMap(['Q2. 您情侣的姓名拼音']).name!==-1)throw Error('误匹配非姓名字段');
console.log('通过：情侣的姓名、伴侣的姓名、另一半的姓名、关联志愿者的姓名自动匹配，且不占用本人姓名列。');
`,ctx);
vm.runInContext(`
for(const value of ['报名','已报名','我要报名摄影志愿者','报名小闪电'])if(!bool(value))throw Error('报名未识别：'+value);
for(const value of ['不报名','未报名','暂不报名','取消报名','否','不愿报名','考虑报名'])if(bool(value))throw Error('否定误识别：'+value);
S=V.blank();const excluded={type:'groups',header:0,merges:[],excludedRows:[2],map:{no:0,groupName:1,cap:2,region:-1},rows:[['组号','名称','名额'],['1','已删除项目',2],['1','保留项目',3]]};if(parseSheet(excluded).length!==1||parseSheet(excluded)[0].name!=='保留项目')throw Error('修改导入恢复了已删除项目');
console.log('通过：报名表述识别、否定优先排除、修改导入保留删除状态。');
`,ctx);
vm.runInContext(`
const columns=['name','student','group','role'];if(reorderedColumns(columns,'name','group',true).join(',')!=='student,group,name,role')throw Error('向后拖拽错误');if(reorderedColumns(columns,'role','name',false).join(',')!=='role,name,student,group')throw Error('向前拖拽错误');if(reorderedColumns(columns,'name','name',true).join(',')!==columns.join(','))throw Error('原地拖拽错误');console.log('通过：列标签前后拖拽、原地放回、原数组保持。');
`,ctx);
