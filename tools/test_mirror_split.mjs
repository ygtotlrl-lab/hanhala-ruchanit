#!/usr/bin/env node
/*  test_mirror_split.mjs — שכבת המראה מפורקת לשורות, וארבעת מקרי המיזוג
 *  (סבב 116).
 *
 *  **מה נאכף:** (א) שבע טבלאות המראה מוצהרות והפירוק וההרכבה עוברים
 *  באותן שלוש פונקציות; (ב) ארבעת מקרי המיזוג — סימון אופליין ששרד ·
 *  סימון שנמחק ואינו חוזר · שני מכשירים על אותו סדר · וסדר שנמחק;
 *  (ג) ההגירה המקומית אידמפוטנטית וקוראת לפני שהיא מוחקת.
 *
 *  **הנימוק המדוד:** עד סבב 116 המיזוג היה על **כל אובייקט הסימונים**,
 *  ⚠️ ולכן שני מכשירים שסימנו תלמידים שונים באותו סדר — אחד מהם איבד את
 *  כל סימוניו: ⭐ ומקרה ג הוא מה שמוכיח שהפיצול פתר זאת.
 *
 *  **מה יישבר בלעדיו:** מיזוג פר-סימון שאין לו מצבות מחיקה מחזיר סימון
 *  שנמחק בכל מחזור, ⛔ ומיזוג ברמת הרשומה מוחק עבודה שלא נגעו בה.
 *
 *  **מה אינו נאכף כאן:** ⛔ חוזה הענן — `ysMarkRows` חותמת בחותמת האב,
 *  ⚠️ וזה נמדד בשער שכבת השורות.
 *
 *  הקובץ מריץ את **הקוד החי** (נחתך מ-`index.html` בהתאמת סוגריים)
 *  ברתמת `vm`, מעל `localStorage` מדומה.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* ── APP — הדבר היחיד שנבדל בין הריפו ──────────────────────────────────── */
const APP = {
  /*  ⚠️ רצפת הטענות — ⛔ פחות מזה פירושו שהתהליך נסגר באמצע. */
  expected: 12,
  app: 'hanhala-ruchanit',
  /*  ⛔ שער פרטי להנהלה — ⚠️ **היא היחידה שרשומתה נושאת מפה של סימונים**:
   *  ⭐ בשלוש האחרות אין רשומה שמתפרקת לשורות בן, ⛔ ואין מה למדוד. */
  tables: ['ys_sessions', 'ys_marks', 'ys_sleep_sessions', 'ys_sleep_marks',
           'ys_students_rows', 'ys_settings', 'ys_users'],
  stream: 'ys_sessions',
  child: 'ys_marks',
  names: ['mirrorKey', 'mirrorTables', 'mirrorLoadOne', 'mirrorLoad', 'mirrorSave',
          'mirrorWrite', 'mirrorBoot',
          'ysRecsFromRows', 'ysMirrorRecs', '_ysMarkSame', '_ysSplitRecs',
          'ysMirrorPutRecs', 'ysMirrorWriteRecs', '_ysCfgRows', 'ysCfgLocalGet',
          'ysCfgLocalSet', 'ysMarkTombs',
          '_ysRowSet', 'ysSessionRow', 'ysMarkRows', 'ysStudentRow',
          '_ysRecTs', '_ysRecId', 'ysRecTs', 'tombStamp', 'prunePastTombstones',
          'tombPruneMerged', '_mergePick', 'mergeCore', 'ysMergeRecords',
          'ysPendingFor', 'ysMarks', 'ysMarkTs', 'ysMergeMarks', 'ysSessionPairFor',
          'ysMergeWithDropLog', '_ysSessionsMerge', 'hwDiskFilter', 'lsSetArray',
          'lsSet', 'lsGet', 'uniqList', 'uniqKeyOf'],
  vars: ['var MIRROR = ', 'var YS_MIRROR_TABLES = ', 'var YS_MIRROR_STREAMS = ',
         'var YS_ROWS_KINDS = ', 'var PEND_KV_PREFIX = ', 'var TOMBSTONE_TTL_MS = ',
         'var _tombPrunePending = ', 'var MIRROR_CFG = ', 'var PUSH_TABLES = '],
  globals: { PK_AT_SESS: 'at-sess:', PK_SL_SESS: 'sl-sess:', PK_STUDENT: 'student:',
             PK_AT_TREAT: 'at-treat:', PK_SL_TREAT: 'sl-treat:' },
};

/* ── סוף APP ───────────────────────────────────────────────────────────── */

