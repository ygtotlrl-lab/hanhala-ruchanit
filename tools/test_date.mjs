#!/usr/bin/env node
/*  test_date.mjs — התאריך העברי ⛔ אינו נופל-חזרה ל«היום».
 *
 *  **מה נאכף:** (1) טענות סטטיות — בדיקת הטיפוס ⛔ אינה חוזרת לאזור הלוח;
 *  (2) התנהגות — הפונקציות **האמיתיות** ברתמת `vm` עם שעון מזויף: תאריך
 *  תקף מ-realm זר ⛔ נקרא נכון · קלט פגום ⛔ אינו «היום» · קריאה בלי
 *  ארגומנט ⛔ נשארת «היום» · והכשל **נרשם**; (3) מוטציה — החזרת השורה
 *  הישנה ⛔ **חייבת** להחזיר את הבאג.
 *
 *  **הנימוק המדוד:** שני כשלים בשורה אחת — ⛔ בדיקת טיפוס תלוית-realm
 *  מחזירה שלילי על תאריך תקף לחלוטין, ⛔ והנפילה-חזרה **שקטה**: קלט פגום
 *  הוצג כ**תאריך היום**, ⚠️ כאילו הוא נכון, בלי שום סימן.
 *
 *  **מה יישבר בלעדיו:** ⛔ בדפדפן יש realm אחד, ⚠️ ולכן הכשל הראשון נראה
 *  שם כלא-קיים — ⭐ והשני מציג נתון שגוי כנתון נכון.
 *
 *  **מה אינו נאכף כאן:** ⛔ נכונות הלוח העברי עצמו — ⚠️ היא נמדדת מול הלוח
 *  האריתמטי הקבוע, ⛔ ולא מול ספריית המערכת: ⭐ גרסאות ישנות שוגות בשנים
 *  מסוימות.
 *
 *  ⛔ **אפס מופעים בשכר ובגיוס** — ⚠️ אין בהן צרכן תאריך עברי כלל, ⭐ ולכן
 *  השער חי ביומן ובהנהלה בלבד, ⛔ ובאותו נוסח בית-לבית.
 *  ⛔ המוטציות אינן נכתבות לעץ — הן רצות על מחרוזת.
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
/*  ⛔ מונה ולא נוכחות (סבב 79) — ⚠️ בדיקת נוכחות עוברת גם על הצהרה כפולה
 *  וגם על שורה שיושבת בתוך הערה: ⭐ הטענה היא על **מספר המופעים**, ⛔ והוא
 *  מודפס בהודעה. */
const _hits = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
const noneIn = (re, s, label) => assert(_hits(re, s) === 0,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי אפס`);
const someIn = (re, s, label) => assert(_hits(re, s) >= 1,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי לפחות 1`);


/* ── חילוץ: לוח התאריכים העברי עד צרכני התצוגה ─────────────────────────── */
const L = SRC.split('\n');
const from = L.findIndex((l) => l.startsWith('window.DAYS_HEB='));
/*  ⛔ העוגן הוא סמן סוף מוצהר ⛔ ולא שם פונקציה — ⚠️ עוגן שהוא שם נשבר
 *  ברגע שהפונקציה נמחקת, ⛔ והשער מאתר אז אזור ריק ונופל על קוד תקין. */
const to = L.findIndex((l, i) => i > from && l.startsWith('// ═══ סוף אזור התאריך העברי'));
assert(from >= 0 && to > from, 'אזור לוח התאריכים העברי אותר ב-index.html');
const CAL = L.slice(from, to + 1).join('\n');

/* ── 1. טענות סטטיות ───────────────────────────────────────────────────── */
/*  ⚠️ הטענות נמדדות על **קוד** ולא על הערות (סבב 57) — ההערה שמסבירה
 *  למה `instanceof Date` אסור מכילה בעצמה את המחרוזת, ובלי הניקוי
 *  הבדיקה הייתה נופלת על ההסבר שלה עצמה.                              */
const CODE = CAL.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

noneIn(/instanceof\s+Date/, CODE,
       '⛔ אין `instanceof Date` באזור הלוח — הבדיקה אינה תלוית-realm');
someIn(/window\._ysIsDate\s*=\s*function/, CODE,
       'שער הקלט `_ysIsDate` קיים');
