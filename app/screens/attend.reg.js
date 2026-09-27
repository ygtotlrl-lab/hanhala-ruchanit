// app/screens/attend.reg.js — סדרים — מודול הנוכחות ורישום הסימונים
import { dayNoon, dayToday, readNum } from '../../core/util.js';
import { ctxEpoch, ctxStale, idEq, pendConfirmPush, pendMark, pendMarkMany, pendTag,
         pushTable, schedulePush } from '../../core/sync.js';
import { lsGet, lsSetArray } from '../../core/storage.js';
import { MIRROR } from '../../core/mirror.js';
import { esc, openModal, toast } from '../../core/ui.js';
import { AUTH, S } from '../state.js';
import { MSG_BUSY_CHECK, MSG_CLOSE_SESSION_FIRST, MSG_LATE_OVER_30, MSG_NEED_MINUTES,
         MSG_PICK_DATE_FIRST, MSG_SESSION_DONE, MSG_SESSION_OPEN_ELSEWHERE,
         MSG_SESSION_OPEN_TODAY, MSG_STATUS_REVERTED } from '../config.js';
import { HR_MIRROR_STREAMS, PK_AT_SESS, PK_SL_SESS, _hrAtDiskSave, _hrRecTs,
         _hrSessionsMerge, hrCfgGet, hrCfgLocalGet, hrCfgLocalSet, hrCfgSet,
         hrCloudGet, hrCount, hrDayWin, hrMarks, hrMirrorRecs, hrSetPending, hrSyncLog,
         hrTouchLastChanged, hrWho, hrWriteFail } from '../domain.js';
import { atRenderArchive } from './attend.arc.js';
import { atCheckAlert, atRenderSupervision } from './attend.sup.js';
import { hrGetLogicalDate, hrRenderStudents, hrSaveData } from './sleep.reg.js';
import { getActiveAbsences, getStudents, hrSortStudents, renderStudents, saveStudents } from './students.js';
import { HE, _hcBuild, _hcFmt, _hcH, atvCls, modalOpen, tyCls } from '../main.js';

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

// ── מודול הנוכחות ──
var AT_DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function atDow(isoDate){return AT_DOW[dayNoon(isoDate).getDay()];}

function atSummaryHtml(cnts){
  var parts=[];
  var add=function(n,lbl,code){if(n)parts.push('<span class="'+atvCls(code)+' at-count">'+n+' '+lbl+'</span>');};
  add(cnts.p||0,  'נוכחים',   'p');
  add(cnts.e||0,  'חיסורים',  'e');
  add(cnts.x||0,  'היעדרויות','x');
  add(cnts.l||0,  'איחורים',  'l');
  add(cnts.ap||0, 'אישורים',  'ap');
  add(cnts.ak||0, 'בבית',     'ak');
  add(cnts.a||0,  'מנוחה',    'a');
  return parts.join('<span class="user-handle"> | </span>');
}

// קריאה סינכרונית, מהזיכרון או מהדיסק — הציור הראשון אינו ממתין לרשת
function hrCachedArr(memKey, lsKey) {
  if (Array.isArray(S[memKey])) return S[memKey];
  var p = _hrDiskArr(lsKey);
  if (p) { S[memKey] = p; return p; }
  return null;
}

// נקודת קריאת דיסק אחת — שני קוראים נבדלים ברגע שאחד מהם לומד פורמט חדש
function _hrDiskArr(lsKey) {
  // מפתח שיש לו מראה נקרא ממנה — קריאה מהמפתח השטוח הייתה מקור אמת שני
  if (HR_MIRROR_STREAMS[lsKey]) return hrMirrorRecs(lsKey);
  if (Object.prototype.hasOwnProperty.call(MIRROR, lsKey)) return MIRROR[lsKey];
  try {
    var lc = lsGet(lsKey);
    if (lc) { var p = JSON.parse(lc); if (Array.isArray(p)) return p; }
  } catch (e) {}
  return null;
}

// כשל רענון מסומן גלוי — מסך שמציג נתון ישן בלי לומר זאת הוא הכשל השקט עצמו
function _hrPullStaleMark(el, bad) {
  if (!el) return;
  el.textContent = bad ? '⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר' : '';
  el.classList.toggle('on', !!bad);
}

