(function(){
  const key='volunteer-color-theme';
  let saved=null;
  try{saved=localStorage.getItem(key)}catch(e){}
  const media=typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;
  let explicit=saved==='light'||saved==='dark';
  function apply(theme){
    document.documentElement.dataset.theme=theme;
    document.documentElement.style.colorScheme=theme;
    const button=document.getElementById('themeToggle');
    if(button){
      button.setAttribute('aria-pressed',String(theme==='dark'));
      button.setAttribute('aria-label',theme==='dark'?'切换为浅色模式':'切换为深色模式');
      button.innerHTML=theme==='dark'?'<span aria-hidden="true">☀</span>浅色模式':'<span aria-hidden="true">☾</span>深色模式';
    }
  }
  apply(explicit?saved:media?.matches?'dark':'light');
  window.toggleTheme=function(){
    const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    explicit=true;apply(next);
    try{localStorage.setItem(key,next)}catch(e){}
  };
  document.addEventListener('DOMContentLoaded',()=>apply(document.documentElement.dataset.theme));
  media?.addEventListener?.('change',e=>{if(!explicit)apply(e.matches?'dark':'light')});
})();
