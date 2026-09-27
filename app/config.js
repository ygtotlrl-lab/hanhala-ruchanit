// app/config.js — התצורה, שמות הטבלאות והמחרוזות
import { MSG_OFF_USER_WRITE, appConfigure, getDeviceId, withTimeout } from '../core/util.js';
import { _eraPush, ctxEpoch, ctxStale, eraKeys, pendCount, pendHas } from '../core/sync.js';
import { lsClearHorizons, lsGet, lsRemove } from '../core/storage.js';
import { MIRROR, mirrorKey, mirrorTables } from '../core/mirror.js';
import { authUsersTable, isAdmin, sessActive, usersSanitize } from '../core/auth.js';
import { toast } from '../core/ui.js';
import { AUTH, S } from './state.js';
import { HR_SET_FLAT, PEND_KV_PREFIX, PK_AT_SESS, PK_SET, PK_SL_SESS, _hrMarkParent,
         _hrMarkPushed, _hrMarkSynced, _hrPushedFor, _hrRecId, _hrRecTs, _hrVerify,
         _hrVerifyRows, hrCloudGet, hrHwInWindow, hrLocalRecs, hrMirrorRecs,
         hrMirrorWriteRecs, hrPullFromCloud, hrPushDirty, hrPushToCloud, hrSendRecs,
         hrSetDirtyRows, hrSetSend, hrSyncNow, hrWriteFail } from './domain.js';
import { atRenderTodaySessions } from './screens/attend.reg.js';
import { doLogout, loadPerms } from './screens/login.js';
import { hrRenderTodaySessions } from './screens/sleep.reg.js';
import { renderStudents } from './screens/students.js';
import { DOM_ACTIONS, SB, saveRefresh } from './main.js';

// התצורה נמסרת בשומרי קריאה — חלקה מוגדר בהמשך, והשומר קורא אותה בזמן הקריאה ולא בזמן המסירה.
appConfigure({
  get BK_CFG() { return BK_CFG; },
  get DATA_ERA() { return DATA_ERA; },
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
  get TOAST_DEFAULT_MS() { return TOAST_DEFAULT_MS; },
  get USER_CFG() { return USER_CFG; },
  get saveRefresh() { return saveRefresh; }
});

// מחזיר true אם המטריצה השתנתה.
var HR_PERMS_KEY = 'hr_perms_cache';

// אין מסלול שכותב סיסמה מקוד שרץ בכל טעינה — .single() מחזירה data:null גם בלי התאמה,
// ולכן כתיבה כזו הייתה דורסת כל סיסמה שאינה ברירת המחדל.

// ── כניסה ──
// MSG_BAD_LOGIN הוא נוסח האפליקציה הזו בהחלטת מנהל, ולכן אינו במודול המשותף.
var MSG_BAD_LOGIN = 'שם משתמש או סיסמה שגויים';

// actRun קורא את התווית מ-data-busy.
var MSG_BUSY_CHECK = '⏳ בודק…';

// אין לאחד עם «סיסמה שגויה» — משתמש בלי טביעה צריך שמנהל יקבע לו סיסמה, ולא לנסות שוב ושוב.
var MSG_NO_FP_ONLINE = '❌ למשתמש הזה אין סיסמה מוגדרת במערכת — יש לקבוע לו סיסמה חדשה במסך ניהול המשתמשים';

// ── הודעות פר-אפליקציה ──
var MSG_PERMS_CHANGED_PRE = '🔒 ההרשאות שלך עודכנו — ';

var MSG_PERMS_CHANGED_POST = ' אינו זמין עוד';

var MSG_SERVER_DOWN_LOCAL = '⚠️ השרת לא זמין — כניסה מקומית, יאומת מחדש בהמשך';

var MSG_OFFLINE_LOGIN_LATER = '📴 כניסה במצב אופליין — יאומת מחדש כשהרשת תחזור';

var MSG_PICK_REASON = '⚠️ יש לבחור סיבה';

var MSG_PICK_START_DATE = '⚠️ יש לבחור תאריך התחלה';

var MSG_PICK_END_DATE = '⚠️ יש לבחור תאריך סיום, או להסיר את שורת תאריך הסיום';

var MSG_ABSENCE_DUP = '⚠️ היעדרות זהה כבר רשומה לתלמיד';

