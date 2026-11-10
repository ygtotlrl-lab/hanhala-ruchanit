// app/gate.js — שער השרת (פונקציית Edge‏ hr-gate, שהקוד שלה ב-Supabase): הכניסה, הקריאות, והקבצים.
// האסימון נשמר במכשיר למשתמש שנכנס (30 יום), ובלעדיו — הזנת הסיסמה פעם אחת, עם רשת.
// הקבצים — במאגר הפרטי hanhala-ruchanit-files, רק דרך השער: העלאה בגוף הבקשה, ופתיחה בקישור חתום שהשער מגיש.
import { toast } from '../core/ui.js';
import { lsGet, lsRemove, lsSet } from '../core/storage.js';
import { MSG_UPLOAD_FAIL, MSG_UPLOAD_NEEDS_NET } from './constants.js';
import { AUTH } from './state.js';

var GATE_KEY = 'hr_gate';
var MSG_GATE_RELOGIN = 'הקבצים דורשים כניסה מקוונת — צא והיכנס שוב, עם רשת';

function _gateUrl() { return self.APP.supabase.url + '/functions/v1/hr-gate'; }
function _gateTok() {
  var g = null;
  try { g = JSON.parse(lsGet(GATE_KEY) || 'null'); } catch (e) { g = null; }
  return (g && AUTH.user && String(g.uid) === String(AUTH.user.client_id) && g.exp > Date.now()) ? g.token : null;
}
function _hdrs(x) { var k = self.APP.supabase.key; return Object.assign({ apikey: k, Authorization: 'Bearer ' + k }, x || {}); }
async function _gatePost(body) {
  var r = await fetch(_gateUrl(), { method: 'POST', headers: _hdrs({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
  var j = null;
  try { j = await r.json(); } catch (e) { j = null; }
  return { status: r.status, body: j || {} };
}
// בכניסה מקוונת — ברקע, בלי להמתין: כשל כאן אינו נוגע בכניסה, ורק מה שעובר בשער יבקש סיסמה
async function gateLogin(username, pass) {
  try {
    var r = await _gatePost({ action: 'login', username: username, password: pass });
    if (r.status !== 200 || !r.body.token) return false;
    lsSet(GATE_KEY, JSON.stringify({ uid: AUTH.user && AUTH.user.client_id, token: r.body.token, exp: r.body.exp }));
    return true;
  } catch (e) { console.warn('[gate] הכניסה לשער נכשלה', e); return false; }
}
function gateForget() { lsRemove(GATE_KEY); }
// mod — המודול שההרשאה שלו נבדקת, והטבלה שהשער קורא (enroll ⟵ hr_enroll · intake ⟵ hr_intake)
async function gateCall(mod, action, body) {
  var t = _gateTok();
  if (!t) return { login: true };
  var r;
  try { r = await _gatePost(Object.assign({ action: action, token: t, mod: mod }, body || {})); }
  catch (e) { return { net: true }; }
  if (r.status === 401) { gateForget(); return { login: true }; }
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
  var t = _gateTok();
  if (!t) { toast(MSG_GATE_RELOGIN, null, 'warn'); return null; }
  try {
    var r = await fetch(_gateUrl() + '?a=put&p=' + encodeURIComponent(path), {
      method: 'POST', headers: _hdrs({ 'Content-Type': file.type || 'application/octet-stream', 'x-gate-token': t }), body: file });
    if (r.status === 401) { gateForget(); toast(MSG_GATE_RELOGIN, null, 'warn'); return null; }
    if (r.status === 403) { toast(MSG_UPLOAD_FAIL + 'אין הרשאה', null, 'bad'); return null; }
    if (!r.ok) throw new Error(String(r.status));
    return path;
  } catch (e) { toast(MSG_UPLOAD_FAIL + ((e && e.message) || e), null, 'bad'); return null; }
}

// קישורים חתומים — לשעה, או לשנה (ttl:'year' — סריקות המבחנים בגיליון שנשלח להורים); { נתיב: קישור }
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
