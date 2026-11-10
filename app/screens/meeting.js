// app/screens/meeting.js — שיבוץ לאסיפת הורים: הדיאלוג שמהמצבה, התגובות (השיבוצים) והגדרות האסיפה — כמו טופס הרישום ובאותו שער.
// הדף עצמו — app/meeting.html, ציבורי: מספר הזהות של התלמיד פותח אותו (התלמיד והשיעור — מהמצבה, בשער), ובו עד שני רבנים ולכל אחד שעה פנויה.
// ההגדרה — meeting_cfg: התאריך · משעה ועד שעה · אורך פגישה · פתוח לשיבוץ · טלפון המזכירות · שעות תפוסות; הרבנים — תמיד מאנשי הקשר.
import { ask, esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { HR_CLS_NAME, MSG_UPLOAD_FAIL, MSG_UPLOAD_NEEDS_NET } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { canEdit, hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { contactsUrl } from './contacts.js';
import { gatePassHTML, textsHTML, textsRead } from './enroll.js';
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
// הרבנים — תמיד מאנשי הקשר, כמו בשער (meetStaff): רבני השיעור — ר"מ ושני המשפיעים (n3 · n4 · n5) של כל שיעור,
// והנהלת הישיבה — ראש הישיבה, המשגיח הראשי ומנהל הלימודים; שם שהוא שם של תפקיד — בעל התפקיד, והמזהה — השם.
var MT_MGMT = [/ראש הישיבה/, /משגיח ראשי/, /מנהל הלימודים/];
function meetingStaff() {
  var v = hrCfgLocalGet('contacts'), groups = (v && v.groups) || [], byRole = {}, out = [];
  groups.forEach(function (g) { (g.rows || []).forEach(function (r) { if (r.role && r.name && !byRole[r.role]) byRole[r.role] = r.name; }); });
  function real(n) { return byRole[n] && byRole[n] !== n ? byRole[n] : n; }
  function get(name) { var x = out.filter(function (y) { return y.name === name; })[0]; if (!x) { x = { id: name, name: name, roles: {}, mgmt: '' }; out.push(x); } return x; }
  groups.forEach(function (g) {
    if (MT_CLS.indexOf(g.cls) < 0) return;
    (g.rows || []).forEach(function (r) { if (r.name && ['n3', 'n4', 'n5'].indexOf(r.rp) >= 0) { var x = get(real(String(r.name))); if (!x.roles[g.cls]) x.roles[g.cls] = String(r.role || ''); } });
  });
  groups.forEach(function (g) {
    (g.rows || []).forEach(function (r) { var role = String(r.role || ''); if (r.name && MT_MGMT.some(function (re) { return re.test(role); })) { var x = get(real(String(r.name))); if (!x.mgmt) x.mgmt = role; } });
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
  if (v && v.date !== undefined) return v;
  return { date: '', from: '17:00', to: '21:00', slot: 10, open: false, phone: _phone(), blocked: [] };
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
  var staff = meetingStaff().map(function (s) { return { id: s.id, name: s.name, role: s.mgmt || '' }; });
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
function _blockRow(b) {
  return '<div class="mt-brow" data-blk><label>משעה<input type="time" data-k="from" value="' + esc(b.from || '') + '"></label>' +
    '<label>עד שעה<input type="time" data-k="to" value="' + esc(b.to || '') + '"></label>' +
    '<button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
// הרבנים לקריאה בלבד — מאנשי הקשר; עריכה — בהגדרות הדוחות
function _staffListHTML() {
  var all = meetingStaff();
  var html = MT_CLS.map(function (c) {
    var l = all.filter(function (s) { return s.roles[c]; });
    return '<div class="mt-sgrp"><b>' + esc(HR_CLS_NAME[c]) + '</b>' + l.map(function (s) { return '<span>' + esc(s.name) + ' <i>' + esc(s.roles[c]) + '</i></span>'; }).join('') + '</div>';
  }).join('');
  var m = all.filter(function (s) { return s.mgmt; });
  return html + '<div class="mt-sgrp"><b>הנהלת הישיבה</b>' + m.map(function (s) { return '<span>' + esc(s.name) + ' <i>' + esc(s.mgmt) + '</i></span>'; }).join('') + '</div>';
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
    '<div class="ss-t">מודעת האסיפה</div>' +
    '<input type="hidden" id="mt-flyer" value="' + esc(cfg.flyer || '') + '">' +
    '<div class="mt-flyer">' + (cfg.flyer ? '<img src="' + esc(cfg.flyer) + '" alt="מודעת האסיפה">' : '') +
      '<label class="add-dashed-btn">' + (cfg.flyer ? 'החלפת המודעה' : '+ העלאת מודעה') +
        '<input type="file" accept="image/*" class="hidden" data-chg="mt-flyer-up"></label>' +
      (cfg.flyer ? '<button class="add-dashed-btn" data-act="mt-flyer-del">הסרת המודעה</button>' : '') + '</div>' +
    '<label class="mt-ph">טלפון המזכירות (בהודעה כשהשיבוץ סגור)<input type="tel" id="mt-phone" dir="ltr" value="' + esc(cfg.phone || '') + '"></label>' +
    '<div class="ss-t">שעות תפוסות</div>' +
    '<div class="mt-blocks" id="mt-blocks">' + (cfg.blocked || []).map(_blockRow).join('') + '</div>' +
    '<div class="in-adds"><button class="add-dashed-btn" data-act="mt-block-add">+ הוספת שעות תפוסות</button></div>' +
    '<div class="ss-t">הרבנים — מאנשי הקשר</div>' +
    '<div class="mt-staff-ro">' + _staffListHTML() + '</div>' + textsHTML('meeting', cfg) + '</div>';
  var bd = document.getElementById('mt-set');
  if (bd) bd.outerHTML = html;
  else openModal('הגדרות האסיפה — שיבוץ לאסיפת הורים', html, '', 'settings');
}
// המודעה בראש דף השיבוץ — תמונה בדלי הציבורי hr-public, תחת meeting/, בנתיב חדש בכל העלאה; מחליפים בכל שנה
async function meetingFlyerUpload(input) {
  var f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  if (!navigator.onLine) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return; }
  var ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
  var path = 'meeting/' + Date.now().toString(36) + '.' + ext;
  var res = await S.SB.storage.from('hr-public').upload(path, f, { contentType: f.type || undefined, upsert: false });
  if (!res || res.error) { toast(MSG_UPLOAD_FAIL + ((res && res.error && res.error.message) || ''), null, 'bad'); return; }
  var el = document.getElementById('mt-flyer'); if (el) el.value = S.SB.storage.from('hr-public').getPublicUrl(path).data.publicUrl;
  await meetingSave(); _settingsPaint(meetingCfg());
}
async function meetingFlyerDel() {
  var el = document.getElementById('mt-flyer'); if (el) el.value = '';
  await meetingSave(); _settingsPaint(meetingCfg());
}
function meetingBlockAdd() {
  var box = document.getElementById('mt-blocks'); if (!box) return;
  box.insertAdjacentHTML('beforeend', _blockRow({}));
}
function meetingSave() {
  var v = function (id) { return (document.getElementById(id) || { value: '' }).value; };
  var blocked = Array.prototype.map.call(document.querySelectorAll('#mt-blocks > [data-blk]'), function (row) {
    return { from: row.querySelector('[data-k="from"]').value, to: row.querySelector('[data-k="to"]').value };
  }).filter(function (b) { return b.from && b.to; });
  var next = { date: v('mt-date'), from: v('mt-from') || '17:00', to: v('mt-to') || '21:00', slot: Math.max(5, parseInt(v('mt-slot'), 10) || 10),
               open: !!(document.getElementById('mt-open') || {}).checked, phone: v('mt-phone').trim(), blocked: blocked, flyer: v('mt-flyer'), texts: textsRead(document.getElementById('mt-set')) };
  var p = hrCfgSet(MT_KEY, next);
  toast(MSG_SAVED, null, 'good');
  return p;
}

export { meetingBlockAdd, meetingCopy, meetingFlyerDel, meetingFlyerUpload, meetingDelete, meetingOpen, meetingPass, meetingResponses, meetingSave, meetingSettings, meetingView };
