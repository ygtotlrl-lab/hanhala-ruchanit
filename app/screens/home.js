// app/screens/home.js — מסך הראשי
import { dayToday } from '../../core/util.js';
import { eraKick, pendBoot, plBoot, rtyBoot, tombBoot } from '../../core/sync.js';
import { hwBoot, lsBoot } from '../../core/storage.js';
import { mirrorBoot } from '../../core/mirror.js';
import { bkBoot } from '../../core/backup.js';
import { lkBoot } from '../../core/auth.js';
import { hrMarks, hrPullFromCloud } from '../domain.js';
import { getActiveAbsences, getStudents, renderStudents } from './students.js';
import { atLoadData } from './attend.reg.js';

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
  var atData = ((typeof atLoadData === 'function') ? await atLoadData() : [])
    .filter(function(r){ return !(r && r.deleted); });
  var todaySess = atData.filter(function(r){ return r.date_iso === todayIso; });
  var sessCount = todaySess.length;

  // חיסורים — e ו-x; נוכחות — p ו-l; כל סדר נספר בנפרד
  var absCount = 0, presMarks = 0;
  todaySess.forEach(function(rec){
    Object.values(hrMarks(rec)).forEach(function(m){
      if(m.s === 'e' || m.s === 'x') absCount++;
      if(m.s === 'p' || m.s === 'l') presMarks++;
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

async function loadDash(){
  // שכבת המראה נטענת לפני כל קורא — קורא שרץ לפניה מקבל undefined ונופל לברירת המחדל.
  try { mirrorBoot(); } catch (e) { console.warn('[mirror] mirrorBoot', e); }
  // המדידה והפינוי לפני המשיכה — כדי שכתיבות המשיכה ייפלו לאחסון שיש בו מקום.
  try { lsBoot(); } catch (e) { console.warn('[ls] lsBoot', e); }
  // נטענים לפני המשיכה — רשומה שלא אושרה בסשן הקודם מוצגת כממתינה מהשנייה הראשונה.
  try { pendBoot(); } catch (e) { console.warn('[pend] pendBoot', e); }
  try { tombBoot(); } catch (e) { console.warn('[tomb] tombBoot', e); }
  try { eraKick(); } catch (e) { console.warn('[era] eraKick', e); }
  // אין להעביר את bkBoot למסלול הדחיפה — שם הוא רץ רק כשמישהו כותב, והגיבוי נעצר ביום בלי כתיבה.
  try { bkBoot(); } catch (e) { console.warn('[bk] bkBoot', e); }
  try { rtyBoot(); } catch (e) { console.warn('[rty] rtyBoot', e); }
  try { lkBoot(); } catch (e) { console.warn('[lk] lkBoot', e); }
  try { plBoot(); } catch (e) { console.warn('[pl] plBoot', e); }
  try { hwBoot(); } catch (e) { console.warn('[hw] hwBoot', e); }
  await hrPullFromCloud();
  renderStudents();
  // plTick רץ כל 3 שניות על שורת החותמת בלבד, ומושך רק בשינוי אמיתי.
}

export { loadDash, refreshDashStats, screenHomeHTML };
