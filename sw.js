var CACHE_NAME = 'hanhala-ruchanit-v2';
var urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.gstatic.com/s/alef/v22/FeVfS0NQpLYgrjJbC5FxxbU.ttf'
];

// Install - cache each URL individually with logging
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Starting install cache...');
      var promises = urlsToCache.map(function(url) {
        return fetch(url, {mode: 'cors', credentials: 'omit'})
          .then(function(response) {
            if (!response.ok && response.type !== 'opaque') {
              console.warn('[SW] Bad response for', url, response.status);
              return;
            }
            return cache.put(url, response).then(function() {
              console.log('[SW] Cached OK:', url);
            });
          })
          .catch(function(err) {
            console.error('[SW] FAILED to cache:', url, err.message);
          });
      });
      return Promise.all(promises).then(function() {
        console.log('[SW] Install complete');
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
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
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) {
          console.log('[SW] Serving from cache:', event.request.url);
          return cached;
        }
        console.warn('[SW] No cache for:', event.request.url);
        return new Response('Offline', {status: 503});
      });
    })
  );
});
