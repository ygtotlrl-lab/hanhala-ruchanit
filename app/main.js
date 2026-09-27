// app/main.js — העלייה, הניווט, מפת הפעולות ובורר התאריך העברי
import { dayIso, dayNoon, withTimeout } from '../core/util.js';
import { ctxEpoch, ctxStale, pendAlertDismiss, plStampRead, runSave,
         sbWatch } from '../core/sync.js';
import { lkReset } from '../core/auth.js';
import { actRun, closeAsk, closeModal, esc, ksKey, modalBackdrop, modalEsc, openModal,
         swApply, swHideUpdate, toast } from '../core/ui.js';
import { hebDate, hebDayLabel, hebYearLabelFull } from '../core/hebrew.js';
import { HR_ROWS_READ_KEYS, MSG_ACCESS_LIMITED, MSG_NO_LINK, MSG_PICK_STUDENT,
         MSG_SOON_TITLE, MSG_TABLES_MISSING } from './config.js';
import { AUTH, S } from './state.js';
import { _hcBase, _hcG, _hcMN, canAccess, hrPullFromCloud } from './domain.js';
import { loadDash, screenHomeHTML } from './screens/home.js';
import { closeUserMenu, confirmSwitch, doLogin, doLogout, screenLoginHTML, switchUserEl,
         toggleUserMenu } from './screens/login.js';
import { addAbsenceReason, changeMyPassword, myPasswordModal, openAddUser, openEditUser,
         renderSettings, saveAbsenceReasons, savePerms, saveUser, saveUserOrder,
         screenSettingsHTML, showSettingsHome, showSettingsModule, sortUsersByOrder,
         toggleUserActive } from './screens/settings.js';
import { MANAGE_PICK, cancelSingleAbsence, doYearTransition, editStudent, filterClass,
         importStudentsFromFile, onSearchInput, openAttendanceEdit, openManageListDlg,
         openStatusForm, openStatusHistory, openStatusPickerModal, printStudents,
         renderStudents, saveStudent, saveStudentStatus, screenStudentsHTML,
         selectSearchStudent, setStudentActive,
         setStudentInactive } from './screens/students.js';
import { atDeleteSession, atExportConfirm,
         atShowExportDialog } from './screens/attend.arc.js';
import { atCancelStudentStatusFromReg, atClearMark, atCloseSession, atConfirmLate,
         atEditSession, atOpenSession, atRenderTodaySessions, atSetLateMin, atSetMark,
         atShowTab, loadAttend, screenAttendHTML } from './screens/attend.reg.js';
import { atAddSession, atAddTreat, atAddTreatRow, atDeleteTreat, atEditMark,
         atSaveSettingsCfg, atSupDetail, atSupEditMarkDlg,
         atSupNav } from './screens/attend.sup.js';
import { hrDeleteSession, hrExportConfirm,
         hrShowExportDialog } from './screens/sleep.arc.js';
import { hrCancelStudentStatusFromReg, hrClearMark, hrCloseSession, hrConfirmLate,
         hrEditSession, hrOpenSession, hrSetLateMin, hrSetMark, hrSetNote, hrShowTab,
         loadSleep, screenSleepHTML } from './screens/sleep.reg.js';
import { hrAddTreat, hrAddTreatRow, hrDeleteTreat, hrEditMark, hrSaveSettingsCfg,
         hrSupDetail, hrSupEditMarkDlg, hrSupNav } from './screens/sleep.sup.js';

document.title = self.APP.name;

function screenReportsHTML() {
  return `
<div class="pg" id="pg-reports">
  <div class="inner">
    <div class="ptitle ksave"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>📊 דוח חודשי</span><span class="gap"></span><input type="month" aria-label="חודש הדוח" id="rm"><button class="btn" data-act="rpt-load" data-ksave>📊 הצג</button></div>
    <div id="rc"></div>
  </div>
</div>
`;
}

function screenExamsHTML() {
  return `
<div class="pg" id="pg-exams"><div class="inner"><div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>📝 מבחנים</span><span class="gap"></span></div><div class="cs"><div class="ci">📝</div><h3>מבחנים</h3><p>מודול זה בפיתוח</p></div></div></div>
`;
}

function screenFilesHTML() {
  return `
<div class="pg" id="pg-files"><div class="inner"><div class="ptitle"><button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button><span>📁 תיקים אישיים</span><span class="gap"></span></div><div class="cs"><div class="ci">📁</div><h3>תיקים אישיים</h3><p>מודול זה בפיתוח</p></div></div></div>
`;
}

