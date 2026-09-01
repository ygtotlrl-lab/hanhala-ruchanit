#!/usr/bin/env node
/*  test_offline_login.mjs — כניסה אופליין ואי-נגיעת הסיסמה הגלויה בדיסק.
 *
 *  **מה נאכף:** ⛔ העמודה הגלויה **אינה נוגעת בדיסק באף נתיב** — ⚠️ לא
 *  במשיכה, לא בכתיבה המקומית ולא בשער הדיסק; ⛔ והאימות — מקוון ואופליין
 *  כאחד — עובר בטביעה בלבד.
 *
 *  **הנימוק המדוד:** ⛔ נקודת מעבר אחת ⛔ ולא מסנן בכל נתיב — ⚠️ סינון
 *  שישב במשיכה בלבד היה בטוח **במקרה** ולא **במבנה**, ⭐ ונתיב אחד שנוסף
 *  עקף אותו.
 *
 *  **מה יישבר בלעדיו:** ⛔ סיסמה גלויה באחסון המקומי, ⚠️ באותו origin שבו
 *  חיות עוד שלוש אפליקציות; ⛔ ותשובה סמכותית «אין משתמש כזה» שנופלת-חזרה
 *  למטמון הייתה מכניסה משתמש שהושבת.
 *
 *  **מה אינו נאכף כאן:** ⛔ מחיקת העמודה מהמסד — ⚠️ היא פעולת מנהל, ⭐ ומה
 *  שנאכף הוא **שאין לה קורא**.
 *
 *  ⚠️ הבדיקה רצה על הקוד האמיתי המחולץ מ-`index.html`, ⛔ לא על העתק.
 *  ⚠️ `crypto.subtle` הוא ה-WebCrypto האמיתי של node, ⭐ ולכן ה-PBKDF2
 *  שנבדק כאן הוא זה שירוץ בדפדפן.
 *  ⛔ **פרטי לאפליקציה ואינו זהה לשלוש האחרות, ⛔ ואין ליישר אותו** —
 *  ⚠️ מודל הכניסה עצמו נבדל: העמודה הגלויה כאן היא שריד **כתוב-ולא-נקרא**
 *  ⛔ ואין מסלול השלמת טביעה. ⚠️ ובאפליקציה הרביעית אין קובץ כזה כלל —
 *  ⛔ אין שם כניסה, ואין מה לאמת.
 */

import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';


/*  ⛔ הקובץ הזה אינו אוכף שורה בטבלת התשתית (סבב 72) — ⚠️ הצהרה ריקה
 *  ולא היעדר: ⛔ שער בלי הצהרה אינו נבדל משער שההצהרה שלו נשמטה. */
export const ROWS = [];
/* ── חילוץ ─────────────────────────────────────────────────────────────── */
const html = fs.readFileSync('index.html', 'utf8');
const SRC = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).join('\n');

