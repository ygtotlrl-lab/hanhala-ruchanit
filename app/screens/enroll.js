// app/screens/enroll.js — טופס הרישום: הדיאלוג שמהמצבה, התגובות והגדרות הטופס
// הטופס עצמו — app/enroll.html, דף ציבורי ששולח בלבד. התגובות והקבצים נקראים רק דרך השער (app/gate.js), אחרי כניסה מקוונת.
import { ask, closeModal, dragDef, esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { gateCall, gateLogin, gateOpen } from '../gate.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { ENROLL_DEFAULT } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { canEdit, hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { contactsUrl } from './contacts.js';
import { openAddStudent } from './students.js';
import '../form-texts.js';

var ENROLL_PUBLIC = 'hr-public';
var EN_TYPES = [['text', 'טקסט'], ['idnum', 'מספר זהות'], ['tel', 'טלפון'], ['email', 'אימייל'], ['select', 'בחירה'],
  ['hebdate', 'תאריך עברי'], ['gdate', 'תאריך לועזי'], ['textarea', 'טקסט ארוך'], ['file', 'קובץ'], ['consent', 'תיבת אישור'], ['section', 'כותרת קבוצה']];

function _gate(action, body) { return gateCall('enroll', action, body); }

// ── הדיאלוג שמהמצבה ──
function enrollUrl() { return contactsUrl().replace(/contacts\.html$/, 'enroll.html'); }
function enrollOpen() {
  openModal('טופס רישום',
    '<div class="en-menu">' +
      '<button class="en-tile" data-act="en-view">' + icon('watch') + 'צפייה בטופס</button>' +
      '<button class="en-tile" data-act="en-copy">' + icon('copy') + 'העתקת קישור</button>' +
      '<button class="en-tile" data-act="en-resp">' + icon('table') + 'התגובות</button>' +
      '<button class="en-tile" data-act="en-settings">' + icon('settings') + 'הגדרות הטופס</button>' +
    '</div>', '', 'enroll');
}
function enrollView() {
  openModal('טופס רישום', '<iframe class="ct-frame" src="app/enroll.html" title="טופס רישום"></iframe>', '', 'watch');
}
async function enrollCopy() {
  var u = enrollUrl(), ok = false;
  try { await navigator.clipboard.writeText(u); ok = true; } catch (e) {
    var t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    t.remove();
  }
  toast(ok ? 'הקישור הועתק' : u, null, ok ? 'good' : null);
}

// ── התצורה ──
function enrollCfg() {
  var v = hrCfgLocalGet('enroll_form');
  return (v && Array.isArray(v.fields)) ? v : JSON.parse(JSON.stringify(ENROLL_DEFAULT));
}
function _yearLabel(y) { return hebYearLabelFull(y) || String(y); }

// ── התגובות ──
async function enrollResponses() {
  openModal('התגובות — טופס רישום', '<div class="en-full" id="en-resp"><div class="ld">טוען…</div></div>', '', 'table');
  var r = await _gate('list');
  var box = document.getElementById('en-resp');
  if (!box) return;
  if (r.login) { box.innerHTML = _passHTML(); return; }
  if (r.perm) { box.innerHTML = '<div class="ld">אין לך הרשאה לתגובות.</div>'; return; }
  if (r.net || r.error) { box.innerHTML = '<div class="ld">אין חיבור לשרת — התגובות נקראות רק עם רשת.</div><button class="retry-btn" data-act="en-resp">נסה שוב</button>'; return; }
  S._enRows = r.rows || [];
  if (S._enYear == null) {
    var ys = S._enRows.map(function (x) { return x.school_year; });
    S._enYear = ys.length ? Math.max.apply(null, ys) : null;
  }
  _respPaint();
}
function _passHTML(act) {
  return '<div class="en-pass" data-ks><p>התגובות מוגנות, ונפתחות רק אחרי כניסה מקוונת. נא להזין את הסיסמה שלך.</p>' +
    '<input type="password" id="en-pass" inputmode="numeric" maxlength="6" autocomplete="current-password" placeholder="••••••">' +
    '<button class="btn" data-act="' + (act || 'en-pass') + '" data-ksave>כניסה</button></div>';
}
async function enrollPass() {
  var el = document.getElementById('en-pass');
  if (!el || !el.value) return;
  if (!navigator.onLine) { toast('אין רשת', null, 'off'); return; }
  var ok = await gateLogin(AUTH.user.username, el.value);
  if (!ok) { toast('הסיסמה שגויה, או שאין חיבור לשרת', null, 'bad'); return; }
  return enrollResponses();
}
function _respPaint() {
  var box = document.getElementById('en-resp');
  if (!box) return;
  var cfg = enrollCfg(), rows = S._enRows || [], edit = canEdit('enroll');
  var years = rows.map(function (x) { return x.school_year; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
  var list = rows.filter(function (x) { return S._enYear == null || x.school_year === S._enYear; });
  var fields = cfg.fields.filter(function (f) { return f.type !== 'section'; });
  var head = '<tr><th class="en-sticky">שם</th><th>נשלח</th>' +
    fields.filter(function (f) { return f.id !== 'first' && f.id !== 'last'; }).map(function (f) { return '<th>' + esc(f.label) + '</th>'; }).join('') +
    (cfg.track || []).map(function (t) { return '<th class="en-trk">' + esc(t) + '</th>'; }).join('') + '<th></th></tr>';
  var body = list.map(function (x) {
    var d = x.data || {}, f = x.files || {};
    var name = [d.first, d.last].filter(Boolean).join(' ') || '—';
    var cells = fields.filter(function (fl) { return fl.id !== 'first' && fl.id !== 'last'; }).map(function (fl) {
      if (fl.type === 'file') return '<td>' + (f[fl.id] ? '<button class="btn sm out" data-act="en-file" data-path="' + esc(f[fl.id].path) + '">' + icon('watch') + 'פתיחה</button>' : '') + '</td>';
      var v = d[fl.id] || '';
      if (fl.type === 'hebdate' && d._sunset) v += ' (' + d._sunset + ')';
      return '<td>' + esc(v) + '</td>';
    }).join('');
    var trk = (cfg.track || []).map(function (t) {
      var v = (x.track || {})[t] || '';
      return '<td class="en-trk"><input class="en-in" value="' + esc(v) + '" data-en-id="' + esc(x.client_id) + '" data-en-key="' + esc(t) + '"' + (edit ? '' : ' disabled') + '></td>';
    }).join('');
    var dt = new Date(x.created_at);
    return '<tr><th class="en-sticky">' + esc(name) + '</th><td>' + esc(dt.toLocaleDateString('he-IL')) + '</td>' + cells + trk +
      '<td class="en-acts">' + (edit ? '<button class="btn sm out" data-act="en-add-student" data-id="' + esc(x.client_id) + '">' + icon('plus') + 'הוספה למצבה</button>' +
      '<button class="row-del-btn" data-act="en-del" data-id="' + esc(x.client_id) + '" aria-label="מחיקה">' + icon('del') + '</button>' : '') + '</td></tr>';
  }).join('');
  box.innerHTML =
    '<div class="en-bar">' + years.map(function (y) {
      var n = rows.filter(function (x) { return x.school_year === y; }).length;
      return '<button class="chip' + (y === S._enYear ? ' on' : '') + '" data-act="en-year" data-y="' + y + '">' + esc(_yearLabel(y)) + ' <b>' + n + '</b></button>';
    }).join('') + '</div>' +
    (list.length ? '<div class="table-scroll en-scroll"><table class="en-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
                 : '<div class="ld">אין תגובות</div>');
}
function enrollYear(y) { S._enYear = +y; _respPaint(); }
// עמודת מעקב — נשמרת ביציאה מהשדה, דרך השער
async function enrollTrack(el) {
  var r = await _gate('track', { id: el.getAttribute('data-en-id'), key: el.getAttribute('data-en-key'), value: el.value });
  if (r && r.ok) {
    var row = (S._enRows || []).filter(function (x) { return x.client_id === el.getAttribute('data-en-id'); })[0];
    if (row) row.track = r.track;
    toast(MSG_SAVED, null, 'good');
  } else toast(r && r.login ? 'נדרשת כניסה מחדש לתגובות' : 'השמירה נכשלה — אין חיבור לשרת', null, 'bad');
}
function enrollFile(el) { return gateOpen(el.getAttribute('data-path')); }
async function enrollDelete(el) {
  var id = el.getAttribute('data-id');
  var row = (S._enRows || []).filter(function (x) { return x.client_id === id; })[0];
  var d = (row && row.data) || {};
  if (!(await ask('מחיקת תגובה', 'למחוק את התגובה של ' + [d.first, d.last].filter(Boolean).join(' ') + '?', 'מחיקה', 'del'))) return;
  var r = await _gate('delete', { id: id });
  if (!r || !r.ok) { toast('המחיקה נכשלה — אין חיבור לשרת', null, 'bad'); return; }
  S._enRows = (S._enRows || []).filter(function (x) { return x.client_id !== id; });
  _respPaint();
}
// «הוספה למצבה» — טופס הוספת התלמיד, והשם כבר בו
function enrollAddStudent(el) {
  var row = (S._enRows || []).filter(function (x) { return x.client_id === el.getAttribute('data-id'); })[0];
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
// ── הטקסטים הקבועים בדף (form-texts.js) והודעת הפרטיות — נערכים כאן, בשלושת הטפסים ──
// הטקסט נשמר רק כשהשתנה, במפתח הנוסח המקורי; ריק — חזרה למקורי
function textsHTML(form, cfg) {
  var list = self.FormTexts.list(form), tx = cfg.texts || {};
  var changed = list.filter(function (k) { return tx[k] && tx[k] !== k; }).length;
  return '<details class="en-texts"><summary class="ss-t">הטקסטים בדף' + (changed ? ' · שונו ' + changed : '') + '</summary>' +
    '<div class="en-tx">' + list.map(function (k) {
      var v = tx[k] || k, long = k.length > 60;
      return '<label class="en-txr' + (v !== k ? ' on' : '') + '"><span>' + esc(k) + '</span>' +
        (long ? '<textarea rows="2" data-tx="' + esc(k) + '">' + esc(v) + '</textarea>' : '<input data-tx="' + esc(k) + '" value="' + esc(v) + '">') + '</label>';
    }).join('') + '</div></details>';
}
function textsRead(box) {
  var out = {};
  if (!box) return out;
  box.querySelectorAll('[data-tx]').forEach(function (el) {
    var k = el.getAttribute('data-tx'), v = el.value.trim();
    if (v && v !== k) out[k] = v;
  });
  return out;
}
function privacyHTML(id, cfg, def) {
  return '<div class="ss-t">הודעת הפרטיות</div><textarea class="en-priv" id="' + id + '" rows="4" aria-label="הודעת הפרטיות">' + esc(cfg.privacy || def || '') + '</textarea>';
}

// «חתימה» — רק בקבלה לישיבה (inf): ההורה חותם באצבע, והחתימה נשמרת כתמונה
var IN_TYPES = EN_TYPES.slice(0, -1).concat([['signature', 'חתימה']], EN_TYPES.slice(-1));
function _fieldRow(f, drag) {
  var opts = (drag === 'inf' ? IN_TYPES : EN_TYPES).map(function (t) { return '<option value="' + t[0] + '"' + (f.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('');
  var sec = f.type === 'section';
  return '<div class="en-frow' + (sec ? ' is-sec' : '') + '" data-drag="' + (drag || 'enf') + '" data-fid="' + esc(f.id) + '">' +
    '<span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<div class="en-fbody">' +
      '<div class="en-fline"><input data-k="label" aria-label="שם השדה" placeholder="שם השדה" value="' + esc(f.label || '') + '">' +
        '<select data-k="type" aria-label="סוג">' + opts + '</select>' +
        (sec ? '' : '<label class="en-req"><input type="checkbox" data-k="req"' + (f.req ? ' checked' : '') + '>חובה</label>') + '</div>' +
      (sec ? '' : '<input class="en-sub" data-k="help" aria-label="הסבר" placeholder="הסבר מתחת לשדה (רשות)" value="' + esc(f.help || '') + '">') +
      (f.type === 'select' ? '<input class="en-sub" data-k="options" aria-label="אפשרויות" placeholder="אפשרויות, מופרדות בפסיק" value="' + esc((f.options || []).join(', ')) + '">' : '') +
      (f.type === 'select' && drag === 'inf' ? '<label class="en-req"><input type="checkbox" data-k="lead"' + (f.lead ? ' checked' : '') + '>אפשרות ראשית — הראשונה כפתור מלא, והשאר תחת «אפשרות אחרת»</label>' : '') +
    '</div>' +
    '<button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
function _imgRow(u) {
  return '<div class="en-img" data-drag="eni" data-url="' + esc(u) + '"><span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<img src="' + esc(u) + '" alt=""><button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
function _trkRow(t) {
  return '<div class="en-trow" data-drag="ent"><span class="grip" data-grip aria-hidden="true">⠿</span>' +
    '<input data-k="track" aria-label="עמודה" value="' + esc(t) + '"><button data-act="row-remove" class="row-del-btn" aria-label="הסרה">' + icon('close') + '</button></div>';
}
async function enrollSettings() {
  if (!canEdit('enroll')) { shell.showDenied(); return; }
  _settingsPaint(enrollCfg());
  try {
    var r = await hrCfgGet('enroll_form', true);
    if (r && r.ok && r.value && !hrSetPending('enroll_form')) {
      var box = document.getElementById('en-set');
      if (box && !box.contains(document.activeElement)) _settingsPaint(r.value);
    }
  } catch (e) { console.warn('[enroll] משיכת התצורה נכשלה', e); }
}
function _settingsPaint(cfg) {
  var html = '<div class="en-cfg" id="en-set" data-autosave="en-save">' +
    '<div class="ss-t">תמונות המצגת</div>' +
    '<div class="en-imgs" id="en-imgs">' + (cfg.images || []).map(_imgRow).join('') + '</div>' +
    '<label class="add-dashed-btn en-upl">+ הוספת תמונות<input type="file" accept="image/*" multiple data-chg="en-img"></label>' +
    '<div class="en-int"><span>החלפת תמונה כל</span><input type="number" min="2" max="20" id="en-interval" aria-label="שניות" value="' + esc(cfg.interval || 4) + '"><span>שניות</span></div>' +
    '<div class="ss-t">השדות</div>' +
    '<div class="en-fields" id="en-fields">' + cfg.fields.map(function (f) { return _fieldRow(f); }).join('') + '</div>' +
    '<button class="add-dashed-btn" data-act="en-field-add">+ הוספת שדה</button>' +
    '<div class="ss-t">עמודות המעקב בתגובות</div>' +
    '<div class="en-track" id="en-track">' + (cfg.track || []).map(_trkRow).join('') + '</div>' +
    '<button class="add-dashed-btn" data-act="en-track-add">+ הוספת עמודה</button>' +
    privacyHTML('en-privacy', cfg, ENROLL_DEFAULT.privacy) + textsHTML('enroll', cfg) + '</div>';
  var bd = document.getElementById('en-set');
  if (bd) bd.outerHTML = html;
  else openModal('הגדרות הטופס — טופס רישום', html, '', 'settings');
}
function enrollFieldAdd() {
  var box = document.getElementById('en-fields');
  if (box) box.insertAdjacentHTML('beforeend', _fieldRow({ id: 'f' + Date.now().toString(36), type: 'text', label: '', req: false }));
}
function enrollTrackAdd() {
  var box = document.getElementById('en-track');
  if (box) box.insertAdjacentHTML('beforeend', _trkRow(''));
}
async function enrollImgUpload(input) {
  var files = Array.prototype.slice.call(input.files || []);
  if (!files.length) return;
  if (!navigator.onLine) { toast('העלאת תמונה דורשת רשת', null, 'off'); return; }
  var box = document.getElementById('en-imgs'), n = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i], ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    var path = 'enroll/' + Date.now().toString(36) + '-' + i + '.' + ext;
    var res = await S.SB.storage.from(ENROLL_PUBLIC).upload(path, f, { contentType: f.type || undefined, upsert: false });
    if (!res || res.error) { toast('העלאת התמונה נכשלה', null, 'bad'); continue; }
    var url = S.SB.storage.from(ENROLL_PUBLIC).getPublicUrl(path).data.publicUrl;
    if (box) box.insertAdjacentHTML('beforeend', _imgRow(url));
    n++;
  }
  input.value = '';
  if (n) return enrollSave();
}
// התצורה נקראת מה-DOM הסופי — הסדר אחרי גרירה, השדות שנוספו והוסרו
function enrollSave() {
  var cfg = enrollCfg();
  var fields = [];
  document.querySelectorAll('#en-fields [data-fid]').forEach(function (row) {
    function v(k) { var el = row.querySelector('[data-k="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : null; }
    var o = { id: row.getAttribute('data-fid'), type: v('type') || 'text', label: v('label') || '' };
    if (!o.label) return;
    if (o.type !== 'section') {
      o.req = !!v('req');
      var h = v('help'); if (h) o.help = h;
      if (o.type === 'select') {
        var ol = v('options');
        var prev = cfg.fields.filter(function (x) { return x.id === o.id; })[0];
        o.options = ol != null ? ol.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : ((prev && prev.options) || []);
      }
    }
    fields.push(o);
  });
  var images = Array.prototype.map.call(document.querySelectorAll('#en-imgs [data-url]'), function (x) { return x.getAttribute('data-url'); });
  var track = Array.prototype.map.call(document.querySelectorAll('#en-track [data-k="track"]'), function (x) { return x.value.trim(); }).filter(Boolean);
  var iv = parseInt((document.getElementById('en-interval') || {}).value, 10);
  var pv = document.getElementById('en-privacy');
  var next = { interval: iv >= 2 && iv <= 20 ? iv : 4, images: images, fields: fields, track: track,
               privacy: pv ? pv.value.trim() : (cfg.privacy || ENROLL_DEFAULT.privacy), texts: textsRead(document.getElementById('en-set')) };
  // סוג שהשתנה ל«בחירה» מקבל את שדה האפשרויות מיד
  var typeChanged = Array.prototype.some.call(document.querySelectorAll('#en-fields [data-fid]'), function (row) {
    var t = row.querySelector('[data-k="type"]'); return t && ((t.value === 'select') !== !!row.querySelector('[data-k="options"]') || (t.value === 'section') !== row.classList.contains('is-sec'));
  });
  var p = hrCfgSet('enroll_form', next);
  toast(MSG_SAVED, null, 'good');
  if (typeChanged) _settingsPaint(next);
  return p;
}

// גרירה לסידור — התמונות, השדות ועמודות המעקב; השחרור שומר מה-DOM הסופי
['enf', 'eni', 'ent'].forEach(function (k) { dragDef(k, function () { return enrollSave(); }); });

export { _fieldRow as enrollFieldRow, _passHTML as gatePassHTML, privacyHTML, textsHTML, textsRead,
         enrollAddStudent, enrollCopy, enrollDelete, enrollFieldAdd, enrollFile, enrollImgUpload, enrollOpen, enrollPass,
         enrollResponses, enrollSave, enrollSettings, enrollTrack, enrollTrackAdd, enrollView, enrollYear };
