// app/screens/login.js — הכניסה, תפריט המשתמש והחלפת משתמש
import { MSG_FILL_LOGIN, MSG_LOGIN_ERR, MSG_NO_CRYPTO, MSG_OFF_NO_CRYPTO, MSG_OFF_NO_FP,
         MSG_OFF_UNKNOWN, MSG_SERVER_ERR, dayToday, isNetErr,
         netTimeout } from '../../core/util.js';
import { ctxSwitch } from '../../core/sync.js';
import { lsGet } from '../../core/storage.js';
import { mirrorLoadOne } from '../../core/mirror.js';
import { AUTH_USER_COLS, authLog, authUsersTable, authVerify, isAdminOf, lkReset, lkStop, usersGet,
         usersSaveOne } from '../../core/auth.js';
import { closeModal, esc, openModal, shellBare, toast } from '../../core/ui.js';
import { HEB_DOW, hebrewDate } from '../../core/hebrew.js';
import { HR_LOGIN_NET_MS, HR_PERMS_KEY, MSG_BAD_LOGIN, MSG_NO_FP_ONLINE, MSG_OFFLINE_LOGIN_LATER,
         MSG_OFF_FIRST_LOGIN, MSG_SERVER_DOWN_LOCAL, MSG_SWITCHED_AS,
         MSG_SWITCH_NEED_PASS, MSG_SWITCH_TITLE,
         MSG_SWITCH_WRONG_PASS } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { hrApplyPerms, hrCfgGet, hrSetPending,
         uiShown } from '../domain.js';
import { icon } from '../icons.js';
import { gateForget, gateLogin, gateRenew } from '../gate.js';
import { stIcon } from '../../core/icons.js';

// ── המסכים ──
// mountView() מציירת אותם לפני כל קוד שמחפש אלמנט בתוכם — אין להזיז את הקריאה אליה מטה.
function screenLoginHTML() {
  return `
<div id="auth-screen">
  <div class="auth-box" data-ks>
    <div class="auth-logo"><img src="icons/icon-512.ea0cf769.png" alt="לוגו"></div>
    <div class="auth-title">הנהלה רוחנית</div>
    <div class="auth-sub">מערכת ניהול הישיבה</div>
    <div class="auth-field"><label for="auth-user">שם משתמש</label><input aria-label="שם משתמש" type="text" id="auth-user" placeholder="שם משתמש" autocomplete="username"></div>
    <div class="auth-field"><label for="auth-pass">סיסמה</label><input type="password" id="auth-pass" placeholder="••••••" maxlength="6" inputmode="numeric" autocomplete="current-password"></div>
    <button class="auth-btn" id="auth-btn" data-act="login" data-busy="&lt;span class=&quot;btn-spin&quot; role=&quot;status&quot; aria-label=&quot;בודק&quot;&gt;&lt;/span&gt;" data-ksave>כניסה למערכת</button>
    <div class="auth-err" id="auth-err"></div>

  </div>
</div>
`;
}

// supabase-js אינו מטיל timeout — ברשת חצי מחוברת ה-fetch לא מצליח ולא נכשל.
// העטיפה הופכת כל זריקה ב-async להודעה גלויה; הכפתור מנוטרל ב-actRun ולא כאן.
async function doLogin() {
  try {
    await _doLoginInner();
  } catch (e) {
    console.error('[login] unexpected:', e);
    try {
      var el = document.getElementById('auth-err');
      // כשל מערכת בטוסט ולא ב-auth-err, ששמור למה שהמשתמש מתקן בהקלדה.
      if (el) el.textContent = '';
      toast(MSG_LOGIN_ERR + ((e && e.message) || e || MSG_SERVER_ERR), null, 'bad');
    } catch (e2) {}
  }
}

