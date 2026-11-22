/* Printable, offline roll-call rosters. The caller supplies a snapshot, never live state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RollCallPdf=api})(globalThis,()=>{
 'use strict';
 const defaults=[['name','姓名'],['student','学号'],['unified:手机号','电话号码'],['unified:衣服尺码','服装尺寸']];
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
  const ink=lib.rgb(.12,.16,.2),muted=lib.rgb(.4,.44,.48),line=lib.rgb(.72,.76,.79),fill=lib.rgb(.94,.96,.97),margin=26,bottom=36;
  let size=9,lineHeight=10.5,padding=1.5;
  function wrap(value,width,fs=size){const result=[];for(const paragraph of clean(value).split('\n')){let current='';for(const char of paragraph){if(current&&font.widthOfTextAtSize(current+char,fs)>width){result.push(current);current=''}current+=char}result.push(current)}return result}
  const short=(value,width,fs,max)=>{const lines=wrap(value,width,fs);if(lines.length>max){lines.length=max;while(font.widthOfTextAtSize(lines[max-1]+'…',fs)>width)lines[max-1]=Array.from(lines[max-1]).slice(0,-1).join('');lines[max-1]+='…'}return lines};
  const allBands=bands(data.columns),pages=[];
  for(let bandIndex=0;bandIndex<allBands.length;bandIndex++){
   const columns=allBands[bandIndex],landscape=data.columns.length>5,[width,height]=landscape?[841.89,595.28]:[595.28,841.89],tableWidth=width-margin*2;
   const weight=key=>key==='name'?.85:key==='student'?1.25:key==='unified:手机号'?1.25:key==='unified:学院/单位'?1.65:key==='unified:衣服尺码'?.75:1.35;
   const total=columns.reduce((n,c)=>n+weight(c.key),0),widths=[28,30,...columns.map(c=>(tableWidth-58)*weight(c.key)/total)],headers=['序号','点名',...columns.map(c=>c.label)];
   const activity=short(data.activity,tableWidth-86,9.5,2),group=short(data.group+'　｜　组长：'+(data.leader||'未设置'),tableWidth,10,2);
   const tableTop=height-margin-Math.max(22,activity.length*12+4)-group.length*13-4-17-(allBands.length>1?16:0);
   const linesFor=(row,fs)=>columns.map((c,i)=>wrap(row[data.columns.indexOf(c)],widths[i+2]-10,fs));
   // Keep the largest readable type that fits this entire roster on one A4 page.
   // If even 8 pt cannot fit, use the regular compact layout and paginate without truncation.
   const layouts=[{size:9,lineHeight:10.5,padding:1.5},{size:8.5,lineHeight:10,padding:1.25},{size:8,lineHeight:9.5,padding:1}];
   const headerFor=layout=>headers.map((h,i)=>short(h,widths[i]-10,layout.size,4));
   const headerHeightFor=layout=>Math.max(20,Math.max(...headerFor(layout).map(a=>a.length))*layout.lineHeight+6);
   const chosen=layouts.find(layout=>data.rows.reduce((n,row)=>n+Math.max(1,...linesFor(row,layout.size).map(a=>a.length))*layout.lineHeight+layout.padding*2,0)<=tableTop-headerHeightFor(layout)-bottom)||layouts[0];
   ({size,lineHeight,padding}=chosen);
   const headerLines=headerFor(chosen),headerHeight=headerHeightFor(chosen),rowLines=data.rows.map(row=>linesFor(row,size));
   let page,y;
   function text(lines,x,top,fs=size,color=ink,leading=fs+3){lines.forEach((t,i)=>page.drawText(t,{x,y:top-fs-i*leading,size:fs,font,color}))}
   function cells(lines,rowHeight,header=false){let x=margin;for(let c=0;c<widths.length;c++){page.drawRectangle({x,y:y-rowHeight,width:widths[c],height:rowHeight,borderWidth:.4,borderColor:line,...(header?{color:fill}:{})});text(lines[c]||[],x+5,y-(header?3:padding),size,ink,lineHeight);x+=widths[c]}}
   function start(){page=doc.addPage([width,height]);pages.push(page);let top=height-margin;text(['点名名单'],margin,top,16);text(activity,margin+86,top-3,9.5,muted,12);top-=Math.max(22,activity.length*12+4);
    text(group,margin,top,10,ink,13);top-=group.length*13+4;
    text([`本组 ${data.rows.length} 人　｜　导出时间：${data.time}`],margin,top,8,muted);top-=17;
    if(allBands.length>1){text([`字段分栏 ${bandIndex+1}/${allBands.length} · 按序号对应同一人`],margin,top,8,muted);top-=16}
    y=top;cells(headerLines,headerHeight,true);y-=headerHeight;
   }
   start();
   for(let r=0;r<data.rows.length;r++){
    const lines=rowLines[r],maxLines=Math.max(1,...lines.map(a=>a.length));let offset=0;
    while(offset<maxLines){if(y-bottom<lineHeight+padding*2)start();const count=Math.min(maxLines-offset,Math.max(1,Math.floor((y-bottom-padding*2)/lineHeight))),h=count*lineHeight+padding*2;
     cells([[String(r+1)],[],...lines.map(a=>a.slice(offset,offset+count))],h);
     if(!offset){const box=Math.min(9,h-2);page.drawRectangle({x:margin+28+(30-box)/2,y:y-(h+box)/2,width:box,height:box,borderWidth:.7,borderColor:muted})}
     y-=h;offset+=count;
    }
   }
   if(!data.rows.length){cells([[],[],['暂无人员'],...columns.slice(1).map(()=>[])],32);y-=32}
  }
  pages.forEach((p,i)=>{const footer=`第 ${i+1} / ${pages.length} 页`;p.drawText(footer,{x:p.getWidth()-margin-font.widthOfTextAtSize(footer,8),y:18,size:8,font,color:muted});p.drawText('点名：到场后在方框内勾选', {x:margin,y:18,size:8,font,color:muted})});
  return doc.save();
 }
 return {defaults,bands,create};
});