function mountView() {
  var v = document.getElementById('view');
  if (!v) { console.error('[ui] אין מיכל תוכן — #view'); return; }
  v.innerHTML = screenLoginHTML() + screenHomeHTML() +
    screenStudentsHTML() +
    screenAttendHTML() +
    screenReportsHTML() +
    screenSleepHTML() +
    screenExamsHTML() +
    screenFilesHTML() +
    screenSettingsHTML();
}

mountView();

var SB=sbWatch(supabase.createClient(self.APP.supabase.url,self.APP.supabase.key));

S._hrPdfFontDone = false;

S._alefFontB64=null;

(function(){
  fetch('https://fonts.gstatic.com/s/alef/v22/FeVfS0NQpLYgrjJbC5FxxbU.ttf')
    .then(function(r){return r.arrayBuffer();})
    .then(function(buf){
      var b=new Uint8Array(buf),chunks=[];
      for(var i=0;i<b.length;i+=8192) chunks.push(String.fromCharCode.apply(null,b.subarray(i,i+8192)));
      S._alefFontB64=btoa(chunks.join(''));
    })
    .catch(function(){});
})();

function showPageInternal(pg) {
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('[data-pg]').forEach(function(b){b.classList.remove('on');});
  var pgEl=document.getElementById('pg-'+pg);
  var nbEl=document.querySelector('[data-pg="'+pg+'"]');
  if(pgEl) pgEl.classList.add('on');
  if(nbEl) nbEl.classList.add('on');
}

var UNDER_CONSTRUCTION = ['exams','files','reports'];

function showPage(pg) {
  if (pg === 'home') { showPageInternal('home'); loadDash(); return; }
  if (!AUTH.user) { return; }
  if (UNDER_CONSTRUCTION.indexOf(pg) !== -1) { showConstruction(); return; }
  if (!canAccess(pg)) { showDenied(); return; }
  showPageInternal(pg);
  renderPage(pg);
}

// מעבר מסך ורענון אחרי שמירה מציירים אותו מסך — ולכן ניתוב הציור בנקודה אחת.
function renderPage(pg) {
  if (pg === 'students' && typeof renderStudents === 'function') renderStudents();
  if (pg === 'settings') renderSettings();
  if (pg === 'attend') loadAttend();
  if (pg === 'sleep') loadSleep();
}

// רענון אינו ניווט — אין לקרוא כאן ל-showPage: שמירה שמנווטת מוציאה את המשתמש ממקומו.
function saveRefresh() {
  var on = document.querySelector('.pg.on');
  if (on && on.id) renderPage(String(on.id).replace(/^pg-/, ''));
}

;

S._hcVw={};

// נתוני שנה מלוח הדפדפן: {hy, lb, jd (א׳ תשרי), ml[], leap}
S._hrYearCache={};

;

;

;

function _hcH(d){
  var h=hebDate(d);
  return {hy:h.year,mi:h.monthIndex,day:h.day};}

;

function _hcYL(hy){return hebYearLabelFull(hy)||String(hy);}

;

function _hcFmt(hy,mi,day){return hebDayLabel(day)+' ב'+(_hcMN(hy)[mi]||'')+' '+_hcYL(hy);}

;

function _hcNav(pfx,dir){
  var v=S._hcVw[pfx]||{hy:5786,mi:0},mi=v.mi+dir,hy=v.hy;
  var curMax=(_hcBase(hy)||{ml:[]}).ml.length-1;
  if(mi<0){hy--;var pb=_hcBase(hy);if(!pb)return;mi=pb.ml.length-1;}
  if(mi>curMax){hy++;if(!_hcBase(hy))return;mi=0;}
  S._hcVw[pfx]={hy:hy,mi:mi};_hcDraw(pfx);}

;

