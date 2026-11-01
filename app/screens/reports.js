// app/screens/reports.js — גיליון הציונים וההנהגה: חודש עברי, תלמיד, ומה שמתמלא לבד ומה שהרב ממלא
// מתמלא לבד: חיסורים ואיחורים (הסדרים והתפילות), המבחנים, זמן שינה. הרב ממלא: ההנהגה, הפנימייה וההערות האישיות.
// השדות הידניים — שורה לכל חודש, תלמיד ושדה ב-hr_report_vals; החישוב — מהמראה, בכל ציור.
import { pendMarkMany, schedulePush } from '../../core/sync.js';
import { MIRROR, mirrorSave } from '../../core/mirror.js';
import { closeModal, esc, openModal, toast } from '../../core/ui.js';
import { hebYearLabelFull } from '../../core/hebrew.js';
import { HR_EXAM_SUBJECTS, HR_FILES_BUCKET, PK_RP_VAL } from '../constants.js';
import { S } from '../state.js';
import { canEdit, getStudents, hrMarks, hrMirrorRecs, hrSortStudents } from '../domain.js';
import { _hcH, _hcMN, hrHebMonthWin } from '../domain.hebdate.js';
import { contactsUrl } from './contacts.js';
import { icon } from '../icons.js';

// ── הסולם והרף ──
var RP_SCALE = ['מצוין מאוד', 'מצוין', 'טוב מאוד', 'כמעט טוב מאוד', 'טוב', 'כמעט טוב', 'מספיק', 'מספיק בקושי', 'בלתי מספיק'];
// הרף מגיליון «דראפט פון צונויפגיסן»: עד הערך — הדרגה שבמקומו; מעבר לאחרון — הדרגה שאחריו.
var RP_ABS_STEPS = [3, 5, 7, 10, 12, 15, 20];          // חיסורים בחודש (סדרים ותפילות)
var RP_LATE_STEPS = [30, 70, 100, 120, 150, 200, 300]; // דקות איחור בחודש
var RP_SLEEP_STEPS = [0, 2, 4, 6, 9, 12, 16, 20];      // נקודות שינה: היעלמות = 7, כל 10 דקות איחור = 1
var RP_LATE_LK = 5, RP_LATE_LM = 15;                   // איחור בתפילה בדקות: קל · משמעותי
function rpGrade(steps, v) {
  for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return RP_SCALE[i];
  return RP_SCALE[steps.length];
}

// ── השדות הידניים ──
var RP_GENERAL = [['g1', 'יראת שמים והנהגה חסידית'], ['g2', 'משמעת וקבלת עול'], ['g3', 'הלכות ועבודת תפילה']];
var RP_SUBJ_H = HR_EXAM_SUBJECTS.map(function (n, i) { return ['h' + i, n]; });
var RP_INTERNAT = [['p1', 'סדר וניקיון'], ['p2', 'שמירת הרכוש']];
var RP_ROLES = [['n1', 'ראש הישיבה'], ['n2', 'משגיח'], ['n3', 'ר"מ'], ['n4', 'משפיע'], ['n5', 'משפיע'], ['n6', 'משיב'], ['n7', 'מדריך']];
var RP_CLS = { a: 'א', b: 'ב', g: 'ג' };

function rpFieldLabel(f) {
  var all = RP_GENERAL.concat(RP_INTERNAT, RP_ROLES);
  for (var i = 0; i < all.length; i++) if (all[i][0] === f) return all[i][1];
  for (var j = 0; j < RP_SUBJ_H.length; j++) if (RP_SUBJ_H[j][0] === f) return 'הנהגה — ' + RP_SUBJ_H[j][1];
  return f;
}

// ── החודש ──
function rpMonth() {
  if (!S._rpMonth) { var h = _hcH(new Date()); S._rpMonth = { hy: h.hy, mi: h.mi }; }
  return S._rpMonth;
}
function rpMonthKey(m) { return m.hy + '-' + m.mi; }
function rpMonthLabel(m) { return (_hcMN(m.hy)[m.mi] || '') + ' ' + (hebYearLabelFull(m.hy) || m.hy); }
function rpMonthName(m) { return _hcMN(m.hy)[m.mi] || ''; }
function rpNav(dir) {
  var m = rpMonth(), n = _hcMN(m.hy).length, mi = m.mi + dir, hy = m.hy;
  if (mi < 0) { hy--; mi = _hcMN(hy).length - 1; }
  if (mi >= n) { hy++; mi = 0; }
  S._rpMonth = { hy: hy, mi: mi };
  renderReports();
}

