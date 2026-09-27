// app/domain.js — המראה, הסנכרון, המיזוג, ההרשאות ובורר התאריך
import { MSG_KV_BAD, dayIso, dayNoon, dayToday, kvParse, uniqList,
         withTimeout } from '../core/util.js';
import { TOMBSTONE_TTL_MS, _rowsPaged, ctxEpoch, ctxStale, eraNotePush, mergeCore,
         pendAll, pendConfirmPush, pendHas, pendMark, plTouch, pushDirty, schedulePush,
         tombAt, tombPruneMerged } from '../core/sync.js';
import { hwNoteCloud, lsGet, lsLog, lsSet, lsSetArray } from '../core/storage.js';
import { MIRROR, mirrorKey, mirrorSave, mirrorWrite } from '../core/mirror.js';
import { logAction } from '../core/backup.js';
import { isAdminOf, sessGet, usersRefresh } from '../core/auth.js';
import { closeModal, pullRender, toast } from '../core/ui.js';
import { hebDate } from '../core/hebrew.js';
import { HR_ORDER_KEY, HR_PERMS_KEY, HR_ROWS_KINDS, HR_ROWS_READ_KEYS, HR_SET_FLAT,
         KV_TABLE, MSG_PERMS_CHANGED_POST, MSG_PERMS_CHANGED_PRE, PEND_KV_PREFIX, PK_SET,
         PK_STUDENT } from './constants.js';
import { AUTH, S, shell } from './state.js';

try { S._heColl = new Intl.Collator('he'); } catch (e) { S._heColl = null; }

var HE = S._heColl || { compare: function (a, b) { return String(a).localeCompare(String(b), 'he'); } };

// רישום הגופן ל-PDF בנקודה אחת לשלושת מסלולי הייצוא.
// ה-API הוא addVirtualFileSystem/addFonts — השמה ל-pdfMake.vfs נכשלת בשקט מ-0.3 ומחזירה גופן בלי עברית.
function hrPdfFont() {
  if (typeof pdfMake === 'undefined' || !S._alefFontB64) return 'Roboto';
  try {
    if (!S._hrPdfFontDone) {
      pdfMake.addVirtualFileSystem({ 'Alef-Regular.ttf': S._alefFontB64 });
      pdfMake.addFonts({ Alef: { normal: 'Alef-Regular.ttf', bold: 'Alef-Regular.ttf',
                                 italics: 'Alef-Regular.ttf', bolditalics: 'Alef-Regular.ttf' } });
      S._hrPdfFontDone = true;
    }
    return 'Alef';
  } catch (e) { console.warn('[pdf] רישום הגופן נכשל', e); return 'Roboto'; }
}

function canAccess(moduleId) {
  if (!AUTH.user) return false;
  var p = AUTH.perms || AUTH.DEFAULT_PERMS;
  var mp = p[moduleId] || {};
  var level = mp[AUTH.user.role] || 'none';
  return level !== 'none';
}

function canEdit(moduleId) {
  if (!AUTH.user) return false;
  var p = AUTH.perms || AUTH.DEFAULT_PERMS;
  var mp = p[moduleId] || {};
  var level = mp[AUTH.user.role] || 'none';
  return level === 'edit';
}

function hrCurrentPage() {
  var el = document.querySelector('.pg.on');
  return (el && el.id.indexOf('pg-') === 0) ? el.id.slice(3) : null;
}

function hrApplyPerms(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  var next = JSON.stringify(p);
  var changed = (next !== JSON.stringify(AUTH.perms || {}));
  AUTH.perms = p;
  // בלי העותק המקומי כניסה אופליין אחרי עדכון הרשאות מחזירה את המטריצה הישנה.
  // lsSet כבר מרימה באנר בעצמה; כאן נרשם גם ליומן.
  try {
    if (!lsSet(HR_PERMS_KEY, next)) {
      console.warn('[perms] העותק המקומי של ההרשאות לא נשמר');
    }
  } catch (e) { console.warn('[perms] lsSet זרקה:', e && e.message); }
  // בלעדיה משיכה שרצה לפני הכניסה הייתה מפעילה showPage('home') וטוסט מעל מסך הכניסה.
  if (!AUTH.user) return changed;
  // מסך פתוח שעדיין מותר נשאר — רק כשההרשאה אליו נשללה יוצאים הביתה עם הודעה.
  if (changed) {
    var cur = hrCurrentPage();
    if (cur && cur !== 'home' && !canAccess(cur)) {
      var lbl = cur;
      for (var i = 0; i < AUTH.MODULES.length; i++) {
        if (AUTH.MODULES[i].id === cur) { lbl = AUTH.MODULES[i].label; break; }
      }
      closeModal();
      shell.showPage('home');
      try { toast(MSG_PERMS_CHANGED_PRE + lbl + MSG_PERMS_CHANGED_POST); } catch (e3) {}
    }
  }
  return changed;
}

// ── עֵד הדחיפה פר-מפתח ──
// נכתב רק אחרי דחיפה שחזרה ok — אין לגזור אותו ממשיכה.
var _hrPushedAt = {};

function _hrMarkPushed(kvKey) { _hrPushedAt[kvKey] = Date.now(); }

function _hrPushedThrough(kvKey) { return _hrPushedAt[kvKey] || 0; }

function _hrPushedFor(kvKey) { return function () { return _hrPushedThrough(kvKey); }; }

function _hrMarkParent(r) { return r ? r.session_client_id : null; }

// נכשל סגור: עמוד שנכשל מחזיר null — «אין ראיה» אינו «הענן ריק».
function _hrVerifyRows(mkQuery) {
  return function () {
    if (!S.SB) return Promise.resolve({ ok: false, rows: [] });
    return _rowsPaged(mkQuery, 'client_id', null)
      .then(function (rs) { return Array.isArray(rs) ? { ok: true, rows: rs } : { ok: false, rows: [] }; },
            function () { return { ok: false, rows: [] }; });
  };
}

// המראה מחזיקה שורות (client_id) והענן רשומות (id) — גישון אחד לשתיהן, אחרת הפינוי נעצר לנצח על «רשומה בלי מזהה».
function _hrRecId(r) {
  if (!r) return null;
  if (r.client_id != null) return r.client_id;
  return (r.id != null) ? r.id : null;
}

// ── אימות מול הענן ──
// מכשיר שרק קורא אינו דוחף ולכן אין לו עֵד — מאמתים פר-רשומה מול העותק הענני של המפתח.
// נכשל סגור: מפתח חסר, כשל רשת או timeout — אין rows ואין פינוי.
function _hrVerify(kvKey) {
  return function () {
    return hrCloudGet(kvKey).then(function (rows) {
      return Array.isArray(rows) ? { ok: true, rows: rows } : { ok: false, rows: [] };
    });
  };
}

