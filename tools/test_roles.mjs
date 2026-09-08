#!/usr/bin/env node
/*  test_roles.mjs — מודל ההרשאות: תפקיד במקום סיסמת שער.
 *
 *  **מה נאכף:** ⛔ ההשוואה היא ל-`admin` **בדיוק** בעשרה מצבים · ⛔ דרגת
 *  הביניים פותחת את מסכי ההשגחה ⛔ ואינה פותחת את מה שסגור למנהל ·
 *  ⛔ מטריצת ההרשאות מכריעה ניווט ⛔ ולא סיסמה · ⛔ ואף מסלול אינו משווה
 *  סיסמה מול שם תפקיד.
 *
 *  **הנימוק המדוד:** נפילה-חזרה לשם התפקיד כסיסמה הייתה **שער שנפתח לכל
 *  מקליד** בהתקנה טרייה — ⚠️ והדרגה שקיימת כאן בלבד היא בדיוק המקום שבו
 *  בדיקה שהועתקה מאחות משווה מול שם שאינו קיים ⛔ ונכשלת פתוח.
 *
 *  **מה יישבר בלעדיו:** ⛔ השוואה שמחזירה `true` על תפקיד שהוקלד בטעות
 *  פותחת את כל המסכים, ⚠️ בלי שגיאה ובלי עקבה.
 *
 *  **מה אינו נאכף כאן:** ⛔ ההרשאות שבמסד — ⚠️ הן נאכפות בשכבת האפליקציה
 *  בהחלטה מודעת, ⭐ והכרעת מודל האבטחה היא של המנהל.
 *
 *  ⚠️ הבדיקה רצה על הקוד האמיתי המחולץ מ-`index.html`, ⛔ לא על העתק.
 *  ⚠️ **פרטי לאפליקציה** ⛔ ואינו זהה לשתי האחיות — ⭐ ארבע האינווריאנטות
 *  המשותפות יושבות ב-`roles-harness.mjs`, ⛔ ומה שכאן הוא דרגת הביניים
 *  ומטריצת ההרשאות, שקיימות כאן בלבד.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { reporter, extract, adminGaps, messageGaps, residueGaps,
         rolePasswordGaps } from './roles-harness.mjs';

/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];

/*  ⛔ המוטציות אינן ברירת המחדל (סבב 92) — ⚠️ כל מוטציה היא שינוי ⟵ הרצה
 *  ⟵ שחזור, ⭐ ושני שערים לבדם היו רוב זמן הסט: ⛔ הן רצות ברמה המלאה
 *  (`--full`), בסוף הסבב ולפני מיזוג, ⚠️ ולא בכל הרצה בזמן העבודה. */
const RUN_MUT = process.env.GATE_MUT === '1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const REP = reporter();
/*  ⛔ שער מריץ את כל טענותיו — ⚠️ תהליך שנסגר באמצע מדפיס «עבר» על טענות
 *  שלא רצו: ⭐ `EXPECTED` הוא רצפה שנמדדה ברמה המהירה, ⛔ ופחות ממנה הוא
 *  כשל — ⚠️ והמונה נקרא מהרתמה המשותפת, ⛔ שהיא המדווחת כאן. */
const GATE_ID = new URL(import.meta.url).pathname.split('/').pop();
const EXPECTED = 20;
let RAN = 0;
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
  RAN += REP.st.pass + REP.st.fail;
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
const { ok, eq, sect } = REP;
const { fn, decl } = extract(SRC);

/*  ⛔ הרתמה מריצה את הבלוק החתום ואת דרגת הביניים בלבד — ⚠️ הן כל מה
 *  שמכריע הרשאה כאן, ⭐ ו-`AUTH` הוא מצב פר-משתמש שהרתמה מספקת. */
function makeCtx() {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Object, Array, String, JSON, Date, isFinite,
    AUTH: { user: null, perms: null, DEFAULT_PERMS: {} },
    _sessUser: null, _sessBooted: false,
    lsSet: () => true, lsGet: () => null, lsRemove: () => {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    [decl('ROLE_ADMIN')].join('\n') + '\n' +
    ['isAdminOf', 'isAdmin', 'ysSupervisionAccess', 'sessSet', 'sessGet',
     'sessClear', 'canAccess', 'canEdit'].map(fn).join('\n'), ctx);
  return ctx;
}

sect('א. ⛔ ההשוואה היא ל-`admin` בדיוק');
{
  const c = makeCtx();
  const gaps = adminGaps((u) => c.isAdminOf(u));
  ok('⭐ עשרה מצבים — רק `admin` מדויק מקבל הרשאה', gaps.length === 0, gaps.join(' · '));
  c.sessSet({ role: 'admin' });
  ok('`isAdmin()` קורא את המשתמש המחובר', c.isAdmin());
  c.sessSet({ role: 'manager' });
  ok('ומחזיר false לדרגת הביניים', !c.isAdmin());
  c.sessClear();
  ok('ובלי משתמש מחובר', !c.isAdmin());
}

