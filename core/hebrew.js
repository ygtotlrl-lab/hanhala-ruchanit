// core/hebrew.js — מנוע התאריך העברי

import { dayNoon } from './util.js';

// ── מנוע התאריך העברי ──
// הטבלה האריתמטית אינה נמחקת — היא רשת הביטחון כש-Intl חסר או שוגה, ואומתה מול הלוח הקבוע עד תת"י.
window.DAYS_HEB=["","א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ז׳","ח׳","ט׳","י׳","י״א","י״ב","י״ג","י״ד","ט״ו","ט״ז","י״ז","י״ח","י״ט","כ׳","כ״א","כ״ב","כ״ג","כ״ד","כ״ה","כ״ו","כ״ז","כ״ח","כ״ט","ל׳"];
window.MONTHS_HEB     =["תשרי","חשון","כסלו","טבת","שבט","אדר","ניסן","אייר","סיון","תמוז","מנחם אב","אלול"];
window.MONTHS_HEB_LEAP=["תשרי","חשון","כסלו","טבת","שבט","אדר א׳","אדר ב׳","ניסן","אייר","סיון","תמוז","מנחם אב","אלול"];
window.HEB_DOW=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

window.hebIsLeap=function(hy){return ((7*(+hy)+1)%19)<7;};
window.hebMonthNames=function(hy){return window.hebIsLeap(hy)?window.MONTHS_HEB_LEAP:window.MONTHS_HEB;};

// sep — התו שלפני האות האחרונה
window.hebGematria=function(n,sep){
  n=Math.floor(Math.abs(+n))||0;
  if(!n) return '';
  if(n>=1000) n=n%1000;
  var HUN=['','ק','ר','ש','ת'],TENS=['','י','כ','ל','מ','נ','ס','ע','פ','צ'],ONES=['','א','ב','ג','ד','ה','ו','ז','ח','ט'];
  var s='',h=Math.floor(n/100),r=n%100;
  while(h>4){s+='ת';h-=4;}
  s+=HUN[h]||'';
  if(r===15) s+='טו';
  else if(r===16) s+='טז';
  else s+=TENS[Math.floor(r/10)]+ONES[r%10];
  if(sep===undefined) sep='״';
  if(!sep||!s) return s;
  if(s.length===1) return s+'׳';
  return s.slice(0,-1)+sep+s.slice(-1);
};
window.hebDayLabel=function(day){var T=window.DAYS_HEB;return (T&&T[day])||window.hebGematria(day)||String(day);};
window.hebYearLabelFull=function(hy){
  var ONES=['','א','ב','ג','ד','ה','ו','ז','ח','ט'],th=Math.floor((+hy)/1000);
  return ((th>0&&th<10)?ONES[th]+'׳':'')+window.hebGematria((+hy)%1000,'״');
};