// בהיעדר updatedAt החותמת נגזרת מהתאריך הלועזי של הרשומה.
function _hrRecTs(r) {
  if (!r || typeof r !== 'object') return 0;
  if (r.updated_at != null) return Number(r.updated_at) || 0;
  if (r.updatedAt) return Number(r.updatedAt) || 0;
  if (r.date_iso) { var t = dayNoon(r.date_iso).getTime(); return isFinite(t) ? t : 0; }
  if (r.created_at) { var c = Date.parse(r.created_at); return isFinite(c) ? c : 0; }
  return 0;
}

// מסכי ההשגחה פתוחים למנהל וגם לדרגת הביניים שמטריצת ההרשאות מחזיקה — לכן ההשוואה כאן ולא בבלוק המשותף.
function hrSupervisionAccess() {
  var u = sessGet();
  return isAdminOf(u) || (!!u && String(u.role) === 'manager');
}

function hrHwWindowKeys() {
  var now = new Date();
  var stamp = dayToday();
  if (S._hrHwWinKeys && S._hrHwWinDay === stamp) return S._hrHwWinKeys;
  var cur = null, prev = null;
  try { cur = hebDate(now); } catch (e) { cur = null; }
  if (!cur || !cur.ok || !(cur.day > 0)) return null;
  try {
    prev = hebDate(dayNoon(now.getFullYear(), now.getMonth(), now.getDate() - cur.day));
  } catch (e2) { prev = null; }
  if (!prev || !prev.ok) return null;
  var keys = {};
  keys[cur.year + ':' + cur.monthIndex] = true;
  keys[prev.year + ':' + prev.monthIndex] = true;
  S._hrHwWinKeys = keys; S._hrHwWinDay = stamp;
  return keys;
}

function hrHwInWindow(rec) {
  var iso = rec && rec.date_iso;
  if (!iso) return true;
  var t = dayNoon(String(iso)).getTime();
  if (!isFinite(t)) return true;
  var keys = hrHwWindowKeys();
  if (!keys) return true;
  var h = null;
  try { h = hebDate(new Date(t)); } catch (e) { h = null; }
  if (!h || !h.ok) return true;
  return !!keys[h.year + ':' + h.monthIndex];
}

// ── פירוק המראה לשורות והרכבתה ──
// לשורת הסימון חותמת משלה — בלעדיה שני מכשירים שסימנו תלמידים שונים באותו סדר מוכרעים ברמת הרשומה, ואחד מאבד את סימוניו.
// סימון שנמחק נשאר כשורה מסומנת — היעדר נקרא «אין לי» ולא «נמחק».
var HR_MIRROR_STREAMS = {
  hr_sessions:       { kind: 'attend',   child: 'hr_marks' },
  hr_sleep_sessions: { kind: 'sleep',    child: 'hr_sleep_marks' },
  hr_students_rows:  { kind: 'students', child: null }
};

// staleIsDeleted הוא ההבדל: בענן מחיקת סימון היא שורה שחותמתה מאחורי האב, ובמראה — שורה שנושאת deleted.
function hrRecsFromRows(kind, sRows, mRows, staleIsDeleted) {
  var cfg = HR_ROWS_KINDS[kind] || {};
  var byId = {}, out = [];
  (Array.isArray(sRows) ? sRows : []).forEach(function (r) {
    if (!r || r.client_id == null) return;
    var rec = { id: String(r.client_id), marks: {} };
    _hrRowSet(rec, 'session', (r.session == null) ? '' : String(r.session));
    _hrRowSet(rec, 'date_iso', (r.date_iso == null) ? '' : String(r.date_iso));
    if (r.date_heb && typeof r.date_heb === 'object') rec.date_heb = r.date_heb;
    _hrRowSet(rec, 'filled_by', r.filled_by);
    _hrRowSet(rec, 'filled_by_name', r.filled_by_name);
    _hrRowSet(rec, 'created_at', r.created_at);
    _hrRowSet(rec, 'createdBy', r.created_by);
    _hrRowSet(rec, 'deletedBy', r.deleted_by);
    if (typeof r.open === 'boolean') rec.open = r.open;
    if (r.deleted) rec.deleted = true;
    rec.updatedAt = Number(r.updated_at) || 0;
    byId[rec.id] = rec;
    out.push(rec);
  });
  (Array.isArray(mRows) ? mRows : []).forEach(function (m) {
    if (!m || m.deleted) return;
    var rec = byId[String(m.session_client_id)];
    if (!rec) return;
    var mt = Number(m.updated_at) || 0;
    // בענן כל סימון חי נחתם בחותמת האב בכל דחיפה, ושורה ישנה ממנה היא סימון שנמחק; במראה החותמת פר-סימון ואינה עדות.
    if (staleIsDeleted && mt < rec.updatedAt) return;
    var mk = { s: (m.status == null) ? '' : String(m.status), min: Math.round(Number(m.minutes) || 0) };
    if (cfg.note && m.note != null && m.note !== '') mk.note = String(m.note);
    // החותמת פר-סימון מקומית בלבד — hrMarkRows דוחפת s/min/note בלבד.
    mk.ts = mt;
    rec.marks[String(m.student_id)] = mk;
  });
  // מיון מפורש — בלי ORDER BY סדר השורות מהמסד נקבע לפי תוכנית הריצה.
  out.sort(function (a, b) {
    var da = String(a.date_iso || ''), db = String(b.date_iso || '');
    if (da !== db) return da < db ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  return out;
}

// הרשומות מורכבות מהשורות בכל קריאה — אין עותק שני שלהן על הדיסק.
function hrMirrorRecs(t) {
  var st = HR_MIRROR_STREAMS[t];
  if (!st) return null;
  var rows = MIRROR[t];
  if (!Array.isArray(rows)) return null;
  if (st.kind === 'students') {
    return rows.map(function (r) { return r && r.data; })
               .filter(function (r) { return r && typeof r === 'object'; });
  }
  return hrRecsFromRows(st.kind, rows, MIRROR[st.child], false);
}

// ההשוואה קובעת אם החותמת נשמרת — קידום בכל שמירה היה דורס את מה שמכשיר אחר סימן.
function _hrMarkSame(a, b) {
  return a.status === b.status && a.minutes === b.minutes &&
         (a.note == null ? null : a.note) === (b.note == null ? null : b.note);
}

// מצבה נכתבת רק לסדר שנמצא בקלט — משיכת חלון מוסרת רשומות שמחוצה לו, ואין למחוק את סימוניהן.
function _hrSplitRecs(t, recs, tomb) {
  var st = HR_MIRROR_STREAMS[t];
  var arr = Array.isArray(recs) ? recs : [];
  if (st.kind === 'students') {
    return { sRows: arr.map(hrStudentRow).filter(function (r) { return !!r; }), mRows: null };
  }
  var prev = {};
  (Array.isArray(MIRROR[st.child]) ? MIRROR[st.child] : []).forEach(function (r) {
    if (r && r.client_id != null) prev[String(r.client_id)] = r;
  });
  var sRows = [], mRows = [], live = {}, seen = {}, now = Date.now();
  arr.forEach(function (rec) {
    var s = hrSessionRow(rec);
    if (!s) return;
    sRows.push(s);
    seen[s.client_id] = 1;
    hrMarkRows(rec, st.kind).forEach(function (row) {
      var old = prev[row.client_id];
      if (old && !old.deleted && _hrMarkSame(old, row)) row.updated_at = old.updated_at;
      live[row.client_id] = 1;
      mRows.push(row);
    });
  });
  Object.keys(prev).forEach(function (k) {
    if (live[k]) return;
    var old = prev[k];
    // כתיבה גולמית אינה שומרת שורה שאין לה סימון בקלט — שורת סימון של סדר שפונה היא יתומה.
    if (!tomb) return;
    // שורה שאביה אינו בקלט אינה נמחקת — לא נשאלו עליה.
    if (!seen[String(old.session_client_id)]) { mRows.push(old); return; }
    if (old.deleted) {
      // מצבה נגרעת באותו סף גיל של מצבות הרשומות, ואינה נשמרת לנצח.
      if (now - (Number(old.updated_at) || 0) < TOMBSTONE_TTL_MS) mRows.push(old);
      return;
    }
    var d = {};
    Object.keys(old).forEach(function (kk) { d[kk] = old[kk]; });
    d.deleted = true;
    d.updated_at = now;
    mRows.push(d);
  });
  return { sRows: sRows, mRows: mRows };
}

// רק הכתיבה הזו מסמנת מחיקות — סימון שנעלם מהקלט נמחק, ופינוי אינו מחיקה.
function hrMirrorPutRecs(t, recs) {
  var st = HR_MIRROR_STREAMS[t];
  if (!st) return false;
  var r = _hrSplitRecs(t, recs, true);
  MIRROR[t] = r.sRows;
  if (!st.child) return mirrorSave(t);
  MIRROR[st.child] = r.mRows;
  var a = mirrorSave(t), b = mirrorSave(st.child);
  return a && b;
}

// אינה מסמנת מחיקה — סדר שפונה מהדיסק אינו סדר שנמחק.
function hrMirrorWriteRecs(t, recs) {
  var st = HR_MIRROR_STREAMS[t];
  if (!st) return false;
  var r = _hrSplitRecs(t, recs, false);
  if (!st.child) return mirrorWrite(t, r.sRows);
  var a = mirrorWrite(t, r.sRows), b = mirrorWrite(st.child, r.mRows);
  return a && b;
}

// שורות {key, value, updated_at} כצורת הטבלה בענן — מפתח שטוח לכל הגדרה אינו מוכרע במנוע השורות.
// שתי רשימות הטיפולים נשארות שטוחות — הפינוי מפנה אותן פר-רשומה.
function _hrCfgRows() { return Array.isArray(MIRROR[KV_TABLE]) ? MIRROR[KV_TABLE] : []; }

function hrCfgLocalGet(key) {
  var rows = _hrCfgRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && String(rows[i].key) === String(key)) return rows[i].value;
  }
  return null;
}

