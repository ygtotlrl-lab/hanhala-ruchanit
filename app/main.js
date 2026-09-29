// app/main.js — העלייה, הניווט, מפת הפעולות ובורר התאריך העברי
import { MSG_OFF_USER_WRITE, appConfigure, dayIso, dayNoon, getDeviceId,
         withTimeout } from '../core/util.js';
import { _eraPush, ctxEpoch, ctxStale, eraKeys, pendAlertDismiss, pendCount, pendHas,
         plStampRead, runSave, sbWatch } from '../core/sync.js';
import { lsClearHorizons, lsGet, lsRemove } from '../core/storage.js';
import { logAwait } from '../core/backup.js';
import { MIRROR, mirrorKey, mirrorTables, mirrorWrite } from '../core/mirror.js';
import { authUsersTable, isAdmin, lkReset, sessActive, sessGet, sessSet,
         usersSanitize } from '../core/auth.js';
import { actRun, closeAsk, closeModal, comboInput, comboKey, comboOutside,
         comboPick, esc, ksKey, modalBackdrop, modalEsc, openModal, swApply, swHideUpdate,
         toast } from '../core/ui.js';
import { hebDayLabel } from '../core/hebrew.js';
import { HR_MIRROR_TABLES, HR_ORDER_KEY, HR_PERMS_KEY,
         HR_SET_FLAT, KV_TABLE, MSG_ACCESS_LIMITED, MSG_PICK_STUDENT, MSG_SOON_TITLE,
         MSG_TABLES_MISSING, PEND_KV_PREFIX, PK_SET,
         PUSH_TABLES } from './constants.js';
import { AUTH, S, shell } from './state.js';
import { _hrMarkParent, _hrMarkPushed, _hrMarkSynced, _hrItemId, _hrPushedFor, _hrRowId,
         _hrVerify, _hrVerifyRows, canAccess, hrHwFetch, hrHwInWindow, hrLocalRecs,
         hrMirrorRecs, hrMirrorWriteRecs, hrPullFromCloud, hrPushToCloud,
         hrSendMarks, hrSendRecs, hrSetRows, hrSetSend, hrSyncNow, hrWriteFail,
         hrRecTs, uiShown } from './domain.js';
import { _hcBase, _hcFmt, _hcG, _hcH, _hcMN, _hcYL } from './domain.hebdate.js';
import { atRenderTodaySessions } from './screens/attend.js';
import { loadDash, refreshDashStats, screenHomeHTML } from './screens/home.js';
import { closeUserMenu, confirmSwitch, doLogin, doLogout, loadPerms, screenLoginHTML,
         switchUserEl, toggleUserMenu } from './screens/login.js';
import { addAbsenceReason, changeMyPassword, myPasswordModal, openAddUser, openEditUser,
         renderSettings, renderUsersList, saveAbsenceReasons, savePerms, saveUser,
         saveUserOrder, screenSettingsHTML, showSettingsHome, showSettingsModule,
         toggleUserActive } from './screens/settings.js';
import { hrRenderTodaySessions } from './screens/sleep.js';
import { MANAGE_PICK, cancelSingleAbsence, doYearTransition, editStudent, filterClass,
         importStudentsFromFile, openAttendanceEdit, openManageListDlg,
         openStatusForm, openStatusHistory, openStatusPickerModal, printStudents,
         renderStudents, saveStudent, saveStudentStatus, screenStudentsHTML,
         setStudentActive, setStudentInactive } from './screens/students.js';
import { atDeleteSession, atExportConfirm, atRenderArchive,
         atShowExportDialog } from './screens/attend.arc.js';
import { atCancelStudentStatusFromReg, atClearMark, atCloseSession, atConfirmLate,
         atEditSession, atFillSessionBtns, atOpenSession, atRenderStudents, atSetLateMin,
         atSetMark, atShowTab, loadAttend,
         screenAttendHTML } from './screens/attend.reg.js';
import { atAddSession, atAddTreat, atAddTreatRow, atDeleteTreat, atEditMark,
         atRenderSupervision, atSaveSettingsCfg, atSupDetail, atSupEditMarkDlg, atSupNav,
         renderAttendSettings } from './screens/attend.sup.js';
import { hrDeleteSession, hrExportConfirm, hrRenderArchive,
         hrShowExportDialog } from './screens/sleep.arc.js';
import { hrCancelStudentStatusFromReg, hrClearMark, hrCloseSession, hrConfirmLate,
         hrEditSession, hrFillSessionBtns, hrOpenSession, hrRenderStudents, hrSetLateMin,
         hrSetMark, hrSetNote, hrShowTab, loadSleep,
         screenSleepHTML } from './screens/sleep.reg.js';
import { hrAddTreat, hrAddTreatRow, hrDeleteTreat, hrEditMark, hrRenderSupervision,
         hrSaveSettingsCfg, hrSupDetail, hrSupEditMarkDlg, hrSupNav,
         renderSleepSettings } from './screens/sleep.sup.js';

// ── החיווט ──
// החיווט נמסר בשומרי קריאה — ה-CFG מוגדרים בהמשך, והשומר קורא אותם בזמן הקריאה ולא בזמן המסירה.
appConfigure({
  get BK_CFG() { return BK_CFG; },
  get DEV_CFG() { return DEV_CFG; },
  get DOM_ACTIONS() { return DOM_ACTIONS; },
  get ERA_CFG() { return ERA_CFG; },
  get HW_CFG() { return HW_CFG; },
  get LK_CFG() { return LK_CFG; },
  get LS_CFG() { return LS_CFG; },
  get MIRROR_CFG() { return MIRROR_CFG; },
  get PEND_CFG() { return PEND_CFG; },
  get PL_CFG() { return PL_CFG; },
  get PUSH_CFG() { return PUSH_CFG; },
  get RTY_CFG() { return RTY_CFG; },
  get USER_CFG() { return USER_CFG; },
  get saveRefresh() { return saveRefresh; }
});

