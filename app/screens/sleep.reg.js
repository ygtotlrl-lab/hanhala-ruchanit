// app/screens/sleep.reg.js — שינה — המודול ורישום הסימונים
import { dayNoon, readNum } from '../../core/util.js';
import { idEq, newClientId, pendMark, schedulePush, tombKill } from '../../core/sync.js';
import { sessUserId } from '../../core/auth.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { MSG_BUSY_CHECK, MSG_CLOSE_REPORT_FIRST, MSG_LATE_OVER_30, MSG_NEED_MINUTES,
         MSG_PICK_DATE_FIRST, MSG_REPORT_DONE, MSG_REPORT_OPEN_ELSEWHERE, MSG_SLEEP_OPEN,
         MSG_STATUS_REVERTED, PK_SL_SESS } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { _hrSlDiskSave, atvCls, getActiveAbsences, getStudents, hrDayWin, hrDefaultCfg,
         hrLocalOfAt, hrMarks, hrSortStudents, modalOpen, saveStudents, tyCls } from '../domain.js';
import { _hcBuild, _hcFmt, _hcH, hrSessHebFmt } from '../domain.hebdate.js';
import { _hrPullStaleMark, atAutoMark, atFindLiveSession, hrAdoptSession, hrCachedArr,
         hrGetLogicalDate, hrSaveData } from '../domain.sessions.js';
import { _hrPullCfg, _hrPullSessions, hrCachedCfg, hrRenderTodaySessions,
         hrSortedSessions } from './sleep.js';

function screenSleepHTML() {
  return `
<div class="pg" id="pg-sleep">
  <div class="inner">
    <div class="ptitle">
      <button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button>
      <span>🌙 זמן שינה</span>
    </div>
    <div class="at-tab-bar">
      <button id="sl-tab-reg" data-act="sl-tab" data-tab="reg" class="at-tab-btn-on">📝 רישום</button>
      <button id="sl-tab-arc" data-act="sl-tab" data-tab="arc" class="at-tab-btn">📁 ארכיון</button>
      <button id="sl-tab-sup" data-act="sl-tab" data-tab="sup" class="at-tab-btn">📋 השגחה</button>
    </div>
    <div id="sl-pullStale" class="at-pull-warn"></div>
    <div id="sl-view-reg" class="hidden">
      <div id="sl-reg-picker">
        <div class="card-pane">
          <div class="filter-row">
            <div class="field-wide">
              <label class="field-label">תאריך</label>
              <div id="sl-date-wrap"></div>
            </div>
            <div class="field-narrow">
              <label class="field-label" for="sl-filler">ממלא</label>
              <input aria-label="שם הממלא" id="sl-filler" class="input-full" placeholder="שם הממלא">
            </div>
          </div>
          <div class="picker-label">בחר דו"ח לפתיחה:</div>
          <div id="sl-sess-btns" class="chip-row"></div>
        </div>
        <div id="sl-today-sessions"></div>
      </div>
      <div id="sl-reg-list" class="hidden">
        <div class="at-reg-bar">
          <div id="sl-reg-header" class="at-reg-bar-info"></div>
          <button data-act="sl-session-close" class="at-close-btn">✅ שמור וסגור</button>
        </div>
        <div id="sl-students"></div>
      </div>
    </div>
    <div id="sl-view-arc" class="hidden">
      <div class="export-row">
        <button data-act="sl-export" data-fmt="excel" class="export-xls-btn">📊 Excel</button>
        <button data-act="sl-export" data-fmt="pdf" class="export-pdf-btn">📄 PDF</button>
      </div>
      <div id="sl-arc-list"></div>
    </div>
    <div id="sl-view-sup" class="hidden">
      <div id="sl-sup-content"></div>
    </div>
  </div>
</div>
`;
}

// ── מודול זמן השינה ──