async function _doLoginInner() {
  // טעינת המראה כאן ולא בעלייה — העלייה רצה אחרי הכניסה, והכניסה האופליין היא הקוראת הראשונה.
  mirrorLoadOne(authUsersTable());
  var username = document.getElementById('auth-user').value.trim();
  var pass = document.getElementById('auth-pass').value.trim();
  var errEl   = document.getElementById('auth-err');
  // הבדיקה מוצגת בכפתור עצמו (data-busy) — ספינר אחד.
  function showErr(msg, kind){ errEl.innerHTML=stIcon(kind || 'warn')+esc(msg); }
  function dbg(msg){ console.log('[login] '+msg); }
  errEl.textContent='';
  if (!username || !pass) { showErr(MSG_FILL_LOGIN); return; }
  dbg('[1/4] שולח בקשה לשרת...');
  // ההרשאות נמשכות במקביל לשורת המשתמש — בסיסמה שגויה הן פשוט אינן בשימוש, ובנכונה חוסכים פנייה שנייה לרשת.
  var permsP = permsFetch();
  var res = null, netFail = false;
  try {
    // בלי רשת כלל — אין למה לחכות לתקרת הזמן; ישר לעותק שבמכשיר.
    if (navigator.onLine === false) throw new Error('offline');
    // השורה נשלפת לפי שם המשתמש בלבד וההכרעה מול הטביעה — סינון לפי סיסמה בשאילתה
    // הופך ערך שבענן למפתח שכל מחזיק מפתח ה-anon יכול לקרוא.
    res = await netTimeout(S.SB.from(authUsersTable())
      .select(AUTH_USER_COLS.join(','))
      .eq('username', username)
      .eq('active', true)
      .maybeSingle(), HR_LOGIN_NET_MS);
  } catch(e) {
    // פסק זמן נחשב כאין רשת שמישה.
    console.error('[login] SB threw:', e && e.message);
    netFail = true;
  }
  if (!netFail && res && res.error && isNetErr(res.error)) netFail = true;

  var serverErr = (!netFail && res && res.error) ? res.error : null;
  // authoritativeNo — אין שורה או שהטביעה לא התאימה: תשובה סמכותית, ואסור ליפול אחריה לעותק המקומי,
  // אחרת סיסמה שהוחלפה בענן או משתמש שהושבת ממשיכים להיכנס מהמטמון.
  var onlineRow = (!netFail && res && !res.error) ? res.data : null;
  var onlineVerdict = onlineRow ? await authVerify(onlineRow, pass) : null;
  if (onlineVerdict === 'no-fp') {
    authLog(false, 'no_fp_online', username);
    showErr(MSG_NO_FP_ONLINE); return;
  }
  if (onlineVerdict === 'no-crypto') {
    authLog(false, 'no_crypto_online', username);
    showErr(MSG_NO_CRYPTO); return;
  }
  var authoritativeNo = (!netFail && res && !res.error && (!res.data || onlineVerdict === 'bad'));
  var onlineUser = (onlineVerdict === 'ok') ? onlineRow : null;

  if (onlineUser) {
    ctxSwitch();
    AUTH.user = onlineUser;
    AUTH.offlineLogin = false;
    // נשמרת מיד, כדי שכניסה אופליין תעבוד גם אם הרענון המלא שאחרי הכניסה ייכשל.
    usersSaveOne(onlineUser);
    authLog(true, 'online', username);
    // שער השרת (התגובות לטפסים) — ברקע, בלי להמתין
    gateLogin(username, pass);
  } else if (authoritativeNo) {
    authLog(false, 'wrong_credentials_online', username);
    showErr(MSG_BAD_LOGIN, 'bad'); return;
  } else {
    // שגיאת שרת (פרויקט מושהה, מפתח פג, RLS) אינה תשובה סמכותית — ולכן מנסים את העותק המקומי.
    dbg(netFail ? 'אין רשת — מנסה אימות מקומי (מראת המשתמשים)'
               : 'שגיאת שרת — מנסה אימות מקומי (מראת המשתמשים)');
    authLog(false, netFail ? 'net_error' : 'server_error', username);
    var cache = usersGet();
    // Array.isArray ולא length — ערך JSON שאינו מערך עובר את length, ו-find זורק בשקט והספינר נתקע.
    if (!Array.isArray(cache) || !cache.length) {
      authLog(false, 'no_cache_offline', username);
      // שגיאת שרת בטוסט, והיעדר מטמון בערוץ המשתמש — שני סיווגים, שתי קריאות.
      if (serverErr) toast(MSG_LOGIN_ERR + (serverErr.message || serverErr.code || MSG_SERVER_ERR), null, 'bad');
      else showErr(MSG_OFF_FIRST_LOGIN);
      return;
    }
    // «לא במטמון» ו«אין טביעה» אינם «סיסמה שגויה» — הודעה כזו שולחת את המשתמש לנסות סיסמאות שוב ושוב.
    var cu = null;
    try {
      cu = cache.find(function(u){ return u && u.username === username; });
    } catch(eF) { console.warn('[login] cache.find failed:', eF); }
    if (!cu) {
      authLog(false, 'unknown_user_offline', username);
      showErr(MSG_OFF_UNKNOWN);
      return;
    }
    var verdict = await authVerify(cu, pass);
    if (verdict === 'no-fp') {
      authLog(false, 'no_fp_offline', username);
      showErr(MSG_OFF_NO_FP); return;
    }
    if (verdict === 'no-crypto') {
      authLog(false, 'no_crypto_offline', username);
      showErr(MSG_OFF_NO_CRYPTO); return;
    }
    if (verdict !== 'ok') {
      authLog(false, 'wrong_credentials_offline', username);
      showErr(MSG_BAD_LOGIN, 'bad'); return;
    }
    var lu = cu;
    ctxSwitch();
    AUTH.user = lu;
    AUTH.offlineLogin = true;
    authLog(true, 'offline', username);
    // שער השרת — יתחבר כשתהיה רשת, בלי לבקש שוב את הסיסמה
    gateLogin(username, pass);
    toast(serverErr ? MSG_SERVER_DOWN_LOCAL
                    : MSG_OFFLINE_LOGIN_LATER, null, 'bad');
  }
  await afterLogin(permsP);
}