// ── קריאה וכתיבה של שדה ──
var RP_T = 'hr_report_vals';
function rpRows() { return Array.isArray(MIRROR[RP_T]) ? MIRROR[RP_T] : []; }
function rpId(mk, sid, f) { return mk + ':' + sid + ':' + f; }
function rpGet(mk, sid, f) {
  var id = rpId(mk, sid, f), rows = rpRows();
  for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].client_id === id && !rows[i].deleted) return rows[i].value || '';
  return '';
}
// כתיבה של כמה שדות בבת אחת — שורה שלא השתנתה אינה נחתמת מחדש.
function rpSetMany(mk, items) {
  var rows = rpRows().slice(), byId = {}, now = Date.now(), keys = [];
  rows.forEach(function (r, i) { if (r && r.client_id) byId[r.client_id] = i; });
  items.forEach(function (it) {
    var id = rpId(mk, it.sid, it.f), v = it.v == null ? '' : String(it.v), i = byId[id];
    if (i != null) {
      var old = rows[i];
      if (!old.deleted && (old.value || '') === v) return;
      rows[i] = { client_id: id, month: mk, student_client_id: String(it.sid), field: it.f, value: v,
                  deleted: false, updated_at: now, deleted_at: null, deleted_by: null };
    } else {
      if (!v) return;
      rows.push({ client_id: id, month: mk, student_client_id: String(it.sid), field: it.f, value: v,
                  deleted: false, updated_at: now, deleted_at: null, deleted_by: null });
    }
    keys.push(PK_RP_VAL + id);
  });
  if (!keys.length) return 0;
  MIRROR[RP_T] = rows;
  mirrorSave(RP_T);
  pendMarkMany(keys);
  schedulePush();
  return keys.length;
}

// ── החישוב ──
function _inWin(rec, w) { return rec && !rec.deleted && rec.session_date >= w.from && rec.session_date <= w.to; }

// המבחן של הלימוד בחודש — המסומן «נכנס לגיליון», ובלי סימון — היחיד; כמה בלי סימון — אין (הרב בוחר במסך המבחנים).
function rpExamOf(exRecs, subj, w) {
  var list = exRecs.filter(function (r) { return _inWin(r, w) && r.session === subj; });
  var chosen = list.filter(function (r) { return r.in_report; })[0];
  if (chosen) return { rec: chosen };
  if (list.length === 1) return { rec: list[0] };
  return list.length ? { pick: list.length } : null;
}

function rpCompute(m) {
  var w = hrHebMonthWin(m.hy, m.mi);
  var at = (hrMirrorRecs('hr_sessions') || []).filter(function (r) { return _inWin(r, w); });
  var sl = (hrMirrorRecs('hr_sleep_sessions') || []).filter(function (r) { return _inWin(r, w); });
  var ex = hrMirrorRecs('hr_exams') || [];
  var exams = {};
  HR_EXAM_SUBJECTS.forEach(function (n) { exams[n] = rpExamOf(ex, n, w); });
  var out = {};
  getStudents().forEach(function (s) {
    if (s.active === false) return;
    var sid = String(s.client_id), abs = 0, late = 0, dis = 0, slate = 0;
    at.forEach(function (rec) {
      var mk = hrMarks(rec)[sid]; if (!mk) return;
      if (mk.status === 'e' || mk.status === 'x') abs++;
      else if (mk.status === 'l') late += Number(mk.minutes) || 0;
      else if (mk.status === 'lk') late += RP_LATE_LK;
      else if (mk.status === 'lm') late += RP_LATE_LM;
    });
    sl.forEach(function (rec) {
      var mk = hrMarks(rec)[sid]; if (!mk) return;
      if (mk.status === 'e' || mk.status === 'x') dis++;
      else if (mk.status === 'l') slate += Number(mk.minutes) || 0;
    });
    var pts = dis * 7 + Math.floor(slate / 10);
    var ex1 = {};
    HR_EXAM_SUBJECTS.forEach(function (n) {
      var e = exams[n];
      if (!e || !e.rec) { ex1[n] = e && e.pick ? { pick: e.pick } : null; return; }
      var mk = hrMarks(e.rec)[sid] || {};
      // תלמיד שלא סומן לו ציון במבחן של החודש — 0
      var g = (mk.grade != null && mk.grade !== '') ? Number(mk.grade) : 0;
      ex1[n] = { grade: g, scan: mk.scan || null, material: e.rec.material || '' };
    });
    out[sid] = { abs: abs, absG: rpGrade(RP_ABS_STEPS, abs), late: late, lateG: rpGrade(RP_LATE_STEPS, late),
                 sleepPts: pts, sleepG: rpGrade(RP_SLEEP_STEPS, pts), dis: dis, slate: slate, exams: ex1 };
  });
  return out;
}

