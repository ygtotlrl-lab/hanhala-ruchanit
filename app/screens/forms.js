// app/screens/forms.js — מודול «טפסים»: טופס רישום · קבלה לישיבה · שיבוץ לאסיפת הורים, בהרשאה אחת (forms).
// המסך — כרטיס לכל טופס: מצבו, מספר התגובות, ו«התגובות» · «צפייה» · «קישור»; ההגדרות — במסך ההגדרות, בחלק «טפסים».
// כאן גם אבני הבניין של דפי ההגדרות של שלושת הטפסים: מתג, שורת המצב והקישור, וכרטיס מתקפל.
import { esc } from '../../core/ui.js';
import { icon } from '../icons.js';
import { hrCfgGet, hrCfgLocalGet, hrSetPending } from '../domain.js';
import { S } from '../state.js';
import { hrDayHebFmt } from '../domain.hebdate.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { gateCall } from '../gate.js';
import { contactsUrl } from './contacts.js';

var FORMS = [
  { k: 'en', mod: 'enroll', key: 'enroll_form', file: 'enroll.html', title: 'טופס רישום', ico: 'enroll' },
  { k: 'in', mod: 'intake', key: 'intake_form', file: 'intake.html', title: 'קבלה לישיבה', ico: 'intake' },
  { k: 'mt', mod: 'meeting', key: 'meeting_cfg', file: 'meeting.html', title: 'אסיפת הורים', ico: 'meeting' }
];
function formUrl(file) { return contactsUrl().replace(/contacts\.html$/, file); }

// ── אבני הבניין ──
// מתג — תיבת סימון בצורת מתג (fc-sw), ומאפייניה כמו בתיבה
function fcSw(attrs, on) { return '<input type="checkbox" class="fc-sw" ' + attrs + (on ? ' checked' : '') + '>'; }
// בראש דף ההגדרות: המתג (פתוח למילוי / לשיבוץ) ו«צפייה», ומתחתם הקישור ו«העתקה»
function fcStatusHTML(o) {
  return '<label class="fc-stat' + (o.on ? ' on' : '') + '">' + fcSw('id="' + o.id + '"', o.on) + '<b>' + esc(o.label) + '</b>' +
      '<button type="button" class="btn sm out" data-act="' + o.p + '-view">' + icon('watch') + 'צפייה</button></label>' +
    '<div class="fc-link">' + icon('link') + '<span dir="ltr">' + esc(o.url) + '</span>' +
      '<button type="button" class="btn sm out" data-act="' + o.p + '-copy">' + icon('copy') + 'העתקה</button></div>';
}
// כרטיס מתקפל — כותרת, תקציר ותוכן; פתוח אחד בכל פעם (name)
function fcCardHTML(o) {
  return '<details class="fc-card" name="fc"' + (o.id ? ' id="' + o.id + '"' : '') + (o.open ? ' open' : '') + '>' +
    '<summary><span class="fc-ic">' + icon(o.ico) + '</span><span class="fc-h"><b>' + esc(o.title) + '</b>' +
      (o.sum ? '<small>' + esc(o.sum) + '</small>' : '') + '</span><span class="fc-chev">' + icon('down') + '</span></summary>' +
    '<div class="fc-body">' + o.body + '</div></details>';
}
// הכרטיס שהיה פתוח — נשאר פתוח אחרי ציור מחדש של הדף
function fcOpenId(box) { var d = box && box.querySelector('details.fc-card[open]'); return d ? d.id : null; }

