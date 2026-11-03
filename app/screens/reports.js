// app/screens/reports.js — גיליון הציונים וההנהגה: חודש עברי, תלמיד, ומה שמתמלא לבד ומה שהרב ממלא
// מתמלא לבד: חיסורים ואיחורים (הסדרים והתפילות), המבחנים, זמן שינה. הרב ממלא: ההנהגה, הפנימייה וההערות האישיות.
// השדות הידניים — שורה לכל חודש, תלמיד ושדה ב-hr_report_vals; החישוב — מהמראה, בכל ציור.
import { pendMarkMany, schedulePush } from '../../core/sync.js';
import { MIRROR, mirrorSave } from '../../core/mirror.js';
import { closeModal, esc, openModal, toast } from '../../core/ui.js';
import { exportDataUrl, exportFontCss } from '../../core/export.js';
import { printFile } from '../../core/share.js';
import { hebDayLabel, hebYearLabelFull } from '../../core/hebrew.js';
import { HR_CLS_CHIP, HR_CLS_LIST, HR_CLS_NAME, HR_CLS_SHORT, HR_EXAM_SUBJECTS, HR_FILES_BUCKET, MSG_PDF_BUILDING,
         MSG_PDF_FAIL, PK_RP_VAL, RP_ROLES } from '../constants.js';
