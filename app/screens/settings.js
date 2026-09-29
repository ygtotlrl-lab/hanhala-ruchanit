// app/screens/settings.js — ההגדרות, המשתמשים וההרשאות
import { MSG_MY_PASS_TITLE, MSG_OFF_NO_CRYPTO, MSG_OFF_NO_FP, MSG_OFF_USER_WRITE,
         MSG_PASS_CUR_BAD, MSG_PASS_SIX, MSG_PASS_UPDATE_FAIL, MSG_PASS_VERIFY_FAIL,
         MSG_SERVER_ERR, uniqHas, withTimeout } from '../../core/util.js';
import { lsSet } from '../../core/storage.js';
import { ROLE_ADMIN, authPassFields, authUsersTable, authVerify, isAdmin, usersRefresh,
         usersSaveOne, writeUser } from '../../core/auth.js';
import { closeModal, esc, openModal, toast, uiNoDialog } from '../../core/ui.js';
import { HR_ORDER_KEY, MSG_ACTION_FAILED, MSG_FILL_ALL_X, MSG_NO_LINK,
         MSG_NO_USER_SESSION, MSG_PASS_MISMATCH_X, MSG_PASS_NEEDS_NET,
         MSG_PASS_UPDATED_NO_FP, MSG_PASS_UPDATED_X, MSG_PERMS_SAVED, MSG_REASONS_SAVED,
         MSG_USER_OFF, MSG_USER_ON, MSG_USER_SAVED, MSG_USER_SAVED_NO_FP,
         MSG_USER_SWITCHED_MID } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { getAbsenceReasons, hrApplyPerms, hrCfgSet, hrTouchLastChanged,
         sortUsersByOrder } from '../domain.js';

