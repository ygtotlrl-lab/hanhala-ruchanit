// app/screens/sleep.js — מסך השינה: מה ששלושת חלקיו קוראים
import { dayNoon, dayToday } from '../../core/util.js';
import { ctxEpoch, ctxStale, pendTag } from '../../core/sync.js';
import { lsGet, lsSetArray } from '../../core/storage.js';
import { esc } from '../../core/ui.js';
import { PK_SL_SESS } from '../constants.js';
import { S } from '../state.js';
import { HE, _hrCleanCfg, hrRecTs, _hrSessionsMerge, _hrSlDiskSave, atvCls, hrCfgGet,
         hrCfgLocalGet, hrCfgLocalSet, hrCfgSet, hrCloudGet, hrDefaultCfg, hrMarks,
         hrMirrorRecs, hrSetPending, hrWriteFail } from '../domain.js';
import { _hcH } from '../domain.hebdate.js';
import { hrCachedArr, hrGetLogicalDate } from '../domain.sessions.js';

var HR_DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function hrDow(isoDate){return HR_DOW[dayNoon(isoDate).getDay()];}

function hrSummaryHtml(cnts){
  var parts=[];
  var add=function(n,lbl,code){if(n)parts.push('<span class="'+atvCls(code)+' at-count">'+n+' '+lbl+'</span>');};
  add(cnts.p||0,  'נוכחים',   'p');
  add(cnts.e||0,  'חיסורים',  'e');
  add(cnts.x||0,  'אירועים',  'x');
  add(cnts.l||0,  'איחורים',  'l');
  add(cnts.ap||0, 'אישורים',  'ap');
  add(cnts.ak||0, 'בבית',     'ak');
  add(cnts.a||0,  'מנוחה',    'a');
  return parts.join('<span class="user-handle"> | </span>');
}

async function _hrPullSessions(win) {
  var v = null; try { v = await hrCloudGet('hr_sleep_sessions', win); } catch (e) {}
  if (!Array.isArray(v)) return false;
  var loc = hrMirrorRecs('hr_sleep_sessions');
  var out = loc ? _hrSessionsMerge(v, loc, 'hr_sleep_sessions') : v;
  S._hrData = out; _hrSlDiskSave(out);
  return true;
}

async function _hrPullCfg() {
  var r = null; try { r = await hrCfgGet('sleep_cfg', true); } catch (e) {}
  if (!r || !r.ok) return false;
  if (r.value && !hrSetPending('sleep_cfg')) { S._hrCfg = _hrCleanCfg(r.value); hrCfgLocalSet('sleep_cfg', S._hrCfg); }
  return true;
}

async function _hrPullTreats() {
  var r = null; try { r = await hrCfgGet('sleep_treats', true); } catch (e) {}
  if (!r || !r.ok) return false;
  // מפתח שטרם נכתב אינו דורס את הדיסק — [] מעליו היה מוחק טיפולים שנרשמו אופליין וטרם עלו
  if (Array.isArray(r.value) && !hrSetPending('sleep_treats')) { S._hrTreats = r.value; lsSetArray('hr_sleep_treats', r.value, hrRecTs); }
  else if (!Array.isArray(S._hrTreats)) S._hrTreats = hrCachedArr('_hrTreats', 'hr_sleep_treats') || [];
  return true;
}

function _hrSupMonth() {
  if (S._hrSupHY === null) {
    var ch = _hcH(new Date());
    S._hrSupHY = ch.hy; S._hrSupMI = ch.mi;
  }
  return S._hrSupHY;
}

// סינכרונית — הציור הראשון אינו ממתין לרשת, וההגדרות קובעות אילו כפתורי סדר להציג
function hrCachedCfg() {
  if (S._hrCfg) return S._hrCfg;
  try { var p=hrCfgLocalGet('sleep_cfg'); if(p){ S._hrCfg=_hrCleanCfg(p); return S._hrCfg; } } catch(e){}
  return null;
}

async function hrSaveCfg(cfg) {
  S._hrCfg=cfg;
  return hrCfgSet('sleep_cfg',cfg);
}

