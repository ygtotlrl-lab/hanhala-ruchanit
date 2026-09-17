/* ══════════════════════════════════════════════════════════════════════════
   test_kvmeta.mjs — שכבת החותמת הפר-מפתחית: הנכשל-סגור, החיווט והמיגרציה
   ══════════════════════════════════════════════════════════════════════════
   **מה נאכף:** ⛔ חותמת פר-מפתח **נכשלת סגור ומחזירה 0** — ⚠️ «אין ראיה
   שהענן חדש יותר», ⛔ ולא «הענן חדש» ⛔ ולא «הענן ריק»; ⚠️ ולצידה החיווט
   שמוביל אליה ⛔ וצורת המיגרציה שמוסיפה את העמודה, במי שיש לו כזו.

   **הנימוק המדוד:** ⛔ נמדד ביומן שמשיכת מפת החותמות שנכשלה חזרה למיזוג
   כמפה ריקה — ⚠️ והמיזוג קרא אותה כ«הענן אינו מכיר»: ⭐ עריכה מקומית
   שחותמתה 0 נדרסה בעותק ענני ישן, ⛔ ומפתח שנמחק בענן חזר ונדחף אליו.

   **מה יישבר בלעדיו:** ⛔ אימוץ ערך מרוחק על סמך **כשל** הוא הסקה ולא
   ראיה — ⚠️ והוא דורס עריכה מקומית בלי סימן, ⭐ ומחזיר מחיקה שכבר התפשטה.

   **מה אינו נאכף כאן:** ⛔ השער קורא **קבצים** ⛔ ואינו רואה את המסד החי —
   ⚠️ מיגרציה שנכתבה ולא רצה עוברת אותו במלואה, ⭐ ומצב ההרצה נמדד מול
   המסד בשער אחר; ⛔ **ואין כאן מדידה של אפליקציה שאין בה שכבה כזו** —
   ⚠️ ההיעדר מוצהר ב-`APP.kvMeta` שבבודק המרוכז ונמדד שם משני צדדיו.
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

/* ── APP — הדבר היחיד שנבדל בין הריפו ──────────────────────────────────── */
const APP = {
  app: 'hanhala-ruchanit',
  /*  ⛔ שכבת החותמת הפר-מפתחית — ⚠️ **מה נכנס**: שם הטבלה שהחותמת יושבת
   *  בה ⟵ ומספר האתרים שנוקבים בשמה במקור; ⛔ **ומה מפיל**: אתר שנוסף או
   *  ירד בלי שהמספר עודכן. ⭐ **ולמה המבנה קיים**: שם שהוסב במקום אחד
   *  בלבד משאיר את השאר קוראים שכבה שאינה קיימת. */
  kvMeta: { table: 'hr_settings_meta', sites: 8 },
  /*  ⛔ נקודת המעבר של החותמת — ⚠️ **מה נכנס**: שם הפונקציה · תלויותיה ·
   *  ומסלול הקלט שלה; ⛔ **ומה מפיל**: שם שאין לו גוף במקור. ⭐ **ומסלול
   *  `fetch-key`**: הפונקציה מושכת בעצמה את השורה של המפתח — ⚠️ החותמת
   *  כאן היא עמודה בשורת ההגדרה, ⛔ ואין מפה שנמשכת בבת אחת. */
  stamp: {
    fn: 'hrCfgUpdatedAt',
    deps: [],
    kind: 'fetch-key',
    wired: [
      ['rts\\s*=\\s*await hrCfgUpdatedAt\\(sk\\.key\\)',
       'צד הדחיפה קורא את החותמת מהעמודה — בלי תנאי ובלי מפה'],
      ['remoteMeta\\[_mk\\]\\s*=\\s*await hrCfgUpdatedAt\\(_mk\\)',
       'וגם צד המשיכה קורא מהעמודה — ⛔ ולא ממפה שהיא `{}` בענן'],
    ],
    noSecond: [
      ["hrCfgSet\\(\\s*'hr_settings_meta'",
       'המפה אינה עולה לענן — אין מקור אמת שני'],
      ['HR_KV_UPDATED_AT',
       'דגל המעבר נמחק — המיגרציה הורצה והמסלול יחיד'],
      ["remoteMeta\\s*=\\s*await hrKvGet\\(\\s*'hr_settings_meta'",
       'והמפה אינה נקראת מהענן כחותמת — לא בדחיפה ולא במשיכה'],
    ],
    pairs: [
      { from: 'var\\s+HR_SETTINGS_LWW_KEYS\\s*=\\s*\\[([^\\]]*)\\]',
        pick: "'([^']+)'",
        into: "\\{\\s*key:\\s*'([^']+)',\\s*get:",
        min: 2,
        label: 'כל מפתח ב-`HR_SETTINGS_LWW_KEYS` נמצא גם ברשימת הדחיפה' },
    ],
    muts: [
      { n: 1, scen: 'error',
        from: 'if (!r || r.error || !r.data || !r.data.updated_at) return 0;',
        to: 'if (!r || r.error || !r.data || !r.data.updated_at) return {};',
        label: 'מסלול הכשל מחזיר `{}` במקום 0',
        claim: '4 · שגיאה ⇒ 0' },
      { n: 2, scen: 'error',
        from: 'if (!r || r.error ||',
        to: 'if (!r || false ||',
        label: 'התעלמות מ-`r.error` מחזירה חותמת מתשובת שגיאה',
        claim: '4 · שגיאה ⇒ 0' },
    ],
  },
  /*  ⛔ המיגרציה שמוסיפה את עמודת החותמת — ⚠️ **מה נכנס**: הקובץ · הטבלאות
   *  שהעמודה נוספת להן · שם פונקציית הטריגר · הטבלה שהרשאותיה נמדדות ·
   *  והשם שהקובץ רושם כמקרה שאינו שלו; ⛔ **ומה מפיל**: קובץ שאינו קיים,
   *  וטבלה מוצהרת שאין לה `alter`. ⭐ **ו-`file` ריק הוא «נמדד ואין»** —
   *  ⚠️ ואז `why` נושא את הנימוק, ⛔ והדילוג נאמר ואינו שקט. */
  mig: {
    file: 'migrations/013_kv_updated_at.sql',
    tables: ['kv', 'kv_rishon', 'kv_ramataviv'],
    touch: 'kv_touch_updated_at',
    grant: 'kv',
    /*  ⛔ השם שהמיגרציה רושמת כמקרה שאינו שלה — ⚠️ והוא בשמו שבשעת
     *  הריצה: ⭐ מיגרציה שכבר רצה אינה נערכת, ⛔ והשם החי היום הוא `ya_`. */
    note: 'tb_subs_meta',
    why: '',
  },
};
/* ── סוף APP ───────────────────────────────────────────────────────────── */