function screenSettingsHTML() {
  return `
<div class="pg" id="pg-settings">
  <div class="inner">

    <!-- דף ראשי הגדרות -->
    <div id="settings-home">
      <div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>⚙️ הגדרות מערכת</span></div>
      <div class="set-tiles">
        <button data-act="settings-module" data-mod="students" class="set-module-tile">
          <span class="tile-ico">👥</span>
          <span class="set-module-label">מצבת תלמידים</span>
        </button>
        <button data-act="settings-module" data-mod="attend" class="set-module-tile">
          <span class="tile-ico">✅</span>
          <span class="set-module-label">סדרים</span>
        </button>
        <button data-act="settings-module" data-mod="sleep" class="set-module-tile">
          <span class="tile-ico">🌙</span>
          <span class="set-module-label">זמן שינה</span>
        </button>
        <button data-act="settings-module" data-mod="exams" class="set-module-tile">
          <span class="tile-ico">📝</span>
          <span class="set-module-label">מבחנים</span>
        </button>
        <button data-act="settings-module" data-mod="files" class="set-module-tile">
          <span class="tile-ico">📁</span>
          <span class="set-module-label">תיקים אישיים</span>
        </button>
        <button data-act="settings-module" data-mod="reports" class="set-module-tile">
          <span class="tile-ico">📊</span>
          <span class="set-module-label">דוחות</span>
        </button>
        <button data-act="settings-module" data-mod="system" class="set-module-tile">
          <span class="tile-ico">⚙️</span>
          <span class="set-module-label">הגדרות מערכת</span>
        </button>
      </div>
    </div>

    <!-- הגדרות מצבת תלמידים -->
    <div id="settings-students" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>👥 הגדרות מצבת תלמידים</span></div>
      <div class="ss" data-ks>
        <div class="ss-t">📋 סיבות היעדרות לפי סוג</div>
        <div class="reason-cols">
          <div>
            <div class="reason-head-ok">✅ אישור</div>
            <div id="reasons-approved" class="reason-list"></div>
            <button data-act="absence-reason-add" data-kind="approved" class="reason-add-ok">+ הוסף סיבה</button>
          </div>
          <div>
            <div class="reason-head-warn">⚠️ השעיה</div>
            <div id="reasons-suspended" class="reason-list"></div>
            <button data-act="absence-reason-add" data-kind="suspended" class="reason-add-warn">+ הוסף סיבה</button>
          </div>
          <div>
            <div class="reason-head-bad">🚪 לא שב</div>
            <div id="reasons-left" class="reason-list"></div>
            <button data-act="absence-reason-add" data-kind="left" class="reason-add-bad">+ הוסף סיבה</button>
          </div>
        </div>
        <div class="save-row-start">
          <button class="btn" data-act="absence-reasons-save" data-ksave>💾 שמור</button>
        </div>
      </div>
    </div>

    <!-- הגדרות מודול סדרים -->
    <div id="settings-attend" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>✅ הגדרות סדרים</span></div>
      <div class="ss" data-ks>
        <div class="set-stack">
          <!-- סדרים -->
          <div class="cfg-card">
            <div class="panel-head">📋 רשימת סדרים</div>
            <div id="at-cfg-sessions" class="sess-list"></div>
            <button data-act="at-session-add" class="add-dashed-btn">+ הוסף סדר</button>
          </div>
          <!-- טיפולים -->
          <div class="cfg-card">
            <div class="panel-head">🩺 סוגי טיפולים</div>
            <div id="at-cfg-treats" class="sess-list"></div>
            <button data-act="at-treat-row-add" class="add-dashed-btn">+ הוסף טיפול</button>
          </div>
        </div>
        <div class="save-row-end">
          <button data-act="at-settings-save" class="btn" data-ksave>💾 שמור הגדרות</button>
        </div>
      </div>
    </div>
    <div id="settings-sleep" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>🌙 הגדרות שינה</span></div>
      <div class="ss" data-ks>
        <div class="set-box">
          <div class="panel-head">🩺 סוגי טיפולים</div>
          <div id="sl-cfg-treats" class="sess-list"></div>
          <button data-act="sl-treat-row-add" class="add-dashed-btn">+ הוסף טיפול</button>
        </div>
        <div class="save-row-end">
          <button data-act="sl-settings-save" class="btn" data-ksave>💾 שמור הגדרות</button>
        </div>
      </div>
    </div>
    <div id="settings-exams" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>📝 הגדרות מבחנים</span></div>
      <div class="soon-pane ss">
        <div class="soon-icon">🏗️</div>
        <div class="soon-title">המודול בבנייה</div>
        <p class="soon-text">מקום זה נמצא בבנייה ויפתח בקרוב</p>
      </div>
    </div>
    <div id="settings-files" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>📁 הגדרות תיקים</span></div>
      <div class="soon-pane ss">
        <div class="soon-icon">🏗️</div>
        <div class="soon-title">המודול בבנייה</div>
        <p class="soon-text">מקום זה נמצא בבנייה ויפתח בקרוב</p>
      </div>
    </div>
    <div id="settings-reports" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>📊 הגדרות דוחות</span></div>
      <div class="soon-pane ss">
        <div class="soon-icon">🏗️</div>
        <div class="soon-title">המודול בבנייה</div>
        <p class="soon-text">מקום זה נמצא בבנייה ויפתח בקרוב</p>
      </div>
    </div>

    <!-- הגדרות מערכת - משתמשים והרשאות -->
    <div id="settings-system" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">← חזרה</button><span>⚙️ הגדרות מערכת</span></div>
      <div class="ss" id="ss-users">
        <div class="ss-t">👥 ניהול משתמשים <button class="btn sm" data-act="user-add-open">➕ הוסף</button></div>
        <div id="users-list"><div class="ld">טוען...</div></div>
      </div>
      <div class="ss" data-ks id="ss-perms">
        <div class="ss-t">🔐 הרשאות לפי תפקיד</div>
        <div class="table-scroll">
          <table class="pt">
            <thead><tr>
              <th>מודול</th><th>מנהל</th><th>צוות בכיר</th><th>צוות</th>
            </tr></thead>
            <tbody id="perm-tbody"></tbody>
          </table>
        </div>
        <div class="save-row-start">
          <button class="btn" data-act="perms-save" data-ksave>💾 שמור הרשאות</button>
        </div>
      </div>
      <!-- אזור מצב — שני האלמנטים האחרונים במסך, בסדר הזה -->
    </div>

  </div>
</div>
`;
}

