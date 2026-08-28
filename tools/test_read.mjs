#!/usr/bin/env node
/*  test_read.mjs — סבב 55: מתג המעבר — מקור הקריאה.
 *
 *  שלושה חלקים:
 *    1. חילוץ בלוק «שלב ב — מקור הקריאה עובר לטבלאות» מ-index.html והרצתו
 *       ברתמת vm מול מסד מזויף — שחזור הרשומה, כלל הסימון שנמחק,
 *       הנפילה-חזרה ל-kv, וההימנעות ממנה כשיש שורות.
 *    2. טענות סטטיות: משפך אחד, ורשת הביטחון של ה-kv עדיין דלוקה.
 *    3. מוטציות — כל התנהגות שהופכה חייבת להפיל טענה.
 *
 *  ⚠️ **טריגר להסרה (⏳ מבחן מעבר) — סבב 68, כלל ברזל 14:** זהו מבחן **מעבר** — מסלול הקריאה עבר לטבלאות.
 *  ⛔ הוא יורד בסבב שסוגר את מסלול ה-`kv`: כיבוי דגל הכתיבה ← מחיקת
 *  מפתחות ה-`kv` מהמסד ← ואז המבחן הזה ושורתו ב-`APP.testsOnly`.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* ── APP — הדבר היחיד שנבדל בין הריפו ──────────────────────────────────── */
const APP = {
  // המפתחות שעברו לטבלאות, ואתרי הקריאה שחייבים לעבור דרך המשפך.
  keys: ['ys_attend_sessions', 'ys_students'],
  funnel: 'ysCloudGet',
  rawGet: 'ysKvGet',
  legacyFlag: /var YS_KV_LEGACY_WRITE = true;/,
  minCallSites: 6,
};
/* ── סוף APP ───────────────────────────────────────────────────────────── */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failed++; console.error('  FAIL ' + m); };
const assert = (c, m) => (c ? ok(m) : bad(m));

const START = 'שלב ב — מקור הקריאה עובר לטבלאות (סבב 55)';
const END = '/* ═══ סוף שכבת השורות';
function extract(src) {
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i < 0 || j < 0 || j < i) return null;
  return src.slice(src.lastIndexOf('/*', i), j);
}

/* רתמה: מסד מזויף שמחזיר את מה שהתרחיש קבע, ו-`ysKvGet` שסופר קריאות. */
function run(block, tables, kvValue, opts) {
  opts = opts || {};
  const log = { kv: 0, sel: [] };
  const sb = {
    from(t) {
      return {
        select(cols) {
          // ⚠️ הרתמה מדמה גם את החלוקה לעמודים — `range` חותך, בדיוק כמו
          //    PostgREST, ולכן טענת «העמוד השני נמשך» נמדדת ולא מוצהרת.
          const q = {
            order() { return q; },
            range(a, b) {
              log.sel.push(t + ':' + a);
              const v = tables[t];
              if (v === 'error') return Promise.resolve({ error: { message: 'x' } });
              if (v === 'throw') return Promise.reject(new Error('net'));
              return Promise.resolve({ data: (v || []).slice(a, b + 1) });
            },
            then(res, rej) {
              log.sel.push(t);
              const v = tables[t];
              if (v === 'error') return Promise.resolve({ error: { message: 'x' } }).then(res, rej);
              if (v === 'throw') return Promise.reject(new Error('net')).then(res, rej);
              return Promise.resolve({ data: v || [] }).then(res, rej);
            }
          };
          return q;
        }
      };
    }
  };
  const ctx = {
    SB: sb,
    YS_ROWS: true,
    YS_ROWS_KINDS: { attend: { parent: 'ys_sessions', child: 'ys_marks', pk: 'at-sess:', note: false } },
    withTimeout: (p) => Promise.resolve(p),
    ysKvGet: () => { log.kv++; return Promise.resolve(kvValue); },
    console,
    log
  };
  vm.createContext(ctx);
  vm.runInContext(block + '\nthis.__api = { ysCloudGet, ysRowsGet, ysRowsGetSessions, ysRowsGetStudents };', ctx);
  return { api: ctx.__api, log, ctx };
}

const SESS = (over) => Object.assign({
  client_id: 'S1', session: 'נגלה בוקר', date_iso: '2026-08-20', date_heb: { d: 1 },
  filled_by: 3, filled_by_name: 'א', created_at: '2026-08-20T05:00:00Z',
  created_by: 'u1', deleted_by: null, open: true, deleted: false, updated_at: 1000
}, over || {});
const MARK = (over) => Object.assign({
  session_client_id: 'S1', student_id: 'st-1', status: 'p', minutes: 0,
  deleted: false, updated_at: 1000
}, over || {});

