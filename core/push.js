// core/push.js — ההתראות במכשיר: הפעלה, בדיקה וכיבוי, מול שער ההתראות (sh-gate)
// במעטפת — אסימון FCM מהגשר AndroidPush (מוגבל למקור, כמו גשר השיתוף); בדפדפן — מינוי Web Push של ה-service worker.
// מי שמקבל — לפי «מקבל התראות» בטבלת המשתמשים, בשרת; כאן רק נרשם המכשיר, על שם המשתמש המחובר.
// זהות המשתמש מול השער — מהאפליקציה (app.NOTIFY_CFG.auth): בהנהלה אסימון השער, ובכניסה עם Google — אסימון הסשן.

import { app } from './util.js';
import { lsGet, lsSet } from './storage.js';

// המקור משותף לכל האפליקציות — המפתחות נושאים את מזהה האפליקציה
function _k(name) { return 'push_' + name + '_' + self.APP.id; }
function _gateUrl() { return self.APP.supabase.url + '/functions/v1/sh-gate'; }

// מזהה המכשיר — אקראי, נוצר פעם אחת; השער מחליף בו את האסימון הקודם של אותו מכשיר
function pushDevice() {
  var d = lsGet(_k('dev'));
  if (!d) {
    var b = new Uint8Array(12);
    crypto.getRandomValues(b);
    d = Array.from(b).map(function (x) { return (x + 0x100).toString(16).slice(1); }).join('');
    lsSet(_k('dev'), d);
  }
  return d;
}

function _shell() { return !!(self.AndroidPush && typeof self.AndroidPush.postMessage === 'function'); }
// שאלה אחת למעטפת בכל פעם; בלי תשובה תוך 20 שניות — כאילו אין אסימון
var _shellQ = Promise.resolve();
function _shellAsk(op) {
  _shellQ = _shellQ.then(function () {
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve(null); }, 20000);
      self.AndroidPush.onmessage = function (e) {
        clearTimeout(t);
        try { resolve(JSON.parse(e.data)); } catch (x) { resolve(null); }
      };
      self.AndroidPush.postMessage(JSON.stringify({ op: op }));
    });
  });
  return _shellQ;
}

function pushSupported() {
  if (_shell()) return true;
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in self && 'Notification' in self;
}
// on — הופעל במכשיר הזה ולא כובה; ההרשאה עצמה עשויה להשתנות בהגדרות המערכת, ולכן הבדיקה הקובעת היא הבדיקה מהשרת
function pushIsOn() { return lsGet(_k('on')) === '1'; }

async function _post(body) {
  var a = {};
  try { a = (app.NOTIFY_CFG && app.NOTIFY_CFG.auth) ? (await app.NOTIFY_CFG.auth()) || {} : {}; } catch (e) { a = {}; }
  var k = self.APP.supabase.key;
  var res = await fetch(_gateUrl(), {
    method: 'POST',
    headers: Object.assign({ apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' }, a.headers || {}),
    body: JSON.stringify(Object.assign({ app: self.APP.id }, a.body || {}, body))
  });
  var j = null;
  try { j = await res.json(); } catch (e) { j = null; }
  return j || { error: 'net' };
}

function _b64ToBytes(s) {
  var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  var o = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
  return o;
}

// ask — מותר לשאול את המשתמש על ההרשאה (רק מלחיצה שלו); בלי — רק אם כבר ניתנה
// מחזיר { kind, push } או 'denied' או null
async function _token(ask) {
  if (_shell()) {
    var r = await _shellAsk(ask ? 'enable' : 'token');
    if (r && r.token) return { kind: 'fcm', push: String(r.token) };
    return (r && r.perm === 'denied') ? 'denied' : null;
  }
  if (!pushSupported()) return null;
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') {
    if (!ask) return null;
    var p = await Notification.requestPermission();
    if (p !== 'granted') return p === 'denied' ? 'denied' : null;
  }
  var reg = await navigator.serviceWorker.ready;
  var sub = await reg.pushManager.getSubscription();
  if (!sub) {
    var v = await _post({ action: 'vapid' });
    if (!v || !v.key) return null;
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: _b64ToBytes(v.key) });
  }
  return { kind: 'web', push: JSON.stringify(sub) };
}

// 'ok' · 'denied' (ההרשאה נחסמה במכשיר) · 'unsupported' · 'fail'
async function pushEnable() {
  if (!pushSupported()) return 'unsupported';
  var t;
  try { t = await _token(true); } catch (e) { console.warn('[push] token', e); t = null; }
  if (t === 'denied') return 'denied';
  if (!t) return 'fail';
  var r = await _post({ action: 'reg', device: pushDevice(), kind: t.kind, push: t.push });
  if (!r || !r.ok) return 'fail';
  lsSet(_k('on'), '1');
  return 'ok';
}
async function pushDisable() {
  lsSet(_k('on'), '0');
  try { await _post({ action: 'unreg', device: pushDevice() }); } catch (e) { /* */ }
  if (!_shell() && pushSupported()) {
    try { var reg = await navigator.serviceWorker.ready; var s = await reg.pushManager.getSubscription(); if (s) await s.unsubscribe(); }
    catch (e) { /* */ }
  }
  return 'ok';
}
// ההתראה מגיעה למכשירי המשתמש המחובר בלבד — בלי תלות בסימון «מקבל התראות»
async function pushTest() {
  var r = await _post({ action: 'test' });
  return r && r.push ? r.push : null;
}
// אחרי כל כניסה — אסימון שהתחלף נרשם מחדש בשקט, על שם המשתמש שנכנס; בלי שאלה למשתמש
async function pushRefresh() {
  if (!pushIsOn()) return false;
  try {
    var t = await _token(false);
    if (!t || t === 'denied') return false;
    var r = await _post({ action: 'reg', device: pushDevice(), kind: t.kind, push: t.push });
    return !!(r && r.ok);
  } catch (e) { return false; }
}
// ביציאה — המכשיר יורד מהרשימה, ומשתמש אחר שנכנס בו אינו מקבל את ההתראות של הקודם
async function pushSignOut() {
  if (!pushIsOn()) return;
  try { await _post({ action: 'unreg', device: pushDevice() }); } catch (e) { /* */ }
}

export { pushSupported, pushIsOn, pushEnable, pushDisable, pushTest, pushRefresh, pushSignOut, pushDevice };