// נאכפת ביצירה ובשינוי בלבד — אכיפה בכניסה נועלת בחוץ סיסמה תקפה שאינה בתבנית.
var PASS_SIX_RE = /^[0-9]{6}$/;

function showSettingsHome() {
  ['students','attend','sleep','exams','files','reports','system'].forEach(function(m) {
    var el = document.getElementById('settings-'+m);
    if (el) el.classList.add('hidden');
  });
  var h = document.getElementById('settings-home');
  if (h) h.classList.remove('hidden');
}

// אין להוסיף שער סיסמה מעל מסך ההגדרות — ההרשאה נגזרת מהמשתמש המחובר, ושער כזה נופל בהתקנה טרייה לערך ברירת מחדל.
// אין לזרוע ברירת מחדל לסיסמה או לתפקיד בשום מקום — תפקיד נכתב במפורש ביצירת המשתמש.
// כאן ההרשאה נגזרת מ-hr_users.role דרך canAccess, והעמודה NOT NULL בלי DEFAULT.
function showSettingsModule(mod) {
  document.getElementById('settings-home').classList.add('hidden');
  ['students','attend','sleep','exams','files','reports','system'].forEach(function(m) {
    var el = document.getElementById('settings-'+m);
    if (el) el.classList.add('hidden');
  });
  var target = document.getElementById('settings-'+mod);
  if (target) target.classList.remove('hidden');
  if (mod === 'system') { renderUsersList(); renderPermsTable(); }
  if (mod === 'students') { renderAbsenceReasons(); }
  if (mod === 'attend') shell.renderAttendSettings();
  if (mod === 'sleep') shell.renderSleepSettings();
}

async function saveAbsenceReasons() {
  var reasons = {approved:[], suspended:[], left:[]};
  ['approved','suspended','left'].forEach(function(type) {
    // ערך שכבר נאסף אינו נאסף שוב — הרשימה מזינה בורר, ואפשרות כפולה בו אינה ניתנת להבחנה.
    document.querySelectorAll('#reasons-'+type+' input').forEach(function(inp) {
      var v = inp.value.trim();
      if (!v || uniqHas(reasons[type], v)) return;
      reasons[type].push(v);
    });
  });
  console.log('[absence-reasons] saving:', reasons);
  // הטוסט אחרי הכתיבה לדיסק, שסינכרונית בראש hrCfgSet; ההמתנה שאחריה היא הרשת בלבד.
  // ההבטחה מוחזרת כדי שנקודת הניתוב תשחרר את הכפתור לפיה.
  toast(MSG_REASONS_SAVED, null, 'good');
  return hrCfgSet('absence_reasons', reasons);
}

function renderAbsenceReasons() {
  var reasons = getAbsenceReasons();
  ['approved','suspended','left'].forEach(function(type) {
    var el = document.getElementById('reasons-'+type);
    if (!el) return;
    el.innerHTML = '';
    (reasons[type]||[]).forEach(function(r) {
      var row = document.createElement('div');
      row.className = 'edit-row';
      var inp = document.createElement('input');
      inp.value = r;
      inp.className = 'sess-field';
      inp.setAttribute('aria-label', 'סיבה');
      var btn = document.createElement('button');
      btn.textContent = '✕';
      btn.className = 'row-del-btn';
      btn.dataset.act = 'reason-row-del';
      row.appendChild(inp);
      row.appendChild(btn);
      el.appendChild(row);
    });
  });
}

function addAbsenceReason(type) {
  var el = document.getElementById('reasons-'+type);
  if (!el) return;
  var div = document.createElement('div');
  div.className = 'edit-row';
  var inp = document.createElement('input');
  inp.placeholder = 'סיבה חדשה...';
  inp.className = 'sess-field';
  inp.setAttribute('aria-label', 'סיבה חדשה');
  var btn = document.createElement('button');
  btn.textContent = '✕';
  btn.className = 'row-del-btn';
  btn.dataset.act = 'reason-row-del';
  div.appendChild(inp);
  div.appendChild(btn);
  el.appendChild(div);
  inp.focus();
}

