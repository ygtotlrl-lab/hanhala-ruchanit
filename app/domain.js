// app/domain.js — המראה, הסנכרון, המיזוג, ההרשאות ובורר התאריך
import { HE_COLLATOR, MSG_KV_BAD, dayIso, dayNoon, kvParse, uniqList,
         withTimeout } from '../core/util.js';
import { _rowsPaged, ctxEpoch, ctxStale, eraNotePush, mergeCore, mergeWinner,
         pendConfirmPush, pendHas, pendMark, pendMarkMany, plTouch, pushDirty, schedulePush,
         tombInherit, tombKill } from '../core/sync.js';
import { hwNoteCloud, lsGet, lsLog, lsSet, lsSetArray, lsWindowFrom } from '../core/storage.js';
import { MIRROR, mirrorKey, mirrorSave, mirrorWrite } from '../core/mirror.js';
import { logAction } from '../core/backup.js';
import { isAdminOf, sessGet, usersRefresh } from '../core/auth.js';
import { closeModal, pullRender, toast } from '../core/ui.js';
import { HR_ORDER_KEY, HR_PERMS_KEY, HR_ROWS_KINDS, HR_ROWS_READ_KEYS, HR_SET_FLAT,
         KV_TABLE, MSG_PERMS_CHANGED_POST, MSG_PERMS_CHANGED_PRE, PEND_KV_PREFIX, PK_SET,
         PK_STUDENT } from './constants.js';
import { AUTH, S, shell } from './state.js';

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

function _hrRowId(r) { return r ? r.client_id : null; }

// פריט בתוך ערך הגדרות — הטיפולים — נושא מפתח משלו.
function _hrItemId(r) { return r ? r.id : null; }

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


// מסכי ההשגחה פתוחים למנהל וגם לתפקיד הביניים שמטריצת ההרשאות מחזיקה — לכן ההשוואה כאן ולא בבלוק המשותף.
function hrSupervisionAccess() {
  var u = sessGet();
  return isAdminOf(u) || (!!u && String(u.role) === 'manager');
}

// החלון החם הוא חלון הפינוי של האפליקציה — מהליבה, ולא מספר ימים משלו; הסדר ובניו נמדדים באותו session_date,
// ולכן סימון יורד מהדיסק יחד עם אביו. תאריך שאינו נקרא — הרשומה נשארת: פינוי בלי גיל הוא היעדר ראיה כראיה.
function hrHwInWindow(rec) {
  var iso = rec && rec.session_date;
  if (!iso) return true;
  var t = dayNoon(String(iso)).getTime();
  if (!isFinite(t)) return true;
  return t >= lsWindowFrom();
}

// שאלה אחת לענן לכל סוג — הסדרים והסימונים שלהם באים באותה קריאה, והחלון החם שואל על שניהם ברצף;
// שתי שאלות היו מושכות את הסימונים פעמיים.
var HR_HW_ASK_MS = 10000;
var _hrHwAsk = {};
function hrHwFetch(t) {
  var kind = null, child = false;
  Object.keys(HR_MIRROR_STREAMS).forEach(function (p) {
    var st = HR_MIRROR_STREAMS[p];
    if (!st.child) return;
    if (p === t) kind = st.kind;
    else if (st.child === t) { kind = st.kind; child = true; }
  });
  if (!kind) return Promise.resolve({ ok: false, rows: [] });
  var memo = _hrHwAsk[kind], now = Date.now();
  if (!memo || now - memo.at > HR_HW_ASK_MS) memo = _hrHwAsk[kind] = { at: now, p: hrRowsGetSessions(kind, null) };
  return memo.p.then(function (r) {
    if (!r || !r.ok) return { ok: false, rows: [] };
    // הסדר — כרשומה מורכבת, כפי שהארכיון מציג; הסימון — כשורה, כפי שהמראה מחזיקה.
    return { ok: true, rows: child ? r.mRows : r.data };
  }, function () { return { ok: false, rows: [] }; });
}

