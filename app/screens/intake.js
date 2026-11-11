// app/screens/intake.js — קבלה לישיבה: הדיאלוג שמהמצבה, התגובות והגדרות הטופס — כמו טופס הרישום (app/screens/enroll.js), ובאותו שער.
// הטופס עצמו — app/intake.html, דף ציבורי ששולח בלבד (hr_intake · והקבצים דרך השער, במאגר הפרטי תחת intake/). המסמכים לצפייה ולחתימה — בדלי הציבורי hr-public, תחת intake/.
import { ask, closeModal, dragDef, esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { INTAKE_DEFAULT, MSG_UPLOAD_FAIL, MSG_UPLOAD_NEEDS_NET } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { canEdit, hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { respListHTML, respScreenHTML, respSections } from './resp.js';
import { contactsUrl } from './contacts.js';
import { enrollFieldRow, fcRemember, fcSyncRows, gatePassHTML, privacyHTML, textsHTML, textsRead } from './enroll.js';
import { fcCardHTML, fcOnLabel, fcOpenId, fcStatusHTML, fcSw } from './forms.js';
import { gateCall, gateOpen } from '../gate.js';
import { openAddStudent } from './students.js';

var INTAKE_PUBLIC = 'hr-public';
function _gate(action, body) { return gateCall('intake', action, body); }

// ── הדיאלוג שמהמצבה ──
function intakeUrl() { return contactsUrl().replace(/contacts\.html$/, 'intake.html'); }
function intakeView() {
  openModal('קבלה לישיבה', '<iframe class="ct-frame" src="app/intake.html" title="קבלה לישיבה"></iframe>', '', 'watch');
}
async function intakeCopy() {
  var u = intakeUrl(), ok = false;
  try { await navigator.clipboard.writeText(u); ok = true; } catch (e) {
    var t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    t.remove();
  }
  toast(ok ? 'הקישור הועתק' : u, null, ok ? 'good' : null);
}

// ── התצורה ──
function intakeCfg() {
  var v = hrCfgLocalGet('intake_form');
  return (v && Array.isArray(v.fields) && Array.isArray(v.items)) ? v : JSON.parse(JSON.stringify(INTAKE_DEFAULT));
}
function _yearLabel(y) { return hebYearLabelFull(y) || String(y); }
// כל השדות שממלאים — פרטי התלמיד ואחריהם שדות המסמכים לחתימה, בסדרם
function _allFields(cfg) {
  var out = cfg.fields.filter(function (f) { return f.type !== 'section'; });
  (cfg.items || []).forEach(function (it) { (it.fields || []).forEach(function (f) { if (f.type !== 'section') out.push(f); }); });
  return out;
}

// ── התגובות ──
async function intakeResponses() {
  openModal('התגובות — קבלה לישיבה', '<div class="en-full" id="in-resp"><div class="ld">טוען…</div></div>', '', 'table');
  var r = await _gate('list');
  var box = document.getElementById('in-resp');
  if (!box) return;
  if (r.login) { box.innerHTML = gatePassHTML('in-resp'); return; }
  if (r.perm) { box.innerHTML = '<div class="ld">אין לך הרשאה לתגובות.</div>'; return; }
  if (r.net || r.error) { box.innerHTML = '<div class="ld">אין חיבור לשרת — התגובות נקראות רק עם רשת.</div><button class="retry-btn" data-act="in-resp">נסה שוב</button>'; return; }
  S._inRows = r.rows || [];
  if (S._inYear == null) {
    var ys = S._inRows.map(function (x) { return x.school_year; });
    S._inYear = ys.length ? Math.max.apply(null, ys) : null;
  }
  _respPaint();
}
// התגובות — כרטיס לכל מי שמילא (resp.js): פרטי התלמיד, ואחריהם חלק לכל מסמך לחתימה שיש בו שדות
function _respOpts() {
  var cfg = intakeCfg(), rows = S._inRows || [];
  var years = rows.map(function (x) { return x.school_year; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
  var sections = respSections(cfg.fields, 'פרטי התלמיד');
  (cfg.items || []).forEach(function (it) {
    var fs = (it.fields || []).filter(function (f) { return f.type !== 'section'; });
    if (fs.length) sections.push({ title: it.title, fields: fs });
  });
  return {
    p: 'in', edit: canEdit('forms'), track: cfg.track || [], sections: sections,
    rows: rows.filter(function (x) { return S._inYear == null || x.school_year === S._inYear; }),
    years: years.map(function (y) { return { y: y, label: _yearLabel(y), on: y === S._inYear, n: rows.filter(function (x) { return x.school_year === y; }).length }; })
  };
}
function _respPaint() {
  var box = document.getElementById('in-resp');
  if (box) box.innerHTML = respScreenHTML(_respOpts());
}
function _listPaint() {
  var box = document.getElementById('in-list');
  if (box) box.innerHTML = respListHTML(_respOpts());
}
function intakeYear(y) { S._inYear = +y; S._inOpen = null; _respPaint(); }
function intakeOpenRow(el) { var id = el.getAttribute('data-id'); S._inOpen = S._inOpen === id ? null : id; _listPaint(); }
function intakeSearch(v) { S._inQ = v; _listPaint(); }
async function intakeTrack(el) {
  var r = await _gate('track', { id: el.getAttribute('data-in-id'), key: el.getAttribute('data-in-key'), value: el.value });
  if (r && r.ok) {
    var row = (S._inRows || []).filter(function (x) { return x.client_id === el.getAttribute('data-in-id'); })[0];
    if (row) row.track = r.track;
    toast(MSG_SAVED, null, 'good');
  } else toast(r && r.login ? 'נדרשת כניסה מחדש לתגובות' : 'השמירה נכשלה — אין חיבור לשרת', null, 'bad');
}
function intakeFile(el) { return gateOpen(el.getAttribute('data-path')); }
async function intakeDelete(el) {
  var id = el.getAttribute('data-id');
  var row = (S._inRows || []).filter(function (x) { return x.client_id === id; })[0];
  var d = (row && row.data) || {};
  if (!(await ask('מחיקת תגובה', 'למחוק את התגובה של ' + [d.first, d.last].filter(Boolean).join(' ') + '?', 'מחיקה', 'del'))) return;
  var r = await _gate('delete', { id: id });
  if (!r || !r.ok) { toast('המחיקה נכשלה — אין חיבור לשרת', null, 'bad'); return; }
  S._inRows = (S._inRows || []).filter(function (x) { return x.client_id !== id; });
  _respPaint();
}
function intakeAddStudent(el) {
  var row = (S._inRows || []).filter(function (x) { return x.client_id === el.getAttribute('data-id'); })[0];
  if (!row) return;
  var d = row.data || {};
  closeModal();
  openAddStudent();
  var n = document.getElementById('st-name');
  if (n) n.value = [d.first, d.last].filter(Boolean).join(' ');
  var idn = document.getElementById('st-idnum');
  if (idn && d.idnum) idn.value = d.idnum;
}

// ── הגדרות הטופס — נשמרות מיד (data-autosave) ──
// מסמך לצפייה — כותרת וקובץ שהועלה
// מסמך לצפייה — שורה: הכותרת (נערכת במקום) · צפייה, או צירוף כשאין קובץ · הסרה
function _docRow(d) {
  var act = d.url ? '<a class="fc-ib" href="' + esc(d.url) + '" target="_blank" rel="noopener" aria-label="צפייה במסמך" title="צפייה במסמך">' + icon('watch') + '</a>'
    : '<label class="btn sm out en-upl">' + icon('upload') + 'צירוף<input type="file" accept="application/pdf,image/*" data-chg="in-doc-up"></label>';
  return '<div class="fc-doc in-doc" data-drag="ind" data-did="' + esc(d.id) + '" data-url="' + esc(d.url || '') + '">' +
    '<span class="grip" data-grip aria-hidden="true">⠿</span><span class="fc-dic' + (d.url ? '' : ' none') + '">' + icon('doc') + '</span>' +
    '<input data-k="title" class="fc-flat" aria-label="כותרת" placeholder="כותרת המסמך" value="' + esc(d.title || '') + '">' + act +
    '<button data-act="row-remove" class="fc-ib" aria-label="הסרה">' + icon('close') + '</button></div>';
}
// מסמך לחתימה — שורה (הכותרת · מסמך ושדות · פעיל או מוקפא), ולחיצה פותחת: כותרת · המסמך המצורף · «מוקפא» · השדות שלו · הסרה
function _itemRow(it) {
  var nf = (it.fields || []).length, open = _fcOpenI.indexOf(it.id) >= 0 || !it.title;
  var meta = (it.doc ? 'מסמך מצורף' : 'בלי מסמך') + ' · ' + (nf ? nf + ' שדות' : 'אין שדות');
  var doc = it.doc
    ? '<div class="fc-docline">' + icon('doc') + '<span>המסמך המצורף</span><a class="btn sm out" href="' + esc(it.doc) + '" target="_blank" rel="noopener">' + icon('watch') + 'צפייה</a>' +
        '<button type="button" class="btn sm out" data-act="in-item-doc-clear">' + icon('close') + 'הסרה</button></div>'
    : '<label class="add-dashed-btn en-upl">+ צירוף מסמך<input type="file" accept="application/pdf,image/*" data-chg="in-item-doc"></label>';
  return '<div class="fc-f fc-item in-item' + (it.frozen ? ' frz' : '') + (open ? ' open' : '') + '" data-drag="ini" data-iid="' + esc(it.id) + '" data-doc="' + esc(it.doc || '') + '">' +
    '<div class="fc-fr" data-act="fc-fedit"><span class="grip" data-grip aria-hidden="true">⠿</span>' +
      '<span class="fc-fn"><b>' + esc(it.title || 'מסמך חדש') + '</b><small>' + esc(meta) + '</small></span>' +
      '<span class="fc-pill' + (it.frozen ? '' : ' on') + '">' + (it.frozen ? 'מוקפא' : 'פעיל') + '</span><span class="fc-chev">' + icon('down') + '</span></div>' +
    '<div class="fc-fe">' +
      '<div class="fc-lbl">כותרת</div><input data-k="ititle" aria-label="כותרת" placeholder="כותרת" value="' + esc(it.title || '') + '">' + doc +
      '<label class="fc-tg">מוקפא — מוצג באפור בדף, בלי שדות ובלי חובה' + fcSw('data-k="frozen"', it.frozen) + '</label>' +
      '<div class="fc-lbl">השדות של המסמך</div>' +
      '<div class="en-fields fc-fields in-ifields">' + (it.fields || []).map(function (f) { return enrollFieldRow(f, 'inf'); }).join('') + '</div>' +
      '<button class="add-dashed-btn" data-act="in-field-add">+ שדה</button>' +
      '<div class="fc-fact"><button type="button" class="btn sm out fc-del" data-act="row-remove">' + icon('del') + 'הסרת המסמך</button>' +
        '<button type="button" class="btn sm" data-act="fc-fedit">סיום</button></div>' +
    '</div></div>';
}
function _trkRow(t) {
  return '<div class="en-trow" data-drag="int"><span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<input data-k="track" aria-label="עמודה" value="' + esc(t) + '"><button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
async function intakeSettings() {
  if (!canEdit('forms')) { shell.showDenied(); return; }
  _settingsPaint(intakeCfg());
  try {
    var r = await hrCfgGet('intake_form', true);
    if (r && r.ok && r.value && !hrSetPending('intake_form')) {
      var box = document.getElementById('in-set');
      if (box && !box.contains(document.activeElement)) _settingsPaint(r.value);
    }
  } catch (e) { console.warn('[intake] משיכת התצורה נכשלה', e); }
}
// דף ההגדרות: המתג והקישור, ואחריהם כרטיסים מתקפלים — פרטי התלמיד · מסמכים לצפייה · מסמכים לחתימה · עמודות המעקב · הנוסחים בדף
var _fcOpenI = [];
function _settingsPaint(cfg) {
  var old = document.getElementById('in-set'), was = fcOpenId(old);
  fcRemember(old);
  _fcOpenI = old ? Array.prototype.map.call(old.querySelectorAll('.fc-item.open'), function (r) { return r.getAttribute('data-iid'); }) : [];
  var items = cfg.items || [], frz = items.filter(function (i) { return i.frozen; }).length;
  var html = '<div class="en-cfg fc-page" id="in-set" data-autosave="in-save">' +
    fcStatusHTML({ p: 'in', id: 'in-open', on: cfg.open !== false, label: fcOnLabel('in'), url: intakeUrl() }) +
    fcCardHTML({ id: 'fc-in-fields', ico: 'fields', title: 'פרטי התלמיד', open: was === 'fc-in-fields',
      sum: cfg.fields.filter(function (f) { return f.type !== 'section'; }).length + ' שדות',
      body: '<div class="en-fields fc-fields" id="in-fields">' + cfg.fields.map(function (f) { return enrollFieldRow(f, 'inf'); }).join('') + '</div>' +
        '<button class="add-dashed-btn" data-act="in-field-add">+ שדה</button>' }) +
    fcCardHTML({ id: 'fc-in-docs', ico: 'doc', title: 'מסמכים לצפייה', open: was === 'fc-in-docs',
      sum: (cfg.docs || []).length + ' מסמכים',
      body: '<div class="fc-docs" id="in-docs">' + (cfg.docs || []).map(_docRow).join('') + '</div>' +
        '<label class="add-dashed-btn en-upl">+ העלאת מסמך<input type="file" accept="application/pdf,image/*" data-chg="in-doc-new"></label>' }) +
    fcCardHTML({ id: 'fc-in-items', ico: 'sign', title: 'מסמכים לחתימה', open: was === 'fc-in-items',
      sum: items.length + ' מסמכים' + (frz ? ' · ' + frz + ' מוקפא' : ''),
      body: '<div class="fc-fields" id="in-items">' + items.map(_itemRow).join('') + '</div>' +
        '<button class="add-dashed-btn" data-act="in-item-add">+ מסמך לחתימה</button>' }) +
    fcCardHTML({ id: 'fc-in-track', ico: 'track', title: 'עמודות המעקב', open: was === 'fc-in-track',
      sum: (cfg.track || []).length ? (cfg.track || []).length + ' עמודות — בכל תגובה' : 'אין עמודות',
      body: '<div class="en-track" id="in-track">' + (cfg.track || []).map(_trkRow).join('') + '</div>' +
        '<button class="add-dashed-btn" data-act="in-track-add">+ עמודה</button>' }) +
    fcCardHTML({ id: 'fc-in-texts', ico: 'text', title: 'הנוסחים בדף', open: was === 'fc-in-texts',
      sum: 'הודעת הפרטיות · ' + Object.keys(cfg.texts || {}).length + ' טקסטים שונו',
      body: privacyHTML('in-privacy', cfg, INTAKE_DEFAULT.privacy) + textsHTML('intake', cfg) }) +
    '</div>';
  if (old) old.outerHTML = html;
  else openModal('קבלה לישיבה — הגדרות', html, '', 'settings');
}
function _nid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 36 * 36).toString(36); }
// «+ הוספת שדה» — לפרטי התלמיד, או לפריט שהכפתור בתוכו
function intakeFieldAdd(el) {
  var item = el && el.closest ? el.closest('.in-item') : null;
  var box = item ? item.querySelector('.in-ifields') : document.getElementById('in-fields');
  if (box) box.insertAdjacentHTML('beforeend', enrollFieldRow({ id: _nid('f'), type: 'text', label: '', req: false }, 'inf'));
}
function intakeTrackAdd() {
  var box = document.getElementById('in-track');
  if (box) box.insertAdjacentHTML('beforeend', _trkRow(''));
}
function intakeItemAdd() {
  var box = document.getElementById('in-items');
  if (box) box.insertAdjacentHTML('beforeend', _itemRow({ id: _nid('i'), title: '', doc: '', fields: [] }));
}
function intakeItemDocClear(el) {
  var item = el.closest('.in-item');
  if (!item) return;
  item.setAttribute('data-doc', '');
  intakeSave();
  _settingsPaint(intakeCfg());
}
// העלאה לדלי הציבורי — נתיב חדש בכל העלאה; מחזירה את הקישור הציבורי, או null
async function _upload(f) {
  if (!navigator.onLine) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return null; }
  var ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'pdf';
  var path = 'intake/' + Date.now().toString(36) + '.' + ext;
  var res = await S.SB.storage.from(INTAKE_PUBLIC).upload(path, f, { contentType: f.type || undefined, upsert: false });
  if (!res || res.error) { toast(MSG_UPLOAD_FAIL + ((res && res.error && res.error.message) || ''), null, 'bad'); return null; }
  return S.SB.storage.from(INTAKE_PUBLIC).getPublicUrl(path).data.publicUrl;
}
// שלושה מקורות: מסמך חדש לצפייה (in-doc-new) · קובץ למסמך קיים (in-doc-up) · מסמך לפריט (in-item-doc)
async function intakeUpload(input) {
  var f = input.files && input.files[0], kind = input.getAttribute('data-chg');
  if (!f) return;
  var row = kind === 'in-doc-up' ? input.closest('.in-doc') : kind === 'in-item-doc' ? input.closest('.in-item') : null;
  var url = await _upload(f);
  input.value = '';
  if (!url) return;
  if (kind === 'in-doc-new') {
    var box = document.getElementById('in-docs');
    if (box) box.insertAdjacentHTML('beforeend', _docRow({ id: _nid('d'), title: f.name.replace(/\.[^.]+$/, ''), url: url }));
  } else if (row) row.setAttribute(kind === 'in-doc-up' ? 'data-url' : 'data-doc', url);
  var p = intakeSave();
  _settingsPaint(intakeCfg());
  return p;
}
function _readFields(rows, prevAll) {
  var out = [];
  rows.forEach(function (row) {
    function v(k) { var el = row.querySelector(':scope > .fc-fe [data-k="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : null; }
    var o = { id: row.getAttribute('data-fid'), type: v('type') || 'text', label: v('label') || '' };
    if (!o.label) return;
    if (o.type !== 'section') {
      o.req = !!v('req');
      var h = v('help'); if (h) o.help = h;
      if (o.type === 'select') {
        var ol = v('options');
        var prev = prevAll.filter(function (x) { return x.id === o.id; })[0];
        // «אפשרות ראשית» — בשאלת בחירה; תיבה שאינה במסך (סוג שהשתנה זה עתה) — כפי שהייתה
        var ld = v('lead');
        if (ld === null ? (prev && prev.lead) : ld) o.lead = true;
        o.options = ol != null ? ol.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : ((prev && prev.options) || []);
      }
    }
    out.push(o);
  });
  return out;
}
// התצורה נקראת מה-DOM הסופי — הסדר אחרי גרירה, מה שנוסף ומה שהוסר
function intakeSave() {
  var cfg = intakeCfg(), prevAll = _allFields(cfg);
  var fields = _readFields(Array.prototype.slice.call(document.querySelectorAll('#in-fields > [data-fid]')), prevAll);
  var docs = Array.prototype.map.call(document.querySelectorAll('#in-docs > [data-did]'), function (row) {
    return { id: row.getAttribute('data-did'), title: row.querySelector('[data-k="title"]').value.trim(), url: row.getAttribute('data-url') || '' };
  }).filter(function (d) { return d.title || d.url; });
  var items = Array.prototype.map.call(document.querySelectorAll('#in-items > [data-iid]'), function (row) {
    var it = { id: row.getAttribute('data-iid'), title: row.querySelector('[data-k="ititle"]').value.trim(), doc: row.getAttribute('data-doc') || '',
             fields: _readFields(Array.prototype.slice.call(row.querySelectorAll('.in-ifields > [data-fid]')), prevAll) };
    // «מוקפא» — הפריט מוצג באפור, בלי שדות ובלי חובה, עד שמפשירים
    var fz = row.querySelector(':scope > .fc-fe > .fc-tg [data-k="frozen"]');
    if (fz && fz.checked) it.frozen = true;
    return it;
  }).filter(function (it) { return it.title || it.doc || it.fields.length; });
  var track = Array.prototype.map.call(document.querySelectorAll('#in-track [data-k="track"]'), function (x) { return x.value.trim(); }).filter(Boolean);
  var pv = document.getElementById('in-privacy');
  var op = document.getElementById('in-open');
  var next = { fields: fields, docs: docs, items: items, track: track,
               privacy: pv ? pv.value.trim() : (cfg.privacy || INTAKE_DEFAULT.privacy), texts: textsRead(document.getElementById('in-set')),
               open: op ? op.checked : cfg.open !== false };
  var typeChanged = Array.prototype.some.call(document.querySelectorAll('#in-set [data-fid]'), function (row) {
    var t = row.querySelector('[data-k="type"]'); return t && ((t.value === 'select') !== !!row.querySelector('[data-k="options"]') || (t.value === 'section') !== row.classList.contains('is-sec'));
  });
  var p = hrCfgSet('intake_form', next);
  toast(MSG_SAVED, null, 'good');
  if (typeChanged) _settingsPaint(next); else fcSyncRows(document.getElementById('in-set'));
  return p;
}

// גרירה לסידור — השדות, המסמכים, הפריטים ועמודות המעקב; השחרור שומר מה-DOM הסופי
['inf', 'ind', 'ini', 'int'].forEach(function (k) { dragDef(k, function () { return intakeSave(); }); });

export { intakeAddStudent, intakeCopy, intakeDelete, intakeFieldAdd, intakeFile, intakeItemAdd, intakeItemDocClear,
         intakeResponses, intakeSave, intakeSettings, intakeTrack, intakeTrackAdd, intakeUpload, intakeView, intakeYear, intakeOpenRow, intakeSearch };
