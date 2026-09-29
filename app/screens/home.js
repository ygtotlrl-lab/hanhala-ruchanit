// app/screens/home.js — מסך הראשי
import { dayToday } from '../../core/util.js';
import { shell } from '../state.js';
import { getActiveAbsences, getStudents, hrMarks, hrPullFromCloud } from '../domain.js';
import { HR_STREAMS, hrLoadData } from '../domain.sessions.js';

function screenHomeHTML() {
  return `
<div class="pg on" id="pg-home">
  <div class="hero">
    <div class="hero-date" id="hdate"></div>
    <div class="hero-title">שלום וברכה 👋</div>
    <div class="hero-sub">ברוכים הבאים למערכת ניהול ישיבת תומכי תמימים ראשון לציון</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="n" id="s-tot">-</div><div class="l">תלמידים רשומים</div></div>
    <div class="stat"><div class="stat-ok n" id="s-pre">-</div><div class="l">נוכחים היום</div></div>
    <div class="stat"><div class="stat-bad n" id="s-abs">-</div><div class="l">חיסורים היום</div></div>
    <div class="stat"><div class="n" id="s-rate">-</div><div class="l">% נוכחות</div></div>
  </div>
  <div class="mods-wrap">
    <div class="mods-lbl">מודולים</div>
    <div class="mods">
      <button class="mod-tone-brand mod" data-pg="students" data-act="page" data-page="students"><div class="mod-ic">👥</div><div class="mod-info"><div class="mod-name">מצבת התלמידים</div><div class="mod-desc">רשימת תלמידים, פרטים אישיים, ניהול ועריכה</div></div></button>
      <button class="mod-tone-ok mod" data-pg="attend" data-act="page" data-page="attend"><div class="mod-ic">✅</div><div class="mod-info"><div class="mod-name">שמירת הסדרים</div><div class="mod-desc">רישום נוכחות יומית לשיעורים וסדרי לימוד</div></div></button>
      <button class="mod-tone-info mod" data-pg="sleep" data-act="page" data-page="sleep"><div class="mod-ic">🌙</div><div class="mod-info"><div class="mod-name">זמן שינה</div><div class="mod-desc">מעקב שעות שינה וכיבוי אורות</div></div></button>
      <button class="mod-tone-warn mod" data-pg="exams" data-act="page" data-page="exams"><div class="mod-ic">📝</div><div class="mod-info"><div class="mod-name">מבחנים</div><div class="mod-desc">ניהול בחינות, ציונים ותוצאות</div></div></button>
      <button class="mod-tone-bad mod" data-pg="files" data-act="page" data-page="files"><div class="mod-ic">📁</div><div class="mod-info"><div class="mod-name">תיקים אישיים</div><div class="mod-desc">מסמכים, הערות ומעקב אישי לכל תלמיד</div></div></button>
      <button class="mod-tone-info mod" data-pg="reports" data-act="page" data-page="reports"><div class="mod-ic">📊</div><div class="mod-info"><div class="mod-name">גיליונות חודשיים</div><div class="mod-desc">דוחות נוכחות, סטטיסטיקות וסיכומים</div></div></button>

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

  // חיסורים — e ו-x; נוכחות — p ו-l; כל סדר נספר בנפרד
  var absCount = 0, presMarks = 0;
  todaySess.forEach(function(rec){
    Object.values(hrMarks(rec)).forEach(function(m){
      if(m.status === 'e' || m.status === 'x') absCount++;
      if(m.status === 'p' || m.status === 'l') presMarks++;
    });
  });

  // אחוז נוכחות: מונה p+l, מכנה — תלמידים פעילים כפול מספר הסדרים
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
}

// הליבה עלתה עם הדף (coreBoot ב-app/main.js) — כאן רק המשיכה והציור של המסך.
async function loadDash(){
  await hrPullFromCloud();
  shell.renderStudents();
  // plTick רץ כל 3 שניות על שורת החותמת בלבד, ומושך רק בשינוי אמיתי.
}

export { loadDash, refreshDashStats, screenHomeHTML };
