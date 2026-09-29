// app/domain.sessions.js — סדרים ושינה: שני הזרמים, והנתונים ששני המסכים קוראים וכותבים
import { HE_COLLATOR, dayNoon, dayToday } from '../core/util.js';
import { ctxEpoch, ctxStale, idEq, pendConfirmPush, pendMarkMany, pendTag,
         pushTable } from '../core/sync.js';
import { lsGet, lsSetArray } from '../core/storage.js';
import { MIRROR } from '../core/mirror.js';
import { esc } from '../core/ui.js';
import { HEB_DOW } from '../core/hebrew.js';
import { MSG_CLOSE_REPORT_FIRST, MSG_CLOSE_SESSION_FIRST, MSG_DEL_ROW_BODY, MSG_DEL_ROW_TITLE,
         MSG_DEL_SESSION_BODY, MSG_DEL_SESSION_TITLE, MSG_REPORT_DONE, MSG_REPORT_OPEN_ELSEWHERE,
         MSG_SESSION_DONE, MSG_SESSION_OPEN_ELSEWHERE, MSG_SESSION_OPEN_TODAY, MSG_SLEEP_OPEN,
         PK_AT_MARK, PK_AT_SESS, PK_SL_MARK, PK_SL_SESS } from './constants.js';
import { S, shell } from './state.js';
import { HR_MIRROR_STREAMS, _hrCleanCfg, atDefaultCfg, atvCls, getActiveAbsences, getStudents,
         hrCfgGet, hrCfgLocalGet, hrCfgLocalSet, hrCfgSet, hrCount, hrDefaultCfg, hrLocalOfAt,
         hrMarks, hrMirrorPutRecs, hrMirrorRecs, hrRecTs, hrSessionsPull, hrSetPending, hrSyncLog,
         hrTouchLastChanged, hrTreatsMerge, hrWriteFail } from './domain.js';
import { _hcH } from './domain.hebdate.js';

// ── המיון ──
// הגדרות הסדרים — לפי שעת ההתחלה.
function hrSortSessionDefs(list) {
  return list.slice().sort(function (a, b) {
    return HE_COLLATOR.compare(a.start_time || '', b.start_time || '');
  });
}

// רשומות של יום אחד — בסדר הגדרות הסדרים; סדר שאינו בהגדרות יורד לסוף. get מחלץ את הרשומה מהפריט.
function hrSortDayRecs(list, defs, get) {
  var pick = get || function (x) { return x; }, pos = {};
  (defs || []).forEach(function (s, i) { pos[s.name] = i; });
  var at = function (x) { var n = pos[pick(x).session]; return n != null ? n : 999; };
  return list.slice().sort(function (a, b) { return at(a) - at(b); });
}

// שנים וחודשים עבריים בארכיון — האחרון ראשון.
function hrSortHebYears(list) { return list.slice().sort(function (a, b) { return b - a; }); }
function hrSortHebMonths(list) { return list.slice().sort(function (a, b) { return b - a; }); }

// ימי הארכיון, ב-ISO — האחרון ראשון.
function hrSortDays(list) { return list.slice().sort(function (a, b) { return HE_COLLATOR.compare(b, a); }); }

// שורות ההשגחה — החיסורים הרבים ראשונים, ובשוויון — דקות האיחור.
function hrSortAbsenceRows(rows) {
  return rows.slice().sort(function (a, b) {
    return (b[1].absent - a[1].absent) || b[1].lateMin - a[1].lateMin;
  });
}

// טיפולים — האחרון ראשון.
function hrSortTreats(list) {
  return list.slice().sort(function (a, b) {
    return HE_COLLATOR.compare(b.treat_date || '', a.treat_date || '');
  });
}

