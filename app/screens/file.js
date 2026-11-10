// app/screens/file.js — התיק האישי: אירועים לכל תלמיד, עם תאריך, טקסט חופשי וסריקה
// האירועים הם פריטים ברשומת התלמיד (file_events), וממוזגים פריט-פריט במפתח id — כמו ההיעדרויות.
import { MSG_DELETE, dayToday } from '../../core/util.js';
import { idEq, newClientId, schedulePush, tombKill } from '../../core/sync.js';
import { sessUserId, usersNameOf } from '../../core/auth.js';
import { ask, esc, openModal, toast } from '../../core/ui.js';
import { MSG_FILE_TOO_BIG, MSG_UPLOAD_NEEDS_NET } from '../constants.js';
import { gateExt, gatePut } from '../gate.js';
import { S } from '../state.js';
import { canEdit, getStudents, saveStudents } from '../domain.js';
import { hrDayHebFmt } from '../domain.hebdate.js';
import { icon } from '../icons.js';

var FILE_MAX_BYTES = 15 * 1024 * 1024;

function _fileEvents(s) {
  return (s && Array.isArray(s.file_events) ? s.file_events : [])
    .filter(function (e) { return e && !e.deleted; })
    .sort(function (a, b) { return String(b.date || '') < String(a.date || '') ? -1 : String(b.date || '') > String(a.date || '') ? 1 : 0; });
}

function openStudentFile(sid) {
  var s = getStudents().find(function (x) { return idEq(x.client_id, sid); });
  if (!s) return;
  S._fileSid = String(sid);
  openModal('תיק אישי — ' + s.name, _fileBodyHTML(s), '<button class="btn out" data-act="modal-close">סגור</button>', icon('files'));
}

function _fileBodyHTML(s) {
  var ed = true; // הכל גלוי; ההוספה והמחיקה נבדקות בלחיצה (HR_WRITE_MODULE) — «ללא גישה» למי שבצפייה
  var form = ed ? (
    '<div class="file-form" data-ks>' +
      '<div class="file-form-row">' +
        '<label class="field-label" for="file-date">תאריך</label>' +
        '<input type="date" id="file-date" value="' + dayToday() + '">' +
      '</div>' +
      '<label class="field-label" for="file-text">האירוע</label>' +
      '<textarea id="file-text" rows="3" class="ex-material" placeholder="תיאור האירוע…"></textarea>' +
      '<div class="file-form-foot">' +
        '<label class="ex-file-up">' + icon('upload') + '<span id="file-scan-lbl">צירוף סריקה</span>' +
          '<input type="file" id="file-scan" accept="image/*,application/pdf" class="hidden" data-chg="file-scan-pick"></label>' +
        '<button class="btn" data-act="file-event-save" data-ksave>' + icon('plus') + 'הוסף אירוע</button>' +
      '</div>' +
    '</div>') : '';
  var list = _fileEvents(s);
  var rows = list.length ? list.map(function (e) {
    return '<div class="file-ev">' +
      '<div class="file-ev-head">' +
        '<span class="file-ev-date">' + esc(e.date ? hrDayHebFmt(e.date) : '—') + '</span>' +
        '<span class="file-ev-by">' + esc(usersNameOf(e.created_by_client_id) || '') + '</span>' +
        (e.scan ? '<button data-act="ex-open-file" data-path="' + esc(e.scan) + '" class="ex-scan-open">' + icon('pdf') + 'סריקה</button>' : '') +
        (ed ? '<button data-act="file-event-del" data-id="' + esc(e.id) + '" class="treat-del-btn" aria-label="מחיקה" title="מחיקה">' + icon('del') + '</button>' : '') +
      '</div>' +
      '<div class="file-ev-text">' + esc(e.text || '') + '</div>' +
    '</div>';
  }).join('') : '<div class="empty-note">אין אירועים בתיק</div>';
  return form + '<div class="file-list">' + rows + '</div>';
}

function _repaint() {
  var s = getStudents().find(function (x) { return idEq(x.client_id, S._fileSid); });
  var box = document.getElementById('modal-body');
  if (s && box) box.innerHTML = _fileBodyHTML(s);
}

function fileScanPicked(input) {
  var f = input && input.files && input.files[0];
  var lbl = document.getElementById('file-scan-lbl');
  if (lbl) lbl.textContent = f ? f.name : 'צירוף סריקה';
}

async function saveFileEvent() {
  var text = (document.getElementById('file-text') || { value: '' }).value.trim();
  var date = (document.getElementById('file-date') || { value: '' }).value || dayToday();
  var inp = document.getElementById('file-scan');
  var file = inp && inp.files && inp.files[0];
  if (!text && !file) { toast('יש לכתוב את האירוע או לצרף סריקה', null, 'warn'); return; }
  var sid = S._fileSid, scan = null, eid = newClientId();
  if (file) {
    if (!navigator.onLine) { toast(MSG_UPLOAD_NEEDS_NET, null, 'off'); return; }
    if (file.size > FILE_MAX_BYTES) { toast(MSG_FILE_TOO_BIG, null, 'warn'); return; }
    // files/<מזהה תלמיד>/<מזהה האירוע>.<סיומת>
    scan = await gatePut('files/' + sid + '/' + eid + '.' + gateExt(file), file);
    if (!scan) return;
  }
  var students = getStudents();
  var s = students.find(function (x) { return idEq(x.client_id, sid); });
  if (!s) return;
  if (!Array.isArray(s.file_events)) s.file_events = [];
  var now = Date.now();
  s.file_events.push({ id: eid, date: date, text: text, scan: scan,
                       created_by_client_id: sessUserId(), updated_at: now });
  s.updated_at = now;
  saveStudents(students);
  schedulePush();
  _repaint();
  toast('האירוע נוסף לתיק', null, 'good');
}

function deleteFileEvent(id) {
  ask('מחיקת אירוע', 'האירוע יימחק מהתיק האישי.', MSG_DELETE, icon('del')).then(function (yes) {
    if (!yes) return;
    var students = getStudents();
    var s = students.find(function (x) { return idEq(x.client_id, S._fileSid); });
    if (!s || !Array.isArray(s.file_events)) return;
    s.file_events.forEach(function (e) { if (e && idEq(e.id, id) && !e.deleted) tombKill(e); });
    s.updated_at = Date.now();
    saveStudents(students);
    schedulePush();
    _repaint();
  });
}

export { deleteFileEvent, fileScanPicked, openStudentFile, saveFileEvent };