// ── המסך ──
function screenReportsHTML() {
  return `
<div class="pg" id="pg-reports">
  <div class="inner">
    <div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">${icon('back')}חזרה</button><span>גיליונות ציונים והנהגה</span></div>
    <div class="rp-month card-pane">
      <button class="rp-nav" data-act="rp-nav" data-dir="-1" aria-label="החודש הקודם">${icon('prev')}</button>
      <div class="rp-month-lbl" id="rp-month-lbl"></div>
      <button class="rp-nav" data-act="rp-nav" data-dir="1" aria-label="החודש הבא">${icon('next')}</button>
    </div>
    <div class="class-tabs" id="rp-cls"></div>
    <div id="rp-fill"></div>
    <div id="rp-list"></div>
  </div>
</div>
`;
}

function _rpStudents() {
  var c = S._rpCls || 'all';
  return hrSortStudents(getStudents()).filter(function (s) { return s.active !== false && (c === 'all' || s.cls === c); });
}

function renderReports() {
  var m = rpMonth(), mk = rpMonthKey(m);
  var lbl = document.getElementById('rp-month-lbl');
  if (lbl) lbl.textContent = rpMonthLabel(m);
  var c = S._rpCls || 'all';
  var ct = document.getElementById('rp-cls');
  if (ct) ct.innerHTML = [['all', 'הכל'], ['a', "שיעור א'"], ['b', "שיעור ב'"], ['g', "שיעור ג'"]].map(function (x) {
    return '<button class="filter-chip btn sm ' + (c === x[0] ? 'on' : 'out') + '" data-act="rp-cls" data-cls="' + x[0] + '">' + x[1] + '</button>';
  }).join('');
  var sts = _rpStudents(), n = sts.length;
  function filled(f) { return sts.filter(function (s) { return !!rpGet(mk, s.client_id, f); }).length; }
  function btn(f, label) {
    var k = filled(f);
    return '<button class="rp-fill-btn' + (k === n && n ? ' rp-full' : '') + '" data-act="rp-fill" data-f="' + f + '">' +
      '<span class="rp-fill-lbl">' + esc(label) + '</span><span class="rp-fill-n">' + k + '/' + n + '</span></button>';
  }
  var fill = document.getElementById('rp-fill');
  if (fill) fill.innerHTML = canEdit('reports') ?
    '<div class="rp-sec">הנהגה כללית</div><div class="rp-fills">' + RP_GENERAL.map(function (x) { return btn(x[0], x[1]); }).join('') + '</div>' +
    '<div class="rp-sec">הנהגה בחומר הלימודים</div><div class="rp-fills">' + RP_SUBJ_H.map(function (x) { return btn(x[0], x[1]); }).join('') + '</div>' +
    '<div class="rp-sec">פנימייה</div><div class="rp-fills">' + RP_INTERNAT.map(function (x) { return btn(x[0], x[1]); }).join('') + '</div>' +
    '<div class="rp-sec">הערות אישיות</div><div class="rp-fills">' + RP_ROLES.map(function (x) { return btn(x[0], x[1]); }).join('') + '</div>' : '';
  var comp = rpCompute(m);
  var list = document.getElementById('rp-list');
  if (!list) return;
  if (!n) { list.innerHTML = '<div class="empty-note">אין תלמידים</div>'; return; }
  var pick = HR_EXAM_SUBJECTS.filter(function (s0) { var e = comp[String(sts[0].client_id)].exams[s0]; return e && e.pick; });
  list.innerHTML =
    (pick.length ? '<div class="warn-note">⚠️ ב' + esc(pick.join(', ')) + ' יש כמה מבחנים החודש — יש לסמן במסך המבחנים איזה מהם נכנס לגיליון.</div>' : '') +
    '<div class="rp-list-head"><span>' + n + ' תלמידים · ' + esc(rpMonthLabel(m)) + '</span>' +
      '<button class="btn sm" data-act="rp-print-all">' + icon('print') + 'הדפסת כל הגיליונות</button></div>' +
    '<div class="st-table">' + sts.map(function (s, i) {
      var r = comp[String(s.client_id)] || {};
      return '<div class="rp-row"><span class="st-num">' + (i + 1) + '</span>' +
        '<div class="rp-row-main"><span class="rp-row-name">' + esc(s.name) + '</span>' +
          '<span class="rp-row-sub">חיסורים ' + r.abs + ' · איחור ' + r.late + ' ד׳ · שינה: ' + esc(r.sleepG) + '</span></div>' +
        '<button class="btn sm out" data-act="rp-print" data-id="' + esc(s.client_id) + '">' + icon('pdf') + 'גיליון</button></div>';
    }).join('') + '</div>';
}