async function hrLoadTreats() {
  // התוצאה נשמרת בזיכרון — הציור הראשון של ההשגחה קורא ממנה בלי להמתין.
  // רשימה שממתינה לסנכרון נקראת מהמכשיר — הענן טרם קיבל אותה.
  if (!hrSetPending('sleep_treats')) try { var v=await hrCfgGet('sleep_treats'); if(Array.isArray(v)){S._hrTreats=v;return v;} } catch(e){}
  try { var lc=lsGet('hr_sleep_treats'); if(lc){var p=JSON.parse(lc); if(Array.isArray(p)){S._hrTreats=p;return p;}} } catch(e){}
  return [];
}

function hrLiveTreats(arr) { return (Array.isArray(arr)?arr:[]).filter(function(t){ return t && !t.deleted; }); }

async function hrSaveTreats(data) {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  var _t0=Date.now();
  lsSetArray('hr_sleep_treats', data, hrRecTs);
  try {
    // מיזוג ברמת רשומה ולא דריסה — דריסה מוחקת טיפול שנרשם במכשיר אחר
    var _tRemoteS=null; try { _tRemoteS=await hrCfgGet('sleep_treats'); } catch(eR){}
    if (Array.isArray(_tRemoteS)) {
      data=_hrSessionsMerge(_tRemoteS, data, 'hr_sleep_treats');
      lsSetArray('hr_sleep_treats', data, hrRecTs);
    }
    if (!ctxStale(_ep)) await hrCfgSet('sleep_treats',data);
  } catch (e) { hrWriteFail('hrSaveTreats', e); }
  S._hrTreats=data;
  return data;
}

function hrSortedSessions(cfg) {
  if(!cfg) cfg=S._hrCfg||hrDefaultCfg();
  return (cfg.sessions||[]).slice().sort(function(a,b){
    return HE.compare(a.start_time||'', b.start_time||'');
  });
}

function hrRenderTodaySessions() {
  var el=document.getElementById('sl-today-sessions');
  if(!el) return;
  var data=S._hrData||[];
  var selIso=(document.getElementById('sl_date_iso')||{}).value;
  var logIso=hrGetLogicalDate();
  var filterIso=selIso||logIso;
  var isToday=filterIso===dayToday();
  var isLogical=filterIso===logIso;
  var cfg=S._hrCfg||hrDefaultCfg();
  var sessOrder={};
  hrSortedSessions(cfg).forEach(function(s,i){sessOrder[s.name]=i;});
  var daySess=data.filter(function(r){return !r.deleted&&r.session_date===filterIso;})
    .slice().sort(function(a,b){
      var ia=sessOrder[a.session]!=null?sessOrder[a.session]:999;
      var ib=sessOrder[b.session]!=null?sessOrder[b.session]:999;
      return ia-ib;
    });
  if(!daySess.length){el.innerHTML='';return;}
  var dowLabel=isToday?'היום':(isLogical&&!isToday?'אמש':'יום '+hrDow(filterIso));
  var html='<div class="day-sess-block">'+
    '<div class="day-sess-title">📋 דוחות שמולאו '+dowLabel+':</div>'+
    '<div class="reason-list">';
  daySess.forEach(function(rec){
    var cnts={};
    Object.values(hrMarks(rec)).forEach(function(m){if(m.status)cnts[m.status]=(cnts[m.status]||0)+1;});
    var summaryHtml=hrSummaryHtml(cnts);
    html+='<div data-act="sl-edit-session" data-id="'+esc(rec.client_id)+'" class="day-sess-row">'+
      '<span class="day-sess-name">'+esc(rec.session)+'</span>'+
      pendTag(PK_SL_SESS+rec.client_id)+
      '<div class="day-sess-summary">'+summaryHtml+'</div>'+
      '<span class="day-sess-edit">✏️ ערוך</span>'+
    '</div>';
  });
  html+='</div></div>';
  el.innerHTML=html;
}

export { _hrPullCfg, _hrPullSessions, _hrPullTreats, _hrSupMonth, hrCachedCfg, hrDow,
         hrLiveTreats, hrLoadTreats, hrRenderTodaySessions, hrSaveCfg, hrSaveTreats,
         hrSortedSessions, hrSummaryHtml };
