/*  ⛔ ה-service worker של האפליקציה — הגרסה והרשימות בלבד: ⚠️ הלוגיקה
 *  ב-`core/sw.js`, ⭐ וערכי האפליקציה ב-`app.config.js`, שנטען ראשון. */
importScripts('./app.config.js');
/*  ⛔ מכאן נגזרת גרסת האפליקציה — ⚠️ ואין לה ליטרל שני ב-`index.html`. */
var CACHE_NAME = self.APP.id + '-v224';

// קליפת האפליקציה — חייבת להיות במטמון כדי שהאפליקציה תעבוד אופליין.
var CORE = [
  './',
  './index.html',
  './app.config.js',
  './core/boot.js',
  './core/sw.js',
  './core/ui.css',
  './app.css',
  './core/util.js',
  './core/sync.js',
  './core/storage.js',
  './core/mirror.js',
  './core/backup.js',
  './core/auth.js',
  './core/ui.js',
  './core/hebrew.js',
  './manifest.json',
  './icons/icon-192.aad94dba.png',
  './icons/icon-512.092edf48.png'
];

// ⚠️ גרסאות נעוצות במדויק — ⛔ לעולם לא major צף. האפליקציה לא רצה
// בלי supabase (var SB=supabase.createClient זורק וכל הסקריפט המוטבע מת).
var CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.3.11/pdfmake.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.3.11/vfs_fonts.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

importScripts('./core/sw.js');