// מחזירה האם הענן ענה ולא את הנתון — atLoadData נופלת לדיסק ומחזירה מערך גם בכשל.
// השמירה לדיסק ממזגת ואינה דורסת — רשומה שנרשמה אופליין וטרם עלתה הייתה נמחקת.
// מסלול בלי חלון מוסר null במפורש — השמטת החלון מושכת את הטבלה כולה.
async function _atPullSessions(win) {
  var v = null; try { v = await hrCloudGet('hr_sessions', win); } catch (e) {}
  if (!Array.isArray(v)) return false;
  var loc = _hrDiskArr('hr_sessions');
  var out = loc ? _hrSessionsMerge(v, loc, 'hr_sessions', !!win) : v;
  S._atData = out; _hrAtDiskSave(out);
  return true;
}

async function _atPullCfg() {
  var r = null; try { r = await hrCfgGet('attend_cfg', true); } catch (e) {}
  if (!r || !r.ok) return false;
  if (r.value && !hrSetPending('attend_cfg')) { S._atCfg = r.value; hrCfgLocalSet('attend_cfg', r.value); }
  return true;
}

async function _atPullTreats() {
  var r = null; try { r = await hrCfgGet('attend_treats', true); } catch (e) {}
  if (!r || !r.ok) return false;
  // מפתח שטרם נכתב אינו דורס את הדיסק — [] מעליו היה מוחק טיפולים שנרשמו אופליין וטרם עלו
  if (Array.isArray(r.value) && !hrSetPending('attend_treats')) { S._atTreats = r.value; lsSetArray('hr_attend_treats', r.value, _hrRecTs); }
  else if (!Array.isArray(S._atTreats)) S._atTreats = hrCachedArr('_atTreats', 'hr_attend_treats') || [];
  return true;
}

// אתחול החודש הנצפה בנקודה אחת — המשיכה שקודמת לציור צריכה לדעת איזה חודש להביא
function _atSupMonth() {
  if (S._atSupHY === null) {
    var ch = _hcH(new Date());
    S._atSupHY = ch.hy; S._atSupMI = ch.mi;
  }
  return S._atSupHY;
}

function atDefaultCfg() {
  return {
    sessions:[
      {id:'sh',name:'שחרית'},
      {id:'s1',name:'סדר א׳'},
      {id:'s2',name:'סדר ב׳'},
      {id:'s3',name:'סדר ג׳'},
      {id:'ev',name:'ערבית'},
      {id:'nl',name:'סדר לילה'}
    ],
    treats:['שיחה אישית','אזהרה','שיחת הורים','זימון לרב','אחר']
  };
}

// סינכרונית — הציור הראשון אינו ממתין לרשת, וההגדרות קובעות אילו כפתורי סדר להציג
function atCachedCfg() {
  if (S._atCfg) return S._atCfg;
  try { var p=hrCfgLocalGet('attend_cfg'); if(p){ S._atCfg=p; return p; } } catch(e){}
  return null;
}

async function atSaveCfg(cfg) {
  S._atCfg=cfg;
  return hrCfgSet('attend_cfg',cfg);
}

async function atLoadData() {
  if (S._atData) return S._atData;
  try { var v=await hrCloudGet('hr_sessions'); if(Array.isArray(v)){S._atData=v;return v;} } catch(e){}
  var _atDisk=hrMirrorRecs('hr_sessions');
  if(Array.isArray(_atDisk)){S._atData=_atDisk;return S._atData;}
  S._atData=[]; return S._atData;
}

async function atSaveData(data) {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  // t0 נלקח לפני קריאת המצב — אישור של רשומה שסומנה אחריו היה מוריד סימון מרשומה שלא עלתה
  var _t0=Date.now();
  S._atData=data;
  _hrAtDiskSave(data);
  try {
    // מיזוג עם הענן לפני הכתיבה — אחרת נדרסות רשומות של מכשיר אחר
    var _atLocalN=hrCount(data);
    var _atRemote=null; try { _atRemote=await hrCloudGet('hr_sessions'); } catch(eR){}
    if (Array.isArray(_atRemote)) {
      data=_hrSessionsMerge(_atRemote, data, 'hr_sessions');
      S._atData=data;
      _hrAtDiskSave(data);
    }
    // מערך ריק אינו כישלון אלא «אין מה לדחוף»; כתיבה שנכשלה נשארת ממתינה ונוסית שוב
    var _rAt=await pushTable('hr_sessions',data);
    // רק כתיבה שהצליחה היא ראיה — והיא מזינה גם את הסימון הממתין וגם את _hrPushedAt
    if(_rAt&&_rAt.ok&&!ctxStale(_ep)) pendConfirmPush(PK_AT_SESS,_t0);
    hrSyncLog('push','hr_sessions',hrCount(data),{local_count:_atLocalN,remote_count:hrCount(_atRemote),result_count:hrCount(data)});
    await hrTouchLastChanged();
  } catch (e) { hrWriteFail('atSaveData', e); }
}

