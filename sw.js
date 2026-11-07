const CACHE='daily-standard-v3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./hardening.js','./quotes-import.js'];
const BRIDGE=`window.DailyStandardQuoteBridge={getQuotes:()=>data.quotes||[],addQuotes:(items)=>{let added=0,duplicates=0;const key=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[“”‘’"']/g,'').replace(/[–—−]/g,'-').replace(/[^\\p{L}\\p{N}]+/gu,' ').trim().replace(/\\s+/g,' ');const seen=new Set((data.quotes||[]).map(q=>key(q.text)));for(const item of items){const text=String(item.text??'').trim();if(!text)continue;const normalized=key(text);if(!normalized||seen.has(normalized)){duplicates++;continue;}seen.add(normalized);data.quotes.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),text,author:String(item.author??''),category:String(item.category??'Mindset'),favorite:Boolean(item.favorite)});added++;}save();return {added,duplicates};},openModal,closeModal,render};`;
function injectScripts(html){
  if(!html.includes('DailyStandardQuoteBridge')) html=html.replace('</script>',`${BRIDGE}</script>`);
  const additions=[];
  if(!html.includes('src="./hardening.js"')) additions.push('<script src="./hardening.js" defer></script>');
  if(!html.includes('src="./quotes-import.js"')) additions.push('<script src="./quotes-import.js" defer></script>');
  if(additions.length) html=html.replace('</body>',`${additions.join('')}</body>`);
  return html;
}
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('daily-standard-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isPage=event.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
  if(isPage){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(event.request)||await cache.match('./index.html')||await cache.match('./');
      let response=cached;
      try{const fresh=await fetch(event.request);if(fresh.ok){await cache.put(event.request,fresh.clone());response=fresh;}}catch{}
      if(!response)return new Response('The app is not available offline yet. Connect once and reload.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      const headers=new Headers(response.headers);headers.set('Content-Type','text/html; charset=utf-8');
      return new Response(injectScripts(await response.text()),{status:response.status,statusText:response.statusText,headers});
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