function _hcDraw(pfx){
  var v=S._hcVw[pfx],b=_hcBase(v.hy);if(!b)return;
  var pop=document.getElementById(pfx+'_pop');if(!pop)return;
  var mlen=b.ml[v.mi],fdow=_hcG(v.hy,v.mi,1).getDay();
  var selIso=(document.getElementById(pfx+'_iso')||{}).value;
  var selH=selIso?_hcH(new Date(selIso)):null;
  var todH=_hcH(new Date());
  var bs='hc-nav';
  var maxMi=(b.ml.length-1);
  var hasPrev=v.mi>0||!!_hcBase(v.hy-1),hasNext=v.mi<maxMi||!!_hcBase(v.hy+1);
  // בגריד RTL התא הימני הוא יום ראשון, ולכן מספר התאים הריקים הוא fdow.
  var rtlOffset=fdow;
  var h='<div class="hc-cal">';
  // חץ ימני — החודש הקודם, שמאלי — הבא
  h+='<div class="hc-head">';
  h+='<button data-act="hc-nav" data-pfx="'+esc(pfx)+'" data-dir="-1" class="'+bs+(hasPrev?'':' hc-nav-off')+'"'+(hasPrev?'':' disabled')+'>›</button>';
  h+='<span class="hc-month">'+_hcMN(v.hy)[v.mi]+'&nbsp;'+_hcYL(v.hy)+'</span>';
  h+='<button data-act="hc-nav" data-pfx="'+esc(pfx)+'" data-dir="1" class="'+bs+(hasNext?'':' hc-nav-off')+'"'+(hasNext?'':' disabled')+'>‹</button>';
  h+='</div>';
  h+='<div class="hc-dow-row">';
  ['א','ב','ג','ד','ה','ו','ש'].forEach(function(x){h+='<div class="hc-dow">'+x+'</div>';});
  h+='</div>';
  h+='<div class="hc-grid">';
  for(var i=0;i<rtlOffset;i++)h+='<div></div>';
  for(var d=1;d<=mlen;d++){
    var isSel=selH&&selH.hy===v.hy&&selH.mi===v.mi&&selH.day===d;
    var isToday=todH.hy===v.hy&&todH.mi===v.mi&&todH.day===d;
    var st=isSel?'hc-day-sel':isToday?'hc-day-today':'hc-day';
    h+='<button data-act="hc-pick" data-pfx="'+esc(pfx)+'" data-hy="'+v.hy+'" data-mi="'+v.mi+'" data-day="'+d+'" '+
      'class="hc-day-btn '+st+'">'+hebDayLabel(d)+'</button>';
  }
  h+='</div></div>';pop.innerHTML=h;}

;

// הסוג עובר במחלקה שמציבה משתנה --ty אחד; סוג לא מוכר נופל לברירת המחדל של abs-tone ואינו יוצר גוון רביעי.
function tyCls(t) {
  return (t === 'approved' || t === 'suspended' || t === 'left') ? 'abs-tone-' + t : '';
}

// הגוון באסימון --at-<קוד>, והמחלקה מציבה אותו במשתנה --at; קוד לא מוכר נשאר בברירת המחדל.
function atvCls(code) {
  var v = ['p', 'l', 'e', 'x', 'ap', 'ak', 'a'].indexOf(code) < 0 ? '' : 'at-code-' + code;
  return 'at-code' + (v ? ' ' + v : '');
}

// נקרא מהתצוגה המחושבת — אלמנט שהוסתר במחלקה מחזיר style.display ריק ונקרא כפתוח.
// פרטית כאן: משרתת את הלוח הקופץ, שמוסתר במחלקה.
function uiShown(el) {
  if (!el) return false;
  return getComputedStyle(el).display !== 'none';
}

function _hcOpen(pfx){
  var pop=document.getElementById(pfx+'_pop');if(!pop)return;
  if(uiShown(pop)){pop.classList.add('hidden');return;}
  document.querySelectorAll('.hc-pop').forEach(function(p){p.classList.add('hidden');});
  var iso=(document.getElementById(pfx+'_iso')||{}).value;
  var vh=iso?_hcH(new Date(iso)):_hcH(new Date());
  S._hcVw[pfx]={hy:vh.hy,mi:vh.mi};_hcDraw(pfx);
  // position fixed מחושב מהטריגר — חסין ל-overflow:hidden בהורים; הערכים נכתבים למשתני CSS שהכלל .hc-pop קורא.
  var trg=document.getElementById(pfx+'_trg');
  if(trg){
    var r=trg.getBoundingClientRect();
    pop.style.setProperty('--pop-top',(r.bottom+4)+'px');
    pop.style.setProperty('--pop-right',(window.innerWidth-r.right)+'px');
  }
  pop.classList.remove('hidden');}

;

function _hcPick(pfx,hy,mi,day){
  var g=_hcG(hy,mi,day);
  var iso=dayIso(g);
  var el=document.getElementById(pfx+'_iso');if(el)el.value=iso;
  var lb=document.getElementById(pfx+'_lbl');
  if(lb){
    var lbTxt=_hcFmt(hy,mi,day);
    if(pfx==='at_date'||pfx==='sfmF'||pfx==='sfmT'){var _AT_DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];lbTxt='יום '+_AT_DOW[dayNoon(iso).getDay()]+' '+lbTxt;}
    lb.textContent=lbTxt;
  }
  var pop=document.getElementById(pfx+'_pop');if(pop)pop.classList.add('hidden');
  if(pfx==='at_date'&&typeof atRenderTodaySessions==='function') atRenderTodaySessions();}

;