// ── קריאת הלוח העברי של הדפדפן ──
// שמות החודשים נקראים באנגלית (en-u-ca-hebrew) כי הם יציבים בין גרסאות ICU.
window._hebMICodeLeap={tishri:0,heshvan:1,kislev:2,tevet:3,shevat:4,adar1:5,adar2:6,nisan:7,iyar:8,sivan:9,tamuz:10,av:11,elul:12};
window._hebMICodeStd ={tishri:0,heshvan:1,kislev:2,tevet:3,shevat:4,adar:5,nisan:6,iyar:7,sivan:8,tamuz:9,av:10,elul:11};
window._hebMonthCode=function(name){
  var s=(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(s.indexOf('adar')===0){
    var t=s.slice(4);
    if(t==='i'||t==='1'||t==='a') return 'adar1';
    if(t==='ii'||t==='2'||t==='b') return 'adar2';
    return 'adar';
  }
  if(s.indexOf('tishr')===0) return 'tishri';
  if(s.indexOf('hesh')!==-1||s.indexOf('chesh')!==-1) return 'heshvan';
  if(s.indexOf('kislev')===0||s.indexOf('chislev')===0) return 'kislev';
  if(s.indexOf('tevet')===0||s.indexOf('teveth')===0) return 'tevet';
  if(s.indexOf('shevat')===0||s.indexOf('shvat')===0||s.indexOf('shebat')===0) return 'shevat';
  if(s.indexOf('nisan')===0||s.indexOf('nissan')===0) return 'nisan';
  if(s.indexOf('iyar')===0||s.indexOf('iyyar')===0) return 'iyar';
  if(s.indexOf('sivan')===0) return 'sivan';
  if(s.indexOf('tamuz')===0||s.indexOf('tammuz')===0) return 'tamuz';
  if(s==='av'||s==='ab') return 'av';
  if(s.indexOf('elul')===0) return 'elul';
  return null;
};
window._hebIntlFmt=null;window._hebIntlOK=null;
// מחזירה null כש-Intl אינו זמין או מחזיר תוצאה לא צפויה.
window.hebIntl=function(d){
  try{
    if(window._hebIntlOK===false) return null;
    if(!window._hebIntlFmt){
      if(typeof Intl==='undefined'||!Intl.DateTimeFormat){window._hebIntlOK=false;return null;}
      var f=new Intl.DateTimeFormat('en-u-ca-hebrew',{year:'numeric',month:'long',day:'numeric'});
      var ro=f.resolvedOptions?f.resolvedOptions():null;
      if(!ro||ro.calendar!=='hebrew'||!f.formatToParts){window._hebIntlOK=false;return null;}
      window._hebIntlFmt=f;window._hebIntlOK=true;
    }
    var o={};
    window._hebIntlFmt.formatToParts(d).forEach(function(p){o[p.type]=p.value;});
    var hy=parseInt(String(o.year||'').replace(/[^0-9]/g,''),10);
    var day=parseInt(String(o.day||'').replace(/[^0-9]/g,''),10);
    var code=window._hebMonthCode(o.month);
    if(!(hy>=4000&&hy<=7000)||!(day>=1&&day<=30)||!code) return null;
    var leap=window.hebIsLeap(hy);
    var mi=leap?window._hebMICodeLeap[code]:window._hebMICodeStd[code];
    if(mi===undefined){
      // אי-התאמה בין חישוב העיבור לשם החודש — לא מנחשים.
      return null;
    }
    return {hy:hy,mi:mi,day:day,leap:leap};
  }catch(e){ window._hebIntlOK=false; return null; }
};

// אין לבדוק d instanceof Date — הוא תלוי-realm (iframe, vm); הבדיקה היא על החוזה, getTime שמחזיר מספר.
// ואין ליפול-חזרה ל«היום» — זה מציג תאריך שגוי כאילו הוא נכון; רק קריאה בלי ארגומנט משמעה «היום».
window._hebIsDate=function(d){
  return !!d&&typeof d.getTime==='function'&&!isNaN(d.getTime());
};
window._hebBadDates=[];
window._hebBadDate=function(where,d){
  var got;
  try{ got=Object.prototype.toString.call(d); }catch(e){ got='?'; }
  window._hebBadDates.push({at:Date.now(),where:where,got:got});
  if(window._hebBadDates.length>12) window._hebBadDates.shift();
  try{ console.warn('[heb] hebDate: קלט שאינו תאריך תקף ב-'+where+' — '+got); }catch(e){}
};
window._hebNone=function(src){
  return {year:0,monthIndex:0,monthName:'',day:0,dayLabel:'',
          yearLabelFull:'',ok:false,src:src};
};
// נפילה-חזרה בלבד כש-Intl חסר או מחזיר תוצאה לא צפויה — אין למחוק: זו רשת הביטחון.
// אומתה מול הלוח הקבוע, כולל סגירת כל שנה בא׳ תשרי של הבאה ואורך חוקי; הטווח עד תת"י (2049).
window._hcST=[
  {hy:5785,lb:'תשפ"ה',jd:new Date(2024,9, 3),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5786,lb:'תשפ"ו',jd:new Date(2025,8,23),ml:[30,29,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5787,lb:'תשפ"ז',jd:new Date(2026,8,12),ml:[30,30,30,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5788,lb:'תשפ"ח',jd:new Date(2027,9, 2),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5789,lb:'תשפ"ט',jd:new Date(2028,8,21),ml:[30,29,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5790,lb:'תש"צ',jd:new Date(2029,8,10),ml:[30,29,29,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5791,lb:'תשצ"א',jd:new Date(2030,8,28),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5792,lb:'תשצ"ב',jd:new Date(2031,8,18),ml:[30,29,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5793,lb:'תשצ"ג',jd:new Date(2032,8, 6),ml:[30,29,29,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5794,lb:'תשצ"ד',jd:new Date(2033,8,24),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5795,lb:'תשצ"ה',jd:new Date(2034,8,14),ml:[30,30,30,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5796,lb:'תשצ"ו',jd:new Date(2035,9, 4),ml:[30,29,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5797,lb:'תשצ"ז',jd:new Date(2036,8,22),ml:[30,29,29,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5798,lb:'תשצ"ח',jd:new Date(2037,8,10),ml:[30,30,30,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5799,lb:'תשצ"ט',jd:new Date(2038,8,30),ml:[30,29,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5800,lb:'ת"ת',jd:new Date(2039,8,19),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5801,lb:'תת"א',jd:new Date(2040,8, 8),ml:[30,29,29,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5802,lb:'תת"ב',jd:new Date(2041,8,26),ml:[30,29,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5803,lb:'תת"ג',jd:new Date(2042,8,15),ml:[30,30,30,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5804,lb:'תת"ד',jd:new Date(2043,9, 5),ml:[30,29,29,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5805,lb:'תת"ה',jd:new Date(2044,8,22),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5806,lb:'תת"ו',jd:new Date(2045,8,12),ml:[30,29,30,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5807,lb:'תת"ז',jd:new Date(2046,9, 1),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5808,lb:'תת"ח',jd:new Date(2047,8,21),ml:[30,29,29,29,30,29,30,29,30,29,30,29]   ,leap:false},
  {hy:5809,lb:'תת"ט',jd:new Date(2048,8, 8),ml:[30,29,30,29,30,30,29,30,29,30,29,30,29],leap:true },
  {hy:5810,lb:'תת"י',jd:new Date(2049,8,27),ml:[30,30,30,29,30,29,30,29,30,29,30,29]   ,leap:false}];
window._hcHTable=function(d){
  var td=new Date(d.getFullYear(),d.getMonth(),d.getDate()),b=window._hcST[0];
  for(var i=window._hcST.length-1;i>=0;i--){if(td>=window._hcST[i].jd){b=window._hcST[i];break;}}
  var df=Math.round((td-b.jd)/86400000),c=0;
  for(var mi=0;mi<b.ml.length;mi++){if(df<c+b.ml[mi])return{hy:b.hy,mi:mi,day:df-c+1};c+=b.ml[mi];}
  return{hy:b.hy,mi:0,day:1};};
// קוראים חיצוניים עוברים כאן ולא ב-_hcST ישירות — הוא מצב פנימי, ותלות בו נשברת ביום שהמבנה משתנה.
window.hebYearBase=function(hy){
  for(var i=0;i<window._hcST.length;i++){if(window._hcST[i].hy===+hy)return window._hcST[i];}
  return null;};
// ── הפונקציה המרכזית ──
// מטמון הגזירה ממופתח ביום המקומי (הגזירה מעוגנת בצהריים), מתרוקן בתקרה, והתשובה מוחזרת כעותק רדוד —
// קורא שכותב לשדה היה מרעיל את המטמון לכל השאר.
window._hebCache={};
window._hebCacheN=0;
window.hebDate=function(d){
  if(d===undefined||d===null) d=new Date();
  if(!window._hebIsDate(d)){ window._hebBadDate('hebDate',d); return window._hebNone('bad-input'); }
  var ck=d.getFullYear()+'|'+d.getMonth()+'|'+d.getDate();
  var hit=window._hebCache[ck];
  if(hit) return Object.assign({},hit);
  // צהריים מקומיים — מנטרל הבדלי אזור-זמן ושעון-קיץ בגבול היממה.
  var nd=dayNoon(d);
  var r=window.hebIntl(nd),src='intl';
  if(!r){ r=(typeof window._hcHTable==='function')?window._hcHTable(nd):null; src='table'; }
  if(!r||!r.hy){ return window._hebNone('none'); }
  var names=window.hebMonthNames(r.hy);
  var out={
    year:r.hy, monthIndex:r.mi, monthName:names[r.mi]||'', day:r.day,
    dayLabel:window.hebDayLabel(r.day),
    yearLabelFull:window.hebYearLabelFull(r.hy),
    ok:true, src:src
  };
  if(window._hebCacheN>=4000){ window._hebCache={}; window._hebCacheN=0; }
  window._hebCache[ck]=out; window._hebCacheN++;
  return Object.assign({},out);
};
// קלט פגום אינו הופך ל«היום» — jsDate || new Date() מציג את תאריך היום כאילו נתבקש;
// מחרוזת ריקה היא מה שכל הצרכנים יודעים לטפל בו, וקריאה בלי ארגומנט משמעה «היום».
window.hebrewDate=function(jsDate){
  if(jsDate===undefined||jsDate===null) jsDate=new Date();
  if(!window._hebIsDate(jsDate)){ window._hebBadDate('hebrewDate',jsDate); return ''; }
  var h=window.hebDate(jsDate);
  if(!h.ok) return '';
  return h.dayLabel+' '+h.monthName+' '+h.yearLabelFull;
};

// אין כאן ייצוא בשם — המנוע מתקין את עצמו על window כדי שכל צרכן יגיע אליו בשם אחד, והייבוא הוא לצד-ההשפעה בלבד.
