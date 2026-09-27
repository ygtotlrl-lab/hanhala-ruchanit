// app/screens/login.js — הכניסה, תפריט המשתמש והחלפת משתמש
import { MSG_FILL_LOGIN, MSG_LOGIN_ERR, MSG_NO_CRYPTO, MSG_OFF_NO_CRYPTO, MSG_OFF_NO_FP,
         MSG_OFF_UNKNOWN, MSG_SERVER_ERR, dayToday, isNetErr,
         withTimeout } from '../../core/util.js';
import { ctxSwitch } from '../../core/sync.js';
import { lsGet } from '../../core/storage.js';
import { mirrorLoadOne } from '../../core/mirror.js';
import { AUTH_USER_COLS, authLog, authUsersTable, authVerify, lkReset, lkStop, usersGet,
         usersSaveOne } from '../../core/auth.js';
import { closeModal, esc, openModal, shellBare, toast } from '../../core/ui.js';
import { HEB_DOW, hebrewDate } from '../../core/hebrew.js';
import { HR_PERMS_KEY, MSG_BAD_LOGIN, MSG_NO_FP_ONLINE, MSG_OFFLINE_LOGIN_LATER,
         MSG_OFF_FIRST_LOGIN, MSG_SERVER_DOWN_LOCAL, MSG_SWITCHED_AS,
         MSG_SWITCH_NEED_PASS, MSG_SWITCH_TITLE,
         MSG_SWITCH_WRONG_PASS } from '../config.js';
import { AUTH, S } from '../state.js';
import { hrApplyPerms, hrCfgGet, hrSetPending } from '../domain.js';
import { sortUsersByOrder } from './settings.js';
import { SB, showPage, showPageInternal, uiShown } from '../main.js';

