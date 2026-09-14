#!/usr/bin/env node
/*  test_attend.mjs — מפתח הנוכחות הנטוש נמחק, ⛔ והמנגנון החי שרד.
 *
 *  **מה נאכף:** ⛔ אין אף אזכור של המפתח הנטוש בקוד, ⛔ והוא ירד גם
 *  ממקורות הגיבוי וגם מרשימת-ההיתר — ⚠️ בשקילות דו-כיוונית; ⛔ **ושהמנגנון
 *  החי שרד**, ⭐ כדי ששום מחיקה עתידית לא תבלבל ביניהם.
 *
 *  **הנימוק המדוד:** רישום אחד בלבד בכל התקופה — שני תלמידים ביום אחד —
 *  ⛔ מול 274 סדרים ו-13,144 סימונים במנגנון האמיתי; ⚠️ והפונקציות שכתבו
 *  אליו כבר לא נקראו משום מקום.
 *
 *  **מה יישבר בלעדיו:** ⛔ קוד מת שממשיך להיכתב לענן ולהיגבות — ⚠️ שני
 *  מנגנונים לאותו דבר, ⭐ ומי שקורא את המסד אינו יודע מי מהם האמת.
 *
 *  **מה אינו נאכף כאן:** ⛔ מחיקת המפתח מהמסד עצמו — ⚠️ היא פעולת מנהל,
 *  ⭐ ומה שנאכף הוא **היעדר הקוראים**.
 *
 *  ⚠️ פרטי לאפליקציה הזו — זה המפתח היחיד מסוגו בארגון.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const SQL = readFileSync(join(ROOT, 'migrations/004_backup_retention_cron.sql'), 'utf8');
const DOC = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');

let pass = 0, fail = 0;
/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה שבה השער רץ, ⛔ ופחות ממנה
 *  הוא כשל — ⚠️ והמאזין על `exit` תופס גם יציאה שקדמה להמתנה. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
/*  ⛔ ריצפת הטענות — ⚠️ **מה נכנס**: המשותפת, שהיא מספר זהה בארבעת הריפו,
 *  ⛔ והפרטית עם היכולת שמוסיפה אותה; ⛔ **ומה מפיל**: משותפת שנבדלת בין
 *  הריפו, פרטית בלי נימוק, וסכום אפס. ⭐ **ולמה לא מספר אחד**: הוא מסתיר
 *  טענה משותפת שאבדה. */
const FLOOR = { shared: 0, app: 19, appWhy: 'הנוכחות — יכולת שקיימת בהנהלה בלבד' };
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
const ok = (name, cond) => { RAN++; if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); } };

/* `ys_attend` כמילה שלמה — ⛔ ולא `ys_sessions`/`_cfg`/`_treats`. */
const BARE = /ys_attend(?![_A-Za-z0-9])/g;
const bare = (s) => (s.match(BARE) || []).length;

console.log('· סבב 38 — מחיקת `ys_attend`');