// הציור הראשון סינכרוני מהמטמון — ציור שממתין לרשת משאיר שני חיוויים על המסך
function _hrPaintReg() {
  var dw=document.getElementById('sl-date-wrap');
  if(dw){
    var logIso=hrGetLogicalDate();
    var logDate=dayNoon(logIso);
    var todH=_hcH(logDate);
    dw.innerHTML=_hcBuild('sl_date',todH);
    var _HR_DOW_I=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    var lbEl=document.getElementById('sl_date_lbl');
    if(lbEl) lbEl.textContent='יום '+_HR_DOW_I[logDate.getDay()]+' '+_hcFmt(todH.hy,todH.mi,todH.day);
  }

  var adw=document.getElementById('sl-arc-date-wrap');
  if(adw) adw.innerHTML='<div class="status-head-row"><span class="filter-caption">סינון לפי תאריך:</span>'+_hcBuild('sl_arc_date')+'</div>';

  var fl=document.getElementById('sl-filler');
  if(fl && AUTH.user) fl.value=AUTH.user.full_name||'';

  hrFillSessionBtns();
  hrRenderTodaySessions();

  var pk=document.getElementById('sl-reg-picker');
  var rl=document.getElementById('sl-reg-list');
  if(pk) pk.classList.remove('hidden');
  if(rl) rl.classList.add('hidden');
}

async function loadSleep() {
  var el = document.getElementById('sl-pullStale');
  S._hrMarks={};
  S._hrCurrentSessionId=null;
  S._hrPendingRec=null;
  _hrPullStaleMark(el, false);
  // אין כותבים ברירת מחדל — ברירת מחדל שנכתבת נכנסת למיזוג
  hrCachedCfg();
  hrCachedArr('_hrData','hr_sleep_sessions');
  _hrPaintReg();
  hrShowTab(S._hrView||'reg');

  var _okSl=await Promise.all([_hrPullCfg(), _hrPullSessions(hrDayWin())]);
  _hrPaintReg();
  hrShowTab(S._hrView||'reg');
  _hrPullStaleMark(el, !(_okSl[0]&&_okSl[1]));

  var _logIsoR=hrGetLogicalDate();
  var _openRecSl=(S._hrData||[]).find(function(r){return r&&!r.deleted&&r.open&&r.session_date===_logIsoR;});
  try {
    if(_openRecSl && !modalOpen()) {
      openModal(MSG_SLEEP_OPEN,
        '<p class="md-note-center">'+esc(_openRecSl.session)+' נפתחה ולא נסגר.<br>להמשיך את הרישום?</p>',
        '<button data-act="modal-close" class="md-btn-ghost">אחר כך</button>'+
        '<button data-act="sl-resume-go" data-id="'+esc(_openRecSl.client_id)+'" class="md-btn-primary">▶ המשך</button>');
    }
  } catch(eRes){}
  // אין התראת כניסה במודול השינה
}

function hrFillSessionBtns() {
  var el=document.getElementById('sl-sess-btns');
  if(!el) return;
  var cfg=S._hrCfg||hrDefaultCfg();
  el.innerHTML='';
  hrSortedSessions(cfg).forEach(function(s){
    var btn=document.createElement('button');
    btn.textContent=s.name;
    btn.className='sess-pick-btn';
    btn.dataset.act='sl-open-session';btn.dataset.busy=MSG_BUSY_CHECK;btn.dataset.sid=s.id;btn.dataset.sname=s.name;
    el.appendChild(btn);
  });
}

function hrShowTab(tab) {
  S._hrView=tab;
  ['reg','arc','sup'].forEach(function(t){
    var v=document.getElementById('sl-view-'+t);
    var b=document.getElementById('sl-tab-'+t);
    if(v) v.classList.toggle('hidden',t!==tab);
    if(b) b.className=(t===tab)?'at-tab-btn-on':'at-tab-btn';
  });
  if(tab==='reg' && S._hrCurrentSessionId) hrRenderStudents();
  if(tab==='arc') shell.hrRenderArchive();
  if(tab==='sup') shell.hrRenderSupervision();
}

