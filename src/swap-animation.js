(function(root){
'use strict';
const position=p=>p.group||(p.reserve?'reserve':'pending');
function plan(before,after){const final=new Map(after.people.map(p=>[p.id,p]));return before.people.filter(p=>final.has(p.id)&&position(p)!==position(final.get(p.id))).map(p=>({person:p,from:position(p),to:position(final.get(p.id))}));}
function visible(el){if(!el)return false;const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0||r.top<8||r.left<8||r.bottom>innerHeight-8||r.right>innerWidth-8)return false;for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const css=getComputedStyle(a);if(/auto|scroll|hidden|clip/.test(css.overflow+css.overflowX+css.overflowY)){const b=a.getBoundingClientRect();if(r.top<b.top||r.bottom>b.bottom||r.left<b.left||r.right>b.right)return false;}}return true;}
async function play(before,after,{label,chipHtml}){
 const transfers=plan(before,after);if(!transfers.length)return;
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const app=document.querySelector('.app'),wasInert=app?.inert,focused=document.activeElement,clones=[],animations=new Set(),dimmed=new Set(),highlighted=new Set();let overlay,controls,skip=false;
 const sourceFor=id=>[...document.querySelectorAll('[data-person]')].find(el=>el.dataset.person===id);
 const sources=new Map(transfers.map(t=>[t.person.id,sourceFor(t.person.id)]));
 const locations=[...new Set(transfers.map(t=>t.from))];
 const sides=locations.map(loc=>transfers.filter(t=>t.from===loc));
 const inPlace=transfers.length<=6&&sides[0].length===sides[1].length&&transfers.every(t=>visible(sources.get(t.person.id)));
 const makeChip=p=>{const box=document.createElement('div');box.innerHTML=chipHtml(p);const chip=box.firstElementChild;chip.removeAttribute('onclick');chip.removeAttribute('onkeydown');chip.removeAttribute('data-person');chip.removeAttribute('draggable');chip.removeAttribute('role');chip.removeAttribute('aria-checked');chip.setAttribute('tabindex','-1');chip.removeAttribute('aria-pressed');chip.classList.remove('chosen');chip.querySelector('.selected-check')?.remove();chip.setAttribute('aria-hidden','true');return chip;};
 const finish=()=>{skip=true;animations.forEach(a=>{try{a.finish()}catch{a.cancel()}})};
 try{
  if(app)app.inert=true;
  controls=document.createElement('div');controls.className='swap-controls';const status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='正在交换 '+transfers.length+' 人';controls.append(status);
  const button=document.createElement('button');button.type='button';button.textContent='立即完成';button.addEventListener('click',finish);controls.append(button);document.body.append(controls);button.focus({preventScroll:true});
  if(!inPlace){overlay=document.createElement('section');overlay.className='swap-stage';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','人员交换动画');overlay.innerHTML='<h2>人员交换</h2><p>双方标签移入对方小组，绑定成员一起交换。</p><div class="swap-columns"></div>';document.body.append(overlay);}
  // Show small batches in the fallback board so clipped and cross-page selections stay readable.
  const batches=inPlace?[transfers]:Array.from({length:Math.ceil(Math.max(...sides.map(s=>s.length))/3)},(_,i)=>sides.flatMap(s=>s.slice(i*3,i*3+3)));
  let done=0;
  for(const batch of batches){
   if(skip)break;const entries=[];
   if(inPlace){
    batch.forEach(t=>{const source=sources.get(t.person.id),opposite=transfers.filter(q=>q.from===t.to),index=transfers.filter(q=>q.from===t.from).indexOf(t),target=sources.get(opposite[index%opposite.length].person.id);entries.push({t,source,target});const group=source.closest('[data-drop]');if(group){group.classList.add('swap-receiving');highlighted.add(group)}});
   }else{
    const columns=overlay.querySelector('.swap-columns');columns.replaceChildren();const origin=new Map(),destination=new Map();
    locations.forEach(loc=>{const panel=document.createElement('section');panel.className='swap-panel';const heading=document.createElement('h3');heading.textContent=label(loc);panel.append(heading);for(const [caption,items,isArrival] of [['换出',batch.filter(t=>t.from===loc),false],['换入',batch.filter(t=>t.to===loc),true]]){const title=document.createElement('div');title.className='swap-caption';title.textContent=caption;panel.append(title);const list=document.createElement('div');list.className='swap-labels';items.forEach(t=>{const chip=makeChip(t.person);list.append(chip);if(isArrival){chip.style.opacity='0';destination.set(t.person.id,chip)}else origin.set(t.person.id,chip)});panel.append(list)}columns.append(panel)});
    batch.forEach(t=>entries.push({t,source:origin.get(t.person.id),target:destination.get(t.person.id)}));
   }
   const jobs=entries.map(({t,source,target})=>{
    const start=source.getBoundingClientRect(),end=target.getBoundingClientRect(),clone=makeChip(t.person);clone.classList.add('flying-person','swap-flying');
    const route=document.createElement('small');route.className='swap-route';route.textContent='→ '+label(t.to);clone.append(route);Object.assign(clone.style,{left:start.left+'px',top:start.top+'px',width:Math.max(start.width,170)+'px',margin:'0'});document.body.append(clone);clones.push(clone);source.classList.add('swap-departing');dimmed.add(source);
    const dx=end.left-start.left,dy=end.top-start.top,bend=t.from===locations[0]?-48:48;
    if(reduced||typeof clone.animate!=='function')return Promise.resolve();
    const animation=clone.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.5+bend}px)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy}px)`,opacity:1}],{duration:1800,easing:'ease-in-out',fill:'forwards'});animations.add(animation);
    return animation.finished.catch(e=>{if(!skip)throw e}).finally(()=>animations.delete(animation));
   });
   await Promise.all(jobs);done+=batch.length;status.textContent='已交换 '+done+' / '+transfers.length+' 人';
   if(!inPlace){entries.forEach(({target})=>target.style.opacity='1');clones.splice(0).forEach(el=>el.remove());}
   if(!skip&&!reduced)await new Promise(resolve=>setTimeout(resolve,350));
  }
 }finally{
  animations.forEach(a=>a.cancel());clones.forEach(el=>el.remove());dimmed.forEach(el=>el.classList.remove('swap-departing'));highlighted.forEach(el=>el.classList.remove('swap-receiving'));overlay?.remove();controls?.remove();if(app)app.inert=wasInert;if(focused?.isConnected)focused.focus({preventScroll:true});
 }
}
root.SwapAnimation={plan,play};
})(typeof module!=='undefined'?module.exports:window);
