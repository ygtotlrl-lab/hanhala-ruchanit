// app/domain.exam.js — המבחנים: רשימת התלמידים עם ציון, הערה וסריקה, פרטי המבחן והקבצים
// המבחן הוא «סדר» של הזרם השלישי (HR_STREAMS.exams) — השמירה, הסנכרון והארכיון משותפים; כאן רק מה שנבדל.
import { idEq, pendMark } from '../core/sync.js';
import { esc, toast } from '../core/ui.js';
import { HR_CLS_SHORT, HR_FILES_BUCKET, MSG_FILE_TOO_BIG, MSG_UPLOAD_FAIL, MSG_UPLOAD_NEEDS_NET,
         MSG_UPLOAD_OK } from './constants.js';
import { S } from './state.js';
import { getStudents, hrMirrorPutRecs, hrSortStudents } from './domain.js';
import { hrDayHeb } from './domain.hebdate.js';
import { hrMarkOf, hrSaveData } from './domain.sessions.js';
import { _hrOpenRec, hrMarkDirty } from './domain.reg.js';
import { icon } from './icons.js';
import { hrStudentOn } from './domain.periods.js';

var EX_MAX_BYTES = 15 * 1024 * 1024;

function _exGrade(m) {
  if (!m || m.grade == null || m.grade === '') return null;
  var g = Number(m.grade);
  return isFinite(g) ? g : null;
}

// ── פרטי המבחן — חומר, קבצים, והאם נכנס לגיליון ──
// נבנים רק כשהמבחן מתחלף — ציור חוזר היה מוחק את מה שמוקלד בשדה החומר.
function _exInfoHTML(st, rec) {
  var p = st.p;
  function fileBox(kind, label) {
    var path = rec[kind];
    return '<div class="ex-file">' +
      '<span class="ex-file-lbl">' + label + '</span>' +
      (path ? '<button data-act="' + p + '-open-file" data-path="' + esc(path) + '" class="ex-file-open">' + icon('pdf') + 'צפייה</button>' : '') +
      '<label class="ex-file-up">' + icon('upload') + (path ? 'החלפה' : 'העלאה') +
        '<input type="file" accept="image/*,application/pdf" class="hidden" data-chg="' + p + '-file" data-kind="' + kind + '"></label>' +
    '</div>';
  }
  return '<div class="field-label">חומר המבחן</div>' +
    '<textarea aria-label="חומר המבחן" rows="2" class="ex-material" data-inp="' + p + '-material" placeholder="לדוגמה: פרק המפקיד, דף לה–לז">' + esc(rec.material || '') + '</textarea>' +
    '<div class="ex-files">' + fileBox('material_file', 'החומר הנלמד') + fileBox('draft_file', 'טיוטת המבחן') + '</div>' +
    '<label class="ex-report-tog"><input type="checkbox" data-chg="' + p + '-in-report"' + (rec.in_report ? ' checked' : '') + '>' +
      'זה המבחן שנכנס לגיליון החודשי ב' + esc(rec.session || '') + '</label>';
}

function hrRenderExam(st, forceInfo) {
  var rec = _hrOpenRec(st);
  var info = document.getElementById(st.p + '-exam-info');
  if (info && rec && (forceInfo || info.getAttribute('data-rec') !== String(rec.client_id))) {
    info.setAttribute('data-rec', String(rec.client_id));
    info.innerHTML = _exInfoHTML(st, rec);
  }
  var el = document.getElementById(st.p + '-students');
  if (!el) return;
  var students = hrSortStudents(getStudents()).filter(function (s) { return hrStudentOn(s, rec ? rec.session_date : null); });
  if (!students.length) { el.innerHTML = '<div class="empty-note">אין תלמידים פעילים</div>'; return; }
  var buf = S[st.v + 'Marks'] || {}, p = st.p;
  var todo = [], done = [];
  students.forEach(function (s) { (_exGrade(buf[s.client_id]) != null ? done : todo).push(s); });
  function row(s) {
    var m = buf[s.client_id] || {}, g = _exGrade(m), sid = esc(s.client_id);
    var cls = HR_CLS_SHORT[s.cls] || s.cls || '';
    var scan = m.scan
      ? '<button data-act="' + p + '-open-file" data-path="' + esc(m.scan) + '" class="ex-scan-open" title="צפייה בסריקה" aria-label="צפייה בסריקה">' + icon('pdf') + '</button>'
      : '';
    return '<div class="ex-row' + (g != null ? ' ex-row-done' : '') + '">' +
      '<div class="at-row-class">' + esc(cls) + '</div>' +
      '<div class="at-row-name">' + esc(s.name) + '</div>' +
      '<input aria-label="ציון (1–100)" type="number" min="1" max="100" step="1" inputmode="numeric" placeholder="ציון" class="ex-grade" ' +
        'value="' + (g != null ? g : '') + '" data-inp="' + p + '-grade" data-chg="' + p + '-grade" data-id="' + sid + '">' +
      '<div class="ex-scan">' + scan +
        '<label class="ex-scan-up" title="' + (m.scan ? 'החלפת הסריקה' : 'העלאת סריקה') + '">' + icon('upload') + '<span>' + (m.scan ? 'החלפה' : 'סריקה') + '</span>' +
          '<input type="file" accept="image/*,application/pdf" class="hidden" data-chg="' + p + '-scan" data-id="' + sid + '"></label>' +
      '</div>' +
    '</div>';
  }
  var html = todo.map(row).join('');
  if (done.length) {
    html += '<div class="at-group-sep"><span class="rule-line"></span>נבחנו · ' + done.length + '<span class="rule-line"></span></div>';
    html += done.map(row).join('');
  }
  el.innerHTML = html;
}

