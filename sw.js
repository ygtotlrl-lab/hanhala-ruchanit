// sw.js - NUCLEAR OPTION: מוחק הכל ולא שומר כלום
var VERSION = '20260427-2';

self.addEventListener('install', function(e) {
  // מחק את כל ה-cache הישן
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// תמיד מהרשת — אף פעם לא מcache
self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request, {cache: 'no-store'}).catch(function() {
      return new Response('Offline - please refresh', {status: 503});
    })
  );
});