// שדה ריק מחזיר null ולא new Date() — אחרת «בלי תאריך סיום» הופך ל«מסתיים עכשיו» והסטטוס פג מיד.
// כל צרכני a.to מפרשים null כ«ללא תאריך סיום».
function _hcGet(pfx){
  var iso=(document.getElementById(pfx+'_iso')||{}).value;
  if(!iso) return null;
  var t=(document.getElementById(pfx+'_t')||{}).value;
  return iso+'T'+(t||'00:00');}

;

function _hcToggle(){
  var btn=document.getElementById('sfmT_btn'),wr=document.getElementById('sfmT_wrap');
  if(!btn||!wr)return;
  var open=!uiShown(wr);
  wr.classList.toggle('hidden',!open);
  btn.classList.toggle('on',open);
  if(open){
    btn.textContent='✕ הסר תאריך סיום';
  } else {
    btn.textContent='+ הוסף תאריך סיום';
    var isoEl=document.getElementById('sfmT_iso'),tEl=document.getElementById('sfmT_t'),lbl=document.getElementById('sfmT_lbl');
    if(isoEl)isoEl.value='';if(tEl)tEl.value='';if(lbl)lbl.textContent='בחר תאריך עברי';
  }}

;

function _hcBuild(pfx,initH,tv){
  var label;
  if(initH){
    label=_hcFmt(initH.hy,initH.mi,initH.day);
    if(pfx==='sfmF'||pfx==='sfmT'||pfx==='at_date'){var _BD_DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];var _bdG=_hcG(initH.hy,initH.mi,initH.day);label='יום '+_BD_DOW[_bdG.getDay()]+' '+label;}
  }else{label='בחר תאריך עברי';}
  var iso='';
  if(initH){var g=_hcG(initH.hy,initH.mi,initH.day);iso=dayIso(g);}
  var trg='hc-trigger';
  return '<div class="hc-wrap">'+
    '<div id="'+pfx+'_trg" data-act="hc-open" data-pfx="'+esc(pfx)+'" class="'+trg+'">'+
      '<span id="'+pfx+'_lbl">'+label+'</span>'+
      '<span class="hc-trigger-ico">📅</span>'+
    '</div>'+
    '<input type="hidden" id="'+pfx+'_iso" value="'+iso+'">'+
    '<div id="'+pfx+'_pop" class="hidden hc-pop-box hc-pop"></div>'+
    (tv!==undefined?'<div class="hc-time-row"><span class="hc-time-lbl">שעה:</span><input type="time" aria-label="שעה" id="'+pfx+'_t" value="'+(tv||'')+'" class="hc-time-inp"></div>':'')+
  '</div>';}

;

document.addEventListener('mousedown',function(e){
  document.querySelectorAll('.hc-pop').forEach(function(p){
    if(!uiShown(p))return;
    var pfx=p.id.replace('_pop','');
    var tr=document.getElementById(pfx+'_trg');
    if(!p.contains(e.target)&&(!tr||!tr.contains(e.target)))p.classList.add('hidden');
  });});

;

;

;

;

;

function modalOpen() {
  var m = document.getElementById('modal');
  return !!(m && m.classList.contains('open'));
}

function showConstruction() {
  openModal(MSG_SOON_TITLE,
    '<p class="soon-note">' +
      'מקום זה נמצא בבנייה ויפתח בקרוב.<br>תודה על הסבלנות!</p>',
    '<button data-act="modal-close" class="soon-ok">הבנתי</button>');
}

function showDenied() {
  openModal(MSG_ACCESS_LIMITED,
    '<p class="md-note-center">אין לך הרשאה לאפשרות זו.<br>פנה למנהל המערכת.</p>',
    '<button class="modal-ok btn" data-act="modal-close">הבנתי</button>');
}