/*  ⛔ הרשימה ריקה — ⚠️ שכבת המראה נאכפת בשער היכולות המרוכז, ⭐ ומה
 *  שנמדד כאן הוא **ההתנהגות**: ⛔ טענה נאכפת במקום אחד. */
export const ROWS = [];

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');

/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה המהירה, ⛔ ופחות ממנה הוא
 *  כשל — ⚠️ והמאזין על `exit` תופס גם יציאה שקדמה להמתנה. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
const EXPECTED = APP.expected;
let RAN = 0;
let failed = 0;
/*  ⛔ הדגל נלכד ברישום ⛔ ולא בסגירה — ⚠️ שער שמריץ שער אחר מציב אותו
 *  **אחרי** הרישום, ⭐ ולכן הוא חל על הילד ⛔ ולא על עצמו. */
const SUBRUN = !!process.env.GATE_SUBRUN;
/*  ⛔ הריצפה נמדדת בשני הכיוונים (סבב 118) — ⚠️ **מה נכנס**: מספר הטענות
 *  שרצו; ⛔ **ומה מפיל**: פחות מהמוצהר — ריצה חלקית — ⛔ ויותר ממנו —
 *  ריצפה מיושנת. ⭐ **ולמה שני הכיוונים**: ריצפה שאינה מתעדכנת מפסיקה
 *  למדוד את מה שנוסף. ⚠️ **והתקרה ברמה המהירה בלבד** — ⛔ המוטציות
 *  מוסיפות טענות בכוונה, ⭐ ושער שמספרו משתנה גם בלעדיהן מוכרז
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
  console.log(`רצו ${RAN} מתוך ${EXPECTED}`);
  if (RAN < EXPECTED) {
    console.error(`❌ ${GATE_ID}: רצו ${RAN} טענות מתוך ${EXPECTED} מוצהרות — ` +
      'מה עושים: ודא `await` בקריאה הראשית, ⛔ ויציאה שאינה קודמת להמתנה.');
    process.exitCode = 1;
  } else if (RAN > FLOOR_MAX && process.env.GATE_MUT !== '1') {
    console.error(`❌ ${GATE_ID}: רצו ${RAN}, והריצפה ${EXPECTED} — ` +
      'עדכן את `EXPECTED`.');
    process.exitCode = 1;
  }
});
const ok = (m) => (RAN++, console.log('  ok   ' + m));
const bad = (m) => { RAN++; failed++; console.error('  FAIL ' + m); };
const assert = (cond, m) => (cond ? ok(m) : bad(m));

/* ── חיתוך פונקציה מהמקור לפי שם, בהתאמת סוגריים ───────────────────────── */
function cut(name, src) {
  const re = new RegExp('\\n(async )?function ' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('הפונקציה ' + name + ' לא נמצאה ב-index.html');
  const start = m.index + 1;
  let i = src.indexOf('{', m.index + m[0].length - 1), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(start, i + 1); }
  }
  throw new Error('הפונקציה ' + name + ' אינה סגורה');
}
function cutVar(decl, src) {
  const i = src.indexOf('\n' + decl);
  if (i < 0) throw new Error('ההצהרה «' + decl + '» לא נמצאה');
  let d = 0, q = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ';' && d === 0) return src.slice(i + 1, j + 1);
  }
  throw new Error('ההצהרה «' + decl + '» אינה נסגרת');
}

/*  רתמה: `localStorage` מדומה, `lsSet`/`lsGet` האמיתיים, וכל שכבת המראה
 *  החיה מעליהם.                                                          */
function harness(seed) {
  const store = Object.assign({}, seed || {});
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i],
  };
  const sandbox = {
    console, JSON, Date, Math, String, Number, Array, Object, Boolean,
    isFinite, parseInt, parseFloat, Promise, RegExp, Error,
    localStorage, window: {},
    pendHas: () => false, pendIs: () => false,
    ysWriteFail: () => {},
    lsToast: () => {}, lsLog: () => {},
    hwNoteCloud: () => {},
    hwEnabled: () => false,
    lsHorizon: () => 0,
    lsHzSet: () => {},
    _store: store,
  };
  Object.assign(sandbox, APP.globals);
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const v of APP.vars) vm.runInContext(cutVar(v, SRC), sandbox);
  for (const n of APP.names) vm.runInContext(cut(n, SRC), sandbox, { filename: n + '.js' });
  return sandbox;
}

const rec = (id, ts, marks, extra) =>
  Object.assign({ id: String(id), date_iso: '2026-01-0' + (Number(id) % 9 + 1),
                  session: 's', updatedAt: ts, marks: marks || {} }, extra || {});

console.log('· ' + APP.app + ' — סבב 116: פיצול המראה וארבעת מקרי המיזוג');