async function scenarios(block, label) {
  const res = { };
  // א. שחזור מלא
  {
    const { api, log } = run(block, { ys_sessions: [SESS()], ys_marks: [MARK(), MARK({ student_id: 'st-2', status: 'l', minutes: 10 })] }, null);
    const out = await api.ysCloudGet('ys_attend_sessions');
    res.rebuild = out;
    res.kvTouched = log.kv;
  }
  // ב. סימון מחוק ⇐ מדולג
  {
    const { api } = run(block, { ys_sessions: [SESS()], ys_marks: [MARK({ deleted: true })] }, null);
    res.delMark = (await api.ysCloudGet('ys_attend_sessions'))[0].marks;
  }
  // ג. סימון שחותמתו ישנה מהאב ⇐ מדולג (סימון שנמחק מהמפה)
  {
    const { api } = run(block, { ys_sessions: [SESS({ updated_at: 2000 })], ys_marks: [MARK({ updated_at: 1000 }), MARK({ student_id: 'st-9', updated_at: 2000 })] }, null);
    res.staleMark = (await api.ysCloudGet('ys_attend_sessions'))[0].marks;
  }
  // ד. סדר מחוק ⇐ tombstone נשמר
  {
    const { api } = run(block, { ys_sessions: [SESS({ deleted: true })], ys_marks: [] }, null);
    res.tomb = (await api.ysCloudGet('ys_attend_sessions'))[0];
  }
  // ה. כשל טבלה ⇐ נפילה-חזרה ל-kv
  {
    const { api, log } = run(block, { ys_sessions: 'error' }, [{ id: 'KV' }]);
    res.onError = await api.ysCloudGet('ys_attend_sessions');
    res.onErrorKv = log.kv;
  }
  // ו. טבלה ריקה ⇐ נפילה-חזרה ל-kv
  {
    const { api, log } = run(block, { ys_sessions: [], ys_marks: [] }, [{ id: 'KV' }]);
    res.onEmpty = await api.ysCloudGet('ys_attend_sessions');
    res.onEmptyKv = log.kv;
  }
  // ז. מפתח שלא עבר ⇐ ישר ל-kv, בלי לגעת בטבלאות
  {
    const { api, log } = run(block, {}, [{ id: 'KV' }]);
    res.passthru = await api.ysCloudGet('ys_sleep_sessions');
    res.passthruSel = log.sel.length;
  }
  // ח2. יותר מעמוד אחד ⇐ נמשכים כל העמודים
  {
    const many = [];
    for (let i = 0; i < 1200; i++) many.push(MARK({ student_id: 'st-' + i }));
    const { api } = run(block, { ys_sessions: [SESS()], ys_marks: many }, null);
    const out = await api.ysCloudGet('ys_attend_sessions');
    res.paged = out[0] ? Object.keys(out[0].marks).length : 0;
  }
  // ח. המצבה — `data` מועתקת כמות שהיא
  {
    const { api } = run(block, { ys_students_rows: [{ client_id: 'x', updated_at: 5, deleted: false, data: { id: 'x', name: 'ב' } }] }, null);
    res.students = await api.ysCloudGet('ys_students');
  }
  return res;
}

const block = extract(SRC);
console.log('— סבב 55: מקור הקריאה —');
assert(!!block, '1 · בלוק מעבר הקריאה מחולץ מ-index.html');
if (!block) { process.exit(1); }

const r = await scenarios(block);
const rec = r.rebuild && r.rebuild[0];
assert(Array.isArray(r.rebuild) && r.rebuild.length === 1, '2א · הקריאה מחזירה מערך רשומות מהטבלאות');
assert(rec && rec.id === 'S1' && rec.session === 'נגלה בוקר' && rec.date_iso === '2026-08-20',
  '2ב · שדות האב משוחזרים אחד לאחד');
assert(rec && rec.createdBy === 'u1' && rec.filled_by === 3 && rec.open === true && rec.updatedAt === 1000,
  '2ג · ⚠️ שמות ה-kv חוזרים (createdBy/updatedAt) ולא שמות העמודות');
assert(rec && !('deleted_by' in rec) && !('deletedBy' in rec),
  '2ד · ⛔ שדה `null` בטבלה אינו נכתב לרשומה — צורת הרשומה נשמרת');
assert(rec && rec.marks && rec.marks['st-1'] && rec.marks['st-1'].s === 'p' &&
       rec.marks['st-2'] && rec.marks['st-2'].min === 10, '2ה · הסימונים חוזרים למפה `{s,min}`');
assert(r.kvTouched === 0, '2ו · ⛔ ומסלול ה-kv לא נגע כשיש שורות');
assert(r.delMark && Object.keys(r.delMark).length === 0, '3א · סימון מחוק אינו חוזר');
assert(r.staleMark && !r.staleMark['st-1'] && !!r.staleMark['st-9'],
  '3ב · ⭐ סימון שחותמתו ישנה מהאב אינו חוזר — הכלל שמונע תחיית סימון שנמחק');