var MIRROR_CFG = {
  prefix: self.APP.prefix + 'mirror_',
  tables: function () { return HR_MIRROR_TABLES; },
  noPush: [{ t: 'hr_users',       via: 'writeUser',  adds: 'secret' }],
  empty:  function () { return null; },
  ts:     function (r) { return hrRecTs(r); },
  clean:  function (t, rows) { return t === authUsersTable() ? usersSanitize(rows) : rows; },
  fail:   function (where, e) { hrWriteFail(where, e); },
};

// חלון אחד לאב ולבניו — בן שחלונו קצר מאביו משאיר סדר בלי סימונים.
var LS_CFG = {
  // cachePrefix נגזר משם האפליקציה שבתצורה ולא מקידומת האחסון — שם אחסון שישתנה היה מחזיר רשימה ריקה, והבאנר היה חוזר בכל טעינה.
  cachePrefix: self.APP.id + '-',
  logKey: 'hr_ls_log',
  hzPrefix: 'hr_ls_hz_',
  // חובה בתחילית האפליקציה — ה-origin משותף, וסימן בלי תחילית נדרס בכל דחייה.
  dismissKey: 'hr_sw_dismissed',
  // מפתח שאינו במרשם נמחק בעלייה.
  keys: function () {
    return [LS_CFG.logKey, LS_CFG.dismissKey, DEV_CFG.key, PEND_CFG.key,
            BK_CFG.flagKey, BK_CFG.logQueueKey, HR_PERMS_KEY, HR_ORDER_KEY]
      .concat(eraKeys(), mirrorTables().map(mirrorKey),
              Object.keys(HR_SET_FLAT).map(function (k) { return HR_SET_FLAT[k]; }));
  },

  // חלון הפינוי נגזר מסוג האפליקציה — אין מספר ימים באף רשומה.
  appType: { type: 'daily', why: 'החישוב שלה הוא של היום — ⚠️ לוח הבית סופר את סדרי היום ואת השינה של הלילה, ⛔ ומה שמעבר לרבעון נקרא מהענן כשיש רשת' },

  // מראת המשתמשים ו-hr_perms_cache אינם כאן — הם מסלול הכניסה האופליין, ופינוים משבית כניסה בלי רשת.
  // שאר המפתחות קיימים בענן, אך מחיקתם מרוקנת את המסך אופליין — לכן הם מפונים ברמת רשומה.
  wholeKeys: [],

  // לכל מפתח עֵד דחיפה משלו — החותמת הגלובלית מתקדמת גם במשיכה.
  // הסימונים יורדים עם הסדר שלהם (parent) — סדר בלי סימוניו מוצג ריק, ודחיפתו נקראת בענן כמחיקתם.
  oldRecords: [
    { key: mirrorKey('hr_sessions'), label: 'סדרי נוכחות',   ts: hrRecTs,
      idOf: _hrRowId, syncedThrough: _hrPushedFor('hr_sessions'), verify: _hrVerify('hr_sessions') },
    { key: mirrorKey('hr_marks'), label: 'סימוני נוכחות', ts: hrRecTs,
      parent: mirrorKey('hr_sessions'), parentOf: _hrMarkParent,
      idOf: _hrRowId, syncedThrough: _hrPushedFor('hr_marks'), verify: _hrVerifyRows(function () { return S.SB.from('hr_marks').select('client_id,updated_at'); }) },
    { key: mirrorKey('hr_sleep_sessions'),  label: 'רשומות שינה',   ts: hrRecTs,
      idOf: _hrRowId, syncedThrough: _hrPushedFor('hr_sleep_sessions'),  verify: _hrVerify('hr_sleep_sessions') },
    { key: mirrorKey('hr_sleep_marks'), label: 'סימוני שינה', ts: hrRecTs,
      parent: mirrorKey('hr_sleep_sessions'), parentOf: _hrMarkParent,
      idOf: _hrRowId, syncedThrough: _hrPushedFor('hr_sleep_marks'), verify: _hrVerifyRows(function () { return S.SB.from('hr_sleep_marks').select('client_id,updated_at'); }) },
    { key: 'hr_attend_treats',   label: 'טיפולים — סדרים', ts: hrRecTs,
      idOf: _hrItemId, syncedThrough: _hrPushedFor('hr_attend_treats'),   verify: _hrVerify('hr_attend_treats') },
    { key: 'hr_sleep_treats',    label: 'טיפולים — שינה',  ts: hrRecTs,
      idOf: _hrItemId, syncedThrough: _hrPushedFor('hr_sleep_treats'),    verify: _hrVerify('hr_sleep_treats') }
  ],
  // טבלה שגדלה ואינה בפינוי ממלאת אחסון של origin משותף — לכן כאן רק טבלה קבועה בגודלה, עם נימוקה.
  fixedSize: [
    { t: 'hr_students_rows', why: 'מצבת התלמידים — שורה לתלמיד, ⛔ ואינה גדלה עם הזמן' },
    { t: KV_TABLE,           why: 'הגדרות — שורה למפתח, ⛔ ומספר המפתחות קבוע בקוד' },
    { t: 'hr_users',         why: 'משתמשים — שורה למשתמש, ⚠️ והיא מסלול הכניסה האופליין' }
  ],

  // כל עוד תור יומן הכניסות אינו ריק — אין פינוי בשתי הרשימות.
  pending: function () {
    try {
      var l = JSON.parse(lsGet('hr_login_log_queue') || '[]');
      return Array.isArray(l) && l.length > 0;
    } catch (e) { return true; } // תור שאינו ניתן לקריאה נחשב לא ריק — בספק לא מפנים
  },

  // 0 בכוונה: _hrLastTs מתקדם גם במשיכה ואינו עֵד דחיפה — פינוי לפיו מוחק רשומה שלא עלתה.
  // העֵד הוא _hrPushedAt פר-מפתח; אין להחזיר לכאן את _hrLastTs.
  syncedThrough: function () { return 0; }
};

