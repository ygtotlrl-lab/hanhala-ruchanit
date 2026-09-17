#!/usr/bin/env node
/*  test_tables.mjs — שכבת השורות של הנוכחות: מבנה הטבלאות והכתיבה אליהן.
 *
 *  **מה נאכף:** (1) המיגרציות — שלוש הטבלאות נוצרות ב-`if not exists`,
 *  הרשאות בשני התפקידים, ⛔ אינדקסים מלאים בלבד, וההעברה אידמפוטנטית
 *  ובדו-כיווניות; (2) שכבת השורות רצה ברתמת `vm` — גזירת המזהה, אי-הדילוג
 *  על מפתח סימון לא-מספרי, ⛔ המנות של 500, והנפילה-הסגורה של כשל בן.
 *
 *  **הנימוק המדוד:** מפתח הנתונים היה 360KB, ⛔ ולכן **כל סימון נוכחות
 *  בודד דרס את מלוא הערך**.
 *
 *  **מה יישבר בלעדיו:** ⛔ אינדקס **חלקי** מפיל את `ON CONFLICT` בשקט —
 *  ⚠️ פוסטגרס מסיק את אינדקס-הבורר מרשימת העמודות, ⭐ ולממשק ה-REST אין
 *  דרך להוסיף את התנאי.
 *
 *  **מה אינו נאכף כאן:** ⛔ הרצת המיגרציות — ⚠️ הבדיקה קוראת אותן כטקסט,
 *  ⭐ ומצב ההרצה נמדד מול המסד; ⛔ ירושת המחיקה והחותמת, סדר אב-לפני-בן
 *  והמפתח הזר — ⚠️ הם נמדדים בשער האב-ובן המשותף; ⛔ ומניעת כפילות
 *  הסדרים — ⚠️ בשער הכפילות הפרטי.
 *
 *  ⚠️ פרטי לאפליקציה הזו — היא בודקת מיגרציות וקוד שקיימים כאן בלבד.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
/*  ⛔ המיגרציה מתארת את המסד כפי שהיה בשעה שהיא רצה — ⚠️ והשמות שבה
 *  קדמו לגזירת התחילית משם הריפו (סבב 148): ⭐ ולכן הטקסט מנורמל לשם
 *  החי **לפני** המדידה, ⛔ והקובץ עצמו אינו נערך ואינו נמחק — ⚠️ וזו
 *  נקודת התרגום האחת בשער, ⭐ ושתיים היו שני מקורות אמת לאותו שם. */
const migLive = (s) => s.split('ys_').join('hr_');
const M5 = migLive(readFileSync(join(ROOT, 'migrations/005_structured_tables.sql'), 'utf8'));
const M6 = migLive(readFileSync(join(ROOT, 'migrations/006_migrate_kv_to_rows.sql'), 'utf8'));

let failed = 0;
/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה שבה השער רץ, ⛔ ופחות ממנה
 *  הוא כשל — ⚠️ והמאזין על `exit` תופס גם יציאה שקדמה להמתנה. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
/*  ⛔ ריצפת הטענות — ⚠️ **מה נכנס**: המשותפת, שהיא מספר זהה בכל הריפו,
 *  ⛔ והפרטית עם היכולת שמוסיפה אותה; ⛔ **ומה מפיל**: משותפת שנבדלת בין
 *  הריפו, פרטית בלי נימוק, וסכום אפס. ⭐ **ולמה לא מספר אחד**: הוא מסתיר
 *  טענה משותפת שאבדה. */
const FLOOR = { shared: 0, app: 49, appWhy: 'מבנה שכבת השורות של הנוכחות והשינה — יכולת שקיימת בהנהלה בלבד' };
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
const ok = (m) => (RAN++, console.log('  ok   ' + m));
const bad = (m) => { RAN++; failed++; console.error('  FAIL ' + m); };
const assert = (cond, m) => (cond ? ok(m) : bad(m));
/*  ⛔ מונה ולא נוכחות (סבב 79) — ⚠️ בדיקת נוכחות עוברת גם על הצהרה כפולה
 *  וגם על שורה שיושבת בתוך הערה: ⭐ הטענה היא על **מספר המופעים**, ⛔ והוא
 *  מודפס בהודעה. */