assert(r.tomb && r.tomb.deleted === true, '3ג · ⛔ tombstone של סדר נשמר — היעדר רשומה אינו מחיקה');
assert(Array.isArray(r.onError) && r.onError[0] && r.onError[0].id === 'KV' && r.onErrorKv === 1,
  '4א · כשל טבלה ⇐ נפילה-חזרה ל-kv');
assert(Array.isArray(r.onEmpty) && r.onEmpty[0] && r.onEmpty[0].id === 'KV' && r.onEmptyKv === 1,
  '4ב · טבלה ריקה ⇐ נפילה-חזרה ל-kv (⛔ «ריק» אינו ראיה)');
assert(Array.isArray(r.passthru) && r.passthru[0].id === 'KV' && r.passthruSel === 0,
  '4ג · מפתח שלא עבר נקרא מ-kv בלי לגעת בטבלאות');
assert(r.paged === 1200,
  '5א · ⛔ שליפה בעמודים — 1,200 שורות סימון חוזרות במלואן (' + r.paged + ')');
assert(Array.isArray(r.students) && r.students[0] && r.students[0].name === 'ב',
  '5ב · המצבה מוחזרת מ-`data` כמות שהיא');

console.log('— טענות סטטיות —');
const code = SRC;
let direct = 0;
for (const k of APP.keys) {
  const re = new RegExp(APP.rawGet + "\\('" + k + "'\\)", 'g');
  direct += (code.match(re) || []).length;
}
assert(direct === 0, '6א · ⛔ אין קריאה ישירה ל-' + APP.rawGet + ' למפתח שעבר — משפך אחד');
const sites = (code.match(new RegExp(APP.funnel + '\\(', 'g')) || []).length;
assert(sites >= APP.minCallSites, '6ב · ' + APP.funnel + ' משמשת ב-' + sites + ' אתרים (≥' + APP.minCallSites + ')');
assert(APP.legacyFlag.test(code), '6ג · ⛔ רשת הביטחון של ה-kv עדיין דלוקה — הכתיבה הכפולה לא כובתה');
assert(/return ysKvGet\(kvKey\);/.test(block), '6ד · הנפילה-חזרה ל-kv קיימת בגוף המשפך');

console.log('— מוטציות —');
async function mut(find, repl, key, name) {
  const b = block.replace(find, repl);
  if (b === block) { bad('מוטציה לא הוחלה: ' + name); return; }
  let res = null;
  try { res = await scenarios(b); } catch (e) { res = null; }
  assert(key(res), 'מוטציה: ' + name);
}
await mut('if ((Number(m.updated_at) || 0) < rec.updatedAt) return;', '',
  (x) => !x || !!(x.staleMark && x.staleMark['st-1']),
  '⛔ ביטול כלל החותמת מחזיר סימון שנמחק');
await mut('if (!m || m.deleted) return;', 'if (!m) return;',
  (x) => !x || !!(x.delMark && Object.keys(x.delMark).length),
  '⛔ קבלת סימון מחוק מחזירה אותו למפה');
await mut('if (r.deleted) rec.deleted = true;', '',
  (x) => !x || !(x.tomb && x.tomb.deleted === true),
  '⛔ השמטת ה-tombstone מאבדת מחיקה');
await mut('Array.isArray(r.data) && r.data.length', 'Array.isArray(r.data)',
  (x) => !x || !(Array.isArray(x.onEmpty) && x.onEmpty[0] && x.onEmpty[0].id === 'KV'),
  '⛔ «טבלה ריקה = ראיה» מבטל את הנפילה-חזרה');
await mut('if (res.data.length < YS_ROWS_PAGE) return out;', 'return out;',
  (x) => !x || x.paged !== 1200,
  '⛔ ויתור על העמוד השני מחזיר תמונה חתוכה בשקט');
await mut('_ysRowSet(rec, \'createdBy\', r.created_by);', '',
  (x) => !x || !(x.rebuild && x.rebuild[0] && x.rebuild[0].createdBy === 'u1'),
  '⛔ השמטת שדה אב נתפסת');
// מוטציית-נגד: שינוי שאינו נוגע להתנהגות אינו מפיל דבר
{
  const b = block.replace("label: 'סדרי נוכחות'", "label: 'סדרי נוכחות '");
  const x = await scenarios(b === block ? block : b);
  assert(x.rebuild && x.rebuild[0].id === 'S1' && x.onErrorKv === 1,
    'מוטציית-נגד: שינוי שאינו התנהגותי אינו מפיל טענה');
}

console.log(failed ? `\n✗ סבב 55 (מקור הקריאה) — ${failed} נכשלו` : '\n✓ סבב 55 (מקור הקריאה) — כל הטענות עברו');
process.exit(failed ? 1 : 0);
