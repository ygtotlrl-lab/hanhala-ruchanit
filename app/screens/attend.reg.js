// app/screens/attend.reg.js — סדרים — מודול הנוכחות ורישום הסימונים
import { dayNoon, dayToday, readNum } from '../../core/util.js';
import { idEq, newClientId, pendMark, schedulePush, tombKill } from '../../core/sync.js';
import { sessUserId } from '../../core/auth.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { MSG_BUSY_CHECK, MSG_CLOSE_SESSION_FIRST, MSG_LATE_OVER_30, MSG_NEED_MINUTES,
         MSG_PICK_DATE_FIRST, MSG_SESSION_DONE, MSG_SESSION_OPEN_ELSEWHERE,
         MSG_SESSION_OPEN_TODAY, MSG_STATUS_REVERTED, PK_AT_SESS } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { _hrAtDiskSave, atvCls, getActiveAbsences, getStudents, hrDayWin, hrMarks,
         hrSortStudents, modalOpen, saveStudents, tyCls } from '../domain.js';
import { _hcBuild, _hcFmt, _hcH, hrSessHebFmt } from '../domain.hebdate.js';
import { _hrPullStaleMark, atAutoMark, atFindLiveSession, atSaveData,
         hrCachedArr } from '../domain.sessions.js';
import { _atPullCfg, _atPullSessions, atCachedCfg, atCheckAlert, atDefaultCfg,
         atRenderTodaySessions, atSortedSessions } from './attend.js';

function screenAttendHTML() {
  return `
<div class="pg" id="pg-attend">
  <div class="inner">
    <div class="ptitle">
      <button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button>
      <span>✅ שמירת הסדרים</span>
    </div>
    <!-- לשוניות -->
    <div class="at-tab-bar">
      <button id="at-tab-reg" data-act="at-tab" data-tab="reg" class="at-tab-btn-on">📝 רישום</button>
      <button id="at-tab-arc" data-act="at-tab" data-tab="arc" class="at-tab-btn">📁 ארכיון</button>
      <button id="at-tab-sup" data-act="at-tab" data-tab="sup" class="at-tab-btn">📋 השגחה</button>
    </div>
    <!-- סימון «המוצג ישן» — ריק כשהרענון הצליח -->
    <div id="at-pullStale" class="at-pull-warn"></div>
    <!-- תצוגת רישום -->
    <div id="at-view-reg" class="hidden">
      <!-- שלב א׳: בחירת תאריך + ממלא + סדר -->
      <div id="at-reg-picker">
        <div class="card-pane">
          <div class="filter-row">
            <div class="field-wide">
              <label class="field-label">תאריך</label>
              <div id="at-date-wrap"></div>
            </div>
            <div class="field-narrow">
              <label class="field-label" for="at-filler">ממלא</label>
              <input aria-label="שם הממלא" id="at-filler" class="input-full" placeholder="שם הממלא">
            </div>
          </div>
          <div class="picker-label">בחר סדר לפתיחה:</div>
          <div id="at-sess-btns" class="chip-row"></div>
        </div>
        <!-- סדרים שמולאו היום -->
        <div id="at-today-sessions"></div>
      </div>
      <!-- שלב ב׳: רשימת תלמידים -->
      <div id="at-reg-list" class="hidden">
        <div class="at-reg-bar">
          <div id="at-reg-header" class="at-reg-bar-info"></div>
          <button data-act="at-session-close" class="at-close-btn">✅ שמור וסגור</button>
        </div>
        <div id="at-students"></div>
      </div>
    </div>
    <!-- תצוגת ארכיון -->
    <div id="at-view-arc" class="hidden">
      <div class="export-row">
        <button data-act="at-export" data-fmt="excel" class="export-xls-btn">📊 Excel</button>
        <button data-act="at-export" data-fmt="pdf" class="export-pdf-btn">📄 PDF</button>
      </div>
      <div id="at-arc-list"></div>
    </div>
    <!-- תצוגת השגחה -->
    <div id="at-view-sup" class="hidden">
      <div id="at-sup-content"></div>
    </div>
  </div>
</div>
`;
}

