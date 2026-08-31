#!/usr/bin/env node
/*  סבב 57 — התאריך העברי אינו נופל-חזרה ל«היום» (פרטי ל-hanhala-ruchanit).
 *
 *  ⚠️ **מה שנמדד:** `ysHebDate` ו-`hebrewDate` בדקו `d instanceof Date`
 *  ונפלו-חזרה ל-`new Date()` כשהתשובה הייתה שלילית. שני כשלים בשורה
 *  אחת:
 *    1. **`instanceof` תלוי-realm** — אובייקט תאריך שנוצר ב-realm אחר
 *       (iframe, רתמת `vm`) מחזיר `false` אף שהוא תאריך תקף לחלוטין.
 *       ⚠️ זה הפיל רתמה בסבב 56, ⛔ ובדפדפן יש realm אחד ולכן הוא נראה
 *       שם כלא-קיים.
 *    2. **⛔ הנפילה-חזרה שקטה** — וזו החמורה מהשתיים: קלט פגום הוצג
 *       כ**תאריך היום**, כאילו הוא נכון, בלי שום סימן. ⛔ בדיוק צורת
 *       הכשל שכלל ברזל 12 אוסר.
 *
 *  ⛔ **אפס מופעים בשלוש האחיות** (נמדד ב-26.8) — אין מה ליישר שם, ולכן
 *  הבדיקה הזו **פרטית כאן**.
 *
 *  שלושה חלקים:
 *    1. **טענות סטטיות** — `instanceof Date` ⛔ אינו חוזר לאזור הלוח.
 *    2. **התנהגות** — הפונקציות **האמיתיות** ברתמת `vm` עם שעון מזויף:
 *       תאריך תקף מ-realm זר ⛔ נקרא נכון · קלט פגום ⛔ אינו «היום» ·
 *       קריאה בלי ארגומנט ⛔ נשארת «היום» · והכשל **נרשם**.
 *    3. **מוטציה** — החזרת השורה הישנה ⛔ **חייבת** להחזיר את הבאג:
 *       תאריך מ-realm זר חוזר כתאריך היום.
 *
 *  ⛔ המוטציות אינן נכתבות לעץ (הלקח של סבב 42ג) — הן רצות על מחרוזת.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed++; console.error('  FAIL ' + m); };
const assert = (c, m) => (c ? ok(m) : bad(m));

/* ── חילוץ: לוח התאריכים העברי עד צרכני התצוגה ─────────────────────────── */
const L = SRC.split('\n');
const from = L.findIndex((l) => l.startsWith('window.DAYS_HEB='));
const to = L.findIndex((l, i) => i > from && l.startsWith('function hebrewMonth('));
assert(from >= 0 && to > from, 'אזור לוח התאריכים העברי אותר ב-index.html');
const CAL = L.slice(from, to + 1).join('\n');

/* ── 1. טענות סטטיות ───────────────────────────────────────────────────── */
/*  ⚠️ הטענות נמדדות על **קוד** ולא על הערות (סבב 57) — ההערה שמסבירה
 *  למה `instanceof Date` אסור מכילה בעצמה את המחרוזת, ובלי הניקוי
 *  הבדיקה הייתה נופלת על ההסבר שלה עצמה.                              */
const CODE = CAL.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

assert(!/instanceof\s+Date/.test(CODE),
       '⛔ אין `instanceof Date` באזור הלוח — הבדיקה אינה תלוית-realm');
assert(/window\._ysIsDate\s*=\s*function/.test(CODE),
       'שער הקלט `_ysIsDate` קיים');
assert(/typeof\s+d\.getTime\s*===\s*'function'/.test(CODE),
       'שער הקלט נבדק על החוזה (`getTime`) ולא על הטיפוס');
