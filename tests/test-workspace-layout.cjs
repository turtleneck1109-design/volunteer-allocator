const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{V}=require('../src/core.js');
const nodes=new Map();const ctx={V,console,document:{addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:''});return nodes.get(id)}},window:{addEventListener(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext(`
S=V.blank();S.groups=[{id:'a',no:'1',name:'岗位甲',cap:5,leader:'l'},{id:'b',no:'2',name:'岗位乙',cap:5},{id:'c',no:'1',name:'岗位丙',cap:5,leader:'l'}];S.people=[V.person({id:'l',name:'测试组长',cat:'internal',group:'a',locked:true,customFields:{学院:'虚构学院'},raw:{'Q1. 证件号':'001'}})];
pageSize=1;pageNo=1;if(shownGroups().map(g=>g.id).join(',')!=='a,c')throw Error('同组子岗位跨页');if(groupPage('c')!==1||groupPage('b')!==2)throw Error('分组导航错误');
const html=groupGridHtml(shownGroups());if(!html.includes('group-family')||html.split('<b>测试组长</b>').length!==2)throw Error('共同组长或成员缺失');
renderStats();if(!$('stats').innerHTML.includes('待处理')||!$('stats').innerHTML.includes('总需求'))throw Error('统计缺失');
const fields=exportFieldSections(availableColumns());if(!fields.includes('常用字段')||!fields.includes('统一字段')||!fields.includes('自定义标签')||!fields.includes('原始字段'))throw Error('字段分类缺失');
if(fields.includes('data-field-section="raw" open'))throw Error('原始字段应折叠');
exportCols=['name','custom:学院'];exportSelection=['a'];exportSpecial='reserve';S.exportWithdrawn=true;setExportColumnName('name','志愿者');saveExportPreset('联系表');exportCols=['photo'];renderExport=()=>{};toast=()=>{};applyExportPreset(S.exportPresets[0].id);
if(exportCols.join(',')!=='name,custom:学院'||exportColumnLabel('name')!=='志愿者')throw Error('导出方案未保留字段及名称');
if(exportSelection.join(',')!=='a'||exportSpecial!=='reserve'||!S.exportWithdrawn)throw Error('应用方案改变名单范围');
const restored=V.copy(S);if(restored.exportPresets.length!==1)throw Error('方案未随项目保存');
`,ctx);
console.log('通过：同组子岗位共同展示/分页/定位、统计入口、导出字段分类、保存及应用方案不改变名单范围。');
