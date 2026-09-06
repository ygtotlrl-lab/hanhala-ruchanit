#!/usr/bin/env node
/*  test_import.mjs — מסלול ייבוא התלמידים.
 *
 *  **מה נאכף:** שלושה ממצאים, ⛔ ולכל אחד מוטציה — (1) המזהה נוצר במכשיר
 *  ⛔ ואינו מונה עולה; (2) הייבוא מסמן ⏳; (3) תוצאת הכתיבה המקומית
 *  **נבדקת**. ⚠️ הבדיקה מריצה את הפונקציה האמיתית ברתמת `vm`, עם קלט
 *  אמיתי וקורא-קבצים מדומה.
 *
 *  **הנימוק המדוד:** המזהה היה מונה עולה — ⛔ שני מכשירים שמייבאים במקביל
 *  הקצו את אותם מזהים לתלמידים **שונים**, ⚠️ והמיזוג ראה בהם רשומה אחת.
 *
 *  **מה יישבר בלעדיו:** ⛔ ייבוא שאינו מסמן ⏳ אינו נספר, ⚠️ ושער הפינוי
 *  רשאי לפנות תלמיד שטרם עלה; ⛔ ו«N תלמידים נוספו בהצלחה» הוצג גם כשהכתיבה
 *  נכשלה.
 *
 *  **מה אינו נאכף כאן:** ⛔ פורמט הקובץ הנקלט — ⚠️ הוא קלט חיצוני, ⭐ ומה
 *  שנמדד הוא **מה שנעשה עם מה שנקרא**.
 *
 *  ⚠️ **פרטי לאפליקציה הזו**, ⛔ וזו חריגה מנומקת ולא סטייה: זהו מסלול
 *  הייבוא היחיד בארגון, ⚠️ ובדיקה שנכתבת על מה שאינו קיים היא הצהרה ולא
 *  מדידה.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed++; console.error('  FAIL ' + m); };
const assert = (cond, m) => (cond ? ok(m) : bad(m));

/* ── חיתוך לפי שם, בהתאמת סוגריים (זהה לרתמות האחרות של הסבב) ──────────── */
function cutAssign(name, src) {
  const re = new RegExp('\\nwindow\\.' + name + '\\s*=\\s*function', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('window.' + name + ' לא נמצאה ב-index.html');
  const start = m.index + 1;
  let i = src.indexOf('{', m.index + m[0].length - 1), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(start, i + 1) + ';'; }
  }
  throw new Error('window.' + name + ' אינה סגורה');
}
function cutFn(name, src) {
  const re = new RegExp('\\n(async )?function ' + name + '\\s*\\(', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('הפונקציה ' + name + ' לא נמצאה ב-index.html');
  const start = m.index + 1;
  let i = src.indexOf('{', m.index + m[0].length - 1), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(start, i + 1); }
  }
  throw new Error('הפונקציה ' + name + ' אינה סגורה');
}

const CSV = 'שיעור,שם פרטי,שם משפחה\n' +
            "א,משה,כהן\n" +
            "ב,יוסף,לוי\n" +
            "ג,דוד,ישראלי\n" +
            ",,\n" +                       // שורה ריקה — נספרת כדילוג
            'ז,אבי,מזרחי\n';               // שיעור לא מוכר — נספר ככישלון

/*  רתמה: מריצה את `importStudentsFromFile` האמיתית מול CSV, ומחזירה את
 *  מה שנכתב, מה שסומן ⏳, ומה שהוצג בסיכום.                              */
