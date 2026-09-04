#!/usr/bin/env node
/*  test_window.mjs — חלון החודש העברי והפעלת החלון החם.
 *
 *  **מה נאכף:** (1) **החלון עצמו** — הפונקציות האמיתיות רצות ברתמת `vm`
 *  מעל לוח התאריכים העברי האמיתי, עם שעון מזויף; (2) **שער הדיסק
 *  והזיכרון** — ⛔ הפינוי מצמצם את הדיסק בלבד: ⚠️ המערך שנכנס אינו משתנה,
 *  ומה שבזיכרון נשאר במלואו; (3) **החיווט** — משפך כתיבה אחד, ראיה עננית
 *  במשפך הקריאה, ⛔ ואין אתר כתיבה גולמי שעוקף את השער.
 *
 *  **הנימוק המדוד:** גבול החודש הוא מסלול שרץ פעם בחודש — ⚠️ באג בו מתגלה
 *  אחרי שהנתון כבר פונה.
 *
 *  **מה יישבר בלעדיו:** ⛔ פינוי שנוגע גם בזיכרון מרוקן מסך פתוח, ⚠️ בלי
 *  שגיאה; ⛔ ואתר כתיבה שעוקף את המשפך אינו רושם ראיה, ⭐ והפינוי מוחק לפיו.
 *
 *  **מה אינו נאכף כאן:** ⛔ התנהגות המודול המשותף עצמו — ⚠️ היא נאכפת
 *  בשער החלון החם, בארבעתן.
 *
 *  ⚠️ **פרטי כאן** ⛔ ואינו משותף: החלון של אחת האחיות נמדד בשנה לועזית
 *  ושל אחרת בשנת פעילות — ⭐ ורק כאן הוא חודש עברי, מפני שכל המסכים כאן
 *  מוצגים בלוח העברי. ⛔ המוטציות אינן נכתבות לעץ.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו 70% מזמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed++; console.error('  FAIL ' + m); };
const assert = (c, m) => (c ? ok(m) : bad(m));

/* ── חילוץ: לוח התאריכים העברי + עוזרי החלון ───────────────────────────── */
const L = SRC.split('\n');
const calFrom = L.findIndex((l) => l.startsWith('window.DAYS_HEB='));
const calTo = L.findIndex((l, i) => i > calFrom && l.startsWith('window.ysHebDate=function'));
let calEnd = -1;
for (let i = calTo; i < L.length; i++) { if (L[i] === '};') { calEnd = i; break; } }
const winFrom = L.findIndex((l) => l.includes('חלון החודש העברי — עוזר פרטי'));
let winEnd = -1;
for (let i = winFrom; i < L.length; i++) { if (L[i].startsWith('/* ── HW_CFG')) { winEnd = i - 1; break; } }
assert(calFrom >= 0 && calEnd > calTo, 'לוח התאריכים העברי אותר ב-index.html');
assert(winFrom >= 0 && winEnd > winFrom, 'בלוק חלון החודש העברי אותר ב-index.html');
const CAL = L.slice(calFrom, calEnd + 1).join('\n');
const WIN = L.slice(winFrom, winEnd + 1).join('\n');

/*  שעון מזויף: `new Date()` ללא ארגומנטים מחזיר את היום שהתרחיש קבע,
 *  ⚠️ **בבנאי המקומי ולא ב-ISO** — ISO עם אזור זמן היה מזיז את התאריך
 *  ביום שלם בחלק מהמכונות, וזה בדיוק סוג הכשל שהחלון בא למדוד. */
function harness(y, m, d, extra) {
  const REAL = Date;
  class D extends REAL {
    constructor(...a) { if (a.length === 0) super(y, m - 1, d, 12, 0, 0); else super(...a); }
    static now() { return new REAL(y, m - 1, d, 12, 0, 0).getTime(); }
  }
  D.parse = REAL.parse.bind(REAL);
  D.UTC = REAL.UTC.bind(REAL);
  const win = {};
  const ctx = { window: win, Date: D, Intl, console, JSON, Math, String, Number, isFinite };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  /*  ⚠️ העוזרים נבנים **בתוך** ההקשר ולא מחוצה לו (סבב 56) — כך התרחיש
   *  והשעון המזויף חולקים realm אחד. ⭐ הכשל שחייב את זה — `ysHebDate`
   *  שבדקה `d instanceof Date` ונפלה-חזרה ל«היום» בשקט — **תוקן בסבב 57**
   *  (`_ysIsDate`, ו-`tools/test_date.mjs` אוכף זאת), ⛔ והבנייה
   *  בתוך ההקשר נשארת מפני שהיא הדרך הנכונה ממילא. */
  vm.runInContext(CAL + '\n' + WIN + '\n' + (extra || '') + `
    this.__api = {
      ysHwWindowKeys: ysHwWindowKeys,
      ysHwInWindow: ysHwInWindow,
      iso: function (d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
               '-' + String(d.getDate()).padStart(2, '0');
      },
      hebOfIso: function (s) { return window.ysHebDate(new Date(Date.parse(s + 'T12:00:00'))); },
      shift: function (s, n) {
        var t = new Date(Date.parse(s + 'T12:00:00'));
        t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n, 12, 0, 0);
        return this.iso(t);
      },
      todayIso: function () { return this.iso(new Date()); }
    };`, ctx);
  return { api: ctx.__api, RealDate: REAL, D };
}