function hrCfgLocalSet(key, value) {
  var rows = _hrCfgRows().filter(function (r) { return r && String(r.key) !== String(key); });
  rows.push({ key: String(key), value: value, updated_at: Date.now() });
  MIRROR[KV_TABLE] = rows;
  return mirrorSave(KV_TABLE);
}

// מפה של מזהה תלמיד ⟵ חותמת המחיקה — היא שמונעת מסימון שנמחק לחזור מהענן.
function hrMarkTombs(t, sid) {
  var st = HR_MIRROR_STREAMS[t], out = {};
  if (!st || !st.child) return out;
  (Array.isArray(MIRROR[st.child]) ? MIRROR[st.child] : []).forEach(function (r) {
    if (!r || !r.deleted) return;
    if (String(r.session_client_id) !== String(sid)) return;
    out[String(r.student_id)] = Number(r.updated_at) || 0;
  });
  return out;
}

// משפך כתיבה אחד לדיסק — אתר כתיבה נפרד יכול לעקוף את שער החלון החם ולהחזיר לדיסק את מה שהפינוי הוציא.
function _hrAtDiskSave(rows) {
  return hrMirrorPutRecs('hr_sessions', rows);
}

function _hrSlDiskSave(rows) {
  return hrMirrorPutRecs('hr_sleep_sessions', rows);
}

// הרשומה נכתבת כשורה עם data, והקריאה מרכיבה אותה בחזרה.
function _hrStDiskSave(rows) {
  return hrMirrorPutRecs('hr_students_rows', rows);
}

// ── חיבור האפליקציה למודול הממתינים ──

function _hrMarkSynced() { S._hrLastSyncAt = Date.now(); }

// משיכה מלאה וריקון התור בלי תלות ב-last_changed — המשתמש ביקש במפורש.
async function hrSyncNow() {
  await hrPullFromCloud();
  await hrPushToCloud();
  _hrMarkSynced();
}

// ── ההגדרות ──
// המשיכה מדלגת על מפתח שממתין לסנכרון — ערך מרוחק היה דורס את מה שטרם עלה.
// onConflict הוא key ולא client_id — מיפתוח לפי מזהה מכשיר היה יוצר שתי שורות לאותה הגדרה.
function hrSetPending(key) { return pendHas(PK_SET + key); }

function hrSetLocal(key) {
  var flat = HR_SET_FLAT[key];
  if (!flat) return hrCfgLocalGet(key);
  try { var v = JSON.parse(lsGet(flat) || 'null'); return Array.isArray(v) ? v : null; }
  catch (e) { return null; }
}

async function hrCfgSet(key, value) {
  var flat = HR_SET_FLAT[key];
  if (flat) lsSetArray(flat, value, _hrRecTs);
  else hrCfgLocalSet(key, value);
  pendMark(PK_SET + key);
  schedulePush();
  return {};
}

function hrSetDirtyRows() {
  var out = [];
  Object.keys(pendAll()).forEach(function (pk) {
    if (pk.indexOf(PK_SET) !== 0) return;
    var k = pk.slice(PK_SET.length);
    out.push({ key: k, value: JSON.stringify(hrSetLocal(k)), updated_at: Date.now() });
  });
  return out;
}

function hrSetSend(rows) {
  return withTimeout(S.SB.from(KV_TABLE).upsert(rows, { onConflict: 'key' }));
}

// המקור שמחזור הדחיפה קורא כשאין לו קלט מהכותב.
function hrLocalRecs(t) {
  return t === 'hr_students_rows' ? _hrStudentsRaw() : hrMirrorRecs(t);
}