// ── נוכחות — ציור המסך והסדרים ──
// נקרא פעמיים, מהמטמון ואחרי הרענון, ולכן אין בו await.
function _atPaintReg() {
  var dw=document.getElementById('at-date-wrap');
  if(dw){
    var todH=_hcH(new Date()); dw.innerHTML=_hcBuild('at_date',todH);
    var _AT_DOW_I=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    var lbEl=document.getElementById('at_date_lbl');
    if(lbEl) lbEl.textContent='יום '+_AT_DOW_I[new Date().getDay()]+' '+_hcFmt(todH.hy,todH.mi,todH.day);
  }

  var adw=document.getElementById('at-arc-date-wrap');
  if(adw) adw.innerHTML='<div class="status-head-row"><span class="filter-caption">סינון לפי תאריך:</span>'+_hcBuild('at_arc_date')+'</div>';

  var fl=document.getElementById('at-filler');
  if(fl && AUTH.user) fl.value=AUTH.user.full_name||'';

  atFillSessionBtns();
  atRenderTodaySessions();

  var pk=document.getElementById('at-reg-picker');
  var rl=document.getElementById('at-reg-list');
  if(pk) pk.classList.remove('hidden');
  if(rl) rl.classList.add('hidden');
}

async function loadAttend() {
  var el = document.getElementById('at-pullStale');
  S._atMarks={};
  S._atCurrentSessionId=null;
  S._atPendingRec=null;
  // מציג מיד ומרענן ברקע — משיכה לפני הציור משאירה את חיווי הטעינה, ולשונית שנפתחת מוסיפה חיווי שני
  _hrPullStaleMark(el, false);
  // העותק נקרא ואינו נכתב כברירת מחדל — atDefaultCfg היה מסמן «נטען», והמשיכה לא הייתה מחליפה אותו
  atCachedCfg();
  hrCachedArr('_atData','hr_sessions');
  _atPaintReg();
  atShowTab(S._atView||'reg');

  var _okAt=await Promise.all([_atPullCfg(), _atPullSessions(hrDayWin())]);
  _atPaintReg();
  atShowTab(S._atView||'reg');
  _hrPullStaleMark(el, !(_okAt[0]&&_okAt[1]));

  var _todayIsoR=dayToday();
  var _openRec=(S._atData||[]).find(function(r){return r&&!r.deleted&&r.open&&r.session_date===_todayIsoR;});
  try {
    // ההצעה אינה דורסת חלון דו-שיח פתוח — מיכל אחד, ומי שבדיאלוג אחר לא ימצא אותו מוחלף
    if(_openRec && !modalOpen()) {
      openModal(MSG_SESSION_OPEN_TODAY,
        '<p class="md-note-center">'+esc(_openRec.session)+' נפתח היום ולא נסגר.<br>להמשיך את הרישום?</p>',
        '<button data-act="modal-close" class="md-btn-ghost">אחר כך</button>'+
        '<button data-act="at-resume-go" data-id="'+esc(_openRec.client_id)+'" class="md-btn-primary">▶ המשך</button>');
    }
  } catch(eRes){}
  atCheckAlert();
}

function atFillSessionBtns() {
  var el=document.getElementById('at-sess-btns');
  if(!el) return;
  var cfg=S._atCfg||atDefaultCfg();
  el.innerHTML='';
  atSortedSessions(cfg).forEach(function(s){
    var btn=document.createElement('button');
    btn.textContent=s.name;
    btn.className='sess-pick-btn';
    btn.dataset.act='at-open-session';btn.dataset.busy=MSG_BUSY_CHECK;btn.dataset.sid=s.id;btn.dataset.sname=s.name;
    el.appendChild(btn);
  });
}

function atShowTab(tab) {
  S._atView=tab;
  ['reg','arc','sup'].forEach(function(t){
    var v=document.getElementById('at-view-'+t);
    var b=document.getElementById('at-tab-'+t);
    if(v) v.classList.toggle('hidden',t!==tab);
    if(b) b.className=(t===tab)?'at-tab-btn-on':'at-tab-btn';
  });
  if(tab==='reg' && S._atCurrentSessionId) atRenderStudents();
  if(tab==='arc') shell.atRenderArchive();
  if(tab==='sup') shell.atRenderSupervision();
}

// ── נוכחות — רישום הסימונים ומסך הסדר ──