someIn(/typeof\s+d\.getTime\s*===\s*'function'/, CODE,
       'שער הקלט נבדק על החוזה (`getTime`) ולא על הטיפוס');
someIn(/window\._ysBadDate\(/, CODE,
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
                   names: function (hy) { return window.ysHebMonthNames(hy); },
                   isLeap: function (hy) { return window.ysHebIsLeap(hy); },
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

/* ── 2ב. חודשי אדר — שנה מעוברת מול פשוטה ──────────────────────────────── */
/*  ⛔ הטענה היא על **הערך** ולא על קיום השם (סבב 80) — ⚠️ טבלת החודשים
 *  נבחרת לפי העיבור, ⭐ ושנה מעוברת נושאת שלושה-עשר חודשים ופשוטה
 *  שנים-עשר: ⛔ מיפוי שקורס את שני האדרים לאחד היה מאחד כ-60 יום לדלי
 *  חודש אחד בארכיון. ⚠️ שם החודש נבדל בין הריפו («אדר א» מול «אדר א׳»),
 *  ⛔ ולכן נמדדת הקידומת ולא המחרוזת המלאה. */
{
  const leapNames  = H.api.names(5787);   /* תשפ״ז — מעוברת */
  const plainNames = H.api.names(5786);   /* תשפ״ו — פשוטה  */
  assert(H.api.isLeap(5787) === true && H.api.isLeap(5786) === false,
         `⭐ העיבור נגזר מהשנה — 5787 מעוברת ו-5786 אינה (${H.api.isLeap(5787)}/${H.api.isLeap(5786)})`);
  assert(leapNames.length === 13 && plainNames.length === 12,
         `טבלת החודשים נבחרת לפי העיבור — ${leapNames.length} מול ${plainNames.length}`);

  const adarI  = H.api.heb(H.foreign(2027, 2, 20));
  const adarII = H.api.heb(H.foreign(2027, 3, 20));
  const adar   = H.api.heb(H.foreign(2026, 3, 5));
  assert(adarI.ok && adarI.monthName.indexOf('אדר א') === 0,
         `⭐ שנה מעוברת ⟵ «אדר א» (נמדד «${adarI.monthName}»)`);
  assert(adarII.ok && adarII.monthName.indexOf('אדר ב') === 0,
         `⭐ ובחודש שאחריו «אדר ב» (נמדד «${adarII.monthName}»)`);
  assert(adar.ok && adar.monthName === 'אדר',
         `⭐ ובשנה פשוטה «אדר» בלבד (נמדד «${adar.monthName}»)`);
  assert(adarI.monthIndex !== adarII.monthIndex,
         `⛔ ושני האדרים אינם אותו אינדקס — ${adarI.monthIndex} מול ${adarII.monthIndex}`);
}

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

/* ── 4. מוטציית-נגד — קוד שנוסף אינו מפיל ──────────────────────────────── */
/*  ⚠️ הטענות מודדות את **שער הקלט** ולא את העובדה שהקובץ לא השתנה.
 *  ⛔ ואין להפיל כאן על תוספת קוד — ⚠️ שער כזה היה הופך כל עבודה
 *  באפליקציה להפרה. */
{
  const grown = CAL + '\nfunction _ncDatePing(){ return 1; }\nvar _ncDateSeen = _ncDatePing();\n';
  const Hn = harness(grown);
  const tn = Hn.api.hebNoArg();
  const fn = Hn.api.heb(Hn.foreign(2025, 3, 5));
  assert(grown !== CAL && tn.ok === true && fn.ok === true &&
         !(fn.year === tn.year && fn.monthIndex === tn.monthIndex && fn.day === tn.day),
         'נ1 · ⭐ מוטציית-נגד: קוד שנוסף ⛔ אינו מפיל את שער הקלט');
  assert(Hn.api.heb('2025-03-05').src === 'bad-input',
         'נ2 · ⛔ וגם דחיית הקלט הפגום נשמרת בו');
}

console.log(failed ? `\n✗ סבב 57 (התאריך העברי) — ${failed} טענות נכשלו`
                   : `\n✓ סבב 57 (התאריך העברי) — כל הטענות עברו`);
process.exit(failed ? 1 : 0);
