// app/screens/contacts.js — אנשי הקשר: העריכה בהגדרות הדוחות, והדף הציבורי contacts.html קורא את אותה הגדרה
import { esc, toast } from '../../core/ui.js';
import { hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';

// הכתובת שהגיליון מקשר אליה — הדף הציבורי שליד האפליקציה.
function contactsUrl() {
  var base = (self.APP && self.APP.android && self.APP.android.url) || (location.origin + location.pathname.replace(/[^/]*$/, ''));
  return base.replace(/\/?$/, '/') + 'contacts.html';
}

function contactsPaneHTML() {
  return `    <div id="settings-reports" class="hidden">
      <div class="ptitle"><button data-act="settings-home" class="set-back-btn">${icon('back')}חזרה</button><span>הגדרות דוחות</span></div>
      <div class="ss" data-ks>
        <div class="ss-t">אנשי קשר — צוות הישיבה
          <a class="btn sm out" href="contacts.html" target="_blank" rel="noopener">${icon('watch')}צפייה בדף</a></div>
        <div class="ct-link">הדף ציבורי ואין ממנו גישה לאפליקציה; הגיליון מקשר אליו:
          <span class="ct-url" id="ct-url"></span></div>
        <div id="ct-edit" class="set-stack"></div>
        <button data-act="ct-group-add" class="add-dashed-btn">+ הוסף קבוצה</button>
        <label class="field-label" for="ct-footer">שורת הכתובת שבתחתית הדף</label>
        <input id="ct-footer" class="input-full" placeholder="כתובת · דוא״ל">
        <div class="save-row-end">
          <button data-act="ct-save" class="btn" data-ksave>${icon('save')}שמור אנשי קשר</button>
        </div>
      </div>
    </div>
`;
}

function _rowHTML(r) {
  r = r || {};
  return '<div class="ct-row" data-ct-row>' +
    '<input aria-label="תפקיד" data-f="role" placeholder="תפקיד" value="' + esc(r.role || '') + '">' +
    '<input aria-label="שם" data-f="name" placeholder="שם" value="' + esc(r.name || '') + '">' +
    '<input aria-label="טלפון" data-f="phone" placeholder="טלפון" inputmode="tel" dir="ltr" value="' + esc(r.phone || '') + '">' +
    '<input aria-label="דוא״ל" data-f="email" placeholder="דוא״ל" inputmode="email" dir="ltr" value="' + esc(r.email || '') + '">' +
    '<button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button>' +
  '</div>';
}

function _groupHTML(g) {
  g = g || { title: '', rows: [{}] };
  return '<div class="cfg-card ct-group" data-ct-group>' +
    '<div class="ct-group-head"><input aria-label="שם הקבוצה" data-f="title" class="sess-field" placeholder="שם הקבוצה (למשל: השגחה)" value="' + esc(g.title || '') + '">' +
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
  if (r && r.ok && r.value && !hrSetPending('contacts')) _paint(r.value);
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
    var rows = [];
    g.querySelectorAll('[data-ct-row]').forEach(function (row) {
      var o = {};
      ['role', 'name', 'phone', 'email'].forEach(function (k) { o[k] = ((row.querySelector('[data-f="' + k + '"]') || {}).value || '').trim(); });
      if (o.name || o.role) rows.push(o);
    });
    if (title.trim() || rows.length) groups.push({ title: title.trim(), rows: rows });
  });
  var footer = ((document.getElementById('ct-footer') || {}).value || '').trim();
  await hrCfgSet('contacts', { groups: groups, footer: footer });
  toast('✅ אנשי הקשר נשמרו', null, 'good');
}

export { addContactGroup, addContactRow, contactsPaneHTML, contactsUrl, renderContactsSettings, saveContacts };