// ── רישום כשל כתיבה שנבלע ──
// catch ריק סביב תצוגה או קריאה נשאר כמות שהוא — רישום שם היה מציף את היומן.
// הרישום עצמו עטוף — שער שנופל בתוך שער אינו שער.
function hrWriteFail(where, e) {
  try { lsLog('write-fail', String(where) + ' — ' + ((e && e.message) || e), 0); } catch (e2) { }
}

async function hrTouchLastChanged() {
  return await plTouch();
}

// keepLocal נדלק כשהצד המרוחק הוא חלון — רשומה מחוץ לחלון לא נשאלה, והיעדרותה אינה עדות.
// בלי הדגל משיכת חודש אחד הייתה גורפת מהדיסק את כל השאר.
function _hrSessionsMerge(cloudArr, localArr, logKey, keepLocal) {
  // רשומה מקומית-בלבד בלי updatedAt אינה חוזרת — מניעת תחייה.
  if (!Array.isArray(cloudArr)) return Array.isArray(localArr) ? localArr : [];
  if (!Array.isArray(localArr)) return cloudArr;
  // מפתח שאין לו שכבת שורות (הטיפולים) ממוזג ברמת הרשומה.
  var pair = HR_MIRROR_STREAMS[logKey] ? hrSessionPairFor(logKey) : null;
  return hrMergeRecords(localArr, cloudArr, function(r){ return r && r.id; }, !!keepLocal, null,
                        hrPendingFor(logKey || 'sessions'), pair);
}

// null פירושו «טרם נמשכה» — ובספק דוחפים: שורה שלא נדחפה חסרה בשקט, ודחיפה מיותרת עולה רק בתעבורה.
// מפה נפרדת לכל מסלול — מזהי סדר של נוכחות ושל שינה חיים במרחבים נפרדים.
var _hrRowsRemote = { attend: null, sleep: null };

// אינה קריאת נתונים — אינה מזינה מסך ולא מיזוג, רק קובעת מה כבר בענן.
async function hrRowsRemoteLoad(kind) {
  kind = kind || 'attend';
  if (_hrRowsRemote[kind]) return _hrRowsRemote[kind];
  try {
    var res = await withTimeout(S.SB.from(HR_ROWS_KINDS[kind].parent).select('client_id,updated_at'));
    if (!res || res.error || !Array.isArray(res.data)) return null;
    var map = {};
    res.data.forEach(function (r) { if (r) map[String(r.client_id)] = Number(r.updated_at) || 0; });
    _hrRowsRemote[kind] = map;
    return map;
  } catch (e) { return null; }
}

// date_heb נשמר כמות שהוא — אין לגזור אותו מחדש מ-date_iso.
function hrSessionRow(rec) {
  if (!rec || rec.id == null) return null;
  return {
    client_id: String(rec.id),
    session: String(rec.session || ''),
    date_iso: String(rec.date_iso || ''),
    date_heb: (rec.date_heb && typeof rec.date_heb === 'object') ? rec.date_heb : null,
    filled_by: (rec.filled_by == null || rec.filled_by === '') ? null : Number(rec.filled_by),
    filled_by_name: rec.filled_by_name == null ? null : String(rec.filled_by_name),
    created_at: rec.created_at == null ? null : String(rec.created_at),
    created_by: rec.createdBy == null ? null : String(rec.createdBy),
    deleted_by: rec.deletedBy == null ? null : String(rec.deletedBy),
    open: (typeof rec.open === 'boolean') ? rec.open : null,
    deleted: !!rec.deleted,
    deleted_at: rec.deleted ? tombAt(_hrRecTs(rec)) : null,
    updated_at: Math.round(Number(_hrRecTs(rec)) || 0)
  };
}

// client_id נגזר מ-<סדר>:<תלמיד> ואינו uuid חדש — מזהה שני היה מאפשר לסימון להתקיים פעמיים.
// הסימון יורש את חותמת האב ולא Date.now() — חותמת חדשה הייתה דורסת עריכה מקומית שטרם עלתה.
function hrMarkRows(rec, kind) {
  var out = [];
  if (!rec || rec.id == null) return out;
  var wantNote = !!(HR_ROWS_KINDS[kind || 'attend'] || {}).note;
  var marks = (rec.marks && typeof rec.marks === 'object') ? rec.marks : {};
  var sid = String(rec.id);
  var d = String(rec.date_iso || '');
  var del = !!rec.deleted;
  var ts = Math.round(Number(_hrRecTs(rec)) || 0);
  Object.keys(marks).forEach(function (k) {
    // מחרוזת בלי המרה מספרית — student_id הוא text ומזהה תלמיד מהמכשיר הוא uuid; Number(k) מחזיר NaN.
    var m = marks[k] || {};
    var row = {
      client_id: sid + ':' + k,
      session_client_id: sid,
      student_id: String(k),
      date_iso: d,
      status: (m.s == null) ? null : String(m.s),
      minutes: Math.round(Number(m.min) || 0),
      deleted: del,
      deleted_at: del ? tombAt(ts) : null,
      updated_at: ts
    };
    // note במסלול השינה בלבד — שדה עודף ב-upsert מפיל את הבקשה כולה.
    // נשלח גם כשהוא ריק — null מפורש מוחק הערה בענן, והשמטת המפתח משאירה את הישנה.
    if (wantNote) row.note = (m.note == null || m.note === '') ? null : String(m.note);
    out.push(row);
  });
  return out;
}

// data ולא עמודות — רשומת התלמיד בעלת צורה משתנה, ופיצוצה לעמודות היה מקור אמת שני לצורתה.
function hrStudentRow(rec) {
  if (!rec || rec.id == null) return null;
  return {
    client_id: String(rec.id),
    // מחרוזת ולא מספר — העמודה היא text ומזהה תלמיד הוא uuid.
    student_id: String(rec.id),
    updated_at: Math.round(Number(_hrRecTs(rec)) || 0),
    deleted: !!rec.deleted,
    deleted_at: rec.deleted ? tombAt(_hrRecTs(rec)) : null,
    data: rec
  };
}

// דחיפה במנות — הדחיפה הראשונה במכשיר נוגעת בכל הסדרים, וגוף בקשה בגודל כזה נדחה או נחתך.
// מנה שנכשלה מפילה את כל הדחיפה — הצלחה חלקית הייתה מעדכנת את מפת החותמות ומונעת ניסיון חוזר.
var HR_ROWS_CHUNK = 500;

async function hrRowsUpsert(table, rows) {
  if (!rows || !rows.length) return true;
  for (var i = 0; i < rows.length; i += HR_ROWS_CHUNK) {
    var res = await withTimeout(
      S.SB.from(table).upsert(rows.slice(i, i + HR_ROWS_CHUNK), { onConflict: 'client_id' }));
    if (!res || res.error) return false;
  }
  return true;
}