var MSG_REASONS_SAVED = '✅ הסיבות נשמרו';

var MSG_ACCESS_LIMITED = '🔒 גישה מוגבלת';

var MSG_PICK_STUDENT = '⚠️ יש לבחור תלמיד';

var MSG_USER_SAVED_NO_FP = '⚠️ משתמש נשמר — אך ללא הכנה לכניסה ללא רשת';

var MSG_USER_SAVED = '✅ משתמש נשמר!';

var MSG_ACTION_FAILED = '❌ הפעולה נכשלה: ';

var MSG_NO_LINK = 'אין חיבור';

var MSG_USER_OFF = '🔴 משתמש הושבת';

var MSG_USER_ON = '🟢 משתמש הופעל';

var MSG_PERMS_SAVED = '✅ הרשאות נשמרו!';

var MSG_NO_USER_SESSION = '❌ אין משתמש מחובר';

var MSG_FILL_ALL_X = '❌ נא למלא את כל השדות';

var MSG_PASS_MISMATCH_X = '❌ שתי הסיסמאות החדשות אינן זהות';

var MSG_PASS_NEEDS_NET = '❌ אין חיבור — לא ניתן לשנות סיסמה כעת';

var MSG_USER_SWITCHED_MID = '❌ המשתמש המחובר התחלף — הסיסמה לא שונתה';

var MSG_PASS_UPDATED_X = '✅ סיסמה עודכנה!';

var MSG_PASS_UPDATED_NO_FP = '⚠️ סיסמה עודכנה — אך ללא הכנה לכניסה ללא רשת';

// כאן הכניסה הראשונה דורשת חיבור — המראה ריקה עד המשיכה הראשונה.
var MSG_OFF_FIRST_LOGIN = '❌ אין חיבור לאינטרנט — נדרשת כניסה ראשונה עם חיבור לאינטרנט';

// טבלת המשתמשים נקראת בעלייה, וטבלה חסרה נאמרת לפני הכניסה ולא כ«סיסמה שגויה».
var MSG_TABLES_MISSING = '❌ טבלאות המערכת חסרות — יש להריץ את קובץ ההתקנה מול המסד';

var MSG_STUDENT_MISSING = '⚠️ תלמיד לא נמצא';

var MSG_MARKED_INACTIVE = ' סומן כלא פעיל';

var MSG_MARKED_ACTIVE = ' הוחזר לפעיל';

var MSG_ADMINS_ONLY = '⚠️ גישה למנהלים בלבד';

var MSG_STUDENTS_ADMIN = '⚙️ ניהול רשימת תלמידים';

var MSG_MARK_INACTIVE_TITLE = '😴 סמן תלמיד כלא פעיל';

var MSG_YEAR_ROLL_TITLE = '🔄 מעבר שנתי';

var MSG_YEAR_ROLL_C = '• שיעור ג\'';

var MSG_YEAR_ROLL_A = '• שיעור א\' יישאר ריק לתלמידים חדשים';

var MSG_YEAR_ROLL_DONE = '✅ מעבר שנתי הושלם — ';

var MSG_STUDENTS_UPDATED = ' תלמידים עודכנו';

var MSG_STATUS_REVERTED = '✅ הסטטוס בוטל ל-';

var MSG_STATUS_HISTORY = '📜 היסטוריית סטטוסים';

var MSG_LIB_LOADING = '⚠️ הספרייה עדיין נטענת, נסה שוב';

var MSG_FILE_READ_FAIL = '❌ שגיאה בקריאת הקובץ: ';

var MSG_WIPE_STUDENTS_TITLE = '⚠️ מחיקת כלל התלמידים';

var MSG_WIPE_STUDENTS_BODY = 'פעולה זו תמחק לצמיתות את כל התלמידים מהמערכת. לא ניתן לשחזר לאחר האישור.';

var MSG_WIPE_STUDENTS_OK = '🗑️ כן, מחק הכל';

var MSG_STUDENTS_WIPED = ' תלמידים נמחקו';

var MSG_NO_STUDENTS_WIPE = 'אין תלמידים למחיקה';

var MSG_PDF_ENGINE_OFF = '⚠️ מנוע ה-PDF לא נטען — יש להתחבר לרשת ולנסות שוב';

var MSG_PDF_BUILDING = 'מייצר PDF...';