// ── מסך ההגדרות ──
function renderSettings() {
  showSettingsHome();
  var admin = isAdmin();
  var su = document.getElementById('ss-users');
  var sp = document.getElementById('ss-perms');
  if (su) su.classList.toggle('hidden', !admin);
  if (sp) sp.classList.toggle('hidden', !admin);
}

function saveUserOrder(ids) {
  lsSet(HR_ORDER_KEY, JSON.stringify(ids));
}

// ── ניהול משתמשים, הרשאות ושינוי סיסמה ──
// בכל מסלול כתיבה הטביעה נגזרת ליד הסיסמה ובאותה פעולה — גזירה מאוחרת היא חלון
// שבו הכניסה האופליין עובדת עם הסיסמה הקודמת.
function openAddUser() {
  openUserModal('הוסף משתמש');
  document.getElementById('um-role').value = 'junior';
  document.getElementById('um-pass-hint').classList.add('hidden');
  document.getElementById('um-pass-label').textContent = 'סיסמה (6 ספרות) *';
}

function openEditUser(u) {
  openUserModal('ערוך משתמש');
  document.getElementById('um-id').value = u.client_id;
  document.getElementById('um-name').value = u.full_name;
  document.getElementById('um-username').value = u.username;
  document.getElementById('um-role').value = u.role;
  document.getElementById('um-pass-label').textContent = 'סיסמה חדשה (השאר ריק לשמור קיימת)';
}

function userFormHtml() {
  return '<input type="hidden" id="um-id">'+
    '<label for="um-name">שם מלא *</label>'+
    '<input aria-label="ישראל ישראלי" type="text" id="um-name" placeholder="ישראל ישראלי">'+
    '<label for="um-username">שם משתמש * (לכניסה)</label>'+
    '<input aria-label="israel" type="text" id="um-username" placeholder="israel" class="um-username">'+
    '<label for="um-role">תפקיד</label>'+
    '<select id="um-role" class="um-role">'+
      '<option value="admin">מנהל</option>'+
      '<option value="manager">צוות בכיר</option>'+
      '<option value="junior">צוות</option>'+
    '</select>'+
    // אין שדה «סיסמה נוכחית» — אין עמודת סיסמה גלויה לקרוא ממנה.
    '<label id="um-pass-label" for="um-pass">סיסמה חדשה (6 ספרות)</label>'+
    '<input type="password" id="um-pass" placeholder="••••••" maxlength="6" inputmode="numeric" autocomplete="new-password" class="um-pass">'+
    '<div class="um-pass-hint" id="um-pass-hint">השאר ריק כדי לשמור סיסמה קיימת</div>'+
    '<div class="auth-err" id="um-err"></div>';
}

function openUserModal(title) {
  openModal('👤 ' + title, userFormHtml(),
    '<button class="btn out" data-act="modal-close">ביטול</button>'+
    '<button class="btn" data-act="user-save" data-ksave>💾 שמור</button>');
}

// מגן השליחה הכפולה בנקודת הניתוב ולא כאן — שומר שני היה משחרר כפתור שהראשון עוד מחזיק.
async function saveUser() {
  var id = document.getElementById('um-id').value;
  var fullName = document.getElementById('um-name').value.trim();
  var username = document.getElementById('um-username').value.trim();
  var role = document.getElementById('um-role').value;
  var pass = document.getElementById('um-pass').value.trim();
  var errEl = document.getElementById('um-err');
  errEl.textContent = '';
  if (!fullName || !username) { errEl.textContent = 'שם מלא ושם משתמש הם שדות חובה'; return; }
  var obj = {full_name: fullName, username: username, role: role, active: true};
  if (!id && !pass) { errEl.textContent = 'יש להזין סיסמה עבור משתמש חדש'; return; }
  var noFp = false;
  if (pass) {
    if (!PASS_SIX_RE.test(pass)) { errEl.textContent = MSG_PASS_SIX; return; }
    var made = await authPassFields(pass);
    obj.pass_salt = made.pass_salt; obj.pass_fp = made.pass_fp;
    if (!made.pass_fp) noFp = true;
  }
  if (!navigator.onLine) { errEl.textContent = MSG_OFF_USER_WRITE; return; }
  var res;
  try {
    res = await writeUser(id, obj);
  } catch (e) { errEl.textContent = MSG_OFF_USER_WRITE; return; }
  if (!res || res.error) { errEl.textContent = 'שגיאה: ' + ((res && res.error && res.error.message) || MSG_SERVER_ERR); return; }
  // טבלת המשתמשים אינה בשכבת הדחיפה — בלי קידום אות הבדיקה המחזורית השינוי אינו נראה במכשירים אחרים.
  await hrTouchLastChanged();
  closeModal();
  // שתי קריאות ולא אחת — סיווג ההודעה שונה בין שני המסלולים.
  if (noFp) toast(MSG_USER_SAVED_NO_FP, null, 'bad');
  else toast(MSG_USER_SAVED, null, 'good');
  usersRefresh();
  renderUsersList();
}

