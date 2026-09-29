// app/domain.reg.js — סדרים ושינה: מסך הרישום והסימונים, לשני הזרמים
import { dayIso, dayNoon, readNum } from '../core/util.js';
import { idEq, newClientId, pendMark, schedulePush, tombKill } from '../core/sync.js';
import { sessUserId } from '../core/auth.js';
import { esc, openModal, toast } from '../core/ui.js';
import { HEB_DOW, hebToGreg } from '../core/hebrew.js';
import { ABS_TYPE_ICON, ABS_TYPE_LBL, MSG_ABSENCE_ALERT, MSG_BUSY_CHECK, MSG_LATE_OVER_30, MSG_NEED_MINUTES,
         MSG_STATUS_REVERTED } from './constants.js';
import { AUTH, S, shell } from './state.js';
import { atvCls, getActiveAbsences, getStudents, hrDayWin, hrMarks, hrMirrorPutRecs,
         hrSortStudents, modalOpen, saveStudents, tyCls } from './domain.js';
import { _hcBuild, _hcFmt, _hcH, _hcMN, hrFmtAt, hrSessHebFmt } from './domain.hebdate.js';
import { _hrPullStaleMark, hrAdoptSession, hrAutoMark, hrCachedArr, hrCachedCfg, hrCfgOf,
         hrFindLiveSession, hrMarkOf, hrPullCfg, hrPullSessions, hrRenderTodaySessions,
         hrSaveData, hrSessionDefs } from './domain.sessions.js';
import { hrRenderArchive } from './domain.arc.js';
import { hrRenderSupervision } from './domain.sup.js';

function hrRegHTML(st) {
  var p=st.p;
  return `
<div class="pg" id="pg-${st.kind}">
  <div class="inner">
    <div class="ptitle">
      <button class="back" data-pg="home" data-act="page" data-page="home">← חזרה</button>
      <span>${st.title}</span>
    </div>
    <!-- לשוניות -->
    <div class="at-tab-bar">
      <button id="${p}-tab-reg" data-act="${p}-tab" data-tab="reg" class="at-tab-btn-on">📝 רישום</button>
      <button id="${p}-tab-arc" data-act="${p}-tab" data-tab="arc" class="at-tab-btn">📁 ארכיון</button>
      <button id="${p}-tab-sup" data-act="${p}-tab" data-tab="sup" class="at-tab-btn">📋 השגחה</button>
    </div>
    <!-- סימון «המוצג ישן» — ריק כשהרענון הצליח -->
    <div id="${p}-pullStale" class="at-pull-warn"></div>
    <!-- תצוגת רישום -->
    <div id="${p}-view-reg" class="hidden">
      <!-- שלב א׳: בחירת תאריך + ממלא + ${st.one} -->
      <div id="${p}-reg-picker">
        <div class="card-pane">
          <div class="filter-row">
            <div class="field-wide">
              <label class="field-label">תאריך</label>
              <div id="${p}-date-wrap"></div>
            </div>
            <div class="field-narrow">
              <label class="field-label" for="${p}-filler">ממלא</label>
              <input aria-label="שם הממלא" id="${p}-filler" class="input-full" placeholder="שם הממלא">
            </div>
          </div>
          <div class="picker-label">בחר ${st.one} לפתיחה:</div>
          <div id="${p}-sess-btns" class="chip-row"></div>
        </div>
        <!-- ${st.many} שמולאו היום -->
        <div id="${p}-today-sessions"></div>
      </div>
      <!-- שלב ב׳: רשימת תלמידים -->
      <div id="${p}-reg-list" class="hidden">
        <div class="at-reg-bar">
          <div id="${p}-reg-header" class="at-reg-bar-info"></div>
          <button data-act="${p}-session-close" class="at-close-btn">✅ שמור וסגור</button>
        </div>
        <div id="${p}-students"></div>
      </div>
    </div>
    <!-- תצוגת ארכיון -->
    <div id="${p}-view-arc" class="hidden">
      <div class="export-row">
        <button data-act="${p}-export" data-fmt="excel" class="export-xls-btn">📊 Excel</button>
        <button data-act="${p}-export" data-fmt="pdf" class="export-pdf-btn">📄 PDF</button>
      </div>
      <div id="${p}-arc-list"></div>
    </div>
    <!-- תצוגת השגחה -->
    <div id="${p}-view-sup" class="hidden">
      <div id="${p}-sup-content"></div>
    </div>
  </div>
</div>
`;
}