function loadReports() { renderReports(); }
function rpSetCls(c) { S._rpCls = c; renderReports(); }

// ── המילוי — כל התלמידים בבת אחת, רשימה נפתחת ליד כל שם; בהערות האישיות — טקסט, ושם הרב לכל שיעור ──
function rpOpenFill(f) {
  var m = rpMonth(), mk = rpMonthKey(m), sts = _rpStudents();
  var isNote = /^n/.test(f);
  var opts = '<option value="">—</option>' + RP_SCALE.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('');
  var head = '';
  if (isNote) {
    var cls = {}; sts.forEach(function (s) { cls[s.cls] = 1; });
    head = '<div class="rp-staff">' + Object.keys(RP_CLS).filter(function (k) { return cls[k]; }).map(function (k) {
      return '<label class="rp-staff-row"><span>שם ה' + esc(rpFieldLabel(f)) + ' — שיעור ' + RP_CLS[k] + "'</span>" +
        '<input data-rp-staff="' + k + '" value="' + esc(rpGet(mk, 'cls-' + k, f)) + '" placeholder="הרב…"></label>';
    }).join('') + '</div>';
  }
  var rows = sts.map(function (s) {
    var v = rpGet(mk, s.client_id, f);
    var inp = isNote
      ? '<textarea rows="2" data-rp-sid="' + esc(s.client_id) + '" placeholder="הערה">' + esc(v) + '</textarea>'
      : '<select data-rp-sid="' + esc(s.client_id) + '">' + opts.replace('<option>' + esc(v) + '</option>', '<option selected>' + esc(v) + '</option>') + '</select>';
    return '<div class="rp-fill-row' + (isNote ? ' rp-fill-note' : '') + '"><span class="rp-fill-cls">' + (RP_CLS[s.cls] || '') + '</span>' +
      '<span class="rp-fill-name">' + esc(s.name) + '</span>' + inp + '</div>';
  }).join('');
  S._rpFillF = f;
  openModal(rpFieldLabel(f) + ' — ' + rpMonthLabel(m),
    '<div class="rp-fill-box" data-ks>' + head + rows + '</div>',
    '<button class="btn out" data-act="modal-close">ביטול</button>' +
    '<button class="btn" data-act="rp-fill-save" data-ksave>' + icon('save') + 'שמור</button>');
}

function rpSaveFill() {
  var f = S._rpFillF, mk = rpMonthKey(rpMonth()), items = [];
  document.querySelectorAll('#modal-body [data-rp-sid]').forEach(function (el) { items.push({ sid: el.getAttribute('data-rp-sid'), f: f, v: el.value.trim() }); });
  document.querySelectorAll('#modal-body [data-rp-staff]').forEach(function (el) { items.push({ sid: 'cls-' + el.getAttribute('data-rp-staff'), f: f, v: el.value.trim() }); });
  var n = rpSetMany(mk, items);
  closeModal();
  renderReports();
  toast(n ? '✅ נשמר' : 'לא היה שינוי', null, n ? 'good' : null);
}

