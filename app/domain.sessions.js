// app/domain.sessions.js — סדרים ושינה: הנתונים ששני המסכים קוראים וכותבים
import { HE_COLLATOR, dayToday } from '../core/util.js';
import { ctxEpoch, ctxStale, idEq, pendConfirmPush, pendMarkMany,
         pushTable } from '../core/sync.js';
import { lsGet } from '../core/storage.js';
import { MIRROR } from '../core/mirror.js';
import { PK_AT_MARK, PK_AT_SESS, PK_SL_MARK, PK_SL_SESS } from './constants.js';
import { S, shell } from './state.js';
import { HR_MIRROR_STREAMS, _hrAtDiskSave, _hrSlDiskSave, getActiveAbsences, getStudents,
         hrCount, hrLocalOfAt, hrMarks, hrMirrorRecs, hrSessionsPull, hrSyncLog,
         hrTouchLastChanged, hrWriteFail } from './domain.js';

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

// שם סדר ותאריך זהים הם תקלה; הבדיקה חוזרת בנקודת היצירה כי הבדיקה המחזורית יכולה להביא סדר מתחרה אחרי הפתיחה.
// אין אינדקס ייחודי על (session, session_date) — הוא נכשל על זוגות שכבר במסד; הבדיקה משרתת גם את השינה.
function atFindLiveSession(data, sessName, dateIso, exceptId) {
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

function hrAdoptSession(rec) {
  var ex = hrMarks(rec);
  Object.keys(ex).forEach(function (k) {
    var cur = S._hrMarks[k];
    if (!cur || !cur.status) S._hrMarks[k] = { status: (ex[k] && ex[k].status) || '', minutes: (ex[k] && ex[k].minutes) || 0, note: (ex[k] && ex[k].note) || '' };
  });
  S._hrCurrentSessionId = rec.client_id;
}

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

async function atLoadData() {
  if (S._atData) return S._atData;
  var v=await hrSessionsPull('hr_sessions'); if(Array.isArray(v)){S._atData=v;return v;}
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
    // מיזוג עם הענן לפני הדחיפה — אחרת נדרסות רשומות של מכשיר אחר
    var _atLocalN=hrCount(data);
    var _atMerged=await hrSessionsPull('hr_sessions');
    if (ctxStale(_ep)) return;
    if (Array.isArray(_atMerged)) { data=_atMerged; S._atData=data; }
    // מערך ריק אינו כישלון אלא «אין מה לדחוף»; כתיבה שנכשלה נשארת ממתינה ונוסית שוב — האב לפני הבן
    var _rAt=await pushTable('hr_sessions');
    var _rAm=await pushTable('hr_marks');
    // רק כתיבה שהצליחה היא ראיה — והיא מזינה גם את הסימון הממתין וגם את _hrPushedAt
    if(_rAt&&_rAt.ok&&!ctxStale(_ep)) pendConfirmPush(PK_AT_SESS,_t0);
    if(_rAm&&_rAm.ok&&!ctxStale(_ep)) pendConfirmPush(PK_AT_MARK,_t0);
    hrSyncLog('push','hr_sessions',hrCount(data),{local_count:_atLocalN,result_count:hrCount(data)});
    await hrTouchLastChanged();
  } catch (e) { hrWriteFail('atSaveData', e); }
}

async function hrLoadData() {
  if (S._hrData) return S._hrData;
  var v=await hrSessionsPull('hr_sleep_sessions'); if(Array.isArray(v)){S._hrData=v;return v;}
  var _hrDisk=hrMirrorRecs('hr_sleep_sessions');
  if(Array.isArray(_hrDisk)){S._hrData=_hrDisk;return S._hrData;}
  S._hrData=[]; return S._hrData;
}