// ── ציור המסך וכפתורי הסדרים ──
// נקרא פעמיים, מהמטמון ואחרי הרענון, ולכן אין בו await; התאריך הוא היום של הזרם.
function _hrPaintReg(st) {
  var dw=document.getElementById(st.p+'-date-wrap');
  if(dw){
    var logDate=dayNoon(st.day());
    var todH=_hcH(logDate);
    dw.innerHTML=_hcBuild(st.p+'_date',todH);
    var lbEl=document.getElementById(st.p+'_date_lbl');
    if(lbEl) lbEl.textContent='יום '+HEB_DOW[logDate.getDay()]+' '+_hcFmt(todH.hy,todH.mi,todH.day);
  }

  var adw=document.getElementById(st.p+'-arc-date-wrap');
  if(adw) adw.innerHTML='<div class="status-head-row"><span class="filter-caption">סינון לפי תאריך:</span>'+_hcBuild(st.p+'_arc_date')+'</div>';

  var fl=document.getElementById(st.p+'-filler');
  if(fl && AUTH.user) fl.value=AUTH.user.full_name||'';

  hrFillSessionBtns(st);
  hrRenderTodaySessions(st);

  var pk=document.getElementById(st.p+'-reg-picker');
  var rl=document.getElementById(st.p+'-reg-list');
  if(pk) pk.classList.remove('hidden');
  if(rl) rl.classList.add('hidden');
}

async function hrRegLoad(st) {
  var el = document.getElementById(st.p+'-pullStale');
  S[st.v+'Marks']={};
  S[st.v+'CurrentSessionId']=null;
  S[st.v+'PendingRec']=null;
  // מציג מיד ומרענן ברקע — משיכה לפני הציור משאירה את חיווי הטעינה, ולשונית שנפתחת מוסיפה חיווי שני
  _hrPullStaleMark(el, false);
  hrCachedCfg(st);
  hrCachedArr(st.v+'Data',st.table);
  _hrPaintReg(st);
  hrShowTab(st, S[st.v+'View']||'reg');

  var ok=await Promise.all([hrPullCfg(st), hrPullSessions(st, hrDayWin())]);
  _hrPaintReg(st);
  hrShowTab(st, S[st.v+'View']||'reg');
  _hrPullStaleMark(el, !(ok[0]&&ok[1]));

  var dayIsoR=st.day();
  var openRec=(S[st.v+'Data']||[]).find(function(r){return r&&!r.deleted&&r.open&&r.session_date===dayIsoR;});
  try {
    // ההצעה אינה דורסת חלון דו-שיח פתוח — מיכל אחד, ומי שבדיאלוג אחר לא ימצא אותו מוחלף
    if(openRec && !modalOpen()) {
      openModal(st.msg.openToday,
        '<p class="md-note-center">'+esc(openRec.session)+st.openText+'<br>להמשיך את הרישום?</p>',
        '<button data-act="modal-close" class="md-btn-ghost">אחר כך</button>'+
        '<button data-act="'+st.p+'-resume-go" data-id="'+esc(openRec.client_id)+'" class="md-btn-primary">▶ המשך</button>');
    }
  } catch(eRes){}
  if(st.alert) hrCheckAlert(st);
}

function hrFillSessionBtns(st) {
  var el=document.getElementById(st.p+'-sess-btns');
  if(!el) return;
  el.innerHTML='';
  hrSessionDefs(st).forEach(function(s){
    var btn=document.createElement('button');
    btn.textContent=s.name;
    btn.className='sess-pick-btn';
    btn.dataset.act=st.p+'-open-session';btn.dataset.busy=MSG_BUSY_CHECK;btn.dataset.sid=s.id;btn.dataset.sname=s.name;
    el.appendChild(btn);
  });
}

function hrShowTab(st, tab) {
  S[st.v+'View']=tab;
  ['reg','arc','sup'].forEach(function(t){
    var v=document.getElementById(st.p+'-view-'+t);
    var b=document.getElementById(st.p+'-tab-'+t);
    if(v) v.classList.toggle('hidden',t!==tab);
    if(b) b.className=(t===tab)?'at-tab-btn-on':'at-tab-btn';
  });
  if(tab==='reg' && S[st.v+'CurrentSessionId']) hrRenderStudents(st);
  if(tab==='arc') hrRenderArchive(st);
  if(tab==='sup') hrRenderSupervision(st);
}