async function atLoadTreats() {
  // התוצאה נשמרת בזיכרון — הציור הראשון של ההשגחה קורא ממנה בלי להמתין לרשת.
  // רשימה שממתינה לסנכרון נקראת מהמכשיר — הענן טרם קיבל אותה.
  if (!hrSetPending('attend_treats')) try { var v=await hrCfgGet('attend_treats'); if(Array.isArray(v)){S._atTreats=v;return v;} } catch(e){}
  try { var lc=lsGet('hr_attend_treats'); if(lc){var p=JSON.parse(lc); if(Array.isArray(p)){S._atTreats=p;return p;}} } catch(e){}
  return [];
}

function atLiveTreats(arr) { return (Array.isArray(arr)?arr:[]).filter(function(t){ return t && !t.deleted; }); }

async function atSaveTreats(data) {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  var _t0=Date.now();
  lsSetArray('hr_attend_treats', data, _hrRecTs);
  try {
    // מיזוג ברמת רשומה לפני הכתיבה — כתיבת המערך כולו מוחקת טיפול שמדריך אחר רשם במקביל
    var _tRemote=null; try { _tRemote=await hrCfgGet('attend_treats'); } catch(eR){}
    if (Array.isArray(_tRemote)) {
      data=_hrSessionsMerge(_tRemote, data, 'hr_attend_treats');
      lsSetArray('hr_attend_treats', data, _hrRecTs);
    }
    if (!ctxStale(_ep)) await hrCfgSet('attend_treats',data);
  } catch (e) { hrWriteFail('atSaveTreats', e); }
  S._atTreats=data;
  return data;
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
  var _openRec=(S._atData||[]).find(function(r){return r&&!r.deleted&&r.open&&r.date_iso===_todayIsoR;});
  try {
    // ההצעה אינה דורסת מודאל פתוח — מיכל אחד, ומי שבדיאלוג אחר לא ימצא אותו מוחלף
    if(_openRec && !modalOpen()) {
      openModal(MSG_SESSION_OPEN_TODAY,
        '<p class="md-note-center">'+esc(_openRec.session)+' נפתח היום ולא נסגר.<br>להמשיך את הרישום?</p>',
        '<button data-act="modal-close" class="md-btn-ghost">אחר כך</button>'+
        '<button data-act="at-resume-go" data-id="'+esc(_openRec.id)+'" class="md-btn-primary">▶ המשך</button>');
    }
  } catch(eRes){}
  atCheckAlert();
}

function atSortedSessions(cfg) {
  if(!cfg) cfg=S._atCfg||atDefaultCfg();
  return (cfg.sessions||[]).slice().sort(function(a,b){
    return HE.compare(a.startTime||'', b.startTime||'');
  });
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
  if(tab==='arc') atRenderArchive();
  if(tab==='sup') atRenderSupervision();
}

// ── רישום ──
// sessDateIso אופציונלי — בלעדיו אישורים תמיד פעילים
function atAutoMark(student, sessDateIso, sessStartTime) {
  // תאריך עזר מזמן הסדר — ברישום רטרואקטיבי הסטטוס נבדק לפי הסדר ולא לפי השעון
  var sessRef = null;
  if (sessDateIso) {
    sessRef = new Date(sessDateIso + 'T' + (sessStartTime || '12:00') + ':00');
  }
  var aa=getActiveAbsences(student, sessRef);
  if(!aa||!aa.length) return null;
  for(var i=0;i<aa.length;i++){
    var t=aa[i].type;
    if(t==='suspended'||t==='left') return 'ak';
    if(t==='approved'){
      if(!sessDateIso) return 'ap';
      var fromDate=aa[i].from?(aa[i].from.split('T')[0]):'';
      var toDate=aa[i].to?(aa[i].to.split('T')[0]):'';
      if(fromDate&&sessDateIso<fromDate) continue;
      if(toDate&&sessDateIso>toDate) continue;
      // ביום הגבול נבדקת גם השעה — אחרת מסומנים סדרים שלפני תחילת האישור או אחרי סיומו
      if(sessStartTime){
        if(fromDate&&sessDateIso===fromDate){
          var fromTime=aa[i].from&&aa[i].from.indexOf('T')>=0?aa[i].from.split('T')[1].substr(0,5):'00:00';
          if(sessStartTime<fromTime) continue;
        }
        if(toDate&&sessDateIso===toDate){
          var toTime=aa[i].to&&aa[i].to.indexOf('T')>=0?aa[i].to.split('T')[1].substr(0,5):'23:59';
          if(sessStartTime>toTime) continue;
        }
      }
      return 'ap';
    }
  }
  return null;
}