// אין ניקוי רשומות לפי שם הסדר — סדר לגיטימי באותו שם נמחק,
// ו-hrSaveData ממזג עם הענן, כך שהמנוקות חוזרות מיד; מחיקה היא tombstone מפורש בלבד.
async function hrSaveData(data) {
  // משתמש שהתחלף באמצע היה מקבל לחשבונו את הרישום שאחרי ה-await.
  var _ep = ctxEpoch();
  var _t0=Date.now(); // לפני הכתיבה — עריכה שנעשית באמצע אינה נזקפת לדחיפה הזו
  S._hrData=data;
  _hrSlDiskSave(data);
  try {
    // מיזוג עם הענן לפני הדחיפה — אחרת נדרסות רשומות של מכשיר אחר
    var _hrLocalN=hrCount(data);
    var _hrMerged=await hrSessionsPull('hr_sleep_sessions');
    if (ctxStale(_ep)) return;
    if (Array.isArray(_hrMerged)) { data=_hrMerged; S._hrData=data; }
    // מערך ריק אינו כישלון אלא «אין מה לדחוף»; כתיבה שנכשלה נשארת ממתינה ונוסית שוב — האב לפני הבן
    var _rSl=await pushTable('hr_sleep_sessions');
    var _rSm=await pushTable('hr_sleep_marks');
    if(_rSl&&_rSl.ok&&!ctxStale(_ep)) pendConfirmPush(PK_SL_SESS,_t0);
    if(_rSm&&_rSm.ok&&!ctxStale(_ep)) pendConfirmPush(PK_SL_MARK,_t0);
    hrSyncLog('push','hr_sleep_sessions',hrCount(data),{local_count:_hrLocalN,result_count:hrCount(data)});
    await hrTouchLastChanged();
  } catch (e) { hrWriteFail('hrSaveData', e); }
}

// נקרא אחרי הוספה, עריכה או מחיקה של אישור או היעדרות.
// מעדכן רק סימון ריק או ap — סימון ידני אינו נדרס.
async function hrRefreshApprovalMarks(sid) {
  try {
    var student = getStudents().find(function(x){ return idEq(x.client_id, sid); });
    if (!student) return;
    var sidKey = String(sid);
    var todayIso = dayToday();

    // קריאה בנקודת הדיסק האחת ובלי כתיבה — השמירה היא saveFn, ומפתח שטוח כאן היה מקור אמת שני
    function refreshSet(lsKey, pk, cfgSessions, dateIso, curId, marksBuf, renderFn, saveFn, withNote) {
      var data = _hrDiskArr(lsKey);
      if (!Array.isArray(data)) return;
      var changed = [];
      data.forEach(function(rec){
        if (!rec || rec.deleted || !rec.open || rec.session_date !== dateIso) return;
        var cur = (rec.marks && rec.marks[sidKey]) ? (rec.marks[sidKey].status || '') : '';
        if (cur !== '' && cur !== 'ap') return;
        var sessTime = '';
        for (var i = 0; i < cfgSessions.length; i++) { if (cfgSessions[i].name === rec.session) { sessTime = cfgSessions[i].start_time || ''; break; } }
        var am = atAutoMark(student, rec.session_date, sessTime);
        var next = (am === 'ap') ? 'ap' : '';
        if (next === cur) return;
        if (!rec.marks) rec.marks = {};
        rec.marks[sidKey] = withNote ? { status: next, minutes: 0, note: '' } : { status: next, minutes: 0 };
        rec.updated_at = Date.now();
        changed.push(pk + rec.client_id);
        // סדר שפתוח כרגע במכשיר הזה — מעדכנים גם את ה-buffer ואת התצוגה
        if (curId === rec.client_id && marksBuf) {
          if (next) marksBuf[sidKey] = withNote ? { status: next, minutes: 0, note: '' } : { status: next, minutes: 0 };
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
    refreshSet('hr_sessions', PK_AT_SESS, atCfg, todayIso, S._atCurrentSessionId, S._atMarks, shell.atRenderStudents, function(d){ S._atData = d; atSaveData(d); }, false);

    var hrCfg = (S._hrCfg && Array.isArray(S._hrCfg.sessions)) ? S._hrCfg.sessions : [];
    var hrIso = (typeof hrGetLogicalDate === 'function') ? hrGetLogicalDate() : todayIso;
    refreshSet('hr_sleep_sessions', PK_SL_SESS, hrCfg, hrIso, S._hrCurrentSessionId, S._hrMarks, shell.hrRenderStudents, function(d){ S._hrData = d; hrSaveData(d); }, true);
  } catch(e) { console.warn('[approval-refresh]', e); }
}

// תאריך לוגי — לפני 12:00 נחשב הלילה הקודם
function hrGetLogicalDate() {
  if(new Date().getHours()<12) return dayToday(-1);
  return dayToday();
}

export { _hrDiskArr, _hrPullStaleMark, atAutoMark, atFindLiveSession, atLoadData,
         atSaveData, hrAdoptSession, hrCachedArr, hrGetLogicalDate, hrLoadData,
         hrRefreshApprovalMarks, hrSaveData, hrSortAbsenceRows, hrSortDayRecs, hrSortDays,
         hrSortHebMonths, hrSortHebYears, hrSortSessionDefs, hrSortSupRecords,
         hrSortTreats };