// logQueueKey נשאר hr_login_log_queue — LS_CFG.pending() בודק אותו, ושינוי שמו מנתק בשקט את ההגנה על הפינוי.
// hr_users אינה מגובה — sh_backup קריאה ל-anon, וגיבויה היה מעתיק את טביעות הסיסמה.
var BK_CFG = {
  client: function () { return S.SB; },
  flagKey: 'hr_last_backup',
  logQueueKey: 'hr_login_log_queue',
  prefix: '',
  device: function () { try { return getDeviceId(); } catch (e) { return null; } },
  user: function () { try { return (AUTH.user && AUTH.user.full_name) ? AUTH.user.full_name : null; } catch (e) { return null; } },
  // ריק כי hr_users מוחרגת כולה מהגיבוי; מנגנון הסינון נשאר דרוך לסוד עתידי.
  secrets: [],
  sources: function () {
    // מפתח הגיבוי הוא שם הטבלה ו-_rows, פרט ל-hr_students_rows ששמו כבר נושא אותה.
    var out = [
      { name: 'hr_sessions',       key: 'hr_sessions_rows',  order: 'client_id', ts: 'updated_at' },
      { name: 'hr_marks',          key: 'hr_marks_rows',     order: 'client_id', ts: 'updated_at' },
      { name: 'hr_students_rows',  key: 'hr_students_rows',  order: 'client_id', ts: 'updated_at' }
    ];
    // מחרוזות המפתח הן רשימת-ההיתר של הפינוי במסד — מפתח שאינו שם אינו מתפנה לעולם.
    out.push(
      { name: 'hr_sleep_sessions', key: 'hr_sleep_sessions_rows', order: 'client_id', ts: 'updated_at' },
      { name: 'hr_sleep_marks',    key: 'hr_sleep_marks_rows',    order: 'client_id', ts: 'updated_at' }
    );
    // טבלת ההגדרות — מקור טבלה ככל השאר, בשכבות.
    out.push({ name: KV_TABLE, key: KV_TABLE, order: 'key', ts: 'updated_at' });
    return out;
  }
};

var PEND_CFG = {
  key: 'hr_pending',
  marks: function () {
    return [PK_SET].concat(Object.keys(PEND_KV_PREFIX).map(function (k) { return PEND_KV_PREFIX[k]; }));
  },
  // שלושת המסכים שמציירים pendTag אידמפוטנטיים וכותבים לאלמנטים קבועים גם כשהמסך מוסתר — כשל באחד אינו מפיל את השאר.
  redraw: function () {
    try { renderStudents(); } catch (e) { }
    try { atRenderTodaySessions(); } catch (e) { }
    try { hrRenderTodaySessions(); } catch (e) { }
  }
};

var RTY_CFG = {
  flush:   function () { return hrPushToCloud(); },
  pending: function () { try { return pendCount() > 0; } catch (e) { return false; } },
};

// אין להוסיף כאן הודעה — חלון האזהרה של הליבה הוא ההודעה, ונוסח שני נבדל ממנו בשקט.
var LK_CFG = {
  active: function () { return sessActive(); },
  lock:   function () { doLogout(); },
};

// החותמת בטבלת ההגדרות ונכתבת רק דרך plTouch — גם מכתיבת משתמש, ב-hrTouchLastChanged().
// ok() היא חותמת תצוגה בלבד — אין להזין ממנה את עֵד הפינוי.
var PL_CFG = {
  every:  3000,
  active: function () { return sessActive(); },
  seen:   function () { return S._hrLastTs; },
  note:   function (ts) { S._hrLastTs = ts; },
  ok:     function () { _hrMarkSynced(); },
  pull:   function () { return hrPullFromCloud(); },
  client: function () { return S.SB; },
  table:  function () { return KV_TABLE; },
};

// טבלאות הבן — שורת סימון נדחפת כפי שהיא במראה, בחותמת משלה.
var HR_MARK_TABLES = { hr_marks: 1, hr_sleep_marks: 1 };

var PUSH_CFG = {
  tables: PUSH_TABLES,
  chunk:  500,
  delay:  400,
  // ctx הוא המערך שהכותב כבר מחזיק, ובלעדיו העותק שבמראה — מחזור בלי קלט הוא «אין ראיה», וההגדרות היו נשארות ממתינות.
  rows:   function (t, ctx) {
    S._hrPushEp = ctxEpoch();
    if (t === KV_TABLE) return hrSetRows();
    if (HR_MARK_TABLES[t]) return MIRROR[t] || [];
    return Array.isArray(ctx) ? ctx : hrLocalRecs(t);
  },
  key:    function (t, row) {
    if (t === KV_TABLE) return row ? PK_SET + row.key : null;
    var pk = PEND_KV_PREFIX[t];
    return (pk && row && row.client_id != null) ? (pk + row.client_id) : null;
  },
  send:   function (t, rows) {
    if (t === KV_TABLE) return hrSetSend(rows);
    return HR_MARK_TABLES[t] ? hrSendMarks(t, rows) : hrSendRecs(t, rows);
  },
  mark:   function (t) {
    if (ctxStale(S._hrPushEp)) return;
    // הטיפולים יושבים בטבלת ההגדרות — ועֵד הפינוי שלהם הוא עֵדה.
    if (t === KV_TABLE) { Object.keys(HR_SET_FLAT).forEach(function (k) { _hrMarkPushed(HR_SET_FLAT[k]); }); return; }
    _hrMarkPushed(t);
  },
  run:    function () { hrPushToCloud(); },
};

// כל טבלה עם session_date בחלון — הסדרים, השינה וסימוני שניהם; המצבה אינה סדרה בזמן.
// הסימון נמדד בתאריך של אביו ויורד איתו, ושער הדיסק שלו פועל גם בכל כתיבה — טבלת בן בלי שער חוזרת לדיסק במלואה בכל משיכה.
function _hrHwSpec(t, label, recs) {
  return {
    key: mirrorKey(t),
    label: label,
    inWindow: function (r) { return hrHwInWindow(r); },
    idOf: _hrRowId,
    ts: hrRecTs,
    isPending: function (r) {
      try { return !!(r && r.client_id != null && pendHas(PEND_KV_PREFIX[t] + r.client_id)); }
      catch (e) { return true; }
    },
    fetch: function () { return hrHwFetch(t); },
    // האב — כרשומות מורכבות, ושמירתו כותבת גם את סימוניו; הבן — כשורות המראה, והזיכרון אינו נגע.
    rows: recs ? function () { return recs() || hrMirrorRecs(t); } : function () { return MIRROR[t] || []; },
    apply: recs ? function (kept) { return hrMirrorWriteRecs(t, kept); } : function (kept) { return mirrorWrite(t, kept); }
  };
}
var HW_CFG = {
  enabled: true,
  admin: function () {
    try { return isAdmin(); }
    catch (e) { return false; }
  },
  specs: [
    _hrHwSpec('hr_sessions', 'סדרי נוכחות מחוץ לחלון', function () { return Array.isArray(S._atData) ? S._atData : null; }),
    _hrHwSpec('hr_marks', 'סימוני נוכחות מחוץ לחלון', null),
    _hrHwSpec('hr_sleep_sessions', 'רשומות שינה מחוץ לחלון', function () { return Array.isArray(S._hrData) ? S._hrData : null; }),
    _hrHwSpec('hr_sleep_marks', 'סימוני שינה מחוץ לחלון', null)
  ]
};