/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית — ⚠️ הצהרה ריקה ולא היעדר:
 *  ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = readFileSync(join(ROOT, 'index.html'), 'utf8');
const MIG = APP.mig.file ? join(ROOT, APP.mig.file) : '';

let pass = 0, fail = 0;
/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה שבה השער רץ, ⛔ ופחות ממנה
 *  הוא כשל — ⚠️ והמאזין על `exit` תופס גם יציאה שקדמה להמתנה. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
/*  ⛔ ריצפת הטענות — ⚠️ **מה נכנס**: המשותפת, שהיא מספר זהה בכל ריפו
 *  שנושא את השער, ⛔ והפרטית עם היכולת שמוסיפה אותה; ⛔ **ומה מפיל**:
 *  משותפת שנבדלת ביניהם, פרטית בלי נימוק, וסכום אפס. ⭐ **ולמה לא מספר
 *  אחד**: הוא מסתיר טענה משותפת שאבדה. */
/* ⚠️ פר-אפליקציה — הריצפה הפרטית נגזרת ממספר אתרי החיווט ומהמיגרציה שיש לאפליקציה הזו, והנימוק בשדה עצמו */
const FLOOR = { shared: 8, app: 17, appWhy: 'חותמה שהיא עמודה בשורת ההגדרה — שני צדדי החיווט, המפה שאינה מקור שני, והמיגרציה שמוסיפה את העמודה' };
/* ⚠️ סוף פר-אפליקציה */
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
 *  מתעדכנת מפסיקה למדוד את מה שנוסף. */
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
const ok = (c, m) => { RAN++; if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
/*  ⛔ מונה ולא נוכחות (סבב 79) — ⚠️ בדיקת נוכחות עוברת גם על הצהרה כפולה
 *  וגם על שורה שיושבת בתוך הערה: ⭐ הטענה היא על **מספר המופעים**, ⛔ והוא
 *  מודפס בהודעה. */
const _hits = (re, s) => (s.match(new RegExp(re.source, 'g')) || []).length;
const noneIn = (re, s, label) => ok(_hits(re, s) === 0,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי אפס`);
const someIn = (re, s, label) => ok(_hits(re, s) >= 1,
  `${label} — נמדדו ${_hits(re, s)} מופעים והצפוי לפחות 1`);

console.log('\n— שכבת החותמת הפר-מפתחית (' + APP.app + ') —');

/* ── א. ⛔ שכבת החותמת חיה במקור, ובמספר האתרים שהוצהר ──────────────────── */
/*  ⛔ נמדד על המקור הגולמי (סבב 145) — ⚠️ שם הטבלה חי כליטרל מחרוזת,
 *  ⭐ והלבנה הייתה מוחקת בדיוק את מה שנסרק כאן. */
{
  const n = _hits(new RegExp('\\b' + APP.kvMeta.table + '\\b'), SRC);
  ok(n === APP.kvMeta.sites,
     `1 · שכבת \`${APP.kvMeta.table}\` — נמדדו ${n} אתרים והמוצהר ` +
     `${APP.kvMeta.sites}; ⛔ אתר שנוסף או ירד — מעדכנים את \`APP.kvMeta.sites\``);
}