/* ── 1 · שבע הטבלאות, והפירוק וההרכבה מאותן פונקציות ───────────────────── */
{
  const sb = harness();
  const tabs = sb.mirrorTables();
  assert(tabs.length === APP.tables.length && APP.tables.every((t) => tabs.indexOf(t) >= 0),
    '1א · ⛔ שבע טבלאות המראה מוצהרות — נמדד ' + tabs.length + ' מתוך ' + APP.tables.length);
  const split = cut('_ysSplitRecs', SRC);
  const three = ['ysSessionRow', 'ysMarkRows', 'ysStudentRow'].filter((n) => split.indexOf(n + '(') >= 0 || split.indexOf('(' + n + ')') >= 0 || split.indexOf('map(' + n + ')') >= 0);
  assert(three.length === 3,
    '1ב · ⛔ הפירוק עובר בשלוש הפונקציות הקיימות — נמדד ' + three.length + ' מתוך 3');
  const asm = cut('ysMirrorRecs', SRC);
  assert(/ysRecsFromRows\(/.test(asm) && /ysRecsFromRows\(/.test(cut('ysRowsGetSessions', SRC)),
    '1ג · ⛔ ההרכבה אחת למראה ולענן — `ysRecsFromRows` בשני המסלולים');
}

/* ── 2 · כתיבה ⟵ שורות, קריאה ⟵ רשומות ─────────────────────────────────── */
{
  const sb = harness();
  sb.mirrorLoad();
  sb.ysMirrorPutRecs('ys_sessions', [rec(1, 1000, { a: { s: 'p', min: 0 }, b: { s: 'l', min: 5 } })]);
  const rows = JSON.parse(sb._store['ys_mirror_marks']);
  assert(rows.length === 2 && rows.every((r) => r.client_id && r.session_client_id === '1'),
    '2א · ⛔ הסימונים נכתבים כשורות ב-`ys_mirror_marks` — נמדד ' + rows.length);
  const back = sb.ysMirrorRecs('ys_sessions');
  assert(back.length === 1 && Object.keys(back[0].marks).length === 2 && back[0].marks.b.min === 5,
    '2ב · ⛔ וההרכבה מחזירה את אותה רשומה — 24 אתרי הקריאה אינם משתנים');
  const empty = sb.ysMarks({ id: '1' });
  assert(Object.keys(empty).length === 2,
    '2ג · ⛔ ו-`ysMarks` בונה מ-`MIRROR.ys_marks` כשהרשומה חסרה סימונים');
}

/* ── 3 · ארבעת מקרי המיזוג ─────────────────────────────────────────────── */
function caseSetup(localRecs) {
  const sb = harness();
  sb.mirrorLoad();
  sb.ysMirrorPutRecs('ys_sessions', localRecs);
  return sb;
}
/*  מקרה א — סימון שנרשם אופליין ב-08:00 ועלה ב-14:00: ⛔ שורד,
 *  ⚠️ ואינו דורס סימון אחר שנרשם ב-10:00.                                */
{
  const sb = caseSetup([rec(1, 800, { a: { s: 'p', min: 0 } })]);
  const cloud = [rec(1, 1000, { b: { s: 'e', min: 0 } })];
  const out = sb._ysSessionsMerge(cloud, sb.ysMirrorRecs('ys_sessions'), 'ys_sessions');
  const m = out[0].marks;
  assert(m.a && m.a.s === 'p' && m.b && m.b.s === 'e',
    '3א · ⛔ מקרה א: הסימון שנרשם אופליין שורד ⛔ ואינו דורס את זה שמ-10:00');
}
/*  מקרה ב — סימון שנמחק אינו חוזר, גם במחזור שני.                        */
{
  const sb = caseSetup([rec(1, 800, { a: { s: 'p', min: 0 }, b: { s: 'l', min: 5 } })]);
  sb.ysMirrorPutRecs('ys_sessions', [rec(1, 900, { a: { s: 'p', min: 0 } })]);
  const tombs = sb.ysMarkTombs('ys_sessions', '1');
  const cloud = [rec(1, 850, { a: { s: 'p', min: 0 }, b: { s: 'l', min: 5 } })];
  const one = sb._ysSessionsMerge(cloud, sb.ysMirrorRecs('ys_sessions'), 'ys_sessions');
  assert(tombs.b > 0 && !one[0].marks.b,
    '3ב · ⛔ מקרה ב: סימון שנמחק אינו חוזר מהענן — מצבת המחיקה גוברת');
  sb.ysMirrorPutRecs('ys_sessions', one);
  const two = sb._ysSessionsMerge(cloud, sb.ysMirrorRecs('ys_sessions'), 'ys_sessions');
  assert(!two[0].marks.b,
    '3ג · ⛔ וגם במחזור שני — ⚠️ המצבה נשמרת בשורות ואינה נעלמת');
}
/*  מקרה ג — שני מכשירים על אותו סדר: תלמידים שונים ⟵ שניהם שורדים,
 *  אותו תלמיד ⟵ החדש מנצח.                                              */
{
  const sb = caseSetup([rec(1, 800, { a: { s: 'p', min: 0 } })]);
  const cloud = [rec(1, 1000, { b: { s: 'e', min: 0 } })];
  const out = sb._ysSessionsMerge(cloud, sb.ysMirrorRecs('ys_sessions'), 'ys_sessions');
  assert(Object.keys(out[0].marks).length === 2,
    '3ד · ⛔ מקרה ג: שני מכשירים, תלמידים שונים — **שניהם שורדים**');
  const sb2 = caseSetup([rec(1, 800, { a: { s: 'p', min: 0 } })]);
  const cloud2 = [rec(1, 1000, { a: { s: 'e', min: 0 } })];
  const out2 = sb2._ysSessionsMerge(cloud2, sb2.ysMirrorRecs('ys_sessions'), 'ys_sessions');
  assert(out2[0].marks.a.s === 'e',
    '3ה · ⚠️ ואותו תלמיד בשניהם — החדש מנצח');
}
/*  מקרה ד — סדר שנמחק: סימוניו יורדים איתו ואינם נשארים יתומים.          */
{
  const sb = caseSetup([rec(1, 800, { a: { s: 'p', min: 0 } })]);
  sb.ysMirrorPutRecs('ys_sessions', [rec(1, 900, { a: { s: 'p', min: 0 } }, { deleted: true })]);
  const rows = JSON.parse(sb._store['ys_mirror_marks']);
  const recs = sb.ysMirrorRecs('ys_sessions');
  assert(rows.every((r) => r.deleted === true) && Object.keys(recs[0].marks).length === 0,
    '3ו · ⛔ מקרה ד: סדר שנמחק — סימוניו מסומנים מחוקים ואינם יתומים');
}

/* ── מוטציה ומוטציית-נגד ───────────────────────────────────────────────── */
const RUN_MUT = process.env.GATE_MUT === '1';
if (RUN_MUT) {
  /*  ⛔ המוטציה שוברת את **המנגנון**: ⚠️ הזוג פר-סימון יורד, ⭐ והמיזוג
   *  חוזר לרמת הרשומה — ⛔ ומקרה ג נופל. */
  const muted = SRC.replace(
    "var pair = YS_MIRROR_STREAMS[logKey] ? ysSessionPairFor(logKey) : null;",
    "var pair = null;");
  if (muted === SRC) { bad('מוטציה · לא נמצא אתר המוטציה'); }
  else {
    const sb = harness();
    const saveSrc = SRC;
    const runWith = (text) => {
      const sandbox = harness();
      for (const n of ['ysSessionPairFor', '_ysSessionsMerge'])
        vm.runInContext(cut(n, text), sandbox, { filename: n + '.js' });
      sandbox.mirrorLoad();
      sandbox.ysMirrorPutRecs('ys_sessions', [rec(1, 800, { a: { s: 'p', min: 0 } })]);
      return sandbox._ysSessionsMerge([rec(1, 1000, { b: { s: 'e', min: 0 } })],
        sandbox.ysMirrorRecs('ys_sessions'), 'ys_sessions');
    };
    const fell = Object.keys(runWith(muted)[0].marks).length === 1;
    assert(fell, 'מוטציה · ⛔ הסרת הזוג פר-סימון מפילה את «מקרה ג» — טענה 3ד');
    /*  ⛔ מוטציית-נגד — שינוי חי שאסור לו להפיל: שם משתנה שהוחלף בעקביות. */
    const counter = SRC.replace(/var pair = YS_MIRROR_STREAMS\[logKey\]/,
                                'var _pairFn = YS_MIRROR_STREAMS[logKey]')
                       .replace(/keepLocal, logKey \|\| 'sessions', pair\)/,
                                "keepLocal, logKey || 'sessions', _pairFn)");
    const held = Object.keys(runWith(counter)[0].marks).length === 2;
    assert(held, 'מוטציית-נגד · ⚠️ שם שהוחלף בעקביות אינו מפיל');
  }
}

if (failed) { console.error('❌ ' + GATE_ID + ': ' + failed + ' טענות נפלו'); process.exitCode = 1; }
else console.log('✅ ' + GATE_ID);
