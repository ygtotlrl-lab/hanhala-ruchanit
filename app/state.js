// app/state.js — המצב המשותף בין המודולים

// מצב שמודולים שונים כותבים — אובייקט אחד, כי קישור מיובא אינו ניתן להשמה.
const S = {
  // הלקוח נבנה ב-main בעלייה — כל מודול מגיע אליו מכאן.
  SB: null,
  // ── סנכרון ענן ──
  _hrLastTs: 0,
  // מועד הסנכרון האחרון לשורת המצב — נכתב על כל שיחה מוצלחת עם הענן, גם בקריאה בלבד.
  // אינו עֵד דחיפה ואינו משמש לפינוי — העֵד נרשם בליבה, בדחיפה עצמה.
  _hrLastSyncAt: 0,
  // ── מצבת התלמידים ──
  currentFilter: 'all',
  editingStudentId: null,
  _atData: null,
  _hrData: null,
  _hrMarks: {},
  _hrCfg: null,
  // sid → {s, min}
  _atMarks: {},
  _atCfg: null,
  _hrCurrentSessionId: null,
  _atCurrentSessionId: null,
  _hrPendingRec: undefined,
  _atPendingRec: undefined,
  _hrPending: {},
  _hrCleared: {},
  // sid → סומן לאחרונה, טרם ירד
  _atPending: {},
  // sid → נוקה ידנית, אין לסמן אוטומטית שוב
  _atCleared: {},
  _hrTreats: null,
  _hrSupHY: null,
  _atTreats: null,
  _atSupHY: null,
  _hrSupMI: null,
  _atSupMI: null,
  _hrSwitchId: undefined,
  _hcVw: {},
  _statusSid: undefined,
  // נתוני שנה מלוח הדפדפן: {hy, lb, jd (א׳ תשרי), ml[], leap}
  _hrYearCache: {},
  _hrView: 'reg',
  _hrSupRecords: undefined,
  _hrSaveTimer: null,
  _atView: 'reg',
  _atSupRecords: undefined,
  _atSaveTimer: null,
  _alefFontB64: null,
  _statusStudentName: undefined,
  _hrPdfFontDone: false,
  _currentStatusType: undefined
};

// ── כניסה והרשאות ──
// נקודת האכיפה לניווט אחת — showPage בודק canAccess; אין להסתיר כפתורים לפי הרשאה:
// כפתור שנעלם משאיר את איש הצוות בלי לדעת שהמסך קיים ושאפשר לבקש גישה.
var AUTH = {
  // AUTH.user מותקן בעלייה — חלון אל מודול הסשן, והקובץ הזה אינו מייבא מהליבה.
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

// ── מה שמסך צריך מ-main ──
// main רושם כאן בעלייה — מודול שמייבא מ-main סוגר מעגל, והרישום הוא הכיוון האחד.
const shell = { showPage: null, showPageInternal: null, renderStudents: null, atRenderArchive: null,
                atRenderSupervision: null, hrRenderArchive: null, hrRenderSupervision: null,
                renderAttendSettings: null, renderSleepSettings: null, atRenderStudents: null,
                hrRenderStudents: null, hrPullDraw: null };

export { AUTH, S, shell };