// הרשומה נקראת מהמטמון בלי המתנה — הכפתור שנלחץ צויר מאותו עותק, ולכן היא בו בוודאות
async function atEditSession(recId) {
  var data=hrCachedArr('_atData','hr_sessions')||[];
  var rec=data.find(function(r){return idEq(r.client_id,recId);});
  if(!rec) return;
  S._atMarks={};S._atPending={};S._atCleared={};
  Object.entries(hrMarks(rec)).forEach(function(e){
    var sid=e[0],m=e[1];
    if(m.status){S._atMarks[sid]={status:m.status,minutes:m.minutes||0};S._atCleared[sid]=true;}
  });
  // רענון אישורים לתלמידים בלי סימון — אישור שהוזן אחרי פתיחת הסדר
  try {
    var _nowT=new Date();
    var _hhmm=('0'+_nowT.getHours()).slice(-2)+':'+('0'+_nowT.getMinutes()).slice(-2);
    // שעת הסדר מההגדרות קודמת; השעה הנוכחית היא נפילה-חזרה בלבד
    var _cfgS=(S._atCfg&&Array.isArray(S._atCfg.sessions))?S._atCfg.sessions:[];
    for(var _ci=0;_ci<_cfgS.length;_ci++){ if(_cfgS[_ci].name===rec.session&&_cfgS[_ci].start_time){_hhmm=_cfgS[_ci].start_time;break;} }
    var _apChanged=false;
    getStudents().forEach(function(st){
      if(st.active===false) return;
      var k=String(st.client_id);
      if(S._atMarks[k]&&S._atMarks[k].status) return;
      var am=atAutoMark(st, rec.session_date, _hhmm);
      if(am){
        S._atMarks[k]={status:am,minutes:0};
        S._atCleared[k]=true;
        if(!rec.marks) rec.marks={};
        rec.marks[k]={status:am,minutes:0};
        _apChanged=true;
      }
    });
    if(_apChanged){
      rec.updated_at=Date.now();
      _hrAtDiskSave(data);
      S._atData=data;
      atSaveData(data); // בלי await בכוונה — הדחיפה רצה ברקע
    }
  } catch(eAp){ console.warn('[approval-refresh] edit', eAp); }
  var dw=document.getElementById('at-date-wrap');
  if(dw&&rec.session_date) dw.innerHTML=_hcBuild('at_date',_hcH(dayNoon(rec.session_date)));
  var fl=document.getElementById('at-filler');
  if(fl) fl.value=rec.filled_by_name||'';
  S._atPendingRec=null;
  S._atCurrentSessionId=recId;
  var hdr=document.getElementById('at-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(rec.session)+'</span>'+
    '<span class="rec-date">'+hrSessHebFmt(rec)+'</span>';
  document.getElementById('at-reg-picker').classList.add('hidden');
  document.getElementById('at-reg-list').classList.remove('hidden');
  atRenderStudents();
}

// ── מניעת כפילות סדרים ──

// אימוץ סדר קיים: הסימונים הקיימים נטענים תחילה, וסימון מקומי גובר עליהם —
// atSaveLocalNow בונה את marks מחדש מ-_atMarks, ואימוץ בלי טעינה היה מוחק את סימוני המכשיר האחר.
function atAdoptSession(rec) {
  var ex = hrMarks(rec);
  Object.keys(ex).forEach(function (k) {
    var cur = S._atMarks[k];
    if (!cur || !cur.status) S._atMarks[k] = { status: (ex[k] && ex[k].status) || '', minutes: (ex[k] && ex[k].minutes) || 0 };
  });
  S._atCurrentSessionId = rec.client_id;
}

async function atOpenSession(sessId, sessName) {
  if(S._atCurrentSessionId){toast(MSG_CLOSE_SESSION_FIRST, null, 'bad');return;}
  var dateIso=(document.getElementById('at_date_iso')||{}).value;
  if(!dateIso){toast(MSG_PICK_DATE_FIRST, null, 'bad');return;}

  // ההמתנה למשיכה מכוונת — היא מכריעה אם נוצרת רשומה שנייה לאותו סדר; החיווי והניטרול בניתוב.
  // משיכה אחת מסוננת ליום שנבחר — בדיקת הכפילות צריכה יום אחד בלבד.
  // כשל משיכה נופל למצב המקומי; המיזוג החלוני שומר את מה שמחוץ לחלון.
  await _atPullSessions(hrDayWin(dateIso));
  var allData=S._atData||[];
  var existing=atFindLiveSession(allData,sessName,dateIso);
  if(existing){
    openModal(MSG_SESSION_DONE,
      '<p class="md-note-center">'+esc(sessName)+' כבר מולא היום.<br>האם לפתוח לעריכה?</p>',
      '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>'+
      '<button data-act="at-resume-go" data-id="'+esc(existing.client_id)+'" class="md-btn-primary">ערוך</button>');
    return;
  }

  var _oCfg=S._atCfg||atDefaultCfg();
  var _oSessObj=_oCfg.sessions.find(function(s){return s.name===sessName||idEq(s.id, sessId);});
  var _oSessTime=_oSessObj&&_oSessObj.start_time?_oSessObj.start_time:'';
  var students=hrSortStudents(getStudents());
  S._atMarks={};
  S._atPending={};
  S._atCleared={};
  students.filter(function(s){return s.active!==false;}).forEach(function(s){
    var am=atAutoMark(s,dateIso,_oSessTime);
    if(am) S._atMarks[s.client_id]={status:am,minutes:0};
  });

  var filler=document.getElementById('at-filler');
  var dateHeb=_hcH(dayNoon(dateIso));
  // הסימונים האוטומטיים נכתבים ל-rec.marks — אחרת הם אובדים ביציאה בלי שמירה
  var initMarks={};
  students.filter(function(s){return s.active!==false;}).forEach(function(s){
    var m=S._atMarks[s.client_id];
    initMarks[String(s.client_id)]={status:m?m.status:'',minutes:0};
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

  // הרשומה נשמרת רק בסימון הראשון בפועל (atMarkDirty) — מונע רישומי רפאים.
  // אין קריאת טעינה שנייה — _atData כבר הוצב מהמשיכה, וקריאה חוזרת מחזירה אותו מערך.
  S._atPendingRec=rec;
  S._atCurrentSessionId=rec.client_id;

  _atMountOpenSession(sessName, dateHeb);
}

// ההרכבה נפרדת מהבדיקה — הפתיחה חייבת להמתין למשיכה שמכריעה על כפילות,
// וההרכבה עצמה סינכרונית.
function _atMountOpenSession(sessName, dateHeb) {
  var hdr=document.getElementById('at-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(sessName)+'</span>'+
    '<span class="rec-date">'+_hcFmt(dateHeb.hy,dateHeb.mi,dateHeb.day)+'</span>';

  document.getElementById('at-reg-picker').classList.add('hidden');
  document.getElementById('at-reg-list').classList.remove('hidden');
  atRenderStudents();
}

function atSaveLocalNow() {
  if(!S._atCurrentSessionId||!S._atData) return null;
  var rec=S._atData.find(function(r){return idEq(r.client_id,S._atCurrentSessionId);});
  if(!rec) return null;
  var marks={};
  getStudents().forEach(function(s){
    if(s.active===false) return;
    var m=S._atMarks[s.client_id];
    marks[s.client_id]=m?{status:m.status,minutes:m.status==='l'?(m.minutes||0):0}:{status:'',minutes:0};
  });
  rec.marks=marks;
  rec.updated_at=Date.now();
  // מסלול קריטי — כשל כאן עוצר את השרשרת, אחרת המשתמש ממשיך כאילו נשמר
  if(!_hrAtDiskSave(S._atData)) return null;
  pendMark(PK_AT_SESS + rec.client_id);
  return rec;
}

async function atAutoSaveNow() {
  if(atSaveLocalNow()===null) return;
  await atSaveData(S._atData);
}

function atMarkDirty() {
  // סימון ראשון בפועל — רק כאן נוצרת רשומת הסדר, כדי שלא יישארו רישומי רפאים
  if(S._atPendingRec && idEq(S._atCurrentSessionId,S._atPendingRec.client_id)){
    if(!S._atData) S._atData=[];
    // הבדיקה חוזרת כאן — זו נקודת היצירה, והבדיקה המחזורית יכלה להביא סדר מתחרה מאז הפתיחה
    var _atDup=atFindLiveSession(S._atData,S._atPendingRec.session,
                                 S._atPendingRec.session_date,S._atPendingRec.client_id);
    if(_atDup){
      atAdoptSession(_atDup);
      toast(MSG_SESSION_OPEN_ELSEWHERE, null, 'bad');
    } else if(!S._atData.some(function(r){return r&&idEq(r.client_id,S._atPendingRec.client_id);})) {
      S._atData.push(S._atPendingRec);
    }
    S._atPendingRec=null;
  }
  atSaveLocalNow();
  clearTimeout(S._atSaveTimer);
  S._atSaveTimer=setTimeout(atAutoSaveNow,3000);
}

function atShowOverrideDialog(sid, student) {
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
  var reasonHTML=a.reason?'<div class="abs-reason-blk">סיבה: '+esc(a.reason)+'</div>':'';
  var datesHTML='<div class="abs-dates-blk">מ: '+fmtDt(a.from_at)+'<br>עד: '+(a.to_at?fmtDt(a.to_at):'ללא תאריך סיום')+'</div>';
  openModal(typeIcon+' '+typeLbl+' — '+student.name,
    '<div class="abs-tone '+tyCls(a.type)+' abs-type-head">'+esc(typeLbl)+'</div>'+
    reasonHTML+
    datesHTML+
    '<div class="md-question">האם לבטל את הסטטוס לגמרי?<br><span class="md-question-warn">אם כן הוא יימחק והתלמיד ייחשב בישיבה כרגיל</span></div>',
    '<button data-act="modal-close" class="md-btn-close">סגור</button>'+
    '<button data-act="at-status-cancel" data-id="'+esc(sid)+'" class="md-btn-danger">בטל סטטוס</button>');
}

function atCancelStudentStatusFromReg(sid) {
  var students=getStudents();
  var s=students.find(function(x){return String(x.client_id)===String(sid);});
  if(!s) return;
  // tombstone לכל היעדרות ולא ריקון — ריקון מוחזר מהענן במיזוג
  if(Array.isArray(s.absences)) s.absences.forEach(function(a){ if(!a.deleted) { tombKill(a); a.deleted_by_client_id=sessUserId(); } });
  s.present=true;
  s.updated_at=Date.now();
  saveStudents(students);
  schedulePush();
  delete S._atMarks[sid];
  delete S._atCleared[sid];
  delete S._atPending[sid];
  atMarkDirty();
  atRenderStudents();
  shell.renderStudents();
  toast(MSG_STATUS_REVERTED+s.name, null, 'good');
}

function atApplyMark(sid, code) {
  var s=String(sid);
  // איחור: min=null — השדה ריק עד שהמשתמש מזין ערך
  S._atMarks[s]={status:code,minutes:code==='l'?null:0};
  S._atCleared[s]=true; // מונע חזרת הסימון האוטומטי
  S._atPending[s]=true; // נשאר בראש הרשימה בינתיים
  atRenderStudents();
  if(code!=='l'){
    setTimeout(function(){
      delete S._atPending[s];
      atRenderStudents();
    },600);
  }
  // איחור נשאר בראש הרשימה עד אישור הדקות ב-atConfirmLate
  atMarkDirty();
}

function atConfirmLate(sid) {
  var s=String(sid);
  var inp=document.getElementById('at-min-'+sid);
  var val=readNum(inp, 0);
  if(!val||val<=0){toast(MSG_NEED_MINUTES, null, 'bad');return;}
  if(val>30){toast(MSG_LATE_OVER_30, null, 'bad');return;}
  atSetLateMin(sid,val);
  delete S._atPending[s];
  atRenderStudents();
  atMarkDirty();
}

// ── נוכחות — רשימת התלמידים וכפתורי הסימון ──
function atRenderStudents() {
  var el=document.getElementById('at-students');
  if(!el) return;
  var students=hrSortStudents(getStudents());
  if(!students||!students.length){el.innerHTML='<div class="empty-note">אין תלמידים</div>';return;}

  var active=students.filter(function(s){return s.active!==false;});

  var unmarked=[], marked=[];
  active.forEach(function(s){
    var cur=S._atMarks[s.client_id];
    var isPending=!!S._atPending[s.client_id];
    if(cur&&cur.status&&!isPending) marked.push(s);
    else unmarked.push(s);
  });

  var bs='mark-btn';
  function mkBtn(sid,code,label){
    var cur=(S._atMarks[sid]||{}).status;
    var isOn=(cur===code);
    var cls=bs+' '+atvCls(code)+(isOn?' mark-on':' mark-off');
    return '<button data-act="at-set-mark" data-id="'+esc(sid)+'" data-code="'+esc(code)+'" class="'+cls+'">'+label+'</button>';
  }
  function mkClearBtn(sid){
    return '<button data-act="at-clear-mark" data-id="'+esc(sid)+'" title="נקה סימון" '+
      'class="at-clear-btn clr-btn">✕</button>';
  }

  function renderRow(s, isMark) {
    var marks=S._atMarks[s.client_id]||{};
    var isLate=marks.status==='l';
    var hasMark=!!(marks.status);
    var cls=s.cls==='a'?'א':s.cls==='b'?'ב':s.cls==='g'?'ג':s.cls||'';
    var autoHintHTML='';
    var am=atAutoMark(s);
    if(am&&isMark&&!S._atCleared[s.client_id]){
      var aLbl=am==='ap'?'באישור':am==='ak'?'נעדר ידוע':'';
      if(aLbl) autoHintHTML='<span class="mark-hint">('+aLbl+')</span>';
    }
    var isPendingLate=isLate&&!!S._atPending[String(s.client_id)];
    var lateFieldHTML=isLate?
      '<div class="late-field"'+(isPendingLate?' data-ks':'')+'>'+
        '<input aria-label="דק׳" type="text" inputmode="numeric" maxlength="2" value="'+(marks.minutes!=null?marks.minutes:'')+'" id="at-min-'+s.client_id+'" placeholder="דק׳" '+
        'data-inp="at-late" data-id="'+esc(s.client_id)+'" '+
        ' class="late-input">'+
        '<span class="unit-hint">דק׳</span>'+
        (isPendingLate?'<button data-act="at-confirm-late" data-ksave data-id="'+esc(s.client_id)+'" class="late-ok-btn">✓ אשר</button>':'')+
      '</div>':'';
    var rowBg=isMark?'mark-row-on':'mark-row';
    return '<div class="'+rowBg+' mark-line">'+
      '<div class="at-row-class">'+esc(cls)+'</div>'+
      '<div class="at-row-name">'+esc(s.name)+autoHintHTML+'</div>'+
      lateFieldHTML+
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

function atSetMark(sid, code) {
  var student=getStudents().find(function(s){return String(s.client_id)===String(sid);});
  // אותו חישוב כמו בפתיחת הסדר — לפי תאריך ושעת הסדר ולא לפי השעון
  var curRec=S._atData&&S._atCurrentSessionId?
    S._atData.find(function(r){return idEq(r.client_id,S._atCurrentSessionId);}):null;
  var sessDateIso=curRec?curRec.session_date:null;
  var _cfg=S._atCfg||atDefaultCfg();
  var sessObj=curRec?(_cfg.sessions||[]).find(function(s){return s.name===curRec.session;}):null;
  var sessTime=sessObj&&sessObj.start_time?sessObj.start_time:'';
  var autoM=student?atAutoMark(student,sessDateIso,sessTime):null;
  var cur=S._atMarks[sid];
  if(autoM&&cur&&cur.status===autoM&&!S._atCleared[sid]){
    atShowOverrideDialog(sid,student);
    return;
  }
  atApplyMark(sid,code);
}

function atClearMark(sid) {
  delete S._atMarks[sid];
  delete S._atPending[sid];
  S._atCleared[sid]=true;
  atRenderStudents();
  atMarkDirty();
}

function atSetLateMin(sid, val) {
  var n=parseInt(val)||0;
  if(n<0)n=0;if(n>30)n=30;
  if(!S._atMarks[sid])S._atMarks[sid]={status:'l',minutes:n};
  else S._atMarks[sid].minutes=n;
  atMarkDirty();
}

async function atCloseSession() {
  clearTimeout(S._atSaveTimer);
  // שמירה וסגירה רק מסמנות open=false — הרשומה כבר נשמרה לאורך הרישום
  var _cRec=S._atData&&S._atData.find(function(r){return idEq(r.client_id,S._atCurrentSessionId);});
  if(_cRec){_cRec.open=false;}
  await atAutoSaveNow();
  var rec=S._atData&&S._atData.find(function(r){return idEq(r.client_id,S._atCurrentSessionId);});
  var msg=rec?('✅ '+rec.session+' — '+hrSessHebFmt(rec)+' נשמר'):'✅ הסדר נשמר';
  S._atCurrentSessionId=null;
  S._atMarks={};
  S._atPendingRec=null;
  document.getElementById('at-reg-list').classList.add('hidden');
  document.getElementById('at-reg-picker').classList.remove('hidden');
  atRenderTodaySessions();
  toast(msg, null, 'good');
}

export { atCancelStudentStatusFromReg, atClearMark, atCloseSession, atConfirmLate,
         atEditSession, atFillSessionBtns, atOpenSession, atRenderStudents, atSetLateMin,
         atSetMark, atShowTab, loadAttend, screenAttendHTML };
