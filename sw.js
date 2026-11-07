const CACHE_NAME = 'daily-standard-v8';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './app-safety.js', './hardening.js', './quotes-import.js', './device-transfer.js',
  './home-quote-order.js', './pwa-updates.js'
];

const APP_BRIDGE = `window.DailyStandardQuoteBridge={
 getState:()=>data,
 getQuotes:()=>data.quotes||[],
 addQuotes:(items)=>{let added=0,duplicates=0;const key=value=>window.DailyStandardSafety.quoteKey(value);const seen=new Set((data.quotes||[]).map(q=>key(q.text)));for(const item of items){const text=window.DailyStandardSafety.text(item.text);if(!text)continue;const normalized=key(text);if(!normalized||seen.has(normalized)){duplicates++;continue;}seen.add(normalized);data.quotes.push({id:window.DailyStandardSafety.safeId(),text,author:window.DailyStandardSafety.text(item.author,2000),category:window.DailyStandardSafety.text(item.category,200)||window.DailyStandardSafety.categoryFromText(text),favorite:Boolean(item.favorite)});added++;}save();return {added,duplicates};},
 restoreState:(next)=>{if(!window.DailyStandardSafety||!next)return false;const previous=data;try{data=next;if(!save()){data=previous;return false;}return true;}catch(error){data=previous;return false;}},
 downloadBackup:()=>{const payload={...data,backupFormatVersion:1,exportedAt:new Date().toISOString()};window.DailyStandardDownload('daily-standard-backup-'+TODAY()+'.json',JSON.stringify(payload,null,2),'application/json');},
 exportHabitCSV:()=>{const rows=[['Date','Habit','Value','Target','Unit','Status','Note']];for(const date of Object.keys(data.records||{}).sort())for(const habit of data.habits||[]){const record=data.records[date]?.[habit.id];if(record)rows.push([date,habit.name,record.value,habit.target,habit.unit,status(habit,date),record.note]);}const csv=rows.map(row=>row.map(window.DailyStandardSafety.csvCell).join(',')).join('\\r\\n');window.DailyStandardDownload('daily-standard-habits-'+TODAY()+'.csv',csv,'text/csv;charset=utf-8');},
 exportQuoteCSV:()=>{const rows=[['Quote','Author','Category','Favorite'],...(data.quotes||[]).map(q=>[q.text,q.author,q.category,q.favorite?'Yes':'No'])];const csv=rows.map(row=>row.map(window.DailyStandardSafety.csvCell).join(',')).join('\\r\\n');window.DailyStandardDownload('daily-standard-quotes-'+TODAY()+'.csv',csv,'text/csv;charset=utf-8');},
 openModal,closeModal,render
};
window.DailyStandardDownload=(name,content,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);};`;

function injectAppScripts(html) {
  if (!html.includes('DailyStandardQuoteBridge')) html = html.replace('</script>', `${APP_BRIDGE}</script>`);
  const scripts = [
    ['app-safety.js', '<script src="./app-safety.js" defer></script>'],
    ['hardening.js', '<script src="./hardening.js" defer></script>'],
    ['quotes-import.js', '<script src="./quotes-import.js" defer></script>'],
    ['device-transfer.js', '<script src="./device-transfer.js" defer></script>'],
    ['home-quote-order.js', '<script src="./home-quote-order.js" defer></script>'],
    ['pwa-updates.js', '<script src="./pwa-updates.js" defer></script>']
  ];
  const missing = scripts.filter(([name]) => !html.includes(`src="./${name}"`)).map(([, tag]) => tag);
  if (missing.length) html = html.replace('</body>', `${missing.join('')}</body>`);
  return html;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Fetch a complete new asset set before this worker can be offered for activation.
    // cache:reload avoids a stale browser HTTP cache making a partial release look current.
    await Promise.all(ASSETS.map(async asset => {
      const request = new Request(new URL(asset, self.registration.scope), { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Could not precache ${asset}: ${response.status}`);
      await cache.put(request, response);
    }));
    // Intentionally wait. The page asks the user before sending SKIP_WAITING.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep previous release caches: other already-open tabs may still be using them.
    // App data lives in localStorage and is never read, migrated, or deleted here.
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const navigation = event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');

  if (navigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(event.request);
        if (fresh.ok) {
          const html = injectAppScripts(await fresh.clone().text());
          const result = new Response(html, { status: fresh.status, statusText: fresh.statusText, headers: fresh.headers });
          await cache.put(event.request, result.clone());
          return result;
        }
      } catch (_) { /* Network unavailable; use last working app shell. */ }
      const cached = await cache.match(event.request) || await cache.match('./index.html') || await cache.match('./');
      if (cached) return cached;
      return new Response('The app has not been cached yet. Connect to the internet and reload once.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  })());
});