async function toggleUserActive(id, current) {
  // supabase-js אינו זורק — בלי בדיקת res.error הטוסט הירוק מופיע גם בכישלון.
  if (!navigator.onLine) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
  var res;
  try { res = await writeUser(id, {active: !current}); }
  catch (e) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
  if (res && res.error) {
    toast(MSG_ACTION_FAILED + (res.error.message || res.error.code || MSG_NO_LINK), null, 'bad');
    return;
  }
  // טבלת המשתמשים אינה בשכבת הדחיפה — בלי קידום אות הבדיקה המחזורית השינוי אינו נראה במכשירים אחרים.
  await hrTouchLastChanged();
  // משתמש שהושבת חייב לרדת מהעותק המקומי — אחרת הוא נשאר בר-כניסה אופליין.
  usersRefresh();
  renderUsersList();
  toast(current ? MSG_USER_OFF : MSG_USER_ON, null, 'good');
}

function renderPermsTable() {
  var p = AUTH.perms || AUTH.DEFAULT_PERMS;
  var opts = [
    {v:'edit', l:'✏️ עריכה'},
    {v:'view', l:'👁 צפייה'},
    {v:'none', l:'🚫 חסום'}
  ];
  var html = AUTH.MODULES.map(function(m) {
    var row = '<tr><td>'+m.label+'</td>';
    ['admin','manager','junior'].forEach(function(role) {
      var cur = (p[m.id]||{})[role] || 'none';
      var selHtml = '<select class="ps" aria-label="הרשאה למודול" data-mod="'+m.id+'" data-role="'+role+'">';
      opts.forEach(function(o) {
        selHtml += '<option value="'+o.v+'"'+(cur===o.v?' selected':'')+'>'+o.l+'</option>';
      });
      selHtml += '</select>';
      // מנהל תמיד בעריכה בהגדרות
      if (m.id === 'settings' && role === ROLE_ADMIN) {
        row += '<td><span class="um-edit">✏️ עריכה</span></td>';
      } else {
        row += '<td>'+selHtml+'</td>';
      }
    });
    return row + '</tr>';
  }).join('');
  document.getElementById('perm-tbody').innerHTML = html;
}

async function savePerms() {
  var p = {};
  AUTH.MODULES.forEach(function(m) {
    p[m.id] = {};
    ['admin','manager','junior'].forEach(function(role) {
      var sel = document.querySelector('.ps[data-mod="'+m.id+'"][data-role="'+role+'"]');
      p[m.id][role] = sel ? sel.value : 'none';
    });
    p[m.id]['admin'] = (m.id === 'settings') ? 'edit' : p[m.id]['admin'];
  });
  hrApplyPerms(p);
  await hrCfgSet('perms', p);
  toast(MSG_PERMS_SAVED, null, 'good');
}

