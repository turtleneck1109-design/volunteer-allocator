const vm=require('vm'),fs=require('fs'),assert=require('assert');
let click,callback,finish,buttons=[];
function button(id,action,label){const classes=new Set();return {id,textContent:label,isConnected:true,disabled:false,classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},getAttribute:k=>k==='onclick'?action:null,closest:()=>null,matches:()=>false,getClientRects:()=>[{}]}}
const document={body:{},addEventListener:(name,fn)=>{if(name==='click')click=fn},getElementById:id=>buttons.find(b=>b.id===id),querySelectorAll:sel=>sel==='button'?buttons:buttons.filter(b=>b.classList.contains('button-success-active'))};
const ctx={document,Date,setTimeout:fn=>{finish=fn;return 1},clearTimeout(){},queueMicrotask:fn=>fn(),MutationObserver:class{constructor(fn){callback=fn}observe(){}disconnect(){}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../src/button-feedback.js','utf8'),ctx);
let original=button('','confirmStage()','确认并继续 →');buttons=[original];click({target:{closest:()=>original}});assert(!original.classList.contains('button-success-active'));ctx.ButtonFeedback.success();assert(original.classList.contains('button-success-active'));assert.equal(original.textContent,'确认并继续 →');
original.isConnected=false;const replacement=button('','confirmStage()','重新确认并保存 →');buttons=[replacement];callback();assert(replacement.classList.contains('button-success-active'));finish();assert(!replacement.classList.contains('button-success-active'));
click({target:{closest:()=>replacement}});ctx.ButtonFeedback.fail();ctx.ButtonFeedback.success();assert(!replacement.classList.contains('button-success-active'));
console.log('通过：点击不误报成功、成功覆盖原按钮、文字保留、重绘后覆盖新按钮、结束恢复、失败不显示绿色勾选。');
