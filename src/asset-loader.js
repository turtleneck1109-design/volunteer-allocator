/* Same-origin, on-demand export resources. Loading this module makes no requests. */
(function(root){
 'use strict';
 const pending=new Map();
 function once(key,load){if(!pending.has(key)){const task=Promise.resolve().then(load);pending.set(key,task);task.catch(()=>{if(pending.get(key)===task)pending.delete(key)})}return pending.get(key)}
 function url(key){const value=root.VolunteerAssets?.[key];if(!value)throw Error('导出资源未配置，请刷新页面后重试');return value}
 function script(key,globalName,label){
  if(root[globalName])return Promise.resolve(root[globalName]);
  return once(key,()=>new Promise((resolve,reject)=>{
   const el=document.createElement('script');let timer;
   const fail=()=>{clearTimeout(timer);el.remove();reject(Error(label+'加载失败，请检查网络后重试'))};
   el.src=url(key);el.async=true;el.onerror=fail;
   el.onload=()=>{clearTimeout(timer);if(!root[globalName])return fail();resolve(root[globalName])};
   timer=setTimeout(fail,30000);document.head.appendChild(el);
  }));
 }
 async function spreadsheet(progress=()=>{}){if(!root.XLSX)progress('正在加载 Excel 组件…');return script('xlsx','XLSX','Excel 组件')}
 function font(progress){return once('font',async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
  try{
   const response=await fetch(url('font'),{signal:controller.signal,credentials:'same-origin',cache:'default'});
   if(!response.ok)throw Error('字体下载失败');
   const total=Number(response.headers.get('content-length')),reader=response.body?.getReader();let bytes;
   if(reader){const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;progress(`正在加载 PDF 中文字体：${(size/1048576).toFixed(1)}${total?' / '+(total/1048576).toFixed(1):''} MB`)}bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}}
   else bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<12||![0x00010000,0x74727565,0x4f54544f].includes(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0)))throw Error('字体内容无效');
   return bytes;
  }catch(e){throw Error('PDF 中文字体加载失败，请检查网络后重试')}finally{clearTimeout(timer)}
 })}
 async function pdf(progress=()=>{}){
  progress('正在加载 PDF 组件和中文字体，首次使用需要下载…');
  const [PDFLib,fontkit,fontBytes]=await Promise.all([script('pdfLib','PDFLib','PDF 组件'),script('fontkit','fontkit','PDF 字体组件'),font(progress)]);
  progress('PDF 资源已就绪，正在生成点名名单…');return {PDFLib,fontkit,fontBytes};
 }
 root.AppAssets={spreadsheet,pdf};
})(globalThis);