// ── שינוי סיסמה אישית ──
// שלושה שדות ולא שניים — שגיאת הקלדה בסיסמה החדשה נועלת את המשתמש בחוץ בלי דרך לגלות מה הוקלד.
function myPasswordModal() {
  var fld = 'mp-fld';
  var lbl = 'mp-lbl';
  openModal(MSG_MY_PASS_TITLE,
    '<label class="' + lbl + '" for="mp-cur">סיסמה נוכחית</label>' +
    '<input type="password" id="mp-cur" maxlength="6" inputmode="numeric" autocomplete="current-password" class="' + fld + '">' +
    '<label class="' + lbl + '" for="mp-new">סיסמה חדשה (6 ספרות)</label>' +
    '<input type="password" id="mp-new" maxlength="6" inputmode="numeric" autocomplete="new-password" class="' + fld + '">' +
    '<label class="' + lbl + '" for="mp-new2">אימות סיסמה חדשה</label>' +
    '<input type="password" id="mp-new2" maxlength="6" inputmode="numeric" autocomplete="new-password" class="' + fld + '">' +
    '<div id="mp-err" class="mp-err"></div>',
    '<button data-act="modal-close" class="md-btn-ghost-lg">ביטול</button>' +
    '<button id="mp-save" data-act="my-pass-save" data-ksave class="md-btn-primary-lg">שמירה</button>');
  document.getElementById('mp-cur').focus();
}

async function changeMyPassword() {
  // המשתמש נלכד בכניסה ולא נקרא מהגלובלי אחרי ההמתנות — נעילה או כניסה מחדש בין הנסיעות לרשת
  // היו מפנות את הכתיבה לשורה של משתמש אחר.
  var _u = AUTH.user;
  if (!_u || !_u.client_id) { toast(MSG_NO_USER_SESSION, null, 'bad'); return; }
  var c1 = document.getElementById('mp-cur');
  var n1 = document.getElementById('mp-new');
  var n2 = document.getElementById('mp-new2');
  if (!c1 || !n1 || !n2) { uiNoDialog('changeMyPassword', 'mp-cur'); return; }
  var oldPass = c1.value.trim(), newPass = n1.value.trim(), newPass2 = n2.value.trim();
  if (!navigator.onLine) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
  if (!oldPass || !newPass || !newPass2) { toast(MSG_FILL_ALL_X, null, 'bad'); return; }
  if (!PASS_SIX_RE.test(newPass)) { toast(MSG_PASS_SIX, null, 'bad'); return; }
  if (newPass !== newPass2) { toast(MSG_PASS_MISMATCH_X, null, 'bad'); return; }
  // לא var {data} — הוא בולע את השגיאה, וכשל רשת היה מוצג כ«הסיסמה הנוכחית שגויה».
  var chk;
  try { chk = await withTimeout(S.SB.from(authUsersTable()).select('client_id,active,pass_salt,pass_fp').eq('client_id', _u.client_id).maybeSingle()); }
  catch (e) { toast(MSG_PASS_NEEDS_NET, null, 'bad'); return; }
  if (chk && chk.error) { toast(MSG_PASS_VERIFY_FAIL + (chk.error.message || MSG_SERVER_ERR), null, 'bad'); return; }
  if (!chk || !chk.data) { toast(MSG_PASS_CUR_BAD, null, 'bad'); return; }
  var vOld = await authVerify(chk.data, oldPass);
  if (vOld === 'no-fp')     { toast('❌ ' + MSG_OFF_NO_FP, null, 'bad'); return; }
  if (vOld === 'no-crypto') { toast('❌ ' + MSG_OFF_NO_CRYPTO, null, 'bad'); return; }
  if (vOld !== 'ok')        { toast(MSG_PASS_CUR_BAD, null, 'bad'); return; }
  var made = await authPassFields(newPass);
  var updObj = { pass_salt: made.pass_salt, pass_fp: made.pass_fp };
  // אין נפילה-חזרה כשעמודות הטביעה חסרות — היא הייתה כותבת סיסמה גלויה; השינוי נכשל בקול.
  var upd;
    // המשתמש המחובר התחלף בזמן השינוי — נכשל-סגור: עדיף שינוי שלא נעשה מסיסמה שנכתבה על חשבון זר.
  if (!AUTH.user || AUTH.user.client_id !== _u.client_id) { toast(MSG_USER_SWITCHED_MID, null, 'bad'); return; }
  try { upd = await writeUser(_u.client_id, updObj); }
  catch (e2) { toast(MSG_OFF_USER_WRITE, null, 'bad'); return; }
  if (upd && upd.error) { toast(MSG_PASS_UPDATE_FAIL + (upd.error.message || MSG_SERVER_ERR), null, 'bad'); return; }
  // טבלת המשתמשים אינה בשכבת הדחיפה — בלי קידום אות הבדיקה המחזורית השינוי אינו נראה במכשירים אחרים.
  await hrTouchLastChanged();
  // בלי זה הטביעה במטמון נשארת של הסיסמה הישנה, והכניסה האופליין מקבלת את הישנה ודוחה את החדשה.
  try {
    usersSaveOne({ client_id: _u.client_id, username: _u.username, full_name: _u.full_name,
                   role: _u.role, active: true,
                   pass_salt: made.pass_salt, pass_fp: made.pass_fp });
  } catch (e3) {}
  // אין ניקוי שדות — closeModal מרוקן את גוף חלון הדו-שיח.
  closeModal();
  if (made.pass_fp) toast(MSG_PASS_UPDATED_X, null, 'good');
  else toast(MSG_PASS_UPDATED_NO_FP, null, 'bad');
}

