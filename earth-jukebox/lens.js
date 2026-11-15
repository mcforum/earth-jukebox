'use strict';
/* Earth Jukebox lens: lays an explain-and-listen layer over any picture or video.
   Point at the picture to hear and read the data under the pointer.
   Start listening and the zones of the picture take turns as notes.
   Needs records.js. No other dependencies. */
(function(g){
const U=g.EJ_UTIL,DECODE=g.EJ_DECODE,clamp=U.clamp;
const W=192,H=108,BEAT=.55,PENTA=[0,2,4,7,9];
const S=(e,s)=>Object.assign(e.style,s);
const FONT='"Segoe UI",system-ui,-apple-system,Roboto,sans-serif';
const quant=v=>{const d=Math.round(clamp(v,0,1)*10);return 220*Math.pow(2,(PENTA[d%5]+12*Math.floor(d/5))/12);};

class EJLens{
 constructor(o){
  this.host=o.host;this.media=o.media||null;this.onText=o.onText||function(){};this.voice=o.voice||(()=>true);this.onBlocked=o.onBlocked||function(){};
  this.showCap=o.caption!==false;this.rec=null;this.listening=false;this.ptr=null;this.zones=[];this.zmax=.004;this.active=-1;this.activeAt=0;this.vol=.8;
  this.blocked=false;this.px=null;this.k=0;this.nextBeat=0;this.lastAn=0;this.hover='';this.hoverT=0;this.hoverSaid=false;this.announce=false;this.ac=null;
  this.cv=document.createElement('canvas');this.cv.width=W;this.cv.height=H;this.cx=this.cv.getContext('2d',{willReadFrequently:true});
  this.ov=document.createElement('canvas');S(this.ov,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none'});
  this.bub=document.createElement('div');this.bubA=document.createElement('div');this.bubB=document.createElement('div');this.bub.append(this.bubA,this.bubB);
  S(this.bub,{position:'absolute',display:'none',background:'#fbfaf5',color:'#0c1024',padding:'8px 12px',borderRadius:'6px',maxWidth:'270px',pointerEvents:'none',boxShadow:'0 3px 0 #0c1024',zIndex:'3',textAlign:'left'});
  S(this.bubA,{font:'600 16px/1.25 '+FONT});S(this.bubB,{font:'400 13px/1.3 '+FONT,marginTop:'2px'});
  this.cap=document.createElement('div');
  S(this.cap,{position:'absolute',display:'none',left:'50%',bottom:'10px',transform:'translateX(-50%)',background:'rgba(12,16,36,.88)',color:'#fff',padding:'6px 14px',borderRadius:'6px',font:'500 15px/1.35 '+FONT,maxWidth:'94%',textAlign:'center',pointerEvents:'none',zIndex:'2'});
  this.host.append(this.ov,this.bub,this.cap);
  this.host.tabIndex=0;this.host.setAttribute('role','application');S(this.host,{touchAction:'none',cursor:'crosshair'});
  this._ev=[['pointermove',e=>this._pt(e)],['pointerdown',e=>{this._audio();this._pt(e);this.sayPoint();}],
   ['pointerleave',()=>{if(this.ptr&&!this.ptr.kb)this.ptr=null;}],['keydown',e=>this._key(e)],['blur',()=>{if(this.ptr&&this.ptr.kb)this.ptr=null;}]];
  this._ev.forEach(([n,f])=>this.host.addEventListener(n,f));
  this._timer=setInterval(()=>this._sched(),40);
  const loop=ts=>{if(this.dead)return;this._raf=requestAnimationFrame(loop);this._frame(ts);};this._raf=requestAnimationFrame(loop);
 }
 destroy(){this.dead=true;clearInterval(this._timer);cancelAnimationFrame(this._raf);this._ev.forEach(([n,f])=>this.host.removeEventListener(n,f));
  this.ov.remove();this.bub.remove();this.cap.remove();if('speechSynthesis' in g)speechSynthesis.cancel();if(this.ac)this.ac.close();}

 setRecord(rec){
  this.rec=rec;this.dec=DECODE[rec.decode]||DECODE.any;const Z=rec.zones.names.length;
  this.zmap=new Uint8Array(W*H).fill(255);this.zn=new Float32Array(Z);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=(x+.5)/W,v=(y+.5)/H;
   for(let z=0;z<Z;z++)if(rec.zones.rects[z].some(r=>u>=r[0]&&u<r[2]&&v>=r[1]&&v<r[3])){this.zmap[y*W+x]=z;this.zn[z]++;break;}}
  this.zones=[];this.zmax=.004;this.active=-1;this.k=0;this.ptr=null;this.hover='';S(this.cap,{display:'none'});
  this.host.setAttribute('aria-label','Picture of '+rec.title+'. Use the arrow keys to move a pointer across the picture and hear what is there. Press Enter to have it read out.');
 }
 setMedia(el){this.media=el;this.blocked=false;this.px=null;}
 setVolume(v){this.vol=v;if(this.ac)this.master.gain.setTargetAtTime(v,this.ac.currentTime,.05);}
 _ready(){const m=this.media;return !!m&&(m.tagName==='VIDEO'?m.readyState>=2:m.complete&&m.naturalWidth>0);}
 _mrect(r){const m=this.media,mw=(m&&(m.videoWidth||m.naturalWidth))||16,mh=(m&&(m.videoHeight||m.naturalHeight))||9,s=Math.min(r.width/mw,r.height/mh),w=mw*s,h=mh*s;return {x:(r.width-w)/2,y:(r.height-h)/2,w,h};}

 /* ----- reading the picture ----- */
 _analyze(){
  if(this.blocked||!this.rec||!this._ready())return;
  let d;try{this.cx.drawImage(this.media,0,0,W,H);d=this.cx.getImageData(0,0,W,H).data;}catch(e){this.blocked=true;this.px=null;this.onBlocked();return;}
  this.px=d;const Z=this.zn.length,sum=new Float32Array(Z),cnt=new Float32Array(Z),cc=new Float32Array(Z*8),o={v:0,c:0},dec=this.dec,zm=this.zmap;
  for(let i=0,p=0;i<W*H;i++,p+=4){const z=zm[i];if(z===255)continue;
   if(dec(d[p]/255,d[p+1]/255,d[p+2]/255,o)){sum[z]+=o.v;cnt[z]++;cc[z*8+o.c]++;}}
  let m=0;const zs=[];
  for(let z=0;z<Z;z++){let c=0;for(let k=1;k<8;k++)if(cc[z*8+k]>cc[z*8+c])c=k;
   const a=sum[z]/this.zn[z];if(a>m)m=a;zs.push({cover:cnt[z]/this.zn[z],mean:cnt[z]?sum[z]/cnt[z]:0,cat:c,amt:a,rel:0});}
  this.zmax=Math.max(this.zmax*.999,m,.004);zs.forEach(z=>{z.rel=clamp(z.amt/this.zmax,0,1);});this.zones=zs;
 }
 sample(u,v){
  if(!this.px)return null;const x0=Math.round(u*(W-1)),y0=Math.round(v*(H-1)),o={v:0,c:0},cc=[0,0,0,0,0,0,0,0];let n=0,sv=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=x0+dx,y=y0+dy;if(x<0||y<0||x>=W||y>=H)continue;const p=(y*W+x)*4;
   if(this.dec(this.px[p]/255,this.px[p+1]/255,this.px[p+2]/255,o)){n++;sv+=o.v;cc[o.c]++;}}
  if(n<4)return null;let c=0;for(let k=1;k<8;k++)if(cc[k]>cc[c])c=k;return {v:sv/n,cat:c};
 }
 _where(u,v,s){if(this.rec.geo)return U.place(s?this.rec.geo:'near',u,v);return (v<1/3?'Upper':v<2/3?'Middle':'Lower')+' '+(u<1/3?'left':u<2/3?'centre':'right')+' of the picture';}
 pointText(){if(!this.ptr||!this.rec)return null;const s=this.sample(this.ptr.u,this.ptr.v);return {s,main:s?this.rec.label(s.v,s.cat):this.rec.nodata,sub:this._where(this.ptr.u,this.ptr.v,s)};}
 zoneText(z){const r=this.rec;if(!z)return '';
  if(r.mode==='value')return z.cover<.01?'no data':(r.zoneLabel?r.zoneLabel(z.mean):r.label(z.mean,z.cat).toLowerCase());
  if(r.mode==='cat')return z.cover<.02?'clear':'mostly '+r.cats[z.cat].name.toLowerCase();
  return U.amountWord(z.rel)+' '+r.thing;}
 summary(){if(!this.rec||!this.zones.length)return '';return this.rec.zones.names.map((n,i)=>n+': '+this.zoneText(this.zones[i])).join('. ')+'.';}
 describe(){const r=this.rec;return r?[r.title+'.',r.shows,r.colors,r.how,this.summary()].filter(Boolean).join(' '):'';}

 /* ----- sound ----- */
 _audio(){
  if(this.ac){if(this.ac.state==='suspended')this.ac.resume();return true;}
  const AC=g.AudioContext||g.webkitAudioContext;if(!AC)return false;
  const ac=this.ac=new AC();this.master=ac.createGain();this.master.gain.value=this.vol;
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;this.master.connect(comp);comp.connect(ac.destination);
  if(ac.createMediaStreamDestination){this.recDest=ac.createMediaStreamDestination();comp.connect(this.recDest);}
  this.exOsc=ac.createOscillator();this.exGain=ac.createGain();this.exGain.gain.value=0;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2600;
  this.exOsc.type='triangle';this.exOsc.connect(lp);lp.connect(this.exGain);this.exGain.connect(this.master);this.exOsc.start();
  return true;
 }
 _wave(c){const k=this.rec&&this.rec.cats&&this.rec.cats[c];return (k&&k.wave)||'triangle';}
 _note(t,f,vel,wave,dur){const ac=this.ac,o=ac.createOscillator(),gn=ac.createGain(),lp=ac.createBiquadFilter();
  o.type=wave;o.frequency.value=f;lp.type='lowpass';lp.frequency.value=wave==='sine'||wave==='triangle'?4000:1800;
  const peak=vel*(wave==='sawtooth'||wave==='square'?.16:.3);
  gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(peak,t+.015);gn.gain.exponentialRampToValueAtTime(.0005,t+dur);
  o.connect(lp);lp.connect(gn);gn.connect(this.master);o.start(t);o.stop(t+dur+.05);}
 _tick(t,f,vel){const ac=this.ac,o=ac.createOscillator(),gn=ac.createGain();o.type='triangle';o.frequency.value=f;
  gn.gain.setValueAtTime(vel*.4,t);gn.gain.exponentialRampToValueAtTime(.0005,t+.06);o.connect(gn);gn.connect(this.master);o.start(t);o.stop(t+.08);}
 _playZone(i,t,z){const r=this.rec;
  if(r.style==='ticks'){const n=Math.round(z.rel*7),f=[1320,660,330,220][i]||440;for(let j=0;j<n;j++)this._tick(t+j*(BEAT*.8/n),f,.8);return;}
  const val=r.mode==='value'?z.mean:z.rel,vel=r.mode==='value'?(z.cover>.01?.75:0):(z.rel<.04?0:.3+.6*z.rel);
  if(vel>0)this._note(t,quant(val),vel,this._wave(z.cat),BEAT*1.5);}
 playKey(v,c){if(!this._audio()||!this.rec)return;const t=this.ac.currentTime+.02;
  if(this.rec.style==='ticks'){const n=Math.max(1,Math.round(v*7));for(let j=0;j<n;j++)this._tick(t+j*(BEAT*.8/n),660,.8);}
  else this._note(t,quant(v),.75,this._wave(c||0),.9);}
 start(){if(!this._audio())return false;this.listening=true;this.k=0;this.nextBeat=this.ac.currentTime+.15;return true;}
 stop(){this.listening=false;this.active=-1;S(this.cap,{display:'none'});}
 _exploring(){return !!this.ptr&&(this.ptr.kb||performance.now()-this.ptr.t<1500);}
 _sched(){
  const ac=this.ac;if(!this.listening||!ac||!this.rec)return;
  if(this._exploring()||!this.zones.length){this.nextBeat=ac.currentTime+.35;return;}
  if(this.nextBeat<ac.currentTime)this.nextBeat=ac.currentTime+.05;
  const Z=this.zones.length;
  while(this.nextBeat<ac.currentTime+.1){const i=this.k,t=this.nextBeat;
   if(i<Z){this._playZone(i,t,this.zones[i]);setTimeout(()=>{this.active=i;this.activeAt=performance.now();},Math.max(0,(t-ac.currentTime)*1000));}
   else{const s=this.summary();this.cap.textContent=s;S(this.cap,{display:s&&this.showCap?'block':'none'});this.onText(s,'summary');}
   this.nextBeat+=BEAT;this.k=(this.k+1)%(Z+1);}
 }
 speak(text){
  if(!text||!('speechSynthesis' in g))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';
  const duck=v=>{if(this.ac)this.master.gain.setTargetAtTime(v,this.ac.currentTime,.15);};
  u.onstart=()=>duck(this.vol*.25);u.onend=u.onerror=()=>duck(this.vol);speechSynthesis.speak(u);
 }
 sayPoint(){const p=this.pointText();if(!p)return;const t=p.main+'. '+p.sub+'.';this.onText(t,'point');if(this.voice())this.speak(t);this.hoverSaid=true;}

 /* ----- pointer and keyboard ----- */
 _pt(e){const r=this.host.getBoundingClientRect(),m=this._mrect(r),u=(e.clientX-r.left-m.x)/m.w,v=(e.clientY-r.top-m.y)/m.h;
  this.ptr=(u>=0&&u<=1&&v>=0&&v<=1)?{u,v,t:performance.now()}:null;}
 _key(e){
  const step=e.shiftKey?.12:.04,d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(d){e.preventDefault();e.stopPropagation();this._audio();const p=this.ptr&&this.ptr.kb?this.ptr:{u:.5,v:.5};
   this.ptr={u:clamp(p.u+d[0]*step,0,1),v:clamp(p.v+d[1]*step,0,1),kb:true,t:performance.now()};this.announce=true;}
  else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();this._audio();if(!this.ptr)this.ptr={u:.5,v:.5,kb:true,t:performance.now()};this.sayPoint();}
  else if(e.key==='Escape'){this.ptr=null;}
 }

 /* ----- every frame ----- */
 _frame(ts){
  if(ts-this.lastAn>100){this.lastAn=ts;this._analyze();}
  const r=this.host.getBoundingClientRect(),m=this._mrect(r),now=performance.now();
  const p=this.ptr&&this.px?this.pointText():null;
  if(p){
   this.bubA.textContent=p.main;this.bubB.textContent=p.sub;
   let x=m.x+this.ptr.u*m.w+18,y=m.y+this.ptr.v*m.h+18;if(x+280>r.width)x=Math.max(4,x-310);if(y+74>r.height)y=Math.max(4,y-96);
   S(this.bub,{display:'block',left:x+'px',top:y+'px'});
   if(this.ac){const t=this.ac.currentTime;
    if(p.s){const w=this._wave(p.s.cat);if(this.exOsc.type!==w)this.exOsc.type=w;
     this.exOsc.frequency.setTargetAtTime(220*Math.pow(2,p.s.v*2),t,.03);this.exGain.gain.setTargetAtTime(w==='sawtooth'||w==='square'?.09:.2,t,.04);}
    else this.exGain.gain.setTargetAtTime(0,t,.04);}
   const lab=p.main+'. '+p.sub+'.';
   if(this.announce){this.announce=false;this.onText(lab,'point');if(this.voice())this.speak(p.main);this.hover=p.main;this.hoverSaid=true;}
   else if(p.main!==this.hover){this.hover=p.main;this.hoverT=now;this.hoverSaid=false;}
   else if(!this.hoverSaid&&!this.ptr.kb&&now-this.hoverT>650){this.hoverSaid=true;this.onText(lab,'point');if(this.voice())this.speak(lab);}
  }else{
   S(this.bub,{display:'none'});this.hover='';if(this.ac)this.exGain.gain.setTargetAtTime(0,this.ac.currentTime,.05);
  }
  this._draw(r,m,now);
 }
 _draw(r,m,now){
  const dpr=g.devicePixelRatio||1,cw=Math.round(r.width*dpr),ch=Math.round(r.height*dpr),c=this.ov,x=c.getContext('2d');
  if(c.width!==cw||c.height!==ch){c.width=cw;c.height=ch;}
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,r.width,r.height);
  if(!this.rec||!this.px)return;
  if(this.listening&&!this._exploring()){
   const zs=this.rec.zones;x.font='600 14px '+FONT;x.textBaseline='middle';
   zs.names.forEach((name,i)=>{const on=i===this.active&&now-this.activeAt<BEAT*1000;
    zs.rects[i].forEach(q=>{const X=m.x+q[0]*m.w,Y=m.y+q[1]*m.h,Wd=(q[2]-q[0])*m.w,Ht=(q[3]-q[1])*m.h;
     if(on){x.fillStyle='rgba(255,210,63,.16)';x.fillRect(X,Y,Wd,Ht);}
     x.lineWidth=on?3:1;x.strokeStyle=on?'#ffd23f':'rgba(255,255,255,.4)';x.strokeRect(X+.5,Y+.5,Wd-1,Ht-1);});
    const q=zs.rects[i][0],txt=name+': '+this.zoneText(this.zones[i]),tw=x.measureText(txt).width+16,X=m.x+q[0]*m.w+6,Y=m.y+q[1]*m.h+6;
    x.fillStyle=on?'#ffd23f':'rgba(12,16,36,.85)';x.fillRect(X,Y,tw,24);x.fillStyle=on?'#0c1024':'#fff';x.fillText(txt,X+8,Y+12.5);});
  }
  if(this.ptr){const X=m.x+this.ptr.u*m.w,Y=m.y+this.ptr.v*m.h;
   x.lineWidth=4;x.strokeStyle='#0c1024';x.beginPath();x.arc(X,Y,13,0,7);x.stroke();
   x.lineWidth=2;x.strokeStyle='#ffd23f';x.beginPath();x.arc(X,Y,13,0,7);x.stroke();
   x.fillStyle='#ffd23f';x.beginPath();x.arc(X,Y,2.5,0,7);x.fill();}
 }
}
g.EJLens=EJLens;
})(globalThis);
