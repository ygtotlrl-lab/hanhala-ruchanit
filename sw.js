var CACHE_NAME = 'hanhala-ruchanit-v6';
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install - cache only core local files (fast, no CDN timeout risk)
self.addEventListener('install', function(event) {
  console.log('[SW v4] install start');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW v4] caching', CORE.length, 'core files');
      return Promise.all(
        CORE.map(function(url) {
          return fetch(url).then(function(resp) {
            console.log('[SW v4] cached:', url, resp.status);
            return cache.put(url, resp);
          }).catch(function(err) {
            console.error('[SW v4] FAIL core:', url, err.message);
          });
        })
      );
    }).then(function() {
      console.log('[SW v4] install complete');
    }).catch(function(err) {
      console.error('[SW v4] install ERROR:', err);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', function(event) {
  console.log('[SW v4] activate');
  event.waitUntil(
    caches.keys().then(function(names) {
      console.log('[SW v4] existing caches:', names);
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) {
               console.log('[SW v4] deleting old cache:', n);
               return caches.delete(n);
             })
      );
    })
  );
  self.clients.claim();
});

// Fetch - GET only, network first, fallback to cache
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone).catch(function(err) {
            console.warn('[SW v4] put failed:', event.request.url.slice(0,80), err.message);
          });
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request, {ignoreVary: true}).then(function(cached) {
        if (cached) {
          console.log('[SW v4] offline hit:', event.request.url.slice(0,80));
          return cached;
        }
        console.warn('[SW v4] offline miss:', event.request.url.slice(0,80));
        return new Response('Offline', {status: 503});
      });
    })
  );
});