// רשומה ממתינה נחשבת תמיד «לדחיפה» — אחרת היא נשארת מסומנת לנצח. המצבה נדחפת בשלמותה, בלי מפת חותמות.
// null הוא «אין ראיה» ולא «אין מה לדחוף» — ואז אין לסמן את עֵד הפינוי.
async function hrPushDirty(key, arr) {
  if (!Array.isArray(arr)) return null;
  var kind = HR_ROWS_READ_KEYS[key];
  if (!kind) return null;
  if (kind === 'students') return arr;
  var cfg = HR_ROWS_KINDS[kind];
  if (!cfg) return null;
  var map = await hrRowsRemoteLoad(kind);
  var dirty = [];
  arr.forEach(function (rec) {
    if (!rec || rec.id == null) return;
    var ts = Math.round(Number(_hrRecTs(rec)) || 0);
    var known = map ? map[String(rec.id)] : undefined;
    if (map === null || known === undefined || ts > known || pendHas(cfg.pk + rec.id)) dirty.push(rec);
  });
  return dirty;
}

// האב נכתב לפני הבן. אין מפתח זר פיזי — רשומות מגיעות ממכשירים אופליין בסדר לא ידוע, ו-FK היה דוחה סימון שהקדים את אביו.
async function hrSendRecs(key, recs) {
  var kind = HR_ROWS_READ_KEYS[key];
  if (kind === 'students') {
    var stRows = [];
    recs.forEach(function (rec) { var r = hrStudentRow(rec); if (r) stRows.push(r); });
    if (!stRows.length) return {};
    if (!(await hrRowsUpsert('hr_students_rows', stRows))) return { error: { message: 'hr_students_rows' } };
    return {};
  }
  var cfg = HR_ROWS_KINDS[kind];
  var sRows = [], mRows = [];
  recs.forEach(function (rec) {
    var r = hrSessionRow(rec);
    if (r) { sRows.push(r); mRows = mRows.concat(hrMarkRows(rec, kind)); }
  });
  if (!sRows.length) return {};
  if (!(await hrRowsUpsert(cfg.parent, sRows))) return { error: { message: cfg.parent } };
  if (!(await hrRowsUpsert(cfg.child, mRows)))  return { error: { message: cfg.child } };
  if (!_hrRowsRemote[kind]) _hrRowsRemote[kind] = {};
  sRows.forEach(function (r) { _hrRowsRemote[kind][r.client_id] = r.updated_at; });
  return {};
}

// התאריך פרמטר — בדיקת הכפילות בפתיחת סדר צריכה את היום שנבחר בבורר, שאינו בהכרח היום.
function hrDayWin(iso) {
  var t = iso ? String(iso) : dayIso(new Date());
  return { col: 'date_iso', from: t, to: t };
}

// שדה שערכו null בטבלה אינו נכתב לרשומה — ברשומה הוא נעדר, ו-null מפורש היה משנה את צורתה ומזליג הפרש למיזוג.
function _hrRowSet(rec, k, v) { if (v !== null && v !== undefined) rec[k] = v; }

// החלון חל על שתי הטבלאות — לסימון date_iso משלו, זהה לתאריך הסדר; סינון הסדרים לבדם היה מושך את כל הסימונים.
async function hrRowsGetSessions(kind, win) {
  kind = kind || 'attend';
  var cfg = HR_ROWS_KINDS[kind];
  if (!cfg || !S.SB) return { ok: false, data: null };
  try {
    var scols = 'client_id,session,date_iso,date_heb,filled_by,filled_by_name,created_at,created_by,deleted_by,open,deleted,updated_at';
    var mcols = 'session_client_id,student_id,status,minutes,deleted,updated_at' + (cfg.note ? ',note' : '');
    var both = await Promise.all([
      _rowsPaged(function () { return S.SB.from(cfg.parent).select(scols); }, 'client_id', win),
      _rowsPaged(function () { return S.SB.from(cfg.child).select(mcols); }, 'client_id', win)
    ]);
    var rs = both[0], rm = both[1];
    if (!rs || !rm) return { ok: false, data: null };
    // staleIsDeleted — בענן כל שורות הסדר נחתמות בחותמת האב, ושורה שנשארה מאחור היא סימון שנמחק.
    return { ok: true, data: hrRecsFromRows(kind, rs, rm, true) };
  } catch (e) { return { ok: false, data: null }; }
}

async function hrRowsGetStudents() {
  if (!S.SB) return { ok: false, data: null };
  try {
    // המצבה נמשכת מלאה בלי חלון — אין בטבלה עמודת תאריך.
    var rs = await _rowsPaged(function () {
      return S.SB.from('hr_students_rows').select('client_id,updated_at,deleted,data');
    }, 'client_id', null);
    if (!rs) return { ok: false, data: null };
    var out = [];
    rs.forEach(function (r) {
      if (!r || !r.data || typeof r.data !== 'object') return;
      out.push(r.data);
    });
    return { ok: true, data: out };
  } catch (e) { return { ok: false, data: null }; }
}

async function hrRowsGet(kvKey, win) {
  var k = HR_ROWS_READ_KEYS[kvKey];
  if (!k) return { ok: false, data: null };
  return (k === 'students') ? hrRowsGetStudents() : hrRowsGetSessions(k, win);
}

// אין נפילה-חזרה ל-kv — מפתח שיש לו טבלה נקרא ממנה בלבד, ומפתח הגדרות מ-hr_settings.
// כשל רשת מחזיר null ולא מערך ריק — מיזוג מול ריק היה מוחק את מה שלא עלה.
// החלון עובר עד לשאילתה — חלון שנעצר כאן משלם על הרשת פעמיים.
async function hrCloudGet(kvKey, win) {
  if (!HR_ROWS_READ_KEYS[kvKey]) return hrCfgGet(kvKey);
  var r = null;
  try { r = await hrRowsGet(kvKey, win); } catch (e) { r = null; }
  if (!r || !r.ok || !Array.isArray(r.data)) return null;
  // הראיה העננית נרשמת כאן ולא באתרי הקריאה, ורק במשיכה מלאה — משיכת חלון אינה אומרת דבר על מה שמחוצה לו.
  if (!win && r.data.length) {
    try { hwNoteCloud(mirrorKey(kvKey), r.data); } catch (e1) { }
  }
  return r.data;
}

// timeout חובה — ברשת חצי מחוברת fetch אינו מצליח ואינו נכשל. maybeSingle ולא single — מפתח שטרם נכתב אינו שגיאה.
// res מבחין בין «אין ערך» ל«הענן לא ענה» — שניהם null, ובלעדיו מפתח שטרם נכתב נקרא כרענון שנכשל.
function hrCfgGet(key, res) {
  return withTimeout(S.SB.from(KV_TABLE).select('value').eq('key', key).maybeSingle()).then(function(r){
    var pr = r && r.data ? kvParse(key, r.data.value) : { ok: true, value: null, bad: false };
    return res ? { ok: pr.ok && !(r && r.error), value: pr.value, error: pr.bad ? MSG_KV_BAD : null } : pr.value;
  }, function(e){
    if (res) return { ok: false, value: null };
    throw e;
  });
}

