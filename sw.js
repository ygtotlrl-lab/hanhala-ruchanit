var CACHE_NAME = 'hanhala-ruchanit-v43';

// קבצים מקומיים — חובה. './' ו-'./index.html' הם אותו קובץ בשני מפתחות.
var CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// סקריפטי CDN — האפליקציה לא רצה בלי supabase (var SB=supabase.createClient זורק
// וכל הסקריפט המוטבע מת). נמשכים ב-mode:'cors' דווקא, כי תגובת no-cors היא opaque
// עם status 0 ו-cache.put דוחה אותה — לכן עד היום הם מעולם לא נכנסו למטמון.
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// ignoreSearch — ה-APK טוען את האפליקציה עם '?apk=1', ובלי זה בקשת הניווט
// לא מוצאת את './' שבמטמון ונופלת לדף שגיאה. לכן הוא נחוץ — אבל **רק לניווט**.
//
// ⚠️ אסור להשתמש ב-ignoreSearch לחיפוש כללי של תת-משאבים: הוא מתעלם מה-query
// string, וב-PostgREST כל הפילטרים נמצאים דווקא שם. חיפוש כללי עם ignoreSearch
// גרם לכך שבקשת כניסה עבור משתמש אחד התאימה לתשובה שנשמרה עבור משתמש אחר —
// כניסה עם כל סיסמה, בזהות זרה. אותה קריסה חלה על כל קריאות טבלת kv, שנבדלות
// זו מזו רק ב-query. השארנו שתי מפות נפרדות כדי שזה לא יחזור.
var NAV_OPTS = {ignoreVary: true, ignoreSearch: true};  // ניווט בלבד
var SUB_OPTS = {ignoreVary: true};                      // תת-משאבים — ה-query הוא חלק מהזהות

// בקשות ל-Supabase לא נכנסות למטמון כלל ולא עוברות דרך ה-SW: תשובת API שנשמרת
// היא נתון ישן שמוגש כאילו הוא טרי. באופליין עדיף שהבקשה תיכשל באמת — כך
// ysWithTimeout/ysIsNetErr מזהים netFail ונופלים למסלול הכניסה המקומי הנכון.
function isSupabaseRequest(url) {
  return url.indexOf('.supabase.co') !== -1;
}

// דף אופליין — HTML אמיתי עם Content-Type, לא מחרוזת 'Offline' שנראית
// כמסך שחור עם טקסט זעיר בפינה.
function offlinePage() {
  var html =
    '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>אין חיבור — הנהלה רוחנית</title><style>' +
    'html,body{margin:0;height:100%}' +
    'body{display:flex;align-items:center;justify-content:center;' +
    'font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;' +
    'background:linear-gradient(160deg,#0f2347,#1a3a6b,#234a8a);color:#fff;padding:24px}' +
    '.box{max-width:340px;text-align:center;background:rgba(255,255,255,.07);' +
    'border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px 22px}' +
    'h1{font-size:1.15rem;margin:0 0 10px}' +
    'p{font-size:.92rem;line-height:1.6;opacity:.85;margin:0 0 20px}' +
    'button{background:#c9a84c;color:#1a2340;border:none;border-radius:22px;' +
    'padding:11px 26px;font-size:.95rem;font-weight:700;font-family:inherit;cursor:pointer}' +
    '</style></head><body><div class="box">' +
    '<div style="font-size:2.4rem;margin-bottom:10px">📴</div>' +
    '<h1>אין חיבור לאינטרנט</h1>' +
    '<p>האפליקציה עדיין לא נשמרה במלואה במכשיר.<br>' +
    'התחבר לרשת פעם אחת, ומאז היא תיפתח גם ללא חיבור.</p>' +
    '<button onclick="location.reload()">נסה שוב</button>' +
    '</div></body></html>';
  return new Response(html, {
    status: 503,
    statusText: 'Offline',
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}
  });
}

// כשל רשת אמיתי לתת-משאב (סקריפט/תמונה) — עדיף מלהזריק HTML לתוך תג script,
// שזו בדיוק הסיבה שהאפליקציה מתה כשה-CDN לא נמצא במטמון.
function networkError() {
  try { return Response.error(); }
  catch (e) { return new Response('', {status: 504, statusText: 'Offline'}); }
}

function cachePut(cache, url, opts) {
  return fetch(url, opts).then(function(resp) {
    if (!resp || !resp.ok) throw new Error('HTTP ' + (resp ? resp.status : '?'));
    if (resp.type === 'opaque') throw new Error('opaque response');
    return cache.put(url, resp);
  });
}