// משיכת ההרשאות — בלי רשת כלל, או בכשל, מחזירה null, ו-loadPerms נופלת לעותק המקומי.
function permsFetch() {
  if (navigator.onLine === false) return Promise.resolve(null);
  try { return Promise.resolve(hrCfgGet('perms', true)).catch(function () { return null; }); }
  catch (e) { return Promise.resolve(null); }
}

// מה שאחרי אימות מוצלח — ההרשאות, הכותרת, תפריט המשתמש והמעבר לבית; משותף לכניסה ולמסירה שאחרי עדכון.
async function afterLogin(permsP) {
  var u = AUTH.user;
  function dbg(msg){ console.log('[login] '+msg); }
  dbg('[2/4] משתמש אומת — טוען הרשאות...');
  gateRenew(); // הצפייה בתגובות — מתחדשת בשקט, גם ברענון מהבאנר
  try { await loadPerms(permsP); } catch(e) { console.warn('[login] loadPerms failed:', e); }
  dbg('[3/4] מנווט לדף הבית...');
  // הסתרת מסך הכניסה והמעבר לבית רצים תמיד; כל עדכון משני עטוף בנפרד —
  // data מוגדר רק בענף המקוון, וקריאה ממנו באופליין זורקת.
  document.getElementById('auth-screen').classList.add('hidden');
  shellBare(false);
  try {
    var wrap = document.getElementById('user-avatar-wrap');
    var hdru = document.getElementById('hdr-username');
    if (hdru) hdru.textContent = u.full_name;
    if (wrap) wrap.classList.remove('hidden');
    var mn = document.getElementById('user-menu-name');
    if (mn) mn.textContent = u.full_name;
    var mr = document.getElementById('user-menu-role');
    if (mr) mr.textContent = AUTH.ROLE_LABELS[u.role] || u.role;
    menuPassSync(u);
    var hr = document.getElementById('hdr-role'); if (hr) hr.textContent = AUTH.ROLE_LABELS[u.role] || '';
  } catch(e) { console.warn('[login] header update failed:', e); }
  try { lkReset(); } catch(e) { console.warn('[login] lkReset:', e); }
  try { initDateFields(); } catch(e) { console.warn('[login] initDateFields:', e); }
  dbg('[4/4] טוען נתונים...');
  shell.showPage('home');
  if (_afterHook) try { _afterHook(); } catch (e) { console.warn('[login] afterHook:', e); }
}
// אחרי הכניסה — המקום שממנו יצאו להיכנס מחדש (התגובות), במקום הבית; נרשם ב-app/main.js
var _afterHook = null;
function onAfterLogin(fn) { _afterHook = fn; }

