// app/constants.js — הנתונים: שמות הטבלאות, המחרוזות והקבועים
import { appConfigure } from '../core/util.js';

// ── מסירת התצורה ──
// כאן הנתונים שהליבה קוראת, והחיווט — ב-main.js; הקובץ הזה נטען ראשון, לפני כל קריאה לליבה.
// העידן עולה בשינוי צורת רשומה או מפתחה, ושינוי שם טבלה הוא שינוי כזה — המראה ממופתחת בשם.
// עותק בעידן ישן אינו נדחף — הממתין בו נרשם ביומן, והוא נזרק ונמשך מלא.
var DATA_ERA = 7;

appConfigure({ DATA_ERA: DATA_ERA });

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

// ── מדיניות האחסון המקומי ──
var KV_TABLE = 'hr_settings';

// ── MIRROR_CFG ──
// tables היא פונקציה: PUSH_TABLES מוצהר אחרי הבלוק, וקריאה כאן הייתה מקבלת undefined.
// empty מחזירה null ולא מערך ריק — מפתח שאינו על הדיסק נופל לברירת המחדל, ורשימה ריקה אינה.
var HR_MIRROR_TABLES = ['hr_sessions', 'hr_marks', 'hr_sleep_sessions',
                        'hr_sleep_marks', 'hr_students_rows', KV_TABLE, 'hr_users'];

// ── סוג האפליקציה ורשימות הפינוי ──

// המסמך הוא מודול ושם שמוגדר בו אינו גלובלי — השמות שנקראים מתגית וממפת הפעולות מוצבים על window במפורש.

// ── PUSH_CFG ──
// hr_users אינה נדחפת לעולם — המראה בלי סיסמאות, ודחיפתה הייתה כותבת סיסמה ריקה; מסלולה writeUser.
// הסדר קובע: הסדרים לפני המצבה, וההגדרות — בלי אב ובלי בן — אחרונות.
var PUSH_TABLES = ['hr_sessions', 'hr_marks', 'hr_sleep_sessions', 'hr_sleep_marks', 'hr_students_rows', KV_TABLE];

// ── שכבת השורות ──
// סימון נוכחות נכתב כשורה — ערך שלם נדרס כולו בכל כתיבה. session_date משוכפל ל-hr_marks — עמודת הסינון בשרת של טבלת הבן, בשם עמודת האב, כדי שהחלון והדוח פר-תלמיד לא יצטרפו לאב.
// deleted של הסדר יורד לכל סימוניו — אותו דוח, שאינו מצטרף לאב, היה קורא סימון של סדר מחוק כחי.

// השינה היא תצורה של אותו מסלול ולא העתקה שלו.
// note בשינה בלבד — ל-hr_marks אין עמודה כזו, ושורה שנושאת אותו נדחית ב-upsert כולו.
var HR_ROWS_KINDS = {
  attend: { parent: 'hr_sessions',       child: 'hr_marks',       pk: PK_AT_SESS, note: false },
  sleep:  { parent: 'hr_sleep_sessions', child: 'hr_sleep_marks', pk: PK_SL_SESS, note: true  }
};

// ── מקור הקריאה ──
// אין לקרוא ל-hrCfgGet ישירות למפתח שיש לו טבלה — הקריאה עוברת ב-hrCloudGet בלבד.
// הקורא דורש שחותמת שורת הסימון לא תהיה ישנה מחותמת האב — סימון שנמחק אינו מתעדכן ונשאר מאחור.
var HR_ROWS_READ_KEYS = { hr_sessions: 'attend', hr_students_rows: 'students', hr_sleep_sessions: 'sleep' };

// ── DEV_CFG ──

// הדחיפה היא דחיפת-מצב של המפתח כולו — לכן האישור הוא pendConfirmPush(prefix, t0):
// דחיפה מוצלחת מאשרת כל סימון שנרשם לפני שהצילום נלקח.
var PK_AT_SESS = 'at-sess:', PK_SL_SESS = 'sl-sess:', PK_STUDENT = 'student:',
    PK_SET = 'setting:', PK_AT_MARK = 'at-mark:', PK_SL_MARK = 'sl-mark:';

var PEND_KV_PREFIX = {
  'hr_sessions': PK_AT_SESS, 'hr_marks': PK_AT_MARK,
  'hr_sleep_sessions': PK_SL_SESS, 'hr_sleep_marks': PK_SL_MARK,
  'hr_students_rows': PK_STUDENT
};