// ריפוי עצמי של מטמון ה-CDN — סקריפט CDN שחסר במטמון (נמחק ע"י אפליקציה
// אחות לפני תיקון הקידומת ב-activate, או כשל רשת רגעי בהתקנה) לא היה מושלם
// לעולם: בזמן-ריצה הוא מגיע מהדף כבקשת no-cors ⇒ opaque ⇒ לא נשמר. הפונקציה
// רצה ב-activate וגם פעם אחת בכל עליית SW, משלימה רק את מה שחסר, וכשל בה
// שקט — לא מפיל כלום. כך מכשירים שנפגעו מתרפאים לבד, בלי לחכות לגרסה חדשה.
function ensureCdnCached() {
  return caches.open(CACHE_NAME).then(function(cache) {
    return Promise.all(CDN_ASSETS.map(function(url) {
      return cache.match(url, SUB_OPTS).then(function(hit) {
        if (hit) return;
        return cachePut(cache, url, {mode: 'cors', credentials: 'omit'})
          .then(function() { console.log('[SW] healed cdn:', url.slice(0, 60)); });
      }).catch(function() {});
    }));
  }).catch(function() {});
}
ensureCdnCached(); // קוד עליון = רץ פעם אחת בכל עליית SW

// Install — קבצים מקומיים + סקריפטי CDN. כשל בודד לא מפיל את ההתקנה.
self.addEventListener('install', function(event) {
  console.log('[SW] install start', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      var jobs = CORE.map(function(url) {
        // cache:'reload' — לוודא שמגיע index.html טרי ולא עותק מה-HTTP cache
        return cachePut(cache, url, {cache: 'reload'})
          .catch(function() { return cachePut(cache, url, {}); })
          .then(function() { console.log('[SW] cached core:', url); })
          .catch(function(err) { console.error('[SW] FAIL core:', url, err.message); });
      }).concat(CDN_ASSETS.map(function(url) {
        return cachePut(cache, url, {mode: 'cors', credentials: 'omit'})
          .then(function() { console.log('[SW] cached cdn:', url.slice(0, 60)); })
          .catch(function(err) { console.warn('[SW] FAIL cdn:', url.slice(0, 60), err.message); });
      }));
      return Promise.all(jobs);
    }).then(function() {
      console.log('[SW] install complete');
    }).catch(function(err) {
      console.error('[SW] install ERROR:', err);
    })
  );
  self.skipWaiting();
});

// Activate — מוחקים מטמון ישן רק אחרי שאומת ש-index.html נכנס לחדש.
// אחרת התקנה שנכשלה באמצע משאירה את המשתמש בלי אפליקציה כלל.
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match('./index.html', NAV_OPTS);
    }).then(function(hit) {
      if (!hit) {
        console.warn('[SW] index.html חסר במטמון החדש — משאירים את הישן כרשת ביטחון');
        return;
      }
      // ⚠️ שלוש האפליקציות חיות על אותו origin (ygtotlrl-lab.github.io) וחולקות
      // CacheStorage אחד. מוחקים אך ורק מטמונים של האפליקציה הזו (קידומת
      // 'hanhala-ruchanit-') — מחיקת "כל מה שאינו CACHE_NAME" השמידה את המטמונים
      // של schar-limud ו-yoman-avoda ושברה להן את האופליין. אין להסיר את הסינון.
      return caches.keys().then(function(names) {
        return Promise.all(
          names.filter(function(n) { return n.startsWith('hanhala-ruchanit-') && n !== CACHE_NAME; })
               .map(function(n) {
                 console.log('[SW] deleting old cache:', n);
                 return caches.delete(n);
               })
        );
      });
    }).catch(function(err) {
      console.warn('[SW] activate cleanup skipped:', err.message);
    }).then(function() {
      return ensureCdnCached();
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — רשת קודם, ובנפילה מטמון.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  // Supabase — לא נוגעים בכלל: לא מיירטים, לא שומרים, לא מגישים מהמטמון.
  if (isSupabaseRequest(event.request.url)) return;

  var isNav = event.request.mode === 'navigate';

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200 && response.type !== 'opaque') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone).catch(function(err) {
            console.warn('[SW] put failed:', event.request.url.slice(0, 80), err.message);
          });
        });
      }
      return response;
    }).catch(function() {
      // caches.match הגלובלי סורק את כל המטמונים — גם ישן ששרד ב-activate.
      // ניווט מחפש עם NAV_OPTS (כדי ש-'?apk=1' ימצא את './'), תת-משאב עם SUB_OPTS.
      return caches.match(event.request, isNav ? NAV_OPTS : SUB_OPTS).then(function(cached) {
        if (cached) return cached;
        if (isNav) {
          // ניווט תמיד מקבל את האפליקציה, בכל וריאציה של query string
          return caches.match('./index.html', NAV_OPTS).then(function(idx) {
            if (idx) return idx;
            return caches.match('./', NAV_OPTS).then(function(root) {
              return root || offlinePage();
            });
          });
        }
        console.warn('[SW] offline miss:', event.request.url.slice(0, 80));
        return networkError();
      });
    })
  );
});

// Message - page asks the waiting worker to activate immediately
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