// פירוט ההשגחה — לפי התאריך, ובתוכו לפי שם הסדר.
function hrSortSupRecords(list) {
  return list.slice().sort(function (a, b) {
    return HE_COLLATOR.compare(a.session_date, b.session_date) || HE_COLLATOR.compare(a.session, b.session);
  });
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

// ── שני הזרמים — הסדרים והשינה ──
// שני המסכים הם קוד אחד, וכל מה שנבדל ביניהם — נתון כאן, בזרם: p — תחילית מזהי ה-DOM ושמות הפעולות,
// v — תחילית מצב הריצה ב-S (_atData · _hrData וכו'), ו-day — היום שהרישום נפתח בו; והקוד שמקבל זרם אינו שואל איזה הוא.
var HR_STREAMS = {
  attend: {
    kind: 'attend', p: 'at', v: '_at', table: 'hr_sessions', child: 'hr_marks',
    pkSess: PK_AT_SESS, pkMark: PK_AT_MARK,
    cfgKey: 'attend_cfg', treatsKey: 'attend_treats', treatsLs: 'hr_attend_treats',
    defaults: atDefaultCfg, clean: function (c) { return c; }, day: dayToday,
    // הסדרים נערכים בהגדרות, ושם גם התראת החיסורים; שורת השינה נושאת הערה
    sessEdit: true, alert: true, note: false,
    title: '✅ שמירת הסדרים', one: 'סדר', many: 'סדרים', xOne: 'היעדרות', xMany: 'היעדרויות', absMany: 'חיסורים',
    openText: ' נפתח היום ולא נסגר.', savedMsg: '✅ הסדר נשמר',
    msg: { closeFirst: MSG_CLOSE_SESSION_FIRST, done: MSG_SESSION_DONE, elsewhere: MSG_SESSION_OPEN_ELSEWHERE,
           openToday: MSG_SESSION_OPEN_TODAY, delTitle: MSG_DEL_SESSION_TITLE, delBody: MSG_DEL_SESSION_BODY },
    sheet: 'סדרים', file: 'sdariim', pdfHead: ['ישיבת תומכי תמימים ראשל"צ', 'ארכיון שמירת סדרים']
  },
  sleep: {
    kind: 'sleep', p: 'sl', v: '_hr', table: 'hr_sleep_sessions', child: 'hr_sleep_marks',
    pkSess: PK_SL_SESS, pkMark: PK_SL_MARK,
    cfgKey: 'sleep_cfg', treatsKey: 'sleep_treats', treatsLs: 'hr_sleep_treats',
    defaults: hrDefaultCfg, clean: _hrCleanCfg, day: hrGetLogicalDate,
    sessEdit: false, alert: false, note: true,
    title: '🌙 זמן שינה', one: 'דו"ח', many: 'דוחות', xOne: 'אירוע', xMany: 'אירועים', absMany: 'אירועים',
    openText: ' נפתחה ולא נסגר.', savedMsg: '✅ הבדיקה נשמרה',
    msg: { closeFirst: MSG_CLOSE_REPORT_FIRST, done: MSG_REPORT_DONE, elsewhere: MSG_REPORT_OPEN_ELSEWHERE,
           openToday: MSG_SLEEP_OPEN, delTitle: MSG_DEL_ROW_TITLE, delBody: MSG_DEL_ROW_BODY },
    sheet: 'שינה', file: 'shinah', pdfHead: ['ארכיון זמן שינה']
  }
};

// תאריך לוגי — לפני 12:00 נחשב הלילה הקודם
function hrGetLogicalDate() {
  if(new Date().getHours()<12) return dayToday(-1);
  return dayToday();
}

function hrDow(isoDate){return HEB_DOW[dayNoon(isoDate).getDay()];}

// תוויות הסימון — אחת לשני הזרמים, ו-x בשם הזרם.
function hrMarkLabels(st) {
  return {p:'נוכח',l:'איחור',e:'חיסור',x:st.xOne,ap:'אישור',ak:'בבית',a:'מנוחה'};
}

// סימון ריק או ממולא — והשינה נושאת גם הערה.
function hrMarkOf(st, status, minutes, note) {
  var m={status:status||'',minutes:minutes||0};
  if(st.note) m.note=note||'';
  return m;
}

// שם סדר ותאריך זהים הם תקלה; הבדיקה חוזרת בנקודת היצירה כי הבדיקה המחזורית יכולה להביא סדר מתחרה אחרי הפתיחה.
// אין אינדקס ייחודי על (session, session_date) — הוא נכשל על זוגות שכבר במסד.
function hrFindLiveSession(data, sessName, dateIso, exceptId) {
  if (!Array.isArray(data)) return null;
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!r || r.deleted) continue;
    if (r.session !== sessName || r.session_date !== dateIso) continue;
    if (exceptId != null && idEq(r.client_id, exceptId)) continue;
    return r;
  }
  return null;
}

// אימוץ סדר קיים: הסימונים הקיימים נטענים תחילה, וסימון מקומי גובר עליהם —
// השמירה בונה את marks מחדש מהסימונים שבזיכרון, ואימוץ בלי טעינה היה מוחק את סימוני המכשיר האחר.
function hrAdoptSession(st, rec) {
  var ex = hrMarks(rec), marks = S[st.v+'Marks'];
  Object.keys(ex).forEach(function (k) {
    var cur = marks[k];
    if (!cur || !cur.status) marks[k] = hrMarkOf(st, ex[k] && ex[k].status, ex[k] && ex[k].minutes, ex[k] && ex[k].note);
  });
  S[st.v+'CurrentSessionId'] = rec.client_id;
}