var ERA_CFG = {
  prefix: self.APP.prefix,
  client: function () { return S.SB; },
  table:  function () { return KV_TABLE; },
  // גם אופק הפינוי נמחק — אופק ששרד מסנן את מה שהמשיכה מחזירה, והמכשיר היה נשאר ריק.
  wipe:   function () {
    mirrorTables().forEach(function (t) { MIRROR[t] = MIRROR_CFG.empty(); lsRemove(mirrorKey(t)); });
    lsClearHorizons();
  },
  // מחזור הדחיפה כאן פר-קטגוריה — התוצאה נאספת בסופו ונמסרת ב-eraNotePush.
  push:   function () { return hrPushToCloud().then(function () { return _eraPush; }); },
  refresh: function () { return hrSyncNow(); },
  log:    function (action, entries) { return logAwait(action, entries); }
};

var DEV_CFG = { key: 'hr_device_id' };

// רשומה מקומית ממתינה לסנכרון מנצחת בלי תלות בחותמת — אין להסיר את isPending: החותמת בענן מאוחרת מעריכה שטרם עלתה, והעריכה נמחקת בשקט.
// המחיר המודע: מכשיר שנותק זמן רב דורס בעלייתו עריכה מרוחקת חדשה יותר — והרשומה מתריעה כל אותו זמן.
// USER_CFG: מה שנבדל — הלקוח, הטבלה, הודעת הניתוק ומה שאחרי התשובה; הכתיבה עצמה משותפת.
var USER_CFG = {
  ready: function () { return !!S.SB && navigator.onLine; },
  // ההודעה נקראת בזמן הקריאה ולא בהשמה — הקבוע מוצהר מאוחר יותר בקובץ, וקריאה בהשמה נותנת undefined.
  offMsg: function () { return MSG_OFF_USER_WRITE; },
  from: function () { return S.SB.from(authUsersTable()); },
  run: function (q) { return withTimeout(q); },
  revalidated: function (row) {
    AUTH.user = row;
    AUTH.offlineLogin = false;
    try { loadPerms(); } catch (e) { console.warn('[perms] loadPerms', e); }
  },
  logout: function (msg) { toast(msg, null, 'bad'); doLogout(); },
  // התשובה מוחזרת כפי שהיא — הקוראים בודקים res.error ומרעננים את המטמון בעצמם.
  after: function (res) { return res; }
};

document.title = self.APP.name;

function screenReportsHTML() {
  return `
<div class="pg" id="pg-reports">
  <div class="inner">
    <div class="ptitle" data-ks><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>📊 דוח חודשי</span><span class="gap"></span><input type="month" aria-label="חודש הדוח" id="rm"><button class="btn" data-act="rpt-load" data-ksave>📊 הצג</button></div>
    <div id="rc"></div>
  </div>
</div>
`;
}

function screenExamsHTML() {
  return `
<div class="pg" id="pg-exams"><div class="inner"><div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>📝 מבחנים</span><span class="gap"></span></div><div class="cs"><div class="ci">📝</div><h3>מבחנים</h3><p>מודול זה בפיתוח</p></div></div></div>
`;
}

function screenFilesHTML() {
  return `
<div class="pg" id="pg-files"><div class="inner"><div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>📁 תיקים אישיים</span><span class="gap"></span></div><div class="cs"><div class="ci">📁</div><h3>תיקים אישיים</h3><p>מודול זה בפיתוח</p></div></div></div>
`;
}

function mountView() {
  var v = document.getElementById('view');
  if (!v) { console.error('[ui] אין מיכל תוכן — #view'); return; }
  v.innerHTML = screenLoginHTML() + screenHomeHTML() +
    screenStudentsHTML() +
    screenAttendHTML() +
    screenReportsHTML() +
    screenSleepHTML() +
    screenExamsHTML() +
    screenFilesHTML() +
    screenSettingsHTML();
}

// AUTH.user הוא חלון אל מודול הסשן, שבזיכרון בלבד — שדה רגיל כאן הוא מסלול שדרכו הסשן נכתב לדיסק.
// {id, username, full_name, role}
Object.defineProperty(AUTH, 'user', { get: sessGet, set: sessSet, enumerable: true });

mountView();

S.SB=sbWatch(supabase.createClient(self.APP.supabase.url,self.APP.supabase.key));

// ── הרישום ב-shell ──
// לפני כל אינטראקציה — מסך שמרנדר מסך אחר, והתחום שמנווט, עוברים דרכו.
shell.showPage = showPage;
shell.showPageInternal = showPageInternal;
shell.renderStudents = renderStudents;
shell.atRenderArchive = atRenderArchive;
shell.atRenderSupervision = atRenderSupervision;
shell.hrRenderArchive = hrRenderArchive;
shell.hrRenderSupervision = hrRenderSupervision;
shell.renderAttendSettings = renderAttendSettings;
shell.renderSleepSettings = renderSleepSettings;
shell.atRenderStudents = atRenderStudents;
shell.hrRenderStudents = hrRenderStudents;
shell.hrPullDraw = hrPullDraw;

