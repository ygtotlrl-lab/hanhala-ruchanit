// app/screens/enroll.js — טופס הרישום: הדיאלוג שמהמצבה, התגובות והגדרות הטופס
// הטופס עצמו — app/enroll.html, דף ציבורי ששולח בלבד. התגובות והקבצים נקראים רק דרך השער (app/gate.js), אחרי כניסה מקוונת.
import { ask, closeModal, dragDef, esc, openModal, toast } from '../../core/ui.js';
import { MSG_SAVED } from '../../core/util.js';
import { gateCall, gateOpen } from '../gate.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { ENROLL_DEFAULT } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { canEdit, hrCfgGet, hrCfgLocalGet, hrCfgSet, hrSetPending } from '../domain.js';
import { icon } from '../icons.js';
import { contactsUrl } from './contacts.js';
import { openAddStudent } from './students.js';
import '../form-texts.js';
import { respListHTML, respScreenHTML, respSections } from './resp.js';
import { fcCardHTML, fcOnLabel, fcOpenId, fcStatusHTML, fcSw } from './forms.js';

var ENROLL_PUBLIC = 'hr-public';
// השדות שהעריכה שלהם פתוחה — נשארים פתוחים כשהדף מצויר מחדש (שינוי סוג)
var _fcOpenF = [];
function fcRemember(box) { _fcOpenF = Array.prototype.map.call((box || document).querySelectorAll('.fc-f.open'), function (r) { return r.getAttribute('data-fid'); }); }
var EN_TYPES = [['text', 'טקסט'], ['idnum', 'מספר זהות'], ['tel', 'טלפון'], ['email', 'אימייל'], ['select', 'בחירה'],
  ['hebdate', 'תאריך עברי'], ['gdate', 'תאריך לועזי'], ['textarea', 'טקסט ארוך'], ['file', 'קובץ'], ['consent', 'תיבת אישור'], ['section', 'כותרת קבוצה']];

function _gate(action, body) { return gateCall('enroll', action, body); }

// ── הדיאלוג שמהמצבה ──
function enrollUrl() { return contactsUrl().replace(/contacts\.html$/, 'enroll.html'); }
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
  if (r.login) { box.innerHTML = _passHTML('en-resp'); return; }
  if (r.perm) { box.innerHTML = '<div class="ld">אין לך הרשאה לתגובות.</div>'; return; }
  if (r.net || r.error) { box.innerHTML = '<div class="ld">אין חיבור לשרת — התגובות נקראות רק עם רשת.</div><button class="retry-btn" data-act="en-resp">נסה שוב</button>'; return; }
  S._enRows = r.rows || [];
  if (S._enYear == null) {
    var ys = S._enRows.map(function (x) { return x.school_year; });
    S._enYear = ys.length ? Math.max.apply(null, ys) : null;
  }
  _respPaint();
}
// בלי חיבור לשער — אין כאן סיסמה: הצפייה נפתחת מהכניסה לאפליקציה בלבד, ולכן ההוראה היא לצאת ולהיכנס שוב, עם רשת
function _passHTML(back) {
  return '<div class="en-pass"><p>הצפייה בתגובות נפתחת עם הכניסה לאפליקציה. כדי לחדש אותה — יש לצאת ולהיכנס שוב, עם רשת.</p>' +
    '<button class="btn" data-act="gate-relogin" data-back="' + (back || 'en-resp') + '">' + icon('logout') + 'יציאה וכניסה מחדש</button></div>';
}
// התגובות — כרטיס לכל מי שמילא (resp.js)
function _respOpts() {
  var cfg = enrollCfg(), rows = S._enRows || [];
  var years = rows.map(function (x) { return x.school_year; }).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
  return {
    p: 'en', edit: canEdit('forms'), track: cfg.track || [], sections: respSections(cfg.fields),
    rows: rows.filter(function (x) { return S._enYear == null || x.school_year === S._enYear; }),
    years: years.map(function (y) { return { y: y, label: _yearLabel(y), on: y === S._enYear, n: rows.filter(function (x) { return x.school_year === y; }).length }; })
  };
}
function _respPaint() {
  var box = document.getElementById('en-resp');
  if (box) box.innerHTML = respScreenHTML(_respOpts());
}
function _listPaint() {
  var box = document.getElementById('en-list');
  if (box) box.innerHTML = respListHTML(_respOpts());
}
function enrollYear(y) { S._enYear = +y; S._enOpen = null; _respPaint(); }
function enrollOpenRow(el) { var id = el.getAttribute('data-id'); S._enOpen = S._enOpen === id ? null : id; _listPaint(); }
function enrollSearch(v) { S._enQ = v; _listPaint(); }
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
// נשמר רק טקסט ששונה, במפתח הנוסח המקורי (texts)
function textsHTML(form, cfg) {
  var list = self.FormTexts.list(form), tx = cfg.texts || {};
  // שדה לכל טקסט, ובו הטקסט שבדף — עורכים בו, והדף משתנה
  return '<div class="fc-lbl fc-gap">הטקסטים בדף — עורכים כאן, והדף משתנה</div>' +
    '<div class="en-tx">' + list.map(function (k) {
      var v = tx[k] || k;
      return k.length > 60 ? '<textarea class="en-txr" rows="2" aria-label="טקסט בדף" data-tx="' + esc(k) + '">' + esc(v) + '</textarea>'
        : '<input class="en-txr" aria-label="טקסט בדף" data-tx="' + esc(k) + '" value="' + esc(v) + '">';
    }).join('') + '</div>';
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
  return '<div class="fc-lbl">הודעת הפרטיות</div><textarea class="en-priv" id="' + id + '" rows="4" aria-label="הודעת הפרטיות">' + esc(cfg.privacy || def || '') + '</textarea>';
}

