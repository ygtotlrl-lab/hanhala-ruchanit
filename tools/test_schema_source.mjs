#!/usr/bin/env node
/*  test_schema_source.mjs — מקור אמת יחיד לסכימה.
 *
 *  **מה נאכף:** ⛔ אין סכימה מוטבעת ב-`index.html` · ⛔ אין מסלול שמשתמש
 *  במפתח שירות · ⛔ כלי ההתקנה מושך את **אותו** קובץ ואינו מחזיק עותק שני ·
 *  ⛔ ומסך ההתקנה שהוסר אינו חוזר.
 *
 *  **הנימוק המדוד:** עותק מוטבע של הסכימה מתיישן בכל מיגרציה — ⚠️ ומי
 *  שמתקין ממנו מקבל מסד שאינו זהה לזה שבייצור.
 *
 *  **מה יישבר בלעדיו:** ⛔ מפתח שירות בקוד לקוח הוא מפתח על, ⚠️ והוא
 *  ציבורי; ⛔ ושני מקורות סכימה נסחפים זה מזה בשקט.
 *
 *  **מה אינו נאכף כאן:** ⛔ תוכן הסכימה עצמה — ⚠️ הוא נאכף בשערי המיגרציות,
 *  ⭐ וכאן נמדד **מניין** היא נקראת.
 *
 *  ⚠️ פרטי לאפליקציה הזו. ⛔ אין ליישר אותו מריפו אחר — כלי ההתקנה שלה
 *  אינו קיים באחיות באותה צורה. ⚠️ **והטענות ששרדו אינן שריד** — ⭐ הן על
 *  **מקור האמת** ולא על המסך שהוסר.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SETUP = fs.readFileSync(path.join(ROOT, 'setup-db.html'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'migrations/000_initial_schema.sql'), 'utf8');

let passN = 0, failN = 0;
const ok = (c, m) => { if (c) passN++; else { failN++; console.error('❌ ' + m); } };
/*  ⛔ מונה ולא נוכחות (סבב 79) — ⚠️ בדיקת נוכחות עוברת גם על הצהרה כפולה
 *  וגם על שורה שיושבת בתוך הערה: ⭐ הטענה היא על **מספר המופעים**, ⛔ והוא
 *  מודפס בהודעה. */
const _hits = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
const noneIn = (re, s, label) => ok(_hits(re, s) === 0,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי אפס`);
const someIn = (re, s, label) => ok(_hits(re, s) >= 1,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי לפחות 1`);


/* ── הסרת הערות והצהרות DDL אמיתיות ─────────────────────────────────────────
   ⚠️ המילים «create table» מופיעות גם בפרוזה של ההערות שמסבירות למה
   הסכימה הוסרה. ⛔ לכן ההערות מוסרות תחילה (בלוק ושורה), והחיפוש הוא על
   **הצהרה בשורה אחת** — `[ \t]+` ולא `\s+`, שחוצה שורות ותופס פרוזה. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}
const DDL = {
  table: /create[ \t]+table\b/i,
  alter: /alter[ \t]+table[ \t]+ys_users\b/i,
  policy: /create[ \t]+policy\b/i,
};

/* ══════════════════════════════════════════════════════════════════════════
   1 · ⛔ אין יותר סכימה מוטבעת ב-index.html — עותק שני מתיישן בשקט
   ══════════════════════════════════════════════════════════════════════════ */
function t1() {
  // ⚠️ נמדד על **הקוד הרץ** — שורות ההערה מוסרות קודם, אחרת הבלוק שמסביר
  //    למה הסכימה הוסרה היה נספר כסכימה.
  const code = stripComments(SRC);
  ok(!DDL.table.test(code), '1א · ⭐ אין אף `create table` בקוד הרץ של index.html');
  ok(!DDL.alter.test(code), '1ב · ⛔ וגם לא `alter table` — הסכימה כולה עברה לקובץ');
  noneIn(/password_hash[ \t]+text[ \t]+not[ \t]+null/i, SRC, '1ג · ולא הגדרת עמודה');
  ok(!DDL.policy.test(code), '1ד · ולא פוליסה');
  // ⛔ ואין עותק-גיבוי מוטבע «ליתר ביטחון» — הוא בדיוק המקור השני
  noneIn(/pass_salt text;?\\n/, SRC, '1ה · ⛔ ואין עותק-גיבוי מוטבע של ה-SQL כמחרוזת');
}

/* ══════════════════════════════════════════════════════════════════════════
   2 · ⛔ מסלול ה-service-key הוסר — ואינו חוזר (סבב 39)
   ══════════════════════════════════════════════════════════════════════════
   `exec_sql` אינה קיימת במסד (נמדד ב-2026-08-18 מול `pg_proc`), ולכן
   ה-`rpc` נכשל תמיד. מה שנשאר היה שדה שמבקש **service-role key** — המפתח
   שעוקף RLS — בתמורה לכלום. */
