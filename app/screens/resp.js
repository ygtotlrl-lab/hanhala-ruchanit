// app/screens/resp.js — מסך התגובות של טופס הרישום ושל הקבלה לישיבה: רשימת כרטיסים, אחד לכל מי שמילא.
// הכרטיס הסגור — השם, מתי נשלח, הטלפון ומצב המעקב; לחיצה פותחת את כל התשובות לפי חלקי הטופס, הקבצים, עמודות המעקב והפעולות.
// כרטיס אחד פתוח בכל פעם (S['_' + p + 'Open']); החיפוש (S['_' + p + 'Q']) מסנן לפי שם, ומצייר את הרשימה בלבד — השדה אינו מאבד מיקוד.
import { esc } from '../../core/ui.js';
import { S } from '../state.js';
import { hrDayHebFmt } from '../domain.hebdate.js';
import { icon } from '../icons.js';

function _name(x) { var d = x.data || {}; return [d.first, d.last].filter(Boolean).join(' ') || 'ללא שם'; }
function _iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function _sent(x) {
  var d = new Date(x.created_at);
  if (isNaN(d)) return '';
  return hrDayHebFmt(_iso(d)) + ' · ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
function _initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0); }).join(''); }

// החלקים — כותרות הקבוצה שבטופס (section), ושדות שלפני הכותרת הראשונה — «פרטים»
function respSections(fields, first) {
  var out = [], cur = null;
  (fields || []).forEach(function (f) {
    if (f.type === 'section') { cur = { title: f.label, fields: [] }; out.push(cur); return; }
    if (!cur) { cur = { title: first || 'פרטים', fields: [] }; out.push(cur); }
    cur.fields.push(f);
  });
  return out;
}

function _val(p, fl, x) {
  var d = x.data || {}, f = x.files || {};
  if (fl.type === 'file' || fl.type === 'signature') {
    return f[fl.id] ? '<button class="btn sm out" data-act="' + p + '-file" data-path="' + esc(f[fl.id].path) + '">' + icon('watch') + (fl.type === 'signature' ? 'צפייה בחתימה' : 'פתיחת הקובץ') + '</button>' : '';
  }
  var v = d[fl.id];
  if (v === true) v = 'כן';
  if (v === false) v = '';
  if (v == null || v === '') return '';
  v = String(v);
  if (fl.type === 'hebdate' && d._sunset) v += ' (' + d._sunset + ')';
  if (fl.type === 'tel') return '<a href="tel:' + esc(v.replace(/[^\d+]/g, '')) + '">' + esc(v) + '</a>';
  if (fl.type === 'email') return '<a href="mailto:' + esc(v) + '">' + esc(v) + '</a>';
  return esc(v);
}
function _phone(x, sections) {
  var d = x.data || {}, tel = null;
  sections.some(function (s) { return s.fields.some(function (fl) { if (fl.type === 'tel' && d[fl.id]) { tel = d[fl.id]; return true; } return false; }); });
  return tel;
}

function _card(o, x) {
  var p = o.p, name = _name(x), open = S['_' + p + 'Open'] === x.client_id, track = o.track || [];
  var done = track.filter(function (t) { return ((x.track || {})[t] || '').trim(); }).length;
  var tel = _phone(x, o.sections);
  var head = '<button class="rs-head" data-act="' + p + '-open" data-id="' + esc(x.client_id) + '" aria-expanded="' + open + '">' +
    '<span class="rs-av">' + esc(_initials(name)) + '</span>' +
    '<span class="rs-main"><b>' + esc(name) + '</b><small>נשלח ' + esc(_sent(x)) + (tel ? ' · ' + esc(tel) : '') + '</small></span>' +
    (track.length ? '<span class="rs-trk' + (done === track.length ? ' all' : '') + '">מעקב ' + done + '/' + track.length + '</span>' : '') +
    '<span class="rs-chev">' + icon('down') + '</span></button>';
  if (!open) return '<div class="rs-card">' + head + '</div>';
  var body = o.sections.map(function (s) {
    var rows = s.fields.filter(function (fl) { return fl.id !== 'first' && fl.id !== 'last'; }).map(function (fl) {
      var v = _val(p, fl, x);
      return v ? '<div class="rs-f"><span>' + esc(fl.label) + '</span><div>' + v + '</div></div>' : '';
    }).join('');
    return rows ? '<section class="rs-sec"><h4>' + esc(s.title) + '</h4><div class="rs-grid">' + rows + '</div></section>' : '';
  }).join('');
  if (track.length) {
    body += '<section class="rs-sec rs-sec-trk"><h4>מעקב</h4><div class="rs-tgrid">' + track.map(function (t) {
      var v = (x.track || {})[t] || '';
      return '<label class="rs-t"><span>' + esc(t) + '</span><input class="en-in" value="' + esc(v) + '" data-' + p + '-id="' + esc(x.client_id) + '" data-' + p + '-key="' + esc(t) + '"' + (o.edit ? '' : ' disabled') + '></label>';
    }).join('') + '</div></section>';
  }
  if (o.edit) {
    body += '<div class="rs-acts"><button class="btn sm" data-act="' + p + '-add-student" data-id="' + esc(x.client_id) + '">' + icon('plus') + 'הוספה למצבה</button>' +
      '<button class="btn sm out rs-del" data-act="' + p + '-del" data-id="' + esc(x.client_id) + '">' + icon('del') + 'מחיקת התגובה</button></div>';
  }
  return '<div class="rs-card open">' + head + '<div class="rs-body">' + body + '</div></div>';
}

// הרשימה — החדש ראשון, לפי החיפוש
function respListHTML(o) {
  var q = (S['_' + o.p + 'Q'] || '').trim();
  var list = o.rows.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; })
    .filter(function (x) { return !q || q.split(/\s+/).every(function (w) { return _name(x).indexOf(w) >= 0; }); });
  if (!o.rows.length) return '<div class="rs-empty">עדיין לא התקבלו תגובות בשנה זו</div>';
  if (!list.length) return '<div class="rs-empty">לא נמצא שם כזה</div>';
  return list.map(function (x) { return _card(o, x); }).join('');
}

// המסך כולו: השנים · מספר התגובות והחיפוש · הרשימה (#<p>-list)
function respScreenHTML(o) {
  return '<div class="en-bar">' + o.years.map(function (y) {
      return '<button class="chip' + (y.on ? ' on' : '') + '" data-act="' + o.p + '-year" data-y="' + y.y + '">' + esc(y.label) + ' <b>' + y.n + '</b></button>';
    }).join('') + '</div>' +
    '<div class="rs-top"><div class="rs-count"><b>' + o.rows.length + '</b> ' + (o.rows.length === 1 ? 'מילא את הטופס' : 'מילאו את הטופס') + '</div>' +
    '<label class="rs-search">' + icon('search') + '<input type="search" placeholder="חיפוש לפי שם" data-inp="' + o.p + '-q" value="' + esc(S['_' + o.p + 'Q'] || '') + '"></label></div>' +
    '<div class="rs-list" id="' + o.p + '-list">' + respListHTML(o) + '</div>';
}

export { respListHTML, respScreenHTML, respSections };