// נקרא אחרי הוספה, עריכה או מחיקה של אישור או היעדרות.
// מעדכן רק סימון ריק או ap — סימון ידני אינו נדרס.
async function hrRefreshApprovalMarks(sid) {
  try {
    var student = getStudents().find(function(x){ return idEq(x.id, sid); });
    if (!student) return;
    var sidKey = String(sid);
    var todayIso = dayToday();

    // קריאה בנקודת הדיסק האחת ובלי כתיבה — השמירה היא saveFn, ומפתח שטוח כאן היה מקור אמת שני
    function refreshSet(lsKey, pk, cfgSessions, dateIso, curId, marksBuf, renderFn, saveFn, withNote) {
      var data = _hrDiskArr(lsKey);
      if (!Array.isArray(data)) return;
      var changed = [];
      data.forEach(function(rec){
        if (!rec || rec.deleted || !rec.open || rec.date_iso !== dateIso) return;
        var cur = (rec.marks && rec.marks[sidKey]) ? (rec.marks[sidKey].s || '') : '';
        if (cur !== '' && cur !== 'ap') return;
        var sessTime = '';
        for (var i = 0; i < cfgSessions.length; i++) { if (cfgSessions[i].name === rec.session) { sessTime = cfgSessions[i].startTime || ''; break; } }
        var am = atAutoMark(student, rec.date_iso, sessTime);
        var next = (am === 'ap') ? 'ap' : '';
        if (next === cur) return;
        if (!rec.marks) rec.marks = {};
        rec.marks[sidKey] = withNote ? { s: next, min: 0, note: '' } : { s: next, min: 0 };
        rec.updatedAt = Date.now();
        changed.push(pk + rec.id);
        // סדר שפתוח כרגע במכשיר הזה — מעדכנים גם את ה-buffer ואת התצוגה
        if (curId === rec.id && marksBuf) {
          if (next) marksBuf[sidKey] = withNote ? { s: next, min: 0, note: '' } : { s: next, min: 0 };
          else delete marksBuf[sidKey];
          if (typeof renderFn === 'function') { try { renderFn(); } catch(eR) {} }
        }
      });
      if (changed.length) {
        // הסימון לפני saveFn — הדחיפה לוכדת t0 בכניסה, ורק סימון שקדם לו מאושר בהצלחתה
        pendMarkMany(changed);
        try { saveFn(data); } catch (eS) { hrWriteFail('refreshSet', eS); }
      }
    }

    var atCfg = (S._atCfg && Array.isArray(S._atCfg.sessions)) ? S._atCfg.sessions : [];
    refreshSet('hr_sessions', PK_AT_SESS, atCfg, todayIso, S._atCurrentSessionId, S._atMarks, atRenderStudents, function(d){ S._atData = d; atSaveData(d); }, false);

    var hrCfg = (S._hrCfg && Array.isArray(S._hrCfg.sessions)) ? S._hrCfg.sessions : [];
    var hrIso = (typeof hrGetLogicalDate === 'function') ? hrGetLogicalDate() : todayIso;
    refreshSet('hr_sleep_sessions', PK_SL_SESS, hrCfg, hrIso, S._hrCurrentSessionId, S._hrMarks, hrRenderStudents, function(d){ S._hrData = d; hrSaveData(d); }, true);
  } catch(e) { console.warn('[approval-refresh]', e); }
}

