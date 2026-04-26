const CACHE='yeshiva-v58';
const ASSETS=['/yeshiva-manager/','/yeshiva-manager/index.html'];
self.addEventListener('install',e=>{
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  // HTML - תמיד מהרשת, בלי cache
  if(e.request.url.includes('index.html')||e.request.mode==='navigate'){
    e.respondWith(fetch(e.request.url+'?v='+Date.now()).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
