// app/screens/intake.js — קבלה לישיבה: הדיאלוג שמהמצבה, התגובות והגדרות הטופס — כמו טופס הרישום (app/screens/enroll.js), ובאותו שער.
// הטופס עצמו — app/intake.html, דף ציבורי ששולח בלבד (hr_intake · הדלי הפרטי hr-enroll, תחת intake/). המסמכים לצפייה ולחתימה — בדלי הציבורי hr-public, תחת intake/.
import { ask, closeModal, dragDef, esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { INTAKE_DEFAULT, MSG_UPLOAD_FAIL, MSG_UPLOAD_NEEDS_NET } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { canEdit, hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { contactsUrl } from './contacts.js';
import { enrollFieldRow, gateCall, gateLogin, gatePassHTML } from './enroll.js';
import { openAddStudent } from './students.js';

var INTAKE_PUBLIC = 'hr-public';
function _gate(action, body) { return gateCall('intake', action, body); }

// ── הדיאלוג שמהמצבה ──
function intakeUrl() { return contactsUrl().replace(/contacts\.html$/, 'intake.html'); }
function intakeOpen() {
  openModal('קבלה לישיבה',
    '<div class="en-menu">' +
      '<button class="en-tile" data-act="in-view">' + icon('watch') + 'צפייה בטופס</button>' +
      '<button class="en-tile" data-act="in-copy">' + icon('copy') + 'העתקת קישור</button>' +
      '<button class="en-tile" data-act="in-resp">' + icon('table') + 'התגובות</button>' +
      '<button class="en-tile" data-act="in-settings">' + icon('settings') + 'הגדרות הטופס</button>' +
    '</div>', '', 'intake');
}
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
  if (r.login) { box.innerHTML = gatePassHTML('in-pass'); return; }
  if (r.perm) { box.innerHTML = '<div class="ld">אין לך הרשאה לתגובות.</div>'; return; }
  if (r.net || r.error) { box.innerHTML = '<div class="ld">אין חיבור לשרת — התגובות נקראות רק עם רשת.</div><button class="retry-btn" data-act="in-resp">נסה שוב</button>'; return; }
  S._inRows = r.rows || [];
  if (S._inYear == null) {
    var ys = S._inRows.map(function (x) { return x.school_year; });
    S._inYear = ys.length ? Math.max.apply(null, ys) : null;
  }
  _respPaint();
}
async function intakePass() {
  var el = document.getElementById('en-pass');
  if (!el || !el.value) return;
  if (!navigator.onLine) { toast('אין רשת', null, 'off'); return; }
  var ok = await gateLogin(AUTH.user.username, el.value);
  if (!ok) { toast('הסיסמה שגויה, או שאין חיבור לשרת', null, 'bad'); return; }
  return intakeResponses();
}
function _respPaint() {
  var box = document.getElementById('in-resp');
  if (!box) return;
  var cfg = intakeCfg(), rows = S._inRows || [], edit = canEdit('intake');
  var years = rows.map(function (x) { return x.school_year; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
  var list = rows.filter(function (x) { return S._inYear == null || x.school_year === S._inYear; });
  var fields = _allFields(cfg).filter(function (f) { return f.id !== 'first' && f.id !== 'last'; });
  var head = '<tr><th class="en-sticky">שם</th><th>נשלח</th>' +
    fields.map(function (f) { return '<th>' + esc(f.label) + '</th>'; }).join('') +
    (cfg.track || []).map(function (t) { return '<th class="en-trk">' + esc(t) + '</th>'; }).join('') + '<th></th></tr>';
  var body = list.map(function (x) {
    var d = x.data || {}, f = x.files || {};
    var name = [d.first, d.last].filter(Boolean).join(' ') || '—';
    var cells = fields.map(function (fl) {
      if (fl.type === 'file') return '<td>' + (f[fl.id] ? '<button class="btn sm out" data-act="in-file" data-path="' + esc(f[fl.id].path) + '">' + icon('watch') + 'פתיחה</button>' : '') + '</td>';
      return '<td>' + esc(d[fl.id] || '') + '</td>';
    }).join('');
    var trk = (cfg.track || []).map(function (t) {
      var v = (x.track || {})[t] || '';
      return '<td class="en-trk"><input class="en-in" value="' + esc(v) + '" data-in-id="' + esc(x.client_id) + '" data-in-key="' + esc(t) + '"' + (edit ? '' : ' disabled') + '></td>';
    }).join('');
    var dt = new Date(x.created_at);
    return '<tr><th class="en-sticky">' + esc(name) + '</th><td>' + esc(dt.toLocaleDateString('he-IL')) + '</td>' + cells + trk +
      '<td class="en-acts">' + (edit ? '<button class="btn sm out" data-act="in-add-student" data-id="' + esc(x.client_id) + '">' + icon('plus') + 'הוספה למצבה</button>' +
      '<button class="row-del-btn" data-act="in-del" data-id="' + esc(x.client_id) + '" aria-label="מחיקה">' + icon('del') + '</button>' : '') + '</td></tr>';
  }).join('');
  box.innerHTML =
    '<div class="en-bar">' + years.map(function (y) {
      var n = rows.filter(function (x) { return x.school_year === y; }).length;
      return '<button class="chip' + (y === S._inYear ? ' on' : '') + '" data-act="in-year" data-y="' + y + '">' + esc(_yearLabel(y)) + ' <b>' + n + '</b></button>';
    }).join('') + '</div>' +
    (list.length ? '<div class="table-scroll en-scroll"><table class="en-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
                 : '<div class="ld">אין תגובות</div>');
}
function intakeYear(y) { S._inYear = +y; _respPaint(); }
async function intakeTrack(el) {
  var r = await _gate('track', { id: el.getAttribute('data-in-id'), key: el.getAttribute('data-in-key'), value: el.value });
  if (r && r.ok) {
    var row = (S._inRows || []).filter(function (x) { return x.client_id === el.getAttribute('data-in-id'); })[0];
    if (row) row.track = r.track;
    toast(MSG_SAVED, null, 'good');
  } else toast(r && r.login ? 'נדרשת כניסה מחדש לתגובות' : 'השמירה נכשלה — אין חיבור לשרת', null, 'bad');
}
async function intakeFile(el) {
  var w = window.open('', '_blank');
  var r = await _gate('file', { path: el.getAttribute('data-path') });
  if (r && r.url) { if (w) w.location.href = r.url; else window.location.href = r.url; }
  else { if (w) w.close(); toast('הקובץ לא נפתח — אין חיבור לשרת', null, 'bad'); }
}
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
}

// ── הגדרות הטופס — נשמרות מיד (data-autosave) ──
function _viewBtn(url) {
  return '<a class="btn sm out" href="' + esc(url) + '" target="_blank" rel="noopener">' + icon('watch') + 'צפייה במסמך</a>';
}
// מסמך לצפייה — כותרת וקובץ שהועלה
function _docRow(d) {
  var body = d.url ? '<div class="in-dline">' + _viewBtn(d.url) + '</div>'
    : '<label class="add-dashed-btn en-upl">+ צירוף מסמך<input type="file" accept="application/pdf,image/*" data-chg="in-doc-up"></label>';
  return '<div class="en-frow in-doc" data-drag="ind" data-did="' + esc(d.id) + '" data-url="' + esc(d.url || '') + '">' +
    '<span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<div class="en-fbody"><input data-k="title" aria-label="כותרת" placeholder="כותרת" value="' + esc(d.title || '') + '">' + body + '</div>' +
    '<button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
// מסמך לחתימה — כותרת · מסמך מצורף (רשות) · השדות שלו, באותו עורך שדות כמו טופס הרישום
function _itemRow(it) {
  var doc = it.doc
    ? '<div class="in-dline">' + _viewBtn(it.doc) + '<button class="row-del-btn" data-act="in-item-doc-clear" aria-label="הסרה">' + icon('close') + '</button></div>'
    : '<label class="add-dashed-btn en-upl">+ צירוף מסמך<input type="file" accept="application/pdf,image/*" data-chg="in-item-doc"></label>';
  return '<div class="en-frow in-item" data-drag="ini" data-iid="' + esc(it.id) + '" data-doc="' + esc(it.doc || '') + '">' +
    '<span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<div class="en-fbody"><input data-k="ititle" aria-label="כותרת" placeholder="כותרת" value="' + esc(it.title || '') + '">' + doc +
      '<div class="en-fields in-ifields">' + (it.fields || []).map(function (f) { return enrollFieldRow(f, 'inf'); }).join('') + '</div>' +
      '<button class="add-dashed-btn" data-act="in-field-add">+ הוספת שדה</button></div>' +
    '<button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
function _trkRow(t) {
  return '<div class="en-trow" data-drag="int"><span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<input data-k="track" aria-label="עמודה" value="' + esc(t) + '"><button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
async function intakeSettings() {
  if (!canEdit('intake')) { shell.showDenied(); return; }
  _settingsPaint(intakeCfg());
  try {
    var r = await hrCfgGet('intake_form', true);
    if (r && r.ok && r.value && !hrSetPending('intake_form')) {
      var box = document.getElementById('in-set');
      if (box && !box.contains(document.activeElement)) _settingsPaint(r.value);
    }
  } catch (e) { console.warn('[intake] משיכת התצורה נכשלה', e); }
}
function _settingsPaint(cfg) {
  var html = '<div class="en-cfg" id="in-set" data-autosave="in-save">' +
    '<div class="ss-t">השדות</div>' +
    '<div class="en-fields" id="in-fields">' + cfg.fields.map(function (f) { return enrollFieldRow(f, 'inf'); }).join('') + '</div>' +
    '<button class="add-dashed-btn" data-act="in-field-add">+ הוספת שדה</button>' +
    '<div class="ss-t">מסמכים לצפייה</div>' +
    '<div class="en-fields" id="in-docs">' + (cfg.docs || []).map(_docRow).join('') + '</div>' +
    '<div class="in-adds"><label class="add-dashed-btn en-upl">+ הוספת מסמך<input type="file" accept="application/pdf,image/*" data-chg="in-doc-new"></label></div>' +
    '<div class="ss-t">מסמכים לחתימה</div>' +
    '<div class="en-fields" id="in-items">' + (cfg.items || []).map(_itemRow).join('') + '</div>' +
    '<button class="add-dashed-btn" data-act="in-item-add">+ הוספת פריט</button>' +
    '<div class="ss-t">עמודות המעקב בתגובות</div>' +
    '<div class="en-track" id="in-track">' + (cfg.track || []).map(_trkRow).join('') + '</div>' +
    '<button class="add-dashed-btn" data-act="in-track-add">+ הוספת עמודה</button></div>';
  var bd = document.getElementById('in-set');
  if (bd) bd.outerHTML = html;
  else openModal('הגדרות הטופס — קבלה לישיבה', html, '', 'settings');
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
    function v(k) { var el = row.querySelector(':scope > .en-fbody [data-k="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : null; }
    var o = { id: row.getAttribute('data-fid'), type: v('type') || 'text', label: v('label') || '' };
    if (!o.label) return;
    if (o.type !== 'section') {
      o.req = !!v('req');
      var h = v('help'); if (h) o.help = h;
      if (o.type === 'select') {
        var ol = v('options');
        var prev = prevAll.filter(function (x) { return x.id === o.id; })[0];
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
    return { id: row.getAttribute('data-iid'), title: row.querySelector('[data-k="ititle"]').value.trim(), doc: row.getAttribute('data-doc') || '',
             fields: _readFields(Array.prototype.slice.call(row.querySelectorAll('.in-ifields > [data-fid]')), prevAll) };
  }).filter(function (it) { return it.title || it.doc || it.fields.length; });
  var track = Array.prototype.map.call(document.querySelectorAll('#in-track [data-k="track"]'), function (x) { return x.value.trim(); }).filter(Boolean);
  // הודעת הפרטיות אינה נערכת בהגדרות — נשמרת כפי שהיא
  var next = { fields: fields, docs: docs, items: items, track: track, privacy: cfg.privacy || INTAKE_DEFAULT.privacy };
  var typeChanged = Array.prototype.some.call(document.querySelectorAll('#in-set [data-fid]'), function (row) {
    var t = row.querySelector('[data-k="type"]'); return t && ((t.value === 'select') !== !!row.querySelector('[data-k="options"]') || (t.value === 'section') !== row.classList.contains('is-sec'));
  });
  var p = hrCfgSet('intake_form', next);
  toast(MSG_SAVED, null, 'good');
  if (typeChanged) _settingsPaint(next);
  return p;
}

// גרירה לסידור — השדות, המסמכים, הפריטים ועמודות המעקב; השחרור שומר מה-DOM הסופי
['inf', 'ind', 'ini', 'int'].forEach(function (k) { dragDef(k, function () { return intakeSave(); }); });

export { intakeAddStudent, intakeCopy, intakeDelete, intakeFieldAdd, intakeFile, intakeItemAdd, intakeItemDocClear, intakeOpen,
         intakePass, intakeResponses, intakeSave, intakeSettings, intakeTrack, intakeTrackAdd, intakeUpload, intakeView, intakeYear };