(function(){
  fetch('https://fonts.gstatic.com/s/alef/v22/FeVfS0NQpLYgrjJbC5FxxbU.ttf')
    .then(function(r){return r.arrayBuffer();})
    .then(function(buf){
      var b=new Uint8Array(buf),chunks=[];
      for(var i=0;i<b.length;i+=8192) chunks.push(String.fromCharCode.apply(null,b.subarray(i,i+8192)));
      S._alefFontB64=btoa(chunks.join(''));
    })
    .catch(function(){});
})();

function showPageInternal(pg) {
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('[data-pg]').forEach(function(b){b.classList.remove('on');});
  var pgEl=document.getElementById('pg-'+pg);
  var nbEl=document.querySelector('[data-pg="'+pg+'"]');
  if(pgEl) pgEl.classList.add('on');
  if(nbEl) nbEl.classList.add('on');
}

var UNDER_CONSTRUCTION = ['exams','files','reports'];

function showPage(pg) {
  if (pg === 'home') { showPageInternal('home'); loadDash(); return; }
  if (!AUTH.user) { return; }
  if (UNDER_CONSTRUCTION.indexOf(pg) !== -1) { showConstruction(); return; }
  if (!canAccess(pg)) { showDenied(); return; }
  showPageInternal(pg);
  renderPage(pg);
}

// מעבר מסך ורענון אחרי שמירה מציירים אותו מסך — ולכן ניתוב הציור בנקודה אחת.
function renderPage(pg) {
  if (pg === 'students' && typeof renderStudents === 'function') renderStudents();
  if (pg === 'settings') renderSettings();
  if (pg === 'attend') loadAttend();
  if (pg === 'sleep') loadSleep();
}

// רענון אינו ניווט — אין לקרוא כאן ל-showPage: שמירה שמנווטת מוציאה את המשתמש ממקומו.
function saveRefresh() {
  var on = document.querySelector('.pg.on');
  if (on && on.id) renderPage(String(on.id).replace(/^pg-/, ''));
}

function _hcNav(pfx,dir){
  var v=S._hcVw[pfx]||{hy:5786,mi:0},mi=v.mi+dir,hy=v.hy;
  var curMax=(_hcBase(hy)||{ml:[]}).ml.length-1;
  if(mi<0){hy--;var pb=_hcBase(hy);if(!pb)return;mi=pb.ml.length-1;}
  if(mi>curMax){hy++;if(!_hcBase(hy))return;mi=0;}
  S._hcVw[pfx]={hy:hy,mi:mi};_hcDraw(pfx);}

function _hcDraw(pfx){
  var v=S._hcVw[pfx],b=_hcBase(v.hy);if(!b)return;
  var pop=document.getElementById(pfx+'_pop');if(!pop)return;
  var mlen=b.ml[v.mi],fdow=_hcG(v.hy,v.mi,1).getDay();
  var selIso=(document.getElementById(pfx+'_iso')||{}).value;
  var selH=selIso?_hcH(new Date(selIso)):null;
  var todH=_hcH(new Date());
  var bs='hc-nav';
  var maxMi=(b.ml.length-1);
  var hasPrev=v.mi>0||!!_hcBase(v.hy-1),hasNext=v.mi<maxMi||!!_hcBase(v.hy+1);
  // בגריד RTL התא הימני הוא יום ראשון, ולכן מספר התאים הריקים הוא fdow.
  var rtlOffset=fdow;
  var h='<div class="hc-cal">';
  // חץ ימני — החודש הקודם, שמאלי — הבא
  h+='<div class="hc-head">';
  h+='<button data-act="hc-nav" data-pfx="'+esc(pfx)+'" data-dir="-1" class="'+bs+(hasPrev?'':' hc-nav-off')+'"'+(hasPrev?'':' disabled')+'>›</button>';
  h+='<span class="hc-month">'+_hcMN(v.hy)[v.mi]+'&nbsp;'+_hcYL(v.hy)+'</span>';
  h+='<button data-act="hc-nav" data-pfx="'+esc(pfx)+'" data-dir="1" class="'+bs+(hasNext?'':' hc-nav-off')+'"'+(hasNext?'':' disabled')+'>‹</button>';
  h+='</div>';
  h+='<div class="hc-dow-row">';
  ['א','ב','ג','ד','ה','ו','ש'].forEach(function(x){h+='<div class="hc-dow">'+x+'</div>';});
  h+='</div>';
  h+='<div class="hc-grid">';
  for(var i=0;i<rtlOffset;i++)h+='<div></div>';
  for(var d=1;d<=mlen;d++){
    var isSel=selH&&selH.hy===v.hy&&selH.mi===v.mi&&selH.day===d;
    var isToday=todH.hy===v.hy&&todH.mi===v.mi&&todH.day===d;
    var st=isSel?'hc-day-sel':isToday?'hc-day-today':'hc-day';
    h+='<button data-act="hc-pick" data-pfx="'+esc(pfx)+'" data-hy="'+v.hy+'" data-mi="'+v.mi+'" data-day="'+d+'" '+
      'class="hc-day-btn '+st+'">'+hebDayLabel(d)+'</button>';
  }
  h+='</div></div>';pop.innerHTML=h;}

function _hcOpen(pfx){
  var pop=document.getElementById(pfx+'_pop');if(!pop)return;
  if(uiShown(pop)){pop.classList.add('hidden');return;}
  document.querySelectorAll('.hc-pop').forEach(function(p){p.classList.add('hidden');});
  var iso=(document.getElementById(pfx+'_iso')||{}).value;
  var vh=iso?_hcH(new Date(iso)):_hcH(new Date());
  S._hcVw[pfx]={hy:vh.hy,mi:vh.mi};_hcDraw(pfx);
  // position fixed מחושב מהטריגר — חסין ל-overflow:hidden בהורים; הערכים נכתבים למשתני CSS שהכלל .hc-pop קורא.
  var trg=document.getElementById(pfx+'_trg');
  if(trg){
    var r=trg.getBoundingClientRect();
    pop.style.setProperty('--pop-top',(r.bottom+4)+'px');
    pop.style.setProperty('--pop-right',(window.innerWidth-r.right)+'px');
  }
  pop.classList.remove('hidden');}