/* ── ב. הנכשל-סגור, על הפונקציה האמיתית ברתמת vm ───────────────────────── */
/*  ⛔ הגוף נחתך מהמקור ⛔ ואינו מועתק לשער — ⚠️ עותק בשער הוא מקור אמת
 *  שני שמתיישן, ⭐ והשער היה מודד את עצמו. */
const cut = (name) => {
  const m = new RegExp('(?:async )?function ' + name + '\\([\\s\\S]*?\\n\\}', 'm').exec(SRC);
  return m ? m[0] : '';
};
const FN_SRC = [].concat(APP.stamp.deps, [APP.stamp.fn]).map(cut).join('\n');
const FN_NAMES = APP.stamp.deps.concat([APP.stamp.fn]);
ok(FN_NAMES.length > 0 && FN_NAMES.every((f) => cut(f) !== ''),
   `2 · \`${APP.stamp.fn}\` ותלויותיה נחתכות מ-index.html — נמדדו ` +
   `${FN_NAMES.filter((f) => cut(f) !== '').length} מתוך ` +
   `${FN_NAMES.length}; ⛔ שם שהוסב — מיישרים את \`APP.stamp\``);

/*  ⛔ החותמת היא מספר מילישניות שהמכשיר ייצר — ⚠️ ולא מחרוזת ISO: ⭐ הטיפוס
 *  הישן נקרא «אין ראיה» ⛔ ואינו נקרא כחותמת. */
const T = Date.parse('2026-08-26T10:00:00Z');
const ISO = '2026-08-26T10:00:00Z';
const KEY = 'k';
/*  ⛔ שני מסלולי חותמת, ושניהם מוצהרים (סבב 145) — ⚠️ **`fetch-key`**:
 *  הפונקציה מושכת בעצמה שורה למפתח; ⛔ **`map-key`**: היא מקבלת את מעטפת
 *  המשיכה של מפת החותמות. ⭐ **ולמה שניים**: מפת חותמות נמשכת פעם אחת
 *  לכל המפתחות, ⛔ ומשיכה למפתח היא קריאת רשת לכל אחד מהם. */
const SCEN = {
  ok:      { row: { data: { updated_at: T } },        map: { ok: true,  data: { k: T } } },
  error:   { row: { error: { message: 'x' }, data: { updated_at: T } },
             map: { ok: false, data: { k: T } } },
  missing: { row: { data: null },                     map: { ok: true,  data: {} } },
  nan:     { row: { data: { updated_at: 'לא-מספר' } }, map: { ok: true,  data: { k: 'לא-מספר' } } },
  iso:     { row: { data: { updated_at: ISO } },      map: { ok: true,  data: { k: ISO } } },
};
/*  ⛔ הזריקה נבנית בצד הקלט — ⚠️ במסלול המשיכה היא בתשובת המסד,
 *  ⭐ ובמסלול המפה היא בקריאת השדה עצמו: ⛔ שני הצדדים חייבים לחזור 0. */
async function callWith(scen, body) {
  const ctx = { withTimeout: (p) => p, Date, isFinite, Number, Object, console };
  if (APP.stamp.kind === 'fetch-key') {
    ctx.SB = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      if (scen === 'throw') throw new Error('net');
      return SCEN[scen].row;
    } }) }) }) };
  }
  /*  ⛔ שם טבלת ההגדרות נגזר מהמקור ⛔ ואינו מוקלד כאן — ⚠️ הוא קבוע שחי
   *  מחוץ לפרוסה שהרתמה טוענת, ⭐ והיא מספקת אותו כדי שהמרשמים ייקראו:
   *  ⛔ בלעדיו המרשם זורק בטעינה, ⚠️ והשער מדווח אפס טענות. */
  ctx.KV_TABLE = (/(?:^|\n)\s*var\s+KV_TABLE\s*=\s*'([^']+)'/.exec(SRC) || [])[1];
  vm.createContext(ctx);
  vm.runInContext((body || FN_SRC) + '\nthis.__f = ' + APP.stamp.fn + ';', ctx);
  if (APP.stamp.kind === 'fetch-key') return ctx.__f(KEY);
  const arg = scen === 'throw' ? { get ok() { throw new Error('net'); } } : SCEN[scen].map;
  return ctx.__f(arg, KEY);
}