// sessDateIso אופציונלי — בלעדיו אישורים תמיד פעילים
function hrAutoMark(student, sessDateIso, sessStartTime) {
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
      var fromL=hrLocalOfAt(aa[i].from_at), toL=hrLocalOfAt(aa[i].to_at);
      var fromDate=fromL?fromL.split('T')[0]:'';
      var toDate=toL?toL.split('T')[0]:'';
      if(fromDate&&sessDateIso<fromDate) continue;
      if(toDate&&sessDateIso>toDate) continue;
      // ביום הגבול נבדקת גם השעה — אחרת מסומנים סדרים שלפני תחילת האישור או אחרי סיומו
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

async function hrLoadData(st) {
  if (S[st.v+'Data']) return S[st.v+'Data'];
  var v=await hrSessionsPull(st.table); if(Array.isArray(v)){S[st.v+'Data']=v;return v;}
  var disk=hrMirrorRecs(st.table);
  if(Array.isArray(disk)){S[st.v+'Data']=disk;return disk;}
  S[st.v+'Data']=[]; return S[st.v+'Data'];
}

// אין ניקוי רשומות לפי שם הסדר — סדר לגיטימי באותו שם נמחק,
// והשמירה ממזגת עם הענן, כך שהמנוקות חוזרות מיד; מחיקה היא tombstone מפורש בלבד.
async function hrSaveData(st, data) {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  // t0 נלקח לפני קריאת המצב — אישור של רשומה שסומנה אחריו היה מוריד סימון מרשומה שלא עלתה
  var _t0=Date.now();
  S[st.v+'Data']=data;
  hrMirrorPutRecs(st.table, data);
  try {
    // מיזוג עם הענן לפני הדחיפה — אחרת נדרסות רשומות של מכשיר אחר
    var localN=hrCount(data);
    var merged=await hrSessionsPull(st.table);
    if (ctxStale(_ep)) return;
    if (Array.isArray(merged)) { data=merged; S[st.v+'Data']=data; }
    // מערך ריק אינו כישלון אלא «אין מה לדחוף»; כתיבה שנכשלה נשארת ממתינה ונוסית שוב — האב לפני הבן
    var rS=await pushTable(st.table);
    var rM=await pushTable(st.child);
    // רק כתיבה שהצליחה היא ראיה — והיא מזינה גם את הסימון הממתין וגם את עֵד הפינוי שבליבה
    if(rS&&rS.ok&&!ctxStale(_ep)) pendConfirmPush(st.pkSess,_t0);
    if(rM&&rM.ok&&!ctxStale(_ep)) pendConfirmPush(st.pkMark,_t0);
    hrSyncLog('push',st.table,hrCount(data),{local_count:localN,result_count:hrCount(data)});
    await hrTouchLastChanged();
  } catch (e) { hrWriteFail('hrSaveData:'+st.kind, e); }
}

// נקרא אחרי הוספה, עריכה או מחיקה של אישור או היעדרות.
// מעדכן רק סימון ריק או ap — סימון ידני אינו נדרס.
async function hrRefreshApprovalMarks(sid) {
  try {
    var student = getStudents().find(function(x){ return idEq(x.client_id, sid); });
    if (!student) return;
    var sidKey = String(sid);
    // קריאה בנקודת הדיסק האחת ובלי כתיבה — השמירה היא hrSaveData, ומפתח שטוח כאן היה מקור אמת שני
    Object.keys(HR_STREAMS).forEach(function (kind) {
      var st = HR_STREAMS[kind], dateIso = st.day();
      var cfgS = (S[st.v+'Cfg'] && Array.isArray(S[st.v+'Cfg'].sessions)) ? S[st.v+'Cfg'].sessions : [];
      var curId = S[st.v+'CurrentSessionId'], buf = S[st.v+'Marks'];
      var data = _hrDiskArr(st.table);
      if (!Array.isArray(data)) return;
      var changed = [];
      data.forEach(function(rec){
        if (!rec || rec.deleted || !rec.open || rec.session_date !== dateIso) return;
        var cur = (rec.marks && rec.marks[sidKey]) ? (rec.marks[sidKey].status || '') : '';
        if (cur !== '' && cur !== 'ap') return;
        var sessTime = '';
        for (var i = 0; i < cfgS.length; i++) { if (cfgS[i].name === rec.session) { sessTime = cfgS[i].start_time || ''; break; } }
        var am = hrAutoMark(student, rec.session_date, sessTime);
        var next = (am === 'ap') ? 'ap' : '';
        if (next === cur) return;
        if (!rec.marks) rec.marks = {};
        rec.marks[sidKey] = hrMarkOf(st, next, 0, '');
        rec.updated_at = Date.now();
        changed.push(st.pkSess + rec.client_id);
        // סדר שפתוח כרגע במכשיר הזה — מעדכנים גם את הסימונים שבזיכרון ואת התצוגה
        if (curId === rec.client_id && buf) {
          if (next) buf[sidKey] = hrMarkOf(st, next, 0, '');
          else delete buf[sidKey];
          try { shell.hrRenderStudents(st); } catch(eR) {}
        }
      });
      if (changed.length) {
        // הסימון לפני השמירה — הדחיפה לוכדת t0 בכניסה, ורק סימון שקדם לו מאושר בהצלחתה
        pendMarkMany(changed);
        try { hrSaveData(st, data); } catch (eS) { hrWriteFail('hrRefreshApprovalMarks', eS); }
      }
    });
  } catch(e) { console.warn('[approval-refresh]', e); }
}

// ── מה ששלושת חלקי המסך קוראים ──
function hrSummaryHTML(st, cnts){
  var parts=[];
  var add=function(n,lbl,code){if(n)parts.push('<span class="'+atvCls(code)+' at-count">'+n+' '+lbl+'</span>');};
  add(cnts.p||0,  'נוכחים',   'p');
  add(cnts.e||0,  'חיסורים',  'e');
  add(cnts.x||0,  st.xMany,   'x');
  add(cnts.l||0,  'איחורים',  'l');
  add(cnts.ap||0, 'אישורים',  'ap');
  add(cnts.ak||0, 'בבית',     'ak');
  add(cnts.a||0,  'מנוחה',    'a');
  return parts.join('<span class="user-handle"> | </span>');
}

// מחזירה האם הענן ענה ולא את הנתון — hrLoadData נופלת לדיסק ומחזירה מערך גם בכשל.
// השמירה לדיסק ממזגת ואינה דורסת — רשומה שנרשמה אופליין וטרם עלתה הייתה נמחקת.
// מסלול בלי חלון מוסר null במפורש — השמטת החלון מושכת את הטבלה כולה.
async function hrPullSessions(st, win) {
  var out = await hrSessionsPull(st.table, win);
  if (!Array.isArray(out)) return false;
  S[st.v+'Data'] = out;
  return true;
}

async function hrPullCfg(st) {
  var r = null; try { r = await hrCfgGet(st.cfgKey, true); } catch (e) {}
  if (!r || !r.ok) return false;
  if (r.value && !hrSetPending(st.cfgKey)) { S[st.v+'Cfg'] = st.clean(r.value); hrCfgLocalSet(st.cfgKey, S[st.v+'Cfg']); }
  return true;
}

async function hrPullTreats(st) {
  var r = null; try { r = await hrCfgGet(st.treatsKey, true); } catch (e) {}
  if (!r || !r.ok) return false;
  // מפתח שטרם נכתב אינו דורס את הדיסק — [] מעליו היה מוחק טיפולים שנרשמו אופליין וטרם עלו
  if (Array.isArray(r.value) && !hrSetPending(st.treatsKey)) { S[st.v+'Treats'] = r.value; lsSetArray(st.treatsLs, r.value, hrRecTs); }
  else if (!Array.isArray(S[st.v+'Treats'])) S[st.v+'Treats'] = hrCachedArr(st.v+'Treats', st.treatsLs) || [];
  return true;
}

// אתחול החודש הנצפה בנקודה אחת — המשיכה שקודמת לציור צריכה לדעת איזה חודש להביא
function hrSupMonth(st) {
  if (S[st.v+'SupHY'] === null) {
    var ch = _hcH(new Date());
    S[st.v+'SupHY'] = ch.hy; S[st.v+'SupMI'] = ch.mi;
  }
  return S[st.v+'SupHY'];
}

// ההגדרות בזיכרון, ובהיעדרן — ברירת המחדל של הזרם; ברירת המחדל אינה נכתבת.
function hrCfgOf(st) { return S[st.v+'Cfg'] || st.defaults(); }

// סינכרונית — הציור הראשון אינו ממתין לרשת, וההגדרות קובעות אילו כפתורי סדר להציג
// העותק נקרא ואינו נכתב כברירת מחדל — ברירת מחדל שנכתבת הייתה מסמנת «נטען», והמשיכה לא הייתה מחליפה אותה
function hrCachedCfg(st) {
  if (S[st.v+'Cfg']) return S[st.v+'Cfg'];
  try { var p=hrCfgLocalGet(st.cfgKey); if(p){ S[st.v+'Cfg']=st.clean(p); return S[st.v+'Cfg']; } } catch(e){}
  return null;
}

async function hrSaveCfg(st, cfg) {
  S[st.v+'Cfg']=cfg;
  return hrCfgSet(st.cfgKey,cfg);
}

async function hrLoadTreats(st) {
  // התוצאה נשמרת בזיכרון — הציור הראשון של ההשגחה קורא ממנה בלי להמתין לרשת.
  // רשימה שממתינה לסנכרון נקראת מהמכשיר — הענן טרם קיבל אותה.
  if (!hrSetPending(st.treatsKey)) try { var v=await hrCfgGet(st.treatsKey); if(Array.isArray(v)){S[st.v+'Treats']=v;return v;} } catch(e){}
  try { var lc=lsGet(st.treatsLs); if(lc){var p=JSON.parse(lc); if(Array.isArray(p)){S[st.v+'Treats']=p;return p;}} } catch(e){}
  return [];
}

function hrLiveTreats(arr) { return (Array.isArray(arr)?arr:[]).filter(function(t){ return t && !t.deleted; }); }

async function hrSaveTreats(st, data) {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  lsSetArray(st.treatsLs, data, hrRecTs);
  try {
    // מיזוג ברמת רשומה לפני הכתיבה — כתיבת המערך כולו מוחקת טיפול שמדריך אחר רשם במקביל
    var remote=null; try { remote=await hrCfgGet(st.treatsKey); } catch(eR){}
    if (Array.isArray(remote)) {
      data=hrTreatsMerge(remote, data, st.treatsLs);
      lsSetArray(st.treatsLs, data, hrRecTs);
    }
    if (!ctxStale(_ep)) await hrCfgSet(st.treatsKey,data);
  } catch (e) { hrWriteFail('hrSaveTreats:'+st.kind, e); }
  S[st.v+'Treats']=data;
  return data;
}

function hrSessionDefs(st, cfg) {
  return hrSortSessionDefs((cfg||hrCfgOf(st)).sessions||[]);
}

// ברשימת היום: היום — «היום», והיום הלוגי שאינו היום (השינה לפני הצהריים) — «אמש».
function hrRenderTodaySessions(st) {
  var el=document.getElementById(st.p+'-today-sessions');
  if(!el) return;
  var data=S[st.v+'Data']||[];
  var selIso=(document.getElementById(st.p+'_date_iso')||{}).value;
  var logIso=st.day();
  var filterIso=selIso||logIso;
  var isToday=filterIso===dayToday();
  var isLogical=filterIso===logIso;
  var daySess=hrSortDayRecs(data.filter(function(r){return !r.deleted&&r.session_date===filterIso;}),
    hrSessionDefs(st));
  if(!daySess.length){el.innerHTML='';return;}
  var dowLabel=isToday?'היום':(isLogical?'אמש':'יום '+hrDow(filterIso));
  var html='<div class="day-sess-block">'+
    '<div class="day-sess-title">📋 '+st.many+' שמולאו '+dowLabel+':</div>'+
    '<div class="reason-list">';
  daySess.forEach(function(rec){
    var cnts={};
    Object.values(hrMarks(rec)).forEach(function(m){if(m.status)cnts[m.status]=(cnts[m.status]||0)+1;});
    html+='<div data-act="'+st.p+'-edit-session" data-id="'+esc(rec.client_id)+'" class="day-sess-row">'+
      '<span class="day-sess-name">'+esc(rec.session)+'</span>'+
      pendTag(st.pkSess+rec.client_id)+
      '<div class="day-sess-summary">'+hrSummaryHTML(st, cnts)+'</div>'+
      '<span class="day-sess-edit">✏️ ערוך</span>'+
    '</div>';
  });
  html+='</div></div>';
  el.innerHTML=html;
}

export { HR_STREAMS, _hrDiskArr, _hrPullStaleMark, hrAdoptSession, hrAutoMark, hrCachedArr, hrCachedCfg,
         hrCfgOf, hrDow, hrFindLiveSession, hrGetLogicalDate, hrLiveTreats, hrLoadData, hrLoadTreats,
         hrMarkLabels, hrMarkOf, hrPullCfg, hrPullSessions, hrPullTreats, hrRefreshApprovalMarks,
         hrRenderTodaySessions, hrSaveCfg, hrSaveData, hrSaveTreats, hrSessionDefs, hrSortAbsenceRows,
         hrSortDayRecs, hrSortDays, hrSortHebMonths, hrSortHebYears, hrSortSessionDefs,
         hrSortSupRecords, hrSortTreats, hrSummaryHTML, hrSupMonth };
