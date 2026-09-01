#!/usr/bin/env node
/*  test_sleep_rows.mjs — סדרי השינה בשכבת השורות.
 *
 *  **מה נאכף:** ⛔ השינה נוספה כ**תצורה** ⛔ ולא כהעתקה של מסלול הנוכחות —
 *  ⚠️ וחלק מהטענות בודקות דווקא ש**אין** עותק שני של מסלול הכתיבה.
 *  ⚠️ שכבת השורות נחתכת מ-`index.html` ורצה ב-`vm` מעל לקוח מזויף שרושם
 *  כל כתיבה.
 *
 *  **הנימוק המדוד:** שני עותקים של מסלול הכתיבה הם שתי הזדמנויות שאחד
 *  מהם ייסחף — ⚠️ הלקח של איחוד מנועי המיזוג.
 *
 *  **מה יישבר בלעדיו:** ⛔ מסלול שני שנכתב בהעתקה מתקן באחד ולא בשני,
 *  ⚠️ והפער נראה רק במסך שמשתמשים בו פחות.
 *
 *  **מה אינו נאכף כאן:** ⛔ קיום הטבלאות במסד — ⚠️ נמדד ששתיהן הוכרזו
 *  כמקור גיבוי בזמן שלא נוצרו כלל, ⭐ ומקורות הגיבוי נאכפים בשער שלהם.
 *
 *  ⚠️ פרטי לאפליקציה הזו. ⛔ אין ליישר אותו מריפו אחר — שכבת השורות הזו
 *  אינה קיימת באחיות.
 */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const M009 = fs.readFileSync(path.join(ROOT, 'migrations/009_sleep_structured_tables.sql'), 'utf8');
const M010 = fs.readFileSync(path.join(ROOT, 'migrations/010_migrate_sleep_kv_to_rows.sql'), 'utf8');
const M004 = fs.readFileSync(path.join(ROOT, 'migrations/004_backup_retention_cron.sql'), 'utf8');

/* ⚠️ הטענות על ה-SQL נמדדות על **הקוד הרץ בלבד** — שורות `--` מוסרות קודם.
   ⛔ בלי זה הערה שמסבירה «אסור `do update`» הייתה נספרת כ-`do update`,
      והבדיקה הייתה נכשלת דווקא על התיעוד שמגן על הכלל. */
const sql = (s) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const S009 = sql(M009), S010 = sql(M010);