// ── פירוק המראה לשורות והרכבתה ──
// לשורת הסימון חותמת משלה — בלעדיה שני מכשירים שסימנו תלמידים שונים באותו סדר מוכרעים ברמת הרשומה, ואחד מאבד את סימוניו.
// סימון שנמחק נשאר כשורה מסומנת — היעדר נקרא «אין לי» ולא «נמחק».
var HR_MIRROR_STREAMS = {
  hr_sessions:       { kind: 'attend',   child: 'hr_marks' },
  hr_sleep_sessions: { kind: 'sleep',    child: 'hr_sleep_marks' },
  hr_students_rows:  { kind: 'students', child: null }
};

// הרשומה בזיכרון מורכבת משורת הסדר ומשורות הסימון החיות — סימון שנמחק הוא שורה שנושאת deleted, בענן ובמראה כאחד.
function hrRecsFromRows(kind, sRows, mRows) {
  var cfg = HR_ROWS_KINDS[kind] || {};
  var byId = {}, out = [];
  (Array.isArray(sRows) ? sRows : []).forEach(function (r) {
    if (!r || r.client_id == null) return;
    var rec = { client_id: String(r.client_id), marks: {} };
    _hrRowSet(rec, 'session', (r.session == null) ? '' : String(r.session));
    _hrRowSet(rec, 'session_date', (r.session_date == null) ? '' : String(r.session_date));
    _hrRowSet(rec, 'created_by_client_id', (r.created_by_client_id == null) ? null : String(r.created_by_client_id));
    _hrRowSet(rec, 'filled_by_name', r.filled_by_name);
    _hrRowSet(rec, 'created_at', r.created_at);
    _hrRowSet(rec, 'deleted_at', r.deleted_at);
    _hrRowSet(rec, 'deleted_by', r.deleted_by);
    if (typeof r.open === 'boolean') rec.open = r.open;
    if (r.deleted) rec.deleted = true;
    rec.updated_at = Number(r.updated_at) || 0;
    byId[rec.client_id] = rec;
    out.push(rec);
  });
  (Array.isArray(mRows) ? mRows : []).forEach(function (m) {
    if (!m || m.deleted) return;
    var rec = byId[String(m.session_client_id)];
    if (!rec) return;
    var mt = Number(m.updated_at) || 0;
    var mk = { status: (m.status == null) ? '' : String(m.status), minutes: Math.round(Number(m.minutes) || 0) };
    if (cfg.note && m.note != null && m.note !== '') mk.note = String(m.note);
    mk.updated_at = mt;
    rec.marks[String(m.student_client_id)] = mk;
  });
  // מיון מפורש — בלי ORDER BY סדר השורות מהמסד נקבע לפי תוכנית הריצה.
  return hrSortRecs(out);
}

// רשומות סדר ושינה — לפי התאריך, ובתוכו לפי המזהה; הטעינה וכל מסלולי הייצוא ממיינים כאן.
function hrSortRecs(list) {
  return list.slice().sort(function (a, b) {
    var da = String(a.session_date || ''), db = String(b.session_date || '');
    if (da !== db) return da < db ? -1 : 1;
    return String(a.client_id) < String(b.client_id) ? -1 : 1;
  });
}

// הרשומות מורכבות מהשורות בכל קריאה — אין עותק שני שלהן על הדיסק.
function hrMirrorRecs(t) {
  var st = HR_MIRROR_STREAMS[t];
  if (!st) return null;
  var rows = MIRROR[t];
  if (!Array.isArray(rows)) return null;
  if (st.kind === 'students') return rows.map(hrStudentRec).filter(function (r) { return !!r; });
  return hrRecsFromRows(st.kind, rows, MIRROR[st.child]);
}

