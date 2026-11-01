// app/screens/home.js — מסך הראשי
import { dayToday } from '../../core/util.js';
import { shell } from '../state.js';
import { getActiveAbsences, getStudents, hrMarks, hrPullFromCloud } from '../domain.js';
import { HR_STREAMS, hrIsLate, hrLoadData } from '../domain.sessions.js';
import { icon } from '../icons.js';

function screenHomeHTML() {
  return `
<div class="pg on" id="pg-home">
  <div class="mods-wrap">
    <div class="mods-lbl">מודולים</div>
    <div class="mods">
      <button class="mod-tone-brand mod" data-pg="students" data-act="page" data-page="students"><div class="mod-ic">${icon('students')}</div><div class="mod-info"><div class="mod-name">מצבת התלמידים</div><div class="mod-desc">רשימת תלמידים, פרטים אישיים, ניהול ועריכה</div></div></button>
      <button class="mod-tone-ok mod" data-pg="attend" data-act="page" data-page="attend"><div class="mod-ic">${icon('attend')}</div><div class="mod-info"><div class="mod-name">שמירת הסדרים</div><div class="mod-desc">רישום נוכחות יומית לשיעורים וסדרי לימוד</div></div></button>
      <button class="mod-tone-info mod" data-pg="sleep" data-act="page" data-page="sleep"><div class="mod-ic">${icon('sleep')}</div><div class="mod-info"><div class="mod-name">זמן שינה</div><div class="mod-desc">מעקב שעות שינה וכיבוי אורות</div></div></button>
      <button class="mod-tone-warn mod" data-pg="exams" data-act="page" data-page="exams"><div class="mod-ic">${icon('exams')}</div><div class="mod-info"><div class="mod-name">מבחנים</div><div class="mod-desc">ניהול בחינות, ציונים ותוצאות</div></div></button>
      <button class="mod-tone-bad mod" data-pg="files" data-act="page" data-page="files"><div class="mod-ic">${icon('files')}</div><div class="mod-info"><div class="mod-name">תיקים אישיים</div><div class="mod-desc">מסמכים, הערות ומעקב אישי לכל תלמיד</div></div></button>
      <button class="mod-tone-info mod" data-pg="reports" data-act="page" data-page="reports"><div class="mod-ic">${icon('reports')}</div><div class="mod-info"><div class="mod-name">גיליונות חודשיים</div><div class="mod-desc">דוחות נוכחות, סטטיסטיקות וסיכומים</div></div></button>

    </div>
  </div>
  <div class="kpi-wrap">
    <div class="mods-lbl">היום</div>
    <div class="kpis">
      <div class="kpi kpi-brand"><div class="kpi-ic">${icon('students')}</div><div class="kpi-n" id="s-tot">–</div><div class="kpi-l">תלמידים רשומים</div></div>
      <div class="kpi kpi-ok"><div class="kpi-ic">${icon('check')}</div><div class="kpi-n" id="s-pre">–</div><div class="kpi-l">נוכחים בישיבה</div></div>
      <div class="kpi kpi-bad"><div class="kpi-ic">${icon('close')}</div><div class="kpi-n" id="s-abs">–</div><div class="kpi-l">חיסורים בסדרים</div></div>
      <div class="kpi kpi-info"><div class="kpi-ic">${icon('reports')}</div><div class="kpi-n" id="s-rate">–</div><div class="kpi-l">נוכחות בסדרים</div><div class="kpi-bar"><span id="s-rate-bar"></span></div></div>
    </div>
  </div>
</div>
`;
}

// hebrewDate כבר כולל את שם היום — אין להוסיף אותו כאן.

async function refreshDashStats() {
  var todayIso = dayToday();

  var allSts = getStudents();
  var activeSts = allSts.filter(function(s){ return s.active !== false; });

  var presentCount = activeSts.filter(function(s){
    var aa = (typeof getActiveAbsences === 'function') ? getActiveAbsences(s) : [];
    return !aa || aa.length === 0;
  }).length;

  // סדר שנמחק נשאר במערך כסימון — ולכן מסוננים המחוקים.
  var atData = (await hrLoadData(HR_STREAMS.attend))
    .filter(function(r){ return !(r && r.deleted); });
  var todaySess = atData.filter(function(r){ return r.session_date === todayIso; });
  var sessCount = todaySess.length;

  // חיסורים — e ו-x; נוכחות — p וכל איחור; כל סדר נספר בנפרד
  var absCount = 0, presMarks = 0;
  todaySess.forEach(function(rec){
    Object.values(hrMarks(rec)).forEach(function(m){
      if(m.status === 'e' || m.status === 'x') absCount++;
      if(m.status === 'p' || hrIsLate(m.status)) presMarks++;
    });
  });

  // אחוז נוכחות: מונה p וכל איחור, מכנה — תלמידים פעילים כפול מספר הסדרים
  var rateStr;
  if(sessCount === 0){
    rateStr = '—';
  } else {
    var denom = activeSts.length * sessCount;
    rateStr = denom > 0 ? Math.round(presMarks / denom * 100) + '%' : '0%';
  }

  var totEl = document.getElementById('s-tot');
  var preEl = document.getElementById('s-pre');
  var absEl = document.getElementById('s-abs');
  var rateEl = document.getElementById('s-rate');
  if(totEl) totEl.textContent = activeSts.length;
  if(preEl) preEl.textContent = presentCount;
  if(absEl) absEl.textContent = absCount;
  if(rateEl) rateEl.textContent = rateStr;
  var barEl = document.getElementById('s-rate-bar');
  if(barEl) barEl.style.width = (parseInt(rateStr, 10) || 0) + '%';
}

// הליבה עלתה עם הדף (bootRun ב-app/main.js) — כאן רק המשיכה והציור של המסך.
async function loadDash(){
  await hrPullFromCloud();
  shell.renderStudents();
  // plTick רץ כל 3 שניות על שורת החותמת בלבד, ומושך רק בשינוי אמיתי.
}

export { loadDash, refreshDashStats, screenHomeHTML };
