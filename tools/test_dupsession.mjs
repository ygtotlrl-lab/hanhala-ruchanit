#!/usr/bin/env node
/*  test_dupsession.mjs — מניעת כפילות סדרים: כלל אחד, ושני אתרי היצירה.
 *
 *  **מה נאכף:** כלל הכפילות מוגדר **פעם אחת** (`atFindLiveSession`) ונבדק
 *  בשני אתרי היצירה בפועל — הנוכחות והשינה; ⛔ הבדיקה רצה מול מצב טרי
 *  מהענן ⚠️ ובחלון של יום אחד; ⛔ וסדר שכבר קיים **מאומץ** ⚠️ בלי למחוק
 *  את סימוני המכשיר האחר.
 *
 *  **הנימוק המדוד:** שני מכשירים שפתחו «שחרית» לאותו יום יצרו שני סדרים,
 *  ⛔ וכל אחד נשא חצי מהסימונים: ⚠️ ונמדדו 5 התנגשויות כאלה בנתונים
 *  החיים, ⭐ ולכן `(session, date_iso)` **אינו** ייחודי במסד.
 *
 *  **מה יישבר בלעדיו:** ⛔ בלי הבדיקה בנקודת היצירה בפועל הכפילות נוצרת
 *  שוב, ⚠️ ובלי האימוץ הפתיחה השנייה **מוחקת** את מה שהמכשיר הראשון
 *  כבר סימן.
 *
 *  **מה אינו נאכף כאן:** ⛔ מנוע המיזוג — ⚠️ הוא מסופק לרתמה כבדל,
 *  ⭐ ונמדד בשער המיזוג; ⛔ ומבנה טבלאות הסדרים — ⚠️ נמדד בשער הטבלאות.
 *
 *  ⚠️ פרטי לאפליקציה הזו — ⛔ ליומן, לשכר ולגיוס אין סדר שנפתח ונסגר
 *  לאותו יום, ⭐ ואין שתי נקודות יצירה שאפשר לפתוח בהן את אותו דבר פעמיים.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { appSrc } from './appsrc.mjs';

/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית — ⚠️ הצהרה ריקה ולא היעדר:
 *  ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל — ⚠️ כל מוטציה היא שינוי ⟵ הרצה ⟵ שחזור,
 *  ⭐ והן רצות ברמה המלאה (`--full`), בסוף הסבב ולפני מיזוג. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/*  ⛔ המקור הוא `index.html` **ומודולי הליבה** — ⚠️ הליבה המשותפת יצאה
 *  למודול, ⭐ ושער שקורא את הקובץ בלבד אינו מוצא את מה שרץ. */
const SRC = appSrc(ROOT);

let failed = 0;
/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה שבה השער רץ, ⛔ ופחות ממנה
 *  הוא כשל — ⚠️ והמאזין על `exit` תופס גם יציאה שקדמה להמתנה. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
/*  ⛔ ריצפת הטענות — ⚠️ **מה נכנס**: המשותפת, שהיא מספר זהה בכל הריפו,
 *  ⛔ והפרטית עם היכולת שמוסיפה אותה; ⛔ **ומה מפיל**: משותפת שנבדלת בין
 *  הריפו, פרטית בלי נימוק, וסכום אפס. ⭐ **ולמה לא מספר אחד**: הוא מסתיר
 *  טענה משותפת שאבדה. */
const FLOOR = { shared: 0, app: 14, appWhy: 'מניעת כפילות סדרים — יכולת שקיימת בהנהלה בלבד: סדר שנפתח ונסגר לאותו יום' };
const EXPECTED = FLOOR.shared + FLOOR.app;
let RAN = 0;
/*  ⛔ המונה נלכד בכניסה לשלב המוטציות (סבב 119) — ⚠️ `null` הוא תהליך
 *  שלא הגיע לשם, ⛔ ואפס הוא שער שכל גופו מוטציות: ⭐ ההבחנה היא מה
 *  שמבדיל ריצה חלקית מדילוג מוצהר. */
let PRE_MUT = null;
const mutStage = () => { if (PRE_MUT === null) PRE_MUT = RAN; };
/*  ⛔ הדגל נלכד ברישום ⛔ ולא בסגירה — ⚠️ שער שמריץ שער אחר מציב אותו
 *  **אחרי** הרישום, ⭐ ולכן הוא חל על הילד ⛔ ולא על עצמו. */