function hrAutoMark(student, sessDateIso, sessStartTime) {
  // תאריך עזר מזמן הסדר — הסטטוס נבדק לפי זמן הסדר ולא לפי שעון הקיר
  var sessRef = null;
  if (sessDateIso) { sessRef = new Date(sessDateIso + 'T' + (sessStartTime || '12:00') + ':00'); }
  var aa=getActiveAbsences(student, sessRef);
  if(!aa||!aa.length) return null;
  for(var i=0;i<aa.length;i++){
    var t=aa[i].type;
    if(t==='suspended'||t==='left') return 'ak';
    if(t==='approved'){
      if(!sessDateIso) return 'ap';
      var fromL=hrLocalOfAt(aa[i].from_at), toL=hrLocalOfAt(aa[i].to_at);
      var fromDate=fromL?fromL.split('T')[0]:'';
      var toDate=toL?toL.split('T')[0]:'';
      if(fromDate&&sessDateIso<fromDate) continue;
      if(toDate&&sessDateIso>toDate) continue;
      if(sessStartTime){
        if(fromDate&&sessDateIso===fromDate){
          var fromTime=fromL?fromL.split('T')[1]:'00:00';
          if(sessStartTime<fromTime) continue;
        }
        if(toDate&&sessDateIso===toDate){
          var toTime=toL?toL.split('T')[1]:'23:59';
          if(sessStartTime>toTime) continue;
        }
      }
      return 'ap';
    }
  }
  return null;
}

// ── שינה — רישום הסימונים ומסך הסדר ──

