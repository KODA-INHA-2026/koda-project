/* Shared public navigation and a single, bounded brand-image settle. */
(()=>{'use strict';
 const menu=document.querySelector('.brand-mobile-menu');
 menu?.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary').focus();}});
 document.addEventListener('click',event=>{if(menu?.open&&!menu.contains(event.target))menu.open=false;});
 const route=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/index';
 document.querySelectorAll('.koda-public-nav>nav a').forEach(link=>{const url=new URL(link.href);if(!url.hash&&url.pathname.replace(/\.html$/,'')===route)link.setAttribute('aria-current','page');});
 const image=document.querySelector('.brand-keyvisual img');
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');
 let seen=false;try{seen=sessionStorage.getItem('koda-brand-v13-seen')==='true';sessionStorage.setItem('koda-brand-v13-seen','true');}catch{}
 let intro;
 if(image&&!seen&&!reduce.matches&&!document.hidden&&typeof image.animate==='function')intro=image.animate([{transform:'scale(1.025)'},{transform:'scale(1)'}],{duration:640,easing:'cubic-bezier(.22,1,.36,1)'});
 const stop=()=>intro?.cancel();
 reduce.addEventListener('change',()=>{if(reduce.matches)stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
})();
