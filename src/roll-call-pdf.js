/* Printable, offline roll-call rosters. The caller supplies a snapshot, never live state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RollCallPdf=api})(globalThis,()=>{
 'use strict';
 const defaults=[['name','姓名'],['student','学号'],['unified:学院/单位','学院'],['unified:手机号','电话号码'],['unified:衣服尺码','服装尺寸']];
 let cachedBytes,cachedFont;
 function bands(columns){
  if(columns.length<=6)return [columns];
  const identity=columns.filter(c=>['name','student'].includes(c.key)),others=columns.filter(c=>!identity.includes(c)),out=[];
  for(let i=0;i<others.length;i+=6-identity.length)out.push([...identity,...others.slice(i,i+6-identity.length)]);
  return out;
 }
 function clean(value){return String(value??'').replace(/\r\n?/g,'\n').replace(/\t/g,' ').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'')}
 async function create(data,env={}){
  const lib=env.PDFLib||globalThis.PDFLib,kit=env.fontkit||globalThis.fontkit;
  let bytes=env.fontBytes;
  if(!bytes){if(!cachedBytes){const encoded=document.getElementById('rollCallFont')?.textContent.trim();if(!encoded)throw Error('点名 PDF 字体未加载，请使用完整项目文件');cachedBytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))}bytes=cachedBytes}
  if(!lib||!kit)throw Error('点名 PDF 组件未加载，请使用完整项目文件');
  if(!Array.isArray(data.columns)||!data.columns.length)throw Error('请至少选择一个点名 PDF 字段');
  const doc=await lib.PDFDocument.create();
  if(bytes===cachedBytes){cachedFont??=kit.create(bytes);doc.registerFontkit({create:()=>cachedFont})}else doc.registerFontkit(kit);
  const font=await doc.embedFont(bytes,{subset:true,features:{liga:false}}),supported=new Set(font.getCharacterSet());
  const missing=[...new Set(Array.from([data.activity,data.group,data.leader,data.time,...data.columns.map(c=>c.label),...data.rows.flat()].map(clean).join('')).filter(c=>c!=='\n'&&!supported.has(c.codePointAt(0))))];
  if(missing.length)throw Error('点名 PDF 字体不支持这些字符：'+missing.slice(0,12).join(' ')+'；请检查所选字段内容');
  doc.setTitle(clean(data.group)+' · 点名名单');doc.setCreator('志愿者分组');doc.setSubject('本组志愿者点名名单');
  const ink=lib.rgb(.12,.16,.2),muted=lib.rgb(.4,.44,.48),line=lib.rgb(.72,.76,.79),fill=lib.rgb(.94,.96,.97),margin=30,size=9,lineHeight=13;
  function wrap(value,width,fs=size){const result=[];for(const paragraph of clean(value).split('\n')){let current='';for(const char of paragraph){if(current&&font.widthOfTextAtSize(current+char,fs)>width){result.push(current);current=''}current+=char}result.push(current)}return result}
  const short=(value,width,fs,max)=>{const lines=wrap(value,width,fs);if(lines.length>max){lines.length=max;while(font.widthOfTextAtSize(lines[max-1]+'…',fs)>width)lines[max-1]=Array.from(lines[max-1]).slice(0,-1).join('');lines[max-1]+='…'}return lines};
  const allBands=bands(data.columns),pages=[];
  for(let bandIndex=0;bandIndex<allBands.length;bandIndex++){
   const columns=allBands[bandIndex],landscape=data.columns.length>5,[width,height]=landscape?[841.89,595.28]:[595.28,841.89],tableWidth=width-margin*2;
   const weight=key=>key==='name'?.85:key==='student'?1.25:key==='unified:手机号'?1.25:key==='unified:学院/单位'?1.65:key==='unified:衣服尺码'?.75:1.35;
   const total=columns.reduce((n,c)=>n+weight(c.key),0),widths=[28,30,...columns.map(c=>(tableWidth-58)*weight(c.key)/total)],headers=['序号','点名',...columns.map(c=>c.label)],headerLines=headers.map((h,i)=>short(h,widths[i]-10,size,4)),headerHeight=Math.max(28,Math.max(...headerLines.map(a=>a.length))*lineHeight+12);
   let page,y,bodyTop;
   function text(lines,x,top,fs=size,color=ink){lines.forEach((t,i)=>page.drawText(t,{x,y:top-fs-i*(fs+4),size:fs,font,color}))}
   function cells(lines,rowHeight,header=false){let x=margin;for(let c=0;c<widths.length;c++){page.drawRectangle({x,y:y-rowHeight,width:widths[c],height:rowHeight,borderWidth:.4,borderColor:line,...(header?{color:fill}:{})});text(lines[c]||[],x+5,y-5);x+=widths[c]}}
   function start(){page=doc.addPage([width,height]);pages.push(page);let top=height-margin;text(['点名名单'],margin,top,19);top-=31;
    const title=short(data.activity,tableWidth,11,2);text(title,margin,top,11);top-=title.length*15+3;
    const group=short(data.group+'　｜　组长：'+(data.leader||'未设置'),tableWidth,10,2);text(group,margin,top,10);top-=group.length*14+6;
    text([`本组 ${data.rows.length} 人　｜　导出时间：${data.time}`],margin,top,8,muted);top-=23;
    if(allBands.length>1){text([`字段分栏 ${bandIndex+1}/${allBands.length} · 按序号对应同一人`],margin,top,9,muted);top-=20}
    y=top;cells(headerLines,headerHeight,true);y-=headerHeight;bodyTop=y;
   }
   start();
   for(let r=0;r<data.rows.length;r++){
    const row=data.rows[r],lines=columns.map((c,i)=>wrap(row[data.columns.indexOf(c)],widths[i+2]-10)),maxLines=Math.max(1,...lines.map(a=>a.length));let offset=0;
    while(offset<maxLines){if(y-55<lineHeight+12)start();const count=Math.min(maxLines-offset,Math.max(1,Math.floor((y-55-12)/lineHeight))),h=Math.max(29,count*lineHeight+12);
     if(y-h<55&&y<bodyTop){start();continue}
     cells([[String(r+1),...(offset?['续']:[])],[],...lines.map(a=>a.slice(offset,offset+count))],h);
     if(!offset)page.drawRectangle({x:margin+28+10,y:y-19,width:10,height:10,borderWidth:.7,borderColor:muted});
     y-=h;offset+=count;
    }
   }
   if(!data.rows.length){cells([[],[],['暂无人员'],...columns.slice(1).map(()=>[])],32);y-=32}
  }
  pages.forEach((p,i)=>{const footer=`第 ${i+1} / ${pages.length} 页`;p.drawText(footer,{x:p.getWidth()-margin-font.widthOfTextAtSize(footer,8),y:25,size:8,font,color:muted});p.drawText('点名：到场后在方框内勾选', {x:margin,y:25,size:8,font,color:muted})});
  return doc.save();
 }
 return {defaults,bands,create};
});
