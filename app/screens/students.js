// app/screens/students.js — מצבת התלמידים והסטטוסים
import { dayToday, uniqHas } from '../../core/util.js';
import { idEq, newClientId, pendMark, pendTag, schedulePush } from '../../core/sync.js';
import { isAdmin } from '../../core/auth.js';
import { ask, closeModal, esc, openModal, toast } from '../../core/ui.js';
import { hebDate, hebGematria, hebMonthNames,
         hebYearLabelFull } from '../../core/hebrew.js';
import { MSG_ABSENCE_DUP, MSG_ADD_STUDENT_TITLE, MSG_ADMINS_ONLY, MSG_EDIT_STUDENT_TITLE,
         MSG_FILE_READ_FAIL, MSG_LIB_LOADING, MSG_MARKED_ACTIVE, MSG_MARKED_INACTIVE,
         MSG_MARK_INACTIVE_TITLE, MSG_NEED_STUDENT_NAME, MSG_NO_STUDENTS_WIPE,
         MSG_PDF_BUILDING, MSG_PDF_ENGINE_OFF, MSG_PDF_FAIL, MSG_PICK_END_DATE,
         MSG_PICK_REASON, MSG_PICK_START_DATE, MSG_STATUS_HISTORY, MSG_STATUS_REVERTED,
         MSG_STUDENTS_ADMIN, MSG_STUDENTS_UPDATED, MSG_STUDENTS_WIPED,
         MSG_STUDENT_MISSING, MSG_WIPE_STUDENTS_BODY, MSG_WIPE_STUDENTS_OK,
         MSG_WIPE_STUDENTS_TITLE, MSG_YEAR_ROLL_A, MSG_YEAR_ROLL_C, MSG_YEAR_ROLL_DONE,
         MSG_YEAR_ROLL_TITLE, PK_STUDENT } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { _hrStudentsRaw, _hrStudentsSaveRaw, getAbsenceReasons, getActiveAbsences,
         getStudents, hrAbsValueKey, hrCloudGet, hrPdfFont, hrSortStudents, hrWho,
         modalOpen, saveStudents, tyCls, uiShown } from '../domain.js';
import { _hcBuild, _hcFmt, _hcGet, _hcH } from '../domain.hebdate.js';
import { hrRefreshApprovalMarks } from '../domain.sessions.js';

function screenStudentsHTML() {
  return `
<div class="pg" id="pg-students">
<div class="inner">
<div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>👥 מצבת התלמידים</span><span class="gap"></span><button class="btn sm" data-act="students-print">🖨️ הדפסה</button><button id="btn-manage-list" class="hidden btn sm out" data-act="manage-list-open">⚙️ ניהול רשימה</button><input type="file" aria-label="קובץ ייבוא תלמידים" id="import-file-input" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" class="import-file" data-chg="import-students"></div>

<!-- Filter Tabs -->
<div id="class-tabs-row" class="class-tabs">
<button class="filter-chip btn sm on" id="ct-all" data-act="filter-class" data-cls="all">הכל</button>
<button class="filter-chip btn sm out" id="ct-a" data-act="filter-class" data-cls="a">שיעור א'</button>
<button class="filter-chip btn sm out" id="ct-b" data-act="filter-class" data-cls="b">שיעור ב'</button>
<button class="filter-chip btn sm out" id="ct-g" data-act="filter-class" data-cls="g">שיעור ג'</button>
<button class="inactive-tab btn sm out" id="ct-inactive" data-act="filter-class" data-cls="inactive">לא פעילים</button>
</div>
<!-- Search: ממורכזת, רוחב דינמי לפי שורת הכפתורים -->
<div class="st-add-row">
<div class="sw" id="sw-inner" data-menu="search"><input aria-label="חיפוש תלמיד" type="text" id="search-st" placeholder="חיפוש תלמיד..." data-inp="search-st" autocomplete="off"><div id="search-dropdown"></div></div>
</div>

<!-- Summary Bar -->
<div id="st-summary" class="st-summary"></div>

<!-- Students Table -->
<div>
  <div id="students-tbody"></div>
</div>

</div>

</div>
`;
}

// ── סטטוס תלמיד והחלפת משתמש ──

