// SW שמוחק את עצמו ואת כל ה-cache
self.addEventListener('install', function(e) {
  self.skipWaiting();
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
// תמיד מרשת, אף פעם לא מcache
self.addEventListener('fetch', function(e) {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function() {
        return fetch('/yeshiva-manager/index.html');
      })
    );
    return;
  }
  e.respondWith(fetch(e.request));
});
