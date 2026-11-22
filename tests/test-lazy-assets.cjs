const fs=require('fs'),vm=require('vm'),assert=require('assert'),cp=require('child_process'),path=require('path'),crypto=require('crypto');
const libs={XLSX:require('../vendor/xlsx.full.min.js'),PDFLib:require('../vendor/pdf-lib.min.js'),fontkit:require('../vendor/fontkit.umd.min.js')};
const fontBytes=fs.readFileSync('vendor/NotoSansSC-Regular.ttf');
function fixture(){
 const requests=[],timers=new Map();let timerId=0,failFont=false,scriptMode='ok';
 const ctx={Uint8Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,AbortController,console,VolunteerAssets:{xlsx:'xlsx.js',pdfLib:'pdf.js',fontkit:'fontkit.js',font:'font.ttf'},setTimeout(fn,ms){if(ms<30000)return setTimeout(fn,ms);timers.set(++timerId,{fn,ms});return timerId},clearTimeout(id){if(!timers.delete(id))clearTimeout(id)},document:{createElement(){return {remove(){this.removed=true}}},head:{appendChild(el){requests.push(el.src);queueMicrotask(()=>{if(scriptMode==='hang')return;if(scriptMode==='fail')return el.onerror();const name={'xlsx.js':'XLSX','pdf.js':'PDFLib','fontkit.js':'fontkit'}[el.src];vm.runInContext(fs.readFileSync({XLSX:'vendor/xlsx.full.min.js',PDFLib:'vendor/pdf-lib.min.js',fontkit:'vendor/fontkit.umd.min.js'}[name],'utf8'),ctx);el.onload()})}}},fetch:async url=>{requests.push(url);return {ok:!failFont,headers:{get(){return String(fontBytes.length)}},arrayBuffer:async()=>fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.length)}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/asset-loader.js','utf8'),ctx);
 return {ctx,requests,timers,set failFont(v){failFont=v},set scriptMode(v){scriptMode=v}};
}
(async()=>{
 let f=fixture();assert.equal(f.requests.length,0,'startup must not fetch export assets');
 await Promise.all([f.ctx.AppAssets.spreadsheet(),f.ctx.AppAssets.spreadsheet()]);assert.deepEqual(f.requests,['xlsx.js']);
 await Promise.all([f.ctx.AppAssets.pdf(),f.ctx.AppAssets.pdf()]);assert.deepEqual(f.requests,['xlsx.js','pdf.js','fontkit.js','font.ttf']);
 await f.ctx.AppAssets.pdf();assert.equal(f.requests.length,4);assert.equal(f.timers.size,0);
 vm.runInContext(fs.readFileSync('src/roll-call-pdf.js','utf8'),f.ctx);
 const bytes=await f.ctx.RollCallPdf.create({activity:'测试',group:'1组',leader:'',time:'2026-11-22',columns:[{key:'name',label:'姓名'}],rows:[['测试；']]});
 assert.equal((await libs.PDFLib.PDFDocument.load(bytes)).getPageCount(),1);assert.equal(f.requests.length,4);
 // Failed font download retries only that resource, not the already loaded PDF engines.
 f=fixture();f.failFont=true;await assert.rejects(f.ctx.AppAssets.pdf(),/字体加载失败/);f.failFont=false;await f.ctx.AppAssets.pdf();assert.equal(f.requests.filter(s=>s==='font.ttf').length,2);assert.equal(f.requests.filter(s=>s==='pdf.js').length,1);
 // Script errors and timeouts release the in-flight cache for retry.
 f=fixture();f.scriptMode='fail';await assert.rejects(f.ctx.AppAssets.spreadsheet(),/加载失败/);f.scriptMode='ok';await f.ctx.AppAssets.spreadsheet();assert.equal(f.requests.length,2);
 f=fixture();f.scriptMode='hang';const waiting=f.ctx.AppAssets.spreadsheet();await new Promise(r=>setImmediate(r));const timed=[...f.timers.values()][0];timed.fn();await assert.rejects(waiting,/加载失败/);f.scriptMode='ok';await f.ctx.AppAssets.spreadsheet();assert.equal(f.requests.length,2);
 // Host build contains only local, content-addressed assets; no eagerly loaded libraries/font.
 cp.execFileSync('python3',['scripts/build.py','--web']);
 const html=fs.readFileSync('_site/index.html','utf8'),appPath=html.match(/<script defer src="([^"]+)"/)[1],cssPath=html.match(/<link rel="stylesheet" href="([^"]+)"/)[1],bundle=fs.readFileSync(path.join('_site',appPath),'utf8');
 assert(!html.includes('rollCallFont'));assert(!html.includes('base64'));assert(!html.includes('pdf-lib'));assert(!html.includes('preload'));
 const manifest=JSON.parse(bundle.match(/globalThis.VolunteerAssets=(\{[^\n]+\});/)[1]);
 for(const url of [appPath,cssPath,...Object.values(manifest)]){const content=fs.readFileSync(path.join('_site',url));assert(url.includes(crypto.createHash('sha256').update(content).digest('hex').slice(0,16)))}
 const total=Buffer.byteLength(html)+Buffer.byteLength(bundle)+fs.statSync(path.join('_site',cssPath)).size;assert(total<400000);
 // Run the actual web bundle through a successful blank-project boot without any export globals.
 const nodes=new Map(),web={console,setTimeout,clearTimeout,localStorage:{getItem(){return null}},document:{addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}}});return nodes.get(id)},createElement(){throw Error('unexpected asset request during boot')}},window:{addEventListener(){}},indexedDB:{open(){const req={};queueMicrotask(()=>{req.result={close(){},transaction(){return {objectStore(){return {get(){const read={};queueMicrotask(()=>read.onsuccess());return read}}}}}};req.onsuccess()});return req}}};
 vm.createContext(web);vm.runInContext(bundle,web);await new Promise(r=>setImmediate(r));assert.equal(vm.runInContext('startupStatus',web),'ready');assert(nodes.get('nav').innerHTML.includes('普通与情侣'));assert(nodes.get('mainContent').innerHTML.includes('上传名单'));assert(!web.XLSX&&!web.PDFLib&&!web.fontkit);
 // A first spreadsheet action loads only SheetJS, then the existing import/export code works.
 const webRequests=[];web.document.createElement=()=>({remove(){}});web.document.head={appendChild(el){webRequests.push(el.src);queueMicrotask(()=>{vm.runInContext(fs.readFileSync(path.join('_site',el.src),'utf8'),web);el.onload()})}};
 vm.runInContext('toast=()=>{};modal=()=>{};closeModal=()=>{};errorBox=e=>{throw e};download=()=>{};',web);web.document.querySelector=()=>null;
 await vm.runInContext('downloadTemplates(false)',web);assert.deepEqual(webRequests,[manifest.xlsx]);assert(!web.PDFLib&&!web.fontkit);
 const sheets=vm.runInContext(`const sampleBook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(sampleBook,XLSX.utils.aoa_to_sheet([['姓名','学号'],['演示人员','00123']]),'普通');workbookSheets(XLSX.write(sampleBook,{bookType:'xlsx',type:'array'}),'普通名单.xlsx')`,web);
 assert.equal(sheets[0].rows[1][1],'00123');
 console.log(`通过：零启动导出请求、并发去重、连续导出复用、加载失败重试、超时恢复、真实延迟加载PDF、散列资源、无导出组件启动（${total}字节）。`);
})().catch(e=>{console.error(e);process.exitCode=1});