const SUBRUN = !!process.env.GATE_SUBRUN;
/*  ⛔ הריצפה נמדדת בשני הכיוונים (סבב 118) — ⚠️ **מה נכנס**: מספר הטענות
 *  שרצו עד שלב המוטציות; ⛔ **ומה מפיל**: פחות מהמוצהר — ריצה חלקית —
 *  ⛔ ויותר ממנו — ריצפה מיושנת. ⭐ **ולמה שני הכיוונים**: ריצפה שאינה
 *  מתעדכנת מפסיקה למדוד את מה שנוסף. ⛔ **וההשהיה על שלב המוטציות בלבד
 *  (סבב 119)** — ⚠️ `mutStage` לוכדת את המונה בכניסה אליו, ⭐ ומה שהוא
 *  מוסיף אינו נספר בתקרה: ⛔ השהיה על הרמה המלאה כולה השאירה תשעה שערים
 *  בלי מדידה באף כיוון. ⚠️ ושער שמספרו משתנה גם בלי המוטציות מוכרז
 *  ב-`APP.floorRange` ומקבל את הטווח ב-`GATE_FLOOR_RANGE`. */
const FLOOR_MAX = (() => {
  const r = /^(\d+)-(\d+)$/.exec(process.env.GATE_FLOOR_RANGE || '');
  return r ? Number(r[2]) : EXPECTED;
})();
process.on('exit', () => {
  /*  ⚠️ שער שיובא לתהליך של שער אחר אינו סוגר — ⛔ הספירה שלו לא רצה.
   *  ⛔ וגם ריצת-משנה מוצהרת אינה סוגרת — ⚠️ שער שמריץ את עצמו בעץ
   *  סינתטי מגיע לחלק מטענותיו בכוונה, ⭐ והרצפה נמדדת על עץ אמיתי. */
  if (!process.argv[1] || !process.argv[1].endsWith(GATE_ID)) return;
  if (SUBRUN) return;
  /*  ⛔ אפס שנמדד בכניסה לשלב המוטציות הוא דילוג מוצהר (סבב 119) —
   *  ⚠️ שער שכל גופו מוטציות אינו רץ ברמה המהירה, ⭐ ואפס כזה אינו
   *  ריצה חלקית: ⛔ ו-`null` — תהליך שלא הגיע לשם — כן. */
  if (PRE_MUT === 0 && process.env.GATE_MUT !== '1') {
    console.log(`⏭ ${GATE_ID}: כל גופו רץ ברמה המלאה — לא נמדד כאן`);
    return;
  }
  const N = PRE_MUT || RAN;
  console.log(`רצו ${N} מתוך ${EXPECTED}`);
  if (N < EXPECTED) {
    console.error(`❌ ${GATE_ID}: רצו ${N} טענות מתוך ${EXPECTED} מוצהרות — ` +
      'מה עושים: ודא `await` בקריאה הראשית, ⛔ ויציאה שאינה קודמת להמתנה.');
    process.exitCode = 1;
  } else if (N > FLOOR_MAX) {
    console.error(`❌ ${GATE_ID}: רצו ${N}, והריצפה ${EXPECTED} — ` +
      'עדכן את `FLOOR`.');
    process.exitCode = 1;
  }
});
const ok = (m) => (RAN++, console.log('  ok   ' + m));
const bad = (m) => { RAN++; failed++; console.error('  FAIL ' + m); };
const assert = (cond, m) => (cond ? ok(m) : bad(m));
/*  ⛔ מונה ולא נוכחות (סבב 79) — ⚠️ בדיקת נוכחות עוברת גם על הצהרה כפולה
 *  וגם על שורה שיושבת בתוך הערה: ⭐ הטענה היא על **מספר המופעים**, ⛔ והוא
 *  מודפס בהודעה. */
const _hits = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
const noneIn = (re, s, label) => assert(_hits(re, s) === 0,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי אפס`);
const someIn = (re, s, label) => assert(_hits(re, s) >= 1,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי לפחות 1`);
/* חילוץ מודול מניעת הכפילות + רתמה. `ysMarks` ו-`_ysSessionsMerge` מסופקים
   כבדלים — הבדיקה כאן היא על כלל הכפילות ועל האימוץ, לא על מנוע המיזוג. */
const DUP_START = 'מניעת כפילות סדרים — ההגנה בנקודת היצירה';
const DUP_END = '/* ═══ סוף מניעת כפילות סדרים';
function extractDup(src) {
  const lines = src.split('\n');
  const si = lines.findIndex((l) => l.includes(DUP_START));
  const ei = lines.findIndex((l) => l.includes(DUP_END));
  if (si < 0 || ei <= si) return null;
  return lines.slice(si - 1, ei + 1).join('\n');
}
/*  ⛔ `idEq` נחלצת מ-`index.html` ⛔ ואינה נכתבת כאן מחדש — ⚠️ עותק שני של
    ההשוואה היה ממשיך לעבור אחרי שהמקורית השתנתה, ⭐ והרתמה הייתה מודדת
    את עצמה. */
