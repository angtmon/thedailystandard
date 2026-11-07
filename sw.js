const CACHE='daily-standard-v2';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./hardening.js'];
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
      try{
        const fresh=await fetch(event.request);
        if(fresh.ok){await cache.put(event.request,fresh.clone());response=fresh;}
      }catch{}
      if(!response)return new Response('The app is not available offline yet. Connect once and reload.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      const html=await response.text();
      if(!html.includes('hardening.js')){
        const injected=html.replace('</body>','<script src="./hardening.js" defer></script></body>');
        return new Response(injected,{status:response.status,statusText:response.statusText,headers:new Headers([...response.headers,['Content-Type','text/html; charset=utf-8']])});
      }
      return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