/* ── 1. החלון: חודש עברי נוכחי + הקודם, ולא יותר ───────────────────────── */
const TODAY = new Date();
const h = harness(TODAY.getFullYear(), TODAY.getMonth() + 1, TODAY.getDate());
const keys = h.api.ysHwWindowKeys();
assert(keys && Object.keys(keys).length === 2,
  'החלון מחזיק בדיוק שני חודשים עבריים (' + (keys ? Object.keys(keys).join(', ') : 'null') + ')');

const todayIso = h.api.todayIso();
const cur = h.api.hebOfIso(todayIso);
const prevIso = h.api.shift(todayIso, -cur.day);        // היום האחרון של החודש הקודם
const prev = h.api.hebOfIso(prevIso);
const backIso = h.api.shift(prevIso, -prev.day);        // היום האחרון של החודש שלפניו
const firstIso = h.api.shift(prevIso, 1);               // א׳ בחודש הנוכחי

assert(h.api.ysHwInWindow({ date_iso: todayIso }), 'רשומה של היום — בחלון (' + cur.monthName + ')');
assert(h.api.ysHwInWindow({ date_iso: prevIso }),
  'רשומה מהחודש העברי הקודם — בחלון (' + prev.monthName + ')');
assert(!h.api.ysHwInWindow({ date_iso: backIso }),
  'רשומה משני חודשים עבריים אחורה — מחוץ לחלון (' + h.api.hebOfIso(backIso).monthName + ')');
assert(h.api.ysHwInWindow({ date_iso: firstIso }) && h.api.hebOfIso(firstIso).day === 1,
  'א׳ בחודש הנוכחי — בחלון');

/* ⛔ ספק משאיר בפנים — רשומה בלי תאריך ורשומה עם תאריך שאינו נקרא. */
assert(h.api.ysHwInWindow({}), 'רשומה בלי date_iso נשארת בחלון (ספק ⇐ בפנים)');
assert(h.api.ysHwInWindow({ date_iso: 'לא-תאריך' }), 'תאריך שאינו נקרא משאיר את הרשומה בחלון');

/*  ⚠️ בדיקת גבול אמיתית: יום אחד לפני תחילת החודש הנוכחי הוא עדיין בחלון
 *  (החודש הקודם), ⛔ ויום אחד לפני תחילת החודש הקודם כבר אינו — זה
 *  ההבדל בין בדיקת גבול לבדיקה שעוברת על כל תאריך. */
assert(prev.monthIndex !== cur.monthIndex && h.api.hebOfIso(backIso).monthIndex !== prev.monthIndex,
  'שלושת החודשים שנמדדו נבדלים זה מזה — הגבול חד ואינו מקרי');

