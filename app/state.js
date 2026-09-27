// app/state.js — המצב המשותף בין המודולים
import { sessGet, sessSet } from '../core/auth.js';

// מצב שמודולים שונים כותבים — אובייקט אחד, כי קישור מיובא אינו ניתן להשמה.
export const S = {
  // ההקשר נלכד לפני ההמתנה — mark רץ אחרי await, וקריאת הגלובלי הייתה זוקפת את ההצלחה למשתמש אחר.
  _hrPushEp: 0,
  // ── חלון החודש העברי ──
  // חודש עברי נוכחי והקודם לו — אין לגזור מ«היום פחות 30»: חודש עברי 29 או 30 יום, ובגבול מדלגים על חודש.
  // לוח שאינו זמין מחזיר null והרשומה נשארת — פינוי על לוח שלא נטען הוא היעדר ראיה כראיה.
  _hrHwWinKeys: null,
  _hrHwWinDay: '',
  // ── סנכרון ענן ──
  _hrLastTs: 0,
  // מועד הסנכרון האחרון לשורת המצב — נכתב על כל שיחה מוצלחת עם הענן, גם בקריאה בלבד.
  // אינו עֵד דחיפה ואינו משמש לפינוי — לזה _hrPushedAt פר-מפתח.
  _hrLastSyncAt: 0,
  // localeCompare בונה משווה חדש בכל קריאה, ובתוך sort זה O(n log n) פעמים — לכן משווה אחד ברמת המודול.
  // בלי Intl.Collator — נפילה-חזרה ל-localeCompare עם אותו he, שהיא אותה השוואה.
  _heColl: null,
  // ── מצבת התלמידים ──
  currentFilter: 'all',
  editingStudentId: null,
  _atData: undefined,
  _hrData: undefined,
  _hrMarks: undefined,
  _hrCfg: undefined,
  _atMarks: undefined,
  _atCfg: undefined,
  _hrCurrentSessionId: undefined,
  _atCurrentSessionId: undefined,
  _hrPendingRec: undefined,
  _atPendingRec: undefined,
  _hrPending: undefined,
  _hrCleared: undefined,
  _atPending: undefined,
  _atCleared: undefined,
  _hrTreats: undefined,
  _hrSupHY: undefined,
  _atTreats: undefined,
  _atSupHY: undefined,
  _hrSupMI: undefined,
  _atSupMI: undefined,
  _hrSwitchId: undefined,
  _hcVw: undefined,
  _statusSid: undefined,
  _hrYearCache: undefined,
  _hrView: undefined,
  _hrSupRecords: undefined,
  _hrSaveTimer: undefined,
  _atView: undefined,
  _atSupRecords: undefined,
  _atSaveTimer: undefined,
  _alefFontB64: undefined,
  _statusStudentName: undefined,
  _hrPdfFontDone: undefined,
  _currentStatusType: undefined
};

// ── כניסה והרשאות ──
// נקודת האכיפה לניווט אחת — showPage בודק canAccess; אין להסתיר כפתורים לפי הרשאה:
// כפתור שנעלם משאיר את איש הצוות בלי לדעת שהמסך קיים ושאפשר לבקש גישה.
var AUTH = {
  // AUTH.user הוא חלון אל מודול הסשן, שבזיכרון בלבד — שדה רגיל כאן הוא מסלול שדרכו הסשן נכתב לדיסק.
  get user() { return sessGet(); }, // {id, username, full_name, role}
  set user(v) { sessSet(v); },
  offlineLogin: false, // true — אומת מול העותק המקומי, ומאומת מחדש כשהרשת חוזרת
  perms: null, // {students:{admin:'edit',manager:'view',junior:'none'}, ...}
  MODULES: [
    {id:'students', label:'👥 מצבת תלמידים'},
    {id:'attend',   label:'✅ שמירת סדרים'},
    {id:'sleep',    label:'🌙 זמן שינה'},
    {id:'exams',    label:'📝 מבחנים'},
    {id:'files',    label:'📁 תיקים אישיים'},
    {id:'reports',  label:'📊 גיליונות חודשיים'},
    {id:'settings', label:'⚙️ הגדרות מערכת'}
  ],

  ROLE_LABELS: {admin:'מנהל', manager:'צוות בכיר', junior:'צוות'},

  DEFAULT_PERMS: {
    students: {admin:'edit', manager:'edit', junior:'view'},
    attend:   {admin:'edit', manager:'edit', junior:'view'},
    sleep:    {admin:'edit', manager:'edit', junior:'view'},
    exams:    {admin:'edit', manager:'edit', junior:'view'},
    files:    {admin:'edit', manager:'edit', junior:'none'},
    reports:  {admin:'edit', manager:'view', junior:'none'},
    settings: {admin:'edit', manager:'none', junior:'none'}
  }
};

export { AUTH };