// הרשומה נקראת מהמטמון בלי המתנה — הכפתור שנלחץ צויר מאותו עותק, ולכן היא בו בוודאות
async function hrEditSession(recId) {
  var data=hrCachedArr('_hrData','hr_sleep_sessions')||[];
  var rec=data.find(function(r){return idEq(r.client_id,recId);});
  if(!rec) return;
  S._hrMarks={};S._hrPending={};S._hrCleared={};
  Object.entries(hrMarks(rec)).forEach(function(e){
    var sid=e[0],m=e[1];
    if(m.status){S._hrMarks[sid]={status:m.status,minutes:m.minutes||0,note:m.note||''};S._hrCleared[sid]=true;}
  });
  try {
    var _nowT2=new Date();
    var _hhmm2=('0'+_nowT2.getHours()).slice(-2)+':'+('0'+_nowT2.getMinutes()).slice(-2);
    // שעת הסדר מההגדרות קודמת; השעה הנוכחית היא נפילה-חזרה בלבד
    var _cfgS2=(S._hrCfg&&Array.isArray(S._hrCfg.sessions))?S._hrCfg.sessions:[];
    for(var _ci2=0;_ci2<_cfgS2.length;_ci2++){ if(_cfgS2[_ci2].name===rec.session&&_cfgS2[_ci2].start_time){_hhmm2=_cfgS2[_ci2].start_time;break;} }
    var _apChanged2=false;
    getStudents().forEach(function(st){
      if(st.active===false) return;
      var k=String(st.client_id);
      if(S._hrMarks[k]&&S._hrMarks[k].status) return;
      var am=atAutoMark(st, rec.session_date, _hhmm2);
      if(am){
        S._hrMarks[k]={status:am,minutes:0,note:''};
        S._hrCleared[k]=true;
        if(!rec.marks) rec.marks={};
        rec.marks[k]={status:am,minutes:0,note:''};
        _apChanged2=true;
      }
    });
    if(_apChanged2){
      rec.updated_at=Date.now();
      _hrSlDiskSave(data);
      S._hrData=data;
      hrSaveData(data);
    }
  } catch(eAp2){ console.warn('[approval-refresh] sl-edit', eAp2); }
  var dw=document.getElementById('sl-date-wrap');
  if(dw&&rec.session_date) dw.innerHTML=_hcBuild('sl_date',_hcH(dayNoon(rec.session_date)));
  var fl=document.getElementById('sl-filler');
  if(fl) fl.value=rec.filled_by_name||'';
  S._hrPendingRec=null;
  S._hrCurrentSessionId=recId;
  var hdr=document.getElementById('sl-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(rec.session)+'</span>'+
    '<span class="rec-date">'+hrSessHebFmt(rec)+'</span>';
  document.getElementById('sl-reg-picker').classList.add('hidden');
  document.getElementById('sl-reg-list').classList.remove('hidden');
  hrRenderStudents();
}

async function hrOpenSession(sessId, sessName) {
  if(S._hrCurrentSessionId){toast(MSG_CLOSE_REPORT_FIRST, null, 'bad');return;}
  var dateIso=(document.getElementById('sl_date_iso')||{}).value||hrGetLogicalDate();
  if(!dateIso){toast(MSG_PICK_DATE_FIRST, null, 'bad');return;}

  // ההמתנה למשיכה מכוונת, והחיווי מהניתוב.
  // משיכה אחת מסוננת ליום — בדיקת הכפילות צריכה יום זה בלבד, והמיזוג החלוני שומר את מה שמחוצה לו.
  await _hrPullSessions(hrDayWin(dateIso));
  var allData=S._hrData||[];
  var existing=atFindLiveSession(allData,sessName,dateIso);
  if(existing){
    openModal(MSG_REPORT_DONE,
      '<p class="md-note-center">'+esc(sessName)+' כבר מולא היום.<br>האם לפתוח לעריכה?</p>',
      '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>'+
      '<button data-act="sl-resume-go" data-id="'+esc(existing.client_id)+'" class="md-btn-primary">ערוך</button>');
    return;
  }

  var _oCfg=S._hrCfg||hrDefaultCfg();
  var _oSessObj=_oCfg.sessions.find(function(s){return s.name===sessName||idEq(s.id, sessId);});
  var _oSessTime=_oSessObj&&_oSessObj.start_time?_oSessObj.start_time:'';
  var students=hrSortStudents(getStudents());
  S._hrMarks={};S._hrPending={};S._hrCleared={};
  students.filter(function(s){return s.active!==false;}).forEach(function(s){
    var am=hrAutoMark(s,dateIso,_oSessTime);
    if(am) S._hrMarks[s.client_id]={status:am,minutes:0,note:''};
  });

  var filler=document.getElementById('sl-filler');
  var dateHeb=_hcH(dayNoon(dateIso));
  var initMarks={};
  students.filter(function(s){return s.active!==false;}).forEach(function(s){
    var m=S._hrMarks[s.client_id];
    initMarks[String(s.client_id)]={status:m?m.status:'',minutes:0,note:''};
  });
  var rec={
    client_id:newClientId(),
    session:sessName,
    session_date:dateIso,
    created_by_client_id:sessUserId(),
    filled_by_name:filler?filler.value:(AUTH.user?AUTH.user.full_name:''),
    marks:initMarks,
    created_at:new Date().toISOString(),
    updated_at:Date.now(),
    open:true
  };

  // הרשומה נשמרת רק בסימון הראשון בפועל (hrMarkDirty) — מונע רישומי רפאים.
  // אין קריאת טעינה שנייה — _hrData כבר הוצב מהמשיכה הטרייה.
  S._hrPendingRec=rec;
  S._hrCurrentSessionId=rec.client_id;

  _hrMountOpenSession(sessName, dateHeb);
}

// ההרכבה נפרדת מהבדיקה — הפתיחה חייבת להמתין למשיכה שמכריעה על כפילות,
// וההרכבה עצמה סינכרונית.
function _hrMountOpenSession(sessName, dateHeb) {
  var hdr=document.getElementById('sl-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(sessName)+'</span>'+
    '<span class="rec-date">'+_hcFmt(dateHeb.hy,dateHeb.mi,dateHeb.day)+'</span>';

  document.getElementById('sl-reg-picker').classList.add('hidden');
  document.getElementById('sl-reg-list').classList.remove('hidden');
  hrRenderStudents();
}

function hrSaveLocalNow() {
  if(!S._hrCurrentSessionId||!S._hrData) return null;
  var rec=S._hrData.find(function(r){return idEq(r.client_id,S._hrCurrentSessionId);});
  if(!rec) return null;
  var marks={};
  getStudents().forEach(function(s){
    if(s.active===false) return;
    var m=S._hrMarks[s.client_id];
    marks[s.client_id]=m?{status:m.status,minutes:m.status==='l'?(m.minutes||0):0,note:m.note||''}:{status:'',minutes:0,note:''};
  });
  rec.marks=marks;
  rec.updated_at=Date.now();
  // מסלול קריטי — כשל כאן עוצר את השרשרת, אחרת המשתמש ממשיך כאילו נשמר
  if(!_hrSlDiskSave(S._hrData)) return null;
  pendMark(PK_SL_SESS + rec.client_id);
  return rec;
}

async function hrAutoSaveNow() {
  if(hrSaveLocalNow()===null) return;
  await hrSaveData(S._hrData);
}

function hrMarkDirty() {
  // סימון ראשון בפועל — רק כאן נוצרת רשומת הסדר, כדי שלא יישארו רישומי רפאים
  if(S._hrPendingRec && idEq(S._hrCurrentSessionId,S._hrPendingRec.client_id)){
    if(!S._hrData) S._hrData=[];
    // הבדיקה חוזרת בנקודת היצירה בפועל — הבדיקה המחזורית יכולה להביא סדר מתחרה מאז הפתיחה
    var _hrDup=atFindLiveSession(S._hrData,S._hrPendingRec.session,
                                 S._hrPendingRec.session_date,S._hrPendingRec.client_id);
    if(_hrDup){
      hrAdoptSession(_hrDup);
      toast(MSG_REPORT_OPEN_ELSEWHERE, null, 'bad');
    } else if(!S._hrData.some(function(r){return r&&idEq(r.client_id,S._hrPendingRec.client_id);})) {
      S._hrData.push(S._hrPendingRec);
    }
    S._hrPendingRec=null;
  }
  hrSaveLocalNow();
  clearTimeout(S._hrSaveTimer);
  S._hrSaveTimer=setTimeout(hrAutoSaveNow,3000);
}

function hrShowOverrideDialog(sid, student) {
  var aa=getActiveAbsences(student);
  var a=aa&&aa[0];
  if(!a) return;
  var TL={approved:'אישור',suspended:'השעיה',left:'לא שב'};
  var TI={approved:'✅',suspended:'⚠️',left:'🚪'};
  var _dow=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  var fmtDt=function(v){
    if(!v)return '—';
    var d=new Date(v),hd=_hcH(d);
    var hh=d.getHours(),mm=d.getMinutes();
    return 'יום '+_dow[d.getDay()]+' '+_hcFmt(hd.hy,hd.mi,hd.day)+' '+(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
  };
  var typeLbl=TL[a.type]||a.type;
  var typeIcon=TI[a.type]||'📋';
  var reasonHtml=a.reason?'<div class="abs-reason-blk">סיבה: '+esc(a.reason)+'</div>':'';
  var datesHtml='<div class="abs-dates-blk">מ: '+fmtDt(a.from_at)+'<br>עד: '+(a.to_at?fmtDt(a.to_at):'ללא תאריך סיום')+'</div>';
  openModal(typeIcon+' '+typeLbl+' — '+student.name,
    '<div class="abs-tone '+tyCls(a.type)+' abs-type-head">'+esc(typeLbl)+'</div>'+
    reasonHtml+datesHtml+
    '<div class="md-question">האם לבטל את הסטטוס לגמרי?<br><span class="md-question-warn">אם כן הוא יימחק והתלמיד ייחשב בישיבה כרגיל</span></div>',
    '<button data-act="modal-close" class="md-btn-close">סגור</button>'+
    '<button data-act="sl-status-cancel" data-id="'+esc(sid)+'" class="md-btn-danger">בטל סטטוס</button>');
}

// הקורא הוא sl-status-cancel — בלי הפונקציה הכפתור זורק, וחלון הדו-שיח נסגר כאילו הצליח
function hrCancelStudentStatusFromReg(sid) {
  var students=getStudents();
  var s=students.find(function(x){return idEq(x.client_id, sid);});
  if(!s) return;
  // tombstone לכל היעדרות ולא ריקון — ריקון מוחזר מהענן במיזוג
  if(Array.isArray(s.absences)) s.absences.forEach(function(a){ if(!a.deleted) { tombKill(a); a.deleted_by_client_id=sessUserId(); } });
  s.present=true;
  s.updated_at=Date.now();
  saveStudents(students);
  schedulePush();
  delete S._hrMarks[sid];
  delete S._hrCleared[sid];
  delete S._hrPending[sid];
  hrMarkDirty();
  hrRenderStudents();
  shell.renderStudents();
  toast(MSG_STATUS_REVERTED+s.name, null, 'good');
}

function hrApplyMark(sid, code) {
  var s=String(sid);
  var existNote=(S._hrMarks[s]||{}).note||'';
  S._hrMarks[s]={status:code,minutes:code==='l'?null:0,note:existNote};
  S._hrCleared[s]=true;
  S._hrPending[s]=true;
  hrRenderStudents();
  if(code!=='l'){
    setTimeout(function(){
      delete S._hrPending[s];
      hrRenderStudents();
    },600);
  }
  hrMarkDirty();
}

function hrConfirmLate(sid) {
  var s=String(sid);
  var inp=document.getElementById('sl-min-'+sid);
  var val=readNum(inp, 0);
  if(!val||val<=0){toast(MSG_NEED_MINUTES, null, 'bad');return;}
  if(val>30){toast(MSG_LATE_OVER_30, null, 'bad');return;}
  hrSetLateMin(sid,val);
  delete S._hrPending[s];
  hrRenderStudents();
  hrMarkDirty();
}

// ── שינה — רשימת התלמידים וכפתורי הסימון ──
function hrRenderStudents() {
  var el=document.getElementById('sl-students');
  if(!el) return;
  var students=hrSortStudents(getStudents());
  if(!students||!students.length){el.innerHTML='<div class="empty-note">אין תלמידים</div>';return;}

  var active=students.filter(function(s){return s.active!==false;});
  var unmarked=[], marked=[];
  active.forEach(function(s){
    var cur=S._hrMarks[s.client_id];
    var isPending=!!S._hrPending[s.client_id];
    if(cur&&cur.status&&!isPending) marked.push(s);
    else unmarked.push(s);
  });

  var bs='mark-btn';
  function mkBtn(sid,code,label){
    var cur=(S._hrMarks[sid]||{}).status;
    var isOn=(cur===code);
    var cls=bs+' '+atvCls(code)+(isOn?' mark-on':' mark-off');
    return '<button data-act="sl-set-mark" data-id="'+esc(sid)+'" data-code="'+esc(code)+'" class="'+cls+'">'+label+'</button>';
  }
  function mkClearBtn(sid){
    return '<button data-act="sl-clear-mark" data-id="'+esc(sid)+'" title="נקה סימון" '+
      'class="at-clear-btn clr-btn">✕</button>';
  }

  function renderRow(s, isMark) {
    var marks=S._hrMarks[s.client_id]||{};
    var isLate=marks.status==='l';
    var hasMark=!!(marks.status);
    var cls=s.cls==='a'?'א':s.cls==='b'?'ב':s.cls==='g'?'ג':s.cls||'';
    var autoHintHtml='';
    var am=hrAutoMark(s);
    if(am&&isMark&&!S._hrCleared[s.client_id]){
      var aLbl=am==='ap'?'באישור':am==='ak'?'נעדר ידוע':'';
      if(aLbl) autoHintHtml='<span class="mark-hint">('+aLbl+')</span>';
    }
    var isPendingLate=isLate&&!!S._hrPending[String(s.client_id)];
    var lateFieldHtml=isLate?
      '<div class="late-field"'+(isPendingLate?' data-ks':'')+'>'+
        '<input aria-label="דק׳" type="text" inputmode="numeric" maxlength="2" value="'+(marks.minutes!=null?marks.minutes:'')+'" id="sl-min-'+s.client_id+'" placeholder="דק׳" '+
        'data-inp="sl-late" data-id="'+esc(s.client_id)+'" '+
        ' class="late-input">'+
        '<span class="unit-hint">דק׳</span>'+
        (isPendingLate?'<button data-act="sl-confirm-late" data-ksave data-id="'+esc(s.client_id)+'" class="late-ok-btn">✓ אשר</button>':'')+
      '</div>':'';
    var noteVal=esc(marks.note||'');
    var noteField='<input aria-label="הערה" type="text" placeholder="הערה" value="'+noteVal+'" '+
      'id="sl-note-'+s.client_id+'" '+
      'data-inp="sl-note" data-id="'+esc(s.client_id)+'" '+
      ' class="late-min-inp">';
    var rowBg=isMark?'mark-row-on':'mark-row';
    return '<div class="'+rowBg+' mark-line">'+
      '<div class="at-row-class">'+esc(cls)+'</div>'+
      '<div class="at-row-name">'+esc(s.name)+autoHintHtml+'</div>'+
      lateFieldHtml+
      noteField+
      '<div class="at-row-marks">'+
        (hasMark?mkClearBtn(s.client_id):'')+
        mkBtn(s.client_id,'p','✓')+
        mkBtn(s.client_id,'l','איחור')+
        mkBtn(s.client_id,'e','-')+
        mkBtn(s.client_id,'x','x')+
        mkBtn(s.client_id,'ap','א')+
        mkBtn(s.client_id,'ak','ב')+
        mkBtn(s.client_id,'a','ג')+
      '</div>'+
    '</div>';
  }

  var html='';
  if(unmarked.length) html+=unmarked.map(function(s){return renderRow(s,false);}).join('');
  if(marked.length){
    html+='<div class="at-group-sep">'+
      '<span class="rule-line"></span>סומנו<span class="rule-line"></span></div>';
    html+=marked.map(function(s){return renderRow(s,true);}).join('');
  }
  el.innerHTML=html||'<div class="empty-note">אין תלמידים פעילים</div>';
}

function hrSetMark(sid, code) {
  var student=getStudents().find(function(s){return String(s.client_id)===String(sid);});
  var curRec=S._hrData&&S._hrCurrentSessionId?
    S._hrData.find(function(r){return idEq(r.client_id,S._hrCurrentSessionId);}):null;
  var sessDateIso=curRec?curRec.session_date:null;
  var _cfg=S._hrCfg||hrDefaultCfg();
  var sessObj=curRec?(_cfg.sessions||[]).find(function(s){return s.name===curRec.session;}):null;
  var sessTime=sessObj&&sessObj.start_time?sessObj.start_time:'';
  var autoM=student?hrAutoMark(student,sessDateIso,sessTime):null;
  var cur=S._hrMarks[sid];
  if(autoM&&cur&&cur.status===autoM&&!S._hrCleared[sid]){
    hrShowOverrideDialog(sid,student);
    return;
  }
  hrApplyMark(sid,code);
}

function hrClearMark(sid) {
  var existNote=(S._hrMarks[sid]||{}).note||'';
  delete S._hrMarks[sid];
  if(existNote) S._hrMarks[sid]={status:'',minutes:0,note:existNote};
  delete S._hrPending[sid];
  S._hrCleared[sid]=true;
  hrRenderStudents();
  hrMarkDirty();
}

function hrSetLateMin(sid, val) {
  var n=parseInt(val)||0;
  if(n<0)n=0;if(n>30)n=30;
  if(!S._hrMarks[sid])S._hrMarks[sid]={status:'l',minutes:n,note:''};
  else S._hrMarks[sid].minutes=n;
  hrMarkDirty();
}

function hrSetNote(sid, val) {
  var s=String(sid);
  if(!S._hrMarks[s]) S._hrMarks[s]={status:'',minutes:0,note:''};
  S._hrMarks[s].note=val;
  hrMarkDirty();
}

async function hrCloseSession() {
  clearTimeout(S._hrSaveTimer);
  // שמירה וסגירה רק מסמנות את הסדר כסגור (open=false)
  var _cRec=S._hrData&&S._hrData.find(function(r){return idEq(r.client_id,S._hrCurrentSessionId);});
  if(_cRec){_cRec.open=false;}
  await hrAutoSaveNow();
  var rec=S._hrData&&S._hrData.find(function(r){return idEq(r.client_id,S._hrCurrentSessionId);});
  var msg=rec?('✅ '+rec.session+' — '+hrSessHebFmt(rec)+' נשמר'):'✅ הבדיקה נשמרה';
  S._hrCurrentSessionId=null;
  S._hrMarks={};
  S._hrPendingRec=null;
  document.getElementById('sl-reg-list').classList.add('hidden');
  document.getElementById('sl-reg-picker').classList.remove('hidden');
  hrRenderTodaySessions();
  toast(msg, null, 'good');
}

export { hrCancelStudentStatusFromReg, hrClearMark, hrCloseSession, hrConfirmLate,
         hrEditSession, hrFillSessionBtns, hrOpenSession, hrRenderStudents, hrSetLateMin,
         hrSetMark, hrSetNote, hrShowTab, loadSleep, screenSleepHTML };
