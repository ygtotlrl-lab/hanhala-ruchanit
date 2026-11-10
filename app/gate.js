// app/gate.js — שער השרת (פונקציית Edge‏ hr-gate, שהקוד שלה ב-Supabase): הכניסה, הקריאות, והקבצים.
// האסימון נשמר במכשיר לכל משתמש (30 יום), ומתחדש בשקט מהסיסמה שהוזנה בכניסה; הזנת סיסמה בתגובות — רק כשאין ממה לחדש (רענון מהבאנר שאחריו פג האסימון).
// הקבצים — במאגר הפרטי hanhala-ruchanit-files, רק דרך השער: העלאה בגוף הבקשה, ופתיחה בקישור חתום שהשער מגיש.
import { toast } from '../core/ui.js';
import { lsGet, lsRemove, lsSet } from '../core/storage.js';
import { MSG_UPLOAD_FAIL, MSG_UPLOAD_NEEDS_NET } from './constants.js';
import { AUTH } from './state.js';

var GATE_KEY = 'hr_gate';
var MSG_GATE_RELOGIN = 'הקבצים דורשים כניסה מקוונת — צא והיכנס שוב, עם רשת';

function _gateUrl() { return self.APP.supabase.url + '/functions/v1/hr-gate'; }
// האסימונים — לכל משתמש בנפרד, במפת uid ⟵ {token, exp}; החלפת משתמש אינה מוחקת את האסימון של האחר
function _gateMap() {
  var g = null;
  try { g = JSON.parse(lsGet(GATE_KEY) || 'null'); } catch (e) { g = null; }
  if (g && g.token) { var o = {}; o[String(g.uid)] = { token: g.token, exp: g.exp }; return o; } // הצורה הישנה — אסימון אחד
  return (g && typeof g === 'object') ? g : {};
}
function _uid() { return AUTH.user ? String(AUTH.user.client_id) : ''; }
function _gateTok() {
  var e = AUTH.user ? _gateMap()[_uid()] : null;
  return (e && e.exp > Date.now()) ? e.token : null;
}
function _hdrs(x) { var k = self.APP.supabase.key; return Object.assign({ apikey: k, Authorization: 'Bearer ' + k }, x || {}); }
async function _gatePost(body) {
  var r = await fetch(_gateUrl(), { method: 'POST', headers: _hdrs({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
  var j = null;
  try { j = await r.json(); } catch (e) { j = null; }
  return { status: r.status, body: j || {} };
}
// בכל כניסה — ברקע, בלי להמתין: כשל כאן אינו נוגע בכניסה.
// הסיסמה שהוזנה בכניסה נשמרת בזיכרון בלבד (לא בדיסק), למשך הכניסה: כשאין אסימון, או שהשער דחה אותו, או שהרשת חזרה —
// השער מתחבר מחדש בשקט, והתגובות אינן מבקשות שוב את הסיסמה.
var _cred = null;
function _credOk() { return !!(_cred && AUTH.user && AUTH.user.username === _cred.u); }
async function gateLogin(username, pass) {
  _cred = { u: username, p: pass };
  try {
    var r = await _gatePost({ action: 'login', username: username, password: pass });
    if (r.status !== 200 || !r.body.token) { if (r.status === 401) _cred = null; return false; }
    var m = _gateMap(); m[_uid()] = { token: r.body.token, exp: r.body.exp };
    lsSet(GATE_KEY, JSON.stringify(m));
    return true;
  } catch (e) { console.warn('[gate] הכניסה לשער נכשלה — תנוסה שוב כשתהיה רשת', e); return false; }
}
self.addEventListener('online', function () { if (_credOk() && !_gateTok()) gateLogin(_cred.u, _cred.p); });
// יציאה — האסימון של המשתמש היוצא והסיסמה שבזיכרון יורדים
function gateForget() {
  var m = _gateMap(); delete m[_uid()];
  lsSet(GATE_KEY, JSON.stringify(m));
  _cred = null;
}
function _drop() { var m = _gateMap(); delete m[_uid()]; lsSet(GATE_KEY, JSON.stringify(m)); }
// אסימון תקף, ואם אין — חיבור שקט עם הסיסמה שבזיכרון
async function _tokEnsure(fresh) {
  if (fresh) _drop();
  var t = _gateTok();
  if (!t && _credOk()) { await gateLogin(_cred.u, _cred.p); t = _gateTok(); }
  return t;
}
// mod — המודול שההרשאה שלו נבדקת, והטבלה שהשער קורא (enroll ⟵ hr_enroll · intake ⟵ hr_intake)
async function gateCall(mod, action, body) {
  var t = await _tokEnsure(false);
  if (!t) return { login: true };
  var r;
  try { r = await _gatePost(Object.assign({ action: action, token: t, mod: mod }, body || {})); }
  catch (e) { return { net: true }; }
  // השער דחה את האסימון — חיבור מחדש בשקט, וניסיון אחד נוסף
  if (r.status === 401) {
    t = await _tokEnsure(true);
    if (!t) return { login: true };
    try { r = await _gatePost(Object.assign({ action: action, token: t, mod: mod }, body || {})); } catch (e) { return { net: true }; }
    if (r.status === 401) { _drop(); return { login: true }; }
  }
  if (r.status === 403) return { perm: true };
  if (r.status !== 200) return { error: true };
  return r.body;
}

// ── הקבצים ──
// סיומת הקובץ — אותיות לטיניות וספרות בלבד, עד חמש
function gateExt(file) { return (String(file && file.name || '').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'; }

// העלאה לנתיב חדש (exams/ · files/) — מחזירה את הנתיב, או null אחרי הודעה
async function gatePut(path, file) {
  if (!navigator.onLine) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return null; }
  var t = await _tokEnsure(false);
  if (!t) { toast(MSG_GATE_RELOGIN, null, 'warn'); return null; }
  try {
    var put = function (tk) { return fetch(_gateUrl() + '?a=put&p=' + encodeURIComponent(path), {
      method: 'POST', headers: _hdrs({ 'Content-Type': file.type || 'application/octet-stream', 'x-gate-token': tk }), body: file }); };
    var r = await put(t);
    if (r.status === 401) { t = await _tokEnsure(true); r = t ? await put(t) : r; }
    if (r.status === 401) { _drop(); toast(MSG_GATE_RELOGIN, null, 'warn'); return null; }
    if (r.status === 403) { toast(MSG_UPLOAD_FAIL + 'אין הרשאה', null, 'bad'); return null; }
    if (!r.ok) throw new Error(String(r.status));
    return path;
  } catch (e) { toast(MSG_UPLOAD_FAIL + ((e && e.message) || e), null, 'bad'); return null; }
}

// קישורים חתומים — לשעה, או בלי תפוגה (ttl:'forever' — סריקות המבחנים בגיליון שנשלח להורים); { נתיב: קישור }
async function gateLinks(paths, ttl) {
  if (!paths.length || !navigator.onLine) return {};
  var r = await gateCall('', 'links', { paths: paths, ttl: ttl || '' });
  return (r && r.urls) || {};
}

// פתיחת קובץ בחלון חדש — החלון נפתח מתוך הלחיצה, והקישור מגיע אחריה
async function gateOpen(path) {
  if (!path) return;
  if (!navigator.onLine) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return; }
  var w = window.open('', '_blank');
  var r = await gateCall('', 'links', { paths: [path] });
  var url = r && r.urls && r.urls[path];
  if (url) { if (w) w.location.href = url; else window.location.href = url; return; }
  if (w) w.close();
  toast(r && r.login ? MSG_GATE_RELOGIN : r && r.perm ? 'אין הרשאה לקובץ' : 'הקובץ לא נפתח — אין חיבור לשרת', null, 'bad');
}

export { gateCall, gateExt, gateForget, gateLinks, gateLogin, gateOpen, gatePut };