// הגדרות שהעותק המקומי שלהן שטוח ואינו שורה במראה — הפינוי מפנה אותן פר-רשומה, ורשומה בתוך שורת הגדרות אינה ניתנת לפינוי.
var HR_SET_FLAT = { attend_treats: 'hr_attend_treats', sleep_treats: 'hr_sleep_treats' };

export { HR_MIRROR_TABLES, HR_ORDER_KEY, HR_PERMS_KEY, HR_ROWS_KINDS, HR_ROWS_READ_KEYS,
         HR_SET_FLAT, KV_TABLE, MSG_ABSENCE_ALERT, MSG_ABSENCE_DUP, MSG_ACCESS_LIMITED,
         MSG_ACTION_FAILED, MSG_ADD_STUDENT_TITLE, MSG_ADMINS_ONLY, MSG_BAD_LOGIN,
         MSG_BUSY_CHECK, MSG_CARE_MISSING, MSG_CARE_SAVED, MSG_CLOSE_REPORT_FIRST,
         MSG_CLOSE_SESSION_FIRST, MSG_DELETED_MARK, MSG_DEL_CARE_BODY, MSG_DEL_CARE_TITLE,
         MSG_DEL_ROW_BODY, MSG_DEL_ROW_TITLE, MSG_DEL_SESSION_BODY, MSG_DEL_SESSION_TITLE,
         MSG_EDIT_MARK, MSG_EDIT_STUDENT_TITLE, MSG_EXPORT_FAIL, MSG_EXPORT_OK,
         MSG_EXPORT_PDF, MSG_EXPORT_XLS, MSG_FILE_READ_FAIL, MSG_FILL_ALL_X,
         MSG_LATE_OVER_30, MSG_LIB_LOADING, MSG_MARKED_ACTIVE, MSG_MARKED_INACTIVE,
         MSG_MARK_INACTIVE_TITLE, MSG_MARK_UPDATED, MSG_MONTH_DETAIL, MSG_NEED_MINUTES,
         MSG_NEED_STUDENT_NAME, MSG_NO_DATA_IN_RANGE, MSG_NO_EXPORT_DATA,
         MSG_NO_FP_ONLINE, MSG_NO_LINK, MSG_NO_STUDENTS_WIPE, MSG_NO_USER_SESSION,
         MSG_OFFLINE_LOGIN_LATER, MSG_OFF_FIRST_LOGIN, MSG_PASS_MISMATCH_X,
         MSG_PASS_NEEDS_NET, MSG_PASS_UPDATED_NO_FP, MSG_PASS_UPDATED_X, MSG_PDF_BUILDING,
         MSG_PDF_ENGINE_OFF, MSG_PDF_FAIL, MSG_PERMS_CHANGED_POST, MSG_PERMS_CHANGED_PRE,
         MSG_PERMS_SAVED, MSG_PICK_DATE_FIRST, MSG_PICK_END_DATE, MSG_PICK_REASON,
         MSG_PICK_START_DATE, MSG_PICK_STUDENT, MSG_REASONS_SAVED, MSG_REPORT_DONE,
         MSG_REPORT_OPEN_ELSEWHERE, MSG_ROW_DELETED, MSG_ROW_MISSING,
         MSG_SERVER_DOWN_LOCAL, MSG_SESSION_DONE, MSG_SESSION_OPEN_ELSEWHERE,
         MSG_SESSION_OPEN_TODAY, MSG_SETTINGS_SAVED, MSG_SLEEP_OPEN, MSG_SOON_TITLE,
         MSG_STATUS_HISTORY, MSG_STATUS_REVERTED, MSG_STUDENTS_ADMIN,
         MSG_STUDENTS_UPDATED, MSG_STUDENTS_WIPED, MSG_STUDENT_MISSING, MSG_SWITCHED_AS,
         MSG_SWITCH_NEED_PASS, MSG_SWITCH_TITLE, MSG_SWITCH_WRONG_PASS,
         MSG_TABLES_MISSING, MSG_USER_OFF, MSG_USER_ON, MSG_USER_SAVED,
         MSG_USER_SAVED_NO_FP, MSG_USER_SWITCHED_MID, MSG_WIPE_STUDENTS_BODY,
         MSG_WIPE_STUDENTS_OK, MSG_WIPE_STUDENTS_TITLE, MSG_YEAR_ROLL_A, MSG_YEAR_ROLL_C,
         MSG_YEAR_ROLL_DONE, MSG_YEAR_ROLL_TITLE, PEND_KV_PREFIX, PK_AT_SESS, PK_SET,
         PK_AT_MARK, PK_SL_MARK, PK_SL_SESS, PK_STUDENT, PUSH_TABLES };
