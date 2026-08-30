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
   ══════════════════════════════════════════════════════════════════════════ *
 *  ⚠️ **טריגר להסרה (⏳ מבחן מעבר) — סבב 68, כלל ברזל 14:** זהו מבחן **מעבר** — `updated_at` ל-kv.
 *  ⛔ הוא יורד בסבב שסוגר את מסלול ה-`kv`: כיבוי דגל הכתיבה ← מחיקת
 *  מפתחות ה-`kv` מהמסד ← ואז המבחן הזה ושורתו ב-`APP.testsOnly`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const MIG = join(ROOT, 'migrations', '013_kv_updated_at.sql');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

console.log('\n— סבב 62: `updated_at` ל-kv —');

/* ── א. ⛔ הדגל נמחק — המעבר הושלם (סבב 63) ─────────────────────────────── */
ok(!/YS_KV_UPDATED_AT/.test(SRC),
   '1 · ⛔ `YS_KV_UPDATED_AT` אינו קיים עוד — המיגרציה הורצה והמסלול יחיד');
/* ⛔ ושתי הרשימות — צד הדחיפה וצד המשיכה — נגזרות ממקור אחד (סבב 63).
   ⚠️ זה בדיוק ההפרש שנמצא: הדחיפה עברה לעמודה והמשיכה נשארה על המפה
   המתה, ⛔ ומכשיר שערך הגדרה הפך חירש לשינוי שלה ממכשיר אחר. */
ok(/var\s+YS_SETTINGS_LWW_KEYS\s*=\s*\[[^\]]*'ys_reasons'[^\]]*'ys_absence_reasons'[^\]]*'ys_cls_years'[^\]]*\]/.test(SRC),
   '1ב · ⭐ `YS_SETTINGS_LWW_KEYS` מוגדר ומכסה את שלושת מפתחות ההגדרות');

/* ── ב. הנכשל-סגור, על הפונקציה האמיתית ברתמת vm ───────────────────────── */
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

/* ── ג. החיווט — הדגל הוא שקובע מאיפה נקראת החותמת ─────────────────────── */
ok(/rts\s*=\s*await ysKvUpdatedAt\(sk\.key\)/.test(SRC),
   '8 · ⭐ צד הדחיפה קורא את `rts` מהעמודה — בלי תנאי ובלי מפה');
/* ⛔ שני הצדדים, ולא אחד — זה מה שנשבר בסבב 63 ותוקן בו. */
ok(/remoteMeta\[_mk\]\s*=\s*await ysKvUpdatedAt\(_mk\)/.test(SRC),
   '8ב · ⭐ וגם צד המשיכה קורא מהעמודה — ⛔ ולא ממפה שהיא `{}` בענן');
ok(!/ysKvSet\(\s*'ys_settings_meta'/.test(SRC),
   '9 · ⛔ המפה אינה עולה לענן — אין מקור אמת שני');

/* ── ד. המיגרציה ───────────────────────────────────────────────────────── */
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

/* ── ה. ⛔ מה ש**אינו** מוסר — `tb_subs_meta` של יומן ───────────────────── */
ok(/tb_subs_meta/.test(sql),
   '16 · ⚠️ הקובץ רושם במפורש ש-`tb_subs_meta` אינו אותו מקרה — חותמת ' +
   'פר-תת-מפתח אינה ניתנת להחלפה בחותמת פר-שורה');

/* ── מוטציות ───────────────────────────────────────────────────────────── */
console.log('  — מוטציות —');
/* ⛔ המוטציות אינן נכתבות לעץ (הלקח של סבב 42ג) — מוטציה שנכתבת לעץ
   שורדת כשלון באמצע הריצה. */

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

/* 2 — ⛔ חזרת המפה כמקור חותמת מרוחקת. זו הרגרסיה שסבב 63 סגר: המפה
   היא `{}` בענן, ולכן כל השוואה מולה מכריעה תמיד לטובת המקומי. */
ok(!/remoteMeta\s*=\s*await ysKvGet\(\s*'ys_settings_meta'/.test(SRC) &&
   !/remoteMeta\s*=\s*null;\s*try\s*\{\s*remoteMeta\s*=\s*await ysKvGet/.test(SRC),
   '18 · ⛔ מוטציה-נגד: המפה אינה נקראת מהענן כחותמת — לא בדחיפה ולא במשיכה');

/* 3 — הסרת ה-revoke מהמיגרציה. */
ok(!/revoke all on function/.test(sql.replace(/revoke all on function[^\n]*\n/, '')),
   '19 · מוטציה: הסרת ה-`revoke` מהמיגרציה — טענה 13 נופלת');

console.log((fail ? '✗' : '✓') + ' סבב 62 (`updated_at` ל-kv) — ' + pass + ' טענות עברו, ' + fail + ' נכשלו\n');
process.exit(fail ? 1 : 0);