let pass = 0, fail = 0;
const ok = (m, c) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ── חילוץ שכבת השורות ─────────────────────────────────────────────────── */
const START = 'שכבת השורות — טבלאות מובנות, שלב א (סבב 36)';
const END = '/* ═══ סוף שכבת השורות';
function extract(src) {
  const lines = src.split('\n');
  const si = lines.findIndex((l) => l.includes(START));
  const ei = lines.findIndex((l) => l.includes(END));
  if (si < 0 || ei <= si) return null;
  return lines.slice(si - 1, ei + 1).join('\n');
}
function harness(modSrc, opts) {
  const o = opts || {};
  const calls = [];
  const sandbox = {
    console, Date, Object, Array, Number, String, Math, isFinite, JSON, RegExp,
    withTimeout: (p) => p,
    pendHas: () => !!o.pending,
    PK_AT_SESS: 'at-sess:', PK_SL_SESS: 'sl-sess:',
    _ysRecTs: (r) => (r && r.updatedAt) || 0,
    SB: {
      from: (t) => ({
        /* ⚠️ ה-select מודע לטבלה (סבב 39) — מוק עיוור-לטבלה היה מחזיר את
           אותה מפה לשני המסלולים, כלומר **מסתיר** בדיוק את הבאג שטענה
           3יא נועדה לתפוס. */
        select: async () => ({
          data: (o.remoteBy ? (o.remoteBy[t] || []) : (o.remote === undefined ? [] : o.remote)),
          error: o.remoteErr || null,
        }),
        upsert: async (rows) => {
          calls.push({ table: t, rows });
          return { error: (o.failOn === t) ? { message: 'x' } : null };
        },
      }),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(modSrc, sandbox);
  return { sandbox, calls };
}

/* סדר שינה אמיתי בצורתו — כולל `note`, שהוא ההבדל היחיד מהנוכחות. */
const SLEEP = {
  id: 'sl-1', session: 'נגלה', date_iso: '2026-06-01', updatedAt: 1000,
  marks: {
    '7':  { s: 'נ',  min: 5,  note: 'הערה כלשהי' },
    '12': { s: 'ח',  min: 0 },
    '9':  { s: 'נ',  min: 30, note: '' },
  },
};
const ATTEND = {
  id: 'at-1', session: 'שחרית', date_iso: '2026-06-01', updatedAt: 1000,
  marks: { '7': { s: 'נ', min: 5 } },
};

const MOD = extract(SRC);

console.log('\n· hanhala-ruchanit — סבב 39: סדרי השינה בשכבת השורות\n');

/* ── א. המיגרציות ──────────────────────────────────────────────────────── */
ok('1א · `009` יוצרת אב ובן ב-`if not exists` — אידמפוטנטי',
  /create table if not exists public\.ys_sleep_sessions/.test(M009) &&
  /create table if not exists public\.ys_sleep_marks/.test(M009));
ok('1ב · ⭐ ולבן יש עמודת `note` — ההבדל היחיד מהנוכחות',
  /^\s*note\s+text/m.test(M009));
ok('1ג · ⛔ אפס אינדקסים חלקיים ב-`009` (הלקח של 42P10)',
  !/create\s+(unique\s+)?index[\s\S]{0,200}?\swhere\s/i.test(S009));
ok('1ד · ⚠️ אינדקס האב **אינו** ייחודי — התנגשות שם+יום היא כתיבה תקפה',
  /create index if not exists ys_sleep_sessions_session_date_idx/.test(M009) &&
  !/create unique index if not exists ys_sleep_sessions_session_date/.test(M009));
ok('1ה · ⚠️ ואינדקס הבן **כן** ייחודי — הוא מפתח הזהות',
  /create unique index if not exists ys_sleep_marks_session_student/.test(M009));
ok('1ו · ⛔ `revoke` ואז `grant` לשתי הטבלאות (כלל ברזל 10 סעיף 9)',
  /revoke all on public\.ys_sleep_sessions from anon, authenticated/.test(M009) &&
  /revoke all on public\.ys_sleep_marks from anon, authenticated/.test(M009) &&
  !/grant[^;]*\bdelete\b[^;]*to anon/i.test(M009));
ok('1ז · `010` אידמפוטנטית ב-`on conflict do nothing`',
  (S010.match(/on conflict \(client_id\) do nothing/g) || []).length === 2 &&
  !/do update/.test(S010));
ok('1ח · ⭐ ו-`note` מועבר בפועל — לא רק קיים כעמודה',
  /m\.value->>'note'/.test(S010));
ok('1ט · ⛔ ובדיקת השקילות משווה גם אותו',
  /select client_id,session_client_id,student_id,date_iso,status,minutes,note/.test(M010));
/*  ⛔ הסימון נמדד מול המסד ואינו מוצהר — ⚠️ שתי הטבלאות קיימות בו עם
    נתונים, ⭐ כלומר שתי המיגרציות רצו: ⛔ סימון «נכתב ולא רץ» עליהן היה
    שארית שסותרת את המסד. */
ok('1י · ⛔ שתי המיגרציות מסומנות «רץ במסד»',
  /⛔ \*\*רץ במסד\.\*\*/.test(M009) && /⛔ \*\*רץ במסד\.\*\*/.test(M010));

/* ── ב. החיווט בקוד ────────────────────────────────────────────────────── */
ok('2א · `YS_ROWS_KINDS` מגדירה את שני המסלולים',
  /YS_ROWS_KINDS\s*=\s*\{[\s\S]*?attend:[\s\S]*?sleep:/.test(SRC));
ok('2ב · ⭐ ואין עותק שני של מסלול הדחיפה — `ysRowsPushSessions` מוגדרת פעם אחת',
  (SRC.match(/^async function ysRowsPushSessions/gm) || []).length === 1);
ok('2ג · ⛔ ואין `ysRowsPushSleep` נפרדת',
  !/function ysRowsPushSleep/.test(SRC));
ok('2ד · `slSaveData` דוחפת לשכבת השורות עם המסלול `sleep`',
  /ysRowsPushSessions\(data,'sleep'\)/.test(SRC));
/*  ⛔ הכתיבה הכפולה כובתה (סבב 78) — ⚠️ שכבת השורות היא הכתיבה, ⭐ ואישור
 *  ה-⏳ ועֵד הפינוי נשענים על הצלחתה: ⛔ אין עוד ערך שלם להישען עליו. */
ok('2ה · ⭐ ואישור ה-⏳ ועֵד הפינוי נשענים על הצלחתה',
  /if\(_rSl&&_rSl\.ok\) \{ pendConfirmPush\(PK_SL_SESS,_t0\); _ysMarkPushed\('ys_sleep_sessions'\); \}/.test(SRC));
ok('2ו · ⛔ וכתיבה שנכשלה חוזרת לתור — ⚠️ אחרת אין לה ניסיון חוזר',
  /if\(!\(_rSl&&_rSl\.ok\)&&ysCount\(data\)\) \{ _ysQueueAdd\('ys_sleep_sessions',data\);/.test(SRC));
ok('2ז · שני מקורות הגיבוי רשומים ב-BK_CFG',
  /ys_sleep_sessions_rows/.test(SRC) && /ys_sleep_marks_rows/.test(SRC));
ok('2ח · ⛔ ושניהם ברשימת-ההיתר של `004` — אחרת לא היו מתפנים לעולם',
  /'ys_sleep_sessions_rows', 'ys_sleep_marks_rows'/.test(M004));

/* ── ג. התנהגות ────────────────────────────────────────────────────────── */
ok('3א · שכבת השורות מחולצת מ-index.html', !!MOD);
if (MOD) {
  const h = harness(MOD);
  const sMarks = h.sandbox.ysMarkRows(SLEEP, 'sleep');
  const aMarks = h.sandbox.ysMarkRows(ATTEND);
  ok('3ב · ⭐ סימון שינה נושא `note`',
    sMarks.length === 3 && sMarks.every((r) => 'note' in r));
  ok('3ג · והערה אמיתית עוברת כמות שהיא',
    (sMarks.find((r) => r.student_id === '7') || {}).note === 'הערה כלשהי');
  ok('3ד · ⚠️ והערה ריקה יורדת כ-`null` מפורש — כדי שמחיקה תימחק בענן',
    (sMarks.find((r) => r.student_id === '9') || {}).note === null &&
    (sMarks.find((r) => r.student_id === '12') || {}).note === null);
  ok('3ה · ⛔ וסימון נוכחות **אינו** נושא `note` — ל-`ys_marks` אין עמודה כזו',
    aMarks.length === 1 && !('note' in aMarks[0]));

  const h2 = harness(MOD);
  const r = await h2.sandbox.ysRowsPushSessions([SLEEP], 'sleep');
  const tables = h2.calls.map((c) => c.table);
  ok('3ו · דחיפת שינה כותבת לשתי טבלאות השינה',
    r.ok && tables.includes('ys_sleep_sessions') && tables.includes('ys_sleep_marks'));
  ok('3ז · ⛔ ואינה נוגעת בטבלאות הנוכחות',
    !tables.includes('ys_sessions') && !tables.includes('ys_marks'));
  ok('3ח · ⚠️ האב נכתב לפני הבן — לא נוצר סימון בלי הסדר שלו',
    tables.indexOf('ys_sleep_sessions') < tables.indexOf('ys_sleep_marks'));
  const sleepRows2 = h2.calls.find((c) => c.table === 'ys_sleep_marks').rows;
  ok('3ט · והסימונים יורשים את חותמת האב ואת `deleted` שלו',
    sleepRows2.length > 0 && sleepRows2.every(
      (x) => x.updated_at === 1000 && x.deleted === false));

  const h3 = harness(MOD);
  await h3.sandbox.ysRowsPushSessions([ATTEND]);
  ok('3י · ⭐ ומסלול הנוכחות לא נשבר — עדיין כותב לטבלאות שלו',
    h3.calls.map((c) => c.table).join(',') === 'ys_sessions,ys_marks');

  /* ⭐ מפות חותמות נפרדות — הנקודה שאסור לפספס: מזהה סדר שינה ומזהה סדר
     נוכחות חיים במרחבים נפרדים, ומפה משותפת הייתה מדלגת על דחיפה. */
  /* ⚠️ שני צעדים, ובכוונה: קודם דחיפת שינה שממלאת את מפת השינה, ורק אז
     דחיפת נוכחות עם **אותו מזהה**. צעד אחד לא היה מוכיח דבר — המפה
     הייתה ריקה ממילא. */
  const h4 = harness(MOD, { remoteBy: { ys_sleep_sessions: [{ client_id: 'dup', updated_at: 1000 }] } });
  await h4.sandbox.ysRowsPushSessions([{ ...SLEEP, id: 'dup' }], 'sleep');
  const rA = await h4.sandbox.ysRowsPushSessions([{ ...ATTEND, id: 'dup' }]);
  ok('3יא · ⛔ מפה נפרדת לכל מסלול — סדר נוכחות שמזההו זהה לסדר שינה עדיין נדחף',
    rA.ok && rA.n === 1);
}

/* ── ד. מוטציות ────────────────────────────────────────────────────────── */
console.log('  — מוטציות —');
{
  const mut = SRC.replace("var _rSl=await ysRowsPushSessions(data,'sleep');",
                          "var _rSl=await ysCfgSet('ys_sleep_sessions',data);");
  ok('4א · מוטציה: החזרת הכתיבה לערך שלם מפילה את טענה 2ד',
    !/ysRowsPushSessions\(data,'sleep'\)/.test(mut));
}
if (MOD) {
  /* ⛔ `note` שנוסף גם לנוכחות — ה-`upsert` כולו היה נדחה, לא רק השדה. */
  const mut = MOD.replace('var wantNote = !!(YS_ROWS_KINDS[kind || \'attend\'] || {}).note;',
                          'var wantNote = true;');
  const hm = harness(mut);
  const aM = hm.sandbox.ysMarkRows(ATTEND);
  ok('4ב · מוטציה: `note` גם בנוכחות מפיל את טענה 3ה', 'note' in aM[0]);
}
if (MOD) {
  /* ⛔ מפה משותפת לשני המסלולים — דילוג שקט על דחיפה. */
  const mut = MOD.replace('if (_ysRowsRemote[kind]) return _ysRowsRemote[kind];',
                          'if (_ysRowsRemote.attend) return _ysRowsRemote.attend;')
                 .replace('_ysRowsRemote[kind] = map;', '_ysRowsRemote.attend = map;');
  const hm = harness(mut, { remoteBy: { ys_sleep_sessions: [{ client_id: 'dup', updated_at: 1000 }] } });
  await hm.sandbox.ysRowsPushSessions([{ ...SLEEP, id: 'dup' }], 'sleep');
  const rr = await hm.sandbox.ysRowsPushSessions([{ ...ATTEND, id: 'dup' }]);
  ok('4ג · מוטציה: מפת חותמות משותפת מדלגת על דחיפה — טענה 3יא נופלת',
    rr.ok && rr.n === 0);
}
{
  const mut = S010.replace(/on conflict \(client_id\) do nothing/g,
                           'on conflict (client_id) do update set deleted = excluded.deleted');
  ok('4ד · מוטציה: הפיכת ההעברה ל-`do update` מפילה את טענה 1ז',
    /do update/.test(mut));
}
{
  const mut = S009.replace('create unique index if not exists ys_sleep_marks_session_student\n  on public.ys_sleep_marks (session_client_id, student_id);',
    'create unique index if not exists ys_sleep_marks_session_student\n  on public.ys_sleep_marks (session_client_id, student_id) where deleted = false;');
  ok('4ה · מוטציה: אינדקס חלקי מפיל את טענה 1ג (42P10)',
    /create\s+(unique\s+)?index[\s\S]{0,200}?\swhere\s/i.test(mut));
}
{
  const mut = S010.replace("  m.value->>'note',\n", '');
  ok('4ו · ⛔ מוטציה: השמטת `note` מההעברה מפילה את טענה 1ח',
    !/m\.value->>'note'/.test(mut));
}

console.log(`\n${fail ? '✗' : '✓'} סבב 39 (שכבת השורות של השינה) — ${pass} טענות עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