// ההשוואה קובעת אם החותמת נשמרת — קידום בכל שמירה היה דורס את מה שמכשיר אחר סימן.
function _hrMarkSame(a, b) {
  return (a.status || '') === (b.status || '') && Number(a.minutes || 0) === Number(b.minutes || 0) &&
         (a.note || null) === (b.note || null);
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
      // לכל סימון חותמת משלו, והוא נחתם רק כשהשתנה — מחיקת האב עוברת אליו בירושה ובחותמת האב.
      if (row.deleted) { if (old && old.deleted && old.deleted_at === row.deleted_at) row = old; }
      else if (old && !old.deleted && _hrMarkSame(old, row)) row = old;
      else if (old || !(row.updated_at > 0)) row.updated_at = now;
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
    // המצבה נשארת — הגריעה על תוצאת המיזוג בלבד.
    if (old.deleted) { mRows.push(old); return; }
    var d = {};
    Object.keys(old).forEach(function (kk) { d[kk] = old[kk]; });
    mRows.push(tombKill(d, now));
  });
  return { sRows: sRows, mRows: mRows };
}

// רק הכתיבה הזו מסמנת מחיקות — סימון שנעלם מהקלט נמחק, ופינוי אינו מחיקה.
// כתיבת משתמש מסמנת ⏳ כל רשומה שהשתנתה מול המראה, או שסימון שלה השתנה; כתיבה שמקורה במיזוג — fromMerge — אינה מסמנת.
function hrMirrorPutRecs(t, recs, fromMerge) {
  var st = HR_MIRROR_STREAMS[t];
  if (!st) return false;
  var r = _hrSplitRecs(t, recs, true);
  if (!fromMerge) _hrMarkChanged(t, r);
  MIRROR[t] = r.sRows;
  if (!st.child) return mirrorSave(t);
  MIRROR[st.child] = r.mRows;
  var a = mirrorSave(t), b = mirrorSave(st.child);
  return a && b;
}