// הציון נשמר בכל הקלדה, והשורה יורדת למטה רק ביציאה מהשדה — אחרת היא קופצת באמצע ההקלדה.
function hrExamSetGrade(st, sid, val, redraw) {
  var s = String(sid), buf = S[st.v + 'Marks'];
  var raw = String(val == null ? '' : val).trim();
  var cur = buf[s] || hrMarkOf(st, '', 0, '');
  var next = hrMarkOf(st, '', 0, cur.note, { scan: cur.scan });
  if (raw !== '') {
    var g = parseInt(raw, 10);
    if (!isFinite(g)) return;
    g = Math.max(1, Math.min(100, g)); // ציון בין 1 ל-100; תלמיד שלא נבחן — בלי ציון
    next.grade = g; next.status = 'd';
  }
  buf[s] = next;
  S[st.v + 'Cleared'][s] = true;
  hrMarkDirty(st);
  if (redraw) hrRenderExam(st);
}

function hrExamSetField(st, field, val) {
  var rec = _hrOpenRec(st);
  if (!rec) return;
  rec[field] = val;
  rec.updated_at = Date.now();
  hrMarkDirty(st);
}

// מבחן אחד לכל לימוד בכל חודש עברי נכנס לגיליון — סימון אחד מוריד את הסימון משאר המבחנים באותו לימוד ובאותו חודש.
function hrExamSetInReport(st, on) {
  var rec = _hrOpenRec(st);
  if (!rec) return;
  rec.in_report = !!on;
  rec.updated_at = Date.now();
  hrMarkDirty(st);
  if (!on) return;
  var h = hrDayHeb(rec.session_date), touched = false, data = S[st.v + 'Data'] || [];
  data.forEach(function (r) {
    if (!r || r.deleted || idEq(r.client_id, rec.client_id) || r.session !== rec.session || !r.in_report) return;
    var hr = hrDayHeb(r.session_date);
    if (hr.hy !== h.hy || hr.mi !== h.mi) return;
    r.in_report = false; r.updated_at = Date.now(); touched = true;
    pendMark(st.pkSess + r.client_id);
  });
  if (touched) { hrMirrorPutRecs(st.table, data); hrSaveData(st, data, null); }
}

// ── הקבצים ──
// העלאה דורשת רשת — הקובץ אינו נשמר במראה; הנתיב הוא שנשמר, והוא חדש בכל העלאה.
async function hrExamUpload(st, input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  input.value = '';
  if (!navigator.onLine || !S.SB) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return; }
  if (file.size > EX_MAX_BYTES) { toast(MSG_FILE_TOO_BIG, null, 'warn'); return; }
  var rec = _hrOpenRec(st);
  if (!rec) return;
  var sid = input.getAttribute('data-id'), kind = input.getAttribute('data-kind');
  var ext = (String(file.name).split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  var path = 'exams/' + rec.client_id + '/' + (sid ? 'scan-' + sid : kind) + '-' + Date.now() + '.' + ext;
  var lbl = input.closest('label');
  if (lbl) lbl.classList.add('is-busy');
  try {
    var res = await S.SB.storage.from(HR_FILES_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (!res || res.error) throw (res && res.error) || new Error('upload');
  } catch (e) {
    if (lbl) lbl.classList.remove('is-busy');
    toast(MSG_UPLOAD_FAIL + ((e && e.message) || e), null, 'bad');
    return;
  }
  if (sid) {
    var buf = S[st.v + 'Marks'], cur = buf[sid] || hrMarkOf(st, '', 0, '');
    cur.scan = path;
    buf[sid] = cur;
    hrMarkDirty(st);
    hrRenderExam(st);
  } else {
    hrExamSetField(st, kind, path);
    hrRenderExam(st, true);
  }
  toast(MSG_UPLOAD_OK, null, 'good');
}

// הקישור חתום לשעה — הדלי פרטי.
async function hrOpenFile(path) {
  if (!path) return;
  if (!navigator.onLine || !S.SB) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return; }
  var w = window.open('', '_blank');
  try {
    var res = await S.SB.storage.from(HR_FILES_BUCKET).createSignedUrl(path, 3600);
    if (!res || res.error || !res.data) throw (res && res.error) || new Error('url');
    if (w) w.location.href = res.data.signedUrl; else window.location.href = res.data.signedUrl;
  } catch (e) {
    if (w) w.close();
    toast(MSG_UPLOAD_FAIL + ((e && e.message) || e), null, 'bad');
  }
}

export { hrExamSetField, hrExamSetGrade, hrExamSetInReport, hrExamUpload, hrOpenFile, hrRenderExam };