/* ── 2. שער הדיסק מצמצם את הדיסק בלבד ──────────────────────────────────── */
const MODS = (() => {
  const s = L.findIndex((l) => l.includes('/* ═══ חלון חם ושחזור מקומי — מודול משותף (סבב 35)'));
  const e = L.findIndex((l) => l.includes('/* ═══════════════ סוף מודול החלון החם'));
  return L.slice(s, e + 1).join('\n');
})();
function diskHarness(rows, seen) {
  const REAL = Date;
  const win = {};
  const ctx = {
    window: win, Date: REAL, Intl, console, JSON, Math, String, Number, isFinite,
    setTimeout: () => 0, localStorage: { getItem: () => null },
    lsLog: () => {}, lsSetArray: () => true, lsRestoreAll: () => {}, document: null,
    AUTH: { user: { role: 'admin' } }, pendHas: () => false,
    HW_CFG: {
      enabled: true, admin: () => true,
      specs: [{
        key: 'ys_attend_sessions',
        inWindow: (r) => !r.old,
        idOf: (r) => r.id, ts: (r) => r.ts,
        isPending: (r) => !!r.pending,
        fetch: () => Promise.resolve({ ok: true, rows: [] }),
        rows: () => rows, apply: () => true
      }]
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(MODS + '\nthis.__api = { hwDiskFilter, hwNoteCloud };', ctx);
  ctx.__api.hwNoteCloud('ys_attend_sessions', seen);
  return ctx.__api;
}
const memory = [{ id: 'a', ts: 100, old: true }, { id: 'b', ts: 200, old: true, pending: true },
                { id: 'c', ts: 300 }];
const before = memory.length;
const api2 = diskHarness(memory, [{ id: 'a', ts: 100 }, { id: 'b', ts: 200 }]);
const kept = api2.hwDiskFilter('ys_attend_sessions', memory);
assert(kept.length === 2 && !kept.some((r) => r.id === 'a'),
  'רשומה ישנה, לא-מסומנת ובעלת ראיה עננית — יורדת מהדיסק');
assert(kept.some((r) => r.id === 'b'), '⛔ רשומה מסומנת ⏳ נשארת על הדיסק גם כשהיא מחוץ לחלון');
assert(kept.some((r) => r.id === 'c'), 'רשומה בתוך החלון נשארת');
assert(memory.length === before, '⛔ מערך הזיכרון לא השתנה — הפינוי נוגע בדיסק בלבד');

/* ── 3. החיווט הסטטי ───────────────────────────────────────────────────── */
const STATIC = [
  [/HW_CFG = \{\s*\n\s*enabled: true,/, 'HW_CFG.enabled = true'],
  [/key: 'ys_attend_sessions',/, "מפרט החלון קיים ל-ys_attend_sessions"],
  [/function _ysAtDiskSave\(rows\) \{\s*\n\s*return lsSetArray\('ys_attend_sessions', hwDiskFilter\(/,
   'משפך הכתיבה לדיסק עובר דרך hwDiskFilter'],
  [/try \{ hwNoteCloud\(kvKey, r\.data\); \}/, 'הראיה העננית נרשמת במשפך הקריאה (ysCloudGet)'],
];
for (const [re, msg] of STATIC) assert(re.test(SRC), msg);

/*  ⛔ אתר כתיבה גולמי אחד בלבד — זה שבתוך `HW_CFG.specs[].apply`, שהמודול
 *  קורא לו **אחרי** שכבר סינן. כל אתר נוסף הוא שער דיסק שנשמט. */
const raw = (SRC.match(/lsSetArray\('ys_attend_sessions'/g) || []).length;
assert(raw === 2, '⛔ שתי כתיבות גולמיות בלבד: apply של המפרט והמשפך עצמו (נמדד ' + raw + ')');
assert((SRC.match(/_ysAtDiskSave\(/g) || []).length >= 6,
  'חמשת אתרי הכתיבה + ההגדרה עוברים דרך המשפך');

if (RUN_MUT) {
/* ── מוטציות ───────────────────────────────────────────────────────────── */
function mutFails(label, mutSrc, re) {
  assert(!re.test(mutSrc), 'מוטציה — ' + label + ' מפילה את הטענה');
}
mutFails('כיבוי החלון', SRC.replace('enabled: true,\n  admin: function () {\n    try { return !!(AUTH.user',
  'enabled: false,\n  admin: function () {\n    try { return !!(AUTH.user'),
  /HW_CFG = \{\s*\n\s*enabled: true,/);
mutFails('הסרת שער הדיסק מהמשפך',
  SRC.replace("return lsSetArray('ys_attend_sessions', hwDiskFilter('ys_attend_sessions', rows), _ysRecTs);",
              "return lsSetArray('ys_attend_sessions', rows, _ysRecTs);"),
  /function _ysAtDiskSave\(rows\) \{\s*\n\s*return lsSetArray\('ys_attend_sessions', hwDiskFilter\(/);
mutFails('הסרת הראיה העננית', SRC.replace('try { hwNoteCloud(kvKey, r.data); }', '{ }'),
  /try \{ hwNoteCloud\(kvKey, r\.data\); \}/);

/*  מוטציית חלון: «החודש הנוכחי בלבד» — ⛔ חייבת להוציא את החודש הקודם. */
{
  const mut = WIN.replace('keys[prev.year + \':\' + prev.monthIndex] = true;', '');
  const h2 = (() => {
    const REAL = Date;
    class D extends REAL {
      constructor(...a) { if (a.length === 0) super(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 12, 0, 0); else super(...a); }
    }
    D.parse = REAL.parse.bind(REAL); D.UTC = REAL.UTC.bind(REAL);
    const ctx = { window: {}, Date: D, Intl, console, JSON, Math, String, Number, isFinite };
    ctx.globalThis = ctx; vm.createContext(ctx);
    vm.runInContext(CAL + '\n' + mut + '\nthis.__api = { ysHwInWindow };', ctx);
    return ctx.__api;
  })();
  assert(!h2.ysHwInWindow({ date_iso: prevIso }),
    'מוטציה — חלון של חודש אחד מוציא את החודש הקודם (הטענה מודדת ולא מצהירה)');
}

/*  ⭐ מוטציית-נגד — ⛔ שינוי **חי** שאסור לו להפיל (סבב 72): הצהרה חדשה
 *  שנוספת לקוד. ⚠️ עד כאן היא הייתה שינוי **הערה**, ⛔ ושינוי כזה מוכיח
 *  רק שהשער אינו `hash` של כל הקובץ — ולא שהוא מודד את מה שהוא טוען. */
{
  const counter = SRC.replace('</body>', '<script>var r72Live = 1;</script>\n</body>');
  assert(counter !== SRC, 'מוטציית-הנגד אכן שינתה את המקור');
  assert(STATIC.every(([re]) => re.test(counter)),
    '⭐ מוטציית-נגד — הצהרה חדשה וחיה ⛔ אינה מפילה אף טענה סטטית');
}

}

console.log(failed ? `\n❌ בדיקת סבב 56 נכשלה (${failed})` : '\n✅ בדיקת סבב 56 עברה');
process.exit(failed ? 1 : 0);
