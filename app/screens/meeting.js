// app/screens/meeting.js — שיבוץ לאסיפת הורים: הדיאלוג שמהמצבה, התגובות (השיבוצים) והגדרות האסיפה — כמו טופס הרישום ובאותו שער.
// הדף עצמו — app/meeting.html, ציבורי: מספר הזהות של התלמיד פותח אותו (התלמיד והשיעור — מהמצבה, בשער), ובו עד שני רבנים ולכל אחד שעה פנויה.
// ההגדרה — meeting_cfg: התאריך · משעה ועד שעה · אורך פגישה · פתוח לשיבוץ · טלפון המזכירות · הרבנים (שם · תפקיד · שיעורים; בלי שיעור — לכולם).
import { ask, dragDef, esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { HR_CLS_NAME } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { canEdit, hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { contactsUrl } from './contacts.js';
import { gatePassHTML } from './enroll.js';
import { gateCall, gateLogin } from '../gate.js';
import { hrDayHebFmt } from '../domain.hebdate.js';

var MT_KEY = 'meeting_cfg';
var MT_CLS = ['a', 'b', 'g'];
function _gate(action, body) { return gateCall('meeting', action, body); }

// ── הדיאלוג שמהמצבה ──
function meetingUrl() { return contactsUrl().replace(/contacts\.html$/, 'meeting.html'); }
function meetingOpen() {
  openModal('שיבוץ לאסיפת הורים',
    '<div class="en-menu">' +
      '<button class="en-tile" data-act="mt-view">' + icon('watch') + 'צפייה בדף</button>' +
      '<button class="en-tile" data-act="mt-copy">' + icon('copy') + 'העתקת קישור</button>' +
      '<button class="en-tile" data-act="mt-resp">' + icon('table') + 'התגובות</button>' +
      '<button class="en-tile" data-act="mt-settings">' + icon('settings') + 'הגדרות האסיפה</button>' +
    '</div>', '', 'meeting');
}
function meetingView() {
  openModal('שיבוץ לאסיפת הורים', '<iframe class="ct-frame" src="app/meeting.html" title="שיבוץ לאסיפת הורים"></iframe>', '', 'watch');
}
async function meetingCopy() {
  var u = meetingUrl(), ok = false;
  try { await navigator.clipboard.writeText(u); ok = true; } catch (e) {
    var t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    t.remove();
  }
  toast(ok ? 'הקישור הועתק' : u, null, ok ? 'good' : null);
}

// ── התצורה ──
function _uid() { return 'm' + Math.random().toString(36).slice(2, 8); }
// הרבנים מאנשי הקשר: ר"מ ומשפיע של כל שיעור, ולכל השיעורים — ראש הישיבה, המשגיח הראשי ומנהל הלימודים
function _staffFromContacts() {
  var v = hrCfgLocalGet('contacts'), groups = (v && v.groups) || [], out = [], byRole = {};
  groups.forEach(function (g) { (g.rows || []).forEach(function (r) { if (r.role && r.name) byRole[r.role] = byRole[r.role] || r.name; }); });
  var real = function (n) { return byRole[n] || n; }; // שם שהוא שם של תפקיד — שמו של בעל התפקיד
  function add(name, role, cls) {
    name = real(name);
    var cur = out.filter(function (x) { return x.name === name; })[0];
    if (cur) { if (!cls.length) cur.cls = []; else if (cur.cls.length) cls.forEach(function (c) { if (cur.cls.indexOf(c) < 0) cur.cls.push(c); }); return; }
    out.push({ id: _uid(), name: name, role: role, cls: cls.slice() });
  }
  groups.forEach(function (g) {
    (g.rows || []).forEach(function (r) {
      if (!r.name) return;
      var role = String(r.role || '');
      if (/ראש הישיבה/.test(role) || /משגיח ראשי/.test(role) || /מנהל הלימודים/.test(role)) add(r.name, role, []);
    });
  });
  groups.forEach(function (g) {
    if (MT_CLS.indexOf(g.cls) < 0) return;
    (g.rows || []).forEach(function (r) { if ((r.rp === 'n3' || r.rp === 'n4') && r.name) add(r.name, String(r.role || ''), [g.cls]); });
  });
  return out;
}
function _phone() {
  var v = hrCfgLocalGet('contacts'), p = '';
  ((v && v.groups) || []).forEach(function (g) { (g.rows || []).forEach(function (r) { if (!p && /מזכיר/.test(r.role || '') && r.phone) p = r.phone; }); });
  return p;
}
function meetingCfg() {
  var v = hrCfgLocalGet(MT_KEY);
  if (v && Array.isArray(v.staff)) return v;
  return { date: '', from: '17:00', to: '21:00', slot: 10, open: false, phone: _phone(), staff: _staffFromContacts() };
}

// ── התגובות — השיבוצים, לפי רב ושעה ──
async function meetingResponses() {
  openModal('התגובות — שיבוץ לאסיפת הורים', '<div class="en-full" id="mt-resp"><div class="ld">טוען…</div></div>', '', 'table');
  var r = await _gate('list');
  var box = document.getElementById('mt-resp');
  if (!box) return;
  if (r.login) { box.innerHTML = gatePassHTML('mt-pass'); return; }
  if (r.perm) { box.innerHTML = '<div class="ld">אין לך הרשאה לתגובות.</div>'; return; }
  if (r.net || r.error) { box.innerHTML = '<div class="ld">אין חיבור לשרת — התגובות נקראות רק עם רשת.</div><button class="retry-btn" data-act="mt-resp">נסה שוב</button>'; return; }
  S._mtRows = r.rows || [];
  _respPaint();
}
async function meetingPass() {
  var el = document.getElementById('en-pass');
  if (!el || !el.value) return;
  if (!navigator.onLine) { toast('אין רשת', null, 'off'); return; }
  var ok = await gateLogin(AUTH.user.username, el.value);
  if (!ok) { toast('הסיסמה שגויה, או שאין חיבור לשרת', null, 'bad'); return; }
  return meetingResponses();
}
function _respPaint() {
  var box = document.getElementById('mt-resp');
  if (!box) return;
  var cfg = meetingCfg(), rows = (S._mtRows || []).filter(function (x) { return !cfg.date || x.meet_date === cfg.date; });
  var edit = canEdit('meeting');
  var staff = cfg.staff.slice();
  rows.forEach(function (x) { if (!staff.some(function (s) { return s.id === x.staff_id; })) staff.push({ id: x.staff_id, name: x.staff_name, role: '' }); });
  var html = '<div class="mt-head">' + esc(cfg.date ? hrDayHebFmt(cfg.date) : '') + ' · ' + rows.length + ' שיבוצים</div>';
  staff.forEach(function (s) {
    var mine = rows.filter(function (x) { return x.staff_id === s.id; }).sort(function (a, b) { return a.slot < b.slot ? -1 : 1; });
    html += '<div class="mt-staff"><div class="mt-sname">' + esc(s.name) + (s.role ? ' <span>' + esc(s.role) + '</span>' : '') + ' <b>' + mine.length + '</b></div>' +
      (mine.length ? '<table class="en-tbl mt-tbl"><tbody>' + mine.map(function (x) {
        return '<tr><td class="mt-t">' + esc(x.slot) + '</td><td>' + esc(x.student_name) + '</td><td>' + esc(HR_CLS_NAME[x.cls] || '') + '</td>' +
          '<td class="en-acts">' + (edit ? '<button class="row-del-btn" data-act="mt-del" data-id="' + esc(x.client_id) + '" aria-label="ביטול השיבוץ">' + icon('del') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="ld">אין שיבוצים</div>') + '</div>';
  });
  box.innerHTML = html;
}
async function meetingDelete(el) {
  var id = el.getAttribute('data-id');
  var row = (S._mtRows || []).filter(function (x) { return x.client_id === id; })[0];
  if (!row) return;
  if (!(await ask('ביטול שיבוץ', 'לבטל את השיבוץ של ' + row.student_name + ' אצל ' + row.staff_name + ' בשעה ' + row.slot + '?', 'ביטול השיבוץ', 'del'))) return;
  var r = await _gate('delete', { id: id });
  if (!r || !r.ok) { toast('הביטול נכשל — אין חיבור לשרת', null, 'bad'); return; }
  S._mtRows = (S._mtRows || []).filter(function (x) { return x.client_id !== id; });
  _respPaint();
}

// ── הגדרות האסיפה — נשמרות מיד (data-autosave) ──
function _staffRow(s) {
  return '<div class="en-frow mt-srow" data-drag="mts" data-sid="' + esc(s.id) + '">' +
    '<span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<div class="en-fbody"><div class="mt-sline"><input data-k="name" aria-label="שם" placeholder="שם הרב" value="' + esc(s.name || '') + '">' +
      '<input data-k="role" aria-label="תפקיד" placeholder="תפקיד" value="' + esc(s.role || '') + '"></div>' +
      '<div class="mt-cls">' + MT_CLS.map(function (c) {
        return '<label class="chk-inline"><input type="checkbox" data-k="cls" value="' + c + '"' + ((s.cls || []).indexOf(c) >= 0 ? ' checked' : '') + '>' + esc(HR_CLS_NAME[c]) + '</label>';
      }).join('') + '<span class="mt-hint">בלי סימון — לכל השיעורים</span></div></div>' +
    '<button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
async function meetingSettings() {
  if (!canEdit('meeting')) { shell.showDenied(); return; }
  _settingsPaint(meetingCfg());
  try {
    var r = await hrCfgGet(MT_KEY, true);
    if (r && r.ok && r.value && !hrSetPending(MT_KEY)) {
      var box = document.getElementById('mt-set');
      if (box && !box.contains(document.activeElement)) _settingsPaint(r.value);
    }
  } catch (e) { console.warn('[meeting] משיכת התצורה נכשלה', e); }
}
function _settingsPaint(cfg) {
  var html = '<div class="en-cfg" id="mt-set" data-autosave="mt-save">' +
    '<label class="chk-inline mt-open"><input type="checkbox" id="mt-open"' + (cfg.open ? ' checked' : '') + '>פתוח לשיבוץ</label>' +
    '<div class="ss-t">מועד האסיפה</div>' +
    '<div class="mt-when"><label>תאריך<input type="date" id="mt-date" value="' + esc(cfg.date || '') + '"></label>' +
      '<label>משעה<input type="time" id="mt-from" value="' + esc(cfg.from || '17:00') + '"></label>' +
      '<label>עד שעה<input type="time" id="mt-to" value="' + esc(cfg.to || '21:00') + '"></label>' +
      '<label>דקות לפגישה<input type="number" id="mt-slot" min="5" max="60" step="5" value="' + (cfg.slot || 10) + '"></label></div>' +
    '<label class="mt-ph">טלפון המזכירות (בהודעה כשהשיבוץ סגור)<input type="tel" id="mt-phone" dir="ltr" value="' + esc(cfg.phone || '') + '"></label>' +
    '<div class="ss-t">הרבנים</div>' +
    '<div class="en-fields" id="mt-staff">' + (cfg.staff || []).map(_staffRow).join('') + '</div>' +
    '<div class="in-adds"><button class="add-dashed-btn" data-act="mt-staff-add">+ הוספת רב</button>' +
      '<button class="add-dashed-btn" data-act="mt-staff-fill">מילוי מאנשי הקשר</button></div></div>';
  var bd = document.getElementById('mt-set');
  if (bd) bd.outerHTML = html;
  else openModal('הגדרות האסיפה — שיבוץ לאסיפת הורים', html, '', 'settings');
}
function meetingStaffAdd() {
  var box = document.getElementById('mt-staff'); if (!box) return;
  box.insertAdjacentHTML('beforeend', _staffRow({ id: _uid(), name: '', role: '', cls: [] }));
}
async function meetingStaffFill() {
  if (!(await ask('מילוי מאנשי הקשר', 'רשימת הרבנים תוחלף ברבנים מאנשי הקשר: ר״מ ומשפיע לכל שיעור, וראש הישיבה, המשגיח הראשי ומנהל הלימודים לכל השיעורים.', 'מילוי', 'meeting'))) return;
  var cfg = meetingCfg(); cfg.staff = _staffFromContacts();
  _settingsPaint(cfg); meetingSave();
}
function meetingSave() {
  var v = function (id) { return (document.getElementById(id) || { value: '' }).value; };
  var staff = Array.prototype.map.call(document.querySelectorAll('#mt-staff > [data-sid]'), function (row) {
    return { id: row.getAttribute('data-sid'), name: row.querySelector('[data-k="name"]').value.trim(), role: row.querySelector('[data-k="role"]').value.trim(),
             cls: Array.prototype.map.call(row.querySelectorAll('[data-k="cls"]:checked'), function (x) { return x.value; }) };
  }).filter(function (s) { return s.name; });
  var next = { date: v('mt-date'), from: v('mt-from') || '17:00', to: v('mt-to') || '21:00', slot: Math.max(5, parseInt(v('mt-slot'), 10) || 10),
               open: !!(document.getElementById('mt-open') || {}).checked, phone: v('mt-phone').trim(), staff: staff };
  var p = hrCfgSet(MT_KEY, next);
  toast(MSG_SAVED, null, 'good');
  return p;
}
dragDef('mts', function () { return meetingSave(); });

export { meetingCopy, meetingDelete, meetingOpen, meetingPass, meetingResponses, meetingSave, meetingSettings, meetingStaffAdd,
         meetingStaffFill, meetingView };