// ── הגיליון להדפסה ──
// הרקע — המסגרת מהעיצוב (ב״ה, הכותרת, הפס האפור, «יחי» והלוגו), והתוכן מעליה; עמוד שני להערות האישיות.
function _sheetHTML(s, m, r, mk, scanUrls) {
  function v(f) { return esc(rpGet(mk, s.client_id, f)); }
  function tr(lbl, val, extra) { return '<tr><th>' + esc(lbl) + '</th><td' + (extra ? '' : ' colspan="2"') + '>' + val + '</td>' + (extra || '') + '</tr>'; }
  var subj = HR_EXAM_SUBJECTS.map(function (n, i) {
    var e = r.exams[n], g = '—', link = '';
    if (e && e.grade != null) {
      g = String(e.grade);
      var u = e.scan && scanUrls[e.scan];
      link = u ? '<a href="' + esc(u) + '">טופס ⇱</a>' : '';
    }
    return '<tr><th rowspan="2" class="vlbl"><span>' + esc(n) + '</span></th><th>מבחן</th><td>' + g + '</td><td class="lnk">' + link + '</td></tr>' +
      '<tr><th>הנהגה</th><td colspan="2">' + v('h' + i) + '</td></tr>';
  }).join('');
  var head = '<div class="nm">' + esc(s.name) + '</div><div class="mo">' + esc(rpMonthName(m)) + '</div>';
  var p1 = '<section class="pg">' + head + '<div class="body">' +
    '<h3>הנהגה כללית</h3><table>' + RP_GENERAL.map(function (x) { return tr(x[1], v(x[0])); }).join('') + '</table>' +
    '<h3>שמירת הסדרים</h3><table>' +
      '<tr><th>חיסורים</th><td>' + r.abs + '</td><td>' + esc(r.absG) + '</td></tr>' +
      '<tr><th>איחורים</th><td>' + r.late + ' דקות</td><td>' + esc(r.lateG) + '</td></tr></table>' +
    '<h3>חומר הלימודים</h3><table class="subj">' + subj + '</table>' +
    '<h3>פנימייה</h3><table>' + tr('זמן שינה', esc(r.sleepG)) + RP_INTERNAT.map(function (x) { return tr(x[1], v(x[0])); }).join('') + '</table>' +
    '<div class="more">הערות אישיות מעבר לדף | לפרטי קשר אנשי צוות הישיבה – <a href="' + esc(contactsUrl()) + '">לחץ כאן</a></div>' +
    '<div class="sigrow"><div class="legend"><b>מקרא:</b>ציון הנהגה: ' + RP_SCALE.join(' / ') + '<br>ציון מבחנים: 0–100</div>' +
      '<div class="sig"><img src="app/img/report-sig.png" alt=""><b>הרב אליעזר יוסף חי קלנגל</b><span>משגיח ראשי</span>' +
      '<small>העתק מהגיליון נשלח לכ"ק אדמו"ר שליט"א מלך המשיח</small></div></div>' +
  '</div></section>';
  var p2 = '<section class="pg">' + head + '<div class="body"><h3 class="c">הערות אישיות</h3><table class="notes">' +
    RP_ROLES.map(function (x) {
      return '<tr><th>' + esc(x[1]) + '</th><td class="who">' + esc(rpGet(mk, 'cls-' + s.cls, x[0])) + '</td><td>' + v(x[0]) + '</td></tr>';
    }).join('') + '</table></div></section>';
  return p1 + p2;
}

