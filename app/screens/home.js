// app/screens/home.js — מסך הראשי
import { dayToday } from '../../core/util.js';
import { S, shell } from '../state.js';
import { getStudents, hrAwayAbsences, hrDayWin, hrMarks, hrMirrorRecs, hrStudentsPull } from '../domain.js';
import { HR_STREAMS, hrIsLate, hrPullSessions } from '../domain.sessions.js';
import { icon } from '../icons.js';
import { hrStudentOn } from '../domain.periods.js';
import { statsHomeHTML } from './stats.js';

function screenHomeHTML() {
  return `
<div class="pg on" id="pg-home">
  <div class="kpi-wrap">
    <div class="mods-lbl">היום</div>
    <div class="kpis">
      <div class="kpi kpi-brand"><div class="kpi-top"><span class="kpi-l">תלמידים רשומים</span><span class="kpi-ic">${icon('students')}</span></div><div class="kpi-n" id="s-tot">–</div><div class="kpi-sub">פעילים במצבה</div></div>
      <div class="kpi kpi-ok"><div class="kpi-top"><span class="kpi-l">נוכחים בישיבה</span><span class="kpi-ic">${icon('check')}</span></div><div class="kpi-n" id="s-pre">–</div><div class="kpi-sub" id="s-pre-sub">&nbsp;</div></div>
      <div class="kpi kpi-bad"><div class="kpi-top"><span class="kpi-l">חיסורים בסדרים</span><span class="kpi-ic">${icon('close')}</span></div><div class="kpi-n" id="s-abs">–</div><div class="kpi-sub" id="s-abs-sub">&nbsp;</div></div>
      <div class="kpi kpi-info"><div class="kpi-top"><span class="kpi-l">נוכחות בסדרים</span><span class="kpi-ic">${icon('reports')}</span></div><div class="kpi-n" id="s-rate">–</div><div class="kpi-sub">מתוך מי שסומן</div></div>
    </div>
  </div>
  ${statsHomeHTML()}
  <div class="mods-wrap">
    <div class="mods-lbl">מודולים</div>
    <div class="mods">
      <button class="mod mod-tone-brand" data-pg="students" data-act="page" data-page="students"><div class="mod-ic">${icon('students')}</div><div class="mod-info"><div class="mod-name">מצבת התלמידים</div><div class="mod-desc">רשימת תלמידים, פרטים אישיים, ניהול ועריכה</div></div></button>
      <button class="mod mod-tone-brand" data-pg="attend" data-act="page" data-page="attend"><div class="mod-ic">${icon('attend')}</div><div class="mod-info"><div class="mod-name">שמירת הסדרים</div><div class="mod-desc">רישום נוכחות יומית לשיעורים וסדרי לימוד</div></div></button>
      <button class="mod mod-tone-brand" data-pg="sleep" data-act="page" data-page="sleep"><div class="mod-ic">${icon('sleep')}</div><div class="mod-info"><div class="mod-name">זמן שינה</div><div class="mod-desc">מעקב שעות שינה וכיבוי אורות</div></div></button>
      <button class="mod mod-tone-brand" data-pg="exams" data-act="page" data-page="exams"><div class="mod-ic">${icon('exams')}</div><div class="mod-info"><div class="mod-name">מבחנים</div><div class="mod-desc">ניהול בחינות, ציונים ותוצאות</div></div></button>
      <button class="mod mod-tone-brand" data-pg="reports" data-act="page" data-page="reports"><div class="mod-ic">${icon('reports')}</div><div class="mod-info"><div class="mod-name">גיליונות חודשיים</div><div class="mod-desc">דוחות נוכחות, סטטיסטיקות וסיכומים</div></div></button>
      <button class="mod mod-tone-brand" data-pg="forms" data-act="page" data-page="forms"><div class="mod-ic">${icon('forms')}</div><div class="mod-info"><div class="mod-name">טפסים</div><div class="mod-desc">טופס רישום, קבלה לישיבה ושיבוץ לאסיפת הורים</div></div></button>

    </div>
  </div>
</div>
`;
}

// hebrewDate כבר כולל את שם היום — אין להוסיף אותו כאן.

async function refreshDashStats() {
  var todayIso = dayToday();

  var allSts = getStudents();
  // פעילים — בחודש הנוכחי, לפי תקופות הפעילות
  var activeSts = allSts.filter(function(s){ return hrStudentOn(s); });

  var presentCount = activeSts.filter(function(s){
    var aa = hrAwayAbsences(s);
    return !aa || aa.length === 0;
  }).length;

  // סדר שנמחק נשאר במערך כסימון — ולכן מסוננים המחוקים.
  // מהזיכרון או מהמראה, בלי להמתין לרשת — הקוביות מתמלאות מיד, ומתעדכנות אחרי המשיכה (hrPullDraw)
  var atData = (S._atData || hrMirrorRecs('hr_sessions') || [])
    .filter(function(r){ return !(r && r.deleted); });
  var todaySess = atData.filter(function(r){ return r.session_date === todayIso; });

  // חיסורים — e ו-x; נוכחות — p וכל איחור; כל סדר נספר בנפרד
  var absCount = 0, presMarks = 0;
  todaySess.forEach(function(rec){
    Object.values(hrMarks(rec)).forEach(function(m){
      if(m.status === 'e' || m.status === 'x') absCount++;
      if(m.status === 'p' || hrIsLate(m.status)) presMarks++;
    });
  });

  // אחוז נוכחות: נוכחים ומאחרים מתוך מי שסומן נוכח או נעדר (e · x) — תלמיד שטרם סומן, באישור או בבית אינו נספר,
  // אחרת סדר שנפתח ועוד לא מולא היה מוריד את האחוז
  var rateStr;
  var denom = presMarks + absCount;
  rateStr = denom > 0 ? Math.round(presMarks / denom * 100) + '%' : '—';

  var totEl = document.getElementById('s-tot');
  var preEl = document.getElementById('s-pre');
  var absEl = document.getElementById('s-abs');
  var rateEl = document.getElementById('s-rate');
  if(totEl) totEl.textContent = activeSts.length;
  if(preEl) preEl.textContent = presentCount;
  if(absEl) absEl.textContent = absCount;
  if(rateEl) rateEl.textContent = rateStr;
  var preSub = document.getElementById('s-pre-sub');
  if(preSub) preSub.textContent = 'מתוך ' + activeSts.length + ' פעילים';
  var absSub = document.getElementById('s-abs-sub');
  if(absSub) absSub.textContent = todaySess.length ? ('ב-' + todaySess.length + ' סדרים שנפתחו היום') : 'טרם נפתחו סדרים היום';
}

// הליבה עלתה עם הדף (bootRun ב-app/main.js) — כאן רק המשיכה והציור של המסך.
// הקוביות מציגות את היום בלבד — ולכן נמשכים התלמידים וסדרי הנוכחות של היום, במקביל («מסך מציג מיד ומרענן ברקע» · «משיכה מסוננת בשרת»);
// המשיכה המלאה שייכת לסנכרון ולגיבוי, לא למסך.
async function loadDash(){
  refreshDashStats();
  await Promise.all([hrStudentsPull(), hrPullSessions(HR_STREAMS.attend, hrDayWin())]);
  refreshDashStats();
  shell.renderStudents();
  // plTick רץ כל 3 שניות על שורת החותמת בלבד, ומושך רק בשינוי אמיתי.
}

export { loadDash, refreshDashStats, screenHomeHTML };
