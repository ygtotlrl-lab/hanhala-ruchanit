// SW v67 - network only, no cache
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request, {cache: 'no-store'}).catch(() => new Response('offline', {status: 503})));
});