var MSG_PDF_FAIL = '⚠️ יצירת ה-PDF נכשלה: ';

var MSG_SESSION_OPEN_TODAY = '⏳ סדר פתוח מהיום';

var MSG_CLOSE_SESSION_FIRST = '⚠️ סגור את הסדר הנוכחי תחילה';

var MSG_PICK_DATE_FIRST = '⚠️ יש לבחור תאריך תחילה';

var MSG_SESSION_DONE = '📋 סדר כבר מולא';

var MSG_SESSION_OPEN_ELSEWHERE = '⚠️ הסדר כבר נפתח במכשיר אחר — הסימונים נשמרים לרשומה הקיימת';

var MSG_NEED_MINUTES = '⚠️ יש להזין מספר דקות';

var MSG_LATE_OVER_30 = '⚠️ מעל 30 דקות איחור יש לסמן כחיסור';

var MSG_DEL_SESSION_TITLE = '🗑️ מחיקת סדר';

var MSG_DEL_SESSION_BODY = 'הסדר יימחק לצמיתות מהארכיון. לא ניתן לשחזר פעולה זו.';

var MSG_ROW_DELETED = '🗑️ רשומה נמחקה';

var MSG_EXPORT_PDF = '📄 ייצוא PDF';

var MSG_EXPORT_XLS = '📊 ייצוא Excel';

var MSG_NO_EXPORT_DATA = 'אין נתונים לייצוא';

var MSG_NO_DATA_IN_RANGE = 'אין נתונים בטווח התאריכים שנבחר';

var MSG_EXPORT_OK = 'הייצוא הצליח';

var MSG_EXPORT_FAIL = 'שגיאה בייצוא: ';

var MSG_CARE_SAVED = '✅ טיפול נשמר';

var MSG_DEL_CARE_TITLE = '🗑️ מחיקת טיפול';

var MSG_DEL_CARE_BODY = 'האם למחוק את הטיפול? פעולה זו אינה הפיכה.';

var MSG_CARE_MISSING = '⚠️ הטיפול לא נמצא';

var MSG_DELETED_MARK = '🗑️ נמחק';

var MSG_MONTH_DETAIL = '📋 פירוט חודשי — ';

var MSG_EDIT_MARK = '✏️ עדכן סימון';

var MSG_ROW_MISSING = '⚠️ רשומה לא נמצאה';

var MSG_MARK_UPDATED = '✅ סימון עודכן';

var MSG_ABSENCE_ALERT = '⚠️ התראת חיסורים';

var MSG_SETTINGS_SAVED = '✅ הגדרות נשמרו';

var MSG_SLEEP_OPEN = '⏳ בדיקת שינה פתוחה';

var MSG_CLOSE_REPORT_FIRST = '⚠️ סגור את הדו"ח הנוכחי תחילה';

var MSG_REPORT_DONE = '📋 דו"ח כבר מולא';

var MSG_REPORT_OPEN_ELSEWHERE = '⚠️ הדו"ח כבר נפתח במכשיר אחר — הסימונים נשמרים לרשומה הקיימת';

var MSG_DEL_ROW_TITLE = '🗑️ מחיקת רשומה';

var MSG_DEL_ROW_BODY = 'הרשומה תימחק לצמיתות מהארכיון. לא ניתן לשחזר פעולה זו.';

var MSG_SWITCH_TITLE = '👤 כניסה משתמש';

var MSG_SWITCH_NEED_PASS = 'נא הכנס סיסמא';

var MSG_SWITCH_WRONG_PASS = 'סיסמא שגויה';

var MSG_SWITCHED_AS = '✅ נכנסת כ-';

var MSG_SOON_TITLE = '🏗️ המודול בבנייה';

var MSG_ADD_STUDENT_TITLE = 'הוסף תלמיד';

var MSG_EDIT_STUDENT_TITLE = 'עריכת תלמיד';

var MSG_NEED_STUDENT_NAME = 'נא להזין שם';

var HR_ORDER_KEY = 'hr_user_order';

// dur באלפיות שנייה. הערך זהה במקרה ל-LS_SUCCESS_MUTE_MS אך הוא מושג אחר — אין לאחד ביניהם.
var TOAST_DEFAULT_MS = 2800;

// ── מדיניות האחסון המקומי ──
var KV_TABLE = 'hr_settings';

