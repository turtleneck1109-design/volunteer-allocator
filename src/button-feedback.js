/* Render success inside the actual button, including after a UI rerender. */
globalThis.ButtonFeedback=(()=>{
 let origin=null,active=null,timer=null,observer=null;
 const labelOf=button=>button.textContent.trim();
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button||button.disabled||button.closest('[inert]')||button.matches('[data-person]'))return;
  origin={button,id:button.id,action:button.getAttribute('onclick'),label:labelOf(button),at:Date.now()};
 },true);
 function clear(){
  clearTimeout(timer);observer?.disconnect();observer=null;
  document.querySelectorAll('.button-success-active').forEach(button=>button.classList.remove('button-success-active'));
  active=null;
 }
 function apply(){
  if(!active)return;
  let button=active.button;
  if(!button.isConnected){
   button=active.id?document.getElementById(active.id):null;
   if(!button&&active.action){const matches=[...document.querySelectorAll('button')].filter(b=>b.getAttribute('onclick')===active.action);button=matches.find(b=>labelOf(b)===active.label)||(matches.length===1?matches[0]:null)}
  }
  // Closed dialogs and removed controls have no button to cover: never float a badge over other UI.
  if(!button||button.closest('dialog:not([open])')||!button.getClientRects().length)return;
  active.button=button;
  if(!button.classList.contains('button-success-active'))button.classList.add('button-success-active');
 }
 function success(){
  if(!origin||Date.now()-origin.at>180000)return;
  const target=origin;origin=null;clear();active=target;
  apply();
  observer=new MutationObserver(apply);
  observer.observe(document.body,{childList:true,subtree:true});
  queueMicrotask(apply);
  timer=setTimeout(clear,1100);
 }
 function fail(){origin=null;clear()}
 return {success,fail};
})();
