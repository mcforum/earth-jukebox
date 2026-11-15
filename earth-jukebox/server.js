/* Written with AI assistance: Claude, an AI assistant by Anthropic. See README, section "Use of AI". */
// Local static server for Earth Jukebox. Listens on this computer only and supports
// HTTP Range requests so videos can loop and seek.
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=+process.env.PORT||8137,ROOT=__dirname;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg'};
http.createServer((req,res)=>{
  const base={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'};
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,base);return res.end();}
  let p;try{p=decodeURIComponent(req.url.split('?')[0]);}catch(e){res.writeHead(400,base);return res.end();}
  if(p.endsWith('/'))p+='index.html';
  const f=path.resolve(ROOT,'.'+path.sep+p);
  const type=TYPES[path.extname(f).toLowerCase()];
  if((f!==ROOT&&!f.startsWith(ROOT+path.sep))||!type||p.split('/').some(s=>s.startsWith('.'))){res.writeHead(404,base);return res.end('Not found');}
  fs.stat(f,(e,st)=>{
    if(e||!st.isFile()){res.writeHead(404,base);return res.end('Not found');}
    const h={...base,'Content-Type':type,'Accept-Ranges':'bytes'};
    const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
    let s=0,en=st.size-1,code=200;
    if(m&&(m[1]||m[2])){
      if(m[1]){s=+m[1];if(m[2])en=Math.min(+m[2],st.size-1);}else{s=Math.max(0,st.size-+m[2]);}
      if(s>en||s>=st.size){res.writeHead(416,{...base,'Content-Range':`bytes */${st.size}`});return res.end();}
      code=206;h['Content-Range']=`bytes ${s}-${en}/${st.size}`;
    }
    h['Content-Length']=en-s+1;res.writeHead(code,h);
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(f,{start:s,end:en}).on('error',()=>res.destroy()).pipe(res);
  });
}).listen(PORT,'127.0.0.1',()=>console.log(`Earth Jukebox is running at http://localhost:${PORT}\nKeep this window open. Press Ctrl+C to stop.`));