// אין לעטוף כאן את bkMaybeDaily — גיבוי שנתלה במסלול הדחיפה אינו רץ כשאין כתיבה; נקודת ההפעלה היא bkBoot() מ-loadDash().
function hrSyncLog(action, key, recordCount, details) {
  logAction(action, key, recordCount, details);
}

function hrCount(v) {
  return Array.isArray(v) ? v.length
       : (v && typeof v === 'object' ? Object.keys(v).length
       : (v == null ? 0 : 1));
}

// ── מנוע המיזוג ברמת רשומה ──
// היעדר רשומה אצל צד אחד אינו מחיקה — מחיקה היא deleted=true עם updatedAt, ובלעדיו רשומות שנמחקו חוזרות.
function hrRecTs(r) { return (r && typeof r === 'object' && r.updatedAt) ? r.updatedAt : 0; }

// רשומת סדר בלי marks הייתה זורקת ומרוקנת מסך שלם — כל אתר קריאה עובר כאן.
// רשומה בלי marks מקבלת אותם משורות המראה — רשומה שנבנתה לפני שהסימונים הורכבו הייתה מחזירה ריק.
function hrMarks(rec) {
  if (rec && rec.marks && typeof rec.marks === 'object') return rec.marks;
  if (!rec || rec.id == null) return {};
  var got = null;
  Object.keys(HR_MIRROR_STREAMS).forEach(function (t) {
    if (got || !HR_MIRROR_STREAMS[t].child) return;
    var one = hrRecsFromRows(HR_MIRROR_STREAMS[t].kind,
      [{ client_id: String(rec.id), updated_at: hrRecTs(rec) }], MIRROR[HR_MIRROR_STREAMS[t].child], false);
    if (one.length && Object.keys(one[0].marks).length) got = one[0].marks;
  });
  return got || {};
}

// לתיעוד בלבד — אינו משפיע על מיזוג, סינון או חישוב.
function hrWho() { return (AUTH.user && AUTH.user.full_name) ? AUTH.user.full_name : null; }

// remoteDupe: 'last' ולא 'ts' — כפילות במערך המרוחק מוכרעת לפי הסדר; אין ליישר לשם אחידות, זה משנה איזו רשומה שורדת.
// remote == null מתקפל ל-keepUnversionedLocal — צד שלא נקרא הוא «אין ראיה» ולא «הענן ריק».
// mergePair אופציונלי, לרשומה שנושאת מערך פריטים; אין להעביר מפה — המנוע קורא ערך שאינו מערך כמערך ריק.
function hrMergeRecords(local, remote, getKey, keepUnversionedLocal, onDrop, isPending, mergePair) {
  if (remote == null && local == null) return local;
  var keepLocal = !!keepUnversionedLocal || remote == null;
  return tombPruneMerged(mergeCore(local, remote, {
    getKey: getKey, ts: hrRecTs, isPending: isPending, onDrop: onDrop, mergePair: mergePair,
    keepUnversionedLocal: keepLocal, dedupe: true, remoteDupe: 'last'
  }));
}

// הטיפולים הם הגדרה אחת — כל רשומה בהם ממתינה כל עוד ההגדרה ממתינה; מפתח בלי סימון מחזיר null.
// הקידומת נגזרת מ-PEND_KV_PREFIX — מיפוי שני היה כותב סימון תחת מפתח אחד וקורא תחת אחר.
function hrPendingFor(kvKey) {
  for (var sk in HR_SET_FLAT) {
    if (HR_SET_FLAT[sk] === kvKey) return function () { return hrSetPending(sk); };
  }
  var pfx = PEND_KV_PREFIX[kvKey];
  if (!pfx) return null;
  return function (k) { return pendHas(pfx + k); };
}

// ── מיזוג ההיעדרויות שברשומת התלמיד ──
// מערך בתוך רשומה ממוזג פר-פריט — מיזוג ברמת רשומה היה מוחק היעדרות שמכשיר אחר הוסיף. הענן מנצח בשוויון.
// פריט בלי חותמת נושא ts=0 ואין לחתום אותו ב-Date.now() — מכשיר שרק פתח את המסך היה דורס עריכה אמיתית.
function hrAbsValueKey(a) {
  return [a && a.type || '', a && a.reason || '', a && a.from || '', a && a.to || ''].join('\u0001');
}

function hrMergeAbsences(loc, rem, base) {
  var L = Array.isArray(loc) ? loc : [], R = Array.isArray(rem) ? rem : [];
  var by = {}, order = [], out = [];
  R.concat(L).forEach(function (a) {
    if (!a || typeof a !== 'object' || a.id == null) return;
    var k = String(a.id);
    if (!(k in by)) { by[k] = a; order.push(k); return; }
    if (hrRecTs(a) > hrRecTs(by[k])) by[k] = a; // שוויון — מי שכבר נבחר, כלומר הענן
  });
  order.forEach(function (k) { out.push(by[k]); });
  // פריט בלי id נשאר מהצד שניצח ברמת הרשומה ואינו נשמט.
  var baseArr = Array.isArray(base && base.absences) ? base.absences : [];
  baseArr.forEach(function (a) { if (a && typeof a === 'object' && a.id == null) out.push(a); });
  // הרשימה ממוינת לפני הכיווץ, שמשאיר את הראשון: חותמת חדשה, ובשוויון המזהה הקטן — הכרעה זהה בשני המכשירים.
  // המפסיד יורד בסימון ולא בהיעדר, ובחותמת המנצח ולא Date.now() — אחרת המכשירים מכריעים הפוך זה מזה בלי סוף.
  var ranked = out.filter(function (a) { return a && !a.deleted && a.id != null; })
    .sort(function (a, b) {
      return (hrRecTs(b) - hrRecTs(a)) || (String(a.id) < String(b.id) ? -1 : 1);
    });
  var win = {};
  uniqList(ranked, hrAbsValueKey).forEach(function (a) { win[hrAbsValueKey(a)] = a; });
  return out.map(function (a) {
    if (!a || a.deleted || a.id == null) return a;
    var w = win[hrAbsValueKey(a)];
    if (!w || String(w.id) === String(a.id)) return a;
    var d = {};
    Object.keys(a).forEach(function (kk) { d[kk] = a[kk]; });
    d.deleted = true; d.updatedAt = hrRecTs(w);
    return d;
  });
}

// ── מיזוג הסימונים שברשומת הסדר ──
// הסימונים ממוזגים פר-תלמיד — מיזוג ברמת רשומה היה מוחק סימונים של מכשיר אחר באותו סדר.
// מצבת מחיקה גוברת על סימון שאינו חדש ממנה — אחרת סימון שנמחק חוזר מהענן.
function hrMarkTs(m, parentTs) {
  var t = m && Number(m.ts);
  return (isFinite(t) && t > 0) ? t : (Number(parentTs) || 0);
}