ok(await callWith('ok') === T, '3 · חותמת תקינה מוחזרת כמילישניות');
/*  ⛔ חמישה מצבי חוסר-ראיה — ⚠️ כולם 0, ⛔ ולא «חדש» ולא זריקה: ⭐ אפס
 *  מפסיד לכל עריכה מתוארכת, ⛔ ואינו מנצח דבר. */
ok(await callWith('error') === 0,   '4 · ⛔ שגיאה ⇒ 0 (נכשל סגור)');
ok(await callWith('throw') === 0,   '5 · ⛔ זריקה ⇒ 0');
ok(await callWith('missing') === 0, '6 · ⛔ מפתח שאינו קיים ⇒ 0');
ok(await callWith('nan') === 0,
   '7 · ⛔ ערך שאינו מספר ⇒ 0 — ⚠️ `Number` מחזיר NaN, וללא הבדיקה הוא היה זולג להשוואה');
ok(await callWith('iso') === 0,
   '8 · ⛔ מחרוזת ISO ⇒ 0 — ⚠️ הטיפוס הישן אינו נקרא כחותמת');

/* ── ג. החיווט — מי קורא את החותמת, ומה אינו מקור שני ──────────────────── */
APP.stamp.wired.forEach(([re, label], i) =>
  someIn(new RegExp(re), SRC, `ג${i + 1} · ⭐ ${label}`));
APP.stamp.noSecond.forEach(([re, label], i) =>
  noneIn(new RegExp(re), SRC, `ד${i + 1} · ⛔ ${label}`));
/*  ⛔ זוג רשימות שנגזרות מאותו מקור — ⚠️ כל מפתח בראשונה נמצא בשנייה:
 *  ⭐ רשימת שמות מוקלדת בשער נופלת על כל מפתח שנוסף או שירד, ⛔ וההצטלבות
 *  נופלת רק על ההפרש שהיא באה לתפוס. */
APP.stamp.pairs.forEach((p, i) => {
  const arr = new RegExp(p.from).exec(SRC);
  const keys = arr ? (arr[1].match(new RegExp(p.pick, 'g')) || []).map((x) => x.slice(1, -1)) : [];
  const into = (SRC.match(new RegExp(p.into, 'g')) || []).map((x) => new RegExp(p.into).exec(x)[1]);
  const miss = keys.filter((k) => into.indexOf(k) === -1);
  ok(keys.length >= p.min && miss.length === 0,
     `ה${i + 1} · ⭐ ${p.label} — נמדדו ${keys.length} מפתחות, ${miss.length} חסרים ` +
     `(${miss.join(',') || 'אין'}) והצפוי לפחות ${p.min} ואפס חסרים`);
});