function grab(name) {
  const re = new RegExp(`(?:^|\\n)(async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(SRC);
  if (!m) throw new Error(`לא נמצאה הפונקציה ${name} ב-index.html`);
  let i = SRC.indexOf('{', m.index + m[0].length - 1);
  // סורק מלא: מחרוזות (כולל תבניות), הערות שורה, הערות בלוק וליטרלי regex.
  // בלי כל אלה הערה עברית עם גרש בודד פותחת "מחרוזת" ומבלבלת את הספירה.
  let depth = 0, prev = '';
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j], nx = SRC[j + 1];
    if (c === '/' && nx === '/') { j = SRC.indexOf('\n', j); if (j < 0) break; continue; }
    if (c === '/' && nx === '*') { j = SRC.indexOf('*/', j + 2) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') {
      for (j++; j < SRC.length; j++) {
        if (SRC[j] === '\\') { j++; continue; }
        if (SRC[j] === c) break;
      }
      continue;
    }
    if (c === '/' && /[(,=:[!&|?{};+\-*%~^]/.test(prev)) {   // ליטרל regex
      for (j++; j < SRC.length; j++) {
        if (SRC[j] === '\\') { j++; continue; }
        if (SRC[j] === '[') { while (j < SRC.length && SRC[j] !== ']') { if (SRC[j] === '\\') j++; j++; } continue; }
        if (SRC[j] === '/') break;
      }
      prev = '/'; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return SRC.slice(m.index, j + 1); }
    if (!/\s/.test(c)) prev = c;
  }
  throw new Error(`סוגריים לא מאוזנים ב-${name}`);
}
function grabVar(name) {
  const re = new RegExp(`(?:^|\\n)var\\s+${name}\\s*=\\s*([^\\n]*)`);
  const m = re.exec(SRC);
  if (!m) throw new Error(`לא נמצא המשתנה ${name}`);
  return `var ${name} = ${m[1]}`;
}

const FUNCS = ['ysRandSalt', 'ysPassFp', 'ysMakePassFp', 'ysIsMissingFpCol',
  'ysUserSlim', 'ysUsersCacheSlimList', 'ysUsersCacheSaveAll', 'ysUsersCacheSave',
  'ysUsersCacheGet', 'ysVerifyOffline', 'ysRefreshUsersCache',
  '_doLoginInner', 'confirmSwitch', 'saveUser', 'changeMyPassword', 'withTimeout', 'isNetErr',
  /* ⛔ מגן השליחה הכפולה ושתי הפנימיות שלו (סבב 67) — המעטפות קוראות
   * להן, ורתמה שאינה מחלצת אותן נופלת ב-ReferenceError. */
  'ysBusy', '_saveUserInner', '_changeMyPasswordInner'];
const VARS = ['YS_PASS_ITER', 'YS_PASS_CTX', 'NET_TIMEOUT_MS', 'MSG_BAD_LOGIN',
  'MSG_OFF_UNKNOWN', 'MSG_OFF_NO_FP', 'MSG_OFF_NO_CRYPTO',
  /* ⭐ סבב 40 — שני מצבי כישלון שקיימים מעכשיו גם **עם** רשת. */
  'MSG_NO_FP_ONLINE', 'MSG_NO_CRYPTO',
  /* ⛔ דגל נתיב-החזרה של הסיסמה הגלויה (סבב 40) — העמודה `NOT NULL`. */
  'YS_PLAINTEXT_LEGACY_WRITE'];

const CODE = VARS.map(grabVar).join(';\n') + ';\n' + FUNCS.map(grab).join('\n');

/* ── סביבה מדומה ───────────────────────────────────────────────────────── */
let LS, DOM, SBLOG, TOASTS, LOGINLOG;

function mkEl(id) {
  return { id, value: '', textContent: '', type: 'text', disabled: false,
           style: {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); } } };
}
function freshDom(ids) {
  const map = {};
  ids.forEach((i) => { map[i] = mkEl(i); });
  return { _m: map, getElementById: (i) => map[i] || null };
}

const DOM_IDS = ['auth-user', 'auth-pass', 'auth-err', 'auth-spinner', 'auth-btn', 'auth-screen',
  'user-avatar-wrap', 'hdr-username', 'user-menu-name', 'user-menu-role', 'hdr-role',
  'switch-user-modal', 'switch-pass', 'switch-err',
  'um-id', 'um-name', 'um-username', 'um-role', 'um-pass', 'um-err',
  'pw-old', 'pw-new'];

/* `SB` מדומה: שרשרת PostgREST עצלה שמסננת מעל טבלה בזיכרון. */
function makeSB(state) {
  return {
    from(table) {
      const q = { table, _f: [], _op: 'select', _payload: null, _cols: null };
      const api = {
        select(cols) { q._op = 'select'; q._cols = cols; return api; },
        update(p) { q._op = 'update'; q._payload = p; return api; },
        insert(p) { q._op = 'insert'; q._payload = p; return api; },
        eq(c, v) { q._f.push(['eq', c, v]); return api; },
        is(c, v) { q._f.push(['is', c, v]); return api; },
        maybeSingle() { q._single = 'maybe'; return api.then.bind(api); },
        single() { q._single = 'one'; return api.then.bind(api); },
        then(res, rej) { return run().then(res, rej); },
      };
      // maybeSingle()/single() מוחזרים כ-thenable — לכן עוטפים מחדש
      api.maybeSingle = () => { q._single = 'maybe'; return api; };
      api.single = () => { q._single = 'one'; return api; };
      async function run() {
        SBLOG.push({ table, op: q._op, filters: q._f.slice(), cols: q._cols, payload: q._payload });
        if (state.netFail) throw new Error('Failed to fetch');
        // רשת "חצי מחוברת": שאילתה ממוקדת (‎.eq('id')‎) עוברת, משיכת הרשימה
        // המלאה נכשלת. זה מה שמבודד את `ysUsersCacheSave(u)` מהרענון.
        if (state.listSelectFail && q._op === 'select' && !q._f.some((f) => f[1] === 'id')) {
          return { data: null, error: { message: 'server error' } };
        }
        if (state.missingCols && q._payload &&
            ('pass_fp' in q._payload || 'pass_salt' in q._payload)) {
          return { data: null, error: { message: 'column "pass_fp" of relation "ys_users" does not exist' } };
        }
        if (state.missingCols && q._f.some((f) => f[1] === 'pass_fp')) {
          return { data: null, error: { message: 'column ys_users.pass_fp does not exist' } };
        }
        let rows = (state.tables[table] || []).slice();
        for (const [kind, col, val] of q._f) {
          if (kind === 'eq') rows = rows.filter((r) => String(r[col]) === String(val));
          else if (kind === 'is' && val === null) rows = rows.filter((r) => r[col] === null || r[col] === undefined);
        }
        if (q._op === 'update') { rows.forEach((r) => Object.assign(r, q._payload)); return { data: rows, error: null }; }
        if (q._op === 'insert') { state.tables[table].push(Object.assign({ id: Date.now() }, q._payload)); return { data: null, error: null }; }
        const out = rows.map((r) => Object.assign({}, r));
        if (q._single === 'maybe') return { data: out[0] || null, error: null };
        if (q._single === 'one') return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: 'no rows' } };
        return { data: out, error: null };
      }
      return api;
    },
  };
}

function boot(state, opts = {}) {
  LS = {}; SBLOG = []; TOASTS = []; LOGINLOG = [];
  DOM = freshDom(DOM_IDS);
  Object.assign(DOM._m, opts.domSeed || {});
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, Promise, TextEncoder,
    crypto: opts.noCrypto ? undefined : webcrypto,
    navigator: { onLine: !state.netFail },
    document: DOM,
    localStorage: {
      getItem: (k) => (k in LS ? LS[k] : null),
      setItem: (k, v) => { LS[k] = String(v); },
      removeItem: (k) => { delete LS[k]; },
    },
    lsSet: (k, v) => { LS[k] = String(v); return true; },
    /*  ⛔ הקריאה מהאחסון עוברת גם היא במודול (סבב 67) — `lsGet` החליף
     *  את `localStorage.getItem` בכל אתר שמחוץ למודול, ורתמה בלי
     *  הדמה הזו קוראת `undefined` במקום את המטמון. */
    lsGet: (k, fb) => (k in LS ? LS[k] : (fb === undefined ? null : fb)),
    toast: (m) => TOASTS.push(m),
    H: String.fromCharCode,
    AUTH: state.AUTH || { user: null, perms: null, ROLE_LABELS: {}, offlineLogin: false },
    SB: makeSB(state),
    ysLoginLog: (a, b) => LOGINLOG.push(b),
    ysLoginDetails: () => ({}),
    ysLoginLogFlush: () => {},
    loadPerms: async () => {},
    showPage: () => {},
    lkReset: () => {},   // סבב 52 — המנגנון עבר לליבה המשותפת
    initDateFields: () => {},
    closeSwitchModal: () => {},
    closeUserModal: () => {},
    renderUsersList: () => {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);
  return sandbox;
}

/* ── טענות ─────────────────────────────────────────────────────────────── */
let ok = 0, bad = 0;
const T = (name, cond) => { if (cond) { ok++; console.log('  ✅ ' + name); } else { bad++; console.error('  ❌ ' + name); } };
const eq = (name, a, b) => T(name + (a === b ? '' : ` (התקבל: ${JSON.stringify(a)})`), a === b);
/*  ⛔ המתנה היא על **תנאי** ⛔ ולא על שעון — ⚠️ רענון המטמון הוא
    fire-and-forget, ⭐ ושינה קבועה נגמרת על מכונה עמוסה לפני שהשרשרת
    סיימה: ⛔ הטענה נופלת בזמן שהקוד תקין. ⚠️ התקרה קיימת כדי שהבדיקה
    תיכשל **ברעש** אם האירוע לא יקרה כלל, ⛔ ולא כדי לתזמן. */
async function waitFor(pred, label, ms = 5000) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = pred(); } catch (e) { v = false; }
    if (v) return true;
    if (Date.now() - t0 > ms) { T(`⛔ ${label} — לא קרה בתוך ${ms}ms`, false); return false; }
    await new Promise((r) => setTimeout(r, 5));
  }
}
const sec = (t) => console.log('\n──────────────────────────────────── ' + t);

const USERS = () => ([
  { id: 1, username: 'admin',  password_hash: '111111', full_name: 'מנהל',  role: 'admin',  active: true, pass_salt: null, pass_fp: null },
  { id: 2, username: 'moshe',  password_hash: '222222', full_name: 'משה',   role: 'senior', active: true, pass_salt: null, pass_fp: null },
  { id: 3, username: 'yosef',  password_hash: '333333', full_name: 'יוסף',  role: 'junior', active: true, pass_salt: null, pass_fp: null },
  { id: 4, username: 'old',    password_hash: '444444', full_name: 'ישן',   role: 'junior', active: false, pass_salt: null, pass_fp: null },
]);

/* ── 1. גזירת הטביעה ───────────────────────────────────────────────────── */
sec('1. PBKDF2 — גזירה, מלח, ודטרמיניזם');
{
  const S = boot({ tables: { ys_users: USERS() } });
  eq('1א. YS_PASS_ITER = 100000', S.YS_PASS_ITER, 100000);
  const s1 = S.ysRandSalt(), s2 = S.ysRandSalt();
  T('1ב. מלח באורך 32 hex', /^[0-9a-f]{32}$/.test(s1));
  T('1ג. מלח שונה בכל קריאה (פר-משתמש)', s1 !== s2);
  const fpA = await S.ysPassFp('123456', s1);
  const fpB = await S.ysPassFp('123456', s1);
  const fpC = await S.ysPassFp('123456', s2);
  const fpD = await S.ysPassFp('123457', s1);
  T('1ד. טביעה באורך 64 hex', /^[0-9a-f]{64}$/.test(fpA));
  eq('1ה. דטרמיניסטית לאותה סיסמה+מלח', fpA, fpB);
  T('1ו. מלח שונה ⇒ טביעה שונה (אין טבלת קשת משותפת)', fpA !== fpC);
  T('1ז. סיסמה שונה ⇒ טביעה שונה', fpA !== fpD);
  eq('1ח. בלי מלח ⇒ null (נכשל סגור)', await S.ysPassFp('123456', null), null);
  T('1ט. הטביעה אינה מכילה את הסיסמה', fpA.indexOf('123456') === -1);
}
{
  const S = boot({ tables: { ys_users: [] } }, { noCrypto: true });
  eq('1י. בלי crypto ⇒ ysRandSalt מחזירה null', S.ysRandSalt(), null);
  eq('1יא. בלי crypto ⇒ ysMakePassFp מחזירה null', await S.ysMakePassFp('123456'), null);
}

/* ── 2. המטמון — ⛔ password_hash לעולם לא בדיסק ────────────────────────── */
sec('2. המטמון: כל המשתמשים הפעילים, בלי סיסמאות');
{
  const S = boot({ tables: { ys_users: USERS() } });
  S.ysUsersCacheSaveAll(USERS());
  const c = JSON.parse(LS.ys_users_cache);
  eq('2א. נשמרו כל הפעילים (3 מתוך 4)', c.length, 3);
  T('2ב. המושבת לא נשמר', !c.some((u) => u.username === 'old'));
  T('2ג. ⛔ אין password_hash באף רשומה', !c.some((u) => 'password_hash' in u));
  T('2ד. יש id/username/full_name/role/active', c.length > 0 && c.every((u) =>
    'id' in u && 'username' in u && 'full_name' in u && 'role' in u && 'active' in u));
  T('2ה. יש pass_salt/pass_fp', c.length > 0 && c.every((u) => 'pass_salt' in u && 'pass_fp' in u));
  T('2ו. ⛔ המחרוזת password_hash אינה בשום מפתח localStorage',
    !Object.values(LS).some((v) => String(v).indexOf('password_hash') !== -1));
  T('2ז. ⛔ אף סיסמה אינה בשום מפתח localStorage',
    !Object.values(LS).some((v) => ['111111', '222222', '333333'].some((p) => String(v).indexOf(p) !== -1)));
}
{
  // מטמון ישן בפורמט של סבב 21 (רשומה אחת, עם סיסמה גלויה)
  const S = boot({ tables: { ys_users: USERS() } });
  LS.ys_users_cache = JSON.stringify([{ id: 2, username: 'moshe', password_hash: '222222',
                                        full_name: 'משה', role: 'senior', active: true }]);
  S.ysUsersCacheSave({ id: 1, username: 'admin', password_hash: '111111', full_name: 'מנהל',
                       role: 'admin', active: true, pass_salt: 'aa', pass_fp: 'bb' });
  const c = JSON.parse(LS.ys_users_cache);
  eq('2ח. הרשומה הישנה שרדה לצד החדשה', c.length, 2);
  T('2ט. ⭐ password_hash של הרשומה הישנה **נמחק מהדיסק בפועל**',
    !c.some((u) => 'password_hash' in u) && String(LS.ys_users_cache).indexOf('222222') === -1);
  eq('2י. הרשומה הישנה נותרה בלי טביעה', c.find((u) => u.id === 2).pass_fp, null);
  eq('2יא. אין כפילות בעדכון חוזר של אותו id',
    (S.ysUsersCacheSave({ id: 1, username: 'admin', full_name: 'מנהל', role: 'admin', active: true,
                          pass_salt: 'cc', pass_fp: 'dd' }), JSON.parse(LS.ys_users_cache).length), 2);
  eq('2יב. העדכון החוזר דרס את הטביעה', JSON.parse(LS.ys_users_cache).find((u) => u.id === 1).pass_fp, 'dd');
}
{
  const S = boot({ tables: { ys_users: USERS() } });
  S.ysUsersCacheSaveAll('לא-מערך');
  eq('2יג. קלט שאינו מערך אינו כותב כלום', LS.ys_users_cache, undefined);
  S.ysUsersCacheSave({ id: 9, username: 'x', full_name: 'x', role: 'junior', active: false });
  eq('2יד. משתמש לא-פעיל אינו נשמר', LS.ys_users_cache, undefined);
}

/* ── 3. ysRefreshUsersCache ────────────────────────────────────────────── */
sec('3. רענון מהענן');
{
  const state = { tables: { ys_users: USERS() } };
  const S = boot(state, {});
  await S.ysRefreshUsersCache();
  eq('3א. בלי משתמש מחובר — אפס פניות לרשת', SBLOG.length, 0);
  eq('3ב. ...ואפס כתיבה למטמון', LS.ys_users_cache, undefined);
}
{
  const state = { tables: { ys_users: USERS() } };
  const S = boot(state, {});
  S.AUTH.user = { id: 3, role: 'junior' };
  await S.ysRefreshUsersCache();
  const sel = SBLOG.find((q) => q.op === 'select');
  T('3ג. ⛔ password_hash אינו מבוקש בשאילתה כלל', sel.cols.indexOf('password_hash') === -1);
  T('3ד. pass_salt ו-pass_fp כן מבוקשים',
    sel.cols.indexOf('pass_salt') !== -1 && sel.cols.indexOf('pass_fp') !== -1);
  eq('3ה. נמשכו כל הפעילים ולא רק המחובר', JSON.parse(LS.ys_users_cache).length, 3);
}

/* ── 4. ysVerifyOffline ────────────────────────────────────────────────── */
sec('4. אימות אופליין מול הטביעה');
{
  const S = boot({ tables: { ys_users: [] } });
  const made = await S.ysMakePassFp('654321');
  const cu = { id: 5, username: 'a', active: true, pass_salt: made.salt, pass_fp: made.fp };
  eq('4א. סיסמה נכונה ⇒ ok', await S.ysVerifyOffline(cu, '654321'), 'ok');
  eq('4ב. סיסמה שגויה ⇒ bad', await S.ysVerifyOffline(cu, '654322'), 'bad');
  eq('4ג. בלי טביעה ⇒ no-fp',
    await S.ysVerifyOffline({ id: 6, active: true, pass_salt: null, pass_fp: null }, '654321'), 'no-fp');
  eq('4ד. משתמש לא-פעיל ⇒ bad', await S.ysVerifyOffline(Object.assign({}, cu, { active: false }), '654321'), 'bad');
  eq('4ה. null ⇒ bad', await S.ysVerifyOffline(null, '654321'), 'bad');
}
{
  const S = boot({ tables: { ys_users: [] } }, { noCrypto: true });
  eq('4ו. בלי crypto ⇒ no-crypto (ולא ok!)',
    await S.ysVerifyOffline({ id: 5, active: true, pass_salt: 'aa', pass_fp: 'bb' }, 'x'), 'no-crypto');
}

/*  ⭐ סבב 40 — זריעת טביעות לשורות הענן.
 *  עד סבב 40 השורות בפיקסטורה נשארו בלי `pass_fp`, ומסלולי האימות
 *  המקוונים עבדו מפני שהם השוו מול `password_hash` הגלוי. מרגע שהם
 *  משווים מול הטביעה, שורת ענן בלי טביעה **אינה יכולה להיכנס** — וזה
 *  בדיוק הנכון. הפונקציה הזו מביאה את הפיקסטורה למצב המדוד של המסד
 *  החי: כל ששת המשתמשים מחזיקים מלח וטביעה.                          */
async function seedFp(S, rows, pwByUser = { 1: '111111', 2: '222222', 3: '333333', 4: '444444' }) {
  for (const r of rows) {
    const made = await S.ysMakePassFp(pwByUser[r.id] || r.password_hash);
    if (made) { r.pass_salt = made.salt; r.pass_fp = made.fp; }
  }
  return rows;
}

/* ── 5. כניסה אופליין — ⭐ לב הסבב ──────────────────────────────────────── */
sec('5. כניסה אופליין');
async function withCache(pwByUser = { 1: '111111', 2: '222222', 3: '333333' }) {
  // בונה מטמון מלא כפי שהוא נראה אחרי כניסה מקוונת + רענון
  const seed = boot({ tables: { ys_users: [] } });
  const rows = [];
  for (const u of USERS()) {
    if (!u.active) continue;
    const made = await seed.ysMakePassFp(pwByUser[u.id]);
    rows.push({ id: u.id, username: u.username, full_name: u.full_name, role: u.role,
                active: true, pass_salt: made.salt, pass_fp: made.fp });
  }
  return rows;
}
const CACHED = await withCache();

async function offlineLogin(username, pass, cacheRows = CACHED) {
  const S = boot({ netFail: true, tables: { ys_users: USERS() } });
  LS.ys_users_cache = JSON.stringify(cacheRows);
  DOM._m['auth-user'].value = username;
  DOM._m['auth-pass'].value = pass;
  await S._doLoginInner();
  return { S, err: DOM._m['auth-err'].textContent, user: S.AUTH.user, log: LOGINLOG };
}
{
  const r = await offlineLogin('yosef', '333333');
  T('5א. ⭐ משתמש שאינו המחובר האחרון נכנס אופליין', !!r.user && r.user.username === 'yosef');
  eq('5ב. ...ללא הודעת שגיאה', r.err, '');
  T('5ג. ...ומסומן ככניסה אופליין', r.S.AUTH.offlineLogin === true);
  T('5ד. ...ונרשם login_ok', r.log.indexOf('offline') !== -1);
}
{
  const r = await offlineLogin('moshe', '222222');
  T('5ה. ⭐ גם משתמש שלישי נכנס — כל הצוות, לא אחד', !!r.user && r.user.username === 'moshe');
}
{
  const r = await offlineLogin('yosef', '999999');
  eq('5ו. סיסמה שגויה אופליין ⇒ נדחית', r.user, null);
  T('5ז. ...עם MSG_BAD_LOGIN דווקא', r.err.indexOf('שם משתמש או סיסמה שגויים') !== -1);
  T('5ח. ...ונרשמה כ-wrong_credentials_offline', r.log.indexOf('wrong_credentials_offline') !== -1);
}
{
  const r = await offlineLogin('zzz', '123456');
  eq('5ט. משתמש שאינו במטמון ⇒ נדחה', r.user, null);
  T('5י. ⭐ ...עם הודעת «נדרש חיבור» ולא «סיסמה שגויה»',
    r.err.indexOf('אינו בעותק המקומי') !== -1 && r.err.indexOf('סיסמה שגויים') === -1);
  T('5יא. ...ונרשם כ-unknown_user_offline', r.log.indexOf('unknown_user_offline') !== -1);
}
{
  const noFp = CACHED.map((u) => (u.id === 3 ? Object.assign({}, u, { pass_salt: null, pass_fp: null }) : u));
  const r = await offlineLogin('yosef', '333333', noFp);
  eq('5יב. משתמש בלי טביעה ⇒ נדחה', r.user, null);
  T('5יג. ⭐ ...עם הודעת «טרם הוכן» ולא «סיסמה שגויה»',
    r.err.indexOf('טרם הוכן') !== -1 && r.err.indexOf('סיסמה שגויים') === -1);
  T('5יד. ...ונרשם כ-no_fp_offline', r.log.indexOf('no_fp_offline') !== -1);
}
{
  const S = boot({ netFail: true, tables: { ys_users: USERS() } }, { noCrypto: true });
  LS.ys_users_cache = JSON.stringify(CACHED);
  DOM._m['auth-user'].value = 'yosef'; DOM._m['auth-pass'].value = '333333';
  await S._doLoginInner();
  eq('5טו. בלי crypto ⇒ אין כניסה (נכשל סגור)', S.AUTH.user, null);
  T('5טז. ...עם הודעת חוסר תמיכה', DOM._m['auth-err'].textContent.indexOf('אינו תומך בהצפנה') !== -1);
}
{
  const S = boot({ netFail: true, tables: { ys_users: USERS() } });
  DOM._m['auth-user'].value = 'yosef'; DOM._m['auth-pass'].value = '333333';
  await S._doLoginInner();
  eq('5יז. מטמון ריק לגמרי ⇒ הודעת «כניסה ראשונה דורשת רשת»', S.AUTH.user, null);
  T('5יח. ...ונרשם כ-no_cache_offline', LOGINLOG.indexOf('no_cache_offline') !== -1);
}
{
  // מטמון בפורמט הישן של סבב 21 — סיסמה גלויה, בלי טביעה
  const legacy = [{ id: 3, username: 'yosef', password_hash: '333333', full_name: 'יוסף', role: 'junior', active: true }];
  const r = await offlineLogin('yosef', '333333', legacy);
  eq('5יט. ⛔ מטמון ישן: סיסמה גלויה **אינה** מתקבלת כטביעה', r.user, null);
  T('5כ. ...ומוצגת הודעת «טרם הוכן»', r.err.indexOf('טרם הוכן') !== -1);
}

/* ── 6. כניסה מקוונת ───────────────────────────────────────────────────── */
sec('6. כניסה מקוונת');
{
  const rows = USERS();
  const S = boot({ tables: { ys_users: rows } });
  await seedFp(S, rows);          // ⭐ סבב 40 — האימות המקוון הוא מול הטביעה
  DOM._m['auth-user'].value = 'moshe'; DOM._m['auth-pass'].value = '222222';
  await S._doLoginInner();
  await waitFor(() => JSON.parse(LS.ys_users_cache || '[]').length === 3,
                'רענון המטמון אחרי כניסה מקוונת');
  T('6א. כניסה מקוונת הצליחה', !!S.AUTH.user && S.AUTH.user.username === 'moshe');
  eq('6ב. ⭐ המטמון מכיל את כל הפעילים (לא רק את המחובר)', JSON.parse(LS.ys_users_cache).length, 3);
  T('6ג. ⛔ ואין בו password_hash', String(LS.ys_users_cache).indexOf('password_hash') === -1);
  T('6ד. ⛔ ואין בו אף סיסמה', !['111111', '222222', '333333'].some((p) => String(LS.ys_users_cache).indexOf(p) !== -1));
}
{
  const rowsW = USERS();
  const S = boot({ tables: { ys_users: rowsW } });
  await seedFp(S, rowsW);
  DOM._m['auth-user'].value = 'moshe'; DOM._m['auth-pass'].value = '000000';
  await S._doLoginInner();
  eq('6ה. סיסמה שגויה אונליין ⇒ נדחית', S.AUTH.user, null);
  T('6ו. ...ונרשמה כ-wrong_credentials_online', LOGINLOG.indexOf('wrong_credentials_online') !== -1);
}

/* ── 7. ⛔ השלמת הטביעות הוסרה (סבב 40) ──────────────────────────────────────
   ⚠️ **הטענות כאן התהפכו במכוון.** עד סבב 40 הן אכפו ש-`ysBackfillPassFp`
   גוזרת טביעה מהסיסמה הגלויה; מסבב 40 הן אוכפות ש**היא אינה קיימת**.
   ⛔ זו אינה ריכוך של הבדיקה אלא הפוכה שלה: כל עוד הפונקציה בקוד, יש
   מסלול שקורא את `password_hash` כדי לגזור ממנה — כלומר הקורא האחרון של
   הסיסמה הגלויה, וזה שהיה נשבר ברגע שהעמודה תימחק.
   ⚠️ ההסרה נשענת על מדידה ולא על הנחה: כל ששת המשתמשים ב-`ys_users`
   מחזיקים `pass_salt` ו-`pass_fp` (נמדד ב-`SELECT` בלבד, 2026-08-19),
   ולכן לא נותר למי להשלים.                                            */
sec('7. ⛔ השלמת הטביעות הוסרה');
{
  T('7א. ⛔ `ysBackfillPassFp` אינה בקוד', SRC.indexOf('function ysBackfillPassFp') === -1);
  T('7ב. ⛔ ואין לה אף אתר קריאה', SRC.indexOf('ysBackfillPassFp(') === -1);
  T('7ג. ⛔ ו-`_ysFpBackfillDone` נעלם איתה', SRC.indexOf('_ysFpBackfillDone') === -1);
  T('7ד. ⭐ ואין יותר אף שאילתה ששולפת `password_hash` כדי לגזור ממנה טביעה',
    SRC.indexOf("select('id,password_hash')") === -1);
}

/* ── 8. יצירת/עריכת משתמש ושינוי סיסמה ─────────────────────────────────── */
sec('8. saveUser / changeMyPassword');
{
  const rows = USERS();
  const S = boot({ tables: { ys_users: rows } });
  S.AUTH.user = { id: 1, role: 'admin' };
  DOM._m['um-id'].value = ''; DOM._m['um-name'].value = 'חדש';
  DOM._m['um-username'].value = 'hadash'; DOM._m['um-role'].value = 'junior';
  DOM._m['um-pass'].value = '567890';
  await S.saveUser();
  const nu = rows.find((r) => r.username === 'hadash');
  T('8א. משתמש חדש נוצר עם מלח+טביעה', !!nu && !!nu.pass_salt && !!nu.pass_fp);
  eq('8ב. הטביעה תואמת לסיסמה', await S.ysPassFp('567890', nu.pass_salt), nu.pass_fp);
}
{
  const rows = USERS();
  rows[1].pass_salt = 'ישן'; rows[1].pass_fp = 'טביעה-ישנה';
  const S = boot({ tables: { ys_users: rows } }, { noCrypto: true });
  S.AUTH.user = { id: 1, role: 'admin' };
  DOM._m['um-id'].value = '2'; DOM._m['um-name'].value = 'משה';
  DOM._m['um-username'].value = 'moshe'; DOM._m['um-role'].value = 'senior';
  DOM._m['um-pass'].value = '888888';
  await S.saveUser();
  eq('8ג. ⭐ בלי crypto — הטביעה הישנה **אופסה** ולא נשארה', rows[1].pass_fp, null);
  eq('8ד. ...וגם המלח', rows[1].pass_salt, null);
  eq('8ה. ...הסיסמה כן נשמרה', rows[1].password_hash, '888888');
  T('8ו. ...והמשתמש קיבל אזהרה ולא «נשמר בהצלחה»', TOASTS.some((t) => t.indexOf('⚠️') === 0));
}
{
  const rows = USERS();
  const S = boot({ missingCols: true, tables: { ys_users: rows } });
  S.AUTH.user = { id: 1, role: 'admin' };
  DOM._m['um-id'].value = '2'; DOM._m['um-name'].value = 'משה';
  DOM._m['um-username'].value = 'moshe'; DOM._m['um-role'].value = 'senior';
  DOM._m['um-pass'].value = '777777';
  await S.saveUser();
  eq('8ז. מיגרציה שטרם הורצה ⇒ המשתמש נשמר בכל זאת', rows[1].password_hash, '777777');
  T('8ח. ...עם אזהרה', TOASTS.some((t) => t.indexOf('⚠️') === 0));
}
{
  const rows = USERS();
  const S = boot({ tables: { ys_users: rows } });
  await seedFp(S, rows);          // ⭐ סבב 40 — הסיסמה הנוכחית מאומתת מול הטביעה
  S.AUTH.user = { id: 2, username: 'moshe', full_name: 'משה', role: 'senior', active: true };
  DOM._m['pw-old'].value = '222222'; DOM._m['pw-new'].value = '246810';
  await S.changeMyPassword();
  eq('8ט. הסיסמה עודכנה בענן', rows[1].password_hash, '246810');
  eq('8י. והטביעה עודכנה איתה', await S.ysPassFp('246810', rows[1].pass_salt), rows[1].pass_fp);
  const c = JSON.parse(LS.ys_users_cache).find((u) => u.id === 2);
  eq('8יא. ⭐ והמטמון המקומי עודכן לסיסמה החדשה', await S.ysPassFp('246810', c.pass_salt), c.pass_fp);
  T('8יב. ⛔ ואין password_hash במטמון', String(LS.ys_users_cache).indexOf('password_hash') === -1);
}

/* ── 9. מעבר-משתמש ─────────────────────────────────────────────────────── */
sec('9. confirmSwitch');
async function doSwitch(targetId, pass, opts = {}) {
  const modal = mkEl('switch-user-modal'); modal._switchId = targetId;
  const cloud = USERS();
  const S = boot({ netFail: !!opts.offline, listSelectFail: !!opts.listSelectFail, tables: { ys_users: cloud } },
                 { domSeed: { 'switch-user-modal': modal } });
  await seedFp(S, cloud);         // ⭐ סבב 40 — גם מעבר-משתמש מקוון מאמת מול הטביעה
  LS.ys_users_cache = JSON.stringify(opts.cache || CACHED);
  S.AUTH.user = { id: 1, username: 'admin', role: 'admin', active: true };
  DOM._m['switch-pass'].value = pass;
  await S.confirmSwitch();
  return { S, err: DOM._m['switch-err'].textContent, user: S.AUTH.user };
}
{
  const r = await doSwitch(3, '333333', { offline: true });
  T('9א. ⭐ מעבר-משתמש אופליין עובד שוב (נשבר בסבב 21)', r.user.id === 3);
  eq('9ב. ...בלי הודעת שגיאה', r.err, '');
  T('9ג. ...ומסומן אופליין', r.S.AUTH.offlineLogin === true);
}
{
  const r = await doSwitch(3, '999999', { offline: true });
  eq('9ד. סיסמה שגויה במעבר אופליין ⇒ המשתמש לא הוחלף', r.user.id, 1);
  T('9ה. ...עם הודעת סיסמה שגויה', r.err.indexOf('שגויה') !== -1);
}
{
  const r = await doSwitch(99, '123456', { offline: true });
  eq('9ו. יעד שאינו במטמון ⇒ לא הוחלף', r.user.id, 1);
  T('9ז. ...עם הודעת «נדרש חיבור» ולא «סיסמה שגויה»',
    r.err.indexOf('אינו בעותק המקומי') !== -1 && r.err.indexOf('שגויה') === -1);
}
{
  const noFp = CACHED.map((u) => (u.id === 3 ? Object.assign({}, u, { pass_salt: null, pass_fp: null }) : u));
  const r = await doSwitch(3, '333333', { offline: true, cache: noFp });
  eq('9ח. יעד בלי טביעה ⇒ לא הוחלף', r.user.id, 1);
  T('9ט. ...עם הודעת «טרם הוכן»', r.err.indexOf('טרם הוכן') !== -1);
}
{
  const r = await doSwitch(2, '222222');
  await waitFor(() => !!JSON.parse(LS.ys_users_cache || '[]').find((u) => String(u.id) === '2'),
                'רענון המטמון על המשתמש החדש');
  T('9י. מעבר מקוון עובד', r.user.id === 2);
  const c = JSON.parse(LS.ys_users_cache);
  T('9יא. ⭐ המטמון רוענן על המשתמש **החדש** (הבאג של סבב 21)',
    !!c.find((u) => String(u.id) === '2'));
  T('9יב. ⛔ ואין בו password_hash', String(LS.ys_users_cache).indexOf('password_hash') === -1);
}
{
  // ⭐ בידוד תיקון סבב 21: השורה שנשמרת היא ה-`u` המפורש, ולא תוצאה של
  // `ysRefreshUsersCache()` שקוראת את `AUTH.user`. הרענון המלא מושבת כאן,
  // ולכן רק `ysUsersCacheSave(u)` יכולה להכניס את היעד למטמון.
  const r = await doSwitch(2, '222222', { listSelectFail: true, cache: [] });
  await waitFor(() => JSON.parse(LS.ys_users_cache || '[]').length === 1,
                'שמירת היעד מהשורה שבידינו');
  T('9יג. מעבר מקוון עובד גם כשמשיכת הרשימה נכשלה', r.user.id === 2);
  const c = JSON.parse(LS.ys_users_cache || '[]');
  T('9יד. ⭐⭐ היעד נשמר מהשורה שבידינו — לא מ-AUTH.user הקודם (באג סבב 21)',
    c.length === 1 && String(c[0].id) === '2');
  T('9טו. ⛔ וגם השורה הזו נכנסה בלי password_hash',
    String(LS.ys_users_cache).indexOf('password_hash') === -1 &&
    String(LS.ys_users_cache).indexOf('222222') === -1);
}

/* ── 10. סריקה גורפת של כל מפתחות localStorage ─────────────────────────── */
sec('10. ⛔ סריקה גורפת — password_hash אינו נוגע בדיסק');
{
  const rows = USERS();
  const S = boot({ tables: { ys_users: rows } });
  S.AUTH.user = { id: 1, role: 'admin' };
  await seedFp(S, rows);          // ⭐ סבב 40 — הטביעות נזרעות במפורש, במקום דרך הבקפיל שהוסר
  DOM._m['auth-user'].value = 'admin'; DOM._m['auth-pass'].value = '111111';
  await S._doLoginInner();
  await waitFor(() => !!LS.ys_users_cache, 'רענון המטמון לפני שינוי הסיסמה');
  DOM._m['pw-old'].value = '111111'; DOM._m['pw-new'].value = '135790';
  await S.changeMyPassword();
  const all = Object.entries(LS).map(([k, v]) => k + '=' + v).join('\n');
  T('10א. אף מפתח אינו מכיל את המחרוזת password_hash', all.indexOf('password_hash') === -1);
  T('10ב. אף מפתח אינו מכיל אף אחת מהסיסמאות',
    !['111111', '222222', '333333', '444444', '135790'].some((p) => all.indexOf(p) !== -1));
  T('10ג. ...והמטמון בכל זאת מכיל טביעות', /"pass_fp":"[0-9a-f]{64}"/.test(all));
}

console.log(`\n${bad ? '❌' : '✅'} סבב 22: ${ok} טענות עברו, ${bad} נכשלו`);
process.exit(bad ? 1 : 0);

/* ───────────────────────────────────────────────────────────────────────────
   ⛔ מוטציה ומוטציית-נגד — סבב 67
   ───────────────────────────────────────────────────────────────────────────
   ⛔ מבחן נכנס עם מוטציה, או עם נימוק כתוב מדוע אינו ניתן למוטציה.
   ⚠️ בלעדיה אין שום ראיה שהמבחן **מסוגל** ליפול: 97 טענות שעוברות על עץ
   תקין נראות כרשת ביטחון ופועלות כאישור. ⛔ והמוטציה רצה על **עותק
   בתיקייה זמנית** ולא על העץ (הלקח של סבב 42ג).
   ⚠️ הרצת-המשנה מסומנת ב-`RD67_MUT` — ⛔ בלעדיו המוטציה הייתה מריצה את
   עצמה שוב בתוך העותק, לאין סוף.
   ──────────────────────────────────────────────────────────────────────── */
if (!process.env.RD67_MUT) {
  const _m = await import('node:fs');
  const _p = await import('node:path');
  const _o = await import('node:os');
  const _c = await import('node:child_process');
  const _self = new URL(import.meta.url).pathname;
  const _name = _p.basename(_self);
  const _root = _p.resolve(_p.dirname(_self), '..');
  const _run = (dir) => _c.spawnSync(process.execPath, [_p.join(dir, 'tools', _name)],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, RD67_MUT: '1' } }).status;

  const _mut = (label, file, edit, expectFail) => {
    const d = _m.mkdtempSync(_p.join(_o.tmpdir(), 'rd67-'));
    _m.cpSync(_root, d, { recursive: true, filter: (s) => !s.includes('/.git') });
    const f = _p.join(d, file);
    if (!_m.existsSync(f)) { console.log('  ok   ' + label + ' — ⚠️ הקובץ אינו קיים כאן, הטענה מוצהרת ריקה'); return; }
    _m.writeFileSync(f, edit(_m.readFileSync(f, 'utf8')));
    const st = _run(d);
    const fell = st !== 0;
    console.log((fell === expectFail ? '  ok   ' : '  FAIL ') + label);
    /*  ⛔ יציאה מיידית ולא `exitCode` (סבב 67) — סיכום המבחן קורא
     *  ל-`process.exit` בסופו, והוא היה דורס כשל מוטציה בשקט. */
    if (fell !== expectFail) process.exit(1);
    _m.rmSync(d, { recursive: true, force: true });
  };

  console.log('\n— מוטציות (סבב 67) —');
  _mut('⛔ ביטול בדיקת הטביעה בכניסה האופליין מפיל', 'index.html',
       (s) => s.replace(/pass_fp/g, 'pass_fp_x'), true);
  _mut('⭐ מוטציית-נגד: פונקציה חדשה וחיה ב-index.html ⛔ אינה מפילה', 'index.html',
       (s) => s.replace('</body>', '<script>function r72Live(){ return 1; }</script>\n</body>'), false);
}
