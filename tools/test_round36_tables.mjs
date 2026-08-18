#!/usr/bin/env node
/*  test_round36_tables.mjs — סבב 36: מעבר הנהלה לטבלאות מובנות, שלב א.
 *
 *  ארבעה חלקים:
 *    1. המיגרציות (`005`/`006`) — מבנה: שתי טבלאות אב-ובן, הרשאות בשני
 *       התפקידים, ⛔ אינדקסים מלאים בלבד, ⛔ בלי מפתח זר פיזי, אידמפוטנטיות.
 *    2. הכתיבה הכפולה ב-`index.html` — חיווט בשלושת אתרי הכתיבה, ו⛔ העובדה
 *       שהיא **אינה** קובעת את הצלחת הסנכרון.
 *    3. התנהגות: חילוץ שכבת השורות והרצתה ברתמת vm — גזירת `client_id`,
 *       ירושת `deleted` ו-`updated_at` מהאב, דילוג על מפתח סימון לא-מספרי,
 *       בחירת מה לדחוף, וסדר אב-לפני-בן.
 *    4. מניעת כפילות סדרים (השלמת סבב 36) — כלל אחד בשני המקומות, בדיקה
 *       טרייה מול הענן שנכשלת רכה, ואימוץ שאינו מוחק סימונים.
 *    5. מוטציות: הסרת הכתיבה הכפולה חייבת להיתפס, אינדקס חלקי חייב להיתפס,
 *       ביטול ירושת ה-`deleted` חייב להיתפס, והסרת בדיקת הכפילות חייבת
 *       להיתפס.
 *
 *  ⚠️ הבדיקה הזו פרטית ל-hanhala-ruchanit — היא בודקת מיגרציות וקוד שקיימים
 *     כאן בלבד (כלל ברזל 14: קיום באחת מחייב חריגה מנומקת, ו-`check-structure`
 *     מתיר כל `test_round*` ב-`tools/`).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const M5 = readFileSync(join(ROOT, 'migrations/005_structured_tables.sql'), 'utf8');
const M6 = readFileSync(join(ROOT, 'migrations/006_migrate_kv_to_rows.sql'), 'utf8');

let failed = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed++; console.error('  FAIL ' + m); };
const assert = (cond, m) => (cond ? ok(m) : bad(m));

/* מסיר הערות SQL — הטענות המבניות אמורות לחול על הקוד, לא על התיעוד.
   ⛔ בלי זה כל טענה כאן הייתה עוברת על סמך משפט בהערה (סבב 36) — בדיוק
   סוג הראיה שכלל ברזל 8 סעיף 6 פוסל. */
const sqlCode = (s) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const C5 = sqlCode(M5), C6 = sqlCode(M6);

/* ══════════════════════════════════════════════════════════════════════════
   1 · המיגרציות — מבנה
   ══════════════════════════════════════════════════════════════════════════ */