// «חתימה» — רק בקבלה לישיבה (inf): ההורה חותם באצבע, והחתימה נשמרת כתמונה
var IN_TYPES = EN_TYPES.slice(0, -1).concat([['signature', 'חתימה']], EN_TYPES.slice(-1));
// שדה — שורה קצרה (שם · «חובה» · סוג), ולחיצה פותחת את העריכה תחתיה: שם · סוג · חובה (מתג) · אפשרויות (תגיות) · הסבר · הסרה.
// השדות שבעריכה הם שנקראים בשמירה (data-k), גם כשהעריכה סגורה; קבוצה (section) — שם וסוג בלבד, והשדות שאחריה מוזחים תחתיה.
function _fieldRow(f, drag) {
  var types = drag === 'inf' ? IN_TYPES : EN_TYPES;
  var opts = types.map(function (t) { return '<option value="' + t[0] + '"' + (f.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('');
  var tl = (types.filter(function (t) { return t[0] === f.type; })[0] || ['', ''])[1];
  var sec = f.type === 'section', sel = f.type === 'select', open = _fcOpenF.indexOf(f.id) >= 0 || !f.label;
  var chips = sel ? '<div class="fc-lbl">האפשרויות</div><div class="fc-chips">' + (f.options || []).map(function (o) {
      return '<span class="fc-chip" data-opt="' + esc(o) + '">' + esc(o) + '<button type="button" data-act="fc-opt-del" aria-label="הסרת האפשרות">' + icon('close') + '</button></span>';
    }).join('') + '<input class="fc-chip-add" data-kent placeholder="+ אפשרות" aria-label="אפשרות חדשה"></div>' +
    '<input type="hidden" data-k="options" value="' + esc((f.options || []).join(', ')) + '">' : '';
  return '<div class="fc-f' + (sec ? ' is-sec' : '') + (open ? ' open' : '') + '" data-drag="' + (drag || 'enf') + '" data-fid="' + esc(f.id) + '">' +
    '<div class="fc-fr" data-act="fc-fedit"><span class="grip" data-grip aria-hidden="true">⠿</span>' +
      '<span class="fc-fn">' + esc(f.label || 'שדה חדש') + '</span>' +
      (!sec && f.req ? '<span class="fc-rq">חובה</span>' : '') + '<span class="fc-ty">' + esc(tl) + '</span>' +
      '<span class="fc-chev">' + icon('down') + '</span></div>' +
    '<div class="fc-fe">' +
      '<div class="fc-lbl">' + (sec ? 'שם הקבוצה' : 'שם השדה') + '</div><input data-k="label" aria-label="שם השדה" placeholder="שם השדה" value="' + esc(f.label || '') + '">' +
      '<div class="fc-two"><label class="fc-col"><span class="fc-lbl">סוג</span><select data-k="type" aria-label="סוג">' + opts + '</select></label>' +
        (sec ? '' : '<label class="fc-tg">חובה' + fcSw('data-k="req"', f.req) + '</label>') + '</div>' +
      chips +
      (sel && drag === 'inf' ? '<label class="fc-tg">אפשרות ראשית — הראשונה כפתור מלא, והשאר תחת «אפשרות אחרת»' + fcSw('data-k="lead"', f.lead) + '</label>' : '') +
      (sec ? '' : '<div class="fc-lbl">הסבר מתחת לשדה</div><input data-k="help" aria-label="הסבר" placeholder="רשות" value="' + esc(f.help || '') + '">') +
      '<div class="fc-fact"><button type="button" class="btn sm out fc-del" data-act="row-remove">' + icon('del') + (sec ? 'הסרת הקבוצה' : 'הסרת השדה') + '</button>' +
        '<button type="button" class="btn sm" data-act="fc-fedit">סיום</button></div>' +
    '</div></div>';
}
// אחרי שמירה — שורות השדות מראות את מה שבעריכה (השם ו«חובה»), בלי לצייר מחדש
function _fcSyncRows(box) {
  if (!box) return;
  box.querySelectorAll('.fc-f').forEach(function (row) {
    var l = row.querySelector(':scope > .fc-fe > [data-k="label"]'), r = row.querySelector(':scope > .fc-fe [data-k="req"]'), n = row.querySelector(':scope > .fc-fr > .fc-fn');
    if (n && l) n.textContent = l.value.trim() || 'שדה חדש';
    var t = row.querySelector(':scope > .fc-fe > [data-k="ititle"]');
    if (n && t && n.firstChild) n.firstChild.textContent = t.value.trim() || 'מסמך חדש';
    var fz = row.querySelector(':scope > .fc-fe > .fc-tg [data-k="frozen"]'), pl = row.querySelector(':scope > .fc-fr > .fc-pill');
    if (fz && pl) { pl.textContent = fz.checked ? 'מוקפא' : 'פעיל'; pl.classList.toggle('on', !fz.checked); row.classList.toggle('frz', fz.checked); }
    var rq = row.querySelector(':scope > .fc-fr > .fc-rq');
    if (r && r.checked && !rq) row.querySelector(':scope > .fc-fr > .fc-ty').insertAdjacentHTML('beforebegin', '<span class="fc-rq">חובה</span>');
    if (r && !r.checked && rq) rq.remove();
  });
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
  if (!canEdit('forms')) { shell.showDenied(); return; }
  _settingsPaint(enrollCfg());
  try {
    var r = await hrCfgGet('enroll_form', true);
    if (r && r.ok && r.value && !hrSetPending('enroll_form')) {
      var box = document.getElementById('en-set');
      if (box && !box.contains(document.activeElement)) _settingsPaint(r.value);
    }
  } catch (e) { console.warn('[enroll] משיכת התצורה נכשלה', e); }
}
// דף ההגדרות: המתג והקישור, ואחריהם כרטיסים מתקפלים — המצגת · השדות · עמודות המעקב · הנוסחים בדף
function _settingsPaint(cfg) {
  var old = document.getElementById('en-set'), was = fcOpenId(old);
  fcRemember(old);
  var fs = cfg.fields.filter(function (f) { return f.type !== 'section'; });
  var html = '<div class="en-cfg fc-page" id="en-set" data-autosave="en-save">' +
    fcStatusHTML({ p: 'en', id: 'en-open', on: cfg.open !== false, label: fcOnLabel('en'), url: enrollUrl() }) +
    fcCardHTML({ id: 'fc-en-imgs', ico: 'image', title: 'המצגת', open: was === 'fc-en-imgs',
      sum: (cfg.images || []).length + ' תמונות · כל ' + (cfg.interval || 4) + ' שניות',
      body: '<div class="en-imgs" id="en-imgs">' + (cfg.images || []).map(_imgRow).join('') +
          '<label class="fc-addimg en-upl">' + icon('plus') + '<input type="file" accept="image/*" multiple data-chg="en-img" aria-label="הוספת תמונות"></label></div>' +
        '<div class="en-int"><span>החלפת תמונה כל</span><input type="number" min="2" max="20" id="en-interval" aria-label="שניות" value="' + esc(cfg.interval || 4) + '"><span>שניות</span></div>' }) +
    fcCardHTML({ id: 'fc-en-fields', ico: 'fields', title: 'השדות', open: was === 'fc-en-fields',
      sum: cfg.fields.filter(function (f) { return f.type === 'section'; }).length + ' קבוצות · ' + fs.length + ' שדות · ' + fs.filter(function (f) { return f.req; }).length + ' חובה',
      body: '<div class="en-fields fc-fields fc-fields-top" id="en-fields">' + cfg.fields.map(function (f) { return _fieldRow(f); }).join('') + '</div>' +
        '<div class="fc-adds"><button class="add-dashed-btn" data-act="en-field-add">+ שדה</button><button class="add-dashed-btn" data-act="en-field-add" data-sec="1">+ קבוצה</button></div>' }) +
    fcCardHTML({ id: 'fc-en-track', ico: 'track', title: 'עמודות המעקב', open: was === 'fc-en-track',
      sum: (cfg.track || []).length + ' עמודות — בכל תגובה',
      body: '<div class="en-track" id="en-track">' + (cfg.track || []).map(_trkRow).join('') + '</div>' +
        '<button class="add-dashed-btn" data-act="en-track-add">+ עמודה</button>' }) +
    fcCardHTML({ id: 'fc-en-texts', ico: 'text', title: 'הנוסחים בדף', open: was === 'fc-en-texts',
      sum: 'הודעת הפרטיות · ' + Object.keys(cfg.texts || {}).length + ' טקסטים שונו',
      body: privacyHTML('en-privacy', cfg, ENROLL_DEFAULT.privacy) + textsHTML('enroll', cfg) }) +
    '</div>';
  if (old) old.outerHTML = html;
  else openModal('טופס רישום — הגדרות', html, '', 'settings');
}
function enrollFieldAdd(el) {
  var box = document.getElementById('en-fields'), sec = el && el.getAttribute && el.getAttribute('data-sec');
  if (box) box.insertAdjacentHTML('beforeend', _fieldRow({ id: 'f' + Date.now().toString(36), type: sec ? 'section' : 'text', label: '', req: false }));
  var n = box && box.lastElementChild && box.lastElementChild.querySelector('[data-k="label"]'); if (n) n.focus();
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
  var op = document.getElementById('en-open');
  var next = { interval: iv >= 2 && iv <= 20 ? iv : 4, images: images, fields: fields, track: track,
               privacy: pv ? pv.value.trim() : (cfg.privacy || ENROLL_DEFAULT.privacy), texts: textsRead(document.getElementById('en-set')),
               open: op ? op.checked : cfg.open !== false };
  // סוג שהשתנה ל«בחירה» מקבל את שדה האפשרויות מיד
  var typeChanged = Array.prototype.some.call(document.querySelectorAll('#en-fields [data-fid]'), function (row) {
    var t = row.querySelector('[data-k="type"]'); return t && ((t.value === 'select') !== !!row.querySelector('[data-k="options"]') || (t.value === 'section') !== row.classList.contains('is-sec'));
  });
  var p = hrCfgSet('enroll_form', next);
  toast(MSG_SAVED, null, 'good');
  if (typeChanged) _settingsPaint(next); else _fcSyncRows(document.getElementById('en-set'));
  return p;
}

// גרירה לסידור — התמונות, השדות ועמודות המעקב; השחרור שומר מה-DOM הסופי
['enf', 'eni', 'ent'].forEach(function (k) { dragDef(k, function () { return enrollSave(); }); });

export { _fieldRow as enrollFieldRow, _fcSyncRows as fcSyncRows, fcRemember, _passHTML as gatePassHTML, privacyHTML, textsHTML, textsRead,
         enrollAddStudent, enrollCopy, enrollDelete, enrollFieldAdd, enrollFile, enrollImgUpload, enrollResponses, enrollSave, enrollSettings, enrollTrack, enrollTrackAdd, enrollView, enrollYear, enrollOpenRow, enrollSearch };