// ── נוכחות — רישום הסימונים ומסך הסדר ──
function atRenderTodaySessions() {
  var el=document.getElementById('at-today-sessions');
  if(!el) return;
  var data=S._atData||[];
  var selIso=(document.getElementById('at_date_iso')||{}).value;
  var todayIso=dayToday();
  var filterIso=selIso||todayIso;
  var isToday=filterIso===todayIso;
  var cfg=S._atCfg||atDefaultCfg();
  var sessOrder={};
  atSortedSessions(cfg).forEach(function(s,i){sessOrder[s.name]=i;});
  var daySess=data.filter(function(r){return !r.deleted&&r.date_iso===filterIso;})
    .slice().sort(function(a,b){
      var ia=sessOrder[a.session]!=null?sessOrder[a.session]:999;
      var ib=sessOrder[b.session]!=null?sessOrder[b.session]:999;
      return ia-ib;
    });
  if(!daySess.length){el.innerHTML='';return;}
  var dowLabel=isToday?'היום':'יום '+atDow(filterIso);
  var html='<div class="day-sess-block">'+
    '<div class="day-sess-title">📋 סדרים שמולאו '+dowLabel+':</div>'+
    '<div class="reason-list">';
  daySess.forEach(function(rec){
    var cnts={};
    Object.values(hrMarks(rec)).forEach(function(m){if(m.s)cnts[m.s]=(cnts[m.s]||0)+1;});
    var summaryHtml=atSummaryHtml(cnts);
    html+='<div data-act="at-edit-session" data-id="'+esc(rec.id)+'" class="day-sess-row">'+
      '<span class="day-sess-name">'+esc(rec.session)+'</span>'+
      pendTag(PK_AT_SESS+rec.id)+
      '<div class="day-sess-summary">'+summaryHtml+'</div>'+
      '<span class="day-sess-edit">✏️ ערוך</span>'+
    '</div>';
  });
  html+='</div></div>';
  el.innerHTML=html;
}

// הרשומה נקראת מהמטמון בלי המתנה — הכפתור שנלחץ צויר מאותו עותק, ולכן היא בו בוודאות
async function atEditSession(recId) {
  var data=hrCachedArr('_atData','hr_sessions')||[];
  var rec=data.find(function(r){return idEq(r.id,recId);});
  if(!rec) return;
  S._atMarks={};S._atPending={};S._atCleared={};
  Object.entries(hrMarks(rec)).forEach(function(e){
    var sid=e[0],m=e[1];
    if(m.s){S._atMarks[sid]={s:m.s,min:m.min||0};S._atCleared[sid]=true;}
  });
  // רענון אישורים לתלמידים בלי סימון — אישור שהוזן אחרי פתיחת הסדר
  try {
    var _nowT=new Date();
    var _hhmm=('0'+_nowT.getHours()).slice(-2)+':'+('0'+_nowT.getMinutes()).slice(-2);
    // שעת הסדר מההגדרות קודמת; השעה הנוכחית היא נפילה-חזרה בלבד
    var _cfgS=(S._atCfg&&Array.isArray(S._atCfg.sessions))?S._atCfg.sessions:[];
    for(var _ci=0;_ci<_cfgS.length;_ci++){ if(_cfgS[_ci].name===rec.session&&_cfgS[_ci].startTime){_hhmm=_cfgS[_ci].startTime;break;} }
    var _apChanged=false;
    getStudents().forEach(function(st){
      if(st.active===false) return;
      var k=String(st.id);
      if(S._atMarks[k]&&S._atMarks[k].s) return;
      var am=atAutoMark(st, rec.date_iso, _hhmm);
      if(am){
        S._atMarks[k]={s:am,min:0};
        S._atCleared[k]=true;
        if(!rec.marks) rec.marks={};
        rec.marks[k]={s:am,min:0};
        _apChanged=true;
      }
    });
    if(_apChanged){
      rec.updatedAt=Date.now();
      _hrAtDiskSave(data);
      S._atData=data;
      atSaveData(data); // בלי await בכוונה — הדחיפה רצה ברקע
    }
  } catch(eAp){ console.warn('[approval-refresh] edit', eAp); }
  var dw=document.getElementById('at-date-wrap');
  if(dw&&rec.date_heb) dw.innerHTML=_hcBuild('at_date',rec.date_heb);
  var fl=document.getElementById('at-filler');
  if(fl) fl.value=rec.filled_by_name||'';
  S._atPendingRec=null;
  S._atCurrentSessionId=recId;
  var hdr=document.getElementById('at-reg-header');
  if(hdr) hdr.innerHTML=
    '<span class="rec-title">'+esc(rec.session)+'</span>'+
    '<span class="rec-date">'+_hcFmt(rec.date_heb.hy,rec.date_heb.mi,rec.date_heb.day)+'</span>';
  document.getElementById('at-reg-picker').classList.add('hidden');
  document.getElementById('at-reg-list').classList.remove('hidden');
  atRenderStudents();
}