/* ── א. הקוד ───────────────────────────────────────────────────────────── */
ok('1 · אין אף אזכור של `ys_attend` ב-index.html', bare(SRC) === 0);
ok('2 · `getAttendance` נמחקה', !/function\s+getAttendance/.test(SRC));
ok('3 · `saveAttendance` נמחקה', !/function\s+saveAttendance/.test(SRC));
ok('4 · `ysMergeAttend` נמחקה', !/function\s+ysMergeAttend/.test(SRC));
ok('5 · `togglePresent` נמחקה', !/togglePresent/.test(SRC));
ok('6 · `recordTime` נמחקה', !/recordTime/.test(SRC));
ok('7 · אין צעד דחיפה למפתח', !/step\('ys_attend'/.test(SRC));

/* ── ב. מה ש⛔ לא נגע ───────────────────────────────────────────────────── */
ok('8 · ⛔ `ys_sessions` שרד — הנוכחית האמיתית',
  SRC.indexOf("'ys_sessions'") !== -1);
ok('9 · ⛔ `_ysSessionsMerge` שרד', /function\s+_ysSessionsMerge/.test(SRC));
ok('10 · ⛔ `ysMarks` שרד', /function\s+ysMarks/.test(SRC));
ok('11 · ⛔ ענף האובייקטים של `ysMergeRecords` שרד — `ys_approvals` נשען עליו',
  /ysMergeRecords\(\s*localAp/.test(SRC) && SRC.indexOf("'ys_approvals'") !== -1);

/* ── ג. הגיבוי — שני הצדדים יחד ────────────────────────────────────────── */
const srcBody = /sources: function \(\) \{([\s\S]*?)\n  \}\n\};/.exec(SRC);
ok('12 · `BK_CFG.sources()` נקראת', !!srcBody);
ok('13 · המפתח אינו במקורות הגיבוי', srcBody && bare(srcBody[1]) === 0);
const keysBlock = /function public\.bk_retention_keys\(\)[\s\S]*?\$\$;/.exec(SQL);
ok('14 · רשימת-ההיתר של המיגרציה נקראת', !!keysBlock);
ok('15 · ⛔ והמפתח אינו בה — אחרת היינו מפנים גיבוי של מפתח מת',
  keysBlock && bare(keysBlock[0]) === 0);
ok('16 · ⭐ שני הצדדים השתנו יחד — אין היסט', srcBody && keysBlock &&
  bare(srcBody[1]) === bare(keysBlock[0]));

/* ── ד. התיעוד — אין יכולת שאינה קיימת ─────────────────────────────────── */
/* ⚠️ אזכור היסטורי מותר רק כשהוא לקח פעיל; «היה פה מנגנון ונמחק» אינו
   לקח, ולכן הסף כאן היה פרק סבב 38 בלבד.
   ⭐ **וטענה 17 התהפכה בסבב 48ב** — פרק סבב 38 **נגזם** מ-`CLAUDE.md`
   יחד עם עשרת פרקי הסבבים האחרים שמתחת ל-40, ולקחיו עברו ל-
   `tools/_prune-lessons.md`. ⛔ כלומר אין עוד סף, והסריקה של טענות 18–19
   חלה מעכשיו על **הקובץ כולו** — כלומר הן הודקו ולא רופפו. */
const r38 = DOC.indexOf('## סבב 38');
ok('17 · ⭐ פרק סבב 38 נגזם (סבב 48ב) — הסף בטל, והסריקה חלה על הקובץ כולו',
  r38 === -1);
/* ⚠️ שתי הבחנות, וזו שמכריעה מה מותר להשאיר:
   • אזכור של המפתח כ**מנגנון קיים** — אסור. שמות הפונקציות שנמחקו הם
     הסימן החד-משמעי לכך, ולכן הם נסרקים בנפרד.
   • ⭐ עד סבב 39 היה **מותר ונדרש** אזכור אחד — הערך שעדיין ישב במסד
     וחיכה למחיקת מנהל, כשורת פער עם טריגר. פער כתוב הוא מציאות, לא
     יכולת שאינה קיימת.
   ⛔ המנהל מחק את הערך ב-2026-08-18 (נמדד: אפס ב-`kv`, ב-`kv_rishon`,
     ב-`kv_ramataviv` וב-`kv_backup`), ושורת הפער נמחקה בסבב 39 — ולכן
     מעכשיו אין אזכור מותר כלל מחוץ לפרקי הסבבים, וטענה 20 התהפכה. */
const stray = [];
for (const m of DOC.matchAll(BARE)) {
  const pos = m.index;
  if (r38 !== -1 && pos > r38) continue;                       // פרקי הסבבים
  const line = DOC.slice(DOC.lastIndexOf('\n', pos) + 1, DOC.indexOf('\n', pos));
  if (line.indexOf('test_attend') !== -1) continue;    // שורת רישום הבדיקה
  stray.push(line.trim());
}
ok('19 · ⛔ אין אזכור מחוץ לפרקי הסבבים' +
  (stray.length ? ' — נמצא: ' + stray[0] : ''), stray.length === 0);
/*  ⛔ מסבב 70 אין פרק פערים, ⚠️ והטענה נמדדת על **הקובץ כולו** מחוץ
    לפרקי הסבבים — ⭐ וזו הצורה החזקה יותר: היא אינה תלויה בקיומו של
    פרק מסוים, ⛔ ולכן שינוי מבנה בתיעוד אינו מנטרל אותה בשקט. */
ok('20 · ⭐ ושורת הפער נמחקה — הפער נסגר בסבב 39',
  bare(DOC.slice(0, r38 === -1 ? DOC.length : r38)) === 0);

if (RUN_MUT) {
  mutStage();
/* ── ה. מוטציות ────────────────────────────────────────────────────────── */
console.log('  — מוטציות —');
{
  const mut = SRC.replace('function getApprovals(',
    "function getAttendance(){return JSON.parse(localStorage.getItem('ys_attend')||'{}');}\nfunction getApprovals(");
  ok('21 · מוטציה: החזרת הגישון מפילה את טענות 1 ו-2',
    bare(mut) > 0 && /function\s+getAttendance/.test(mut));
}
{
  /*  ⛔ המוטציה שותלת מקור חדש ⛔ ולא מוסיפה לרשימת מפתחות (סבב 80) —
   *  ⚠️ שלושה-עשר מקורות ה-`kv` ירדו עם הטבלה שהופלה, ⭐ ומקורות הגיבוי
   *  כאן הם `out.push` של טבלאות. */
  const mut = SRC.replace("    out.push({ kind: 'table', name: 'ys_settings'",
                          "    out.push({ kind: 'table', name: 'ys_attend', order: 'key' });\n    out.push({ kind: 'table', name: 'ys_settings'");
  const b = /sources: function \(\) \{([\s\S]*?)\n  \}\n\};/.exec(mut);
  ok('22 · מוטציה: החזרת המפתח למקורות הגיבוי מפילה את טענה 13',
    !!b && bare(b[1]) === 1);
  ok('23 · ⭐ ושוברת את השקילות מול רשימת-ההיתר (טענה 16)',
    !!b && keysBlock && bare(b[1]) !== bare(keysBlock[0]));
}
{
  /*  ⛔ העוגן הוא טקסט המיגרציה שכבר רצה — ⚠️ שמות המפתחות שם הם שמות
   *  ה-`kv` ההיסטוריים, ⛔ ומיגרציה שרצה אינה נערכת. */
  const mut = SQL.replace("    'ys_students', 'ys_attend_sessions'",
                          "    'ys_students', 'ys_attend', 'ys_attend_sessions'");
  const k = /function public\.bk_retention_keys\(\)[\s\S]*?\$\$;/.exec(mut);
  ok('24 · מוטציה: החזרתו לרשימת-ההיתר לבדה מפילה את טענות 15 ו-16',
    !!k && bare(k[0]) === 1);
}

{
  /* ⭐ המוטציה שנועדה לטענה 20 שהתהפכה בסבב 39 — החזרת שורת הפער
     אחרי שהערך כבר נמחק מהמסד. ⛔ מסבב 70 אין פרק פערים, ⚠️ ולכן הבסיס
     הוא בדיוק המקטע שטענה 20 מודדת — הקובץ מחוץ לפרקי הסבבים. */
  const gaps = DOC.slice(0, r38 === -1 ? DOC.length : r38);
  const mut = gaps + '\n- **מחיקת המפתח `ys_attend`** — **הטריגר:** המנהל.\n';
  ok('25 · מוטציה: החזרת שורת הפער מפילה את טענה 20',
    bare(gaps) === 0 && bare(mut) > 0);
}

/*  ⭐ מוטציית-נגד: **קוד שנוסף** ⛔ אינו מפיל — ⚠️ טענת-היעדר מודדת את
 *  המזהה שנמחק, ⛔ ולא את העובדה שהקובץ לא השתנה: ⭐ שער שהיה נופל על כל
 *  תוספת היה הופך כל עבודה באפליקציה להפרה. */
{
  const added = SRC + '\nfunction _ncPing(){ return 1; }\nvar _ncSeen = _ncPing();\n';
  ok('נ1 · ⭐ מוטציית-נגד: קוד שנוסף ⛔ אינו מפיל את טענות ההיעדר',
    added !== SRC && (added.match(/ys_attend\b(?!_)/g) || []).length ===
                     (SRC.match(/ys_attend\b(?!_)/g) || []).length);
}

}

console.log((fail ? '✗' : '✓') + ` סבב 38 (ys_attend) — ${pass} טענות עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