// ── העברת מזהה ל-DOM ──
// ערך שחוזר מ-data-* הוא מחרוזת: idx + dir משרשר, ו-!'false' הוא false — ולכן ההמרה המפורשת כאן.
// מטפל שקורא לפונקציה אסינכרונית מחזיר את ההבטחה — הניתוב משבית את הכפתור לפיה, ואין להסיר את ה-return.
var DOM_ACTIONS = {
  'sw-apply':            function (el) { swApply(el); },
  'sw-dismiss':          function () { swHideUpdate(); },
  'reason-row-del':      function (el) { if (el.parentNode) el.parentNode.remove(); },
  'at-open-session':     function (el) { return atOpenSession(el.dataset.sid, el.dataset.sname); },
  'sl-open-session':     function (el) { return hrOpenSession(el.dataset.sid, el.dataset.sname); },
  // התראות התשתית נבנות ב-JS — לכן הן מנותבות במפה ולא במאזין ישיר על הכפתור.
  'ls-alert-close':      function () { var el = document.getElementById('ls-alert'); if (el) el.remove(); },
  'pend-alert-ok':       function () { pendAlertDismiss(); },
  'lk-stay':             function () { lkReset(); },
  'user-up':     function (el) { moveUser(el.getAttribute('data-id'), -1); },
  'user-down':   function (el) { moveUser(el.getAttribute('data-id'), 1); },
  'user-toggle': function (el) { return toggleUserActive(el.getAttribute('data-id'),
                                   el.getAttribute('data-active') === '1'); },
  'st-pick':     function (el) { selectSearchStudent(el.getAttribute('data-id')); },
  'st-activate': function (el) { setStudentActive(el.getAttribute('data-id')); },
  'st-attend':   function (el) { openAttendanceEdit(el.getAttribute('data-id')); },
  'st-edit':     function (el) { editStudent(el.getAttribute('data-id')); },
  'st-history':  function (el) { return openStatusHistory(el.getAttribute('data-id')); },
  // page-nav הוא page ועוד סימון הכפתור הפעיל — הסרגל התחתון מסמן, וכפתורי הפנים אינם.
  'page':        function (el) { showPage(el.getAttribute('data-page')); },
  'page-nav':    function (el) {
                   showPage(el.getAttribute('data-page'));
                   document.querySelectorAll('.bn').forEach(function (b) { b.classList.remove('on'); });
                   el.classList.add('on');
                 },
  'modal-close': function () { closeModal(); },
  'ask-no':      function () { closeAsk(false); },
  'ask-yes':     function () { closeAsk(true); },
  'manage-pick': function (el) {
                   var f = MANAGE_PICK[el.getAttribute('data-mk')];
                   closeModal();
                   if (f) f();
                 },
  'deact-st-confirm': function () {
                   var v = document.getElementById('deact-st-sel').value;
                   if (!v) { toast(MSG_PICK_STUDENT, null, 'bad'); return; }
                   setStudentInactive(parseInt(v));
                   closeModal();
                 },
  'year-transition-confirm': function () { doYearTransition(); closeModal(); },
  'at-resume-go':     function (el) { var p = atEditSession(el.getAttribute('data-id'));
                                    closeModal(); return p; },
  'at-status-cancel': function (el) { atCancelStudentStatusFromReg(el.getAttribute('data-id')); closeModal(); },
  'at-export-go':     function (el) { return atExportConfirm(el.getAttribute('data-type')); },
  'at-mark-edit':     function (el) { atSupEditMarkDlg(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'at-mark-set':      function (el) { return atEditMark(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'sl-resume-go':     function (el) { var p = hrEditSession(el.getAttribute('data-id'));
                                    closeModal(); return p; },
  'sl-status-cancel': function (el) { hrCancelStudentStatusFromReg(el.getAttribute('data-id')); closeModal(); },
  'sl-export-go':     function (el) { hrExportConfirm(el.getAttribute('data-type')); },
  'sl-mark-edit':     function (el) { hrSupEditMarkDlg(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'sl-mark-set':      function (el) { return hrEditMark(el.getAttribute('data-rec'),
                                        el.getAttribute('data-sid'), el.getAttribute('data-code')); },
  'hc-nav':           function (el) { _hcNav(el.getAttribute('data-pfx'),
                                        Number(el.getAttribute('data-dir'))); },
  'hc-pick':          function (el) { _hcPick(el.getAttribute('data-pfx'),
                                        Number(el.getAttribute('data-hy')),
                                        Number(el.getAttribute('data-mi')),
                                        Number(el.getAttribute('data-day'))); },
  'hc-open':          function (el) { _hcOpen(el.getAttribute('data-pfx')); },
  // closest('[data-act]') מחזיר את הפנימי ביותר — ולכן אין צורך ב-stopPropagation מול השורה העוטפת.
  'toggle-panel':     function (el) {
                        var e = document.getElementById(el.getAttribute('data-panel'));
                        if (e) e.classList.toggle('hidden', uiShown(e));
                      },
  'toggle-next':      function (el) {
                        var pnl = el.nextElementSibling;
                        if (!pnl) return;
                        var open = uiShown(pnl);
                        pnl.classList.toggle('hidden', open);
                        var chev = el.querySelector('.' + el.getAttribute('data-chev'));
                        if (chev) chev.classList.toggle('open', !open);
                      },
  'at-edit-session':  function (el) { return atEditSession(el.getAttribute('data-id')); },
  'at-del-session':   function (el) { atDeleteSession(el.getAttribute('data-id')); },
  'at-sup-detail':    function (el) { atSupDetail(el.getAttribute('data-id')); },
  'at-set-mark':      function (el) { atSetMark(el.getAttribute('data-id'),
                                        el.getAttribute('data-code')); },
  'at-clear-mark':    function (el) { atClearMark(el.getAttribute('data-id')); },
  'at-confirm-late':  function (el) { atConfirmLate(el.getAttribute('data-id')); },
  'at-add-treat':     function (el) { return atAddTreat(el.getAttribute('data-id')); },
  'at-del-treat':     function (el) { atDeleteTreat(el.getAttribute('data-id')); },
  'sl-edit-session':  function (el) { return hrEditSession(el.getAttribute('data-id')); },
  'sl-del-session':   function (el) { hrDeleteSession(el.getAttribute('data-id')); },
  'sl-sup-detail':    function (el) { hrSupDetail(el.getAttribute('data-id')); },
  'sl-set-mark':      function (el) { hrSetMark(el.getAttribute('data-id'),
                                        el.getAttribute('data-code')); },
  'sl-clear-mark':    function (el) { hrClearMark(el.getAttribute('data-id')); },
  'sl-confirm-late':  function (el) { hrConfirmLate(el.getAttribute('data-id')); },
  'sl-add-treat':     function (el) { return hrAddTreat(el.getAttribute('data-id')); },
  'sl-del-treat':     function (el) { hrDeleteTreat(el.getAttribute('data-id')); },
  'row-remove':  function (el) { if (el.parentNode) el.parentNode.remove(); },
  'settings-home':   function () { showSettingsHome(); },
  'settings-module': function (el) { showSettingsModule(el.getAttribute('data-mod')); },
  'filter-class':    function (el) { filterClass(el.getAttribute('data-cls')); },
  'sl-tab':          function (el) { hrShowTab(el.getAttribute('data-tab')); },
  'at-tab':          function (el) { atShowTab(el.getAttribute('data-tab')); },
  'sl-export':       function (el) { hrShowExportDialog(el.getAttribute('data-fmt')); },
  'at-export':       function (el) { atShowExportDialog(el.getAttribute('data-fmt')); },
  // כיוון הדפדוף נכנס לחישוב אינדקס — ולכן מומר למספר כאן.
  'sl-sup-nav':      function (el) { hrSupNav(Number(el.getAttribute('data-dir'))); },
  'at-sup-nav':      function (el) { atSupNav(Number(el.getAttribute('data-dir'))); },
  'absence-reason-add':  function (el) { addAbsenceReason(el.getAttribute('data-kind')); },
  'status-form':         function (el) { openStatusForm(el.getAttribute('data-kind')); },
  'user-edit':           function (el) { openEditUser({
                           id: el.getAttribute('data-uid'),
                           full_name: el.getAttribute('data-uname'),
                           username: el.getAttribute('data-uusername'),
                           role: el.getAttribute('data-urole') }); },
  'rpt-load':            function () { loadR(); },
  'absence-reasons-save': function () { return saveAbsenceReasons(); },
  'status-abs-cancel':    function (el) {
                            cancelSingleAbsence(el.getAttribute('data-id'));
                          },
  'status-picker-open':   function () { openStatusPickerModal(); },
  'student-status-save':  function () { return runSave(function () { return saveStudentStatus(S._currentStatusType); }); },
  'manage-list-open':     function () { openManageListDlg(); },
  'students-print':       function () { printStudents(); },
  'users-render':         function () { return renderUsersList(); },
  'hc-toggle':            function () { _hcToggle(); },
  'sl-settings-save':     function () { return hrSaveSettingsCfg(); },
  'at-settings-save':     function () { return atSaveSettingsCfg(); },
  'sl-session-close':     function () { return hrCloseSession(); },
  'at-session-close':     function () { return atCloseSession(); },
  'at-session-add':       function () { atAddSession(); },
  'sl-treat-row-add':     function () { hrAddTreatRow(); },
  'at-treat-row-add':     function () { atAddTreatRow(); },
  'login':            function () { return doLogin(); },
  'logout':           function () { doLogout(); },
  'menu-logout':      function () { closeUserMenu(); doLogout(); },
  'my-pass':          function () { closeUserMenu(); myPasswordModal(); },
  'user-menu-toggle': function () { return toggleUserMenu(); },
  'user-add-open':    function () { openAddUser(); },
  'user-save':        function () { return saveUser(); },
  'user-switch':      function (el) { switchUserEl(el); },
  'my-pass-save':     function () { return changeMyPassword(); },
  'switch-confirm':   function () { return confirmSwitch(); },
  'student-save':     function () { return runSave(saveStudent); },
  'perms-save':       function () { return savePerms(); },
};

// החיווי בנקודת הניתוב, ורק כשהמטפל החזיר הבטחה — חיווי המתנה על פעולה מיידית הוא רעש.
// ורק על BUTTON: disabled על div אינו חוסם דבר.
// סדר המסלולים: סגירת התפריטים הצפים, סגירת הרקע (שאינו נושא data-act), ואז הניתוב.
document.addEventListener('click', function (ev) {
  var wrap = document.getElementById('user-avatar-wrap');
  if (wrap && !wrap.contains(ev.target)) closeUserMenu();
  var sw = document.getElementById('sw-inner');
  var dd = document.getElementById('search-dropdown');
  if (dd && sw && !sw.contains(ev.target)) dd.classList.remove('open');
  if (modalBackdrop(ev)) return;
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!el) return;
  var fn = DOM_ACTIONS[el.getAttribute('data-act')];
  if (!fn) return;
  ev.preventDefault();
  actRun(el, fn);
});

// שמירה בשדה עריכה קודמת לסגירת המודאל — אחרת Escape בשדה שבתוך מודאל היה סוגר אותו במקום לבטל את השדה.
document.addEventListener('keydown', function (e) {
  if (ksKey(e)) return;
  modalEsc(e);
  // Enter בשדה הדקות מאשר את האיחור — השדה אינו בהיקף ksave ואין לו כפתור שמירה.
  if (e.key !== 'Enter' || !e.target || !e.target.dataset || !e.target.dataset.kent) return;
  e.preventDefault();
  if (e.target.dataset.kent === 'at-late') atConfirmLate(e.target.dataset.id);
  else if (e.target.dataset.kent === 'sl-late') hrConfirmLate(e.target.dataset.id);
});

document.addEventListener('input', function (e) {
  var el = e.target; if (!el || !el.dataset) return;
  var k = el.dataset.inp;
  if (k === 'search-st') onSearchInput();
  else if (k === 'at-late') atSetLateMin(el.dataset.id, el.value);
  else if (k === 'sl-late') hrSetLateMin(el.dataset.id, el.value);
  else if (k === 'sl-note') hrSetNote(el.dataset.id, el.value);
});

document.addEventListener('change', function (e) {
  var el = e.target;
  if (el && el.dataset && el.dataset.chg === 'import-students') importStudentsFromFile(el);
});

function moveUser(id, dir) {
  var el = document.getElementById('users-list');
  var rows = Array.from(el.querySelectorAll('.ur'));
  var ids = rows.map(function(r){ return r.getAttribute('data-row-id'); });
  var idx = ids.indexOf(String(id));
  if (idx < 0) return;
  var swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= ids.length) return;
  var tmp = ids[idx]; ids[idx] = ids[swapIdx]; ids[swapIdx] = tmp;
  saveUserOrder(ids);
  renderUsersList();
}

async function renderUsersList() {
  var el = document.getElementById('users-list');
  if (!el) return;
  el.innerHTML = '<div class="ld">טוען...</div>';
  // לא var {data} = await — פירוק בולע את res.error, וכשל רשת היה מוצג כ«אין משתמשים».
  var res;
  try { res = await withTimeout(SB.from('hr_users').select('*').order('full_name')); }
  catch (e) { res = { error: { message: (e && e.message) || 'timeout' } }; }
  if (!res || res.error || !Array.isArray(res.data)) {
    var em = (res && res.error && (res.error.message || res.error.code)) || MSG_NO_LINK;
    el.innerHTML = '<div class="load-err ld">❌ לא ניתן לטעון את רשימת המשתמשים' +
      '<div class="load-err-detail">' + esc(em) + '</div>' +
      '<button data-act="users-render" class="retry-btn">נסה שוב</button></div>';
    return;
  }
  var data = res.data;
  if (!data.length) { el.innerHTML = '<div class="ld">אין משתמשים</div>'; return; }
  data = sortUsersByOrder(data);
  el.innerHTML = data.map(function(u) {
    var roleClass = 'role-'+u.role;
    var roleLabel = AUTH.ROLE_LABELS[u.role] || u.role;
    var activeCls = u.active ? '' : ' is-inactive';
    return '<div class="ur'+activeCls+'" data-row-id="'+esc(u.client_id)+'">' +
      '<div class="ur-name">'+esc(u.full_name)+'<br><small class="user-handle">@'+esc(u.username)+'</small></div>' +
      '<span class="ur-role '+esc(roleClass)+'">'+esc(roleLabel)+'</span>' +
      '<div class="ua">' +
        '<button data-act="user-edit" data-uid="'+esc(u.client_id)+'" data-uname="'+esc(u.full_name)+
        '" data-uusername="'+esc(u.username)+'" data-urole="'+esc(u.role)+'">✏️</button>' +
        '<button data-act="user-up" data-id="'+esc(u.client_id)+'" title="הזז למעלה" class="user-move">⬆️</button>' +
        '<button data-act="user-down" data-id="'+esc(u.client_id)+'" title="הזז למטה" class="user-move">⬇️</button>' +
        '<button data-act="user-toggle" data-id="'+esc(u.client_id)+'" data-active="'+(u.active?'1':'0')+'" title="'+(u.active?'השבת':'הפעל')+'">'+(u.active?'🔴':'🟢')+'</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── דוחות חודשיים ──
// המסך חסום ב-UNDER_CONSTRUCTION ו-loadR אינה מוצגת; עד לאפיון — לא לחבר כאן לוגיקת דוח.
// כשייכתב: מהטבלאות המובנות בלבד, דרך hrMarks(rec) ובסינון !r.deleted.
function loadR(){
  var el = document.getElementById('rc');
  if (el) el.innerHTML = '<div class="empty">הדוח בבנייה — טרם אופיין</div>';
}

HR_ROWS_READ_KEYS.hr_sleep_sessions = 'sleep';

try { S._heColl = new Intl.Collator('he'); } catch (e) { S._heColl = null; }

var HE = S._heColl || { compare: function (a, b) { return String(a).localeCompare(String(b), 'he'); } };

// אין להחזיר כאן setInterval — הפולינג מופעל רק ב-plBoot() מ-loadDash(): פולינג לפני הכניסה מושך נתון ש-hrApplyPerms זורקת.

setTimeout(async function() {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  try {
    // דרך plStampRead בלבד — קורא שני לאותה שורה נסחף מהראשון.
    var r = await plStampRead();
    if (!r.ok) {
      // אין יצירה אוטומטית של הטבלה — טבלה חסרה היא תקלת תשתית, ולא משהו שהלקוח מתקן.
      console.warn('[sync] קריאת החותמת בעלייה נכשלה');
      return;
    }
    if (r.ts !== null) {
      if (ctxStale(_ep)) return;
      S._hrLastTs = r.ts;
      await hrPullFromCloud();
    }
  } catch(e) { console.log('[sync] init:', e.message||e); }
}, 1500);

// ── הגדרה ראשונית של המסד ──
// אין ליצור כאן משתמש עם סיסמת ברירת מחדל — הקוד רץ אצל כל מבקר, וטבלה שהתרוקנה לרגע הייתה נפתחת לסיסמה שבקוד הציבורי.
// המסלול מדווח מה חסר ומפנה ליצירה ידנית של המשתמש הראשון.
async function ensureFirstAdmin() {
  try {
    var {data, error} = await SB.from('hr_users').select('client_id').limit(1);
    var tableError = error && (
      error.code === '42P01' ||
      (error.message && error.message.indexOf('hr_users') !== -1)
    );
    // אזור השגיאה במסך הכניסה הוא דיווח בלבד — אין כאן מסך התקנה; טבלה חסרה מטופלת בהרצת migrations/000_schema.sql.
    var e = document.getElementById('auth-err');
    if (tableError) {
      if (e) {
        e.textContent = '';
        toast(MSG_TABLES_MISSING, null, 'bad');
      }
      return;
    }
    if (!error && (!data || data.length === 0)) {
      if (e) {
        e.textContent = 'טבלת המשתמשים ריקה — יש ליצור משתמש ראשון ידנית ב-Supabase';
        e.classList.add('users-empty');
      }
    }
  } catch(e) { console.error('[users] setup error:', e); }
}

ensureFirstAdmin();

;

;

;

;

;

;

;

;

;

;

;

;

;

;

S._atCfg = null;

S._atData = null;

S._atTreats = null;

S._atMarks = {};

// sid → {s, min}
S._atPending = {};

// sid → סומן לאחרונה, טרם ירד
S._atCleared = {};

// sid → נוקה ידנית, אין לסמן אוטומטית שוב
S._atCurrentSessionId = null;

S._atSaveTimer = null;

S._atView = 'reg';

S._atSupHY = null;

S._atSupMI = null;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

S._hrCfg = null;

S._hrData = null;

S._hrTreats = null;

S._hrMarks = {};

S._hrPending = {};

S._hrCleared = {};

S._hrCurrentSessionId = null;

S._hrSaveTimer = null;

S._hrView = 'reg';

S._hrSupHY = null;

S._hrSupMI = null;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

;

window.bootOk();

export { DOM_ACTIONS, HE, SB, _hcBuild, _hcFmt, _hcGet, _hcH, _hcYL, atvCls, modalOpen,
         renderUsersList, saveRefresh, showPage, showPageInternal, tyCls, uiShown };
