/* ══════════════════════════════════════════════════════════════════════════
   סבב 62 — `updated_at` ל-kv: המתג, הנכשל-סגור, והמיגרציה
   ══════════════════════════════════════════════════════════════════════════
   ⚠️ **פרטי כאן.** שלוש טבלאות ה-`kv` חיות בפרויקט המשותף, וקובץ המיגרציה
      יושב בריפו הזה — ⛔ קובץ אחד לפרויקט אחד (אותו כלל של `004`).
   ⭐ מה שנמדד ב-26.8.2026 והוליד את הסבב: `sl_settings` ו-`g_config` —
      אותו מבנה מפתח/ערך בדיוק — נושאות `updated_at`, ⛔ ושלוש טבלאות
      ה-`kv` לא. ⚠️ ובהיעדרה `kv.ys_settings_meta` מחזיק `{}` (שני בתים),
      כלומר `rts` תמיד 0 ⇒ ⛔ «האחרון שדוחף מנצח».
   ⚠️⚠️ **ומה שהשער הזה אינו מודד:** הוא קורא **קבצים**, ⛔ ואינו רואה את
      המסד החי. מיגרציה שנכתבה ולא הורצה עוברת אותו במלואו (כלל ברזל 20,
      אותה מגבלה) — ⛔ ולכן הדלקת הדגל בסבב 63 נשענה על **מדידה מול המסד**
      ולא על השער: העמודה קיימת בשלוש הטבלאות, ואפס שורות נושאות ערך ריק.
   ══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const MIG = join(ROOT, 'migrations', '013_kv_updated_at.sql');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

console.log('\n— סבב 62: `updated_at` ל-kv —');

/* ── א. הדגל ───────────────────────────────────────────────────────────── */
ok(/var\s+YS_KV_UPDATED_AT\s*=\s*true\s*;/.test(SRC),
   '1 · ⭐ `YS_KV_UPDATED_AT` מוגדר ו**דלוק** — המיגרציה הורצה ואומתה (סבב 63)');

/* ── ב. הנכשל-סגור, על הפונקציה האמיתית ברתמת vm ──────────────────────── */
const fn = /async function ysKvUpdatedAt\(key\) \{[\s\S]*?\n\}/.exec(SRC);
ok(!!fn, '2 · `ysKvUpdatedAt` מחולצת מ-index.html');

async function callWith(row) {
  const SB = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (row === 'throw') throw new Error('net');
            return row;
          }
        })
      })
    })
  };
  const ctx = { SB, withTimeout: (p) => p, Date, isFinite, console };
  vm.createContext(ctx);
  vm.runInContext(fn[0] + '\nthis.__f = ysKvUpdatedAt;', ctx);
  return ctx.__f('k');
}

const T = Date.parse('2026-08-26T10:00:00Z');
ok(await callWith({ data: { updated_at: '2026-08-26T10:00:00Z' } }) === T,
   '3 · חותמת תקינה מוחזרת כמילישניות');
/* ⛔ ארבעת מצבי חוסר-הראיה — כולם 0, ולא «חדש» ולא זריקה. */
ok(await callWith({ error: { message: 'x' } }) === 0, '4 · ⛔ שגיאה ⇒ 0 (נכשל סגור)');
ok(await callWith('throw') === 0,                     '5 · ⛔ זריקה ⇒ 0');
ok(await callWith({ data: null }) === 0,              '6 · ⛔ מפתח שאינו קיים ⇒ 0');
ok(await callWith({ data: { updated_at: 'לא-תאריך' } }) === 0,
   '7 · ⛔ ערך שאינו תאריך ⇒ 0 — ⚠️ `Date.parse` מחזיר NaN, וללא הבדיקה הוא היה זולג להשוואה');