assert(/window\._ysBadDate\(/.test(CODE),
       '⛔ קלט פגום נרשם ואינו נבלע');

/*  ⛔ ומה שהיה שם קודם אינו חוזר: אין באזור הזה שום `?d:new Date()`
 *  שמחליף ארגומנט **שנמסר** בתאריך של היום — נפילה-חזרה שקטה ל«היום»
 *  היא בדיוק הבאג שהסבב סגר.                                          */
assert(!/\?\s*d\s*:\s*new Date\(\)/.test(CODE) &&
       !/\?\s*jsDate\s*:\s*new Date\(\)/.test(CODE),
       '⛔ אין נפילה-חזרה שקטה ל«היום» על ארגומנט שנמסר');

/* ── רתמה: שעון מזויף + Date זר ────────────────────────────────────────── */
const Y = 2026, M = 8, D = 26;           /* «היום» של התרחיש */

function harness(calSrc) {
  const REAL = Date;
  class FakeDate extends REAL {
    constructor(...a) { if (a.length === 0) super(Y, M - 1, D, 12, 0, 0); else super(...a); }
    static now() { return new REAL(Y, M - 1, D, 12, 0, 0).getTime(); }
  }
  FakeDate.parse = REAL.parse.bind(REAL);
  FakeDate.UTC = REAL.UTC.bind(REAL);
  const win = {};
  const ctx = { window: win, Date: FakeDate, Intl, console: { warn() {}, log() {} },
                JSON, Math, String, Number, Object, isFinite, isNaN };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(calSrc + `
    this.__api = { heb: function (d) { return window.ysHebDate(d); },
                   hebNoArg: function () { return window.ysHebDate(); },
                   text: function (d) { return hebrewDate(d); },
                   textNoArg: function () { return hebrewDate(); },
                   log: function () { return window._ysBadDates || []; } };`, ctx);
  /*  ⚠️ **תאריך מה-realm של הבודק** — `REAL` ולא `FakeDate`. זה בדיוק
   *  אובייקט התאריך ש-`instanceof` היה דוחה, והוא תקף לחלוטין.        */
  return { api: ctx.__api, foreign: (y, m, d) => new REAL(y, m - 1, d, 12, 0, 0) };
}

/* ── 2. התנהגות ────────────────────────────────────────────────────────── */
const H = harness(CAL);
const today = H.api.hebNoArg();
assert(today.ok === true, 'קריאה בלי ארגומנט מחזירה תאריך תקף');

const far = H.api.heb(H.foreign(2025, 3, 5));
assert(far.ok === true, 'תאריך תקף מ-realm זר נקרא בהצלחה');
assert(!(far.year === today.year && far.monthIndex === today.monthIndex && far.day === today.day),
       '⛔ תאריך מ-realm זר אינו מוחלף בתאריך של היום');

for (const [label, val] of [['מחרוזת', '2025-03-05'], ['אובייקט ריק', {}],
                            ['null מפורש כערך שאינו תאריך', 0],
                            ['Date לא-תקין', new Date('לא תאריך')]]) {
  const r = H.api.heb(val);
  assert(r.ok === false && r.src === 'bad-input', `קלט פגום (${label}) מוחזר כ«לא תקף»`);
  assert(!(r.year === today.year && r.day === today.day),
         `⛔ קלט פגום (${label}) אינו מוצג כתאריך של היום`);
}

assert(H.api.text(H.foreign(2025, 3, 5)) !== '' &&
       H.api.text(H.foreign(2025, 3, 5)) !== H.api.textNoArg(),
       'hebrewDate על תאריך מ-realm זר מחזיר את התאריך שלו ולא של היום');
assert(H.api.text('2025-03-05') === '', '⛔ hebrewDate על קלט פגום מחזיר מחרוזת ריקה');
assert(H.api.textNoArg() !== '', 'hebrewDate בלי ארגומנט נשאר «היום»');

const log = H.api.log();
assert(log.length > 0 && log.length <= 12,
       `הכשלים נרשמו (${log.length} רשומות) והרישום מוגבל ל-12`);
assert(log.some((e) => e.where === 'ysHebDate') && log.some((e) => e.where === 'hebrewDate'),
       'הרישום מציין את המקום שבו הקלט נדחה');

/* ── 3. מוטציה — החזרת השורה הישנה חייבת להחזיר את הבאג ────────────────── */
const mutated = CAL
  .replace(/if\(d===undefined\|\|d===null\) d=new Date\(\);\n\s*if\(!window\._ysIsDate\(d\)\)\{[^\n]*\n/,
           '  d=(d instanceof Date&&!isNaN(d.getTime()))?d:new Date();\n');
if (mutated === CAL) {
  bad('המוטציה לא נתפסה — שורת שער הקלט לא נמצאה');
} else {
  const Hm = harness(mutated);
  const t = Hm.api.hebNoArg();
  const f = Hm.api.heb(Hm.foreign(2025, 3, 5));
  assert(f.year === t.year && f.monthIndex === t.monthIndex && f.day === t.day,
         '⭐ המוטציה: השורה הישנה אכן מחזירה תאריך מ-realm זר כ«היום» — הבאג אמיתי');
}

console.log(failed ? `\n✗ סבב 57 (התאריך העברי) — ${failed} טענות נכשלו`
                   : `\n✓ סבב 57 (התאריך העברי) — כל הטענות עברו`);
process.exit(failed ? 1 : 0);