const _hits = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
const noneIn = (re, s, label) => assert(_hits(re, s) === 0,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי אפס`);
const someIn = (re, s, label) => assert(_hits(re, s) >= 1,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי לפחות 1`);


/* מסיר הערות SQL — הטענות המבניות אמורות לחול על הקוד, לא על התיעוד.
   ⛔ בלי זה כל טענה כאן הייתה עוברת על סמך משפט בהערה (סבב 36) — בדיוק
   סוג הראיה שנפסל. */
const sqlCode = (s) => s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const C5 = sqlCode(M5), C6 = sqlCode(M6);

/* ══════════════════════════════════════════════════════════════════════════
   1 · המיגרציות — מבנה
   ══════════════════════════════════════════════════════════════════════════ */
function t1() {
  console.log('\n1 · המיגרציות');
  assert(/create table if not exists public\.hr_sessions \(/.test(C5) &&
         /create table if not exists public\.hr_marks \(/.test(C5) &&
         /create table if not exists public\.hr_students_rows \(/.test(C5),
    '1א · שלוש הטבלאות נוצרות ב-`if not exists` — אידמפוטנטי');

  // ⭐ ההכרעה: אב ובן, ולא טבלה אחת שטוחה.
  assert(/session_client_id\s+text\s+not null/.test(C5),
    '1ב · `hr_marks` מפנה לאב דרך `session_client_id` — אב ובן, לא טבלה שטוחה');
  assert(!/filled_by_name/.test(C5.split('create table if not exists public.hr_marks')[1] || ''),
    '1ג · ⛔ מטא הסדר אינה משוכפלת לשורת הסימון (אין `filled_by_name` ב-`hr_marks`)');
  assert(/date_iso\s+text\s+not null/.test((C5.split('create table if not exists public.hr_marks')[1] || '')),
    '1ד · `date_iso` משוכפל לבן בכוונה — דוח פר-תלמיד בלי join לאב');

  // ⛔ אינדקסים מלאים בלבד — הלקח של 42P10.
  const idx = C5.match(/create (unique )?index[^;]*;/g) || [];
  assert(idx.length >= 6, '1ה · האינדקסים מוגדרים (' + idx.length + ')');
  assert(!idx.some((i) => /\bwhere\b/i.test(i)),
    '1ו · ⛔ אין אף אינדקס חלקי — `where` באינדקס שובר את הסקת ON CONFLICT (42P10)');
  assert(idx.some((i) => /unique index if not exists hr_marks_session_student[\s\S]*\(session_client_id, student_id\)/.test(i)),
    '1ז · הצמד (session_client_id, student_id) ייחודי — זהו מפתח הזהות של הסימון');
  assert(idx.some((i) => /hr_marks_student_date_idx[\s\S]*\(student_id, date_iso desc\)/.test(i)),
    '1ח · אינדקס הדוח פר-תלמיד (student_id, date_iso desc)');
  // ⚠️ הממצא שנמדד: (session, date_iso) אינו ייחודי בנתונים החיים.
  assert(idx.some((i) => /hr_sessions_session_date_idx/.test(i) && !/unique/.test(i)),
    '1ט · ⚠️ (session, date_iso) **אינו** ייחודי — נמדדו 5 התנגשויות בנתונים החיים');


  // הרשאות — שני התפקידים, תמיד.
  ['hr_sessions', 'hr_marks', 'hr_students_rows'].forEach((t) => {
    assert(new RegExp('revoke all on public\\.' + t + ' from anon, authenticated;').test(C5),
      '1כ · `revoke all` ל-' + t + ' משני התפקידים');
    assert(new RegExp('grant select, insert, update on public\\.' + t + ' to anon, authenticated;').test(C5),
      '1ל · `grant select, insert, update` בלבד ל-' + t);
    assert(new RegExp('alter table public\\.' + t + ' enable row level security;').test(C5),
      '1מ · RLS מופעל על ' + t);
  });
  assert(!/grant[^;]*\bdelete\b[^;]*to anon/i.test(C5) && !/grant[^;]*truncate[^;]*to anon/i.test(C5),
    '1נ · ⛔ אפס DELETE ואפס TRUNCATE ל-anon');

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
   2 · הכתיבה לשורות — חיווט, ו⛔ מה שהיא קובעת
   ══════════════════════════════════════════════════════════════════════════ */
/*  ⛔ הכתיבה הכפולה כובתה (סבב 78) — ⚠️ מה שנאכף כאן הפוך בדיוק: ⭐ שכבת
 *  השורות היא **הכתיבה**, ⛔ ואישור ה-⏳ ועֵד הפינוי נשענים עליה: ⚠️ עדות
 *  שנשענת על כתיבה אחרת מזו שקרתה היא ראיה למשהו שלא נמדד. */
const WIRING = [
  [/var HR_ROWS = true;/, '3ב · שכבת השורות פעילה (HR_ROWS=true)'],
  [/var _rAt=await pushTable\('hr_sessions',data\);/,
    '3ג · `atSaveData` כותבת לשורות, ⛔ ובלי כתיבה שנייה לערך שלם'],
  [/var r = await pushTable\('hr_students_rows', mergedSt\);/, '3ד · המצבה נדחפת לשורות ממסלול `hrPushToCloud`'],
  [/if\(!\(_rAt&&_rAt\.ok\)&&hrCount\(data\)\) \{ _hrQueueAdd\('hr_sessions',data\);/,
    '3ה · כתיבה שנכשלה חוזרת לתור — ⛔ ויש לה ניסיון חוזר'],
  [/if \(!kind\) return _hrCfgSetRaw\(key, value\);/,
    '3ה2 · ⭐ ריקון התור מנתב לפי היעד — מפתח שיש לו טבלה חוזר אליה'],
];
function t2() {
  console.log('\n2 · הכתיבה הכפולה');
  WIRING.forEach(([re, msg]) => assert(re.test(SRC), msg));
  /* ⛔ הטענה המרכזית התהפכה (סבב 78) — ⚠️ השורות **הן** השער: ⭐ אישור ה-⏳
     נשען על הצלחתן, ⛔ ואין עוד ערך שלם שאפשר להישען עליו.
     ⛔ **ועל השומר** (סבב 110) — ⚠️ המסלול פותח שתי המתנות, ⭐ ומשתמש
     שהתחלף באמצע היה מקבל לחשבונו את הצלחת הדחיפה של הקודם.
     ⚠️ ⛔ ועֵד הפינוי אינו נכתב כאן (סבב 102) — ⭐ שכבת הדחיפה המשותפת
     מסמנת אותו במעבר עצמו: ⛔ שני אתרי סימון לאותו עֵד הם שתי הכרעות
     על אותה ראיה. */
  noneIn(/hrCfgSet\('hr_sessions'|hrCfgSet\('hr_students_rows'|hrCfgSet\('hr_sleep_sessions'/, SRC,
    '3ו · ⛔ אין כתיבת ערך שלם למפתח שיש לו טבלה — מקור אמת אחד');
  someIn(/if\(_rAt&&_rAt\.ok&&!ctxStale\(_ep\)\) pendConfirmPush\(PK_AT_SESS,_t0\)/, SRC,
    '3ז · ⭐ אישור ה-⏳ תלוי בהצלחת הכתיבה לשורות');
  assert(/hr_sessions_rows/.test(SRC) && /hr_marks_rows/.test(SRC),
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

/*  ⛔ שכבת הדחיפה נטענת לצד שכבת השורות — ⚠️ הלולאה והמנה חיות בבלוק
 *  החתום, ⭐ והכתיבה עצמה בשכבת השורות: ⛔ רתמה שטוענת רק אחת מהן מודדת
 *  חצי מסלול. */
const PUSH_START = '/* ═══ שכבת הדחיפה — מודול משותף (סבב 102)';
const PUSH_END = '/* ═══════════════ סוף מודול שכבת הדחיפה';
function extractPush(src) {
  const cfg = src.indexOf('var PUSH_TABLES = ');
  const si = src.indexOf(PUSH_START);
  const ei = src.indexOf(PUSH_END);
  if (cfg < 0 || si < 0 || ei <= si) return '';
  return src.slice(cfg, si) + src.slice(si, src.indexOf('\n', ei) + 1);
}
const PUSH_MOD = extractPush(SRC);

/* רתמה: SB מזויף שרושם כל upsert, ו-`_hrRecTs` מינימלי. */
function harness(modSrc, opts) {
  const o = opts || {};
  const calls = [];
  const sandbox = {
    console, Date, Object, Array, Number, String, Math, isFinite, JSON, RegExp,
    withTimeout: (p) => p,
    pendHas: () => !!o.pending,
    PK_AT_SESS: 'at-sess:',
    // ⚠️ סבב 39 — `HR_ROWS_KINDS` נשענת על **שתי** הקידומות; בדף האמיתי
    //    שתיהן מוגדרות יחד, ולכן הרתמה חייבת לספק את שתיהן.
    PK_SL_SESS: 'sl-sess:',
    _hrRecTs: (r) => (r && r.updatedAt) || 0,
    /*  ⛔ עוזרי שכבת הדחיפה — ⚠️ הם חיים בבלוקים חתומים אחרים, ⭐ והרתמה
     *  מספקת אותם כדי שהשכבה תיטען לבדה. */
    Promise,
    _pushTimer: null,
    isNetErr: (e) => /net|fetch|timeout|failed to/i.test((e && (e.message || '')) + ''),
    pendClear: () => {},
    pendFailed: () => {},
    plTouch: () => {},
    /*  ⛔ שומר ההקשר — ⚠️ הוא חי בבלוק חתום אחר, ⭐ והרתמה מספקת אותו
     *  כדי ששכבת הדחיפה תיטען לבדה: ⛔ הקשר שאינו מתחלף בסביבת הדמה. */
    ctxEpoch: () => 0,
    ctxStale: () => false,
    rtyNote: () => {},
    _hrMarkPushed: () => {},
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
  if (PUSH_MOD) vm.runInContext(PUSH_MOD, sandbox);
  return { sandbox, calls };
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

  const row = sandbox.hrSessionRow(SESS);
  assert(row.client_id === '111' && row.updated_at === 900,
    '4ב · `client_id` של האב נגזר מ-`id`, והחותמת מ-`updatedAt`');
  assert(JSON.stringify(row.date_heb) === JSON.stringify(SESS.date_heb),
    '4ג · ⛔ `date_heb` נשמר כמות שהוא ואינו נגזר מחדש מ-`date_iso`');
  assert(row.created_by === 'u1' && row.created_at === SESS.created_at,
    '4ד · שדות המטא מועתקים אחד לאחד (ההעברה מועתקת, לא משוחזרת)');

  const marks = sandbox.hrMarkRows(SESS);
  /*  ⭐ התהפך בסבב 37א — מזהה תלמיד הוא uuid מסבב 37, ו-`student_id` הוא
      `text` מאז `008`. סימון שמפתחו אינו מספרי **חייב** להגיע לשכבת
      השורות; ⛔ דילוג כאן היה משמיט בשקט את כל הסימונים של כל תלמיד
      שנוסף מסבב 37 ואילך. */
  assert(marks.length === 3,
    '4ה · ⭐ סימון עם מפתח לא-מספרי (uuid) מגיע לשכבת השורות (' + marks.length + ' שורות)');
  assert(marks.length > 0 && marks.every((m) => typeof m.student_id === 'string'),
    '4ה2 · ⛔ `student_id` נשלח כמחרוזת — אין המרה מספרית על עמודת טקסט');
  assert(marks.some((m) => m.student_id === 'bad'),
    '4ה3 · והמפתח עצמו נשמר כמות שהוא, בלי עיגול ובלי NaN');
  assert(marks.length > 0 && marks.every((m) => m.client_id === '111:' + m.student_id),
    '4ו · `client_id` של הסימון נגזר ממפתח הזהות `<סדר>:<תלמיד>` ואינו uuid חדש');
  assert(marks.length > 0 && marks.every((m) => m.date_iso === '2026-05-17'),
    '4ט · `date_iso` משוכפל לכל שורת סימון');

  const st = sandbox.hrStudentRow({ id: 5, name: 'x', updatedAt: 7 });
  assert(st.client_id === '5' && st.student_id === '5' && st.data.name === 'x',
    '4י · שורת תלמיד — גוף הרשומה ב-`data`, ורק עמודות המיזוג מחוצה לו');
  const stU = sandbox.hrStudentRow({ id: 'a1b2-uuid', name: 'y', updatedAt: 7 });
  assert(stU.student_id === 'a1b2-uuid',
    '4י2 · ⭐ ותלמיד עם מזהה uuid מקבל `student_id` תקין ולא `null`');

  // סדר אב-לפני-בן, ובחירת מה לדחוף.
  const r = await sandbox.pushTable('hr_sessions', [SESS]);
  assert(r.ok === true && calls.length === 2, '4כ · דחיפה מוצלחת כותבת לשתי הטבלאות');

  const h2 = harness(extract(SRC), { remote: [{ client_id: '111', updated_at: 900 }] });
  const r2 = await h2.sandbox.pushTable('hr_sessions', [SESS]);
  assert(r2.ok === true && r2.n === 0 && h2.calls.length === 0,
    '4מ · סדר שכבר בענן באותה חותמת אינו נדחף שוב');

  const h3 = harness(extract(SRC), { remote: [{ client_id: '111', updated_at: 900 }], pending: true });
  const r3 = await h3.sandbox.pushTable('hr_sessions', [SESS]);
  assert(r3.n === 1, '4נ · ⛔ רשומה מסומנת ⏳ נדחפת תמיד');

  const h4 = harness(extract(SRC), { failOn: 'hr_marks' });
  const r4 = await h4.sandbox.pushTable('hr_sessions', [SESS]);
  assert(r4.ok === false, '4ס · כשל בכתיבת הבן מוחזר כ-`ok:false` — נכשל סגור');

  // ⚠️ מנות — הדחיפה הראשונה נוגעת בכל הסדרים, ו-13,083 שורות בבקשה אחת נדחות.
  const big = { ...SESS, id: '222', marks: {} };
  for (let i = 1; i <= 1200; i++) big.marks[String(i)] = { s: 'p', min: 0 };
  const hB = harness(extract(SRC), {});
  await hB.sandbox.pushTable('hr_sessions', [big]);
  const markCalls = hB.calls.filter((c) => c.table === 'hr_marks');
  assert(markCalls.length === 3 && markCalls.every((c) => c.rows.length <= 500),
    '4פ · 1,200 סימונים נדחפים ב-3 מנות של ≤500 — ⛔ ולא בבקשה אחת');

  const h5 = harness(extract(SRC), { remoteErr: { message: 'no table' } });
  const r5 = await h5.sandbox.pushTable('hr_sessions', [SESS]);
  assert(r5.ok === true && h5.calls.length === 2,
    '4ע · טבלה שטרם נוצרה / משיכה שנכשלה ⇒ בספק דוחפים (map=null)');
}


console.log('סבב 36 — מעבר הנהלה לטבלאות מובנות, שלב א');
t1(); t2();
await t3();

/*  ⛔ מכאן ולמטה מוטציות ובדיקות שלמות (סבב 92) — ⚠️ הן רצות ברמה
 *  המלאה בלבד: ⛔ הרמה המהירה עוצרת כאן עם קוד היציאה של הטענות
 *  שכבר רצו, ⭐ והכיסוי שלהן אינו יורד. */
mutStage();
if (!RUN_MUT) {
  console.log('\n⏭ test_tables: המוטציות רצות ברמה המלאה (--full) — ⛔ ואינן נמדדות כאן');
  process.exit(failed ? 1 : 0);
}
/* ══════════════════════════════════════════════════════════════════════════
   4 · מוטציות — כל טענה שאין מוטציה שמפילה אותה אינה שער
   ══════════════════════════════════════════════════════════════════════════ */
async function t4() {
  console.log('\n4 · מוטציות');

  // א. הסרת הכתיבה הכפולה מ-atSaveData.
  const mutA = SRC.replace("var _rAt=await pushTable('hr_sessions',data);",
                           "var _rAt=await hrCfgSet('hr_sessions',data);");
  assert(mutA !== SRC, '5א · המוטציה אכן מחזירה את הכתיבה לערך שלם');
  assert(!WIRING[1][0].test(mutA),
    '5ב · ⛔ מוטציה שמחזירה כתיבה לערך שלם נתפסת — טענת 3ג הייתה נכשלת');

  // ב. אינדקס חלקי במקום מלא.
  const mutB = M5.replace(
    'create unique index if not exists hr_marks_session_student\n  on public.hr_marks (session_client_id, student_id);',
    'create unique index if not exists hr_marks_session_student\n  on public.hr_marks (session_client_id, student_id) where not deleted;');
  assert(mutB !== M5, '5ג · המוטציה אכן מכניסה אינדקס חלקי');
  const idxB = sqlCode(mutB).match(/create (unique )?index[^;]*;/g) || [];
  assert(idxB.some((i) => /\bwhere\b/i.test(i)),
    '5ד · ⛔ מוטציה שמכניסה אינדקס חלקי נתפסת — טענת 1ו הייתה נכשלת (42P10)');

  /*  ו. החזרת הדילוג על מפתח לא-מספרי ב-`hrMarkRows` (סבב 37א) — זה
      הפיגום שהוסר כשהעמודה הפכה ל-`text`, ו⛔ החזרתו משמיטה בשקט את כל
      הסימונים של כל תלמיד שנוסף מסבב 37 ואילך. */
  const mutSkip = SRC.replace(
    "  Object.keys(marks).forEach(function (k) {\n",
    "  Object.keys(marks).forEach(function (k) {\n    if (!/^\\d+$/.test(k)) return;\n");
  assert(mutSkip !== SRC, '5יא · המוטציה אכן מחזירה את הדילוג המספרי');
  const hSkip = harness(extract(mutSkip), {});
  const marksSkip = hSkip.sandbox.hrMarkRows(SESS);
  assert(marksSkip.length === 2 && !marksSkip.some((m) => m.student_id === 'bad'),
    '5יב · ⛔ במוטנט הסימון עם ה-uuid נעלם — טענות 4ה/4ה3 היו נכשלות');

  // ה. הפיכת on conflict do nothing ל-do update.
  const mutD = M6.replace(/on conflict \(client_id\) do nothing/g,
    'on conflict (client_id) do update set updated_at = excluded.updated_at');
  assert(/do update/i.test(sqlCode(mutD)),
    '5י · ⛔ מוטציה שהופכת את ההעברה ל-`do update` נתפסת — טענת 2ב הייתה נכשלת');
}

await t4();
/*  ⭐ מוטציית-נגד: **קוד שנוסף** ⛔ אינו מפיל — ⚠️ הטענות מודדות את מפת
 *  הטבלאות ואת מסלול הכתיבה, ⛔ ולא את אורך הקובץ: ⭐ שער שהיה נופל על כל
 *  תוספת היה הופך כל עבודה באפליקציה להפרה. */
{
  const added = SRC + '\nfunction _ncTablesPing(){ return 1; }\nvar _ncTablesSeen = _ncTablesPing();\n';
  assert(added !== SRC &&
    (added.match(/hr_marks\b/g) || []).length === (SRC.match(/hr_marks\b/g) || []).length &&
    (added.match(/hr_sessions\b/g) || []).length === (SRC.match(/hr_sessions\b/g) || []).length,
    'נ1 · ⭐ מוטציית-נגד: קוד שנוסף ⛔ אינו משנה את מפת הטבלאות הנמדדת');
}

console.log(failed ? '\n✗ ' + failed + ' טענות נכשלו' : '\n✓ סבב 36 — כל הטענות עברו');
process.exit(failed ? 1 : 0);