function _hcPick(pfx,hy,mi,day){
  var g=_hcG(hy,mi,day);
  var iso=dayIso(g);
  var el=document.getElementById(pfx+'_iso');if(el)el.value=iso;
  var lb=document.getElementById(pfx+'_lbl');
  if(lb){
    var lbTxt=_hcFmt(hy,mi,day);
    if(pfx==='at_date'||pfx==='sfmF'||pfx==='sfmT'){var _AT_DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];lbTxt='יום '+_AT_DOW[dayNoon(iso).getDay()]+' '+lbTxt;}
    lb.textContent=lbTxt;
  }
  var pop=document.getElementById(pfx+'_pop');if(pop)pop.classList.add('hidden');
  if(pfx==='at_date'&&typeof atRenderTodaySessions==='function') atRenderTodaySessions();}

function _hcToggle(){
  var btn=document.getElementById('sfmT_btn'),wr=document.getElementById('sfmT_wrap');
  if(!btn||!wr)return;
  var open=!uiShown(wr);
  wr.classList.toggle('hidden',!open);
  btn.classList.toggle('on',open);
  if(open){
    btn.textContent='✕ הסר תאריך סיום';
  } else {
    btn.textContent='+ הוסף תאריך סיום';
    var isoEl=document.getElementById('sfmT_iso'),tEl=document.getElementById('sfmT_t'),lbl=document.getElementById('sfmT_lbl');
    if(isoEl)isoEl.value='';if(tEl)tEl.value='';if(lbl)lbl.textContent='בחר תאריך עברי';
  }}

document.addEventListener('mousedown',function(e){
  var hit=e.target&&e.target.closest?e.target.closest('[data-pop],[data-pop-trg]'):null;
  var own=hit?(hit.getAttribute('data-pop')||hit.getAttribute('data-pop-trg')):'';
  document.querySelectorAll('[data-pop]').forEach(function(p){
    if(uiShown(p)&&p.getAttribute('data-pop')!==own)p.classList.add('hidden');
  });});

function showConstruction() {
  openModal(MSG_SOON_TITLE,
    '<p class="soon-note">' +
      'מקום זה נמצא בבנייה ויפתח בקרוב.<br>תודה על הסבלנות!</p>',
    '<button data-act="modal-close" class="soon-ok">הבנתי</button>');
}

function showDenied() {
  openModal(MSG_ACCESS_LIMITED,
    '<p class="md-note-center">אין לך הרשאה לאפשרות זו.<br>פנה למנהל המערכת.</p>',
    '<button class="modal-ok btn" data-act="modal-close">הבנתי</button>');
}

