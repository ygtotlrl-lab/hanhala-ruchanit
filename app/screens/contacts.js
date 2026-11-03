// app/screens/contacts.js — אנשי הקשר: העריכה בהגדרות הדוחות, והדף הציבורי contacts.html קורא את אותה הגדרה
import { esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { hrCfgGet, hrCfgLocalGet, hrCfgLocalSet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { HR_CLS_NAME, RP_ROLES, RP_ROLES_BY_CLS } from '../constants.js';

// הכתובת שהגיליון מקשר אליה — הדף הציבורי שליד האפליקציה.
function contactsUrl() {
  var base = (self.APP && self.APP.android && self.APP.android.url) || (location.origin + location.pathname.replace(/[^/]*$/, ''));
  return base.replace(/\/?$/, '/') + 'contacts.html';
}

var CT_CLS = ['a', 'b', 'g'];

// שמות הרבנים בהערות האישיות שבגיליון, לשיעור אחד ({n1: שם, …}); השלוחים — עם שיעור ג׳.
// ר"מ ומשפיע — מהקבוצה שמסומנת בשיעור, והשאר — מכל קבוצה; שם שהוא שם של תפקיד («ראש הישיבה») — שמו של בעל התפקיד.
function contactsStaff(cls) {
  var v = hrCfgLocalGet('contacts'), out = {}, c = cls === 's' ? 'g' : cls;
  ((v && v.groups) || []).forEach(function (g) {
    (g.rows || []).forEach(function (r) {
      var k = r.rp;
      if (!k || !r.name) return;
      if (RP_ROLES_BY_CLS[k] && g.cls !== c) return;
      if (!out[k]) out[k] = r.name;
    });
  });
  RP_ROLES.forEach(function (x) {
    var y = RP_ROLES.find(function (y) { return y[1] === out[x[0]] && y[0] !== x[0]; });
    if (y && out[y[0]]) out[x[0]] = out[y[0]];
  });
  return out;
}

// הדף הציבורי בתוך האפליקציה — בדיאלוג על כל המסך, ולא ניווט: ניווט במעטפת המותקנת מחליף את האפליקציה בדף
function contactsView() {
  openModal('דף אנשי הקשר', '<iframe class="ct-frame" src="contacts.html" title="דף אנשי הקשר"></iframe>', '', 'watch');
}

// הקישור ללוח — להודעה שנשלחת עם הגיליונות; בלי גישה ללוח — הקישור מוצג בהודעה
async function contactsCopyLink() {
  var u = contactsUrl(), ok = false;
  try { await navigator.clipboard.writeText(u); ok = true; }
  catch (e) {
    var t = document.createElement('textarea');
    t.value = u; document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    t.remove();
  }
  toast(ok ? 'הקישור הועתק' : u, null, ok ? 'good' : null);
}

function contactsPaneHTML() {
  return `    <div id="settings-reports" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">${icon('back')}חזרה</button><span>הגדרות דוחות</span></div>
      <div class="ss" data-autosave="ct-save">
        <div class="ss-t">אנשי קשר — צוות הישיבה
          <span class="ct-acts"><button class="btn sm out" data-act="ct-view">${icon('watch')}צפייה בדף</button>
          <button class="btn sm out" data-act="ct-copy">${icon('copy')}העתקת קישור</button></span></div>
        <div class="ct-link">הדף ציבורי ואין ממנו גישה לאפליקציה; הגיליון מקשר אליו:
          <span class="ct-url" id="ct-url"></span></div>
        <div id="ct-edit" class="set-stack"></div>
        <button data-act="ct-group-add" class="add-dashed-btn">+ הוסף קבוצה</button>
        <label class="field-label" for="ct-footer">שורת הכתובת שבתחתית הדף</label>
        <input id="ct-footer" class="input-full" placeholder="כתובת · דוא״ל">
      </div>
    </div>
`;
}

function _rowHTML(r) {
  r = r || {};
  // השדות זה מתחת לזה — תפקיד · שם · טלפון · דוא״ל, ולכל אחד אייקון; ההסרה בפינה
  function fld(f, ic, lbl, extra) {
    return '<label class="ct-fld"><span class="ct-ic">' + icon(ic) + '</span>' +
      '<input aria-label="' + lbl + '" data-f="' + f + '" placeholder="' + lbl + '"' + (extra || '') + ' value="' + esc(r[f] || '') + '"></label>';
  }
  return '<div class="ct-row" data-ct-row>' +
    fld('role', 'ctRole', 'תפקיד') + fld('name', 'user', 'שם') +
    fld('phone', 'ctPhone', 'טלפון', ' inputmode="tel" dir="ltr"') + fld('email', 'ctMail', 'דוא״ל', ' inputmode="email" dir="ltr"') +
    '<label class="ct-fld"><span class="ct-ic">' + icon('ctRole') + '</span><select aria-label="בגיליון" data-f="rp">' +
      '<option value="">לא בגיליון</option>' + RP_ROLES.map(function (x) {
        return '<option value="' + x[0] + '"' + (r.rp === x[0] ? ' selected' : '') + '>בגיליון: ' + esc(x[1]) + '</option>';
      }).join('') + '</select></label>' +
    '<button data-act="row-remove" class="row-del-btn ct-row-del" aria-label="הסרת איש הקשר">' + icon('del') + '</button>' +
  '</div>';
}

function _groupHTML(g) {
  g = g || { title: '', rows: [{}] };
  return '<div class="cfg-card ct-group" data-ct-group>' +
    '<div class="ct-group-head"><input aria-label="שם הקבוצה" data-f="title" class="sess-field" placeholder="שם הקבוצה (למשל: השגחה)" value="' + esc(g.title || '') + '">' +
      '<select aria-label="שיעור" data-f="cls" class="ct-cls"><option value="">בלי שיעור</option>' + CT_CLS.map(function (k) {
        return '<option value="' + k + '"' + (g.cls === k ? ' selected' : '') + '>' + esc(HR_CLS_NAME[k]) + '</option>';
      }).join('') + '</select>' +
      '<button data-act="row-remove" class="row-del-btn" aria-label="הסרת הקבוצה">' + icon('del') + '</button></div>' +
    '<div data-ct-rows>' + (g.rows || []).map(_rowHTML).join('') + '</div>' +
    '<button data-act="ct-row-add" class="add-dashed-btn">+ הוסף איש קשר</button>' +
  '</div>';
}

function _paint(v) {
  var box = document.getElementById('ct-edit');
  if (!box) return;
  var groups = (v && Array.isArray(v.groups)) ? v.groups : [];
  box.innerHTML = groups.map(_groupHTML).join('');
  var f = document.getElementById('ct-footer');
  if (f) f.value = (v && v.footer) || '';
  var u = document.getElementById('ct-url');
  if (u) u.textContent = contactsUrl();
}

async function renderContactsSettings() {
  _paint(hrCfgLocalGet('contacts'));
  var r = null;
  try { r = await hrCfgGet('contacts', true); } catch (e) { r = null; }
  if (r && r.ok && r.value && !hrSetPending('contacts')) {
    hrCfgLocalSet('contacts', r.value); // הפעם הבאה — מיד מהמכשיר
    // שדה שהמשתמש כבר מקליד בו אינו נדרס
    var act = document.activeElement, box = document.getElementById('settings-reports');
    if (!(act && box && box.contains(act) && /INPUT|TEXTAREA/.test(act.tagName))) _paint(r.value);
  }
}

function addContactGroup() {
  var box = document.getElementById('ct-edit');
  if (box) box.insertAdjacentHTML('beforeend', _groupHTML());
}

function addContactRow(btn) {
  var g = btn && btn.closest('[data-ct-group]');
  var rows = g && g.querySelector('[data-ct-rows]');
  if (rows) rows.insertAdjacentHTML('beforeend', _rowHTML());
}

async function saveContacts() {
  var groups = [];
  document.querySelectorAll('#ct-edit [data-ct-group]').forEach(function (g) {
    var title = (g.querySelector('[data-f="title"]') || {}).value || '';
    var cls = (g.querySelector('[data-f="cls"]') || {}).value || '';
    var rows = [];
    g.querySelectorAll('[data-ct-row]').forEach(function (row) {
      var o = {};
      ['role', 'name', 'phone', 'email', 'rp'].forEach(function (k) { o[k] = ((row.querySelector('[data-f="' + k + '"]') || {}).value || '').trim(); });
      if (!o.rp) delete o.rp;
      if (o.name || o.role) rows.push(o);
    });
    if (title.trim() || rows.length) groups.push(cls ? { title: title.trim(), cls: cls, rows: rows } : { title: title.trim(), rows: rows });
  });
  var footer = ((document.getElementById('ct-footer') || {}).value || '').trim();
  await hrCfgSet('contacts', { groups: groups, footer: footer });
  toast(MSG_SAVED, null, 'good');
}

export { addContactGroup, addContactRow, contactsCopyLink, contactsPaneHTML, contactsStaff, contactsUrl, contactsView, renderContactsSettings, saveContacts };