// ── מניעת כפילות סדרים ──
// שם סדר ותאריך זהים הם תקלה; הבדיקה חוזרת בנקודת היצירה כי הפולינג יכול להביא סדר מתחרה אחרי הפתיחה.
// אין אינדקס ייחודי על (session, date_iso) — הוא נכשל על זוגות שכבר במסד; הבדיקה משרתת גם את השינה.
function atFindLiveSession(data, sessName, dateIso, exceptId) {
  if (!Array.isArray(data)) return null;
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!r || r.deleted) continue;
    if (r.session !== sessName || r.date_iso !== dateIso) continue;
    if (exceptId != null && idEq(r.id, exceptId)) continue;
    return r;
  }
  return null;
}

// אימוץ סדר קיים: הסימונים הקיימים נטענים תחילה, וסימון מקומי גובר עליהם —
// atSaveLocalNow בונה את marks מחדש מ-_atMarks, ואימוץ בלי טעינה היה מוחק את סימוני המכשיר האחר.
function atAdoptSession(rec) {
  var ex = hrMarks(rec);
  Object.keys(ex).forEach(function (k) {
    var cur = S._atMarks[k];
    if (!cur || !cur.s) S._atMarks[k] = { s: (ex[k] && ex[k].s) || '', min: (ex[k] && ex[k].min) || 0 };
  });
  S._atCurrentSessionId = rec.id;
}

function hrAdoptSession(rec) {
  var ex = hrMarks(rec);
  Object.keys(ex).forEach(function (k) {
    var cur = S._hrMarks[k];
    if (!cur || !cur.s) S._hrMarks[k] = { s: (ex[k] && ex[k].s) || '', min: (ex[k] && ex[k].min) || 0, note: (ex[k] && ex[k].note) || '' };
  });
  S._hrCurrentSessionId = rec.id;
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
      '<button data-act="at-resume-go" data-id="'+esc(existing.id)+'" class="md-btn-primary">ערוך</button>');
    return;
  }

  var _oCfg=S._atCfg||atDefaultCfg();
  var _oSessObj=_oCfg.sessions.find(function(s){return s.name===sessName||idEq(s.id, sessId);});
  var _oSessTime=_oSessObj&&_oSessObj.startTime?_oSessObj.startTime:'';
  var students=hrSortStudents(getStudents());
  S._atMarks={};
  S._atPending={};
  S._atCleared={};
  students.filter(function(s){return s.active!==false;}).forEach(function(s){
    var am=atAutoMark(s,dateIso,_oSessTime);
    if(am) S._atMarks[s.id]={s:am,min:0};
  });

  var filler=document.getElementById('at-filler');
  var dateHeb=_hcH(new Date(dateIso));
  // הסימונים האוטומטיים נכתבים ל-rec.marks — אחרת הם אובדים ביציאה בלי שמירה
  var initMarks={};
  students.filter(function(s){return s.active!==false;}).forEach(function(s){
    var m=S._atMarks[s.id];
    initMarks[String(s.id)]={s:m?m.s:'',min:0};
  });
  var rec={
    id:Date.now()+'_'+Math.random().toString(36).substr(2,5),
    session:sessName,
    date_iso:dateIso,
    date_heb:dateHeb,
    filled_by:AUTH.user?AUTH.user.client_id:'',
    filled_by_name:filler?filler.value:(AUTH.user?AUTH.user.full_name:''),
    marks:initMarks,
    created_at:new Date().toISOString(),
    updatedAt:Date.now(),
    createdBy:hrWho(),
    open:true
  };

  // הרשומה נשמרת רק בסימון הראשון בפועל (atMarkDirty) — מונע רישומי רפאים.
  // אין קריאת טעינה שנייה — _atData כבר הוצב מהמשיכה, וקריאה חוזרת מחזירה אותו מערך.
  S._atPendingRec=rec;
  S._atCurrentSessionId=rec.id;

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
  var rec=S._atData.find(function(r){return idEq(r.id,S._atCurrentSessionId);});
  if(!rec) return null;
  var marks={};
  getStudents().forEach(function(s){
    if(s.active===false) return;
    var m=S._atMarks[s.id];
    marks[s.id]=m?{s:m.s,min:m.s==='l'?(m.min||0):0}:{s:'',min:0};
  });
  rec.marks=marks;
  rec.updatedAt=Date.now();
  // מסלול קריטי — כשל כאן עוצר את השרשרת, אחרת המשתמש ממשיך כאילו נשמר
  if(!_hrAtDiskSave(S._atData)) return null;
  pendMark(PK_AT_SESS + rec.id);
  return rec;
}