// שדה שנפתח לעריכה וחוזר לשורה — «סיום» או לחיצה על השורה
function fcToggle(el) { var r = el.closest('.fc-f'); if (r) r.classList.toggle('open'); }
// האפשרויות של שאלת בחירה — תגיות; הערך הנשמר בשדה הנסתר (data-k="options"), מופרד בפסיק
function _optsSync(box) {
  var h = box.parentElement.querySelector('[data-k="options"]');
  if (h) h.value = Array.prototype.map.call(box.querySelectorAll('.fc-chip'), function (c) { return c.getAttribute('data-opt'); }).join(', ');
  return h;
}
function fcChipAdd(el) {
  var v = el.value.replace(/,/g, ' ').trim(), box = el.closest('.fc-chips');
  el.value = '';
  if (!v || !box || box.querySelector('.fc-chip[data-opt="' + v.replace(/"/g, '') + '"]')) return;
  el.insertAdjacentHTML('beforebegin', '<span class="fc-chip" data-opt="' + esc(v) + '">' + esc(v) +
    '<button type="button" data-act="fc-opt-del" aria-label="הסרת האפשרות">' + icon('close') + '</button></span>');
  _optsSync(box);
  setTimeout(function () { el.focus(); }, 0);
}
function fcChipDel(el) {
  var c = el.closest('.fc-chip'), box = el.closest('.fc-chips');
  if (!c || !box) return;
  c.remove();
  var h = _optsSync(box);
  if (h) h.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── התקצירים ──
function _yr(y) { return hebYearLabelFull(y) || String(y || ''); }
function fcSummary(k) {
  var key = FORMS.filter(function (f) { return f.k === k; })[0].key;
  var c = (!hrSetPending(key) && S._fmCfg && S._fmCfg[key]) || hrCfgLocalGet(key) || {};
  if (k === 'mt') {
    if (!c.date) return { open: false, line: 'לא נקבע תאריך' };
    return { open: !!c.open, line: hrDayHebFmt(c.date) + ' · \u2066' + (c.from || '') + '–' + (c.to || '') + '\u2069' };
  }
  var fs = (c.fields || []).filter(function (f) { return f.type !== 'section'; }).length;
  var line = k === 'en' ? fs + ' שדות · ' + (c.track || []).length + ' עמודות מעקב'
    : (c.docs || []).length + ' מסמכים לצפייה · ' + (c.items || []).length + ' לחתימה';
  return { open: c.open !== false, line: line };
}

// ── המסך ──
function screenFormsHTML() {
  return '<div class="pg" id="pg-forms"><div class="inner">' +
    '<div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">' + icon('back') + 'חזרה</button><span>טפסים</span></div>' +
    '<div class="fm-list" id="fm-list"></div></div></div>';
}
function _cardHTML(f, cnt) {
  var s = fcSummary(f.k);
  return '<div class="fm-card"><div class="fm-head"><span class="fc-ic">' + icon(f.ico) + '</span>' +
      '<span class="fc-h"><b>' + esc(f.title) + '</b><small id="fm-sub-' + f.k + '">' + esc(cnt || s.line) + '</small></span>' +
      '<span class="fm-st' + (s.open ? ' on' : '') + '" id="fm-st-' + f.k + '">' + (s.open ? (f.k === 'mt' ? 'פתוח לשיבוץ' : 'פתוח') : 'סגור') + '</span></div>' +
    '<div class="fm-acts"><button class="btn" data-act="' + f.k + '-resp">' + icon('table') + 'התגובות</button>' +
      '<button class="btn out" data-act="' + f.k + '-view">' + icon('watch') + 'צפייה</button>' +
      '<button class="btn out" data-act="' + f.k + '-copy">' + icon('copy') + 'קישור</button></div></div>';
}
// המספרים — מהשער, ברקע: מה שנרשם השנה; בלי כניסה לשער או בלי רשת — התקציר מההגדרות נשאר
async function renderForms() {
  var box = document.getElementById('fm-list');
  if (!box) return;
  box.innerHTML = FORMS.map(function (f) { return _cardHTML(f); }).join('');
  // ההגדרות — מהענן, כדי שמצב הטופס יהיה המעודכן ולא העותק שבמכשיר
  S._fmCfg = S._fmCfg || {};
  FORMS.forEach(function (f) {
    hrCfgGet(f.key, true).then(function (r) {
      if (!r || !r.ok || !r.value) return;
      S._fmCfg[f.key] = r.value;
      var st = document.querySelector('#fm-st-' + f.k), sm = fcSummary(f.k);
      if (st) { st.classList.toggle('on', sm.open); st.textContent = sm.open ? (f.k === 'mt' ? 'פתוח לשיבוץ' : 'פתוח') : 'סגור'; }
    }, function () {});
  });
  FORMS.forEach(async function (f) {
    var r = await gateCall(f.mod, 'list');
    var el = document.getElementById('fm-sub-' + f.k);
    if (!el || !r || !Array.isArray(r.rows)) return;
    var rows = r.rows, txt;
    if (f.k === 'mt') {
      var c = (S._fmCfg && S._fmCfg.meeting_cfg) || hrCfgLocalGet('meeting_cfg') || {}, d = c.date;
      var now = rows.filter(function (x) { return !d || x.meet_date === d; });
      var fam = now.map(function (x) { return x.student_client_id || x.student_name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
      txt = (d ? hrDayHebFmt(d) + ' · ' : '') + fam + ' משפחות · ' + now.length + ' פגישות';
    } else {
      var y = rows.map(function (x) { return x.school_year; }).filter(Boolean).sort().pop();
      var n = rows.filter(function (x) { return x.school_year === y; }).length;
      txt = (y ? _yr(y) + ' · ' : '') + n + (n === 1 ? ' תגובה' : ' תגובות');
    }
    el.textContent = txt;
  });
}

// ── בהגדרות — חלק «טפסים»: שורה לכל טופס, ובה התקציר ──
function renderFormsSettings() {
  var box = document.getElementById('set-forms-list');
  if (!box) return;
  box.innerHTML = FORMS.map(function (f) {
    var s = fcSummary(f.k);
    return '<button class="fm-row" data-act="' + f.k + '-settings"><span class="fc-ic">' + icon(f.ico) + '</span>' +
      '<span class="fc-h"><b>' + esc(f.title) + '</b><small>' + (s.open ? 'פתוח' : 'סגור') + ' · ' + esc(s.line) + '</small></span>' +
      '<span class="fc-chev">' + icon('prev') + '</span></button>';
  }).join('');
}

export { fcCardHTML, fcChipAdd, fcChipDel, fcToggle, fcOpenId, fcStatusHTML, fcSw, formUrl, renderForms, renderFormsSettings, screenFormsHTML };
