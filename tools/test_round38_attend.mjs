#!/usr/bin/env node
/*  test_round38_attend.mjs — סבב 38: `ys_attend` נמחק (פיצ'ר נטוש).
 *
 *  ⚠️ פרטי ל-hanhala-ruchanit — זה המפתח היחיד מסוגו בארגון.
 *
 *  מה נמדד לפני המחיקה (SELECT בלבד, 2026-08-18): **רישום אחד בלבד**
 *  בכל התקופה — 2026-04-26, שני תלמידים — וכל שאר עשרות התאריכים ריקים.
 *  זה היה מנגנון **שני** לרישום נוכחות, מקביל ל-`ys_attend_sessions`
 *  האמיתי (274 סדרים · 13,144 סימונים), ו-`togglePresent`/`recordTime`
 *  כבר לא נקראו משום מקום — כלומר קוד מת שממשיך להיכתב לענן ולהיגבות.
 *
 *  ⛔ `ys_attend_sessions` הוא מנגנון אחר לגמרי ו**לא נגע** — הבדיקה
 *     אוכפת במפורש שהוא שרד, כדי ששום מחיקה עתידית לא תבלבל ביניהם.
 *
 *  שלוש מוטציות: החזרת הגישון · החזרת המפתח למקורות הגיבוי (שובר את
 *  השקילות הדו-כיוונית מול רשימת-ההיתר) · החזרתו לרשימת-ההיתר לבדה.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const SQL = readFileSync(join(ROOT, 'migrations/004_backup_retention_cron.sql'), 'utf8');
const DOC = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name); } };

/* `ys_attend` כמילה שלמה — ⛔ ולא `ys_attend_sessions`/`_cfg`/`_treats`. */
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
ok('8 · ⛔ `ys_attend_sessions` שרד — הנוכחית האמיתית',
  SRC.indexOf("'ys_attend_sessions'") !== -1);
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
     וחיכה למחיקת מנהל, בפרק «פערים פתוחים» עם טריגר. פער כתוב הוא
     מציאות, לא יכולת שאינה קיימת.
   ⛔ המנהל מחק את הערך ב-2026-08-18 (נמדד: אפס ב-`kv`, ב-`kv_rishon`,
     ב-`kv_ramataviv` וב-`kv_backup`), ושורת הפער נמחקה בסבב 39 — ולכן
     מעכשיו אין אזכור מותר כלל מחוץ לפרקי הסבבים, וטענה 20 התהפכה. */
const DEAD = ['getAttendance', 'saveAttendance', 'ysMergeAttend', 'togglePresent', 'recordTime'];
ok('18 · ⛔ אין בתיעוד אזכור של אף פונקציה שנמחקה',
  DEAD.every((f) => DOC.slice(0, r38 === -1 ? DOC.length : r38).indexOf(f) === -1));

const gapsStart = DOC.indexOf('## פערים פתוחים');
const gapsEnd = DOC.indexOf('\n## ', gapsStart + 1);
const stray = [];
for (const m of DOC.matchAll(BARE)) {
  const pos = m.index;
  if (r38 !== -1 && pos > r38) continue;                       // פרקי הסבבים
  const line = DOC.slice(DOC.lastIndexOf('\n', pos) + 1, DOC.indexOf('\n', pos));
  if (line.indexOf('test_round38_attend') !== -1) continue;    // שורת רישום הבדיקה
  stray.push(line.trim());
}
ok('19 · ⛔ אין אזכור מחוץ לפרקי הסבבים' +
  (stray.length ? ' — נמצא: ' + stray[0] : ''), stray.length === 0);
ok('20 · ⭐ ושורת הפער נמחקה — הפער נסגר בסבב 39',
  gapsStart !== -1 && bare(DOC.slice(gapsStart, gapsEnd === -1 ? DOC.length : gapsEnd)) === 0);

/* ── ה. מוטציות ────────────────────────────────────────────────────────── */
console.log('  — מוטציות —');
{
  const mut = SRC.replace('function getApprovals(',
    "function getAttendance(){return JSON.parse(localStorage.getItem('ys_attend')||'{}');}\nfunction getApprovals(");
  ok('21 · מוטציה: החזרת הגישון מפילה את טענות 1 ו-2',
    bare(mut) > 0 && /function\s+getAttendance/.test(mut));
}
{
  const mut = SRC.replace("return out.concat(['ys_students', 'ys_attend_sessions'",
                          "return out.concat(['ys_students', 'ys_attend', 'ys_attend_sessions'");
  const b = /sources: function \(\) \{([\s\S]*?)\n  \}\n\};/.exec(mut);
  ok('22 · מוטציה: החזרת המפתח למקורות הגיבוי מפילה את טענה 13',
    !!b && bare(b[1]) === 1);
  ok('23 · ⭐ ושוברת את השקילות מול רשימת-ההיתר (טענה 16)',
    !!b && keysBlock && bare(b[1]) !== bare(keysBlock[0]));
}
{
  const mut = SQL.replace("    'ys_students', 'ys_attend_sessions'",
                          "    'ys_students', 'ys_attend', 'ys_attend_sessions'");
  const k = /function public\.bk_retention_keys\(\)[\s\S]*?\$\$;/.exec(mut);
  ok('24 · מוטציה: החזרתו לרשימת-ההיתר לבדה מפילה את טענות 15 ו-16',
    !!k && bare(k[0]) === 1);
}

{
  /* ⭐ המוטציה שנועדה לטענה 20 שהתהפכה בסבב 39 — החזרת שורת הפער
     לפרק «פערים פתוחים» אחרי שהערך כבר נמחק מהמסד. */
  const gaps = DOC.slice(gapsStart, gapsEnd === -1 ? DOC.length : gapsEnd);
  const mut = gaps + '\n- **מחיקת המפתח `ys_attend`** — **הטריגר:** המנהל.\n';
  ok('25 · מוטציה: החזרת שורת הפער מפילה את טענה 20',
    bare(gaps) === 0 && bare(mut) > 0);
}

console.log((fail ? '✗' : '✓') + ` סבב 38 (ys_attend) — ${pass} טענות עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