// ── המסכים ──
// mountView() מציירת אותם לפני כל קוד שמחפש אלמנט בתוכם — אין להזיז את הקריאה אליה מטה.
function screenLoginHTML() {
  return `
<div id="auth-screen">
  <div class="auth-box ksave">
    <div class="auth-logo"><img src="icons/icon-512.092edf48.png" alt="לוגו"></div>
    <div class="auth-title">הנהלה רוחנית</div>
    <div class="auth-sub">מערכת ניהול הישיבה</div>
    <div class="auth-field"><label for="auth-user">שם משתמש</label><input aria-label="שם משתמש" type="text" id="auth-user" placeholder="שם משתמש" autocomplete="username"></div>
    <div class="auth-field"><label for="auth-pass">סיסמה (6 ספרות)</label><input type="password" id="auth-pass" placeholder="••••••" maxlength="6" inputmode="numeric" autocomplete="current-password"></div>
    <button class="auth-btn" id="auth-btn" data-act="login" data-busy="⏳ בודק…" data-ksave>כניסה למערכת</button>
    <div class="auth-err" id="auth-err"></div>
    <div class="auth-spinner" id="auth-spinner"></div>

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
      var sp = document.getElementById('auth-spinner'); if (sp) sp.classList.remove('on');
    } catch (e2) {}
  }
}

async function _doLoginInner() {
  // טעינת המראה כאן ולא בעלייה — העלייה רצה אחרי הכניסה, והכניסה האופליין היא הקוראת הראשונה.
  mirrorLoadOne(authUsersTable());
  var username = document.getElementById('auth-user').value.trim();
  var pass = document.getElementById('auth-pass').value.trim();
  var errEl   = document.getElementById('auth-err');
  var spinner = document.getElementById('auth-spinner');
  function showErr(msg){ errEl.textContent=msg; spinner.classList.remove('on'); }
  function startLoad(){ errEl.textContent=''; spinner.classList.add('on'); }
  function stopLoad(){ spinner.classList.remove('on'); }
  function dbg(msg){ console.log('[login] '+msg); }
  errEl.textContent='';
  if (!username || !pass) { showErr(MSG_FILL_LOGIN); return; }
  startLoad();
  dbg('⏳ [1/4] שולח בקשה לשרת...');
  var res = null, netFail = false;
  try {
    // השורה נשלפת לפי שם המשתמש בלבד וההכרעה מול הטביעה — סינון לפי סיסמה בשאילתה
    // הופך ערך שבענן למפתח שכל מחזיק מפתח ה-anon יכול לקרוא.
    res = await withTimeout(SB.from(authUsersTable())
      .select(AUTH_USER_COLS.join(','))
      .eq('username', username)
      .eq('active', true)
      .maybeSingle());
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
  } else if (authoritativeNo) {
    authLog(false, 'wrong_credentials_online', username);
    showErr('❌ ' + MSG_BAD_LOGIN); return;
  } else {
    // שגיאת שרת (פרויקט מושהה, מפתח פג, RLS) אינה תשובה סמכותית — ולכן מנסים את העותק המקומי.
    dbg(netFail ? 'אין רשת — מנסה אימות מקומי (מראת המשתמשים)'
               : 'שגיאת שרת — מנסה אימות מקומי (מראת המשתמשים)');
    authLog(false, netFail ? 'net_error' : 'server_error', username);
    var cache = usersGet();
    // Array.isArray ולא length — ערך JSON שאינו מערך עובר את length, ו-find זורק בשקט והספינר נתקע.
    if (!Array.isArray(cache) || !cache.length) {
      authLog(false, 'no_cache_offline', username);
      // שגיאת שרת בטוסט, והיעדר מטמון על משטח המשתמש — שני סיווגים, שתי קריאות.
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
      showErr('❌ ' + MSG_BAD_LOGIN); return;
    }
    var lu = cu;
    ctxSwitch();
    AUTH.user = lu;
    AUTH.offlineLogin = true;
    authLog(true, 'offline', username);
    toast(serverErr ? MSG_SERVER_DOWN_LOCAL
                    : MSG_OFFLINE_LOGIN_LATER, null, 'bad');
  }
  var u = AUTH.user;
  dbg('⏳ [2/4] משתמש אומת — טוען הרשאות...');
  try { await loadPerms(); } catch(e) { console.warn('[login] loadPerms failed:', e); }
  dbg('⏳ [3/4] מנווט לדף הבית...');
  stopLoad();
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
    var hr = document.getElementById('hdr-role'); if (hr) hr.textContent = AUTH.ROLE_LABELS[u.role] || '';
  } catch(e) { console.warn('[login] header update failed:', e); }
  try { lkReset(); } catch(e) { console.warn('[login] lkReset:', e); }
  try { initDateFields(); } catch(e) { console.warn('[login] initDateFields:', e); }
  dbg('⏳ [4/4] טוען נתונים...');
  showPage('home');
}

function doLogout() {
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
  showPageInternal('home');
}

async function loadPerms() {
  // supabase-js אינו זורק בכשל רשת אלא מחזיר error — חובה לבדוק אותו במפורש.
  // הקריאה דרך hrCfgGet ולא בשאילתה נפרדת: single מסמן מפתח חסר כשגיאה, והמסלול היה נופל לעותק המקומי.
  var res = null;
  try {
    res = await hrCfgGet('perms', true);
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
  try { res = await withTimeout(SB.from('hr_users').select('client_id,full_name,role').eq('active',true).order('full_name')); } catch (e) {}
  var data = (res && !res.error) ? res.data : null;
  if (!Array.isArray(data)) { othersEl.innerHTML=''; return; }
  data = sortUsersByOrder(data);
  var currentId = AUTH.user ? String(AUTH.user.client_id) : '';
  var others = data.filter(function(u){return String(u.client_id)!==currentId;});
  if (!others.length) { othersEl.innerHTML=''; return; }
  var label = 'החלף משתמש';
  othersEl.innerHTML = '<div class="user-menu-lbl">'+label+'</div>' +
    others.map(function(u){
      return '<button data-uid="'+esc(u.client_id)+'" data-uname="'+esc(u.full_name)+'" data-act="user-switch" class="user-switch"><span class=\"user-switch-ico\">👤</span><span>'+esc(u.full_name)+'</span></button>';
    }).join('');
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
    '<input type="password" aria-label="סיסמת המשתמש שאליו עוברים" id="switch-pass" placeholder="סיסמא (6 ספרות)" maxlength="6" inputmode="numeric" autocomplete="current-password" class="switch-pass">'+
    '<div id="switch-err" class="switch-err"></div>',
    '<button data-act="modal-close" class="md-btn-ghost-lg">'+cancelTxt+'</button>'+
    '<button data-act="switch-confirm" data-ksave class="md-btn-primary-lg">'+enterTxt+'</button>');
  document.getElementById('switch-name').textContent = name;
  document.getElementById('switch-pass').focus();
}

async function confirmSwitch() {
  var pass=document.getElementById('switch-pass').value.trim();
  var errEl=document.getElementById('switch-err');
  if(!pass){errEl.textContent=MSG_SWITCH_NEED_PASS;return;}
  var res=null, netFail=false;
  try {
    res=await withTimeout(SB.from(authUsersTable()).select(AUTH_USER_COLS.join(',')).eq('client_id',S._hrSwitchId).eq('active',true).single());
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
  closeModal();
  ctxSwitch();
  AUTH.user=u;
  authLog(true,AUTH.offlineLogin?'switch_offline':'switch_online',u.username);
  await loadPerms();
  var hdru=document.getElementById('hdr-username');
  if(hdru) hdru.textContent=u.full_name;
  var mn=document.getElementById('user-menu-name');
  if(mn) mn.textContent=u.full_name;
  var mr=document.getElementById('user-menu-role');
  if(mr) mr.textContent=AUTH.ROLE_LABELS[u.role]||u.role;
  lkReset();
  showPage('home');
  toast(MSG_SWITCHED_AS+u.full_name, null, 'good');
}

// נקרא אחרי הכניסה ולא בעלייה.
function initDateFields(){
  var dpEl=document.getElementById('dp');
  var rmEl=document.getElementById('rm');
  if(dpEl) dpEl.value=dayToday();
  if(rmEl) rmEl.value=dayToday().substring(0,7);
  // שם היום מורכב כאן ולא במנוע — המנוע מחזיר תאריך עברי, ושם היום הוא לוח לועזי.
  var hdEl=document.getElementById('hdate');
  var _now=new Date();
  if(hdEl) hdEl.textContent='יום '+HEB_DOW[_now.getDay()]+', '+hebrewDate(_now);
}

export { closeUserMenu, confirmSwitch, doLogin, doLogout, loadPerms, screenLoginHTML,
         switchUserEl, toggleUserMenu };