// deletedAt היא מפת המצבות — מפתח שאין בה נקרא «אין לי» ולא «נמחק».
function hrMergeMarks(locMarks, remMarks, deletedAt, locTs, remTs) {
  var L = (locMarks && typeof locMarks === 'object') ? locMarks : {};
  var R = (remMarks && typeof remMarks === 'object') ? remMarks : {};
  var keys = {};
  var out = {};
  Object.keys(R).forEach(function (s) { keys[s] = 1; });
  Object.keys(L).forEach(function (s) { keys[s] = 1; });
  Object.keys(keys).forEach(function (sid) {
    var lm = L[sid], rm = R[sid];
    var lt = lm ? hrMarkTs(lm, locTs) : -1, rt = rm ? hrMarkTs(rm, remTs) : -1;
    // שוויון — הענן, כמו במנוע הרשומות.
    var win = (lt > rt) ? lm : (rm || lm);
    var wt = (lt > rt) ? lt : rt;
    var dt = Number(deletedAt[sid]) || 0;
    if (dt >= wt) return;
    out[sid] = win;
  });
  return out;
}

function hrSessionPairFor(t) {
  return function (loc, rem, k, pend) {
    var base = (pend || hrRecTs(loc) > hrRecTs(rem)) ? loc : rem; // שוויון — הענן
    var out = {};
    Object.keys(base).forEach(function (kk) { out[kk] = base[kk]; });
    out.marks = hrMergeMarks(loc.marks, rem.marks, hrMarkTombs(t, k), hrRecTs(loc), hrRecTs(rem));
    return out;
  };
}

function hrStudentPair(loc, rem, k, pend) {
  var base = (pend || hrRecTs(loc) > hrRecTs(rem)) ? loc : rem; // שוויון — הענן
  var out = {};
  Object.keys(base).forEach(function (kk) { out[kk] = base[kk]; });
  out.absences = hrMergeAbsences(loc.absences, rem.absences, base);
  return out;
}

function _hrStudentsRaw() { return hrMirrorRecs('hr_students_rows') || []; }

function _hrStudentsSaveRaw(s) { _hrStDiskSave(s); }

// המצבה ממוזגת מול הענן לפני שהיא נדחפת; כל השאר נדחף מהעותק המקומי בשכבת הדחיפה.
async function hrPushToCloud() {
  var _t0 = Date.now(); // לפני קריאת המצב המקומי — עריכה שנעשית באמצע אינה נזקפת לדחיפה הזו
  // המשתמש יכול להתחלף באמצע — כל כתיבה אחרי המתנה נבדקת מול ההקשר שנלכד.
  var _ep = ctxEpoch();
  try {
    var localSt = _hrStudentsRaw();
    if (!localSt.length) localSt = getStudents();
    var remoteSt = null; try { remoteSt = await hrCloudGet('hr_students_rows'); } catch(e1) {}
    if (ctxStale(_ep)) return;
    _hrStudentsSaveRaw(hrMergeRecords(localSt, remoteSt, function(r){ return r.id; }, false, null,
                                      hrPendingFor('hr_students_rows'), hrStudentPair));
  } catch (e) { hrWriteFail('hrPushToCloud', e); }
  var r = await pushDirty(null);
  if (ctxStale(_ep)) return;
  if (r.ok) pendConfirmPush(PK_STUDENT, _t0);
  if (r.n) hrSyncLog('push', null, r.n);
  // still הוא מה שלא עלה — שורה אחת בו חוסמת את זריקת העידן.
  eraNotePush(r);
}

async function hrPullFromCloud() {
  // המשתמש יכול להתחלף בין המשיכה לכתיבה — מה שנמזג עבור הקודם היה יורד לדיסק של החדש.
  var _ep = ctxEpoch();
  try {
    var s = await hrCloudGet('hr_students_rows');
    if (ctxStale(_ep)) return;
    if (s !== null && Array.isArray(s)) {
      var mergedS = hrMergeRecords(_hrStudentsRaw(), s, function(r){ return r.id; }, false, null,
                                   hrPendingFor('hr_students_rows'));
      _hrStudentsSaveRaw(mergedS);
    }
    var atSess = await hrCloudGet('hr_sessions');
    if (ctxStale(_ep)) return;
    if (atSess && Array.isArray(atSess)) {
      var _atLocal = hrMirrorRecs('hr_sessions') || [];
      var _atMerge = _hrSessionsMerge(atSess, _atLocal, 'hr_sessions');
      _hrAtDiskSave(_atMerge);
      S._atData = _atMerge;
    }
    var hrSess = await hrCloudGet('hr_sleep_sessions');
    if (ctxStale(_ep)) return;
    if (hrSess && Array.isArray(hrSess)) {
      var _hrLocal2 = hrMirrorRecs('hr_sleep_sessions') || [];
      var _hrMerge = _hrSessionsMerge(hrSess, _hrLocal2, 'hr_sleep_sessions');
      _hrSlDiskSave(_hrMerge);
      S._hrData = _hrMerge;
    }
    // הגדרה שממתינה לסנכרון אינה נדרסת — הערך המקומי טרם עלה.
    var abR = await hrCfgGet('absence_reasons');
    if (ctxStale(_ep)) return;
    if (abR && typeof abR === 'object' && !Array.isArray(abR) && !hrSetPending('absence_reasons')) {
      hrCfgLocalSet('absence_reasons', abR);
    }
    // hr_cls_years אינו נמשך — השורה מחוקה רכות בענן, ומשיכתה הייתה מחזירה אותה למסך כחיה.
    try {
      var _atCfgV = await hrCfgGet('attend_cfg');
      if (ctxStale(_ep)) return;
      if (_atCfgV && typeof _atCfgV === 'object' && !hrSetPending('attend_cfg')) { S._atCfg = _atCfgV; hrCfgLocalSet('attend_cfg', _atCfgV); }
      var _hrCfgV = await hrCfgGet('sleep_cfg');
      if (ctxStale(_ep)) return;
      if (_hrCfgV && typeof _hrCfgV === 'object' && !hrSetPending('sleep_cfg')) { S._hrCfg = (typeof _hrCleanCfg === 'function') ? _hrCleanCfg(_hrCfgV) : _hrCfgV; hrCfgLocalSet('sleep_cfg', _hrCfgV); }
    } catch (eCfg) { hrWriteFail('hrPullFromCloud', eCfg); }
    // ההרשאות נמשכות גם כאן ולא רק בכניסה — שינוי מגיע תוך שניות. עטוף בנפרד כדי שכשל לא יפיל את שאר המשיכה.
    // מטריצה פגומה או ריקה נדחית ב-hrApplyPerms ואינה נועלת את המשתמש.
    try {
      var pmV = await hrCfgGet('perms');
      if (ctxStale(_ep)) return;
      if (pmV && typeof pmV === 'object' && !Array.isArray(pmV) && Object.keys(pmV).length && !hrSetPending('perms')) {
        if (hrApplyPerms(pmV)) console.log('[perms] עודכנו מהענן בזמן אמת');
      }
    } catch(ePm) { console.warn('[perms] משיכה נכשלה:', ePm && ePm.message); }
    pullRender(shell.hrPullDraw);
    usersRefresh();
    hrSyncLog('pull', null, null);
  } catch(e) { console.error('[sync] pull error:', e); }
}

