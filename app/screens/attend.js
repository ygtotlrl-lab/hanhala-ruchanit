// app/screens/attend.js — מסך הסדרים: מה ששלושת חלקיו קוראים
import { dayNoon, dayToday } from '../../core/util.js';
import { ctxEpoch, ctxStale, pendTag } from '../../core/sync.js';
import { lsGet, lsSetArray } from '../../core/storage.js';
import { esc, openModal } from '../../core/ui.js';
import { MSG_ABSENCE_ALERT, PK_AT_SESS } from '../constants.js';
import { S } from '../state.js';
import { HE, _hrAtDiskSave, _hrRecTs, _hrSessionsMerge, atvCls, getStudents, hrCfgGet,
         hrCfgLocalGet, hrCfgLocalSet, hrCfgSet, hrCloudGet, hrMarks, hrSetPending,
         hrWriteFail } from '../domain.js';
import { _hcG, _hcH, _hcMN } from '../domain.hebdate.js';
import { _hrDiskArr, hrCachedArr } from '../domain.sessions.js';

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

function atSortedSessions(cfg) {
  if(!cfg) cfg=S._atCfg||atDefaultCfg();
  return (cfg.sessions||[]).slice().sort(function(a,b){
    return HE.compare(a.startTime||'', b.startTime||'');
  });
}

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

function atCheckAlert() {
  var data=(S._atData||[]).filter(function(r){ return !(r && r.deleted); });
  var students=getStudents();
  if(!data.length) return;

  var todH=_hcH(new Date());
  var curHY=todH.hy, curMI=todH.mi;
  // תחילת החודש בחצות מקומית ולא בצהריים — כדי לא לפסול רשומות מה-1 בחודש:
  // new Date('2026-04-28') הוא חצות UTC, 03:00 בישראל, מוקדם מ-12:00 מקומי.
  var _mG=_hcG(curHY,curMI,1);
  var monthBeg=new Date(_mG.getFullYear(),_mG.getMonth(),_mG.getDate(),0,0,0);
  console.log('[attend] atCheckAlert — חודש עברי:', _hcMN(curHY)[curMI], curHY,
    '| תחילת חודש גרגוריאנית:', monthBeg.toISOString(),
    '| רשומות סה"כ:', data.length);

  var alerts=[];
  var stats={};
  students.forEach(function(s){stats[s.id]={name:s.name,absent:0,lateMin:0};});
  data.forEach(function(rec){
    if(new Date(rec.date_iso)<monthBeg) return;
    Object.entries(hrMarks(rec)).forEach(function(e){
      var sid=e[0],m=e[1];
      if(!stats[sid]) return;
      if(m.s==='e'||m.s==='x') stats[sid].absent++;
      if(m.s==='l') stats[sid].lateMin+=m.min||0;
    });
  });
  Object.values(stats).forEach(function(s){
    if(s.absent>=20||s.lateMin>=300) alerts.push(s);
  });
  if(!alerts.length) return;

  var listHtml=alerts.slice(0,10).map(function(s){
    return '<div class="alert-row">'+esc(s.name)+
      (s.absent>=20?'<span class="alert-abs"> — '+s.absent+' חיסורים</span>':'')+
      (s.lateMin>=300?'<span class="alert-late"> — '+s.lateMin+' דק׳ איחור</span>':'')+
      '</div>';
  }).join('');
  openModal(MSG_ABSENCE_ALERT,
    '<p class="alert-lead">התלמידים הבאים חרגו מהסף מתחילת החודש:</p>'+
    '<div class="alert-list">'+listHtml+'</div>',
    '<button data-act="modal-close" class="alert-ok">הבנתי</button>');
}

export { _atPullCfg, _atPullSessions, _atPullTreats, _atSupMonth, atCachedCfg,
         atCheckAlert, atDefaultCfg, atDow, atLiveTreats, atLoadTreats,
         atRenderTodaySessions, atSaveCfg, atSaveTreats, atSortedSessions,
         atSummaryHtml };
