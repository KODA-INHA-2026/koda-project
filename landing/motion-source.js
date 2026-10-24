import {animate} from 'motion/mini';
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const brandAnimations=[];
const brandTargets=[...document.querySelectorAll('.brand-hero-copy,.brand-hero-object')];
if(!reduce.matches){
 brandTargets.forEach((el,i)=>brandAnimations.push(animate(el,{opacity:[.01,1],transform:[`translateY(${i?18:10}px)`,'translateY(0)']},{duration:.72,delay:i*.08,ease:[.22,1,.36,1]})));
}
const revealTargets=[...document.querySelectorAll('.home-handoff,.home-films-heading,.home-next')];
const revealObserver=new IntersectionObserver(entries=>{
 for(const entry of entries){if(!entry.isIntersecting)continue;revealObserver.unobserve(entry.target);if(!reduce.matches)brandAnimations.push(animate(entry.target,{opacity:[.45,1],transform:['translateY(12px)','translateY(0)']},{duration:.55,ease:[.22,1,.36,1]}));}
},{threshold:.12});
revealTargets.forEach(el=>revealObserver.observe(el));
reduce.addEventListener('change',()=>{if(reduce.matches){brandAnimations.splice(0).forEach(a=>a.stop());[...brandTargets,...revealTargets].forEach(el=>{el.style.opacity='1';el.style.transform='none';});}});
const preview=document.querySelector('.task-preview');
let previewAnimation;
if(preview){
 const tabs=[...preview.querySelectorAll('[role="tab"]')];
 const panels=[...preview.querySelectorAll('[role="tabpanel"]')];
 function activate(index,focus=false){
  previewAnimation?.stop();
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
  panels.forEach((panel,i)=>{panel.hidden=i!==index;panel.style.opacity='1';panel.style.transform='none';});
  if(focus)tabs[index].focus();
  if(!reduce.matches)previewAnimation=animate(panels[index],{opacity:[.5,1],transform:['translateY(4px)','translateY(0)']},{duration:.18,ease:'easeOut'});
 }
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>activate(i));
  tab.addEventListener('keydown',event=>{
   const destination={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
   if(destination!==undefined){event.preventDefault();activate(destination,true);}
  });
 });
 reduce.addEventListener('change',()=>{if(reduce.matches){previewAnimation?.stop();panels.forEach(p=>{p.style.opacity='1';p.style.transform='none';});}});
}
let workAnimations=[];
function clearWorkAnimations(){
 workAnimations.splice(0).forEach(a=>a.stop());
 for(const id of ['stage-title','stage-records']){const el=document.getElementById(id);if(el){el.style.opacity='1';el.style.transform='none';}}
}
document.addEventListener('koda:work-rendered',event=>{
 clearWorkAnimations();if(reduce.matches||!event.detail?.progress)return;
 for(const id of ['stage-title','stage-records']){const el=document.getElementById(id);if(el)workAnimations.push(animate(el,{opacity:[.55,1],transform:['translateY(4px)','translateY(0)']},{duration:.2,ease:'easeOut'}));}
});
reduce.addEventListener('change',()=>{if(reduce.matches)clearWorkAnimations();});