// צורה קנונית להשוואה, גם בתוך data — jsonb מחזיר את המפתחות בסדר משלו, ולא בסדר שבו נבנו כאן.
function _hrCanon(v) {
  if (Array.isArray(v)) return v.map(_hrCanon);
  if (!v || typeof v !== 'object') return v == null ? null : v;
  var o = {};
  Object.keys(v).sort().forEach(function (k) { o[k] = _hrCanon(v[k]); });
  return o;
}
function _hrRowSig(r) { return JSON.stringify(_hrCanon(r)); }
function _hrRowMap(rows) {
  var m = {};
  (Array.isArray(rows) ? rows : []).forEach(function (r) { if (r && r.client_id != null) m[String(r.client_id)] = _hrRowSig(r); });
  return m;
}
function _hrMarkChanged(t, r) {
  var pk = PEND_KV_PREFIX[t], st = HR_MIRROR_STREAMS[t];
  if (!pk) return;
  var ps = _hrRowMap(MIRROR[t]), keys = {};
  r.sRows.forEach(function (s) { if (ps[String(s.client_id)] !== _hrRowSig(s)) keys[pk + s.client_id] = 1; });
  if (st.child && r.mRows) {
    var pm = _hrRowMap(MIRROR[st.child]);
    var mpk = PEND_KV_PREFIX[st.child];
    r.mRows.forEach(function (m) { if (pm[String(m.client_id)] !== _hrRowSig(m)) keys[mpk + m.client_id] = 1; });
  }
  pendMarkMany(Object.keys(keys));
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

// משפך כתיבה אחד לדיסק — אתר כתיבה נפרד יכול לעקוף את שער החלון החם ולהחזיר לדיסק את מה שהפינוי הוציא.
function _hrAtDiskSave(rows, fromMerge) {
  return hrMirrorPutRecs('hr_sessions', rows, fromMerge);
}

function _hrSlDiskSave(rows, fromMerge) {
  return hrMirrorPutRecs('hr_sleep_sessions', rows, fromMerge);
}

// הרשומה נכתבת כשורה עם data, והקריאה מרכיבה אותה בחזרה.
function _hrStDiskSave(rows, fromMerge) {
  return hrMirrorPutRecs('hr_students_rows', rows, fromMerge);
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
  if (flat) lsSetArray(flat, value, hrRecTs);
  else hrCfgLocalSet(key, value);
  pendMark(PK_SET + key);
  schedulePush();
  return {};
}

// כל מפתח שנכתב מקומית — שורות ההגדרות והטיפולים השטוחים; הסינון לממתין בשכבת הדחיפה.
function hrSetRows() {
  var keys = uniqList(_hrCfgRows().map(function (r) { return String(r.key); }).concat(Object.keys(HR_SET_FLAT)));
  return keys.map(function (k) {
    return { key: k, value: JSON.stringify(hrSetLocal(k)), updated_at: Date.now() };
  });
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

// הטיפולים — פריטים בתוך ערך הגדרות, ממוזגים ב-mergeCore במפתח id; רשומה מקומית-בלבד נשארת.
function hrTreatsMerge(cloudArr, localArr, flatKey) {
  if (!Array.isArray(cloudArr)) return Array.isArray(localArr) ? localArr : [];
  if (!Array.isArray(localArr)) return cloudArr;
  return mergeCore(localArr, cloudArr, { key: 'id', isPending: hrPendingFor(flatKey) });
}

function hrSessionRow(rec) {
  if (!rec || rec.client_id == null) return null;
  return {
    client_id: String(rec.client_id),
    session: String(rec.session || ''),
    session_date: rec.session_date ? String(rec.session_date) : null,
    created_by_client_id: (rec.created_by_client_id == null || rec.created_by_client_id === '') ? null : String(rec.created_by_client_id),
    filled_by_name: rec.filled_by_name == null ? null : String(rec.filled_by_name),
    // timestamptz — מחרוזת ריקה היא שגיאת המרה בשרת, והשורה כולה נדחית.
    created_at: rec.created_at ? String(rec.created_at) : null,
    deleted_by: rec.deleted_by == null ? null : String(rec.deleted_by),
    open: (typeof rec.open === 'boolean') ? rec.open : null,
    deleted: !!rec.deleted,
    deleted_at: rec.deleted_at == null ? null : rec.deleted_at,
    updated_at: Math.round(hrRecTs(rec))
  };
}

// client_id נגזר מ-<סדר>:<תלמיד> ואינו uuid חדש — מזהה שני היה מאפשר לסימון להתקיים פעמיים.
// החותמת היא של הסימון עצמו — _hrSplitRecs חותמת רק סימון שהשתנה, ומחיקת הסדר עוברת אליו בירושה.
function hrMarkRows(rec, kind) {
  var out = [];
  if (!rec || rec.client_id == null) return out;
  var wantNote = !!(HR_ROWS_KINDS[kind || 'attend'] || {}).note;
  var marks = (rec.marks && typeof rec.marks === 'object') ? rec.marks : {};
  var sid = String(rec.client_id);
  var d = rec.session_date ? String(rec.session_date) : null;
  var del = !!rec.deleted;
  Object.keys(marks).forEach(function (k) {
    // מחרוזת בלי המרה מספרית — student_client_id הוא text ומזהה תלמיד מהמכשיר הוא uuid; Number(k) מחזיר NaN.
    var m = marks[k] || {};
    var row = {
      client_id: sid + ':' + k,
      session_client_id: sid,
      student_client_id: String(k),
      session_date: d,
      status: (m.status == null) ? null : String(m.status),
      minutes: Math.round(Number(m.minutes) || 0),
      deleted: false,
      deleted_at: null,
      deleted_by: null,
      updated_at: Math.round(Number(m.updated_at) || 0)
    };
    if (del) tombInherit(rec, row);
    // note במסלול השינה בלבד — שדה עודף ב-upsert מפיל את הבקשה כולה.
    // נשלח גם כשהוא ריק — null מפורש מוחק הערה בענן, והשמטת המפתח משאירה את הישנה.
    if (wantNote) row.note = (m.note == null || m.note === '') ? null : String(m.note);
    out.push(row);
  });
  return out;
}

// data ולא עמודות — רשומת התלמיד בעלת צורה משתנה, ופיצוצה לעמודות היה מקור אמת שני לצורתה.
var HR_STUDENT_COLS = ['client_id', 'updated_at', 'deleted', 'deleted_at', 'deleted_by'];
function hrStudentRow(rec) {
  if (!rec || rec.client_id == null) return null;
  var data = {};
  Object.keys(rec).forEach(function (k) { if (HR_STUDENT_COLS.indexOf(k) < 0) data[k] = rec[k]; });
  return {
    client_id: String(rec.client_id),
    updated_at: Math.round(hrRecTs(rec)),
    deleted: !!rec.deleted,
    deleted_at: rec.deleted_at == null ? null : rec.deleted_at,
    deleted_by: rec.deleted_by == null ? null : String(rec.deleted_by),
    data: data
  };
}

// הרשומה בזיכרון היא העמודות ו-data יחד — שדה שיש לו עמודה נקרא בשמה, ו-data נושא רק את השאר.
function hrStudentRec(r) {
  if (!r || r.client_id == null || !r.data || typeof r.data !== 'object') return null;
  var rec = {};
  Object.keys(r.data).forEach(function (k) { if (HR_STUDENT_COLS.indexOf(k) < 0) rec[k] = r.data[k]; });
  rec.client_id = String(r.client_id);
  rec.updated_at = Number(r.updated_at) || 0;
  if (r.deleted) rec.deleted = true;
  if (r.deleted_at != null) rec.deleted_at = r.deleted_at;
  if (r.deleted_by != null) rec.deleted_by = r.deleted_by;
  return rec;
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
  var sRows = [];
  recs.forEach(function (rec) { var r = hrSessionRow(rec); if (r) sRows.push(r); });
  if (!sRows.length) return {};
  if (!(await hrRowsUpsert(cfg.parent, sRows))) return { error: { message: cfg.parent } };
  return {};
}

// שורות הסימון נדחפות כפי שהן במראה — כל אחת בחותמת משלה, בטבלה שאחרי האב ב-PUSH_TABLES.
async function hrSendMarks(t, rows) {
  if (!(await hrRowsUpsert(t, rows))) return { error: { message: t } };
  return {};
}

// הסדר והסימון ממוזגים כל אחד בטבלתו ב-mergeCore, כמו כל טבלה במראה, והרשומה בזיכרון מורכבת מהשורות בקריאה.
// null — «אין ראיה»: המראה אינה נגעת. חלון משאיר את מה שמחוצה לו — רשומה מקומית-בלבד נשארת במיזוג.
async function hrSessionsPull(t, win) {
  var st = HR_MIRROR_STREAMS[t], _ep = ctxEpoch();
  if (!st || !st.child) return null;
  var r = null;
  try { r = await hrRowsGetSessions(st.kind, win); } catch (e) { r = null; }
  if (ctxStale(_ep) || !r || !r.ok) return null;
  var pend = function (tt) { return function (k) { return pendHas(PEND_KV_PREFIX[tt] + k); }; };
  MIRROR[t] = mergeCore(MIRROR[t] || [], r.sRows, { isPending: pend(t) });
  MIRROR[st.child] = mergeCore(MIRROR[st.child] || [], r.mRows, { isPending: pend(st.child) });
  // הראיה העננית לפני הכתיבה — שער הדיסק מפנה רק מה שהענן כבר הראה, וכתיבה שקודמת לה מעלה לדיסק את הכול.
  if (!win) hrHwNote(t, r);
  mirrorSave(t); mirrorSave(st.child);
  return hrMirrorRecs(t);
}

// הראיה העננית לאב ולבנו — לסימון שער דיסק משלו, והראיה עליו היא שורות הסימון שבאו באותה קריאה.
function hrHwNote(t, r) {
  var st = HR_MIRROR_STREAMS[t];
  try {
    if (r && Array.isArray(r.data) && r.data.length) hwNoteCloud(mirrorKey(t), r.data);
    if (st && st.child && r && Array.isArray(r.mRows) && r.mRows.length) hwNoteCloud(mirrorKey(st.child), r.mRows);
  } catch (e) { hrWriteFail('hrHwNote', e); }
}

// התאריך פרמטר — בדיקת הכפילות בפתיחת סדר צריכה את היום שנבחר בבורר, שאינו בהכרח היום.
function hrDayWin(iso) {
  var t = iso ? String(iso) : dayIso(new Date());
  return { col: 'session_date', from: t, to: t };
}

// שדה שערכו null בטבלה אינו נכתב לרשומה — ברשומה הוא נעדר, ו-null מפורש היה משנה את צורתה ומזליג הפרש למיזוג.
function _hrRowSet(rec, k, v) { if (v !== null && v !== undefined) rec[k] = v; }

// החלון חל על שתי הטבלאות — לסימון session_date משלו, זהה לתאריך הסדר; סינון הסדרים לבדם היה מושך את כל הסימונים.
async function hrRowsGetSessions(kind, win) {
  kind = kind || 'attend';
  var cfg = HR_ROWS_KINDS[kind];
  if (!cfg || !S.SB) return { ok: false, data: null };
  try {
    var scols = 'client_id,session,session_date,created_by_client_id,filled_by_name,created_at,deleted_at,deleted_by,open,deleted,updated_at';
    var mcols = 'client_id,session_client_id,student_client_id,session_date,status,minutes,deleted,deleted_at,deleted_by,updated_at' + (cfg.note ? ',note' : '');
    var both = await Promise.all([
      _rowsPaged(function () { return S.SB.from(cfg.parent).select(scols); }, 'client_id', win),
      _rowsPaged(function () { return S.SB.from(cfg.child).select(mcols); }, 'client_id', win)
    ]);
    var rs = both[0], rm = both[1];
    if (!rs || !rm) return { ok: false, data: null };
    return { ok: true, data: hrRecsFromRows(kind, rs, rm), sRows: rs, mRows: rm };
  } catch (e) { return { ok: false, data: null }; }
}

async function hrRowsGetStudents() {
  if (!S.SB) return { ok: false, data: null };
  try {
    // המצבה נמשכת מלאה בלי חלון — אין בטבלה עמודת תאריך.
    var rs = await _rowsPaged(function () {
      return S.SB.from('hr_students_rows').select('client_id,updated_at,deleted,deleted_at,deleted_by,data');
    }, 'client_id', null);
    if (!rs) return { ok: false, data: null };
    return { ok: true, data: rs.map(hrStudentRec).filter(function (r) { return !!r; }) };
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
  if (!win) hrHwNote(kvKey, r);
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
// היעדר רשומה אצל צד אחד אינו מחיקה — מחיקה היא deleted=true עם updated_at, ובלעדיו רשומות שנמחקו חוזרות.
function hrRecTs(r) { var t = r && typeof r === 'object' ? Number(r.updated_at) : NaN; return isFinite(t) ? t : 0; }

// רשומת סדר בלי marks הייתה זורקת ומרוקנת מסך שלם — כל אתר קריאה עובר כאן.
// רשומה בלי marks מקבלת אותם משורות המראה — רשומה שנבנתה לפני שהסימונים הורכבו הייתה מחזירה ריק.
function hrMarks(rec) {
  if (rec && rec.marks && typeof rec.marks === 'object') return rec.marks;
  if (!rec || rec.client_id == null) return {};
  var got = null;
  Object.keys(HR_MIRROR_STREAMS).forEach(function (t) {
    if (got || !HR_MIRROR_STREAMS[t].child) return;
    var one = hrRecsFromRows(HR_MIRROR_STREAMS[t].kind,
      [{ client_id: String(rec.client_id), updated_at: hrRecTs(rec) }], MIRROR[HR_MIRROR_STREAMS[t].child]);
    if (one.length && Object.keys(one[0].marks).length) got = one[0].marks;
  });
  return got || {};
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

// ההיעדרויות שבתוך רשומת התלמיד ממוזגות פריט-פריט במפתח id — מיזוג ברמת רשומה היה מוחק היעדרות שמכשיר אחר הוסיף.
function hrStudentPair(loc, rem, k, pend) {
  var base = mergeWinner(loc, rem, pend);
  var out = {};
  Object.keys(base).forEach(function (kk) { out[kk] = base[kk]; });
  out.absences = mergeCore(loc.absences, rem.absences, { key: 'id', isPending: function () { return pend; } });
  return out;
}

function _hrStudentsRaw() { return hrMirrorRecs('hr_students_rows') || []; }

function _hrStudentsSaveRaw(s, fromMerge) { _hrStDiskSave(s, fromMerge); }

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
    _hrStudentsSaveRaw(mergeCore(localSt, remoteSt, { isPending: hrPendingFor('hr_students_rows'),
                                                      mergePair: hrStudentPair }), true);
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
      var mergedS = mergeCore(_hrStudentsRaw(), s, { isPending: hrPendingFor('hr_students_rows'),
                                                      mergePair: hrStudentPair });
      _hrStudentsSaveRaw(mergedS, true);
    }
    var atRecs = await hrSessionsPull('hr_sessions');
    if (ctxStale(_ep)) return;
    if (atRecs) S._atData = atRecs;
    var slRecs = await hrSessionsPull('hr_sleep_sessions');
    if (ctxStale(_ep)) return;
    if (slRecs) S._hrData = slRecs;
    // הגדרה שממתינה לסנכרון אינה נדרסת — הערך המקומי טרם עלה.
    var abR = await hrCfgGet('absence_reasons');
    if (ctxStale(_ep)) return;
    if (abR && typeof abR === 'object' && !Array.isArray(abR) && !hrSetPending('absence_reasons')) {
      hrCfgLocalSet('absence_reasons', abR);
    }
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
    var have={}; s.forEach(function(x){ if(x&&x.client_id!=null) have[String(x.client_id)]=1; });
    var tombs=raw.filter(function(x){ return x&&x.deleted&&x.client_id!=null&&!have[String(x.client_id)]; });
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
    return HE_COLLATOR.compare((x && x.name) || '', (y && y.name) || '');
  });
}

// ── רגע ההיעדרות ──
// נשמר כמחרוזת ISO ב-UTC, בשם <תפקיד>_at; הקלט וההשוואה ליום הסדר — בשעה המקומית, 'YYYY-MM-DDTHH:MM'.
function hrAtOfLocal(local) {
  if (!local) return null;
  var d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function hrLocalOfAt(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return dayIso(d) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function getActiveAbsences(s, refDate) {
  var now = refDate || new Date();
  if (!Array.isArray(s.absences)) return [];
  return s.absences.filter(function(a){ return !a.deleted && (!a.from_at || new Date(a.from_at) <= now) && (!a.to_at || new Date(a.to_at) >= now); });
}

// הסטטוסים של תלמיד — האחרון ראשון.
function hrSortStatuses(list) {
  var ts = function (a) { var d = new Date(a && a.from_at); return isNaN(d.getTime()) ? 0 : d.getTime(); };
  return list.slice().sort(function (a, b) { return ts(b) - ts(a); });
}

// המשתמשים — בסדר שנגרר בהגדרות; מי שאינו בו יורד לסוף.
function hrSortUsers(data) {
  var order = getUserOrder();
  if (!order.length) return data;
  return data.slice().sort(function(a,b) {
    var ia = order.indexOf(String(a.client_id));
    var ib = order.indexOf(String(b.client_id));
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

export { HR_MIRROR_STREAMS, _hrAtDiskSave, _hrCleanCfg, _hrMarkParent, _hrMarkPushed, _hrItemId,
         _hrMarkSynced, _hrPushedFor, _hrRowId, _hrSlDiskSave, _hrStudentsRaw, _hrStudentsSaveRaw,
         _hrVerify, _hrVerifyRows, atvCls, canAccess, getAbsenceReasons, getActiveAbsences,
         getStudents, hrApplyPerms, hrAtOfLocal, hrLocalOfAt, hrCfgGet, hrCfgLocalGet,
         hrCfgLocalSet, hrCfgSet, hrCloudGet, hrCount, hrDayWin, hrDefaultCfg, hrHwFetch, hrHwInWindow,
         hrLocalRecs, hrMarks, hrMirrorRecs, hrRecTs, hrMirrorWriteRecs, hrPdfFont, hrPullFromCloud,
         hrPushToCloud, hrSendMarks, hrSendRecs, hrSessionsPull, hrSetPending, hrSetRows, hrSetSend,
         hrSortRecs, hrSortStatuses, hrSortStudents, hrSortUsers, hrSupervisionAccess, hrSyncLog,
         hrSyncNow, hrTouchLastChanged, hrTreatsMerge, hrWriteFail, modalOpen, saveStudents, tyCls,
         uiShown };