// ── מסירה ברענון העדכון ──
// המשתמש המחובר בזיכרון בלבד (שורת «המשתמש המחובר» בטבלה), אבל רענון מבאנר העדכון אינו מוציא: לפני הרענון המזהה נמסר
// ב-sessionStorage לחצי דקה, ובעלייה הוא נקרא ונמחק מיד. השורה נבדקת מול הענן — מושבת או שהסיסמה הוחלפה, חוזרים למסך הכניסה;
// בלי רשת — כמו כניסה אופליין, ומאומתת מחדש כשהרשת חוזרת.
var HANDOFF_KEY = 'hr_sw_handoff', HANDOFF_MS = 30000;
function hrHandoffSave() {
  try { if (AUTH.user && AUTH.user.client_id != null) sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ id: String(AUTH.user.client_id), t: Date.now() })); }
  catch (e) { console.warn('[handoff] save', e); }
}
async function hrHandoffResume() {
  var h = null;
  try { h = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null'); sessionStorage.removeItem(HANDOFF_KEY); } catch (e) { return false; }
  var age = h ? Date.now() - Number(h.t) : -1;
  if (!h || !h.id || !(age >= 0 && age < HANDOFF_MS)) return false;
  mirrorLoadOne(authUsersTable());
  var cache = usersGet();
  var cu = Array.isArray(cache) ? cache.find(function (u) { return u && String(u.client_id) === h.id; }) : null;
  if (!cu || cu.active === false) return false;
  var row = null, net = true;
  try {
    var res = await netTimeout(S.SB.from(authUsersTable()).select(AUTH_USER_COLS.join(',')).eq('client_id', h.id).maybeSingle());
    if (res && res.error) { if (isNetErr(res.error)) net = false; else return false; }
    else row = res ? res.data : null;
  } catch (e) { net = false; }
  if (net && (!row || row.active !== true || row.pass_fp !== cu.pass_fp)) return false;
  ctxSwitch();
  AUTH.user = net ? row : cu;
  AUTH.offlineLogin = !net;
  if (net) usersSaveOne(row);
  authLog(true, net ? 'online' : 'offline', AUTH.user.username);
  await afterLogin();
  return true;
}

function doLogout() {
  gateForget();
  ctxSwitch();
  AUTH.user = null;
  lkStop();
  document.getElementById('auth-screen').classList.remove('hidden');
  shellBare(true);
  var wrap = document.getElementById('user-avatar-wrap');
  if (wrap) wrap.classList.add('hidden');
  document.getElementById('auth-user').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-err').textContent = '';
  shell.showPageInternal('home');
}

// permsP — משיכה שכבר יצאה (במקביל לאימות); בלעדיה — נמשכות כאן.
async function loadPerms(permsP) {
  // supabase-js אינו זורק בכשל רשת אלא מחזיר error — חובה לבדוק אותו במפורש.
  // הקריאה דרך hrCfgGet ולא בשאילתה נפרדת: single מסמן מפתח חסר כשגיאה, והמסלול היה נופל לעותק המקומי.
  var res = null;
  try {
    res = await (permsP || permsFetch());
  } catch(e) {
    res = null;
  }
  if (res && res.ok && res.value && !hrSetPending('perms')) {
    try {
      hrApplyPerms(res.value);
      return;
    } catch(eP) { console.warn('[perms] ערך פגום בענן:', eP); }
  }
  try {
    var c = lsGet(HR_PERMS_KEY);
    if (c) {
      hrApplyPerms(JSON.parse(c));
      console.log('[perms] נטען מעותק מקומי', res && res.ok ? '(אין ערך בענן)' : '(אין רשת)');
      return;
    }
  } catch(e2) { console.warn('[perms] עותק מקומי פגום:', e2); }
  console.log('[perms] נטענו ברירות מחדל');
  // ברירות המחדל אינן נכתבות לעותק המקומי — היעדרו אומר שמעולם לא נטענה מטריצה.
  AUTH.perms = AUTH.DEFAULT_PERMS;
}

async function toggleUserMenu() {
  var m = document.getElementById('user-menu');
  if (uiShown(m)) { m.classList.add('hidden'); return; }
  m.classList.remove('hidden');
  var othersEl = document.getElementById('user-menu-others');
  if (!othersEl) return;
  othersEl.innerHTML = '<div class="user-menu-empty">טוען...</div>';
  // בלי timeout התפריט נשאר על «טוען...» לנצח ברשת חצי מחוברת.
  var res = null;
  try { res = await netTimeout(S.SB.from('hr_users').select('client_id,full_name,role').eq('active',true)
    .order('sort',{ascending:true,nullsFirst:false}).order('full_name')); } catch (e) {}
  var data = (res && !res.error) ? res.data : null;
  if (!Array.isArray(data)) { othersEl.innerHTML=''; return; }
  var currentId = AUTH.user ? String(AUTH.user.client_id) : '';
  var others = data.filter(function(u){return String(u.client_id)!==currentId;});
  if (!others.length) { othersEl.innerHTML=''; return; }
  var label = 'החלף משתמש';
  othersEl.innerHTML = '<div class="user-menu-lbl">'+label+'</div>' +
    others.map(function(u){
      return '<button data-uid="'+esc(u.client_id)+'" data-uname="'+esc(u.full_name)+'" data-act="user-switch" class="user-switch"><span class=\"user-switch-ico\">'+icon('user')+'</span><span>'+esc(u.full_name)+'</span></button>';
    }).join('');
}

// שינוי הסיסמה העצמי — למנהל בלבד; סיסמה של מנהל אחר נקבעת בניהול המשתמשים.
function menuPassSync(u) {
  var b = document.getElementById('user-menu-pass');
  if (b) b.classList.toggle('hidden', !isAdminOf(u));
}

function closeUserMenu() {
  document.getElementById('user-menu').classList.add('hidden');
}

function switchUserEl(el) {
  if (!el) return;
  switchUser(Number(el.getAttribute('data-uid')), el.getAttribute('data-uname') || '');
}

function switchUser(id, name) {
  closeUserMenu();
  var subTitle = 'הכנס סיסמא';
  var cancelTxt = 'ביטול';
  var enterTxt = 'כניסה';
  S._hrSwitchId = id;
  openModal(MSG_SWITCH_TITLE,
    '<div class="switch-name" id="switch-name"></div>'+
    '<div class="switch-sub">'+subTitle+'</div>'+
    '<input type="password" aria-label="סיסמת המשתמש שאליו עוברים" id="switch-pass" placeholder="סיסמה" maxlength="6" inputmode="numeric" autocomplete="current-password" class="switch-pass">'+
    '<div id="switch-err" class="switch-err"></div>',
    '<button data-act="modal-close" class="md-btn-ghost-lg">'+cancelTxt+'</button>'+
    '<button data-act="switch-confirm" data-ksave class="md-btn-primary-lg">'+enterTxt+'</button>', icon('user'));
  document.getElementById('switch-name').textContent = name;
  document.getElementById('switch-pass').focus();
}

async function confirmSwitch() {
  var pass=document.getElementById('switch-pass').value.trim();
  var errEl=document.getElementById('switch-err');
  if(!pass){errEl.textContent=MSG_SWITCH_NEED_PASS;return;}
  var res=null, netFail=false;
  // כמו בכניסה: ההרשאות במקביל, ובלי רשת כלל — ישר לעותק שבמכשיר.
  var permsP=permsFetch();
  try {
    if(navigator.onLine===false) throw new Error('offline');
    res=await netTimeout(S.SB.from(authUsersTable()).select(AUTH_USER_COLS.join(',')).eq('client_id',S._hrSwitchId).eq('active',true).single(), HR_LOGIN_NET_MS);
  } catch(eSw){ netFail=true; }
  if(!netFail&&res&&res.error&&isNetErr(res.error)) netFail=true;
  var u=null;
  // .single() מחזיר error גם כשאין שורה — אין כאן תשובה סמכותית, וכל כישלון מנסה את העותק המקומי.
  if(netFail){
    // המטמון מחזיק את כל המשתמשים הפעילים, ולכן החלפה אופליין עובדת;
    // מצבי כישלון שאינם «סיסמה שגויה» מקבלים הודעה משלהם.
    var cache=usersGet();
    var cu=null;
    try {
      cu=(Array.isArray(cache)?cache:[]).find(function(x){return x&&String(x.client_id)===String(S._hrSwitchId);});
    } catch(eF){ console.warn('[switch] cache.find failed:', eF); cu=null; }
    if(!cu){authLog(false,'switch_unknown_user_offline',String(S._hrSwitchId));errEl.textContent=MSG_OFF_UNKNOWN;return;}
    var verdict=await authVerify(cu,pass);
    if(verdict==='no-fp'){authLog(false,'switch_no_fp_offline',cu.username);errEl.textContent=MSG_OFF_NO_FP;return;}
    if(verdict==='no-crypto'){authLog(false,'switch_no_crypto_offline',cu.username);errEl.textContent=MSG_OFF_NO_CRYPTO;return;}
    if(verdict!=='ok'){authLog(false,'switch_wrong_credentials_offline',cu.username);errEl.textContent=MSG_SWITCH_WRONG_PASS;return;}
    u=cu;
    AUTH.offlineLogin=true;
  } else {
    if(res.error||!res.data){authLog(false,'switch_wrong_credentials_online',String(S._hrSwitchId));errEl.textContent=MSG_SWITCH_WRONG_PASS;return;}
    var vOn=await authVerify(res.data,pass);
    if(vOn==='no-fp'){authLog(false,'switch_no_fp_online',res.data.username);errEl.textContent=MSG_NO_FP_ONLINE;return;}
    if(vOn==='no-crypto'){authLog(false,'switch_no_crypto_online',res.data.username);errEl.textContent=MSG_NO_CRYPTO;return;}
    if(vOn!=='ok'){authLog(false,'switch_wrong_credentials_online',res.data.username);errEl.textContent=MSG_SWITCH_WRONG_PASS;return;}
    u=res.data;
    AUTH.offlineLogin=false;
    // u נשמר במפורש — הרענון המלא רץ מ-authLog, אחרי AUTH.user=u.
    usersSaveOne(u);
  }
  var _gatePass = pass;
  closeModal();
  ctxSwitch();
  AUTH.user=u;
  authLog(true,AUTH.offlineLogin?'switch_offline':'switch_online',u.username);
  if(_gatePass) gateLogin(u.username,_gatePass);
  await loadPerms(permsP);
  var hdru=document.getElementById('hdr-username');
  if(hdru) hdru.textContent=u.full_name;
  var mn=document.getElementById('user-menu-name');
  if(mn) mn.textContent=u.full_name;
  var mr=document.getElementById('user-menu-role');
  if(mr) mr.textContent=AUTH.ROLE_LABELS[u.role]||u.role;
  menuPassSync(u);
  lkReset();
  shell.showPage('home');
  toast(MSG_SWITCHED_AS+u.full_name, null, 'good');
}

// נקרא אחרי הכניסה ולא בעלייה.
function initDateFields(){
  var dpEl=document.getElementById('dp');
  var rmEl=document.getElementById('rm');
  if(dpEl) dpEl.value=dayToday();
  if(rmEl) rmEl.value=dayToday().substring(0,7);
  // שם היום מורכב כאן ולא במנוע — המנוע מחזיר תאריך עברי, ושם היום הוא לוח לועזי.
  // בכותרת — היום בשבוע מעל, והתאריך העברי בגדול.
  var dwEl=document.getElementById('hdr-dow'), hdEl=document.getElementById('hdr-date');
  var _now=new Date();
  if(dwEl) dwEl.textContent='יום '+HEB_DOW[_now.getDay()];
  if(hdEl) hdEl.textContent=hebrewDate(_now);
}

export { closeUserMenu, confirmSwitch, doLogin, doLogout, hrHandoffResume, hrHandoffSave, loadPerms, screenLoginHTML,
         switchUserEl, toggleUserMenu, onAfterLogin };
