#!/usr/bin/env node
/*  בדיקת סבב 32 — מקור אמת יחיד לסכימה (צומצמה בסבב 58).
 *
 *  ⚠️ פרטי ל-hanhala-ruchanit. ⛔ אין ליישר אותו מריפו אחר — הוא בודק את
 *     כלי ההתקנה של האפליקציה הזו, שאינו קיים באחיות באותה צורה.
 *
 *  ⛔ מסך ההתקנה שבתוך `index.html` הוסר בסבב 58 — ואיתו ארבע הטענות
 *     שרצו את `showSetupScreen` ברתמת `vm` (3 · 4 · 5, והמוטציה 8ב–8ג).
 *     ⚠️ **מה שנשאר כאן אינו שריד:** הטענות ששרדו אינן על המסך אלא על
 *     **מקור האמת** — ⛔ אין סכימה מוטבעת ב-`index.html`, ⛔ אין מסלול
 *     service-key, ו-`setup-db.html` מושך את אותו קובץ ואינו מחזיק עותק
 *     שני. שלושתן היו נכונות לפני המסך והן נכונות אחריו.
 *  ⭐ ונוספה טענה אחת: ⛔ המסך אינו חוזר (סעיף 3).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SETUP = fs.readFileSync(path.join(ROOT, 'setup-db.html'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'migrations/000_initial_schema.sql'), 'utf8');

let passN = 0, failN = 0;
const ok = (c, m) => { if (c) passN++; else { failN++; console.error('❌ ' + m); } };

/* ── הסרת הערות והצהרות DDL אמיתיות ────────────────────────────────────
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
   1 · ⛔ אין יותר סכימה מוטבעת ב-index.html
   ══════════════════════════════════════════════════════════════════════════ */
function t1() {
  // ⚠️ נמדד על **הקוד הרץ** — שורות ההערה מוסרות קודם, אחרת הבלוק שמסביר
  //    למה הסכימה הוסרה היה נספר כסכימה.
  const code = stripComments(SRC);
  ok(!DDL.table.test(code), '1א · ⭐ אין אף `create table` בקוד הרץ של index.html');
  ok(!DDL.alter.test(code), '1ב · ⛔ וגם לא `alter table` — הסכימה כולה עברה לקובץ');
  ok(!/password_hash[ \t]+text[ \t]+not[ \t]+null/i.test(SRC), '1ג · ולא הגדרת עמודה');
  ok(!DDL.policy.test(code), '1ד · ולא פוליסה');
  // ⛔ ואין עותק-גיבוי מוטבע «ליתר ביטחון»
  ok(!/pass_salt text;?\\n/.test(SRC), '1ה · ⛔ ואין עותק-גיבוי מוטבע של ה-SQL כמחרוזת');
}

/* ══════════════════════════════════════════════════════════════════════════
   2 · ⛔ מסלול ה-service-key הוסר — ואינו חוזר (סבב 39)
   ══════════════════════════════════════════════════════════════════════════
   `exec_sql` אינה קיימת במסד (נמדד ב-2026-08-18 מול `pg_proc`), ולכן
   ה-`rpc` נכשל תמיד. מה שנשאר היה שדה שמבקש **service-role key** — המפתח
   שעוקף RLS — בתמורה לכלום. */
function t2() {
  const code = stripComments(SRC);
  ok(!/setupWithServiceKey/.test(code), '2א · ⛔ אין `setupWithServiceKey` בקוד הרץ');
  ok(!/exec_sql/.test(code),            '2ב · ⛔ ואין קריאת `exec_sql`');
  ok(!/createClient\s*\([^)]*key/.test(code),
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
  ok(!/function\s+showSetupScreen\s*\(/.test(code), '3א · ⛔ אין `showSetupScreen`');
  ok(!/function\s+startSetupPoll\s*\(/.test(code),  '3ב · ⛔ ואין `startSetupPoll`');
  ok(!/YS_SETUP_SQL_URL|ysFetchSetupSql/.test(code),
    '3ג · ⛔ ואין משיכת קובץ ההתקנה לתוך הדף');
  ok(!/setup-sql|setup-status/.test(SRC),
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