/* ── ג. החיווט — הדגל הוא שקובע מאיפה נקראת החותמת ────────────────────── */
ok(/rts\s*=\s*YS_KV_UPDATED_AT\s*\?\s*await ysKvUpdatedAt\(/.test(SRC),
   '8 · ⭐ `rts` נקרא מהעמודה כשהדגל דלוק, ומהמפה כשאינו');
ok(/if \(YS_KV_UPDATED_AT\) return lastErr/.test(SRC),
   '9 · ⛔ והמפה הישנה מפסיקה לעלות לענן כשהעמודה סמכותית — אין מקור אמת שני');

/* ── ד. המיגרציה ──────────────────────────────────────────────────────── */
ok(existsSync(MIG), '10 · `migrations/013_kv_updated_at.sql` קיים');
const sql = existsSync(MIG) ? readFileSync(MIG, 'utf8') : '';
['kv', 'kv_rishon', 'kv_ramataviv'].forEach((t) => {
  ok(new RegExp('alter table public\\.' + t + '\\s+add column if not exists updated_at').test(sql),
     '11 · העמודה נוספת ל-`' + t + '`');
  ok(new RegExp('create trigger \\w+\\s+before update on public\\.' + t).test(sql),
     '12 · וטריגר `before update` דרוך עליה ב-`' + t + '`');
});
/* ⛔ הלקח של סבב 61 — פונקציה חדשה נולדת נגישה כ-RPC לכל מי שמחזיק את
   המפתח הציבורי, והיא **אינה יורשת** את ההרשאות של הקודמת. */
ok(/revoke all on function public\.kv_touch_updated_at\(\) from public, anon, authenticated/.test(sql),
   '13 · ⛔ `revoke execute` על הפונקציה — היא אינה יורשת הרשאות');
ok(/revoke all on public\.kv\s+from anon, authenticated/.test(sql) &&
   /grant select, insert, update on public\.kv\s+to anon, authenticated/.test(sql),
   '14 · ⛔ REVOKE לפני GRANT — אין DELETE/TRUNCATE (כלל ברזל 10 סעיף 9)');
/* ⛔ מבנה בלבד — כלל ברזל 10 סעיף 7. */
ok(!/^\s*(update|delete|insert)\s/im.test(sql.replace(/^\s*--.*$/gm, '')),
   '15 · ⛔ המיגרציה אינה נוגעת בנתונים — מבנה בלבד');

/* ── ה. ⛔ מה ש**אינו** מוסר — `tb_subs_meta` של יומן ──────────────────── */
ok(/tb_subs_meta/.test(sql),
   '16 · ⚠️ הקובץ רושם במפורש ש-`tb_subs_meta` אינו אותו מקרה — חותמת ' +
   'פר-תת-מפתח אינה ניתנת להחלפה בחותמת פר-שורה');

/* ── מוטציות ───────────────────────────────────────────────────────────── */
console.log('  — מוטציות —');
/* ⛔ המוטציות אינן נכתבות לעץ (הלקח של סבב 42ג). */

/* 1 — הסרת הנכשל-סגור על שגיאה. */
{
  const mutated = fn[0].replace('if (!r || r.error || !r.data || !r.data.updated_at) return 0;',
                                'if (!r || !r.data) return 0;');
  const SB = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'x' }, data: { updated_at: '2026-01-01T00:00:00Z' } }) }) }) }) };
  const ctx = { SB, withTimeout: (p) => p, Date, isFinite, console };
  vm.createContext(ctx);
  vm.runInContext(mutated + '\nthis.__f = ysKvUpdatedAt;', ctx);
  ok(await ctx.__f('k') !== 0,
     '17 · ⛔ מוטציה: התעלמות מ-`r.error` מחזירה חותמת משגיאה — טענה 4 נופלת');
}

/* 2 — ⛔ כיבוי הדגל בעץ. מסבב 63 זו הרגרסיה בכיוון ההפוך: כיבוי מחזיר
   את המסלול ל-`ys_settings_meta`, ⛔ שהוא `{}` — כלומר `rts` תמיד 0
   ו«האחרון שדוחף מנצח» על שלושת מפתחות ההגדרות. */
ok(!/var\s+YS_KV_UPDATED_AT\s*=\s*false\s*;/.test(SRC),
   '18 · ⛔ מוטציה-נגד: הדגל אינו כבוי בעץ — כיבוי מחזיר את «האחרון שדוחף מנצח»');

/* 3 — הסרת ה-revoke מהמיגרציה. */
ok(!/revoke all on function/.test(sql.replace(/revoke all on function[^\n]*\n/, '')),
   '19 · מוטציה: הסרת ה-`revoke` מהמיגרציה — טענה 13 נופלת');

console.log((fail ? '✗' : '✓') + ' סבב 62 (`updated_at` ל-kv) — ' + pass + ' טענות עברו, ' + fail + ' נכשלו\n');
process.exit(fail ? 1 : 0);
