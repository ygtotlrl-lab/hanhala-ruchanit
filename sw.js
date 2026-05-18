var CACHE_NAME = 'hanhala-ruchanit-v3';
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  console.log('[SW v3] install start');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW v3] caching', CORE.length, 'core files');
      return Promise.all(
        CORE.map(function(url) {
          return fetch(url).then(function(resp) {
            console.log('[SW v3] cached:', url, resp.status);
            return cache.put(url, resp);
          }).catch(function(err) {
            console.error('[SW v3] FAIL core:', url, err.message);
          });
        })
      );
    }).then(function() {
      console.log('[SW v3] install complete');
    }).catch(function(err) {
      console.error('[SW v3] install ERROR:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW v3] activate');
  event.waitUntil(
    caches.keys().then(function(names) {
      console.log('[SW v3] existing caches:', names);
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) {
               console.log('[SW v3] deleting old cache:', n);
               return caches.delete(n);
             })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone).catch(function(err) {
            console.warn('[SW v3] put failed:', event.request.url.slice(0,80), err.message);
          });
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request, {ignoreVary: true}).then(function(cached) {
        if (cached) {
          console.log('[SW v3] offline hit:', event.request.url.slice(0,80));
          return cached;
        }
        console.warn('[SW v3] offline miss:', event.request.url.slice(0,80));
        return new Response('Offline', {status: 503});
      });
    })
  );
});
