#!/usr/bin/env node
/*  בדיקת סבב 32 — מקור אמת יחיד לסכימה.
 *
 *  ⚠️ פרטי ל-hanhala-ruchanit. ⛔ אין ליישר אותו מריפו אחר — הוא בודק את
 *     מסך ההגדרה הראשונית של האפליקציה הזו, שאינו קיים באחיות באותה צורה.
 *
 *  ⚠️ הבדיקה מריצה את **הקוד האמיתי**: `showSetupScreen` נחתכת
 *     מ-`index.html` לפי שמה ורצה ב-`vm` מעל DOM ו-`fetch` מדומים.
 *     מוטציה בקוד האמיתי מפילה טענה.
 *  ⛔ `setupWithServiceKey` הוסרה בסבב 39 — `exec_sql` אינה קיימת במסד,
 *     ולכן המסלול מעולם לא יכול היה לרוץ. טענות 2 ו-3 נועלות את **היעדרו**.
 *
 *  ⛔ אין שעון ואין `setTimeout` כאן (הלקח מסבב 24) — ההמתנה היא על
 *     ה-Promise שהקוד עצמו יצר, ולכן כל טענה נמדדת על אירוע שהסתיים.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SETUP = fs.readFileSync(path.join(ROOT, 'setup-db.html'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'migrations/000_initial_schema.sql'), 'utf8');

let passN = 0, failN = 0;
const ok = (c, m) => { if (c) passN++; else { failN++; console.error('❌ ' + m); } };
const eq = (a, b, m) => ok(a === b, `${m} — קיבלתי ${JSON.stringify(a)}, ציפיתי ${JSON.stringify(b)}`);

/* ── חיתוך מהקובץ ──────────────────────────────────────────────────────── */
function cut(name) {
  const re = new RegExp('\\n(async )?function ' + name + '\\s*\\(', 'g');
  const m = re.exec(SRC);
  if (!m) throw new Error('הפונקציה ' + name + ' לא נמצאה ב-index.html');
  const start = m.index + 1;
  let i = SRC.indexOf('{', m.index + m[0].length - 1), d = 0;
  for (; i < SRC.length; i++) {
    const c = SRC[i];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) return SRC.slice(start, i + 1); }
  }
  throw new Error('הפונקציה ' + name + ' אינה סגורה');
}
function cutVar(decl) {
  const i = SRC.indexOf('\n' + decl);
  if (i < 0) throw new Error('ההצהרה «' + decl + '» לא נמצאה');
  return SRC.slice(i + 1, SRC.indexOf('\n', i + 1));
}

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

/* ── DOM מדומה — מספיק לחוזה שהקוד נשען עליו ───────────────────────────
   האלמנטים נוצרים מתוך ה-HTML שהקוד עצמו כותב, לפי `id="…"`. ⚠️ כך
   טענה על אלמנט שהקוד הפסיק לייצר **נופלת**, ולא עוברת על stub ריק. */
function makeEnv(opts = {}) {
  const els = {};
  function mkEl(id) {
    return { id, value: '', textContent: '', innerHTML: '', disabled: false, style: {} };
  }
  function harvest(html) {
    const re = /id="([^"]+)"/g; let m;
    while ((m = re.exec(html))) els[m[1]] = els[m[1]] || mkEl(m[1]);
  }
  const authBox = { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; harvest(v); } };
  const env = { els, authBox, rpc: [], fetches: [] };
  const sandbox = {
    console, JSON, String, Number, Array, Object, Boolean, Promise, RegExp, Error,
    document: {
      getElementById: (id) => els[id] || null,
      querySelector: (s) => (s === '.auth-box' ? authBox : null),
    },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    fetch: (url, o) => {
      env.fetches.push({ url, opts: o });
      if (opts.fetchFails) return Promise.reject(new Error('boom'));
      if (opts.fetchHttp) return Promise.resolve({ ok: false, status: opts.fetchHttp });
      if (opts.fetchEmpty) return Promise.resolve({ ok: true, text: () => Promise.resolve('   ') });
      return Promise.resolve({ ok: true, text: () => Promise.resolve(SCHEMA) });
    },
    supabase: {
      createClient: () => ({
        rpc: (fn, args) => { env.rpc.push({ fn, args }); return Promise.resolve({ error: null }); },
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
      }),
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cutVar('var YS_SETUP_SQL_URL = '), sandbox);
  vm.runInContext(cutVar('var YS_SETUP_SQL_GITHUB = '), sandbox);
  for (const n of ['ysFetchSetupSql', 'ysSetupSqlLink', 'showSetupScreen']) {
    vm.runInContext(cut(n), sandbox, { filename: n + '.js' });
  }
  env.sb = sandbox;
  return env;
}
// ⚠️ ריקון תור המיקרו-משימות — בלי טיימר, ולכן בלי שעון מדומה.
const flush = () => new Promise((r) => setImmediate(r));

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
   3 · ⛔ ומסך ההגדרה אינו מבקש מפתח כלשהו
   ══════════════════════════════════════════════════════════════════════════ */
