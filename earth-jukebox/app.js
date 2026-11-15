'use strict';
/* Written with AI assistance: Claude, an AI assistant by Anthropic. See README, section "Use of AI". */
/* Earth Jukebox web app: record picker and controls around the lens (lens.js). */
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const TRACKS=EJ_RECORDS,video=$('video'),still=$('still');
let cur=null,curIdx=-1,isImage=false,playing=false,ready=false,loadId=0,seeking=false,objUrl=null;

function showMsg(t){const m=$('msg');m.textContent=t||'';m.hidden=!t;}
const lens=new EJLens({host:$('stage'),media:video,caption:false,voice:()=>$('voice').checked,
 onText:(t,kind)=>{$(kind==='summary'?'summary':'point').textContent=t;},
 onBlocked:()=>{setPlaying(false);showMsg('The browser will not let this page read the picture. Start Earth Jukebox with start.bat and open http://localhost:8137, or use the online version.');}});

const fmt=s=>{s=Math.max(0,s|0);return (s/60|0)+':'+String(s%60).padStart(2,'0');};
function tick(){
 requestAnimationFrame(tick);
 if(!isImage&&ready&&isFinite(video.duration)){
  if(!seeking){$('seek').max=video.duration;$('seek').value=video.currentTime;}
  $('time').textContent=fmt(video.currentTime)+' / '+fmt(video.duration);
 }
}
function buildKey(t){
 const box=$('keys');box.textContent='';
 (t.key||[]).forEach(k=>{const b=el('button','btn key-btn',k.label);b.type='button';b.addEventListener('click',()=>lens.playKey(k.v,k.c));box.append(b);});
}
function load(i,autoplay,custom){
 const t=custom||TRACKS[i],id=++loadId;
 setPlaying(false);cur=t;curIdx=custom?-1:i;ready=false;showMsg('');
 $('title').textContent=t.title;$('shows').textContent=t.shows||'';$('colors').textContent=t.colors||'';$('how').textContent=t.how||'';
 $('summary').textContent='';$('point').textContent='';
 const cr=$('credit');cr.textContent='';
 if(t.svs){const a=el('a',null,'svs.gsfc.nasa.gov/'+t.svs);a.href='https://svs.gsfc.nasa.gov/'+t.svs+'/';a.target='_blank';a.rel='noopener noreferrer';cr.append('Source: NASA Scientific Visualization Studio, ',a);}
 else cr.textContent='Source: a file from your computer. It never leaves your computer.';
 TRACKS.forEach((x,k)=>x.btn.setAttribute('aria-current',k===curIdx?'true':'false'));
 isImage=!!t.image;video.hidden=isImage;still.hidden=!isImage;$('seek').disabled=isImage;
 if(isImage)$('time').textContent='Still picture';
 lens.setRecord(t);lens.setMedia(isImage?still:video);buildKey(t);
 const ok=()=>{if(id!==loadId||ready)return;ready=true;if(t.btn)t.btn.classList.remove('missing');if(autoplay)setPlaying(true);};
 const bad=()=>{if(id!==loadId)return;if(t.btn)t.btn.classList.add('missing');
  showMsg(custom?'This file could not be opened. Try an MP4 or WebM video, or a PNG or JPG picture.':'The file for this record is missing ('+t.file+'). Pick another record, or open your own file.');};
 video.oncanplay=video.onerror=still.onload=still.onerror=null;
 if(isImage){video.pause();video.removeAttribute('src');video.load();still.onload=ok;still.onerror=bad;still.src=t.file;}
 else{still.removeAttribute('src');video.oncanplay=ok;video.onerror=bad;video.src=t.file;video.load();}
}
function setPlaying(p){
 if(p&&(!ready||!lens.start()))p=false;
 if(!p)lens.stop();
 playing=p;
 if(!isImage){if(p)video.play().catch(()=>{});else video.pause();}
 $('play').textContent=p?'Pause':'Play';$('play').setAttribute('aria-pressed',String(p));
}
function describe(){const t=lens.describe();$('point').textContent=t;if($('voice').checked)lens.speak(t);}
function loadFile(f){
 if(!f)return;
 if(!/^(video|image)\//.test(f.type)){showMsg('That file is not a video or a picture.');return;}
 if(objUrl)URL.revokeObjectURL(objUrl);objUrl=URL.createObjectURL(f);
 load(-1,true,Object.assign({},EJ_GENERIC,{title:f.name,file:objUrl,image:f.type.startsWith('image/')}));
}
let rec=null,chunks=[];
function toggleRec(){
 if(rec){rec.stop();return;}
 if(!lens._audio()||!lens.recDest||!window.MediaRecorder){showMsg('This browser cannot record the sound.');return;}
 chunks=[];rec=new MediaRecorder(lens.recDest.stream);
 rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 rec.onstop=()=>{const url=URL.createObjectURL(new Blob(chunks,{type:rec.mimeType})),a=el('a');a.href=url;
  a.download='earth-jukebox-'+(cur&&cur.id?cur.id:'sound')+'.webm';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  rec=null;$('rec').setAttribute('aria-pressed','false');$('rec').textContent='Record the sound';};
 rec.start();$('rec').setAttribute('aria-pressed','true');$('rec').textContent='Stop and save';
}
function init(){
 TRACKS.forEach((t,i)=>{const li=el('li'),b=el('button','strip'),body=el('span','strip-body');b.type='button';
  body.append(el('b',null,t.title),el('small',null,t.sub));b.append(el('span','key',t.code),body);
  b.setAttribute('aria-label',t.code+'. '+t.title+'. '+t.sub);b.addEventListener('click',()=>load(i,true));li.append(b);$('strips').append(li);t.btn=b;});
 $('play').addEventListener('click',()=>setPlaying(!playing));
 $('describe').addEventListener('click',describe);$('rec').addEventListener('click',toggleRec);
 $('vol').addEventListener('input',e=>lens.setVolume(+e.target.value));
 const sk=$('seek');
 sk.addEventListener('input',()=>{seeking=true;if(isFinite(video.duration))video.currentTime=+sk.value;});
 sk.addEventListener('change',()=>{seeking=false;});
 const live=()=>$('point').setAttribute('aria-live',$('voice').checked?'off':'polite');
 $('voice').addEventListener('change',()=>{live();if(!$('voice').checked&&'speechSynthesis' in window)speechSynthesis.cancel();});live();
 $('helpBtn').addEventListener('click',()=>{const h=$('help');h.hidden=!h.hidden;$('helpBtn').setAttribute('aria-expanded',String(!h.hidden));if(!h.hidden)h.scrollIntoView({block:'nearest'});});
 $('file').addEventListener('change',e=>loadFile(e.target.files[0]));
 let depth=0;
 document.addEventListener('dragenter',e=>{e.preventDefault();depth++;document.body.classList.add('dragging');});
 document.addEventListener('dragover',e=>e.preventDefault());
 document.addEventListener('dragleave',()=>{if(--depth<=0){depth=0;document.body.classList.remove('dragging');}});
 document.addEventListener('drop',e=>{e.preventDefault();depth=0;document.body.classList.remove('dragging');loadFile(e.dataTransfer.files[0]);});
 document.addEventListener('keydown',e=>{
  const tag=e.target.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Space'){if(tag==='BUTTON')return;e.preventDefault();setPlaying(!playing);}
  else if(e.key>='1'&&e.key<='9'){const i=+e.key-1;if(TRACKS[i])load(i,true);}
  else if(e.key==='d'||e.key==='D')describe();
 });
 window.EJ={lens,state:()=>({playing,ready,cur:cur&&cur.id,blocked:lens.blocked,audio:lens.ac?lens.ac.state:'none',msg:$('msg').textContent,summary:lens.summary()})};
 load(0,false);tick();
}
init();