function extractIdEq(src) {
  const m = /function idEq\(a, b\) \{[\s\S]*?\n\}/.exec(src);
  return m ? m[0] : null;
}
function dupHarness(modSrc) {
  const idEqSrc = extractIdEq(SRC);
  if (!idEqSrc) throw new Error('idEq לא נחלצה מ-index.html — נמדדו 0 הגדרות והצפוי אחת');
  const sandbox = {
    console, Object, Array, String, Number,
    window: { _atMarks: {}, _slMarks: {} },
    ysMarks: (r) => (r && r.marks && typeof r.marks === 'object') ? r.marks : {},
    ysKvGet: async () => null,
    _ysSessionsMerge: (c, l) => l,
  };
  vm.createContext(sandbox);
  vm.runInContext(idEqSrc + '\n' + modSrc, sandbox);
  return sandbox;
}

/* ══════════════════════════════════════════════════════════════════════════
   3ב · מניעת כפילות סדרים (השלמת סבב 36)
   ══════════════════════════════════════════════════════════════════════════ */
const DUP_GUARD = [
  [/function atFindLiveSession\(data, sessName, dateIso, exceptId\)/,
    '6א · כלל הכפילות מוגדר פעם אחת (`atFindLiveSession`)'],
  /*  ⛔ המשיכה מסוננת ליום שנבחר (סבב 89) — ⚠️ עד כאן היו כאן **שתי**
   *  משיכות מלאות בזו אחר זו, ⭐ 18,688 שורות כפול שתיים לפתיחת סדר אחד:
   *  ⛔ והבדיקה צריכה יום אחד — 248 שורות. ⚠️ והטענה מודדת **את החלון**
   *  ⛔ ולא את עצם המשיכה: ⭐ קריאה בלי חלון היא בדיוק מה שהצטמצם. */
  [/await _atPullSessions\(ysDayWin\(dateIso\)\);/,
    '6ב · בדיקת הפתיחה רצה מול מצב טרי מהענן, ⛔ ובחלון של יום אחד'],
  [/await _slPullSessions\(ysDayWin\(dateIso\)\);/,
    '6ב2 · ואותו חלון במודול השינה'],
  [/var _atDup=atFindLiveSession\(window\._atData,window\._atPendingRec\.session,/,
    '6ג · ⛔ הבדיקה חוזרת ב-`atMarkDirty` — נקודת היצירה בפועל'],
  [/var _slDup=atFindLiveSession\(window\._slData,window\._slPendingRec\.session,/,
    '6ד · אותה הגנה במודול השינה — אותו מבנה רשומה, אותו חור'],
];
function t3b() {
  console.log('\n3ב · מניעת כפילות סדרים');
  DUP_GUARD.forEach(([re, msg]) => assert(re.test(SRC), msg));

  // ⚠️ הרתמה מריצה את הפונקציות עצמן, לא regex עליהן.
  const src = extractDup(SRC);
  assert(src !== null, '6ה · מודול מניעת הכפילות מחולץ מ-index.html');
  if (!src) return;
  const sb = dupHarness(src);
  const rows = [
    { id: 'a', session: 'שחרית', date_iso: '2026-05-17' },
    { id: 'b', session: 'שחרית', date_iso: '2026-05-17', deleted: true },
    { id: 'c', session: 'מנחה',  date_iso: '2026-05-17' },
  ];
  assert(sb.atFindLiveSession(rows, 'שחרית', '2026-05-17').id === 'a',
    '6ו · סדר חי לאותו שם ואותו יום נמצא');
  assert(sb.atFindLiveSession(rows, 'מעריב', '2026-05-17') === null,
    '6ז · שם-סדר אחר אינו נחשב כפילות');
  assert(sb.atFindLiveSession(rows, 'שחרית', '2026-05-18') === null,
    '6ח · יום אחר אינו נחשב כפילות');
  assert(sb.atFindLiveSession([rows[1]], 'שחרית', '2026-05-17') === null,
    '6ט · ⛔ סדר מחוק אינו חוסם פתיחה מחדש — הכפילות היא בין סדרים חיים');
  assert(sb.atFindLiveSession(rows, 'שחרית', '2026-05-17', 'a') === null,
    '6י · `exceptId` מוציא את הרשומה הממתינה עצמה מהבדיקה');

  // אימוץ — ⛔ אינו מוחק את סימוני המכשיר האחר.
  sb.window._atMarks = { '1': { s: 'l', min: 12 }, '2': { s: '', min: 0 } };
  sb.atAdoptSession({ id: 'a', marks: { '1': { s: 'p', min: 0 }, '2': { s: 'e', min: 0 }, '3': { s: 'ak', min: 0 } } });
  assert(sb.window._atCurrentSessionId === 'a', '6כ · האימוץ מעביר את הסדר הפעיל לרשומה הקיימת');
  assert(sb.window._atMarks['1'].s === 'l', '6ל · סימון שהמשתמש כבר סימן גובר');
  assert(sb.window._atMarks['2'].s === 'e' && sb.window._atMarks['3'].s === 'ak',
    '6מ · ⛔ סימוני המכשיר האחר נטענים ואינם נמחקים');
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · הכלל, שני אתרי היצירה, והאימוץ
   ══════════════════════════════════════════════════════════════════════════ */
console.log('מניעת כפילות סדרים — כלל אחד בשני המקומות');
t3b();


/*  ⛔ מכאן ולמטה מוטציות — ⚠️ הן רצות ברמה המלאה בלבד: ⛔ הרמה המהירה
 *  עוצרת כאן עם קוד היציאה של הטענות שכבר רצו, ⭐ והכיסוי אינו יורד. */
mutStage();
if (!RUN_MUT) {
  console.log('\n⏭ test_dupsession: המוטציות רצות ברמה המלאה (--full)');
  process.exit(failed ? 1 : 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · מוטציות — כל טענה שאין מוטציה שמפילה אותה אינה שער
   ══════════════════════════════════════════════════════════════════════════ */
function t4() {
  console.log('\n4 · מוטציות');
  // הסרת בדיקת הכפילות מנקודת היצירה בפועל.
  const mutDup = SRC.replace(
    /    var _atDup=atFindLiveSession\(window\._atData,window\._atPendingRec\.session,\n\s*window\._atPendingRec\.date_iso,window\._atPendingRec\.id\);\n/,
    '    var _atDup=null;\n');
  assert(mutDup !== SRC, '5ח · המוטציה אכן מסירה את בדיקת הכפילות');
  /*  ⛔ הטענה נשלפת **לפי התווית** ⛔ ולא לפי מקומה במערך — ⚠️ הוספת שורה
   *  ל-`DUP_GUARD` הזיזה את האינדקס, ⭐ והמוטציה בדקה טענה אחרת: ⛔ מוטציה
   *  שמפילה טענה שאינה זו שנקבה בשמה אינה אכיפה. */
  const g6c = DUP_GUARD.find((x) => x[1].indexOf('6ג ') === 0);
  assert(!!g6c, '5ט0 · טענת 6ג אותרה ב-`DUP_GUARD` לפי תוויתה');
  assert(!g6c[0].test(mutDup),
    '5ט · ⛔ מוטציה שמסירה את בדיקת הכפילות נתפסת — טענת 6ג הייתה נכשלת');

  /*  ⛔ מוטציה שנייה: ביטול האימוץ — ⚠️ היא שוברת את **המנגנון**, ⭐ הסדר
   *  הקיים אינו נטען, ⛔ והמשתמש פותח סדר שני על אותו יום. */
  const src = extractDup(SRC);
  const mutAdopt = src.replace('window._atCurrentSessionId = rec.id;', 'window._atCurrentSessionId = null;');
  assert(mutAdopt !== src, '5י · המוטציה אכן מבטלת את האימוץ');
  const sbM = dupHarness(mutAdopt);
  sbM.atAdoptSession({ id: 'a', marks: {} });
  assert(sbM.window._atCurrentSessionId !== 'a',
    '5יא · ⛔ במוטנט הסדר הקיים אינו מאומץ — טענת 6כ הייתה נכשלת');
}

t4();
/*  ⭐ מוטציית-נגד: **קוד שנוסף** ⛔ אינו מפיל — ⚠️ הטענות מודדות את כלל
 *  הכפילות ואת שני אתרי היצירה, ⛔ ולא את אורך הקובץ. */
{
  const added = SRC + '\nfunction _ncDupPing(){ return 1; }\nvar _ncDupSeen = _ncDupPing();\n';
  assert(added !== SRC &&
    DUP_GUARD.every(([re]) => re.test(added)),
    'נ1 · ⭐ מוטציית-נגד: קוד שנוסף ⛔ אינו משנה את אתרי בדיקת הכפילות');
}

console.log(failed ? '\n✗ ' + failed + ' טענות נכשלו' : '\n✓ מניעת כפילות סדרים — כל הטענות עברו');
process.exit(failed ? 1 : 0);