import { S } from '../state.js';
import { canEdit, getStudents, hrFilterChips, hrMarks, hrMirrorRecs, hrSortStudents } from '../domain.js';
import { _hcH, _hcMN, hrDayHeb, hrHebMonthWin } from '../domain.hebdate.js';
import { contactsStaff } from './contacts.js';
import { icon } from '../icons.js';
import { hrFirstMonthKey, hrKeyParts, hrMonthKey, hrMonthKeyAdd, hrMonthKeyNow, hrStudentInHebMonth } from '../domain.periods.js';
import { stIcon } from '../../core/icons.js';

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
var RP_CLS = HR_CLS_SHORT;

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
// מפתח החודש של השדות הידניים — אותו מפתח של תקופות הפעילות («שנה-חודש», 01…13).
function rpMonthKey(m) { return hrMonthKey(m.hy, m.mi); }
function rpMonthLabel(m) { return (_hcMN(m.hy)[m.mi] || '') + ' ' + (hebYearLabelFull(m.hy) || m.hy); }
function rpMonthName(m) { return _hcMN(m.hy)[m.mi] || ''; }
// מהחודש הראשון שבו תלמיד כלשהו פעיל ועד החודש הנוכחי — כמו בהשגחה.
function rpNav(dir) {
  var m = rpMonth(), k = hrMonthKeyAdd(hrMonthKey(m.hy, m.mi), dir);
  if (!k || k < hrFirstMonthKey() || k > hrMonthKeyNow()) return;
  var p = hrKeyParts(k);
  S._rpMonth = { hy: p.hy, mi: p.mi };
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
    if (!hrStudentInHebMonth(s, m.hy, m.mi)) return;
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
      var dh = e.rec.session_date ? hrDayHeb(e.rec.session_date) : null;
      ex1[n] = { grade: g, scan: mk.scan || null, material: e.rec.material || '',
                 date: dh ? hebDayLabel(dh.day) + ' ' + (_hcMN(dh.hy)[dh.mi] || '') : '' };
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
    <div class="sup-nav-bar">
      <button class="sup-nav" id="rp-prev" data-act="rp-nav" data-dir="-1" aria-label="החודש הקודם">${icon('prev')}</button>
      <span class="sup-nav-label" id="rp-month-lbl"></span>
      <button class="sup-nav" id="rp-next" data-act="rp-nav" data-dir="1" aria-label="החודש הבא">${icon('next')}</button>
    </div>
    <div class="fchips" id="rp-cls" role="tablist" aria-label="סינון לפי שיעור"></div>
    <div id="rp-fill"></div>
    <div id="rp-list"></div>
  </div>
</div>
`;
}

// התלמידים של החודש המוצג — כל השיעורים; הסינון לפי שיעור מעליהם, והספירה בשבבים מהם.
function _rpAll() {
  var m = rpMonth();
  return hrSortStudents(getStudents()).filter(function (s) { return hrStudentInHebMonth(s, m.hy, m.mi); });
}
function _rpStudents() {
  var c = S._rpCls || 'all';
  return _rpAll().filter(function (s) { return c === 'all' || s.cls === c; });
}

function renderReports() {
  var m = rpMonth(), mk = rpMonthKey(m);
  // החצים — כבויים בגבולות, כמו בהשגחה
  var vk = hrMonthKey(m.hy, m.mi), pk = hrMonthKeyAdd(vk, -1), nk = hrMonthKeyAdd(vk, 1);
  [['rp-prev', !!pk && pk >= hrFirstMonthKey()], ['rp-next', !!nk && nk <= hrMonthKeyNow()]].forEach(function (x) {
    var b = document.getElementById(x[0]); if (!b) return;
    b.disabled = !x[1]; b.classList.toggle('sup-nav-off', !x[1]);
  });
  var lbl = document.getElementById('rp-month-lbl');
  if (lbl) lbl.textContent = rpMonthLabel(m);
  var c = S._rpCls || 'all';
  var ct = document.getElementById('rp-cls');
  if (ct) {
    var all = _rpAll();
    ct.innerHTML = hrFilterChips([['all', 'הכל', all.length]].concat(HR_CLS_LIST.map(function (k) {
      return [k, HR_CLS_CHIP[k], all.filter(function (s) { return s.cls === k; }).length];
    })), c, 'rp-cls');
  }
  var sts = _rpStudents(), n = sts.length;
  function filled(f) { return sts.filter(function (s) { return !!rpGet(mk, s.client_id, f); }).length; }
  function btn(f, label) {
    var k = filled(f);
    return '<button class="rp-fill-btn' + (k === n && n ? ' rp-full' : '') + '" data-act="rp-fill" data-f="' + f + '">' +
      '<span class="rp-fill-lbl">' + esc(label) + '</span><span class="rp-fill-n">' + k + '/' + n + '</span></button>';
  }
  // כל סעיף — כפתור שפותח את שדותיו מתחתיו; סגור כברירה, וכל כניסה למסך — הכל סגור (loadReports)
  var open = S._rpOpen || (S._rpOpen = {});
  function sec(k, title, items) {
    var full = items.filter(function (x) { return n && filled(x[0]) === n; }).length, on = !!open[k];
    return '<button class="rp-sec' + (on ? ' on' : '') + (full === items.length && n ? ' rp-full' : '') + '" data-act="rp-sec" data-k="' + k + '" aria-expanded="' + on + '">' +
        '<span class="rp-sec-t">' + esc(title) + '</span><span class="rp-fill-n">' + full + '/' + items.length + '</span>' +
        '<span class="rp-sec-ch">' + icon('down') + '</span></button>' +
      (on ? '<div class="rp-fills">' + items.map(function (x) { return btn(x[0], x[1]); }).join('') + '</div>' : '');
  }
  var fill = document.getElementById('rp-fill');
  // הכל גלוי; המילוי נבדק בלחיצה (HR_WRITE_MODULE)
  if (fill) fill.innerHTML =
    sec('g', 'הנהגה כללית', RP_GENERAL) + sec('s', 'הנהגה בחומר הלימודים', RP_SUBJ_H) +
    sec('i', 'פנימייה', RP_INTERNAT) + sec('r', 'הערות אישיות', RP_ROLES);
  var comp = rpCompute(m);
  var list = document.getElementById('rp-list');
  if (!list) return;
  if (!n) { list.innerHTML = '<div class="empty-note">אין תלמידים</div>'; return; }
  var pick = HR_EXAM_SUBJECTS.filter(function (s0) { var e = comp[String(sts[0].client_id)].exams[s0]; return e && e.pick; });
  list.innerHTML =
    (pick.length ? '<div class="warn-note">' + stIcon('warn') + 'ב' + esc(pick.join(', ')) + ' יש כמה מבחנים החודש — יש לסמן במסך המבחנים איזה מהם נכנס לגיליון.</div>' : '') +
    '<div class="rp-list-head"><span>' + n + ' תלמידים · ' + esc(rpMonthLabel(m)) + '</span>' +
      '<button class="btn sm" data-act="rp-export-all">' + icon('pdf') + 'כל הגיליונות — PDF</button></div>' +
    '<div class="st-table">' + sts.map(function (s, i) {
      var r = comp[String(s.client_id)] || {};
      return '<div class="rp-row"><span class="st-num">' + (i + 1) + '</span>' +
        '<div class="rp-row-main"><span class="rp-row-name">' + esc(s.name) + '</span>' +
          '<span class="rp-row-sub">חיסורים ' + r.abs + ' · איחור ' + r.late + ' ד׳ · שינה: ' + esc(r.sleepG) + '</span></div>' +
        '<button class="btn sm out" data-act="rp-export" data-id="' + esc(s.client_id) + '">' + icon('pdf') + 'גיליון</button></div>';
    }).join('') + '</div>';
}

function loadReports() { renderReports(); }
// כניסה למסך (showPage) — כל הסעיפים סגורים; רענון אחרי שמירה או משיכה אינו סוגר
function rpResetOpen() { S._rpOpen = {}; }
function rpToggleSec(k) { var o = S._rpOpen || (S._rpOpen = {}); o[k] = !o[k]; renderReports(); }
function rpSetCls(c) { S._rpCls = c; renderReports(); }

// ── המילוי — כל התלמידים בבת אחת, רשימה נפתחת ליד כל שם; בהערות האישיות — טקסט, ושם הרב מאנשי הקשר ──
function rpOpenFill(f) {
  var m = rpMonth(), mk = rpMonthKey(m), sts = _rpStudents();
  var isNote = /^n/.test(f);
  var opts = '<option value="">—</option>' + RP_SCALE.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('');
  var head = '';
  if (isNote) {
    // שם הרב — מאנשי הקשר שבהגדרות הדוחות, לקריאה בלבד; השלוחים — עם שיעור ג׳
    var cls = {}; sts.forEach(function (s) { cls[s.cls] = 1; });
    head = '<div class="rp-staff">' + Object.keys(RP_CLS).filter(function (k) { return cls[k]; }).map(function (k) {
      return '<div class="rp-staff-row"><span>' + esc(rpFieldLabel(f)) + ' — ' + esc(HR_CLS_NAME[k]) + '</span>' +
        '<b>' + esc(contactsStaff(k)[f] || '—') + '</b></div>';
    }).join('') + '<div class="rp-staff-src">מתוך אנשי הקשר שבהגדרות הדוחות</div></div>';
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
  var n = rpSetMany(mk, items);
  closeModal();
  renderReports();
  toast(n ? 'נשמר' : 'לא היה שינוי', null, n ? 'good' : null);
}

// ── הגיליון להדפסה ──
// הרקע — המסגרת מהעיצוב (ב״ה, הכותרת, הפס האפור, «יחי» והלוגו), והתוכן מעליה; עמוד שני להערות האישיות.
function _sheetHTML(s, m, r, mk, scanUrls) {
  function v(f) { return esc(rpGet(mk, s.client_id, f)); }
  function tr(lbl, val, extra) { return '<tr><th>' + esc(lbl) + '</th><td' + (extra ? '' : ' colspan="2"') + '>' + val + '</td>' + (extra || '') + '</tr>'; }
  // לכל לימוד: תווית מסובבת על שתי השורות (מילה בשורה) · מבחן — התיאור והתאריך, והציון בתא השמאלי (ולידו «טופס») · הנהגה
  var subj = HR_EXAM_SUBJECTS.map(function (n, i) {
    var e = r.exams[n], g = '—', link = '', desc = '';
    if (e && e.grade != null) {
      g = String(e.grade);
      var u = e.scan && scanUrls[e.scan];
      link = u ? ' <a href="' + esc(u) + '">טופס</a>' : '';
      desc = [e.material, e.date].filter(Boolean).map(esc).join(' · ');
    }
    return '<tr><th rowspan="2" class="vlbl"><span class="r">' + n.split(' ').map(esc).join('<br>') + '</span></th><th>מבחן</th><td>' + desc + '</td><td class="gr">' + g + link + '</td></tr>' +
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
    // שורת טקסט, בלי קישור — הקישור נשלח בהודעה שמצורפת לגיליון
    '<div class="foot"><div class="more">הערות אישיות מעבר לדף | לפרטי קשר אנשי צוות הישיבה – קישור מצו"ב</div>' +
    '<div class="sigrow"><div class="legend"><b>מקרא:</b>ציון הנהגה: ' + RP_SCALE.join(' / ') + '<br>ציון מבחנים: 0–100</div>' +
      '<div class="sig"><img src="app/img/report-sig.png" alt=""><b>הרב אליעזר יוסף חי קלנגל</b><span>משגיח ראשי</span>' +
      '<small>העתק מהגיליון נשלח לכ"ק אדמו"ר שליט"א מלך המשיח</small></div></div></div>' +
  '</div></section>';
  var staff = contactsStaff(s.cls);
  var p2 = '<section class="pg">' + head + '<div class="body"><table class="notes">' +
    // כותרת לכל עמודה: מעל השם — «שם ומשפחה», ומעל ההערה — «הערות אישיות»; עמודת התפקיד מסבירה את עצמה
    '<thead><tr class="nh"><th></th><th>שם ומשפחה</th><th>הערות אישיות</th></tr></thead>' +
    RP_ROLES.map(function (x) {
      return '<tr><th>' + esc(x[1]) + '</th><td class="who">' + esc(staff[x[0]] || '') + '</td><td>' + v(x[0]) + '</td></tr>';
    }).join('') + '</table></div></section>';
  return p1 + p2;
}

var RP_PRINT_CSS =
  '@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}' +
  'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:F,sans-serif;color:#333;direction:rtl;background:#fff}' +
  '.pg{width:210mm;height:297mm;position:relative;background:#fff url(@@BG@@) center/100% 100% no-repeat;break-after:page;overflow:hidden}' +
  // השם והחודש ממורכזים לגובה בפס האפור שברקע (38.5–50.5 מ״מ)
  '.nm,.mo{position:absolute;top:38.5mm;height:12mm;display:flex;align-items:center;font-size:13pt;font-weight:700;color:#333}' +
  '.nm{right:67mm;letter-spacing:.02em}.mo{right:142.5mm}' +
  // הגוף נגמר מעל «יחי אדוננו»; המקרא והחתימה מעוגנים לתחתיתו, והטבלאות זורמות מלמעלה
  '.body{position:absolute;top:55mm;right:25mm;left:25mm;bottom:44mm}' +
  'h3{font-size:10pt;font-weight:700;margin:2.2mm 0 .8mm;color:#444}h3.c{text-align:center;margin-top:4mm}' +
  'table{width:100%;border-collapse:collapse;font-size:9pt}' +
  // כל שורה בכל הטבלאות — אותו גובה
  'tr{height:6.3mm}' +
  'th,td{border:.25mm solid #8a8a8a;padding:0 2mm;text-align:right;vertical-align:middle}' +
  'th{width:30%;font-weight:700;background:#e4e4e4;color:#333}td{color:#222}' +
  // התווית האנכית — מסובבת, מילה בשורה, ומרווח מהגבול
  'table.subj th.vlbl{width:9mm;padding:0;text-align:center;position:relative;background:#d6d6d6}' +
  'table.subj th.vlbl .r{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-90deg);font-size:7pt;line-height:1.15;white-space:nowrap;text-align:center}' +
  'table.subj th:not(.vlbl){width:16%}td.gr{width:20%;font-weight:700}a{color:#1a5fb4;font-weight:400}' +
  '.more{font-size:8.5pt;font-weight:700;color:#555;margin-bottom:2.5mm}' +
  '.foot{position:absolute;bottom:0;right:0;left:0}.sigrow{display:flex;gap:6mm;align-items:flex-end}' +
  '.legend{flex:1;border:.25mm solid #9a9a9a;padding:2mm 3mm;font-size:7.5pt;line-height:1.55;color:#555}.legend b{display:block;text-decoration:underline}' +
  '.sig{flex:1;font-size:9pt;color:#444;display:flex;flex-direction:column;gap:.6mm}.sig img{height:12mm;width:auto;align-self:flex-start}.sig small{font-size:7.5pt;color:#666;margin-top:1.5mm}' +
  'table.notes tr.nh{height:auto}table.notes tr.nh th{width:auto;border:none;background:none;text-align:center;font-size:10pt;padding:4mm 0 1.5mm;color:#444}' +
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

// הייצוא — מסמך (printFile): הגיליונות כדף HTML אחד, עמוד A4 לכל דף, והגופנים, הרקע והחתימה מוטמעים בו;
// הקישורים (טופס · אנשי קשר) נשארים קישורים בקובץ.
async function rpExport(sid) {
  var m = rpMonth(), mk = rpMonthKey(m);
  var sts = sid ? getStudents().filter(function (s) { return String(s.client_id) === String(sid); }) : _rpStudents();
  if (!sts.length) return;
  toast(MSG_PDF_BUILDING);
  try {
    var comp = rpCompute(m);
    var parts = await Promise.all([_scanUrls(comp, sts), exportFontCss('F'),
      exportDataUrl('app/img/report-bg.png'), exportDataUrl('app/img/report-sig.png')]);
    var name = (sts.length === 1 ? ('גיליון ' + sts[0].name + ' ') : 'גיליונות ') + rpMonthLabel(m);
    var html = '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(name) + '</title>' +
      '<style>' + parts[1] + RP_PRINT_CSS.replace('@@BG@@', parts[2]) + '</style></head><body>' +
      sts.map(function (s) { return _sheetHTML(s, m, comp[String(s.client_id)], mk, parts[0]); }).join('')
        .split('src="app/img/report-sig.png"').join('src="' + parts[3] + '"') +
      '</body></html>';
    printFile(html, name);
  } catch (e) {
    console.error('[rp-export]', e);
    toast(MSG_PDF_FAIL + ((e && e.message) || e), null, 'warn');
  }
}

export { RP_SCALE, loadReports, rpResetOpen, rpToggleSec, renderReports, rpCompute, rpNav, rpExport, rpOpenFill, rpSaveFill, rpSetCls,
         screenReportsHTML };