async function atAutoSaveNow() {
  if(atSaveLocalNow()===null) return;
  await atSaveData(S._atData);
}

function atMarkDirty() {
  // סימון ראשון בפועל — רק כאן נוצרת רשומת הסדר, כדי שלא יישארו רישומי רפאים
  if(S._atPendingRec && idEq(S._atCurrentSessionId,S._atPendingRec.id)){
    if(!S._atData) S._atData=[];
    // הבדיקה חוזרת כאן — זו נקודת היצירה, והפולינג יכול היה להביא סדר מתחרה מאז הפתיחה
    var _atDup=atFindLiveSession(S._atData,S._atPendingRec.session,
                                 S._atPendingRec.date_iso,S._atPendingRec.id);
    if(_atDup){
      atAdoptSession(_atDup);
      toast(MSG_SESSION_OPEN_ELSEWHERE, null, 'bad');
    } else if(!S._atData.some(function(r){return r&&idEq(r.id,S._atPendingRec.id);})) {
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
  var reasonHtml=a.reason?'<div class="abs-reason-blk">סיבה: '+esc(a.reason)+'</div>':'';
  var datesHtml='<div class="abs-dates-blk">מ: '+fmtDt(a.from)+'<br>עד: '+(a.to?fmtDt(a.to):'ללא תאריך סיום')+'</div>';
  openModal(typeIcon+' '+typeLbl+' — '+student.name,
    '<div class="abs-tone '+tyCls(a.type)+' abs-type-head">'+esc(typeLbl)+'</div>'+
    reasonHtml+
    datesHtml+
    '<div class="md-question">האם לבטל את הסטטוס לגמרי?<br><span class="md-question-warn">אם כן הוא יימחק והתלמיד ייחשב בישיבה כרגיל</span></div>',
    '<button data-act="modal-close" class="md-btn-close">סגור</button>'+
    '<button data-act="at-status-cancel" data-id="'+esc(sid)+'" class="md-btn-danger">בטל סטטוס</button>');
}

function atCancelStudentStatusFromReg(sid) {
  var students=getStudents();
  var s=students.find(function(x){return String(x.id)===String(sid);});
  if(!s) return;
  // tombstone לכל היעדרות ולא ריקון — ריקון מוחזר מהענן במיזוג
  if(Array.isArray(s.absences)) s.absences.forEach(function(a){ a.deleted=true; a.updatedAt=Date.now(); a.deletedBy=hrWho(); });
  s.present=true;
  s.updatedAt=Date.now();
  saveStudents(students);
  schedulePush();
  delete S._atMarks[sid];
  delete S._atCleared[sid];
  delete S._atPending[sid];
  atMarkDirty();
  atRenderStudents();
  renderStudents();
  toast(MSG_STATUS_REVERTED+s.name, null, 'good');
}

function atApplyMark(sid, code) {
  var s=String(sid);
  // איחור: min=null — השדה ריק עד שהמשתמש מזין ערך
  S._atMarks[s]={s:code,min:code==='l'?null:0};
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
    var cur=S._atMarks[s.id];
    var isPending=!!S._atPending[s.id];
    if(cur&&cur.s&&!isPending) marked.push(s);
    else unmarked.push(s);
  });

  var bs='mark-btn';
  function mkBtn(sid,code,label){
    var cur=(S._atMarks[sid]||{}).s;
    var isOn=(cur===code);
    var cls=bs+' '+atvCls(code)+(isOn?' mark-on':' mark-off');
    return '<button data-act="at-set-mark" data-id="'+esc(sid)+'" data-code="'+esc(code)+'" class="'+cls+'">'+label+'</button>';
  }
  function mkClearBtn(sid){
    return '<button data-act="at-clear-mark" data-id="'+esc(sid)+'" title="נקה סימון" '+
      'class="at-clear-btn clr-btn">✕</button>';
  }

  function renderRow(s, isMark) {
    var marks=S._atMarks[s.id]||{};
    var isLate=marks.s==='l';
    var hasMark=!!(marks.s);
    var cls=s.cls==='a'?'א':s.cls==='b'?'ב':s.cls==='g'?'ג':s.cls||'';
    var autoHintHtml='';
    var am=atAutoMark(s);
    if(am&&isMark&&!S._atCleared[s.id]){
      var aLbl=am==='ap'?'באישור':am==='ak'?'נעדר ידוע':'';
      if(aLbl) autoHintHtml='<span class="mark-hint">('+aLbl+')</span>';
    }
    var isPendingLate=isLate&&!!S._atPending[String(s.id)];
    var lateFieldHtml=isLate?
      '<div class="late-field">'+
        '<input aria-label="דק׳" type="text" inputmode="numeric" maxlength="2" value="'+(marks.min!=null?marks.min:'')+'" id="at-min-'+s.id+'" placeholder="דק׳" '+
        'data-inp="at-late" data-kent="at-late" data-id="'+esc(s.id)+'" '+
        ' class="late-input">'+
        '<span class="unit-hint">דק׳</span>'+
        (isPendingLate?'<button data-act="at-confirm-late" data-id="'+esc(s.id)+'" class="late-ok-btn">✓ אשר</button>':'')+
      '</div>':'';
    var rowBg=isMark?'mark-row-on':'mark-row';
    return '<div class="'+rowBg+' mark-line">'+
      '<div class="at-row-class">'+esc(cls)+'</div>'+
      '<div class="at-row-name">'+esc(s.name)+autoHintHtml+'</div>'+
      lateFieldHtml+
      '<div class="at-row-marks">'+
        (hasMark?mkClearBtn(s.id):'')+
        mkBtn(s.id,'p','✓')+
        mkBtn(s.id,'l','איחור')+
        mkBtn(s.id,'e','-')+
        mkBtn(s.id,'x','x')+
        mkBtn(s.id,'ap','א')+
        mkBtn(s.id,'ak','ב')+
        mkBtn(s.id,'a','ג')+
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
  var student=getStudents().find(function(s){return String(s.id)===String(sid);});
  // אותו חישוב כמו בפתיחת הסדר — לפי תאריך ושעת הסדר ולא לפי השעון
  var curRec=S._atData&&S._atCurrentSessionId?
    S._atData.find(function(r){return idEq(r.id,S._atCurrentSessionId);}):null;
  var sessDateIso=curRec?curRec.date_iso:null;
  var _cfg=S._atCfg||atDefaultCfg();
  var sessObj=curRec?(_cfg.sessions||[]).find(function(s){return s.name===curRec.session;}):null;
  var sessTime=sessObj&&sessObj.startTime?sessObj.startTime:'';
  var autoM=student?atAutoMark(student,sessDateIso,sessTime):null;
  var cur=S._atMarks[sid];
  if(autoM&&cur&&cur.s===autoM&&!S._atCleared[sid]){
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
  if(!S._atMarks[sid])S._atMarks[sid]={s:'l',min:n};
  else S._atMarks[sid].min=n;
  atMarkDirty();
}

async function atCloseSession() {
  clearTimeout(S._atSaveTimer);
  // שמירה וסגירה רק מסמנות open=false — הרשומה כבר נשמרה לאורך הרישום
  var _cRec=S._atData&&S._atData.find(function(r){return idEq(r.id,S._atCurrentSessionId);});
  if(_cRec){_cRec.open=false;}
  await atAutoSaveNow();
  var rec=S._atData&&S._atData.find(function(r){return idEq(r.id,S._atCurrentSessionId);});
  var msg=rec?('✅ '+rec.session+' — '+_hcFmt(rec.date_heb.hy,rec.date_heb.mi,rec.date_heb.day)+' נשמר'):'✅ הסדר נשמר';
  S._atCurrentSessionId=null;
  S._atMarks={};
  S._atPendingRec=null;
  document.getElementById('at-reg-list').classList.add('hidden');
  document.getElementById('at-reg-picker').classList.remove('hidden');
  atRenderTodaySessions();
  toast(msg, null, 'good');
}

export { _atPullCfg, _atPullSessions, _atPullTreats, _atSupMonth, _hrPullStaleMark,
         atAutoMark, atCachedCfg, atCancelStudentStatusFromReg, atClearMark,
         atCloseSession, atConfirmLate, atDefaultCfg, atDow, atEditSession,
         atFillSessionBtns, atFindLiveSession, atLiveTreats, atLoadData, atLoadTreats,
         atOpenSession, atRenderTodaySessions, atSaveCfg, atSaveData, atSaveTreats,
         atSetLateMin, atSetMark, atShowTab, atSortedSessions, atSummaryHtml,
         hrAdoptSession, hrCachedArr, hrRefreshApprovalMarks, loadAttend,
         screenAttendHTML };