var RP_PRINT_CSS =
  '@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}' +
  'body{font-family:Heebo,Arial,sans-serif;color:#333;direction:rtl;background:#888}' +
  '.pg{width:210mm;height:297mm;position:relative;background:#fff url(app/img/report-bg.png) center/100% 100% no-repeat;margin:0 auto 6mm;page-break-after:always;overflow:hidden}' +
  '@media print{body{background:none}.pg{margin:0}}' +
  '.nm{position:absolute;top:40mm;right:67mm;font-size:13pt;font-weight:700;color:#333;letter-spacing:.02em}' +
  '.mo{position:absolute;top:40mm;right:142.5mm;font-size:13pt;font-weight:700;color:#333}' +
  '.body{position:absolute;top:56mm;right:25mm;left:25mm;bottom:33mm}' +
  'h3{font-size:10.5pt;font-weight:700;margin:3.2mm 0 1.2mm;color:#444}h3.c{text-align:center;margin-top:4mm}' +
  'table{width:100%;border-collapse:collapse;font-size:9pt}' +
  'th,td{border:.25mm solid #9a9a9a;padding:1.1mm 2mm;text-align:right;vertical-align:middle}' +
  'th{width:30%;font-weight:700;background:#fafafa;color:#444}td{color:#222}' +
  'table.subj th.vlbl{width:7mm;padding:0;text-align:center}table.subj th.vlbl span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:7.5pt;white-space:nowrap}' +
  'table.subj th:not(.vlbl){width:18%}td.lnk{width:22%}a{color:#1a5fb4}' +
  '.more{font-size:8.5pt;font-weight:700;color:#555;margin-top:2.5mm}' +
  '.sigrow{display:flex;gap:6mm;align-items:flex-end;margin-top:3mm}' +
  '.legend{flex:1;border:.25mm solid #9a9a9a;padding:2mm 3mm;font-size:7.5pt;line-height:1.55;color:#555}.legend b{display:block;text-decoration:underline}' +
  '.sig{flex:1;font-size:9pt;color:#444;display:flex;flex-direction:column;gap:.6mm}.sig img{height:14mm;width:auto;align-self:flex-start}.sig small{font-size:7.5pt;color:#666;margin-top:1.5mm}' +
  'table.notes th{width:17%}table.notes td.who{width:25%;font-weight:700}table.notes td{height:12mm}';

// הקישורים לסריקות חתומים לשנה — הגיליון נשלח להורים, וקישור לשעה היה פג לפני שנפתח.
async function _scanUrls(comp, sts) {
  var paths = {};
  sts.forEach(function (s) {
    var r = comp[String(s.client_id)]; if (!r) return;
    Object.keys(r.exams).forEach(function (n) { var e = r.exams[n]; if (e && e.scan) paths[e.scan] = 1; });
  });
  var list = Object.keys(paths), out = {};
  if (!list.length || !S.SB || !navigator.onLine) return out;
  try {
    var res = await S.SB.storage.from(HR_FILES_BUCKET).createSignedUrls(list, 60 * 60 * 24 * 365);
    (res && res.data || []).forEach(function (x) { if (x && x.path && x.signedUrl) out[x.path] = x.signedUrl; });
  } catch (e) { }
  return out;
}

async function rpPrint(sid) {
  var m = rpMonth(), mk = rpMonthKey(m);
  var sts = sid ? getStudents().filter(function (s) { return String(s.client_id) === String(sid); }) : _rpStudents();
  if (!sts.length) return;
  // החלון נפתח לפני ההמתנה — דפדפן חוסם חלון שנפתח אחרי await
  var w = window.open('', '_blank');
  if (!w) { toast('⚠️ הדפדפן חסם את חלון ההדפסה', null, 'bad'); return; }
  w.document.write('<p style="font-family:Arial;padding:20px;direction:rtl">מכין את הגיליון…</p>');
  var comp = rpCompute(m), urls = await _scanUrls(comp, sts);
  var base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  var title = sts.length === 1 ? ('גיליון — ' + sts[0].name + ' — ' + rpMonthLabel(m)) : ('גיליונות — ' + rpMonthLabel(m));
  var html = '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><base href="' + esc(base) + '"><title>' + esc(title) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">' +
    '<style>' + RP_PRINT_CSS + '</style></head><body>' +
    sts.map(function (s) { return _sheetHTML(s, m, comp[String(s.client_id)], mk, urls); }).join('') +
    // ההדפסה אחרי שהתמונות והגופנים נטענו — חלון ההדפסה עוצר את הטעינה; בדפדפן אוטומטי (בדיקות) — בלי הדפסה
    '<script>window.onload=function(){var im=[].slice.call(document.images).map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r;});});' +
    'Promise.all(im.concat([document.fonts?document.fonts.ready:0])).then(function(){if(!navigator.webdriver)setTimeout(function(){window.print();},300);});};<\/script></body></html>';
  // מסמך משלו (blob) ולא document.write — בחלון ריק שנכתב בו התמונות אינן נטענות בכל הדפדפנים
  var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  w.location.href = url;
  setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
}

export { RP_SCALE, loadReports, renderReports, rpCompute, rpNav, rpOpenFill, rpPrint, rpSaveFill, rpSetCls,
         screenReportsHTML };