// הסוג עובר במחלקה שמציבה משתנה --ty אחד; סוג לא מוכר נופל לברירת המחדל של abs-tone ואינו יוצר גוון רביעי.
function tyCls(t) {
  return (t === 'approved' || t === 'suspended' || t === 'left') ? 'abs-tone-' + t : '';
}

// הגוון באסימון --at-<קוד>, והמחלקה מציבה אותו במשתנה --at; קוד לא מוכר נשאר בברירת המחדל.
function atvCls(code) {
  var v = ['p', 'l', 'e', 'x', 'ap', 'ak', 'a'].indexOf(code) < 0 ? '' : 'at-code-' + code;
  return 'at-code' + (v ? ' ' + v : '');
}

// נקרא מהתצוגה המחושבת — אלמנט שהוסתר במחלקה מחזיר style.display ריק ונקרא כפתוח.
// פרטית כאן: משרתת את הלוח הקופץ, שמוסתר במחלקה.
function uiShown(el) {
  if (!el) return false;
  return getComputedStyle(el).display !== 'none';
}

function modalOpen() {
  var m = document.getElementById('modal');
  return !!(m && m.classList.contains('open'));
}

// מראה ריקה היא רשימה ריקה — רשימה שנשתלת בקוד נכנסת למיזוג בלי חותמת ובמזהה שאינו של המכשיר.
function getStudents(){try{var s=hrMirrorRecs('hr_students_rows');if(!Array.isArray(s))return [];return s.filter(function(x){return !(x&&x.deleted);});}catch(e){console.warn('[students] hr_students_rows פגום — נטענה רשימה ריקה:',e.message);return [];}}

// מקבלת את הרשימה הנראית ומחברת בחזרה את המחוקים מהאחסון הגולמי — כך המצבות שורדות כל מחזור קריאה-שמירה.
function saveStudents(s){
  try {
    var raw=_hrStudentsRaw();
    var have={}; s.forEach(function(x){ if(x&&x.id!=null) have[String(x.id)]=1; });
    var tombs=raw.filter(function(x){ return x&&x.deleted&&x.id!=null&&!have[String(x.id)]; });
    if (tombs.length) s=s.concat(tombs);
  } catch(e){}
  // הערך המוחזר נבדק במסלול הייבוא — באחסון מלא lsSet מחזירה false, והודעת הצלחה עליה היא כישלון שקט.
  return _hrStDiskSave(s);
}

// מחזירה עותק ואינה ממיינת במקום — הקוראים מחזיקים את הרשימה גם לחיפוש ולספירה.
function hrSortStudents(list) {
  if (!Array.isArray(list)) return [];
  var ord = { a: 0, b: 1, g: 2 };
  return list.slice().sort(function (x, y) {
    // שיעור שאינו מהשלושה יורד לסוף — תלמיד שסיווגו ריק היה נופל בין א׳ לב׳.
    var ox = ord[x && x.cls] != null ? ord[x.cls] : 99;
    var oy = ord[y && y.cls] != null ? ord[y.cls] : 99;
    if (ox !== oy) return ox - oy;
    return HE.compare((x && x.name) || '', (y && y.name) || '');
  });
}

function getActiveAbsences(s, refDate) {
  var now = refDate || new Date();
  if (!Array.isArray(s.absences)) return [];
  return s.absences.filter(function(a){ return !a.deleted && (!a.from || new Date(a.from) <= now) && (!a.to || new Date(a.to) >= now); });
}

function sortUsersByOrder(data) {
  var order = getUserOrder();
  if (!order.length) return data;
  return data.slice().sort(function(a,b) {
    var ia = order.indexOf(String(a.id));
    var ib = order.indexOf(String(b.id));
    if (ia===-1) ia = 9999;
    if (ib===-1) ib = 9999;
    return ia - ib;
  });
}

function getUserOrder() {
  try { return JSON.parse(lsGet(HR_ORDER_KEY) || '[]'); } catch(e) { return []; }
}

function getAbsenceReasons() {
  try { return hrCfgLocalGet('absence_reasons') || getDefaultReasons(); } catch(e) { return getDefaultReasons(); }
}

function getDefaultReasons() {
  return {
    approved: ['חופשה', 'אירוע משפחתי', 'רפואי', 'אחר'],
    suspended: ['משמעת', 'אחר'],
    left: ['לא חזר מחופשה', 'עזב לצמיתות', 'אחר']
  };
}

function _hrCleanCfg(cfg) {
  // cfg בלי sessions מקבל את ברירת המחדל, והיא נכתבת גם למסד
  if (!cfg || !Array.isArray(cfg.sessions) || cfg.sessions.length === 0) {
    var def = hrDefaultCfg();
    if (cfg) { cfg.sessions = def.sessions; } else { cfg = def; }
    try { hrCfgSet('sleep_cfg', cfg); } catch (e) { hrWriteFail('_hrCleanCfg', e); }
  }
  return cfg;
}

function hrDefaultCfg() {
  return {
    sessions:[
      {id:'n1',name:'דו"ח יומי'}
    ],
    treats:['שיחה אישית','אזהרה','שיחת הורים','זימון לרב','אחר']
  };
}

export { HE, HR_MIRROR_STREAMS, _hrAtDiskSave, _hrCleanCfg, _hrMarkParent, _hrMarkPushed,
         _hrMarkSynced, _hrPushedFor, _hrRecId, _hrRecTs, _hrSessionsMerge, _hrSlDiskSave,
         _hrStudentsRaw, _hrStudentsSaveRaw, _hrVerify, _hrVerifyRows, atvCls, canAccess,
         getAbsenceReasons, getActiveAbsences, getStudents, hrAbsValueKey, hrApplyPerms,
         hrCfgGet, hrCfgLocalGet, hrCfgLocalSet, hrCfgSet, hrCloudGet, hrCount, hrDayWin,
         hrDefaultCfg, hrHwInWindow, hrLocalRecs, hrMarks, hrMirrorRecs,
         hrMirrorWriteRecs, hrPdfFont, hrPullFromCloud, hrPushDirty, hrPushToCloud,
         hrSendRecs, hrSetDirtyRows, hrSetPending, hrSetSend, hrSortStudents,
         hrSupervisionAccess, hrSyncLog, hrSyncNow, hrTouchLastChanged, hrWho,
         hrWriteFail, modalOpen, saveStudents, sortUsersByOrder, tyCls, uiShown };
