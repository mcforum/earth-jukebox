'use strict';
/* Written with AI assistance: Claude, an AI assistant by Anthropic. See README, section "Use of AI". */
/* Earth Jukebox Lens, browser extension part: adds the lens to the largest picture or video
   on a page of NASA's Scientific Visualization Studio (svs.gsfc.nasa.gov). */
(function(){
if(window.__ejLens)return;window.__ejLens=true;
const S=(e,s)=>Object.assign(e.style,s),FONT='"Segoe UI",system-ui,sans-serif';
const mk=(tag,text,style)=>{const e=document.createElement(tag);if(text)e.textContent=text;S(e,Object.assign({font:'600 14px '+FONT},style||{}));return e;};
const BTN={background:'#ffd23f',color:'#0c1024',border:'0',borderRadius:'999px',padding:'8px 16px',cursor:'pointer'};
let lens=null,host=null,media=null,sync=0,listening=false;

const panel=mk('div',null,{position:'fixed',right:'16px',bottom:'16px',zIndex:'2147483647',background:'#17338f',color:'#fff',padding:'12px',borderRadius:'10px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',maxWidth:'340px',boxShadow:'0 4px 0 #0a1440'});
const open=mk('button','Earth Jukebox: hear this picture',BTN);open.type='button';
const play=mk('button','Play',BTN);play.type='button';
const desc=mk('button','Describe',Object.assign({},BTN,{background:'#fff'}));desc.type='button';
const close=mk('button','Close',Object.assign({},BTN,{background:'transparent',color:'#fff',border:'1.5px solid #fff'}));close.type='button';
const voiceLab=mk('label','',{display:'inline-flex',gap:'6px',alignItems:'center',fontWeight:'400'}),voice=document.createElement('input');voice.type='checkbox';voice.checked=true;voiceLab.append(voice,'Voice');
const status=mk('div','',{flexBasis:'100%',fontWeight:'400',fontSize:'13px',lineHeight:'1.35'});status.setAttribute('aria-live','polite');
panel.append(open);document.body.append(panel);

function pick(){
 const ok=e=>{const r=e.getBoundingClientRect();return r.width>=240&&r.height>=135?r.width*r.height:0;};
 let best=null,area=0;
 document.querySelectorAll('video').forEach(v=>{const a=ok(v)*4;if(a>area){area=a;best=v;}});
 document.querySelectorAll('img').forEach(i=>{const a=i.complete&&i.naturalWidth>300?ok(i):0;if(a>area){area=a;best=i;}});
 return best;
}
function record(){
 const m=/^\/(\d+)\/?/.exec(location.pathname),id=m?+m[1]:0;
 const known=EJ_RECORDS.find(r=>r.svs===id);
 const title=(document.querySelector('h1')||{}).textContent||document.title;
 // a known page may show a different cut of the visualization, so place names are switched off here
 return Object.assign({},known||EJ_GENERIC,{title:(title||'this picture').trim(),geo:null});
}
function place(){
 if(!host||!media)return;const r=media.getBoundingClientRect();
 S(host,{left:(r.left+scrollX)+'px',top:(r.top+scrollY)+'px',width:r.width+'px',height:r.height+'px'});
 sync=requestAnimationFrame(place);
}
function start(){
 media=pick();
 if(!media){status.textContent='No picture or video found on this page.';panel.append(status);return;}
 media.scrollIntoView({block:'center'});
 host=document.createElement('div');S(host,{position:'absolute',zIndex:'2147483646',outline:'3px solid #ffd23f'});document.body.append(host);place();
 lens=new EJLens({host,media,voice:()=>voice.checked,onText:t=>{status.textContent=t;},
  onBlocked:()=>{status.textContent='This page does not allow the picture to be read.';}});
 const rec=record();lens.setRecord(rec);
 open.remove();panel.append(play,desc,voiceLab,close,status);
 status.textContent='Move the mouse over the picture, or click it and use the arrow keys. '+(rec.how||'');
 host.focus();
}
function setPlay(p){
 if(p&&!lens.start())p=false;if(!p)lens.stop();listening=p;play.textContent=p?'Pause':'Play';
 if(media.tagName==='VIDEO'){if(p)media.play().catch(()=>{});else media.pause();}
}
function stop(){
 cancelAnimationFrame(sync);if(lens){lens.destroy();lens=null;}if(host){host.remove();host=null;}
 listening=false;play.textContent='Play';panel.textContent='';panel.append(open);
}
open.addEventListener('click',start);
play.addEventListener('click',()=>setPlay(!listening));
desc.addEventListener('click',()=>{const t=lens.describe();status.textContent=t;if(voice.checked)lens.speak(t);});
close.addEventListener('click',stop);
})();