/* ── ד. המיגרציה שמוסיפה את העמודה ─────────────────────────────────────── */
const sql = MIG && existsSync(MIG) ? readFileSync(MIG, 'utf8') : '';
if (APP.mig.file) {
  ok(existsSync(MIG), `ו1 · \`${APP.mig.file}\` קיים`);
  /*  ⛔ השמות כאן הם מה שכתוב **במיגרציה שכבר רצה** — ⚠️ והיא אינה
   *  נערכת: ⭐ הסבה מאוחרת אינה נוגעת בקובץ, ⛔ והוא ממשיך לתאר את מה
   *  שהיה בו ביום שנכתב. */
  APP.mig.tables.forEach((t) => {
    ok(new RegExp('alter table public\\.' + t + '\\s+add column if not exists updated_at').test(sql),
       'ו2 · העמודה נוספת ל-`' + t + '`');
    ok(new RegExp('create trigger \\w+\\s+before update on public\\.' + t).test(sql),
       'ו3 · וטריגר `before update` דרוך עליה ב-`' + t + '`');
  });
  /*  ⛔ הלקח של סבב 61 — ⚠️ פונקציה חדשה נולדת נגישה כ-RPC לכל מי שמחזיק
   *  את המפתח הציבורי, ⭐ והיא **אינה יורשת** את ההרשאות של הקודמת. */
  ok(new RegExp('revoke all on function public\\.' + APP.mig.touch +
                '\\(\\) from public, anon, authenticated').test(sql),
     'ו4 · ⛔ `revoke execute` על הפונקציה — היא אינה יורשת הרשאות');
  ok(new RegExp('revoke all on public\\.' + APP.mig.grant + '\\s+from anon, authenticated').test(sql) &&
     new RegExp('grant select, insert, update on public\\.' + APP.mig.grant +
                '\\s+to anon, authenticated').test(sql),
     'ו5 · ⛔ REVOKE לפני GRANT — אין DELETE/TRUNCATE');
  /*  ⛔ מבנה בלבד — ⚠️ מיגרציה שנוגעת בנתונים אינה אידמפוטנטית. */
  ok(!/^\s*(update|delete|insert)\s/im.test(sql.replace(/^\s*--.*$/gm, '')),
     'ו6 · ⛔ המיגרציה אינה נוגעת בנתונים — מבנה בלבד');
  ok(new RegExp('(?<![\\w$.])' + APP.mig.note + '\\b').test(sql),
     `ו7 · ⚠️ הקובץ רושם במפורש ש-\`${APP.mig.note}\` אינו אותו מקרה`);
} else {
  /*  ⛔ הדילוג מוצהר ⛔ ואינו שקט — ⚠️ שער שמדלג בלי לומר אינו נבדל
   *  משער שאיבד את הטענה, ⭐ והנימוק נמדד באורכו. */
  ok(String(APP.mig.why || '').trim().split(/\s+/).length >= 5,
     `ו1 · ⚠️ אין כאן מיגרציה שמוסיפה עמודת חותמת, וההיעדר מוצהר — ${APP.mig.why}`);
}

if (RUN_MUT) {
  mutStage();
/* ── מוטציות ───────────────────────────────────────────────────────────── */
console.log('  — מוטציות —');
/*  ⛔ המוטציות אינן נכתבות לעץ (הלקח של סבב 42ג) — ⚠️ מוטציה שנכתבת לעץ
 *  שורדת כשלון באמצע הריצה, ⭐ וכאן הגוף שנחתך הוא מחרוזת בזיכרון. */

/*  ⛔ המוטציה שוברת את המנגנון ⛔ ולא את הצורה — ⚠️ מסלול הכשל מחזיר
 *  `{}` במקום 0: ⭐ זו בדיוק הצורה שנמדדה ביומן, ⛔ והמיזוג קרא אותה
 *  כ«הענן אינו מכיר». */
for (const m of APP.stamp.muts) {
  const mutated = FN_SRC.replace(m.from, m.to);
  ok(mutated !== FN_SRC && await callWith(m.scen, mutated) !== 0,
     `מ${m.n} · ⛔ מוטציה: ${m.label} — טענה «${m.claim}» נופלת`);
}

/*  ⭐ מוטציית-נגד: **קוד שנוסף** ⛔ אינו מפיל — ⚠️ הטענות מודדות את מסלול
 *  החותמת, ⛔ ולא את אורך הגוף: ⭐ שער שהיה נופל על כל תוספת היה הופך כל
 *  עבודה באפליקציה להפרה. */
{
  const added = FN_SRC.replace('{', '{ var _kvMetaPing = 1; void _kvMetaPing;');
  const all = [];
  for (const s of ['error', 'throw', 'missing', 'nan', 'iso']) all.push(await callWith(s, added));
  ok(added !== FN_SRC && all.length === 5 && all.every((x) => x === 0) &&
     await callWith('ok', added) === T,
     'נ1 · ⭐ מוטציית-נגד: קוד חי שנוסף לגוף ⛔ אינו משנה את מסלול החותמת');
}
/*  ⭐ ומוטציית-נגד שנייה: אתר קריאה שנוסף למקור ⛔ אינו מפיל — ⚠️ הנמדד
 *  הוא הדפוס, ⭐ ולא מספר השורות שמסביבו. */
{
  const added = SRC + '\nfunction _kvMetaNoop(){ return 1; }\n';
  ok(APP.stamp.noSecond.length > 0 && APP.stamp.wired.length > 0 &&
     APP.stamp.noSecond.every(([re]) => _hits(new RegExp(re), added) === 0) &&
     APP.stamp.wired.every(([re]) => _hits(new RegExp(re), added) >= 1),
     'נ2 · ⭐ מוטציית-נגד: פונקציה שנוספה למקור ⛔ אינה משנה את החיווט הנמדד');
}

}

console.log((fail ? '✗' : '✓') + ' שכבת החותמת הפר-מפתחית — ' + pass +
            ' טענות עברו, ' + fail + ' נכשלו\n');
process.exit(fail ? 1 : 0);