sect('ב. ⭐ דרגת הביניים — ההשגחה בלבד');
{
  const c = makeCtx();
  const say = (role) => { c.sessSet(role === null ? null : { role: role }); return c.ysSupervisionAccess(); };
  ok('⭐ מנהל נכנס להשגחה', say('admin'));
  ok('⭐ ודרגת הביניים נכנסת אף היא', say('manager'));
  ok('⛔ והדרגה שמתחתיה אינה', !say('junior'));
  ok('⛔ ותפקיד שהוקלד בטעות אינו', !say('Manager'));
  ok('⛔ ובלי משתמש — נכשל סגור', !say(null));
  ok('⛔ ודרגת הביניים אינה מנהל', (c.sessSet({ role: 'manager' }), !c.isAdmin()));
}

sect('ג. ⛔ הניווט נגזר ממטריצת ההרשאות');
{
  const c = makeCtx();
  c.AUTH.DEFAULT_PERMS = { attend: { admin: 'edit', manager: 'view', junior: 'none' } };
  const at = (role) => { c.AUTH.user = { role: role }; return c.canAccess('attend'); };
  ok('⭐ מנהל רואה', at('admin'));
  ok('⭐ דרגת הביניים רואה', at('manager'));
  ok('⛔ והדרגה שמתחתיה חסומה', !at('junior'));
  ok('⛔ ותפקיד שאינו במטריצה חסום', !at('nobody'));
  c.AUTH.user = null;
  ok('⛔ ובלי משתמש — נכשל סגור', !c.canAccess('attend'));
  c.AUTH.user = { role: 'manager' };
  ok('⛔ ועריכה נבדלת מצפייה', !c.canEdit('attend'));
}

sect('ד. ⛔ אין סיסמה שמשווה מול שם תפקיד');
{
  const rp = rolePasswordGaps(SRC, ['admin', 'manager', 'junior']);
  ok('⛔ אפס מסלולים שמשווים סיסמה מול שם תפקיד', rp.length === 0, rp.join(' · '));
  const mg = messageGaps([]);
  ok('⚠️ אין כאן הודעת «העמודה אינה קיימת» — ההצהרה ריקה ואינה נשמטת', mg.length === 0);
  const rg = residueGaps({}, []);
  ok('⚠️ ואין סוד שער שיצא משימוש', rg.length === 0);
  ok('⛔ ואין שם תפקיד שיצא משימוש בקוד', !/['"](owner|senior|user)['"]\s*(?:===|!==)/.test(SRC));
}

const failed = REP.summary('מודל ההרשאות');

/*  ⛔ המוטציות (סבב 114) — ⚠️ שינוי ⟵ הרצה ⟵ נפילה, ⭐ ועל **עותק
 *  בתיקייה זמנית** ⛔ ולא על העץ. */
if (!RUN_MUT) {
  console.log('\n⏭ test_roles: המוטציות רצות ברמה המלאה (--full)');
  process.exit(failed ? 1 : 0);
}
{
  const os = await import('node:os');
  const cp = await import('node:child_process');
  const self = new URL(import.meta.url).pathname;
  const name = path.basename(self);
  const run = (dir) => cp.spawnSync(process.execPath, [path.join(dir, 'tools', name)],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, GATE_MUT: '' } }).status;
  const mut = (label, edit, expectFail) => {
    /*  ⛔ כותב על עותק — ⚠️ המוטציה מריצה שער אמיתי בתהליך נפרד, ⭐ והוא
     *  קורא את המקור מהדיסק: ⛔ והעץ עצמו אינו נוגע. */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'roles-'));
    fs.cpSync(ROOT, d, { recursive: true, filter: (s) => !s.includes('/.git') });
    const f = path.join(d, 'index.html');
    fs.writeFileSync(f, edit(fs.readFileSync(f, 'utf8')));
    const fell = run(d) !== 0;
    console.log((fell === expectFail ? '  ok   ' : '  FAIL ') + label);
    if (fell !== expectFail) process.exit(1);
    fs.rmSync(d, { recursive: true, force: true });
  };
  console.log('\n— מוטציות —');
  /*  ⛔ המוטציה שוברת את **המנגנון** ⛔ ולא את הצורה — ⚠️ ההשוואה המדויקת
   *  הופכת ל«שונה מ-manager», ⭐ וכל תפקיד שהוקלד בטעות מקבל הרשאה. */
  mut('⛔ היפוך ההשוואה ל«שונה מ-manager» — מפיל את «ההשוואה היא ל-admin בדיוק»',
    (s) => s.replace("function isAdminOf(u) { return !!u && String(u.role) === ROLE_ADMIN; }",
                     "function isAdminOf(u) { return !!u && String(u.role) !== 'manager'; }"), true);
  mut('⛔ ביטול דרגת הביניים — מפיל את «דרגת הביניים נכנסת להשגחה»',
    (s) => s.replace("return isAdminOf(u) || (!!u && String(u.role) === 'manager');",
                     "return isAdminOf(u);"), true);
  /*  ⭐ מוטציית-נגד — שינוי חי שאסור לו להפיל. */
  mut('⭐ מוטציית-נגד: פונקציה חדשה וחיה — ⛔ אינה מפילה, שהיא שינוי תקין',
    (s) => s.replace('</body>', '<script>function r114Live(){ return 1; }\nvar _r114Seen = r114Live();</script>\n</body>'), false);
}
process.exit(failed ? 1 : 0);