// ── MIRROR_CFG ──
// tables היא פונקציה: PUSH_TABLES מוצהר אחרי הבלוק, וקריאה כאן הייתה מקבלת undefined.
// empty מחזירה null ולא מערך ריק — מפתח שאינו על הדיסק נופל לברירת המחדל, ורשימה ריקה אינה.
var HR_MIRROR_TABLES = ['hr_sessions', 'hr_marks', 'hr_sleep_sessions',
                        'hr_sleep_marks', 'hr_students_rows', KV_TABLE, 'hr_users'];

var MIRROR_CFG = {
  prefix: self.APP.prefix + 'mirror_',
  app:    self.APP.prefix,
  tables: function () { return HR_MIRROR_TABLES; },
  noPush: [{ t: 'hr_marks',       via: 'hrSendRecs', adds: 'parent' },
           { t: 'hr_sleep_marks', via: 'hrSendRecs', adds: 'parent' },
           { t: 'hr_users',       via: 'writeUser',  adds: 'secret' }],
  empty:  function () { return null; },
  ts:     function (r) { return _hrRecTs(r); },
  clean:  function (t, rows) { return t === authUsersTable() ? usersSanitize(rows) : rows; },
  fail:   function (where, e) { hrWriteFail(where, e); },
};

// ── סוג האפליקציה ורשימות הפינוי ──
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
    { key: mirrorKey('hr_sessions'), label: 'סדרי נוכחות',   ts: _hrRecTs,
      idOf: _hrRecId, syncedThrough: _hrPushedFor('hr_sessions'), verify: _hrVerify('hr_sessions') },
    { key: mirrorKey('hr_marks'), label: 'סימוני נוכחות', ts: _hrRecTs,
      parent: mirrorKey('hr_sessions'), parentOf: _hrMarkParent,
      idOf: _hrRecId, syncedThrough: _hrPushedFor('hr_marks'), verify: _hrVerifyRows(function () { return SB.from('hr_marks').select('client_id,updated_at'); }) },
    { key: mirrorKey('hr_sleep_sessions'),  label: 'רשומות שינה',   ts: _hrRecTs,
      idOf: _hrRecId, syncedThrough: _hrPushedFor('hr_sleep_sessions'),  verify: _hrVerify('hr_sleep_sessions') },
    { key: mirrorKey('hr_sleep_marks'), label: 'סימוני שינה', ts: _hrRecTs,
      parent: mirrorKey('hr_sleep_sessions'), parentOf: _hrMarkParent,
      idOf: _hrRecId, syncedThrough: _hrPushedFor('hr_sleep_marks'), verify: _hrVerifyRows(function () { return SB.from('hr_sleep_marks').select('client_id,updated_at'); }) },
    { key: 'hr_attend_treats',   label: 'טיפולים — סדרים', ts: _hrRecTs,
      idOf: _hrRecId, syncedThrough: _hrPushedFor('hr_attend_treats'),   verify: _hrVerify('hr_attend_treats') },
    { key: 'hr_sleep_treats',    label: 'טיפולים — שינה',  ts: _hrRecTs,
      idOf: _hrRecId, syncedThrough: _hrPushedFor('hr_sleep_treats'),    verify: _hrVerify('hr_sleep_treats') }
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

// המסמך הוא מודול ושם שמוגדר בו אינו גלובלי — השמות שנקראים מתגית וממפת הפעולות מוצבים על window במפורש.

// ── BK_CFG ──
// logQueueKey נשאר hr_login_log_queue — LS_CFG.pending() בודק אותו, ושינוי שמו מנתק בשקט את ההגנה על הפינוי.
// hr_users אינה מגובה — sh_backup קריאה ל-anon, וגיבויה היה מעתיק את טביעות הסיסמה.
var BK_CFG = {
  client: function () { return SB; },
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
      { kind: 'table', name: 'hr_sessions',       key: 'hr_sessions_rows',  order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'hr_marks',          key: 'hr_marks_rows',     order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'hr_students_rows',  key: 'hr_students_rows',  order: 'client_id', ts: 'updated_at' }
    ];
    // מחרוזות המפתח הן רשימת-ההיתר של הפינוי במסד — מפתח שאינו שם אינו מתפנה לעולם.
    out.push(
      { kind: 'table', name: 'hr_sleep_sessions', key: 'hr_sleep_sessions_rows', order: 'client_id', ts: 'updated_at' },
      { kind: 'table', name: 'hr_sleep_marks',    key: 'hr_sleep_marks_rows',    order: 'client_id', ts: 'updated_at' }
    );
    // אין מקור kind:'kv' — הטבלה אינה קיימת במסד, ומקור שנכשל מונע את דגל הגיבוי היומי וכל עלייה מגבה שוב.
    out.push({ kind: 'table', name: KV_TABLE, key: KV_TABLE, order: 'key', ts: 'updated_at' });
    return out;
  }
};