function t1() {
  console.log('\n1 · המיגרציות');
  assert(/create table if not exists public\.ys_sessions \(/.test(C5) &&
         /create table if not exists public\.ys_marks \(/.test(C5) &&
         /create table if not exists public\.ys_students_rows \(/.test(C5),
    '1א · שלוש הטבלאות נוצרות ב-`if not exists` — אידמפוטנטי');

  // ⭐ ההכרעה: אב ובן, ולא טבלה אחת שטוחה.
  assert(/session_client_id\s+text\s+not null/.test(C5),
    '1ב · `ys_marks` מפנה לאב דרך `session_client_id` — אב ובן, לא טבלה שטוחה');
  assert(!/filled_by_name/.test(C5.split('create table if not exists public.ys_marks')[1] || ''),
    '1ג · ⛔ מטא הסדר אינה משוכפלת לשורת הסימון (אין `filled_by_name` ב-`ys_marks`)');
  assert(/date_iso\s+text\s+not null/.test((C5.split('create table if not exists public.ys_marks')[1] || '')),
    '1ד · `date_iso` משוכפל לבן בכוונה — דוח פר-תלמיד בלי join לאב');

  // ⛔ אינדקסים מלאים בלבד — הלקח של 42P10.
  const idx = C5.match(/create (unique )?index[^;]*;/g) || [];
  assert(idx.length >= 6, '1ה · האינדקסים מוגדרים (' + idx.length + ')');
  assert(!idx.some((i) => /\bwhere\b/i.test(i)),
    '1ו · ⛔ אין אף אינדקס חלקי — `where` באינדקס שובר את הסקת ON CONFLICT (42P10)');
  assert(idx.some((i) => /unique index if not exists ys_marks_session_student[\s\S]*\(session_client_id, student_id\)/.test(i)),
    '1ז · הצמד (session_client_id, student_id) ייחודי — זהו מפתח הזהות של הסימון');
  assert(idx.some((i) => /ys_marks_student_date_idx[\s\S]*\(student_id, date_iso desc\)/.test(i)),
    '1ח · אינדקס הדוח פר-תלמיד (student_id, date_iso desc)');
  // ⚠️ הממצא שנמדד: (session, date_iso) אינו ייחודי בנתונים החיים.
  assert(idx.some((i) => /ys_sessions_session_date_idx/.test(i) && !/unique/.test(i)),
    '1ט · ⚠️ (session, date_iso) **אינו** ייחודי — נמדדו 5 התנגשויות בנתונים החיים');

  assert(!/references\s+public\.ys_sessions/i.test(C5),
    '1י · ⛔ אין מפתח זר פיזי מהבן לאב — סדר הגעה לא ידוע ממכשירים אופליין');

  // הרשאות — שני התפקידים, תמיד.
  ['ys_sessions', 'ys_marks', 'ys_students_rows'].forEach((t) => {
    assert(new RegExp('revoke all on public\\.' + t + ' from anon, authenticated;').test(C5),
      '1כ · `revoke all` ל-' + t + ' משני התפקידים');
    assert(new RegExp('grant select, insert, update on public\\.' + t + ' to anon, authenticated;').test(C5),
      '1ל · `grant select, insert, update` בלבד ל-' + t);
    assert(new RegExp('alter table public\\.' + t + ' enable row level security;').test(C5),
      '1מ · RLS מופעל על ' + t);
  });
  assert(!/grant[^;]*\bdelete\b[^;]*to anon/i.test(C5) && !/grant[^;]*truncate[^;]*to anon/i.test(C5),
    '1נ · ⛔ אפס DELETE ואפס TRUNCATE ל-anon (כלל ברזל 10 סעיף 9)');

  // 006 — העברה אידמפוטנטית שאינה נוגעת ב-kv.
  assert((C6.match(/on conflict \(client_id\) do nothing/g) || []).length === 3,
    '2א · שלוש ההעברות ב-`on conflict do nothing` — אידמפוטנטיות');
  assert(!/do update/i.test(C6),
    '2ב · ⛔ אין `do update` — הרצה חוזרת לא תדרוס עריכה חדשה יותר שכבר בשורה');
  assert(!/\b(truncate|delete\s+from|drop\s+table)\b/i.test(C6),
    '2ג · ⛔ ההעברה אינה מוחקת דבר ואינה נוגעת ב-kv');
  /* ⚠️ שקילות דו-כיוונית = שלוש בדיקות (סדרים · סימונים · תלמידים), ולכל
     אחת **שני** כיוונים. ספירה שווה אינה שקילות: היא עוברת גם כששורה אחת
     חסרה ואחרת עודפת. */
  const dirA = (M6.match(/'kv בלבד'/g) || []).length;
  const dirB = (M6.match(/'שורות בלבד'/g) || []).length;
  assert(dirA === 3 && dirB === 3 && (M6.match(/except/g) || []).length === 6,
    '2ד · בדיקת שקילות **דו-כיוונית** לשלוש הטבלאות (' + dirA + '+' + dirB + ' כיוונים, 6 `except`)');
  /*  ⭐ הטענה הזו התהפכה בסבב 37א: עד `008` ההעברה **סיננה** מפתח `marks`
      לא-מספרי (`m.key ~ '^\d+$'`) והמירה `::smallint`, כי כך נמדד אז.
      מאז ש-`student_id` הוא `text` ⛔ אין סינון ואין המרה — מפתח uuid של
      תלמיד שנוסף מסבב 37 חייב לעבור, אחרת ההעברה משמיטה את כל סימוניו. */
  assert(!/m\.key ~ '\^\\d\+\$'/.test(C6) && !/m\.key::smallint/.test(C6),
    '2ה · ⛔ אין סינון והמרה מספריים על מפתח ה-`marks` — `student_id` הוא `text`');
}

/* ══════════════════════════════════════════════════════════════════════════
   2 · הכתיבה הכפולה — חיווט, ו⛔ מה שהיא אינה קובעת
   ══════════════════════════════════════════════════════════════════════════ */
const WIRING = [
  [/var YS_KV_LEGACY_WRITE = true;/, '3א · ⛔ ה-`kv` נשאר המאסטר בשלב א (YS_KV_LEGACY_WRITE=true)'],
  [/var YS_ROWS = true;/, '3ב · שכבת השורות פעילה (YS_ROWS=true)'],
  [/pendConfirmPush\(PK_AT_SESS,_t0\); _ysMarkPushed\('ys_attend_sessions'\); \}\n[\s\S]{0,400}?ysRowsPushSessions\(data\);/,
    '3ג · הכתיבה הכפולה מחווטת ב-`atSaveData`, **אחרי** אישור ה-⏳ ועֵד הפינוי'],
  [/ysRowsPushStudents\(mergedSt\);/, '3ד · המצבה נדחפת לשורות ממסלול `ysPushToCloud`'],
  [/if \(item\.key === 'ys_attend_sessions'\) ysRowsPushSessions\(item\.value\);/,
    '3ה · מסלול האופליין (`ysFlushQueue`) מעדכן גם את השורות'],
];
function t2() {
  console.log('\n2 · הכתיבה הכפולה');
  WIRING.forEach(([re, msg]) => assert(re.test(SRC), msg));
  // ⛔ הטענה המרכזית: השורות אינן שער.
  assert(!/await ysRowsPushSessions/.test(SRC) && !/await ysRowsPushStudents/.test(SRC),
    '3ו · ⛔ הדחיפה לשורות אינה ב-`await` ואינה חוסמת את מסלול ה-kv');
  assert(!/if\s*\([^)]*ysRowsPush[^)]*\)\s*\{?\s*(pendConfirmPush|_ysMarkPushed)/.test(SRC),
    '3ז · ⛔ אישור ה-⏳ ועֵד הפינוי אינם תלויים בהצלחת הכתיבה לשורות');
  assert(/ys_sessions_rows/.test(SRC) && /ys_marks_rows/.test(SRC),
    '3ח · מקורות הגיבוי החדשים רשומים ב-BK_CFG (ומשם לרשימת-ההיתר של 004)');
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · התנהגות — חילוץ שכבת השורות והרצתה
   ══════════════════════════════════════════════════════════════════════════ */
const START = 'שכבת השורות — טבלאות מובנות, שלב א (סבב 36)';
const END = '/* ═══ סוף שכבת השורות';
function extract(src) {
  const lines = src.split('\n');
  const si = lines.findIndex((l) => l.includes(START));
  const ei = lines.findIndex((l) => l.includes(END));
  if (si < 0 || ei <= si) return null;
  return lines.slice(si - 1, ei + 1).join('\n');
}
/* רתמה: SB מזויף שרושם כל upsert, ו-`_ysRecTs` מינימלי. */
function harness(modSrc, opts) {
  const o = opts || {};
  const calls = [];
  const sandbox = {
    console, Date, Object, Array, Number, String, Math, isFinite, JSON, RegExp,
    withTimeout: (p) => p,
    pendHas: () => !!o.pending,
    PK_AT_SESS: 'at-sess:',
    _ysRecTs: (r) => (r && r.updatedAt) || 0,
    SB: {
      from: (t) => ({
        select: async () => ({ data: o.remote === undefined ? [] : o.remote, error: o.remoteErr || null }),
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
function dupHarness(modSrc) {
  const sandbox = {
    console, Object, Array, String, Number,
    window: { _atMarks: {}, _slMarks: {} },
    ysMarks: (r) => (r && r.marks && typeof r.marks === 'object') ? r.marks : {},
    ysKvGet: async () => null,
    _ysSessionsMerge: (c, l) => l,
  };
  vm.createContext(sandbox);
  vm.runInContext(modSrc, sandbox);
  return sandbox;
}

const SESS = {
  id: '111', session: 'שחרית', date_iso: '2026-05-17',
  date_heb: { hy: 5786, mi: 8, day: 1 },
  filled_by: 6, filled_by_name: 'הרב רוך', created_at: '2026-05-17T05:38:35.425Z',
  updatedAt: 900, deleted: true, createdBy: 'u1',
  marks: { '3': { s: 'p', min: 0 }, '7': { s: 'l', min: 12 }, 'bad': { s: 'p', min: 0 } },
};

async function t3() {
  console.log('\n3 · התנהגות');
  const MOD = extract(SRC);
  assert(MOD !== null, '4א · שכבת השורות מחולצת מ-index.html');
  if (!MOD) return;
  const { sandbox, calls } = harness(MOD, {});

  const row = sandbox.ysSessionRow(SESS);
  assert(row.client_id === '111' && row.updated_at === 900,
    '4ב · `client_id` של האב נגזר מ-`id`, והחותמת מ-`updatedAt`');
  assert(JSON.stringify(row.date_heb) === JSON.stringify(SESS.date_heb),
    '4ג · ⛔ `date_heb` נשמר כמות שהוא ואינו נגזר מחדש מ-`date_iso`');
  assert(row.created_by === 'u1' && row.created_at === SESS.created_at,
    '4ד · שדות המטא מועתקים אחד לאחד (ההעברה מועתקת, לא משוחזרת)');

  const marks = sandbox.ysMarkRows(SESS);
  /*  ⭐ התהפך בסבב 37א — מזהה תלמיד הוא uuid מסבב 37, ו-`student_id` הוא
      `text` מאז `008`. סימון שמפתחו אינו מספרי **חייב** להגיע לשכבת
      השורות; ⛔ דילוג כאן היה משמיט בשקט את כל הסימונים של כל תלמיד
      שנוסף מסבב 37 ואילך. */
  assert(marks.length === 3,
    '4ה · ⭐ סימון עם מפתח לא-מספרי (uuid) מגיע לשכבת השורות (' + marks.length + ' שורות)');
  assert(marks.every((m) => typeof m.student_id === 'string'),
    '4ה2 · ⛔ `student_id` נשלח כמחרוזת — אין המרה מספרית על עמודת טקסט');
  assert(marks.some((m) => m.student_id === 'bad'),
    '4ה3 · והמפתח עצמו נשמר כמות שהוא, בלי עיגול ובלי NaN');
  assert(marks.every((m) => m.client_id === '111:' + m.student_id),
    '4ו · `client_id` של הסימון נגזר ממפתח הזהות `<סדר>:<תלמיד>` ואינו uuid חדש');
  assert(marks.every((m) => m.updated_at === 900),
    '4ז · הסימון יורש את חותמת האב — ⛔ ולא `Date.now()`');
  assert(marks.every((m) => m.deleted === true),
    '4ח · ⛔ הסימון יורש את `deleted` של האב — אחרת סדר מחוק דולף לדוח פר-תלמיד');
  assert(marks.every((m) => m.date_iso === '2026-05-17'),
    '4ט · `date_iso` משוכפל לכל שורת סימון');

  const st = sandbox.ysStudentRow({ id: 5, name: 'x', updatedAt: 7 });
  assert(st.client_id === '5' && st.student_id === '5' && st.data.name === 'x',
    '4י · שורת תלמיד — גוף הרשומה ב-`data`, ורק עמודות המיזוג מחוצה לו');
  const stU = sandbox.ysStudentRow({ id: 'a1b2-uuid', name: 'y', updatedAt: 7 });
  assert(stU.student_id === 'a1b2-uuid',
    '4י2 · ⭐ ותלמיד עם מזהה uuid מקבל `student_id` תקין ולא `null`');

  // סדר אב-לפני-בן, ובחירת מה לדחוף.
  const r = await sandbox.ysRowsPushSessions([SESS]);
  assert(r.ok === true && calls.length === 2, '4כ · דחיפה מוצלחת כותבת לשתי הטבלאות');
  assert(calls[0].table === 'ys_sessions' && calls[1].table === 'ys_marks',
    '4ל · האב נכתב לפני הבן — אין רגע שבו יש סימון בלי הסדר שלו');

  const h2 = harness(extract(SRC), { remote: [{ client_id: '111', updated_at: 900 }] });
  const r2 = await h2.sandbox.ysRowsPushSessions([SESS]);
  assert(r2.ok === true && r2.n === 0 && h2.calls.length === 0,
    '4מ · סדר שכבר בענן באותה חותמת אינו נדחף שוב');

  const h3 = harness(extract(SRC), { remote: [{ client_id: '111', updated_at: 900 }], pending: true });
  const r3 = await h3.sandbox.ysRowsPushSessions([SESS]);
  assert(r3.n === 1, '4נ · ⛔ רשומה מסומנת ⏳ נדחפת תמיד (כלל ברזל 6)');

  const h4 = harness(extract(SRC), { failOn: 'ys_marks' });
  const r4 = await h4.sandbox.ysRowsPushSessions([SESS]);
  assert(r4.ok === false, '4ס · כשל בכתיבת הבן מוחזר כ-`ok:false` — נכשל סגור');

  // ⚠️ מנות — הדחיפה הראשונה נוגעת בכל הסדרים, ו-13,083 שורות בבקשה אחת נדחות.
  const big = { ...SESS, id: '222', marks: {} };
  for (let i = 1; i <= 1200; i++) big.marks[String(i)] = { s: 'p', min: 0 };
  const hB = harness(extract(SRC), {});
  await hB.sandbox.ysRowsPushSessions([big]);
  const markCalls = hB.calls.filter((c) => c.table === 'ys_marks');
  assert(markCalls.length === 3 && markCalls.every((c) => c.rows.length <= 500),
    '4פ · 1,200 סימונים נדחפים ב-3 מנות של ≤500 — ⛔ ולא בבקשה אחת');

  const h5 = harness(extract(SRC), { remoteErr: { message: 'no table' } });
  const r5 = await h5.sandbox.ysRowsPushSessions([SESS]);
  assert(r5.ok === true && h5.calls.length === 2,
    '4ע · טבלה שטרם נוצרה / משיכה שנכשלה ⇒ בספק דוחפים (map=null)');
}

/* ══════════════════════════════════════════════════════════════════════════
   3ב · מניעת כפילות סדרים (השלמת סבב 36)
   ══════════════════════════════════════════════════════════════════════════ */
const DUP_GUARD = [
  [/function atFindLiveSession\(data, sessName, dateIso, exceptId\)/,
    '6א · כלל הכפילות מוגדר פעם אחת (`atFindLiveSession`)'],
  [/allData=window\._atData=await ysFreshSessions\('ys_attend_sessions',allData\);/,
    '6ב · בדיקת הפתיחה רצה מול מצב טרי מהענן ולא מול הזיכרון בלבד'],
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
   4 · מוטציות — כל טענה שאין מוטציה שמפילה אותה אינה שער
   ══════════════════════════════════════════════════════════════════════════ */
async function t4() {
  console.log('\n4 · מוטציות');

  // א. הסרת הכתיבה הכפולה מ-atSaveData.
  const mutA = SRC.replace('    ysRowsPushSessions(data);\n', '');
  assert(mutA !== SRC, '5א · המוטציה אכן מסירה את הכתיבה הכפולה');
  assert(!WIRING[2][0].test(mutA),
    '5ב · ⛔ מוטציה שמסירה את הכתיבה הכפולה נתפסת — טענת 3ג הייתה נכשלת');

  // ב. אינדקס חלקי במקום מלא.
  const mutB = M5.replace(
    'create unique index if not exists ys_marks_session_student\n  on public.ys_marks (session_client_id, student_id);',
    'create unique index if not exists ys_marks_session_student\n  on public.ys_marks (session_client_id, student_id) where not deleted;');
  assert(mutB !== M5, '5ג · המוטציה אכן מכניסה אינדקס חלקי');
  const idxB = sqlCode(mutB).match(/create (unique )?index[^;]*;/g) || [];
  assert(idxB.some((i) => /\bwhere\b/i.test(i)),
    '5ד · ⛔ מוטציה שמכניסה אינדקס חלקי נתפסת — טענת 1ו הייתה נכשלת (42P10)');

  // ג. ביטול ירושת ה-deleted בשורת הסימון.
  const mutC = SRC.replace('      deleted: del,\n', '      deleted: false,\n');
  assert(mutC !== SRC, '5ה · המוטציה אכן מבטלת את ירושת ה-`deleted`');
  const hC = harness(extract(mutC), {});
  const marksC = hC.sandbox.ysMarkRows(SESS);
  assert(marksC.every((m) => m.deleted === false),
    '5ו · ⛔ במוטנט סימון של סדר מחוק נשאר חי — טענת 4ח הייתה נכשלת');

  // ד. הסרת בדיקת הכפילות מנקודת היצירה בפועל.
  const mutDup = SRC.replace(
    /    var _atDup=atFindLiveSession\(window\._atData,window\._atPendingRec\.session,\n\s*window\._atPendingRec\.date_iso,window\._atPendingRec\.id\);\n/,
    '    var _atDup=null;\n');
  assert(mutDup !== SRC, '5ח · המוטציה אכן מסירה את בדיקת הכפילות');
  assert(!DUP_GUARD[2][0].test(mutDup),
    '5ט · ⛔ מוטציה שמסירה את בדיקת הכפילות נתפסת — טענת 6ג הייתה נכשלת');

  /*  ו. החזרת הדילוג על מפתח לא-מספרי ב-`ysMarkRows` (סבב 37א) — זה
      הפיגום שהוסר כשהעמודה הפכה ל-`text`, ו⛔ החזרתו משמיטה בשקט את כל
      הסימונים של כל תלמיד שנוסף מסבב 37 ואילך. */
  const mutSkip = SRC.replace(
    "  Object.keys(marks).forEach(function (k) {\n",
    "  Object.keys(marks).forEach(function (k) {\n    if (!/^\\d+$/.test(k)) return;\n");
  assert(mutSkip !== SRC, '5יא · המוטציה אכן מחזירה את הדילוג המספרי');
  const hSkip = harness(extract(mutSkip), {});
  const marksSkip = hSkip.sandbox.ysMarkRows(SESS);
  assert(marksSkip.length === 2 && !marksSkip.some((m) => m.student_id === 'bad'),
    '5יב · ⛔ במוטנט הסימון עם ה-uuid נעלם — טענות 4ה/4ה3 היו נכשלות');

  // ה. הפיכת on conflict do nothing ל-do update.
  const mutD = M6.replace(/on conflict \(client_id\) do nothing/g,
    'on conflict (client_id) do update set updated_at = excluded.updated_at');
  assert(/do update/i.test(sqlCode(mutD)),
    '5י · ⛔ מוטציה שהופכת את ההעברה ל-`do update` נתפסת — טענת 2ב הייתה נכשלת');
}

console.log('סבב 36 — מעבר הנהלה לטבלאות מובנות, שלב א');
t1(); t2();
await t3(); t3b(); await t4();
console.log(failed ? '\n✗ ' + failed + ' טענות נכשלו' : '\n✓ סבב 36 — כל הטענות עברו');
process.exit(failed ? 1 : 0);
