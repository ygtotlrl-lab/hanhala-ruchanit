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
import { hrDayHeb, hrDayHebFmt } from '../domain.hebdate.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { fcCardHTML, fcOpenId, fcStatusHTML, fcSw } from './forms.js';

var MT_KEY = 'meeting_cfg';
var MT_CLS = ['a', 'b', 'g'];
function _gate(action, body) { return gateCall('meeting', action, body); }

// ── הדיאלוג שמהמצבה ──
function meetingUrl() { return contactsUrl().replace(/contacts\.html$/, 'meeting.html'); }
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

// ── התגובות — השיבוצים: לפי תלמיד (מי נרשם ולמי) או לפי רב ──
async function meetingResponses() {
  openModal('התגובות — שיבוץ לאסיפת הורים', '<div class="en-full" id="mt-resp"><div class="ld">טוען…</div></div>', '', 'table');
  // ההגדרה — מהענן, כדי שהשעות ו«פתוח לשיבוץ» בכותרת יהיו המעודכנים ולא העותק שבמכשיר
  var both = await Promise.all([_gate('list'), hrCfgGet(MT_KEY, true).catch(function () { return null; }), hrCfgGet('meeting_past', true).catch(function () { return null; })]);
  var r = both[0], c = both[1], pp = both[2];
  if (c && c.ok && c.value && !hrSetPending(MT_KEY)) S._mtCfg = c.value;
  if (pp && pp.ok && Array.isArray(pp.value) && !hrSetPending('meeting_past')) S._mtPast = pp.value;
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
// המסך: הכותרת (היום, כמה משפחות וכמה פגישות) · מתג «לפי תלמיד» / «לפי רב» · חיפוש · הרשימה (#mt-list)
// לפי תלמיד (ברירת המחדל) — כרטיס לכל משפחה שנרשמה: השם, השיעור, ומתחתם הפגישות לפי השעה; לפי רב — רק רבנים שיש להם פגישות, ובסוף מי שעוד בלי
var MT_CLS_ORDER = ['a', 'b', 'g', 's'];
function _mtCfgNow() { return hrSetPending(MT_KEY) ? meetingCfg() : (S._mtCfg || meetingCfg()); }
// השנה שבתגובות — הנוכחית, או אסיפה שעברה (לקריאה בלבד)
function _mtPastList() { return S._mtPast || meetingPast(); }
function _mtSel() {
  var cur = _mtCfgNow(), y = S._mtYear;
  if (!y || y === _mtYearOf(cur)) return { cfg: cur, past: false };
  var p = _mtPastList().filter(function (x) { return +x.year === +y; })[0];
  return p ? { cfg: p, past: true } : { cfg: cur, past: false };
}
function meetingYear(y) { S._mtYear = +y || null; _respPaint(); }
function _mtDate() {
  var cfg = _mtSel().cfg, rows = S._mtRows || [];
  if (cfg.date) return cfg.date;
  return rows.map(function (x) { return x.meet_date; }).filter(Boolean).sort().pop() || '';
}
function _mtRowsNow() { var d = _mtDate(); return (S._mtRows || []).filter(function (x) { return !d || x.meet_date === d; }); }
function _mtStaff(rows) {
  var staff = meetingStaff().map(function (s) { return { id: s.id, name: s.name, role: s.mgmt || '' }; });
  rows.forEach(function (x) { if (!staff.some(function (s) { return s.id === x.staff_id; })) staff.push({ id: x.staff_id, name: x.staff_name, role: '' }); });
  return staff;
}
function _mtDel(x, edit) {
  return edit ? '<button class="rs-x" data-act="mt-del" data-id="' + esc(x.client_id) + '" aria-label="ביטול השיבוץ" title="ביטול השיבוץ">' + icon('del') + '</button>' : '';
}
function _mtListHTML() {
  var rows = _mtRowsNow(), edit = canEdit('forms') && !_mtSel().past, staff = _mtStaff(rows), q = (S._mtQ || '').trim();
  var role = {}; staff.forEach(function (s) { role[s.id] = s.role; });
  function hit(t) { return !q || q.split(/\s+/).every(function (w) { return String(t || '').indexOf(w) >= 0; }); }
  if (!rows.length) return '<div class="rs-empty">עדיין אין שיבוצים</div>';
  var bySlot = function (a, b) { return a.slot < b.slot ? -1 : 1; };
  if (S._mtView === 'rb') {
    var withB = staff.filter(function (s) { return rows.some(function (x) { return x.staff_id === s.id; }); });
    var empty = staff.filter(function (s) { return withB.indexOf(s) < 0; });
    var html = withB.map(function (s) {
      var mine = rows.filter(function (x) { return x.staff_id === s.id && (hit(x.student_name) || hit(s.name)); }).sort(bySlot);
      if (!mine.length) return '';
      return '<div class="rs-card open"><div class="rs-head rs-static"><span class="rs-av">' + icon('user') + '</span>' +
        '<span class="rs-main"><b>' + esc(s.name) + '</b>' + (s.role ? '<small>' + esc(s.role) + '</small>' : '') + '</span>' +
        '<span class="rs-trk">' + mine.length + (mine.length === 1 ? ' פגישה' : ' פגישות') + '</span></div><div class="mt-rows">' + mine.map(function (x) {
          return '<div class="mt-r"><span class="mt-tm">' + esc(x.slot) + '</span><span class="mt-who">' + esc(x.student_name) + '</span><span class="mt-cl">' + esc(HR_CLS_NAME[x.cls] || '') + '</span>' + _mtDel(x, edit) + '</div>';
        }).join('') + '</div></div>';
    }).join('');
    if (!html) return '<div class="rs-empty">לא נמצא שם כזה</div>';
    if (empty.length && !q) html += '<div class="mt-none">עדיין בלי פגישות: ' + empty.map(function (s) { return esc(s.name); }).join(' · ') + '</div>';
    return html;
  }
  var fam = {};
  rows.forEach(function (x) {
    var k = x.student_client_id || x.student_name;
    (fam[k] = fam[k] || { name: x.student_name, cls: x.cls, list: [], first: x.created_at }).list.push(x);
  });
  var list = Object.keys(fam).map(function (k) { return fam[k]; }).filter(function (f) { return hit(f.name); })
    .sort(function (a, b) { var ca = MT_CLS_ORDER.indexOf(a.cls), cb = MT_CLS_ORDER.indexOf(b.cls); return ca !== cb ? ca - cb : (a.name < b.name ? -1 : 1); });
  if (!list.length) return '<div class="rs-empty">לא נמצא שם כזה</div>';
  // כותרת קטנה לכל שיעור, ותחתיה המשפחות שלו
  var lastCls = null;
  return list.map(function (f) {
    var hd = '';
    if (f.cls !== lastCls) {
      lastCls = f.cls;
      var n = list.filter(function (g) { return g.cls === f.cls; }).length;
      hd = '<div class="mt-clsh">' + esc(HR_CLS_NAME[f.cls] || 'ללא שיעור') + '<span>' + n + (n === 1 ? ' משפחה' : ' משפחות') + '</span></div>';
    }
    var nm = String(f.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0); }).join('');
    return hd + '<div class="rs-card open"><div class="rs-head rs-static"><span class="rs-av">' + esc(nm) + '</span>' +
      '<span class="rs-main"><b>' + esc(f.name) + '</b></span>' +
      '<span class="rs-trk">' + f.list.length + (f.list.length === 1 ? ' פגישה' : ' פגישות') + '</span></div><div class="mt-rows">' +
      f.list.sort(bySlot).map(function (x) {
        return '<div class="mt-r"><span class="mt-tm">' + esc(x.slot) + '</span><span class="mt-who">' + esc(x.staff_name) + '</span><span class="mt-cl">' + esc(role[x.staff_id] || '') + '</span>' + _mtDel(x, edit) + '</div>';
      }).join('') + '</div></div>';
  }).join('');
}
function _respPaint() {
  var box = document.getElementById('mt-resp');
  if (!box) return;
  var sel = _mtSel(), cfg = sel.cfg, rows = _mtRowsNow(), d = _mtDate(), cur = _mtCfgNow(), cy = _mtYearOf(cur);
  var years = _mtPastList().map(function (p) { return { y: +p.year, d: p.date }; }).concat([{ y: cy, d: cur.date }]).filter(function (x) { return x.y; });
  var all = S._mtRows || [], selY = sel.past ? +S._mtYear : cy;
  var fams = rows.map(function (x) { return x.student_client_id || x.student_name; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
  var v = S._mtView === 'rb' ? 'rb' : 'st';
  box.innerHTML =
    (years.length > 1 ? '<div class="en-bar">' + years.map(function (x) {
      var n = all.filter(function (r) { return r.meet_date === x.d; }).length;
      return '<button class="chip' + (x.y === selY ? ' on' : '') + '" data-act="mt-year" data-y="' + x.y + '">' + esc(_yl(x.y)) + ' <b>' + n + '</b></button>';
    }).join('') + '</div>' : '') +
    '<div class="mt-sum">' +
      '<div class="mt-day">' + icon('calendar') + '<span>' + esc(d ? hrDayHebFmt(d) : 'לא נקבע תאריך') + (cfg.from && cfg.to ? ' · <bdi dir="ltr">' + esc(cfg.from) + '–' + esc(cfg.to) + '</bdi>' : '') + '</span>' +
        '<em class="' + (!sel.past && cfg.open ? 'on' : '') + '">' + (sel.past ? 'הסתיימה · לקריאה בלבד' : cfg.open ? 'פתוח לשיבוץ' : 'השיבוץ סגור') + '</em></div>' +
      '<div class="mt-kpis"><div><b>' + fams + '</b><span>משפחות נרשמו</span></div><div><b>' + rows.length + '</b><span>פגישות נקבעו</span></div></div>' +
    '</div>' +
    '<div class="rs-top"><div class="mt-seg"><button class="' + (v === 'st' ? 'on' : '') + '" data-act="mt-mode" data-v="st">לפי תלמיד</button>' +
      '<button class="' + (v === 'rb' ? 'on' : '') + '" data-act="mt-mode" data-v="rb">לפי רב</button></div>' +
      '<label class="rs-search">' + icon('search') + '<input type="search" placeholder="חיפוש לפי שם" data-inp="mt-q" value="' + esc(S._mtQ || '') + '"></label></div>' +
    '<div class="rs-list" id="mt-list">' + _mtListHTML() + '</div>';
}
function meetingMode(v) { S._mtView = v === 'rb' ? 'rb' : 'st'; _respPaint(); }
function meetingSearch(v) { S._mtQ = v; var box = document.getElementById('mt-list'); if (box) box.innerHTML = _mtListHTML(); }
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
  return '<div class="mt-brow" data-blk><span class="mt-bl">תפוס</span><input type="time" data-k="from" aria-label="משעה" value="' + esc(b.from || '') + '">' +
    '<span class="mt-bl">עד</span><input type="time" data-k="to" aria-label="עד שעה" value="' + esc(b.to || '') + '">' +
    '<button data-act="row-remove" class="fc-ib" aria-label="הסרה">' + icon('close') + '</button></div>';
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
  if (!canEdit('forms')) { shell.showDenied(); return; }
  S._mtNew = false;
  _settingsPaint(_mtCfgNow());
  try {
    var r = await hrCfgGet(MT_KEY, true);
    if (r && r.ok && r.value && !hrSetPending(MT_KEY)) {
      S._mtCfg = r.value;
      var box = document.getElementById('mt-set');
      if (box && !box.contains(document.activeElement)) _settingsPaint(r.value);
    }
  } catch (e) { console.warn('[meeting] משיכת התצורה נכשלה', e); }
}
// ── אסיפה לכל שנה ──
// meeting_cfg — האסיפה הנוכחית, והיא שבדף להורים; meeting_past — האסיפות שעברו (שנה · תאריך · שעות), לבורר השנים שבתגובות.
// «+ אסיפה חדשה» מעבירה את הנוכחית ל-meeting_past ופותחת את הבאה סגורה לשיבוץ, בלי תאריך ובלי מודעה; השיבוצים נשארים עם התאריך שלהם.
function _mtYearOf(c) {
  if (c && c.year) return +c.year;
  if (c && c.date) { var h = hrDayHeb(c.date); return h && h.hy; }
  return +(hrCfgLocalGet('school_year') || 0) || null;
}
function _yl(y) { return y ? (hebYearLabelFull(y) || String(y)) : ''; }
function meetingPast() { var v = hrCfgLocalGet('meeting_past'); return Array.isArray(v) ? v : []; }
// פס הזמן — מה פנוי לשיבוץ ומה תפוס, לפי השעות שבדף
function _tlHTML(c) {
  var f = tmin(c.from), t = tmin(c.to), n = Math.max(5, +c.slot || 10);
  if (!(t > f)) return '';
  var free = 0; for (var m = f; m + n <= t; m += n) { if (!(c.blocked || []).some(function (b) { return b.from && b.to && m >= tmin(b.from) && m < tmin(b.to); })) free++; }
  var bl = (c.blocked || []).filter(function (b) { return b.from && b.to; }).map(function (b) {
    var s0 = Math.max(f, tmin(b.from)), e0 = Math.min(t, tmin(b.to)); if (e0 <= s0) return '';
    return '<span style="right:' + ((s0 - f) / (t - f) * 100) + '%;width:' + ((e0 - s0) / (t - f) * 100) + '%"></span>';
  }).join('');
  var ticks = []; for (var h = Math.ceil(f / 60) * 60; h <= t; h += 60) ticks.push('<i style="right:' + ((h - f) / (t - f) * 100) + '%">' + ('0' + h / 60).slice(-2) + ':00</i>');
  return '<div class="fc-lbl">הזמן לשיבוץ</div><div class="mt-tl">' + bl + '</div><div class="mt-tlx">' + ticks.join('') + '</div>' +
    '<div class="mt-leg"><span>פנוי לשיבוץ · ' + free + ' משבצות לכל רב</span><span class="x">תפוס לכל הרבנים</span></div>';
}
function tmin(x) { var a = String(x || '').split(':'); return (+a[0]) * 60 + (+a[1] || 0); }
function _settingsPaint(cfg) {
  var old = document.getElementById('mt-set'), was = fcOpenId(old), y = _mtYearOf(cfg);
  var nf = S._mtNew ? '<div class="fc-new"><b>אסיפה חדשה — ' + esc(_yl((y || 0) + 1)) + '</b>' +
      '<p>האסיפה של ' + esc(_yl(y)) + ' נשמרת עם כל השיבוצים שלה, ונשארת לצפייה בתגובות. החדשה מתחילה <b>סגורה לשיבוץ</b> — בלי תאריך ובלי מודעה.</p>' +
      '<div class="fc-lbl">מה להעתיק מ' + esc(_yl(y)) + '</div>' +
      '<label class="fc-tg">השעות ואורך הפגישה' + fcSw('id="mtn-hours"', true) + '</label>' +
      '<label class="fc-tg">השעות התפוסות' + fcSw('id="mtn-blocked"', false) + '</label>' +
      '<label class="fc-tg">הנוסחים בדף וטלפון המזכירות' + fcSw('id="mtn-texts"', true) + '</label>' +
      '<div class="fc-fact"><button type="button" class="btn sm out" data-act="mt-new-cancel">ביטול</button><button type="button" class="btn sm" data-act="mt-new-make">יצירת האסיפה</button></div></div>' : '';
  var html = '<div class="en-cfg fc-page" id="mt-set" data-autosave="mt-save">' +
    '<div class="mt-yr"><span class="on">' + esc(_yl(y) || 'האסיפה הנוכחית') + '</span>' +
      (S._mtNew ? '' : '<button type="button" class="mt-yr-add" data-act="mt-new">+ אסיפה חדשה</button>') + '</div>' + nf +
    fcStatusHTML({ p: 'mt', id: 'mt-open', on: !!cfg.open, label: 'פתוח לשיבוץ', url: meetingUrl() }) +
    fcCardHTML({ id: 'fc-mt-when', ico: 'calendar', title: 'מועד האסיפה', open: was ? was === 'fc-mt-when' : true,
      sum: cfg.date ? hrDayHebFmt(cfg.date) + ' · \u2066' + (cfg.from || '') + '–' + (cfg.to || '') + '\u2069' : 'לא נקבע תאריך',
      body: '<div class="mt-when"><label>תאריך<input type="date" id="mt-date" value="' + esc(cfg.date || '') + '"></label>' +
          '<label>דקות לפגישה<input type="number" id="mt-slot" min="5" max="60" step="5" value="' + (cfg.slot || 10) + '"></label>' +
          '<label>משעה<input type="time" id="mt-from" value="' + esc(cfg.from || '17:00') + '"></label>' +
          '<label>עד שעה<input type="time" id="mt-to" value="' + esc(cfg.to || '21:00') + '"></label></div>' +
        '<div id="mt-tl-box">' + _tlHTML(cfg) + '</div>' +
        '<div class="fc-lbl">שעות תפוסות — לכל הרבנים</div>' +
        '<div class="mt-blocks" id="mt-blocks">' + (cfg.blocked || []).map(_blockRow).join('') + '</div>' +
        '<button class="add-dashed-btn" data-act="mt-block-add">+ שעות תפוסות</button>' }) +
    fcCardHTML({ id: 'fc-mt-flyer', ico: 'image', title: 'המודעה', open: was === 'fc-mt-flyer',
      sum: cfg.flyer ? 'הועלתה — בראש הדף' : 'אין מודעה',
      body: '<input type="hidden" id="mt-flyer" value="' + esc(cfg.flyer || '') + '">' +
        '<div class="mt-flyer">' + (cfg.flyer ? '<img src="' + esc(cfg.flyer) + '" alt="מודעת האסיפה">' : '') +
          '<label class="btn sm out en-upl">' + icon('upload') + (cfg.flyer ? 'החלפת המודעה' : 'העלאת מודעה') +
            '<input type="file" accept="image/*" data-chg="mt-flyer-up"></label>' +
          (cfg.flyer ? '<button class="btn sm out fc-del" data-act="mt-flyer-del">' + icon('del') + 'הסרה</button>' : '') + '</div>' }) +
    fcCardHTML({ id: 'fc-mt-staff', ico: 'user', title: 'הרבנים', open: was === 'fc-mt-staff',
      sum: 'מאנשי הקשר · ' + meetingStaff().length + ' רבנים',
      body: '<div class="mt-staff-ro">' + _staffListHTML() + '</div><p class="fc-note">הרבנים נקבעים באנשי הקשר, בהגדרות הדוחות.</p>' }) +
    fcCardHTML({ id: 'fc-mt-texts', ico: 'text', title: 'הנוסחים בדף', open: was === 'fc-mt-texts',
      sum: (cfg.phone ? 'טלפון המזכירות · ' : '') + Object.keys(cfg.texts || {}).length + ' טקסטים שונו',
      body: '<label class="mt-ph">טלפון המזכירות (בהודעה כשהשיבוץ סגור)<input type="tel" id="mt-phone" dir="ltr" value="' + esc(cfg.phone || '') + '"></label>' + textsHTML('meeting', cfg) }) +
    '</div>';
  if (old) old.outerHTML = html;
  else openModal('אסיפת הורים — הגדרות', html, '', 'settings');
}
function meetingNew(on) { S._mtNew = !!on; _settingsPaint(_mtCfgNow()); }
function meetingNewMake() {
  var cur = _mtCfgNow(), y = _mtYearOf(cur) || 0;
  var g = function (id) { return !!(document.getElementById(id) || {}).checked; };
  var past = meetingPast().filter(function (p) { return +p.year !== y; });
  if (cur.date) past.push({ year: y, date: cur.date, from: cur.from, to: cur.to, slot: cur.slot });
  past.sort(function (a, b) { return a.year - b.year; });
  var hrs = g('mtn-hours'), tx = g('mtn-texts');
  var next = { year: y + 1, date: '', open: false, flyer: '',
               from: hrs ? cur.from : '18:00', to: hrs ? cur.to : '21:00', slot: hrs ? cur.slot : 10,
               blocked: g('mtn-blocked') ? (cur.blocked || []) : [], phone: tx ? cur.phone : _phone(), texts: tx ? (cur.texts || {}) : {} };
  hrCfgSet('meeting_past', past);
  S._mtCfg = next; S._mtNew = false; S._mtYear = null;
  hrCfgSet(MT_KEY, next);
  toast('נפתחה האסיפה של ' + _yl(y + 1), null, 'good');
  _settingsPaint(next);
}
// המודעה בראש דף השיבוץ — תמונה בדלי הציבורי hr-public, תחת meeting/, בנתיב חדש בכל העלאה; מחליפים בכל שנה
async function meetingFlyerUpload(input) {
  // ההעלאה — לאסיפה הנוכחית
  var f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  if (!navigator.onLine) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return; }
  var ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
  var path = 'meeting/' + Date.now().toString(36) + '.' + ext;
  var res = await S.SB.storage.from('hr-public').upload(path, f, { contentType: f.type || undefined, upsert: false });
  if (!res || res.error) { toast(MSG_UPLOAD_FAIL + ((res && res.error && res.error.message) || ''), null, 'bad'); return; }
  var el = document.getElementById('mt-flyer'); if (el) el.value = S.SB.storage.from('hr-public').getPublicUrl(path).data.publicUrl;
  await meetingSave(); _settingsPaint(_mtCfgNow());
}
async function meetingFlyerDel() {
  var el = document.getElementById('mt-flyer'); if (el) el.value = '';
  await meetingSave(); _settingsPaint(_mtCfgNow());
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
  var cur = _mtCfgNow();
  var next = { year: _mtYearOf(cur), date: v('mt-date'), from: v('mt-from') || '17:00', to: v('mt-to') || '21:00', slot: Math.max(5, parseInt(v('mt-slot'), 10) || 10),
               open: !!(document.getElementById('mt-open') || {}).checked, phone: v('mt-phone').trim(), blocked: blocked, flyer: v('mt-flyer'), texts: textsRead(document.getElementById('mt-set')) };
  S._mtCfg = next;
  var p = hrCfgSet(MT_KEY, next);
  toast(MSG_SAVED, null, 'good');
  var tl = document.getElementById('mt-tl-box'); if (tl) tl.innerHTML = _tlHTML(next);
  var st = document.querySelector('#mt-set .fc-stat'); if (st) st.classList.toggle('on', next.open);
  return p;
}

export { meetingBlockAdd, meetingCopy, meetingFlyerDel, meetingFlyerUpload, meetingDelete, meetingPass, meetingResponses, meetingSave, meetingSettings, meetingView, meetingMode, meetingSearch, meetingNew, meetingNewMake, meetingYear };