// ── PEND_CFG ──
var PEND_CFG = {
  app: 'hanhala-ruchanit', key: 'hr_pending',
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

// ── RTY_CFG ──
var RTY_CFG = {
  flush:   function () { return hrPushToCloud(); },
  pending: function () { try { return pendCount() > 0; } catch (e) { return false; } },
};

// ── LK_CFG ──
// אין להוסיף כאן הודעה — חלון האזהרה של הליבה הוא ההודעה, ונוסח שני נבדל ממנו בשקט.
var LK_CFG = {
  active: function () { return sessActive(); },
  lock:   function () { doLogout(); },
};

// ── PL_CFG ──
// החותמת בטבלת ההגדרות ונכתבת רק דרך plTouch — גם מכתיבת משתמש, ב-hrTouchLastChanged().
// ok() היא חותמת תצוגה בלבד — אין להזין ממנה את עֵד הפינוי.
var PL_CFG = {
  every:  3000,
  active: function () { return sessActive(); },
  seen:   function () { return S._hrLastTs; },
  note:   function (ts) { S._hrLastTs = ts; },
  ok:     function () { _hrMarkSynced(); },
  pull:   function () { return hrPullFromCloud(); },
  client: function () { return SB; },
  table:  function () { return KV_TABLE; },
};

// ── PUSH_CFG ──
// hr_users אינה נדחפת לעולם — המראה בלי סיסמאות, ודחיפתה הייתה כותבת סיסמה ריקה; מסלולה writeUser.
// הסדר קובע: הסדרים לפני המצבה, וההגדרות — בלי אב ובלי בן — אחרונות.
var PUSH_TABLES = ['hr_sessions', 'hr_sleep_sessions', 'hr_students_rows', KV_TABLE];

var PUSH_CFG = {
  tables: PUSH_TABLES,
  chunk:  500,
  delay:  400,
  // ctx הוא המערך שהכותב כבר מחזיק, ובלעדיו העותק שבמראה — מחזור בלי קלט הוא «אין ראיה», וההגדרות היו נשארות ממתינות.
  dirty:  function (t, ctx) {
    S._hrPushEp = ctxEpoch();
    if (t === KV_TABLE) return hrSetDirtyRows();
    return hrPushDirty(t, Array.isArray(ctx) ? ctx : hrLocalRecs(t));
  },
  key:    function (t, row) {
    if (t === KV_TABLE) return row ? PK_SET + row.key : null;
    var c = HR_ROWS_KINDS[HR_ROWS_READ_KEYS[t]];
    return (c && row && row.id != null) ? (c.pk + row.id) : null;
  },
  send:   function (t, rows) { return t === KV_TABLE ? hrSetSend(rows) : hrSendRecs(t, rows); },
  // הסימונים נדחפים בתוך הסדר ו-hrSendRecs נכשלת אם אחד מהם נכשל — לכן עֵד האב הוא גם עֵד הבן.
  mark:   function (t) {
    if (ctxStale(S._hrPushEp)) return;
    // הטיפולים יושבים בטבלת ההגדרות — ועֵד הפינוי שלהם הוא עֵדה.
    if (t === KV_TABLE) { Object.keys(HR_SET_FLAT).forEach(function (k) { _hrMarkPushed(HR_SET_FLAT[k]); }); return; }
    _hrMarkPushed(t);
    var c = HR_ROWS_KINDS[HR_ROWS_READ_KEYS[t]];
    if (c && c.child) _hrMarkPushed(c.child);
  },
  run:    function () { hrPushToCloud(); },
};

// ── HW_CFG ──
// רק hr_sessions בחלון — היחיד עם שדה תאריך פר-רשומה; המצבה אינה סדרה בזמן.
var HW_CFG = {
  enabled: true,
  admin: function () {
    try { return isAdmin(); }
    catch (e) { return false; }
  },
  specs: [{
    key: mirrorKey('hr_sessions'),
    label: 'סדרי נוכחות מחוץ לחלון',
    inWindow: function (r) { return hrHwInWindow(r); },
    idOf: _hrRecId,
    ts: _hrRecTs,
    isPending: function (r) {
      try { return !!(r && r.id != null && pendHas(PK_AT_SESS + r.id)); }
      catch (e) { return true; }
    },
    fetch: function () {
      return hrCloudGet('hr_sessions').then(function (rows) {
        return Array.isArray(rows) ? { ok: true, rows: rows } : { ok: false, rows: [] };
      }).catch(function () { return { ok: false, rows: [] }; });
    },
    rows: function () {
      if (Array.isArray(S._atData)) return S._atData;
      return hrMirrorRecs('hr_sessions');
    },
    apply: function (kept) { return hrMirrorWriteRecs('hr_sessions', kept); }
  }]
};

// ── שכבת המראה ──
// DATA_ERA עולה בשינוי צורת שורה, וגם בשינוי שם טבלה — המראה ממופתחת בשם.
// והוא מקודם אחרי ההגירה המקומית ולא לפניה — סדר הפוך זורק תור שטרם הוגר.
var DATA_ERA = 3;

var ERA_CFG = {
  prefix: self.APP.prefix,
  client: function () { return SB; },
  table:  function () { return KV_TABLE; },
  // גם אופק הפינוי נמחק — אופק ששרד מסנן את מה שהמשיכה מחזירה, והמכשיר היה נשאר ריק.
  wipe:   function () {
    mirrorTables().forEach(function (t) { MIRROR[t] = MIRROR_CFG.empty(); lsRemove(mirrorKey(t)); });
    lsClearHorizons();
  },
  // מחזור הדחיפה כאן פר-קטגוריה — התוצאה נאספת בסופו ונמסרת ב-eraNotePush.
  push:   function () { return hrPushToCloud().then(function () { return _eraPush; }); },
  refresh: function () { return hrSyncNow(); }
};

// ── שכבת השורות ──
// סימון נוכחות נכתב כשורה — ערך שלם נדרס כולו בכל כתיבה. date_iso משוכפל ל-hr_marks כדי שהדוח פר-תלמיד לא יצטרף לאב.
// deleted של הסדר יורד לכל סימוניו — אותו דוח, שאינו מצטרף לאב, היה קורא סימון של סדר מחוק כחי.

// השינה היא תצורה של אותו מסלול ולא העתקה שלו.
// note בשינה בלבד — אין להוסיף אותו לנוכחות לשם אחידות: ל-hr_marks אין עמודה כזו, וה-upsert נדחה כולו.
var HR_ROWS_KINDS = {
  attend: { parent: 'hr_sessions',       child: 'hr_marks',       pk: PK_AT_SESS, note: false },
  sleep:  { parent: 'hr_sleep_sessions', child: 'hr_sleep_marks', pk: PK_SL_SESS, note: true  }
};

// ── מקור הקריאה ──
// אין לקרוא ל-hrCfgGet ישירות למפתח שיש לו טבלה — הקריאה עוברת ב-hrCloudGet בלבד.
// הקורא דורש שחותמת שורת הסימון לא תהיה ישנה מחותמת האב — סימון שנמחק אינו מתעדכן ונשאר מאחור.
var HR_ROWS_READ_KEYS = { hr_sessions: 'attend', hr_students_rows: 'students' };

// ── DEV_CFG ──
var DEV_CFG = { key: 'hr_device_id' };

// רשומה מקומית ממתינה לסנכרון מנצחת בלי תלות בחותמת — אין להסיר את isPending: החותמת בענן מאוחרת מעריכה שטרם עלתה, והעריכה נמחקת בשקט.
// המחיר המודע: מכשיר שנותק זמן רב דורס בעלייתו עריכה מרוחקת חדשה יותר — והרשומה מתריעה כל אותו זמן.
// USER_CFG: מה שנבדל — הלקוח, הטבלה, הודעת הניתוק ומה שאחרי התשובה; הכתיבה עצמה משותפת.
var USER_CFG = {
  ready: function () { return !!SB && navigator.onLine; },
  // ההודעה נקראת בזמן הקריאה ולא בהשמה — הקבוע מוצהר מאוחר יותר בקובץ, וקריאה בהשמה נותנת undefined.
  offMsg: function () { return MSG_OFF_USER_WRITE; },
  from: function () { return SB.from(authUsersTable()); },
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

export { HR_ORDER_KEY, HR_PERMS_KEY, HR_ROWS_KINDS, HR_ROWS_READ_KEYS, KV_TABLE,
         MSG_ABSENCE_ALERT, MSG_ABSENCE_DUP, MSG_ACCESS_LIMITED, MSG_ACTION_FAILED,
         MSG_ADD_STUDENT_TITLE, MSG_ADMINS_ONLY, MSG_BAD_LOGIN, MSG_BUSY_CHECK,
         MSG_CARE_MISSING, MSG_CARE_SAVED, MSG_CLOSE_REPORT_FIRST,
         MSG_CLOSE_SESSION_FIRST, MSG_DELETED_MARK, MSG_DEL_CARE_BODY,
         MSG_DEL_CARE_TITLE, MSG_DEL_ROW_BODY, MSG_DEL_ROW_TITLE, MSG_DEL_SESSION_BODY,
         MSG_DEL_SESSION_TITLE, MSG_EDIT_MARK, MSG_EDIT_STUDENT_TITLE, MSG_EXPORT_FAIL,
         MSG_EXPORT_OK, MSG_EXPORT_PDF, MSG_EXPORT_XLS, MSG_FILE_READ_FAIL,
         MSG_FILL_ALL_X, MSG_LATE_OVER_30, MSG_LIB_LOADING, MSG_MARKED_ACTIVE,
         MSG_MARKED_INACTIVE, MSG_MARK_INACTIVE_TITLE, MSG_MARK_UPDATED,
         MSG_MONTH_DETAIL, MSG_NEED_MINUTES, MSG_NEED_STUDENT_NAME,
         MSG_NO_DATA_IN_RANGE, MSG_NO_EXPORT_DATA, MSG_NO_FP_ONLINE, MSG_NO_LINK,
         MSG_NO_STUDENTS_WIPE, MSG_NO_USER_SESSION, MSG_OFFLINE_LOGIN_LATER,
         MSG_OFF_FIRST_LOGIN, MSG_PASS_MISMATCH_X, MSG_PASS_NEEDS_NET,
         MSG_PASS_UPDATED_NO_FP, MSG_PASS_UPDATED_X, MSG_PDF_BUILDING,
         MSG_PDF_ENGINE_OFF, MSG_PDF_FAIL, MSG_PERMS_CHANGED_POST,
         MSG_PERMS_CHANGED_PRE, MSG_PERMS_SAVED, MSG_PICK_DATE_FIRST,
         MSG_PICK_END_DATE, MSG_PICK_REASON, MSG_PICK_START_DATE, MSG_PICK_STUDENT,
         MSG_REASONS_SAVED, MSG_REPORT_DONE, MSG_REPORT_OPEN_ELSEWHERE,
         MSG_ROW_DELETED, MSG_ROW_MISSING, MSG_SERVER_DOWN_LOCAL, MSG_SESSION_DONE,
         MSG_SESSION_OPEN_ELSEWHERE, MSG_SESSION_OPEN_TODAY, MSG_SETTINGS_SAVED,
         MSG_SLEEP_OPEN, MSG_SOON_TITLE, MSG_STATUS_HISTORY, MSG_STATUS_REVERTED,
         MSG_STUDENTS_ADMIN, MSG_STUDENTS_UPDATED, MSG_STUDENTS_WIPED,
         MSG_STUDENT_MISSING, MSG_SWITCHED_AS, MSG_SWITCH_NEED_PASS, MSG_SWITCH_TITLE,
         MSG_SWITCH_WRONG_PASS, MSG_TABLES_MISSING, MSG_USER_OFF, MSG_USER_ON,
         MSG_USER_SAVED, MSG_USER_SAVED_NO_FP, MSG_USER_SWITCHED_MID,
         MSG_WIPE_STUDENTS_BODY, MSG_WIPE_STUDENTS_OK, MSG_WIPE_STUDENTS_TITLE,
         MSG_YEAR_ROLL_A, MSG_YEAR_ROLL_C, MSG_YEAR_ROLL_DONE, MSG_YEAR_ROLL_TITLE };
