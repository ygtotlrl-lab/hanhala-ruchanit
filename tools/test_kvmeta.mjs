/* ══════════════════════════════════════════════════════════════════════════
   test_kvmeta.mjs — חותמת השורה: המתג, הנכשל-סגור, והמיגרציה
   ══════════════════════════════════════════════════════════════════════════
   **מה נאכף:** ⛔ החותמת **נכשלת סגור ומחזירה 0** — ⚠️ «אין ראיה שהענן
   חדש יותר» ⛔ ולא «הענן חדש»; ⛔ ולצידה צורת המיגרציה שמוסיפה את העמודה.

   **הנימוק המדוד:** שתי טבלאות מפתח/ערך אחרות — אותו מבנה בדיוק — נושאות
   `updated_at`, ⛔ ושלוש טבלאות המפתח-ערך לא. ⚠️ ובהיעדרה מפתח המטא מחזיק
   שני בתים, כלומר החותמת תמיד 0 ⇒ ⛔ «האחרון שדוחף מנצח».

   **מה יישבר בלעדיו:** ⛔ אימוץ ערך מרוחק על סמך **כשל** הוא הסקה ולא
   ראיה — ⚠️ והוא דורס עריכה מקומית בלי סימן.

   **מה אינו נאכף כאן:** ⛔ השער קורא **קבצים** ⛔ ואינו רואה את המסד החי —
   ⚠️ מיגרציה שנכתבה ולא רצה עוברת אותו במלואו, ⭐ ולכן הדלקת הדגל נשענה
   על **מדידה מול המסד** ולא על השער.

   ⚠️ **פרטי כאן.** ⛔ קובץ אחד לפרויקט אחד. ⛔ **והקוד קורא היום מטבלת
   ההגדרות ⛔ ולא מהמפתח-ערך** — ⚠️ המיגרציה נשארת נאכפת כאן מפני ששתי
   הטבלאות שנותרו הן של אפליקציה אחרת, ⭐ והעמודה שם היא מפתח ההכרעה שלה.
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const MIG = join(ROOT, 'migrations', '013_kv_updated_at.sql');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
/*  ⛔ מונה ולא נוכחות (סבב 79) — ⚠️ בדיקת נוכחות עוברת גם על הצהרה כפולה
 *  וגם על שורה שיושבת בתוך הערה: ⭐ הטענה היא על **מספר המופעים**, ⛔ והוא
 *  מודפס בהודעה. */
const _hits = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
const noneIn = (re, s, label) => ok(_hits(re, s) === 0,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי אפס`);
const someIn = (re, s, label) => ok(_hits(re, s) >= 1,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי לפחות 1`);


console.log('\n— סבב 62: `updated_at` ל-kv —');

/* ── א. ⛔ הדגל נמחק — המעבר הושלם (סבב 63) ─────────────────────────────── */
noneIn(/YS_KV_UPDATED_AT/, SRC,
   '1 · ⛔ `YS_KV_UPDATED_AT` אינו קיים עוד — המיגרציה הורצה והמסלול יחיד');
/* ⛔ ושתי הרשימות — צד הדחיפה וצד המשיכה — נגזרות ממקור אחד (סבב 63).
   ⚠️ זה בדיוק ההפרש שנמצא: הדחיפה עברה לעמודה והמשיכה נשארה על המפה
   המתה, ⛔ ומכשיר שערך הגדרה הפך חירש לשינוי שלה ממכשיר אחר. */
/*  ⛔ נמדדת ההצטלבות בין שתי הרשימות ⛔ ולא שמות מוקלדים (סבב 80) — ⚠️ רשימת
 *  שמות בשער נופלת על כל מפתח שנוסף או שירד, ⭐ גם כשההפרש שהיא נועדה
 *  לתפוס אינו קיים כלל. */
const _lwwArr = /var\s+YS_SETTINGS_LWW_KEYS\s*=\s*\[([^\]]*)\]/.exec(SRC);
const _lwwKeys = _lwwArr ? (_lwwArr[1].match(/'([^']+)'/g) || []).map(x => x.slice(1, -1)) : [];
const _pushKeys = (SRC.match(/\{\s*key:\s*'([^']+)',\s*get:/g) || [])
  .map(x => /'([^']+)'/.exec(x)[1]);
const _missing = _lwwKeys.filter(k => _pushKeys.indexOf(k) === -1);
ok(_lwwKeys.length >= 2 && _missing.length === 0,
   '1ב · ⭐ כל מפתח ב-`YS_SETTINGS_LWW_KEYS` נמצא גם ברשימת הדחיפה — נמדדו '
   + _lwwKeys.length + ' מפתחות, ' + _missing.length + ' חסרים בדחיפה (' + (_missing.join(',') || 'אין')
   + ') והצפוי לפחות 2 ואפס חסרים; ⛔ מפתח שנשמט מצד אחד — הוסיפו אותו לשתי הרשימות');

/* ── ב. הנכשל-סגור, על הפונקציה האמיתית ברתמת vm ───────────────────────── */
const fn = /async function ysCfgUpdatedAt\(key\) \{[\s\S]*?\n\}/.exec(SRC);
ok(!!fn, '2 · `ysCfgUpdatedAt` מחולצת מ-index.html');

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
  vm.runInContext(fn[0] + '\nthis.__f = ysCfgUpdatedAt;', ctx);
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
someIn(/rts\s*=\s*await ysCfgUpdatedAt\(sk\.key\)/, SRC,
   '8 · ⭐ צד הדחיפה קורא את `rts` מהעמודה — בלי תנאי ובלי מפה');
/* ⛔ שני הצדדים, ולא אחד — זה מה שנשבר בסבב 63 ותוקן בו. */
someIn(/remoteMeta\[_mk\]\s*=\s*await ysCfgUpdatedAt\(_mk\)/, SRC,
   '8ב · ⭐ וגם צד המשיכה קורא מהעמודה — ⛔ ולא ממפה שהיא `{}` בענן');
noneIn(/ysCfgSet\(\s*'ys_settings_meta'/, SRC,
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

if (RUN_MUT) {
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
  vm.runInContext(mutated + '\nthis.__f = ysCfgUpdatedAt;', ctx);
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

/*  ⭐ מוטציית-נגד: **קוד שנוסף** ⛔ אינו מפיל — ⚠️ הטענות מודדות את מסלול
 *  החותמת, ⛔ ולא את אורך הקובץ: ⭐ שער שהיה נופל על כל תוספת היה הופך כל
 *  עבודה באפליקציה להפרה. */
{
  const added = SRC + '\nfunction _ncMetaPing(){ return 1; }\nvar _ncMetaSeen = _ncMetaPing();\n';
  ok(added !== SRC &&
    (added.match(/ys_settings_meta\b/g) || []).length === (SRC.match(/ys_settings_meta\b/g) || []).length &&
    (added.match(/updated_at\b/g) || []).length === (SRC.match(/updated_at\b/g) || []).length,
    'נ1 · ⭐ מוטציית-נגד: קוד שנוסף ⛔ אינו משנה את מסלול החותמת הנמדד');
}

}

console.log((fail ? '✗' : '✓') + ' סבב 62 (`updated_at` ל-kv) — ' + pass + ' טענות עברו, ' + fail + ' נכשלו\n');
process.exit(fail ? 1 : 0);