function run(src, opts) {
  const o = opts || {};
  const saved = [];      // כל קריאה ל-saveStudents
  const marked = [];     // כל קריאה ל-pendMark
  const summary = { icon: null, title: null, body: null, shown: false };
  const el = (set) => ({
    get textContent() { return set.v; },
    set textContent(x) { set.v = x; },
    get innerHTML() { return set.v; },
    set innerHTML(x) { set.v = x; },
    style: {},
    value: '',
  });
  const slots = { title: {}, body: {} };
  const sandbox = {
    console, JSON, Date, Math, String, Number, Array, Object, Boolean,
    isFinite, parseInt, parseFloat, RegExp, Error, Uint8Array,
    crypto: o.noCrypto ? undefined : { randomUUID: () => 'uuid-' + (sandbox.__n = (sandbox.__n || 0) + 1) + '-' + o.dev },
    XLSX: {},
    toast: () => {},
    esc: (x) => String(x),
    ysWho: () => 'tester',
    PK_STUDENT: 'student:',
    getStudents: () => (o.existing || []).slice(),
    saveStudents: (arr) => { saved.push(arr.slice()); return o.writeFails ? false : true; },
    pendMark: (k) => { marked.push(k); },
    schedulePush: () => { summary.pushed = true; },
    renderStudents: () => {},
    /*  ⛔ הסיכום עובר ב-`openModal` מסבב 80 — ⚠️ עד אז הוא מילא שלושה
     *  אלמנטים מוצהרים והציג מיכל משלו; ⭐ הרתמה לוכדת את הקריאה עצמה,
     *  ⛔ ולא את המיכל שכבר אינו קיים. */
    openModal: (title, body) => { slots.title.v = title; slots.body.v = body; summary.shown = true; },
    document: {
      getElementById: (id) => el({}),
    },
    FileReader: function () {
      this.readAsText = () => { this.onload({ target: { result: CSV } }); };
      this.readAsArrayBuffer = () => { this.onload({ target: { result: new Uint8Array(0) } }); };
    },
    window: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // ⚠️ מחולל המזהים עבר למודול המשותף בסבב 37א — הבדיקה חותכת אותו משם
  //    בשמו החדש. ⛔ אין לשכפל אותו לרתמה (סבב 37א) — עותק בבדיקה היה
  //    ממשיך לעבור גם אם הליבה עצמה תשתנה.
  vm.runInContext(cutFn('newClientId', src), sandbox, { filename: 'newClientId.js' });
  /*  ⛔ פונקציית המיון נחתכת מהמקור ⛔ ואינה מדומה ברתמה — ⚠️ מסלול הייבוא
   *  קורא לה על הרשימה שהוא עומד לשמור, ⭐ ופונקציה מדומה כאן הייתה מאשרת
   *  ייבוא שנשען על מיון שאינו קיים באפליקציה. */
  vm.runInContext(cutFn('ysSortStudents', src), sandbox, { filename: 'ysSortStudents.js' });
  vm.runInContext(cutAssign('importStudentsFromFile', src), sandbox, { filename: 'import.js' });
  sandbox.window.importStudentsFromFile({ files: [{ name: 'a.csv' }], value: 'a.csv' });
  return {
    saved, marked, pushed: !!summary.pushed,
    title: slots.title.v, body: slots.body.v, shown: summary.shown,
    added: saved.length ? saved[0].filter((s) => s.createdBy === 'tester') : [],
  };
}

console.log('· hanhala-ruchanit — סבב 37 (השלמה): מסלול הייבוא');

/* ── 1 · המזהה נוצר במכשיר ואינו רץ ────────────────────────────────────── */
const a = run(SRC, { dev: 'A' });
const b = run(SRC, { dev: 'B' });
assert(a.added.length === 3, '1 · שלושה תלמידים יובאו (' + a.added.length + ')');
assert(a.added.length > 0 && a.added.every((s) => typeof s.id === 'string' && s.id.length >= 8),
  '2 · ⭐ כל מזהה הוא מחרוזת שנוצרה במכשיר, ולא מספר רץ');
const idsA = new Set(a.added.map((s) => String(s.id)));
const idsB = b.added.map((s) => String(s.id));
assert(idsA.size === 3, '3 · שלושת המזהים באותו ייבוא שונים זה מזה');
assert(idsB.length > 0 && idsB.every((id) => !idsA.has(id)),
  '4 · ⛔ שני מכשירים שמייבאים את אותו קובץ במקביל אינם מקצים מזהה משותף');

/* ── 2 · סימון ⏳ לכל שורה מיובאת ───────────────────────────────────────── */
assert(a.marked.length === 3, '5 · שלושה סימוני ⏳ נכתבו (' + a.marked.length + ')');
assert(a.added.length > 0 && a.added.every((s) => a.marked.indexOf('student:' + s.id) > -1),
  '6 · ⛔ הסימון נגזר מהמזהה של הרשומה שנוספה בפועל, ולא ממיקום במערך');
assert(a.pushed, '7 · הדחיפה תוזמנה אחרי כתיבה מוצלחת');

/* ── 3 · תוצאת הכתיבה המקומית נבדקת ────────────────────────────────────── */
const f = run(SRC, { dev: 'C', writeFails: true });
assert(f.title && f.title.indexOf('נוספו בהצלחה') < 0,
  '8 · ⛔ כתיבה מקומית שנכשלה אינה מציגה «נוספו בהצלחה» (' + f.title + ')');
assert(f.marked.length === 0, '9 · ולא נכתב אף סימון ⏳ על מה שלא נשמר');
assert(!f.pushed, '10 · ולא תוזמנה דחיפה');
assert(f.shown, '11 · ⚠️ הסיכום כן מוצג — הכישלון נאמר למשתמש ואינו נבלע');

/* ── 4 · נפילה-חזרה כשאין crypto ───────────────────────────────────────── */
const nc = run(SRC, { dev: 'D', noCrypto: true });
assert(nc.added.length === 3 && new Set(nc.added.map((s) => String(s.id))).size === 3,
  '12 · ⚠️ בלי `crypto` הנפילה-חזרה עדיין נותנת שלושה מזהים שונים');

if (RUN_MUT) {
/* ── 5 · שלוש מוטציות ──────────────────────────────────────────────────── */
const FN = cutAssign('importStudentsFromFile', SRC);

/*  מוטציה א — חזרה למזהה רץ. ⛔ אם היא אינה מפילה את טענה 4, הבדיקה
 *  אינה מודדת את הדבר שהסבב תיקן.                                        */
const MUT_ID = FN.replace('var nid = newClientId();',
  'var nid = (existing.reduce(function(m,s){return Math.max(m,Number(s.id)||0);},0) + 1 + added);');
assert(MUT_ID !== FN, '13 · המוטציה מצאה את הקצאת המזהה');
{
  const src2 = SRC.replace(FN, MUT_ID);
  const x = run(src2, { dev: 'A' }), y = run(src2, { dev: 'B' });
  const sx = new Set(x.added.map((s) => String(s.id)));
  const clash = y.added.some((s) => sx.has(String(s.id)));
  assert(clash, '14 · ⛔ מזהה רץ מייצר התנגשות בין שני מכשירים — המוטציה נתפסה');
}

/*  מוטציה ב — הסרת סימון ה-⏳.                                            */
const MUT_PEND = FN.replace(/\n\s*addedIds\.forEach\(function\(id\)\{ pendMark\(PK_STUDENT \+ id\); \}\);/, '');
assert(MUT_PEND !== FN, '15 · המוטציה מצאה את שורת הסימון והסירה אותה');
{
  const x = run(SRC.replace(FN, MUT_PEND), { dev: 'A' });
  assert(x.marked.length === 0, '16 · ⛔ בלי השורה אין אף סימון ⏳ — המוטציה נתפסה');
}

/*  מוטציה ג — התעלמות מתוצאת הכתיבה.                                     */
const MUT_WROTE = FN.replace('wrote = (saveStudents(existing) !== false);',
  'saveStudents(existing); wrote = true;');
assert(MUT_WROTE !== FN, '17 · המוטציה מצאה את בדיקת תוצאת הכתיבה');
{
  const x = run(SRC.replace(FN, MUT_WROTE), { dev: 'C', writeFails: true });
  assert(x.title && x.title.indexOf('נוספו בהצלחה') > -1,
    '18 · ⛔ בלי הבדיקה מוצג «נוספו בהצלחה» על כתיבה שנכשלה — המוטציה נתפסה');
}

/*  ⭐ מוטציית-נגד — **שם מקומי שהוחלף בעקביות** ⛔ אינו מפיל.
 *  ⚠️ הטענות מודדות את **מקור המזהה** ואת הסימון שנגזר ממנו, ⛔ ולא את שם
 *  המשתנה שמחזיק אותו: ⭐ שער שהיה נופל על שינוי שם היה חוסם כל ניקוי. */
const NC_REN = FN.replace(/\bnid\b/g, 'newLocalId');
assert(NC_REN !== FN && !/\bnid\b/.test(NC_REN),
  'נ1 · מוטציית-הנגד אכן מחליפה את שם המשתנה בעקביות');
{
  const p = run(SRC.replace(FN, NC_REN), { dev: 'A' });
  const q = run(SRC.replace(FN, NC_REN), { dev: 'B' });
  const sp = new Set(p.added.map((s) => String(s.id)));
  assert(p.added.length === 3 && sp.size === 3 && p.marked.length === 3 && p.pushed &&
         q.added.every((s) => !sp.has(String(s.id))),
    'נ2 · ⭐ שם מקומי שהוחלף בעקביות ⛔ אינו מפיל — נמדד מקור המזהה, לא שמו');
}

}

console.log(failed ? `\n✗ סבב 37 (ייבוא) — ${failed} טענות נכשלו`
                   : `\n✓ סבב 37 (ייבוא) — ${20} טענות עברו`);
process.exit(failed ? 1 : 0);