async function renderUsersList() {
  var el = document.getElementById('users-list');
  if (!el) return;
  el.innerHTML = '<div class="ld">טוען...</div>';
  // לא var {data} = await — פירוק בולע את res.error, וכשל רשת היה מוצג כ«אין משתמשים».
  var res;
  try { res = await withTimeout(S.SB.from('hr_users').select('*').order('full_name')); }
  catch (e) { res = { error: { message: (e && e.message) || 'timeout' } }; }
  if (!res || res.error || !Array.isArray(res.data)) {
    var em = (res && res.error && (res.error.message || res.error.code)) || MSG_NO_LINK;
    el.innerHTML = '<div class="load-err ld">❌ לא ניתן לטעון את רשימת המשתמשים' +
      '<div class="load-err-detail">' + esc(em) + '</div>' +
      '<button data-act="users-render" class="retry-btn">נסה שוב</button></div>';
    return;
  }
  var data = res.data;
  if (!data.length) { el.innerHTML = '<div class="ld">אין משתמשים</div>'; return; }
  data = sortUsersByOrder(data);
  el.innerHTML = data.map(function(u) {
    var roleClass = 'role-'+u.role;
    var roleLabel = AUTH.ROLE_LABELS[u.role] || u.role;
    var activeCls = u.active ? '' : ' is-inactive';
    return '<div class="ur'+activeCls+'" data-row-id="'+esc(u.client_id)+'">' +
      '<div class="ur-name">'+esc(u.full_name)+'<br><small class="user-handle">@'+esc(u.username)+'</small></div>' +
      '<span class="ur-role '+esc(roleClass)+'">'+esc(roleLabel)+'</span>' +
      '<div class="ua">' +
        '<button data-act="user-edit" data-uid="'+esc(u.client_id)+'" data-uname="'+esc(u.full_name)+
        '" data-uusername="'+esc(u.username)+'" data-urole="'+esc(u.role)+'">✏️</button>' +
        '<button data-act="user-up" data-id="'+esc(u.client_id)+'" title="הזז למעלה" class="user-move">⬆️</button>' +
        '<button data-act="user-down" data-id="'+esc(u.client_id)+'" title="הזז למטה" class="user-move">⬇️</button>' +
        '<button data-act="user-toggle" data-id="'+esc(u.client_id)+'" data-active="'+(u.active?'1':'0')+'" title="'+(u.active?'השבת':'הפעל')+'">'+(u.active?'🔴':'🟢')+'</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

export { addAbsenceReason, changeMyPassword, myPasswordModal, openAddUser, openEditUser,
         renderSettings, renderUsersList, saveAbsenceReasons, savePerms, saveUser,
         saveUserOrder, screenSettingsHTML, showSettingsHome, showSettingsModule,
         toggleUserActive };