function openStatusForm(type) {
  var typeLabels = {approved: 'אישור', suspended: 'השעיה', left: 'לא שב'};
  var typeIcons = {approved: '✅', suspended: '⚠️', left: '🚪'};

  var reasons = (getAbsenceReasons() || {})[type] || [];

  var now = new Date();
  var mins = now.getMinutes() >= 30 ? 30 : 0;
  var defaultTime = String(now.getHours()).padStart(2,'0')+':'+String(mins).padStart(2,'0');
  var todayHeb = _hcH(now);

  var reasonOptionsHtml = reasons.map(function(r){ return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('');
  var lbl = 'sf-lbl';
  var inp = 'sf-inp';

  S._currentStatusType = type;
  openModal(typeIcons[type]+' '+typeLabels[type]+' — '+S._statusStudentName,
    '<div class="abs-tone '+tyCls(type)+' sf-dates">' +
      '<div>' +
        '<label class="'+lbl+'">סיבה</label>' +
        '<select aria-label="סיבת ההיעדרות" id="sfm-reason" class="'+inp+'"><option value="" disabled selected>בחר סיבה...</option>'+reasonOptionsHtml+'<option value="אחר">אחר</option></select>' +
      '</div>' +
      '<div>' +
        '<label class="'+lbl+'">תאריך התחלה</label>' +
        _hcBuild('sfmF', todayHeb, defaultTime) +
      '</div>' +
      '<div>' +
        '<button id="sfmT_btn" data-act="hc-toggle" type="button" class="sf-end-toggle">+ הוסף תאריך סיום</button>' +
        '<div id="sfmT_wrap" class="hidden">' +
          '<label class="'+lbl+'">תאריך סיום</label>' +
          _hcBuild('sfmT', null, '') +
        '</div>' +
      '</div>' +
    '</div>',
    '<button data-act="student-status-save" class="abs-tone '+tyCls(type)+' sf-save">שמור</button>' +
    '<button data-act="modal-close" class="sf-cancel">ביטול</button>');
}

function saveStudentStatus(type) {
  var reason = document.getElementById('sfm-reason').value;
  if (!reason) { toast(MSG_PICK_REASON, null, 'bad'); return; }
  var from = _hcGet('sfmF');
  if (!from) { toast(MSG_PICK_START_DATE, null, 'bad'); return; }
  var toWrap = document.getElementById('sfmT_wrap');
  var toOpen = uiShown(toWrap);
  var to = toOpen ? _hcGet('sfmT') : null;
  // שורת סיום פתוחה בלי תאריך — לא לשמור בשקט כאילו הכול תקין.
  if (toOpen && !to) { toast(MSG_PICK_END_DATE, null, 'bad'); return; }
  var sid = S._statusSid;

  var students = getStudents();
  var s = students.find(function(x){return idEq(x.id, sid);});
  if (!s) return;

  if (!Array.isArray(s.absences)) s.absences = [];
  // חותמת לפריט — בלעדיה מיזוג פר-פריט אינו מכריע, ומיזוג ברמת הרשומה מחליף את המערך כולו.
  var nw = {id: Date.now(), type: type, reason: reason, from: from, to: to || null,
            createdBy: hrWho(), updatedAt: Date.now()};
  // ההשוואה על הערך ולא על id — המזהה נגזר מהשעון, ושתי לחיצות היו שני מזהים לאותה היעדרות.
  if (uniqHas(s.absences.filter(function (a) { return a && !a.deleted; }), nw, hrAbsValueKey)) {
    toast(MSG_ABSENCE_DUP, null, 'bad'); return;
  }
  s.absences.push(nw);
  s.present = false;
  s.updatedAt = Date.now();

  saveStudents(students);
  hrRefreshApprovalMarks(sid);
  return '✅ סטאטוס נשמר ל-' + s.name + (to ? '' : ' — ללא תאריך סיום');
}

// ── חיפוש תלמידים ──
function onSearchInput() {
  renderStudents();
  updateSearchDropdown();
}

function updateSearchDropdown() {
  var searchEl = document.getElementById('search-st');
  var dd = document.getElementById('search-dropdown');
  if (!dd || !searchEl) return;
  var q = searchEl.value.trim();
  if (!q) { dd.classList.remove('open'); return; }
  var ql = q.toLowerCase();
  var allStudents = getStudents();
  var matches = allStudents.filter(function(s) {
    return s.name.toLowerCase().indexOf(ql) >= 0;
  }).slice(0, 8);
  if (!matches.length) { dd.classList.remove('open'); return; }
  // בורחים ל-HTML לפני בניית הביטוי — אחרת ההדגשה אינה מוצאת שם שעבר בריחה.
  var escaped = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('(' + escaped + ')', 'gi');
  dd.innerHTML = matches.map(function(s) {
    var clsLabel = CLS_NAME[s.cls] || s.cls || '';
    var nameHl = esc(s.name).replace(re, '<mark>$1</mark>');
    return '<div class="sd-item" tabindex="0" data-act="st-pick" data-id="' + esc(s.id) + '">' +
      '<span class="sd-name">' + nameHl + '</span>' +
      '<span class="sd-cls">' + esc(clsLabel) + '</span>' +
      '</div>';
  }).join('');
  dd.classList.add('open');
}

function selectSearchStudent(sid) {
  var searchEl = document.getElementById('search-st');
  var dd = document.getElementById('search-dropdown');
  var allStudents = getStudents();
  var s = allStudents.find(function(x) { return idEq(x.id, sid); });
  if (!s) return;
  if (searchEl) searchEl.value = s.name;
  if (dd) dd.classList.remove('open');
  renderStudents();
  setTimeout(function() {
    var row = document.getElementById('st-row-' + sid);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
}

var CLS_NAME={a:"שיעור א'",b:"שיעור ב'",g:"שיעור ג'"};

// ערך פגום אחד היה זורק מתוך hrPushToCloud ומפיל את כל הדחיפה — לכן הגטרים מוגנים.
function checkLoginNeeded(){
  return !AUTH.user;
}

function filterClass(cls){
  S.currentFilter=cls;
  ['all','a','b','g','inactive'].forEach(function(x){var el=document.getElementById('ct-'+x);if(el){el.classList.remove('on');el.classList.add('out');}});
  var el=document.getElementById('ct-'+cls)||document.getElementById('ct-all');
  if(el){el.classList.add('on');el.classList.remove('out');}
  renderStudents();
}

function renderStudents(){
  var allSts=hrSortStudents(getStudents());
  var activeSts=allSts.filter(function(s){return s.active!==false;});
  var inactiveSts=allSts.filter(function(s){return s.active===false;});
  var searchEl=document.getElementById('search-st');
  var search=searchEl?searchEl.value.toLowerCase():'';
  var isInactiveView=(S.currentFilter==='inactive');

  var btnML=document.getElementById('btn-manage-list');
  if(btnML) btnML.classList.toggle('hidden',!isAdmin());

  var tabsRow=document.getElementById('class-tabs-row');
  var swInner=document.getElementById('sw-inner');
  if(tabsRow&&swInner){var tw=tabsRow.offsetWidth;if(tw>0)swInner.style.setProperty('--sw-w',tw+'px');}
  var ea=document.getElementById('ct-all');
  if(ea)ea.textContent='הכל ('+activeSts.length+')';
  var ea2=document.getElementById('ct-a');
  if(ea2)ea2.textContent=CLS_NAME.a+' ('+activeSts.filter(function(s){return s.cls==='a';}).length+')';
  var eb=document.getElementById('ct-b');
  if(eb)eb.textContent=CLS_NAME.b+' ('+activeSts.filter(function(s){return s.cls==='b';}).length+')';
  var eg=document.getElementById('ct-g');
  if(eg)eg.textContent=CLS_NAME.g+' ('+activeSts.filter(function(s){return s.cls==='g';}).length+')';
  var ei=document.getElementById('ct-inactive');
  if(ei)ei.textContent='לא פעילים ('+inactiveSts.length+')';

  var sumEl=document.getElementById('st-summary');

  if(isInactiveView){
    var filtInactive=inactiveSts.filter(function(s){
      return !search||s.name.toLowerCase().indexOf(search)>=0;
    });
    if(sumEl){sumEl.innerHTML='<span class="list-subtitle">תלמידים שהוגדרו כלא פעילים — ניתן לחפש ולהחזיר לפעיל</span>';}
    var tbody=document.getElementById('students-tbody');
    if(!tbody)return;
    if(!filtInactive.length){tbody.innerHTML='<div class="empty-note">אין תלמידים לא פעילים</div>';return;}
    tbody.innerHTML=filtInactive.map(function(s,i){
      var bg=i%2===0?'zebra-a':'zebra-b';
      var yr=s.cycle||'';
      var badgeHtml=yr?'<span class="cycle-badge">מחזור '+esc(yr)+'</span>':'';
      return '<div class="'+bg+' st-row-off">'+
        '<div class="st-row-main">'+
          '<span class="st-row-name">'+esc(s.name)+pendTag(PK_STUDENT+s.id)+'</span>'+
          '<div class="badge-row">'+badgeHtml+'</div>'+
        '</div>'+
        '<div class="st-row-act">'+
          '<button data-act="st-activate" data-id="'+esc(s.id)+'" class="st-activate">↩ החזר לפעיל</button>'+
        '</div>'+
      '</div>';
    }).join('');
    return;
  }

  var filtered=activeSts.filter(function(s){
    if(S.currentFilter!=='all'&&s.cls!==S.currentFilter)return false;
    if(search&&s.name.toLowerCase().indexOf(search)<0)return false;
    return true;
  });
  var present=0,absent=0;
  activeSts.forEach(function(s){
    if(getActiveAbsences(s).length>0)absent++;else present++;
  });
  if(sumEl){sumEl.classList.add('st-summary-on');sumEl.innerHTML=
    '<span class="sum-present">&#x2705; נוכחים: '+present+'</span>'+
    '<span class="sum-absent">&#x274C; אינם נוכחים: '+absent+'</span>'+
    '<span class="sum-total">סה"כ: '+activeSts.length+'</span>';}
  var tbody=document.getElementById('students-tbody');
  if(!tbody)return;
  var html='';
  filtered.forEach(function(s,i){
    var bg=i%2===0?'zebra-a':'zebra-b';
    var clsLabel=CLS_NAME[s.cls]||s.cls;
    var isPresent=getActiveAbsences(s).length===0;
    var presIcon=isPresent
      ?'<span class="pill-present">&#x2713; נוכח</span>'
      :'<span class="pill-absent">&#x2715; אינו נוכח</span>';
    var statusBtn='<button data-act="st-attend" data-id="'+esc(s.id)+'" class="st-attend" title="עריכת סטטוס">+</button>';
    html+='<div id="st-row-'+s.id+'" class="'+bg+' st-row">';
    html+='<div class="st-row-main">';
    html+='<span class="st-row-name">'+esc(s.name)+pendTag(PK_STUDENT+s.id)+'</span>';
    html+='<div class="badge-row">';
    html+='<button data-act="st-edit" data-id="'+esc(s.id)+'" class="st-edit" title="פרטי תלמיד">&#x2630;</button>';
    html+='<span class="cls-badge">'+esc(clsLabel)+'</span>';
    html+='</div>';
    html+='</div>';
    html+='<div class="st-row-tools">';
    html+=presIcon;
    html+=statusBtn;
    html+='</div>';
    html+='</div>';
  });
  tbody.innerHTML=html;
}

// ── מחזור התלמיד ──
// נגזר משנת הלימודים ולא מרשימת שנים מוקלדת — רשימה כזו נגמרת בשנתה האחרונה.
// שנת הלימודים מתגלגלת באלול ולא בתשרי — הבוגרים עוזבים בסוף אלול.
function hrSchoolYear(now) {
  var h = hebDate(now || new Date());
  if (!h.ok) return 0;
  return (h.monthIndex === hebMonthNames(h.year).length - 1) ? h.year + 1 : h.year;
}

// המחזור הוא שנת הסיום ולא הכניסה — ג׳ מקבל את שנת הלימודים עצמה, ב׳ את הבאה, וא׳ את שלאחריה.
function hrCycleFor(cls, now) {
  var y = hrSchoolYear(now);
  var add = { g: 0, b: 1, a: 2 };
  if (!y || add[cls] == null) return '';
  var hy = y + add[cls];
  // שנה עגולה במאות נותנת שני אפסים ואין לה צורה מקוצרת — התווית המלאה ולא מחרוזת ריקה שנקראת «אין מחזור».
  return hebGematria(hy % 100, '״') || hebYearLabelFull(hy);
}

function setStudentInactive(sid){
  var students=getStudents();
  var s=students.find(function(x){return idEq(x.id, sid);});
  if(!s){toast(MSG_STUDENT_MISSING, null, 'bad');return;}
  s.active=false;
  // המחזור נרשם רק כשאין לו ערך — תלמיד שהושבת שוב היה מקבל את שנת הלחיצה ולא את מחזור הסיום שנרשם לו.
  if(!s.cycle) s.cycle=hrCycleFor(s.cls);
  s.updatedAt=Date.now();
  saveStudents(students);
  schedulePush();
  renderStudents();
  toast('✅ '+s.name+MSG_MARKED_INACTIVE, null, 'good');
}

function setStudentActive(sid){
  var students=getStudents();
  var s=students.find(function(x){return idEq(x.id, sid);});
  if(!s){toast(MSG_STUDENT_MISSING, null, 'bad');return;}
  s.active=true;
  saveStudents(students);
  schedulePush();
  renderStudents();
  toast('✅ '+s.name+MSG_MARKED_ACTIVE, null, 'good');
}

var MANAGE_PICK = {
  'add':    function () { openAddStudent(); },
  'deact':  function () { openDeactivateStudentDlg(); },
  'tmpl':   function () { downloadImportTemplate(); },
  'import': function () { document.getElementById('import-file-input').click(); },
  'delall': function () { openDeleteAllModal(); },
  'year':   function () { openYearTransitionDlg(); }
};

function openManageListDlg(){
  if(!isAdmin()){toast(MSG_ADMINS_ONLY, null, 'bad');return;}
  var ITEMS=[
    {icon:'➕',label:'הוסף תלמיד',k:'add'},
    {icon:'➖',label:'סמן תלמיד כלא פעיל',k:'deact'},
    {icon:'📥',label:'תבנית ייבוא',k:'tmpl'},
    {icon:'📤',label:'ייבוא תלמידים',k:'import'},
    {icon:'🗑️',label:'מחק הכל',k:'delall',cls:'menu-danger'},
    {icon:'🔄',label:'מעבר שנתי',k:'year',cls:'menu-warn'}
  ];
  var rowsHtml=ITEMS.map(function(item){
    return '<button data-act="manage-pick" data-mk="'+item.k+'" '+
      'class="admin-item '+(item.cls||'menu-plain')+'">'+
      '<span class="admin-ico">'+item.icon+'</span>'+item.label+
    '</button>';
  }).join('');
  openModal(MSG_STUDENTS_ADMIN,'<div class="admin-list">'+rowsHtml+'</div>','');
}

// ── סימון תלמיד כלא פעיל ──
function openDeactivateStudentDlg(){
  var students=hrSortStudents(getStudents().filter(function(s){return s.active!==false;}));
  var optsHtml=students.map(function(s){
    return '<option value="'+esc(s.id)+'">'+esc(s.name)+' ('+esc(CLS_NAME[s.cls]||s.cls)+')</option>';
  }).join('');
  openModal(MSG_MARK_INACTIVE_TITLE,
    '<select aria-label="תלמיד להשבתה" id="deact-st-sel" class="deact-sel">'+
      '<option value="">-- בחר תלמיד --</option>'+optsHtml+
    '</select>'+
    '<div class="deact-note">שימו לב: הפעולה מיידית. ניתן לשחזר מתצוגת "לא פעילים".</div>',
    '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>'+
    '<button data-act="deact-st-confirm" class="md-btn-primary">✅ אשר</button>');
}

// ── מעבר שנתי ──
function openYearTransitionDlg(){
  var _gc=hrCycleFor('g');
  var cycTxt=_gc?(' (מחזור '+_gc+')'):'';
  openModal(MSG_YEAR_ROLL_TITLE,
    '<div class="year-note">'+
      '<strong class="danger-strong">⚠️ פעולה בלתי הפיכה!</strong><br>'+
      MSG_YEAR_ROLL_C+cycTxt+' → יועברו ל<strong>לא פעילים</strong><br>'+
      '• שיעור ב\' → שיעור ג\'<br>'+
      '• שיעור א\' → שיעור ב\'<br>'+
      MSG_YEAR_ROLL_A+
    '</div>'+
    '<div class="year-danger">לא ניתן לבטל פעולה זו לאחר האישור.</div>',
    '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>'+
    '<button data-act="year-transition-confirm" class="year-go">🔄 בצע מעבר שנתי</button>');
}

function doYearTransition(){
  var students=getStudents();
  var _cycG=hrCycleFor('g');
  var changed=0;
  students.forEach(function(s){
    if(s.active===false) return;
    if(s.cls==='g'){
      s.active=false;
      if(!s.cycle) s.cycle=_cycG;
      s.updatedAt=Date.now(); changed++;
    } else if(s.cls==='b'){
      s.cls='g'; s.updatedAt=Date.now(); changed++;
    } else if(s.cls==='a'){
      s.cls='b'; s.updatedAt=Date.now(); changed++;
    }
  });
  saveStudents(students);
  schedulePush();
  filterClass('all');
  toast(MSG_YEAR_ROLL_DONE+changed+MSG_STUDENTS_UPDATED, null, 'good');
}

// ── היעדרויות ואישורים ──

// כולל היעדרויות עתידיות, לתצוגה בדיאלוג
function getAllRelevantAbsences(s) {
  var now = new Date();
  if (!Array.isArray(s.absences)) return [];
  return s.absences.filter(function(a){ return !a.deleted && (!a.to || new Date(a.to) >= now); });
}

function openAttendanceEdit(sid) {
  var students = getStudents();
  var s = students.find(function(x){return idEq(x.id, sid);});
  if (!s) return;
  S._statusSid = sid;
  S._statusStudentName = s.name;
  if (getAllRelevantAbsences(s).length > 0) { openCurrentStatusModal(); } else { openStatusPickerModal(); }
}

function openStatusPickerModal() {
  openModal(S._statusStudentName,
    '<div class="status-pick-lbl">בחר סטאטוס היעדרות:</div>' +
    '<div class="status-choice-list">' +
      '<button data-act="status-form" data-kind="approved" class="status-pick-ok">' +
        '<span class="tile-ico">✅</span><div>אישור</div>' +
      '</button>' +
      '<button data-act="status-form" data-kind="suspended" class="status-pick-warn">' +
        '<span class="tile-ico">⚠️</span><div>השעיה</div>' +
      '</button>' +
      '<button data-act="status-form" data-kind="left" class="status-pick-bad">' +
        '<span class="tile-ico">🚪</span><div>לא שב</div>' +
      '</button>' +
    '</div>', '');
}

function openCurrentStatusModal() {
  var students = getStudents();
  var s = students.find(function(x){return idEq(x.id, S._statusSid);});
  if (!s) return;
  var TL = {approved:'אישור', suspended:'השעיה', left:'לא שב'};
  var TI = {approved:'✅', suspended:'⚠️', left:'🚪'};
  var _dow = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  var fmtDt = function(v){
    if(!v) return '—';
    var d = new Date(v);
    var hd = _hcH(d);
    var hh = d.getHours(), mm = d.getMinutes();
    var timeStr = (hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
    return 'יום '+_dow[d.getDay()]+' '+_hcFmt(hd.hy,hd.mi,hd.day)+' '+timeStr;
  };
  var activeAbsences = getAllRelevantAbsences(s);
  var _now = new Date();
  var absencesHtml = activeAbsences.map(function(a) {
    var isFuture = a.from && new Date(a.from) > _now;
    var badgeHtml = isFuture
      ? '<span class="abs-future">⏳ עתידי</span>'
      : '<span class="abs-active">● פעיל</span>';
    return '<div class="abs-tone ' + tyCls(a.type) + ' abs-card">' +
      '<div class="abs-card-head">' +
        '<div class="status-head-row">' +
          '<span class="abs-ico">' + (TI[a.type]||'📋') + '</span>' +
          '<span class="abs-type-label">' + esc(TL[a.type]||a.type) + '</span>' +
          badgeHtml +
        '</div>' +
        '<button data-act="status-abs-cancel" data-id="' + esc(String(a.id)) + '" class="abs-cancel">בטל</button>' +
      '</div>' +
      (a.reason ? '<div class="abs-reason">סיבה: ' + esc(a.reason) + '</div>' : '') +
      '<div class="abs-dates">מ: ' + fmtDt(a.from) + '<br>עד: ' + (a.to ? fmtDt(a.to) : 'ללא תאריך סיום') + '</div>' +
    '</div>';
  }).join('');
  openModal(s.name, absencesHtml +
    '<button data-act="status-picker-open" class="abs-add">➕ הוסף סיבה נוספת</button>', '');
}

function hrRefreshSupervisionViews() {
  try {
    var av = document.getElementById('at-view-sup');
    if (uiShown(av) && typeof shell.atRenderSupervision === 'function') shell.atRenderSupervision();
    var sv = document.getElementById('sl-view-sup');
    if (uiShown(sv) && typeof shell.hrRenderSupervision === 'function') shell.hrRenderSupervision();
  } catch(e) { console.warn('[sup-refresh]', e); }
}

function cancelSingleAbsence(absenceId) {
  var sid = S._statusSid;
  var students = getStudents();
  var s = students.find(function(x){return idEq(x.id, sid);});
  if (!s) return;
  if (Array.isArray(s.absences)) {
    // tombstone ולא הסרה — היעדרות שהוסרה פיזית חוזרת מהענן במיזוג
    s.absences.forEach(function(a){ if (idEq(a.id, absenceId)) { a.deleted = true; a.updatedAt = Date.now(); a.deletedBy = hrWho(); } });
  }
  var stillActive = getActiveAbsences(s);
  if (stillActive.length === 0) s.present = true;
  s.updatedAt = Date.now();
  saveStudents(students);
  schedulePush();
  hrRefreshApprovalMarks(s.id);
  renderStudents();
  hrRefreshSupervisionViews();
  if (stillActive.length > 0) {
    openCurrentStatusModal();
  } else {
    closeModal();
    toast(MSG_STATUS_REVERTED + s.name, null, 'good');
  }
}

// שני מסלולי הפתיחה בונים מכאן — טופס שנבנה פעמיים נבדל בשדה, ושדה שנשמט נקרא «ריק» ולא «לא נשאל»
function studentFormHtml(sid){
  return '<label for="st-name">שם התלמיד (משפחה שם)</label>'+
    '<input aria-label="לדוגמה: כהן יצחק" type="text" id="st-name" placeholder="לדוגמה: כהן יצחק" class="st-form-input">'+
    '<label for="st-class">שיעור</label>'+
    '<select id="st-class" class="st-class-sel">'+
      '<option value="a">שיעור א\'</option>'+
      '<option value="b">שיעור ב\'</option>'+
      '<option value="g">שיעור ג\'</option>'+
    '</select>'+
    '<label for="st-cycle">מחזור</label>'+
    '<input aria-label="מחזור — לדוגמה: פ״ו" type="text" id="st-cycle" placeholder="ריק — יימלא לפי שנת הלימודים בהשבתה" maxlength="12" class="st-form-input">'+
    // משטח שגיאה מוטבע: שגיאת משתמש שמתוקנת בהקלדה, וטוסט שנעלם משאיר טופס פתוח בלי הסבר
    '<div id="st-err" class="st-err"></div>'+
    // אין היסטוריה לתלמיד שטרם נשמר — בהוספה הכפתור היה מציג «אין ראיה» בכל פעם
    (sid ? '<button data-act="st-history" data-id="'+esc(sid)+'" class="st-history-btn">📜 היסטוריית סטטוסים</button>' : '');
}

// ── היסטוריית הסטטוסים ──
// נקראת מהענן ולא מהדיסק — הדיסק מחזיק רק מה ששרד פינוי ומה שהמכשיר ראה,
// וסטטוס שנרשם ממכשיר אחר היה נעדר בלי סימן.
async function openStatusHistory(sid) {
  openModal(MSG_STATUS_HISTORY,
    '<div class="cloud-loading-note">טוען מהענן…</div>', '');
  var rows = null, failed = false;
  try { rows = await hrCloudGet('hr_students_rows'); } catch (e) { failed = true; }
  if (!Array.isArray(rows)) failed = true;
  var box = document.getElementById('modal-body');
  var ttl = document.getElementById('modal-title');
  // נבדק גם שהכותרת עדיין שלנו — מודאל אחר שנפתח בזמן ההמתנה משתמש באותו מיכל
  if (!box || !ttl || !modalOpen() || ttl.textContent.indexOf('היסטוריית סטטוסים') === -1) return;
  // כשל קריאה מוצג כ«אין ראיה» — רשימה ריקה נקראת «מעולם לא היה סטטוס»
  if (failed) {
    box.innerHTML = '<div class="hist-err">' +
      '⚠️ לא ניתן לקרוא מהענן כרגע — ⛔ אין ראיה שאין סטטוסים.<br>' +
      '<span class="list-subtitle">נסו שוב כשיש חיבור.</span></div>';
    return;
  }
  var s = rows.find(function (x) { return idEq(x.id, sid); });
  var list = (s && Array.isArray(s.absences)) ? s.absences.slice() : [];
  var TL = { approved: 'אישור', suspended: 'השעיה', left: 'לא שב' };
  var TI = { approved: '✅', suspended: '⚠️', left: '🚪' };
  var fmt = function (v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    var h = hebDate(d);
    var hh = d.getHours(), mm = d.getMinutes();
    var t = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    return (h.ok ? (h.dayLabel + ' ' + h.monthName + ' ' + h.yearLabelFull) : '—') + ' · ' + t;
  };
  var ts = function (a) { var d = new Date(a && a.from); return isNaN(d.getTime()) ? 0 : d.getTime(); };
  list.sort(function (a, b) { return ts(b) - ts(a); });
  if (!list.length) {
    box.innerHTML = '<div class="cloud-loading-note">' +
      'לא נרשם אף סטטוס לתלמיד הזה.</div>';
    return;
  }
  box.innerHTML = list.map(function (a) {
    var cancelled = !!a.deleted;
    return '<div class="abs-tone ' + (cancelled ? 'abs-tone-off abs-cancelled' : tyCls(a.type)) +
        ' hist-card">' +
      '<div class="hist-card-head">' +
        '<span class="abs-ico">' + (TI[a.type] || '📋') + '</span>' +
        '<span class="abs-type-label">' +
          esc(TL[a.type] || a.type || '—') + '</span>' +
        (cancelled ? '<span class="hist-cancelled">בוטל</span>' : '') +
      '</div>' +
      (a.reason ? '<div class="abs-reason">סיבה: ' + esc(a.reason) + '</div>' : '') +
      '<div class="abs-dates">' +
        'מ: ' + esc(fmt(a.from)) + '<br>' +
        'עד: ' + (a.to ? esc(fmt(a.to)) : 'ללא תאריך סיום') +
      '</div>' +
      '<div class="hist-meta">' +
        'נרשם ע״י: ' + esc(a.createdBy || '—') +
        (cancelled ? ' · בוטל ע״י: ' + esc(a.deletedBy || '—') : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function studentFormFoot(){
  return '<button class="btn out" data-act="modal-close">ביטול</button>'+
         '<button class="btn" data-act="student-save" data-ksave>💾 שמור</button>';
}

function openAddStudent(){
  if(checkLoginNeeded())return;
  S.editingStudentId=null;
  openModal(MSG_ADD_STUDENT_TITLE, studentFormHtml(), studentFormFoot());
  document.getElementById('st-class').value='a';
}

function editStudent(sid){
  if(checkLoginNeeded())return;
  var s=getStudents().find(function(x){return idEq(x.id, sid);});
  if(!s)return;
  S.editingStudentId=sid;
  openModal(MSG_EDIT_STUDENT_TITLE, studentFormHtml(sid), studentFormFoot());
  document.getElementById('st-name').value=s.name;
  document.getElementById('st-class').value=s.cls;
  document.getElementById('st-cycle').value=s.cycle||'';
}

function saveStudent(){
  var name=(document.getElementById('st-name')||{value:''}).value.trim();
  var cls=(document.getElementById('st-class')||{value:'a'}).value;
  var cycle=(document.getElementById('st-cycle')||{value:''}).value.trim();
  var errEl=document.getElementById('st-err');
  if(errEl) errEl.textContent='';
  if(!name){
    if(errEl) errEl.textContent=MSG_NEED_STUDENT_NAME;
    else console.error('[students] משטח השגיאה st-err חסר בטופס');
    return;
  }
  var students=getStudents();
  var newId=null;
  if(S.editingStudentId){
    var idx=students.findIndex(function(s){return idEq(s.id, S.editingStudentId);});
    if(idx>-1){students[idx].name=name;students[idx].cls=cls;students[idx].cycle=cycle;students[idx].updatedAt=Date.now();}
  } else {
    // uuid ולא maxId+1 — שני מכשירים שמוסיפים במקביל מקצים אותו מספר, והמיזוג מאחד שני תלמידים
    newId = newClientId();
    students.push({id:newId,name:name,cls:cls,cycle:cycle,updatedAt:Date.now(),createdBy:hrWho()});
    students=hrSortStudents(students);
    // אין מספור מחדש — המזהה הוא מפתח המיזוג בין מכשירים
  }
  saveStudents(students);
  // הסימון נגזר מהמזהה ולא מהאיבר האחרון — המערך ממוין אחרי ה-push,
  // והאחרון הוא האחרון בסדר הא״ב ולא זה שנוסף.
  pendMark(PK_STUDENT + (S.editingStudentId != null ? S.editingStudentId : newId));
  return '✅ תלמיד נשמר';
}

// ליבת מחיקה אחת לתלמיד בודד ולמחיקה ההמונית.
// רשומה שנעלמת בלי tombstone חוזרת מהענן — hrMergeRecords מחזיר כל רשומה מרוחקת שאין לה מקבילה.
// מחזירה את מספר הרשומות שסומנו.
function hrTombstoneStudents(ids){
  var all=_hrStudentsRaw();
  if(!all.length) all=getStudents(); // ריצה על ברירות מחדל שטרם נשמרו
  var want={};
  (ids||[]).forEach(function(id){ if(id!=null) want[String(id)]=1; });
  var ts=Date.now(), by=hrWho(), n=0;
  all.forEach(function(rec){
    if(!rec||rec.id==null||!want[String(rec.id)]||rec.deleted) return;
    rec.deleted=true; rec.updatedAt=ts; rec.deletedBy=by; n++;
  });
  _hrStudentsSaveRaw(all);
  (ids||[]).forEach(function(id){ if(id!=null) pendMark(PK_STUDENT+id); });
  return n;
}

// ── ייבוא, מחיקה המונית והדפסת המצבה ──
function importStudentsFromFile(input) {
  if (!input.files || !input.files[0]) return;
  if (typeof XLSX === 'undefined') { toast(MSG_LIB_LOADING, null, 'bad'); return; }
  var file = input.files[0];
  input.value = ''; // איפוס השדה מאפשר לייבא שוב את אותו קובץ
  var isCsv = file.name.toLowerCase().endsWith('.csv');
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var rows;
      if (isCsv) {
        var text = e.target.result.replace(/^\uFEFF/,'');
        rows = text.split(/\r?\n/).map(function(line){ return line.split(','); });
      } else {
        var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        var ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      }
      var existing = getStudents();
      var added = 0, failed = [], skipped = 0, addedIds = [];
      var clsMap = {
        'א':'a',"א'":'a','a':'a','שיעור א':'a',"שיעור א'":'a',
        'ב':'b',"ב'":'b','b':'b','שיעור ב':'b',"שיעור ב'":'b',
        'ג':'g',"ג'":'g','g':'g','שיעור ג':'g',"שיעור ג'":'g'
      };
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        // סדר העמודות בתבנית: שיעור | שם פרטי | שם משפחה
        var clsRaw = String(row[0]||'').trim();
        var first  = String(row[1]||'').trim();
        var family = String(row[2]||'').trim();
        var name = (family && first) ? family+' '+first : (family||first);
        if (!name) { skipped++; continue; }
        var clsStripped = clsRaw.replace(/['']/g,'');
        var cls = clsMap[clsRaw] || clsMap[clsStripped] || clsMap[clsStripped.slice(-1)] || null;
        if (!cls) { failed.push(name + ' (' + (clsRaw||'—') + ')'); continue; }
        // uuid ולא maxId++ — ייבוא מקביל בשני מכשירים היה מקצה אותם מזהים לתלמידים שונים
        var nid = newClientId();
        existing.push({id:nid, name:name, cls:cls, updatedAt:Date.now(), createdBy:hrWho()});
        addedIds.push(nid);
        added++;
      }
      var wrote = true;
      if (added > 0) {
        existing=hrSortStudents(existing);
        // אין מספור מחדש — המזהה הוא מפתח המיזוג.
        // באחסון מלא saveStudents מחזירה false — דיווח הצלחה בלי הבדיקה הוא כשל שקט.
        wrote = (saveStudents(existing) !== false);
        if (wrote) {
          // סימון ממתין לכל שורה מיובאת — בלעדיו היא אינה נספרת ואינה נדחפת, ושער הפינוי רשאי לפנותה
          addedIds.forEach(function(id){ pendMark(PK_STUDENT + id); });
          schedulePush();
          renderStudents();
        }
      }
      var icon = (!wrote) ? '❌' : (failed.length===0 ? '✅' : '⚠️');
      var title = wrote ? (added + ' תלמידים נוספו בהצלחה')
                        : 'הייבוא נכשל — אין מקום באחסון המכשיר';
      var bodyHtml = '';
      if (!wrote) {
        bodyHtml += '<div class="import-err"><strong>' + added + ' תלמידים לא נשמרו.</strong> ' +
                'הכתיבה המקומית נכשלה, ולכן שום דבר לא נוסף. פנה מקום ונסה שוב.</div>';
      }
      if (wrote && skipped > 0) bodyHtml += '<div>' + skipped + ' שורות ריקות דולגו</div>';
      if (wrote && failed.length > 0) {
        bodyHtml += '<div class="import-fail"><strong>' + failed.length + ' שורות נכשלו</strong> (שיעור לא מוכר):</div>';
        bodyHtml += '<div class="import-fail-list">'+esc(failed.slice(0,10).join(', '))+(failed.length>10?'...':'')+'</div>';
      }
      // הסיכום הוא הדיווח היחיד כאן — כשל כתיבה מקומית משנה את האייקון, הכותרת והגוף
      openModal(icon + ' ' + title,
        '<div class="import-done">' +
        (bodyHtml || '<div>הכל תקין!</div>') + '</div>',
        '<button class="modal-ok btn" data-act="modal-close">סגור</button>');
    } catch(err) {
      toast(MSG_FILE_READ_FAIL + (err.message||err), null, 'bad');
    }
  };
  if (isCsv) { reader.readAsText(file, 'UTF-8'); } else { reader.readAsArrayBuffer(file); }
}

// ── מחיקת כל התלמידים ──
function openDeleteAllModal() {
  if (checkLoginNeeded()) return;
  ask(MSG_WIPE_STUDENTS_TITLE,
      MSG_WIPE_STUDENTS_BODY,
      MSG_WIPE_STUDENTS_OK).then(function (yes) { if (yes) confirmDeleteAll(); });
}

function confirmDeleteAll() {
  // לא saveStudents([]) — הסרה בלי tombstone מוחזרת מהענן במיזוג הבא
  var n = hrTombstoneStudents(getStudents().map(function(s){ return s.id; }));
  schedulePush();
  renderStudents();
  if (n) toast('🗑️ ' + n + MSG_STUDENTS_WIPED, null, 'good');
  else toast(MSG_NO_STUDENTS_WIPE);
}

function downloadImportTemplate() {
  // CSV עם BOM; העמודות בסדר הפוך כדי שייראו נכון בתצוגת LTR
  var BOM = '\uFEFF';
  var rows = [
    ['שיעור', 'שם פרטי', 'שם משפחה'],
    ["שיעור א'", 'יוסף', 'כהן']
  ];
  var csv = BOM + rows.map(function(r){ return r.join(','); }).join('\r\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'תבנית_תלמידים.csv';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function printStudents() {
  try {
    if (typeof pdfMake === 'undefined') { toast(MSG_PDF_ENGINE_OFF, null, 'bad'); return; }
    toast(MSG_PDF_BUILDING);
    var students = hrSortStudents(getStudents().filter(function(s){return s.active!==false;}));
    var present = students.filter(function(s){return getActiveAbsences(s).length===0;});
    var absent  = students.filter(function(s){return getActiveAbsences(s).length>0;});
    var _todG=new Date(),_todH=_hcH(_todG);
    var today=_hcFmt(_todH.hy,_todH.mi,_todH.day);
    var NB = ' ';    function cls(c){return c==='a'?'שיעור'+NB+"א'":c==='b'?'שיעור'+NB+"ב'":'שיעור'+NB+"ג'";}
    function fixName(n){return (n||'').replace(/ /g,NB);}
    var pRows = present.map(function(s,i){return [String(i+1), fixName(s.name), cls(s.cls)];});
    var aRows = absent.map(function(s,i){return [String(i+1), fixName(s.name), cls(s.cls)];});
    if (!pRows.length) pRows = [['-','-','-']];
    if (!aRows.length) aRows = [['-','-','-']];
    var fontName = hrPdfFont();
    // שתי השורות טקסט ולא תמונת canvas — ה-bidi בספרייה עצמה, ותמונה הייתה מבטלת חיפוש בקובץ
    var subtitleTxt = {text:'דוח'+NB+'נוכחות'+NB+'—'+NB+today, fontSize:11, color:'#555',
                       alignment:'center', margin:[0,0,0,14], direction:'ltr'};
    var summaryTxt  = {text:'סה״כ:'+NB+students.length+NB+'|'+NB+'נוכחים:'+NB+present.length+NB+
                             '|'+NB+'אינם'+NB+'נוכחים:'+NB+absent.length,
                       fontSize:13, bold:true, color:'#333', alignment:'center',
                       margin:[0,0,0,20], direction:'ltr'};
    var docDef = {
      pageSize:'A4', pageMargins:[40,40,40,40],
      content:[
        {text:'ישיבת'+NB+'תומכי'+NB+'תמימים'+NB+'ראשל"צ', fontSize:18, bold:true, alignment:'center', margin:[0,0,0,4], color:'#1a3a6b'},
        subtitleTxt,
        summaryTxt,
        {text:[{text:'נוכחים'},{text:NB+'('+present.length+')',direction:'ltr'}], fontSize:13, bold:true, color:'#276749', alignment:'right', margin:[0,0,0,6]},
        {table:{widths:['auto','*','auto'],body:[['#','שם','שיעור']].concat(pRows)}, margin:[0,0,0,20]},
        {text:[{text:'אינם'+NB+'נוכחים'},{text:NB+'('+absent.length+')',direction:'ltr'}], fontSize:13, bold:true, color:'#c53030', alignment:'right', margin:[0,0,0,6]},
        {table:{widths:['auto','*','auto'],body:[['#','שם','שיעור']].concat(aRows)}}
      ],
      defaultStyle:{font:fontName, alignment:'right'}
    };
    pdfMake.createPdf(docDef).download('nochechut-'+dayToday()+'.pdf');
  } catch(e) {
    console.error('[pdf]', e);
    toast(MSG_PDF_FAIL + (e && e.message ? e.message : e), null, 'bad');
  }
}

export { MANAGE_PICK, cancelSingleAbsence, doYearTransition, editStudent, filterClass,
         importStudentsFromFile, onSearchInput, openAttendanceEdit, openManageListDlg,
         openStatusForm, openStatusHistory, openStatusPickerModal, printStudents,
         renderStudents, saveStudent, saveStudentStatus, screenStudentsHTML,
         selectSearchStudent, setStudentActive, setStudentInactive };
