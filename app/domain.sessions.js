// app/domain.sessions.js — סדרים ושינה: הנתונים ששני המסכים קוראים וכותבים
import { dayToday } from '../core/util.js';
import { ctxEpoch, ctxStale, idEq, pendConfirmPush, pendMarkMany,
         pushTable } from '../core/sync.js';
import { lsGet } from '../core/storage.js';
import { MIRROR } from '../core/mirror.js';
import { PK_AT_SESS, PK_SL_SESS } from './constants.js';
import { S, shell } from './state.js';
import { HR_MIRROR_STREAMS, _hrAtDiskSave, _hrSessionsMerge, _hrSlDiskSave,
         getActiveAbsences, getStudents, hrCloudGet, hrCount, hrMarks, hrMirrorRecs,
         hrSyncLog, hrTouchLastChanged, hrWriteFail } from './domain.js';

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

function hrAdoptSession(rec) {
  var ex = hrMarks(rec);
  Object.keys(ex).forEach(function (k) {
    var cur = S._hrMarks[k];
    if (!cur || !cur.s) S._hrMarks[k] = { s: (ex[k] && ex[k].s) || '', min: (ex[k] && ex[k].min) || 0, note: (ex[k] && ex[k].note) || '' };
  });
  S._hrCurrentSessionId = rec.id;
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

async function hrLoadData() {
  if (S._hrData) return S._hrData;
  try { var v=await hrCloudGet('hr_sleep_sessions'); if(Array.isArray(v)){S._hrData=v;return v;} } catch(e){}
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
    // מיזוג עם הענן לפני הכתיבה — אחרת נדרסות רשומות של מכשיר אחר
    var _hrLocalN=hrCount(data);
    var _hrRemote=null; try { _hrRemote=await hrCloudGet('hr_sleep_sessions'); } catch(eR){}
    if (Array.isArray(_hrRemote)) {
      data=_hrSessionsMerge(_hrRemote, data, 'hr_sleep_sessions');
      S._hrData=data;
      _hrSlDiskSave(data);
    }
    // מערך ריק אינו כישלון אלא «אין מה לדחוף»; כתיבה שנכשלה נשארת ממתינה ונוסית שוב
    var _rSl=await pushTable('hr_sleep_sessions',data);
    if(_rSl&&_rSl.ok&&!ctxStale(_ep)) pendConfirmPush(PK_SL_SESS,_t0);
    hrSyncLog('push','hr_sleep_sessions',hrCount(data),{local_count:_hrLocalN,remote_count:hrCount(_hrRemote),result_count:hrCount(data)});
    await hrTouchLastChanged();
  } catch (e) { hrWriteFail('hrSaveData', e); }
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
         hrRefreshApprovalMarks, hrSaveData };