function t3() {
  const env = makeEnv();
  env.sb.showSetupScreen();
  const html = env.authBox.innerHTML;
  ok(!/svc-key/.test(html),      '3א · ⛔ אין שדה `svc-key` במסך');
  ok(!/service_role/i.test(html), '3ב · ⛔ ואין הפניה ל-service_role');
  ok(!/type="password"/.test(html), '3ג · ⛔ ואין שדה סוד כלשהו');
  ok(/SQL Editor/.test(html),    '3ד · ⭐ ומה שנשאר הוא הרצת קובץ ההתקנה ב-SQL Editor');
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · מסך ההגדרה — התיבה מתמלאת מהקובץ
   ══════════════════════════════════════════════════════════════════════════ */
async function t4() {
  const env = makeEnv();
  env.sb.showSetupScreen();
  const ta = env.els['setup-sql'];
  ok(!!ta, '4א · התיבה קיימת');
  ok(/טוען/.test(env.authBox.innerHTML), '4ב · ⛔ ולפני המשיכה אין בה סכימה — «טוען…»');
  ok(!/create table/i.test(env.authBox.innerHTML), '4ג · ⛔ ואין סכימה מוטבעת ב-HTML שנבנה');
  await flush(); await flush();
  eq(ta.value, SCHEMA, '4ד · ⭐ ואחרי המשיכה — תוכן הקובץ במלואו');
  eq(env.fetches[0].url, 'migrations/000_initial_schema.sql', '4ה · מאותו נתיב אחד');
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · ⛔ כשל משיכה במסך — התיבה נעלמת, ולא מוצגת סכימה חלקית
   ══════════════════════════════════════════════════════════════════════════ */
async function t5() {
  const env = makeEnv({ fetchFails: true });
  env.sb.showSetupScreen();
  await flush(); await flush();
  eq(env.els['setup-sql'].style.display, 'none', '5א · ⛔ התיבה מוסתרת');
  eq(env.els['setup-sql-err'].style.display, 'block', '5ב · וההודעה מוצגת');
  ok(/github\.com/.test(env.els['setup-sql-err'].innerHTML), '5ג · ⭐ עם קישור ישיר לקובץ');
  ok(!/create table/i.test(env.els['setup-sql'].value || ''), '5ד · ⛔ ולא נשארה בה סכימה');
}

/* ══════════════════════════════════════════════════════════════════════════
   6 · setup-db.html — מושך את אותו קובץ, ואינו מחזיק עותק שני
   ══════════════════════════════════════════════════════════════════════════ */
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
   8 · מוטציות — החזרת מסלול ה-service-key מפילה את טענות 2 ו-3
   ══════════════════════════════════════════════════════════════════════════ */
function t8() {
  const code = stripComments(SRC);
  const mutFn = code + "\nasync function setupWithServiceKey(){"
    + "var SB2=supabase.createClient(URL,key);await SB2.rpc('exec_sql',{sql:s});}\n";
  ok(/setupWithServiceKey/.test(mutFn) && /exec_sql/.test(mutFn),
    '8א · מוטציה: החזרת הפונקציה מפילה את טענות 2א ו-2ב');

  const env = makeEnv();
  env.sb.showSetupScreen();
  const mutHtml = env.authBox.innerHTML
    + '<input id="svc-key" type="password" placeholder="service_role">';
  ok(!/svc-key/.test(env.authBox.innerHTML) && /svc-key/.test(mutHtml),
    '8ב · מוטציה: החזרת שדה המפתח למסך מפילה את טענה 3א');
  ok(!/type="password"/.test(env.authBox.innerHTML) && /type="password"/.test(mutHtml),
    '8ג · ⛔ ושדה סוד כלשהו במסך מפיל את טענה 3ג');
}

/* ── הרצה ──────────────────────────────────────────────────────────────── */
console.log('\n═══ סבב 32 — מקור אמת יחיד לסכימה ═══\n');
const tests = [t1, t2, t3, t4, t5, t6, t7, t8];
for (const t of tests) {
  try { await t(); }
  catch (e) { failN++; console.error(`❌ ${t.name} זרקה: ${(e && e.stack) || e}`); }
}
console.log(`\n[hanhala-ruchanit] סבב 32 — ${passN} עברו, ${failN} נכשלו`);
process.exit(failN ? 1 : 0);