// ── רישום הסימונים ומסך הסדר ──

// שעת הסדר מההגדרות, והשעה הנוכחית היא נפילה-חזרה בלבד.
function _hrSessTime(st, sessName, fallback) {
  var sessions=hrCfgOf(st).sessions||[];
  for(var i=0;i<sessions.length;i++){ if(sessions[i].name===sessName&&sessions[i].start_time) return sessions[i].start_time; }
  return fallback;
}

// הרשומה נקראת מהמטמון בלי המתנה — הכפתור שנלחץ צויר מאותו עותק, ולכן היא בו בוודאות
async function hrEditSession(st, recId) {
  var data=hrCachedArr(st.v+'Data',st.table)||[];
  var rec=data.find(function(r){return idEq(r.client_id,recId);});
  if(!rec) return;
  var marks=S[st.v+'Marks']={};S[st.v+'Pending']={};var cleared=S[st.v+'Cleared']={};
  Object.entries(hrMarks(rec)).forEach(function(e){
    var sid=e[0],m=e[1];
    if(m.status){marks[sid]=hrMarkOf(st,m.status,m.minutes,m.note);cleared[sid]=true;}
  });
  // רענון אישורים לתלמידים בלי סימון — אישור שהוזן אחרי פתיחת הסדר
  try {
    var nowT=new Date();
    var hhmm=_hrSessTime(st, rec.session, ('0'+nowT.getHours()).slice(-2)+':'+('0'+nowT.getMinutes()).slice(-2));
    var apChanged=false;
    getStudents().forEach(function(stu){
      if(stu.active===false) return;
      var k=String(stu.client_id);
      if(marks[k]&&marks[k].status) return;
      var am=hrAutoMark(stu, rec.session_date, hhmm);
      if(am){
        marks[k]=hrMarkOf(st,am,0,'');
        cleared[k]=true;
        if(!rec.marks) rec.marks={};
        rec.marks[k]=hrMarkOf(st,am,0,'');
        apChanged=true;
      }
    });
    if(apChanged){
      rec.updated_at=Date.now();
      hrMirrorPutRecs(st.table, data);
      S[st.v+'Data']=data;
      hrSaveData(st, data); // בלי await בכוונה — הדחיפה רצה ברקע
    }
  } catch(eAp){ console.warn('[approval-refresh] '+st.kind+'-edit', eAp); }
  var dw=document.getElementById(st.p+'-date-wrap');
  if(dw&&rec.session_date) dw.innerHTML=_hcBuild(st.p+'_date',_hcH(dayNoon(rec.session_date)));
  var fl=document.getElementById(st.p+'-filler');
  if(fl) fl.value=rec.filled_by_name||'';
  S[st.v+'PendingRec']=null;
  S[st.v+'CurrentSessionId']=recId;
  var hdr=document.getElementById(st.p+'-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(rec.session)+'</span>'+
    '<span class="rec-date">'+hrSessHebFmt(rec)+'</span>';
  document.getElementById(st.p+'-reg-picker').classList.add('hidden');
  document.getElementById(st.p+'-reg-list').classList.remove('hidden');
  hrRenderStudents(st);
}

// שדה תאריך ריק נופל ליום של הזרם — הבורר נבנה מלא, והריק הוא מצב ביניים.
async function hrOpenSession(st, sessId, sessName) {
  if(S[st.v+'CurrentSessionId']){toast(st.msg.closeFirst, null, 'bad');return;}
  var dateIso=(document.getElementById(st.p+'_date_iso')||{}).value||st.day();

  // ההמתנה למשיכה מכוונת — היא מכריעה אם נוצרת רשומה שנייה לאותו סדר; החיווי והניטרול בניתוב.
  // משיכה אחת מסוננת ליום שנבחר — בדיקת הכפילות צריכה יום אחד בלבד.
  // כשל משיכה נופל למצב המקומי; המיזוג החלוני שומר את מה שמחוץ לחלון.
  await hrPullSessions(st, hrDayWin(dateIso));
  var existing=hrFindLiveSession(S[st.v+'Data']||[],sessName,dateIso);
  if(existing){
    openModal(st.msg.done,
      '<p class="md-note-center">'+esc(sessName)+' כבר מולא היום.<br>האם לפתוח לעריכה?</p>',
      '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>'+
      '<button data-act="'+st.p+'-resume-go" data-id="'+esc(existing.client_id)+'" class="md-btn-primary">ערוך</button>');
    return;
  }

  var sessObj=hrCfgOf(st).sessions.find(function(s){return s.name===sessName||idEq(s.id, sessId);});
  var sessTime=sessObj&&sessObj.start_time?sessObj.start_time:'';
  var students=hrSortStudents(getStudents()).filter(function(s){return s.active!==false;});
  var marks=S[st.v+'Marks']={};
  S[st.v+'Pending']={};
  S[st.v+'Cleared']={};
  students.forEach(function(s){
    var am=hrAutoMark(s,dateIso,sessTime);
    if(am) marks[s.client_id]=hrMarkOf(st,am,0,'');
  });

  var filler=document.getElementById(st.p+'-filler');
  var dateHeb=_hcH(dayNoon(dateIso));
  // הסימונים האוטומטיים נכתבים ל-rec.marks — אחרת הם אובדים ביציאה בלי שמירה
  var initMarks={};
  students.forEach(function(s){
    var m=marks[s.client_id];
    initMarks[String(s.client_id)]=hrMarkOf(st,m?m.status:'',0,'');
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
  // אין קריאת טעינה שנייה — הנתונים כבר הוצבו מהמשיכה, וקריאה חוזרת מחזירה אותו מערך.
  S[st.v+'PendingRec']=rec;
  S[st.v+'CurrentSessionId']=rec.client_id;

  _hrMountOpenSession(st, sessName, dateHeb);
}

// ההרכבה נפרדת מהבדיקה — הפתיחה חייבת להמתין למשיכה שמכריעה על כפילות,
// וההרכבה עצמה סינכרונית.
function _hrMountOpenSession(st, sessName, dateHeb) {
  var hdr=document.getElementById(st.p+'-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(sessName)+'</span>'+
    '<span class="rec-date">'+_hcFmt(dateHeb.hy,dateHeb.mi,dateHeb.day)+'</span>';

  document.getElementById(st.p+'-reg-picker').classList.add('hidden');
  document.getElementById(st.p+'-reg-list').classList.remove('hidden');
  hrRenderStudents(st);
}

function _hrCurRec(st) {
  var data=S[st.v+'Data'], id=S[st.v+'CurrentSessionId'];
  return (data&&id)?data.find(function(r){return idEq(r.client_id,id);}):null;
}

function hrSaveLocalNow(st) {
  var rec=_hrCurRec(st);
  if(!rec) return null;
  var buf=S[st.v+'Marks'], marks={};
  getStudents().forEach(function(s){
    if(s.active===false) return;
    var m=buf[s.client_id];
    marks[s.client_id]=m?hrMarkOf(st,m.status,m.status==='l'?(m.minutes||0):0,m.note):hrMarkOf(st,'',0,'');
  });
  rec.marks=marks;
  rec.updated_at=Date.now();
  // מסלול קריטי — כשל כאן עוצר את השרשרת, אחרת המשתמש ממשיך כאילו נשמר
  if(!hrMirrorPutRecs(st.table, S[st.v+'Data'])) return null;
  pendMark(st.pkSess + rec.client_id);
  return rec;
}

async function hrAutoSaveNow(st) {
  if(hrSaveLocalNow(st)===null) return;
  await hrSaveData(st, S[st.v+'Data']);
}

function hrMarkDirty(st) {
  // סימון ראשון בפועל — רק כאן נוצרת רשומת הסדר, כדי שלא יישארו רישומי רפאים
  var pend=S[st.v+'PendingRec'];
  if(pend && idEq(S[st.v+'CurrentSessionId'],pend.client_id)){
    if(!S[st.v+'Data']) S[st.v+'Data']=[];
    var data=S[st.v+'Data'];
    // הבדיקה חוזרת כאן — זו נקודת היצירה, והבדיקה המחזורית יכלה להביא סדר מתחרה מאז הפתיחה
    var dup=hrFindLiveSession(data,pend.session,pend.session_date,pend.client_id);
    if(dup){
      hrAdoptSession(st, dup);
      toast(st.msg.elsewhere, null, 'bad');
    } else if(!data.some(function(r){return r&&idEq(r.client_id,pend.client_id);})) {
      data.push(pend);
    }
    S[st.v+'PendingRec']=null;
  }
  hrSaveLocalNow(st);
  clearTimeout(S[st.v+'SaveTimer']);
  S[st.v+'SaveTimer']=setTimeout(function(){ hrAutoSaveNow(st); },3000);
}

function hrShowOverrideDialog(st, sid, student) {
  var aa=getActiveAbsences(student);
  var a=aa&&aa[0];
  if(!a) return;
  var typeLbl=ABS_TYPE_LBL[a.type]||a.type;
  var typeIcon=ABS_TYPE_ICON[a.type]||'📋';
  var reasonHTML=a.reason?'<div class="abs-reason-blk">סיבה: '+esc(a.reason)+'</div>':'';
  var datesHTML='<div class="abs-dates-blk">מ: '+hrFmtAt(a.from_at)+'<br>עד: '+(a.to_at?hrFmtAt(a.to_at):'ללא תאריך סיום')+'</div>';
  openModal(typeIcon+' '+typeLbl+' — '+student.name,
    '<div class="abs-tone '+tyCls(a.type)+' abs-type-head">'+esc(typeLbl)+'</div>'+
    reasonHTML+datesHTML+
    '<div class="md-question">האם לבטל את הסטטוס לגמרי?<br><span class="md-question-warn">אם כן הוא יימחק והתלמיד ייחשב בישיבה כרגיל</span></div>',
    '<button data-act="modal-close" class="md-btn-close">סגור</button>'+
    '<button data-act="'+st.p+'-status-cancel" data-id="'+esc(sid)+'" class="md-btn-danger">בטל סטטוס</button>');
}

function hrCancelStudentStatusFromReg(st, sid) {
  var students=getStudents();
  var s=students.find(function(x){return idEq(x.client_id, sid);});
  if(!s) return;
  // tombstone לכל היעדרות ולא ריקון — ריקון מוחזר מהענן במיזוג
  if(Array.isArray(s.absences)) s.absences.forEach(function(a){ if(!a.deleted) { tombKill(a); a.deleted_by_client_id=sessUserId(); } });
  s.present=true;
  s.updated_at=Date.now();
  saveStudents(students);
  schedulePush();
  delete S[st.v+'Marks'][sid];
  delete S[st.v+'Cleared'][sid];
  delete S[st.v+'Pending'][sid];
  hrMarkDirty(st);
  hrRenderStudents(st);
  shell.renderStudents();
  toast(MSG_STATUS_REVERTED+s.name, null, 'good');
}

// ההערה שבשורה נשארת — סימון חדש אינו מוחק את מה שנכתב לצידו.
function hrApplyMark(st, sid, code) {
  var s=String(sid);
  // איחור: min=null — השדה ריק עד שהמשתמש מזין ערך
  var m=hrMarkOf(st,code,0,(S[st.v+'Marks'][s]||{}).note);
  m.minutes=code==='l'?null:0;
  S[st.v+'Marks'][s]=m;
  S[st.v+'Cleared'][s]=true; // מונע חזרת הסימון האוטומטי
  S[st.v+'Pending'][s]=true; // נשאר בראש הרשימה בינתיים
  hrRenderStudents(st);
  if(code!=='l'){
    setTimeout(function(){
      delete S[st.v+'Pending'][s];
      hrRenderStudents(st);
    },600);
  }
  // איחור נשאר בראש הרשימה עד אישור הדקות ב-hrConfirmLate
  hrMarkDirty(st);
}

function hrConfirmLate(st, sid) {
  var s=String(sid);
  var inp=document.getElementById(st.p+'-min-'+sid);
  var val=readNum(inp, 0);
  if(!val||val<=0){toast(MSG_NEED_MINUTES, null, 'bad');return;}
  if(val>30){toast(MSG_LATE_OVER_30, null, 'bad');return;}
  hrSetLateMin(st,sid,val);
  delete S[st.v+'Pending'][s];
  hrRenderStudents(st);
  hrMarkDirty(st);
}

// ── רשימת התלמידים וכפתורי הסימון ──
function hrRenderStudents(st) {
  var el=document.getElementById(st.p+'-students');
  if(!el) return;
  var students=hrSortStudents(getStudents());
  if(!students||!students.length){el.innerHTML='<div class="empty-note">אין תלמידים</div>';return;}

  var buf=S[st.v+'Marks'], pending=S[st.v+'Pending'];
  var active=students.filter(function(s){return s.active!==false;});

  var unmarked=[], marked=[];
  active.forEach(function(s){
    var cur=buf[s.client_id];
    var isPending=!!pending[s.client_id];
    if(cur&&cur.status&&!isPending) marked.push(s);
    else unmarked.push(s);
  });

  var bs='mark-btn';
  function mkBtn(sid,code,label){
    var cur=(buf[sid]||{}).status;
    var isOn=(cur===code);
    var cls=bs+' '+atvCls(code)+(isOn?' mark-on':' mark-off');
    return '<button data-act="'+st.p+'-set-mark" data-id="'+esc(sid)+'" data-code="'+esc(code)+'" class="'+cls+'">'+label+'</button>';
  }
  function mkClearBtn(sid){
    return '<button data-act="'+st.p+'-clear-mark" data-id="'+esc(sid)+'" title="נקה סימון" '+
      'class="at-clear-btn clr-btn">✕</button>';
  }

  function renderRow(s, isMark) {
    var marks=buf[s.client_id]||{};
    var isLate=marks.status==='l';
    var hasMark=!!(marks.status);
    var cls=s.cls==='a'?'א':s.cls==='b'?'ב':s.cls==='g'?'ג':s.cls||'';
    var autoHintHTML='';
    var am=hrAutoMark(s);
    if(am&&isMark&&!S[st.v+'Cleared'][s.client_id]){
      var aLbl=am==='ap'?'באישור':am==='ak'?'נעדר ידוע':'';
      if(aLbl) autoHintHTML='<span class="mark-hint">('+aLbl+')</span>';
    }
    var isPendingLate=isLate&&!!pending[String(s.client_id)];
    var lateFieldHTML=isLate?
      '<div class="late-field"'+(isPendingLate?' data-ks':'')+'>'+
        '<input aria-label="דק׳" type="text" inputmode="numeric" maxlength="2" value="'+(marks.minutes!=null?marks.minutes:'')+'" id="'+st.p+'-min-'+s.client_id+'" placeholder="דק׳" '+
        'data-inp="'+st.p+'-late" data-id="'+esc(s.client_id)+'" '+
        ' class="late-input">'+
        '<span class="unit-hint">דק׳</span>'+
        (isPendingLate?'<button data-act="'+st.p+'-confirm-late" data-ksave data-id="'+esc(s.client_id)+'" class="late-ok-btn">✓ אשר</button>':'')+
      '</div>':'';
    var noteField=st.note?
      '<input aria-label="הערה" type="text" placeholder="הערה" value="'+esc(marks.note||'')+'" '+
        'id="'+st.p+'-note-'+s.client_id+'" '+
        'data-inp="'+st.p+'-note" data-id="'+esc(s.client_id)+'" '+
        ' class="late-min-inp">':'';
    var rowBg=isMark?'mark-row-on':'mark-row';
    return '<div class="'+rowBg+' mark-line">'+
      '<div class="at-row-class">'+esc(cls)+'</div>'+
      '<div class="at-row-name">'+esc(s.name)+autoHintHTML+'</div>'+
      lateFieldHTML+
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

function hrSetMark(st, sid, code) {
  var student=getStudents().find(function(s){return String(s.client_id)===String(sid);});
  // אותו חישוב כמו בפתיחת הסדר — לפי תאריך ושעת הסדר ולא לפי השעון
  var curRec=_hrCurRec(st);
  var sessDateIso=curRec?curRec.session_date:null;
  var sessTime=curRec?_hrSessTime(st, curRec.session, ''):'';
  var autoM=student?hrAutoMark(student,sessDateIso,sessTime):null;
  var cur=S[st.v+'Marks'][sid];
  if(autoM&&cur&&cur.status===autoM&&!S[st.v+'Cleared'][sid]){
    hrShowOverrideDialog(st,sid,student);
    return;
  }
  hrApplyMark(st,sid,code);
}

// ניקוי הסימון משאיר את ההערה — היא נכתבה לצד התלמיד ולא לצד הסימון.
function hrClearMark(st, sid) {
  var note=(S[st.v+'Marks'][sid]||{}).note||'';
  delete S[st.v+'Marks'][sid];
  if(note) S[st.v+'Marks'][sid]=hrMarkOf(st,'',0,note);
  delete S[st.v+'Pending'][sid];
  S[st.v+'Cleared'][sid]=true;
  hrRenderStudents(st);
  hrMarkDirty(st);
}

function hrSetLateMin(st, sid, val) {
  var n=parseInt(val)||0;
  if(n<0)n=0;if(n>30)n=30;
  if(!S[st.v+'Marks'][sid])S[st.v+'Marks'][sid]=hrMarkOf(st,'l',n,'');
  else S[st.v+'Marks'][sid].minutes=n;
  hrMarkDirty(st);
}

function hrSetNote(st, sid, val) {
  var s=String(sid);
  if(!S[st.v+'Marks'][s]) S[st.v+'Marks'][s]=hrMarkOf(st,'',0,'');
  S[st.v+'Marks'][s].note=val;
  hrMarkDirty(st);
}

async function hrCloseSession(st) {
  clearTimeout(S[st.v+'SaveTimer']);
  // שמירה וסגירה רק מסמנות open=false — הרשומה כבר נשמרה לאורך הרישום
  var cRec=_hrCurRec(st);
  if(cRec){cRec.open=false;}
  await hrAutoSaveNow(st);
  var rec=_hrCurRec(st);
  var msg=rec?('✅ '+rec.session+' — '+hrSessHebFmt(rec)+' נשמר'):st.savedMsg;
  S[st.v+'CurrentSessionId']=null;
  S[st.v+'Marks']={};
  S[st.v+'PendingRec']=null;
  document.getElementById(st.p+'-reg-list').classList.add('hidden');
  document.getElementById(st.p+'-reg-picker').classList.remove('hidden');
  hrRenderTodaySessions(st);
  toast(msg, null, 'good');
}

// התראת החיסורים בכניסה — בזרם שהצהיר עליה (alert).
function hrCheckAlert(st) {
  var data=(S[st.v+'Data']||[]).filter(function(r){ return !(r && r.deleted); });
  var students=getStudents();
  if(!data.length) return;

  var todH=_hcH(new Date());
  var curHY=todH.hy, curMI=todH.mi;
  // תחילת החודש כמחרוזת ISO — השוואת ימים על המחרוזת, בלי Date ובלי שעה.
  var mG=hebToGreg(curHY,curMI,1);
  if(!mG) return;
  var monthBeg=dayIso(mG);
  console.log('['+st.kind+'] hrCheckAlert — חודש עברי:', _hcMN(curHY)[curMI], curHY,
    '| תחילת חודש גרגוריאנית:', monthBeg,
    '| רשומות סה"כ:', data.length);

  var alerts=[];
  var stats={};
  students.forEach(function(s){stats[s.client_id]={name:s.name,absent:0,lateMin:0};});
  data.forEach(function(rec){
    if(String(rec.session_date||'')<monthBeg) return;
    Object.entries(hrMarks(rec)).forEach(function(e){
      var sid=e[0],m=e[1];
      if(!stats[sid]) return;
      if(m.status==='e'||m.status==='x') stats[sid].absent++;
      if(m.status==='l') stats[sid].lateMin+=m.minutes||0;
    });
  });
  Object.values(stats).forEach(function(s){
    if(s.absent>=20||s.lateMin>=300) alerts.push(s);
  });
  if(!alerts.length) return;

  var listHTML=alerts.slice(0,10).map(function(s){
    return '<div class="alert-row">'+esc(s.name)+
      (s.absent>=20?'<span class="alert-abs"> — '+s.absent+' חיסורים</span>':'')+
      (s.lateMin>=300?'<span class="alert-late"> — '+s.lateMin+' דק׳ איחור</span>':'')+
      '</div>';
  }).join('');
  openModal(MSG_ABSENCE_ALERT,
    '<p class="alert-lead">התלמידים הבאים חרגו מהסף מתחילת החודש:</p>'+
    '<div class="alert-list">'+listHTML+'</div>',
    '<button data-act="modal-close" class="alert-ok">הבנתי</button>');
}

export { hrCancelStudentStatusFromReg, hrClearMark, hrCloseSession, hrConfirmLate, hrEditSession,
         hrFillSessionBtns, hrOpenSession, hrRegHTML, hrRegLoad, hrRenderStudents, hrSetLateMin,
         hrSetMark, hrSetNote, hrShowTab };