function t2() {
  const code = stripComments(SRC);
  noneIn(/setupWithServiceKey/, code, '2א · ⛔ אין `setupWithServiceKey` בקוד הרץ');
  noneIn(/exec_sql/, code,            '2ב · ⛔ ואין קריאת `exec_sql`');
  noneIn(/createClient\s*\([^)]*key/, code,
    '2ג · ⛔ ואין לקוח Supabase שנבנה ממפתח שהמשתמש הקליד');
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · ⛔ מסך ההתקנה הוסר מהאפליקציה — ואינו חוזר (סבב 58)
   ══════════════════════════════════════════════════════════════════════════
   ⚠️ ההתקנה נעשית מול המסד ישירות, מ-`migrations/`; ⛔ מסך שמציג פקודות
   SQL להעתקה, מושך קובץ התקנה לתוך הדף ומסקר את המסד בלולאה הוא שכבה
   שלמה שאיש אינו נוגע בה — ושתיים מארבע האפליקציות מעולם לא היו צריכות. */
function t3() {
  const code = stripComments(SRC);
  noneIn(/function\s+showSetupScreen\s*\(/, code, '3א · ⛔ אין `showSetupScreen`');
  noneIn(/function\s+startSetupPoll\s*\(/, code,  '3ב · ⛔ ואין `startSetupPoll`');
  noneIn(/YS_SETUP_SQL_URL|ysFetchSetupSql/, code,
    '3ג · ⛔ ואין משיכת קובץ ההתקנה לתוך הדף');
  noneIn(/setup-sql|setup-status/, SRC,
    '3ד · ⛔ ואין עוגני DOM של המסך שהוסר');
}

/* ══════════════════════════════════════════════════════════════════════════
   6 · setup-db.html — מושך את אותו קובץ, ואינו מחזיק עותק שני
   ══════════════════════════════════════════════════════════════════════════
   ⚠️ הכלי החד-פעמי **נשאר** (סבב 58) — הוא אינו עותק של האפליקציה ואינו
   נטען אצל המשתמשים; הוא הדרך שבה מריצים התקנה, ומקור האמת שלו הוא
   קובץ המיגרציה. */
function t6() {
  ok(/migrations\/000_initial_schema\.sql/.test(SETUP), '6א · הכלי מפנה לקובץ ההתקנה');
  ok(/cache:\s*'no-store'/.test(SETUP), '6ב · במשיכה בלי מטמון');
  ok(!DDL.table.test(stripComments(SETUP)), '6ג · ⛔ ואין בו עותק סכימה משלו');
  ok(/style\.display\s*=\s*'none'/.test(SETUP), '6ד · ובכשל הוא מסתיר את התיבה');
}

/* ══════════════════════════════════════════════════════════════════════════
   7 · ⭐ הקובץ היחיד מכיל את מה שהעותק המוטבע החסיר
   ══════════════════════════════════════════════════════════════════════════
   העותק ב-`index.html` הגדיר `ys_users` בלבד — כלומר התקנה טרייה לפיו
   נתנה מסך כניסה ותו לא. */
function t7() {
  for (const t of ['public.kv', 'public.ys_users', 'public.sync_log', 'public.kv_backup']) {
    ok(new RegExp('create table if not exists ' + t.replace('.', '\\.')).test(SCHEMA),
      `7א.${t} · הטבלה מוגדרת בקובץ ההתקנה`);
  }
  ok(/pass_salt/.test(SCHEMA) && /pass_fp/.test(SCHEMA),
    '7ב · ⭐ וגם עמודות הטביעה של סבב 22 — שהעותק המוטבע כן החזיק');
  ok(/check \(role in \('admin','senior','junior'\)\)/.test(SCHEMA),
    '7ג · וה-CHECK על role');
  ok(/<שם משתמש>|<שם מלא>/.test(SCHEMA),
    '7ד · ⛔ והמשתמש הראשון הוא מצייני מקום בלבד (כלל ברזל 10 סעיף 8)');
}

/* ══════════════════════════════════════════════════════════════════════════
   8 · מוטציות — החזרת מסלול ה-service-key או של המסך מפילה את 2 ו-3
   ══════════════════════════════════════════════════════════════════════════ */
function t8() {
  const code = stripComments(SRC);
  const mutFn = code + "\nasync function setupWithServiceKey(){"
    + "var SB2=supabase.createClient(URL,key);await SB2.rpc('exec_sql',{sql:s});}\n";
  ok(/setupWithServiceKey/.test(mutFn) && /exec_sql/.test(mutFn),
    '8א · מוטציה: החזרת הפונקציה מפילה את טענות 2א ו-2ב');

  const mutScreen = code + "\nfunction showSetupScreen(){}\nfunction startSetupPoll(){}\n";
  ok(!/function\s+showSetupScreen\s*\(/.test(code)
     && /function\s+showSetupScreen\s*\(/.test(mutScreen),
    '8ב · מוטציה: החזרת המסך מפילה את טענה 3א');
  ok(!/function\s+startSetupPoll\s*\(/.test(code)
     && /function\s+startSetupPoll\s*\(/.test(mutScreen),
    '8ג · ⛔ וגם החזרת הסקר מפילה את טענה 3ב');
}

/* ── הרצה ──────────────────────────────────────────────────────────────── */
console.log('\n═══ סבב 32 — מקור אמת יחיד לסכימה ═══\n');
const tests = [t1, t2, t3, t6, t7, t8];
for (const t of tests) {
  try { await t(); }
  catch (e) { failN++; console.error(`❌ ${t.name} זרקה: ${(e && e.stack) || e}`); }
}
console.log(`\n[hanhala-ruchanit] סבב 32 — ${passN} עברו, ${failN} נכשלו`);
process.exit(failN ? 1 : 0);