// ── העברת מזהה ל-DOM ──
// ערך שחוזר מ-data-* הוא מחרוזת: idx + dir משרשר, ו-!'false' הוא false — ולכן ההמרה המפורשת כאן.
// מטפל שקורא לפונקציה אסינכרונית מחזיר את ההבטחה — הניתוב משבית את הכפתור לפיה, ואין להסיר את ה-return.
var DOM_ACTIONS = {
  'sw-apply':            function (el) { swApply(el); },
  'sw-dismiss':          function () { swHideUpdate(); },
  'reason-row-del':      function (el) { if (el.parentNode) el.parentNode.remove(); },
  'at-open-session':     function (el) { return atOpenSession(el.dataset.sid, el.dataset.sname); },
  'sl-open-session':     function (el) { return hrOpenSession(el.dataset.sid, el.dataset.sname); },
  // התראות התשתית נבנות ב-JS — לכן הן מנותבות במפה ולא במאזין ישיר על הכפתור.
  'ls-alert-close':      function () { var el = document.getElementById('ls-alert'); if (el) el.remove(); },
  'pend-alert-ok':       function () { pendAlertDismiss(); },
  'lk-stay':             function () { lkReset(); },
  'user-up':     function (el) { moveUser(el.getAttribute('data-id'), -1); },
  'user-down':   function (el) { moveUser(el.getAttribute('data-id'), 1); },
  'user-toggle': function (el) { return toggleUserActive(el.getAttribute('data-id'),
                                   el.getAttribute('data-active') === '1'); },
  'combo-pick':  function (el) { return comboPick(el); },
  'st-activate': function (el) { setStudentActive(el.getAttribute('data-id')); },
  'st-attend':   function (el) { openAttendanceEdit(el.getAttribute('data-id')); },
  'st-edit':     function (el) { editStudent(el.getAttribute('data-id')); },
  'st-history':  function (el) { return openStatusHistory(el.getAttribute('data-id')); },
  // page-nav הוא page ועוד סימון הכפתור הפעיל — הסרגל התחתון מסמן, וכפתורי הפנים אינם.
  'page':        function (el) { showPage(el.getAttribute('data-page')); },
  'page-nav':    function (el) {
                   showPage(el.getAttribute('data-page'));
                   document.querySelectorAll('.bn').forEach(function (b) { b.classList.remove('on'); });
                   el.classList.add('on');
                 },
  'modal-close': function () { closeModal(); },
  'ask-no':      function () { closeAsk(false); },
  'ask-yes':     function () { closeAsk(true); },
  'manage-pick': function (el) {
                   var f = MANAGE_PICK[el.getAttribute('data-mk')];
                   closeModal();
                   if (f) f();
                 },
  'deact-st-confirm': function () {
                   var v = document.getElementById('deact-st-sel').value;
                   if (!v) { toast(MSG_PICK_STUDENT, null, 'bad'); return; }
                   setStudentInactive(v);
                   closeModal();
                 },
  'year-transition-confirm': function () { doYearTransition(); closeModal(); },
  'at-resume-go':     function (el) { var p = atEditSession(el.getAttribute('data-id'));
                                    closeModal(); return p; },
  'at-status-cancel': function (el) { atCancelStudentStatusFromReg(el.getAttribute('data-id')); closeModal(); },
  'at-export-go':     function (el) { return atExportConfirm(el.getAttribute('data-type')); },
  'at-mark-edit':     function (el) { atSupEditMarkDlg(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'at-mark-set':      function (el) { return atEditMark(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'sl-resume-go':     function (el) { var p = hrEditSession(el.getAttribute('data-id'));
                                    closeModal(); return p; },
  'sl-status-cancel': function (el) { hrCancelStudentStatusFromReg(el.getAttribute('data-id')); closeModal(); },
  'sl-export-go':     function (el) { hrExportConfirm(el.getAttribute('data-type')); },
  'sl-mark-edit':     function (el) { hrSupEditMarkDlg(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'sl-mark-set':      function (el) { return hrEditMark(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'hc-nav':           function (el) { _hcNav(el.getAttribute('data-pfx'),
                                        Number(el.getAttribute('data-dir'))); },
  'hc-pick':          function (el) { _hcPick(el.getAttribute('data-pfx'),
                                        Number(el.getAttribute('data-hy')),
                                        Number(el.getAttribute('data-mi')),
                                        Number(el.getAttribute('data-day'))); },
  'hc-open':          function (el) { _hcOpen(el.getAttribute('data-pfx')); },
  // closest('[data-act]') מחזיר את הפנימי ביותר — ולכן אין צורך ב-stopPropagation מול השורה העוטפת.
  'toggle-panel':     function (el) {
                        var e = document.getElementById(el.getAttribute('data-panel'));
                        if (e) e.classList.toggle('hidden', uiShown(e));
                      },
  'toggle-next':      function (el) {
                        var pnl = el.nextElementSibling;
                        if (!pnl) return;
                        var open = uiShown(pnl);
                        pnl.classList.toggle('hidden', open);
                        var chev = el.querySelector('.' + el.getAttribute('data-chev'));
                        if (chev) chev.classList.toggle('open', !open);
                      },
  'at-edit-session':  function (el) { return atEditSession(el.getAttribute('data-id')); },
  'at-del-session':   function (el) { atDeleteSession(el.getAttribute('data-id')); },
  'at-sup-detail':    function (el) { atSupDetail(el.getAttribute('data-id')); },
  'at-set-mark':      function (el) { atSetMark(el.getAttribute('data-id'),
                                        el.getAttribute('data-code')); },
  'at-clear-mark':    function (el) { atClearMark(el.getAttribute('data-id')); },
  'at-confirm-late':  function (el) { atConfirmLate(el.getAttribute('data-id')); },
  'at-add-treat':     function (el) { return atAddTreat(el.getAttribute('data-id')); },
  'at-del-treat':     function (el) { atDeleteTreat(el.getAttribute('data-id')); },
  'sl-edit-session':  function (el) { return hrEditSession(el.getAttribute('data-id')); },
  'sl-del-session':   function (el) { hrDeleteSession(el.getAttribute('data-id')); },
  'sl-sup-detail':    function (el) { hrSupDetail(el.getAttribute('data-id')); },
  'sl-set-mark':      function (el) { hrSetMark(el.getAttribute('data-id'),
                                        el.getAttribute('data-code')); },
  'sl-clear-mark':    function (el) { hrClearMark(el.getAttribute('data-id')); },
  'sl-confirm-late':  function (el) { hrConfirmLate(el.getAttribute('data-id')); },
  'sl-add-treat':     function (el) { return hrAddTreat(el.getAttribute('data-id')); },
  'sl-del-treat':     function (el) { hrDeleteTreat(el.getAttribute('data-id')); },
  'row-remove':  function (el) { if (el.parentNode) el.parentNode.remove(); },
  'settings-home':   function () { showSettingsHome(); },
  'settings-module': function (el) { showSettingsModule(el.getAttribute('data-mod')); },
  'filter-class':    function (el) { filterClass(el.getAttribute('data-cls')); },
  'sl-tab':          function (el) { hrShowTab(el.getAttribute('data-tab')); },
  'at-tab':          function (el) { atShowTab(el.getAttribute('data-tab')); },
  'sl-export':       function (el) { hrShowExportDialog(el.getAttribute('data-fmt')); },
  'at-export':       function (el) { atShowExportDialog(el.getAttribute('data-fmt')); },
  // כיוון הדפדוף נכנס לחישוב אינדקס — ולכן מומר למספר כאן.
  'sl-sup-nav':      function (el) { hrSupNav(Number(el.getAttribute('data-dir'))); },
  'at-sup-nav':      function (el) { atSupNav(Number(el.getAttribute('data-dir'))); },
  'absence-reason-add':  function (el) { addAbsenceReason(el.getAttribute('data-kind')); },
  'status-form':         function (el) { openStatusForm(el.getAttribute('data-kind')); },
  'user-edit':           function (el) { openEditUser({
                           id: el.getAttribute('data-uid'),
                           full_name: el.getAttribute('data-uname'),
                           username: el.getAttribute('data-uusername'),
                           role: el.getAttribute('data-urole') }); },
  'rpt-load':            function () { loadR(); },
  'absence-reasons-save': function () { return saveAbsenceReasons(); },
  'status-abs-cancel':    function (el) {
                            cancelSingleAbsence(el.getAttribute('data-id'));
                          },
  'status-picker-open':   function () { openStatusPickerModal(); },
  'student-status-save':  function () { return runSave(function () { return saveStudentStatus(S._currentStatusType); }); },
  'manage-list-open':     function () { openManageListDlg(); },
  'students-print':       function () { printStudents(); },
  'users-render':         function () { return renderUsersList(); },
  'hc-toggle':            function () { _hcToggle(); },
  'sl-settings-save':     function () { return hrSaveSettingsCfg(); },
  'at-settings-save':     function () { return atSaveSettingsCfg(); },
  'sl-session-close':     function () { return hrCloseSession(); },
  'at-session-close':     function () { return atCloseSession(); },
  'at-session-add':       function () { atAddSession(); },
  'sl-treat-row-add':     function () { hrAddTreatRow(); },
  'at-treat-row-add':     function () { atAddTreatRow(); },
  'login':            function () { return doLogin(); },
  'logout':           function () { doLogout(); },
  'menu-logout':      function () { closeUserMenu(); doLogout(); },
  'my-pass':          function () { closeUserMenu(); myPasswordModal(); },
  'user-menu-toggle': function () { return toggleUserMenu(); },
  'user-add-open':    function () { openAddUser(); },
  'user-save':        function () { return saveUser(); },
  'user-switch':      function (el) { switchUserEl(el); },
  'my-pass-save':     function () { return changeMyPassword(); },
  'switch-confirm':   function () { return confirmSwitch(); },
  'student-save':     function () { return runSave(saveStudent); },
  'perms-save':       function () { return savePerms(); },
};

// החיווי בנקודת הניתוב, ורק כשהמטפל החזיר הבטחה — חיווי המתנה על פעולה מיידית הוא רעש.
// ורק על BUTTON: disabled על div אינו חוסם דבר.
// סדר המסלולים: סגירת התפריטים הצפים, סגירת הרקע (שאינו נושא data-act), ואז הניתוב.
document.addEventListener('click', function (ev) {
  var inMenu = ev.target && ev.target.closest ? ev.target.closest('[data-menu]') : null;
  var menu = inMenu ? inMenu.getAttribute('data-menu') : '';
  if (menu !== 'user') closeUserMenu();
  comboOutside(ev);
  if (modalBackdrop(ev)) return;
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!el) return;
  var fn = DOM_ACTIONS[el.getAttribute('data-act')];
  if (!fn) return;
  ev.preventDefault();
  actRun(el, fn);
});

// שמירה בשדה עריכה קודמת לסגירת חלון הדו-שיח — אחרת Escape בשדה שבתוך חלון דו-שיח היה סוגר אותו במקום לבטל את השדה.
document.addEventListener('keydown', function (e) {
  if (comboKey(e) || ksKey(e)) return;
  modalEsc(e);
});

document.addEventListener('input', function (e) {
  if (comboInput(e)) return;
  var el = e.target; if (!el || !el.dataset) return;
  var k = el.dataset.inp;
  if (k === 'at-late') atSetLateMin(el.dataset.id, el.value);
  else if (k === 'sl-late') hrSetLateMin(el.dataset.id, el.value);
  else if (k === 'sl-note') hrSetNote(el.dataset.id, el.value);
});

document.addEventListener('change', function (e) {
  var el = e.target;
  if (el && el.dataset && el.dataset.chg === 'import-students') importStudentsFromFile(el);
});

function moveUser(id, dir) {
  var el = document.getElementById('users-list');
  var rows = Array.from(el.querySelectorAll('.ur'));
  var ids = rows.map(function(r){ return r.getAttribute('data-row-id'); });
  var idx = ids.indexOf(String(id));
  if (idx < 0) return;
  var swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= ids.length) return;
  var tmp = ids[idx]; ids[idx] = ids[swapIdx]; ids[swapIdx] = tmp;
  saveUserOrder(ids);
  renderUsersList();
}

// ── דוחות חודשיים ──
// המסך חסום ב-UNDER_CONSTRUCTION ו-loadR אינה מוצגת; עד לאפיון — לא לחבר כאן לוגיקת דוח.
// כשייכתב: מהטבלאות המובנות בלבד, דרך hrMarks(rec) ובסינון !r.deleted.
function loadR(){
  var el = document.getElementById('rc');
  if (el) el.innerHTML = '<div class="empty">הדוח בבנייה — טרם אופיין</div>';
}

// אין להחזיר כאן setInterval — הבדיקה המחזורית מופעלת רק ב-plBoot() מ-loadDash(): בדיקה מחזורית לפני הכניסה מושכת נתון ש-hrApplyPerms זורקת.

setTimeout(async function() {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  try {
    // דרך plStampRead בלבד — קורא שני לאותה שורה נסחף מהראשון.
    var r = await plStampRead();
    if (!r.ok) {
      // אין יצירה אוטומטית של הטבלה — טבלה חסרה היא תקלת תשתית, ולא משהו שהלקוח מתקן.
      console.warn('[sync] קריאת החותמת בעלייה נכשלה');
      return;
    }
    if (r.ts !== null) {
      if (ctxStale(_ep)) return;
      S._hrLastTs = r.ts;
      await hrPullFromCloud();
    }
  } catch(e) { console.log('[sync] init:', e.message||e); }
}, 1500);

// ── הגדרה ראשונית של המסד ──
// אין ליצור כאן משתמש עם סיסמת ברירת מחדל — הקוד רץ אצל כל מבקר, וטבלה שהתרוקנה לרגע הייתה נפתחת לסיסמה שבקוד הציבורי.
// המסלול מדווח מה חסר ומפנה ליצירה ידנית של המשתמש הראשון.
async function ensureFirstAdmin() {
  try {
    var {data, error} = await S.SB.from('hr_users').select('client_id').limit(1);
    var tableError = error && (
      error.code === '42P01' ||
      (error.message && error.message.indexOf('hr_users') !== -1)
    );
    // אזור השגיאה במסך הכניסה הוא דיווח בלבד — אין כאן מסך התקנה; טבלה חסרה מטופלת בהרצת migrations/000_schema.sql.
    var e = document.getElementById('auth-err');
    if (tableError) {
      if (e) {
        e.textContent = '';
        toast(MSG_TABLES_MISSING, null, 'bad');
      }
      return;
    }
    if (!error && (!data || data.length === 0)) {
      if (e) {
        e.textContent = 'טבלת המשתמשים ריקה — יש ליצור משתמש ראשון ידנית ב-Supabase';
        e.classList.add('users-empty');
      }
    }
  } catch(e) { console.error('[users] setup error:', e); }
}

ensureFirstAdmin();

window.bootOk();

// עובר ב-pullRender — כמה משתמשים עובדים יחד, ומשיכה עלולה להגיע באמצע סימון.
function hrPullDraw() {
  try {
    if (typeof atFillSessionBtns === 'function' && document.getElementById('at-view-reg')) { atFillSessionBtns(); if (typeof atRenderTodaySessions === 'function') atRenderTodaySessions(); }
    if (typeof hrFillSessionBtns === 'function' && document.getElementById('sl-view-reg')) { hrFillSessionBtns(); if (typeof hrRenderTodaySessions === 'function') hrRenderTodaySessions(); }
  } catch (eRf) { console.error('[pull] רענון בוררי הסדר נכשל', eRf); }
  if (typeof renderStudents === 'function') renderStudents();
  if (typeof refreshDashStats === 'function') refreshDashStats();
}
