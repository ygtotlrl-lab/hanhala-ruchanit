// core/hebrew.js — מנוע התאריך העברי

import { dayNoon } from './util.js';

// ── מנוע התאריך העברי ──
// הטבלה האריתמטית אינה נמחקת — היא רשת הביטחון כש-Intl חסר או שוגה, ואומתה מול הלוח הקבוע עד תת"י.
var DAYS_HEB=["","א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ז׳","ח׳","ט׳","י׳","י״א","י״ב","י״ג","י״ד","ט״ו","ט״ז","י״ז","י״ח","י״ט","כ׳","כ״א","כ״ב","כ״ג","כ״ד","כ״ה","כ״ו","כ״ז","כ״ח","כ״ט","ל׳"];
var MONTHS_HEB     =["תשרי","חשון","כסלו","טבת","שבט","אדר","ניסן","אייר","סיון","תמוז","מנחם אב","אלול"];
var MONTHS_HEB_LEAP=["תשרי","חשון","כסלו","טבת","שבט","אדר א׳","אדר ב׳","ניסן","אייר","סיון","תמוז","מנחם אב","אלול"];
var HEB_DOW=["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

function hebIsLeap(hy){return ((7*(+hy)+1)%19)<7;}
function hebMonthNames(hy){return hebIsLeap(hy)?MONTHS_HEB_LEAP:MONTHS_HEB;}

// sep — התו שלפני האות האחרונה
function hebGematria(n,sep){
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
}
function hebDayLabel(day){var T=DAYS_HEB;return (T&&T[day])||hebGematria(day)||String(day);}
function hebYearLabelFull(hy){
  var ONES=['','א','ב','ג','ד','ה','ו','ז','ח','ט'],th=Math.floor((+hy)/1000);
  return ((th>0&&th<10)?ONES[th]+'׳':'')+hebGematria((+hy)%1000,'״');
}

// ── קריאת הלוח העברי של הדפדפן ──
// שמות החודשים נקראים באנגלית (en-u-ca-hebrew) כי הם יציבים בין גרסאות ICU.
var _hebMICodeLeap={tishri:0,heshvan:1,kislev:2,tevet:3,shevat:4,adar1:5,adar2:6,nisan:7,iyar:8,sivan:9,tamuz:10,av:11,elul:12};
var _hebMICodeStd ={tishri:0,heshvan:1,kislev:2,tevet:3,shevat:4,adar:5,nisan:6,iyar:7,sivan:8,tamuz:9,av:10,elul:11};
function _hebMonthCode(name){
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
}
var _hebIntlFmt=null,_hebIntlOK=null;
// מחזירה null כש-Intl אינו זמין או מחזיר תוצאה לא צפויה.
function hebIntl(d){
  try{
    if(_hebIntlOK===false) return null;
    if(!_hebIntlFmt){
      if(typeof Intl==='undefined'||!Intl.DateTimeFormat){_hebIntlOK=false;return null;}
      var f=new Intl.DateTimeFormat('en-u-ca-hebrew',{year:'numeric',month:'long',day:'numeric'});
      var ro=f.resolvedOptions?f.resolvedOptions():null;
      if(!ro||ro.calendar!=='hebrew'||!f.formatToParts){_hebIntlOK=false;return null;}
      _hebIntlFmt=f;_hebIntlOK=true;
    }
    var o={};
    _hebIntlFmt.formatToParts(d).forEach(function(p){o[p.type]=p.value;});
    var hy=parseInt(String(o.year||'').replace(/[^0-9]/g,''),10);
    var day=parseInt(String(o.day||'').replace(/[^0-9]/g,''),10);
    var code=_hebMonthCode(o.month);
    if(!(hy>=4000&&hy<=7000)||!(day>=1&&day<=30)||!code) return null;
    var leap=hebIsLeap(hy);
    var mi=leap?_hebMICodeLeap[code]:_hebMICodeStd[code];
    if(mi===undefined){
      // אי-התאמה בין חישוב העיבור לשם החודש — לא מנחשים.
      return null;
    }
    return {hy:hy,mi:mi,day:day,leap:leap};
  }catch(e){ _hebIntlOK=false; return null; }
}

// אין לבדוק d instanceof Date — הוא תלוי-realm (iframe, vm); הבדיקה היא על החוזה, getTime שמחזיר מספר.
// ואין ליפול-חזרה ל«היום» — זה מציג תאריך שגוי כאילו הוא נכון; רק קריאה בלי ארגומנט משמעה «היום».
function _hebIsDate(d){
  return !!d&&typeof d.getTime==='function'&&!isNaN(d.getTime());
}
var _hebBadDates=[];
function _hebBadDate(where,d){
  var got;
  try{ got=Object.prototype.toString.call(d); }catch(e){ got='?'; }
  _hebBadDates.push({at:Date.now(),where:where,got:got});
  if(_hebBadDates.length>12) _hebBadDates.shift();
  try{ console.warn('[heb] hebDate: קלט שאינו תאריך תקף ב-'+where+' — '+got); }catch(e){}
}
function _hebNone(src){
  return {year:0,monthIndex:0,monthName:'',day:0,dayLabel:'',
          yearLabelFull:'',ok:false,src:src};
}
// נפילה-חזרה בלבד כש-Intl חסר או מחזיר תוצאה לא צפויה — אין למחוק: זו רשת הביטחון.
// אומתה מול הלוח הקבוע, כולל סגירת כל שנה בא׳ תשרי של הבאה ואורך חוקי; הטווח עד תת"י (2049).
var _hcST=[
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
function _hcHTable(d){
  var td=new Date(d.getFullYear(),d.getMonth(),d.getDate()),b=_hcST[0];
  for(var i=_hcST.length-1;i>=0;i--){if(td>=_hcST[i].jd){b=_hcST[i];break;}}
  var df=Math.round((td-b.jd)/86400000),c=0;
  for(var mi=0;mi<b.ml.length;mi++){if(df<c+b.ml[mi])return{hy:b.hy,mi:mi,day:df-c+1};c+=b.ml[mi];}
  return{hy:b.hy,mi:0,day:1};}
// קוראים חיצוניים עוברים כאן ולא ב-_hcST ישירות — הוא מצב פנימי, ותלות בו נשברת ביום שהמבנה משתנה.
function hebYearBase(hy){
  for(var i=0;i<_hcST.length;i++){if(_hcST[i].hy===+hy)return _hcST[i];}
  return null;}
// ── הפונקציה המרכזית ──
// מטמון הגזירה ממופתח ביום המקומי (הגזירה מעוגנת בצהריים), מתרוקן בתקרה, והתשובה מוחזרת כעותק רדוד —
// קורא שכותב לשדה היה מרעיל את המטמון לכל השאר.
var _hebCache={};
var _hebCacheN=0;
function hebDate(d){
  if(d===undefined||d===null) d=new Date();
  if(!_hebIsDate(d)){ _hebBadDate('hebDate',d); return _hebNone('bad-input'); }
  var ck=d.getFullYear()+'|'+d.getMonth()+'|'+d.getDate();
  var hit=_hebCache[ck];
  if(hit) return Object.assign({},hit);
  // צהריים מקומיים — מנטרל הבדלי אזור-זמן ושעון-קיץ בגבול היממה.
  var nd=dayNoon(d);
  var r=hebIntl(nd),src='intl';
  if(!r){ r=(typeof _hcHTable==='function')?_hcHTable(nd):null; src='table'; }
  if(!r||!r.hy){ return _hebNone('none'); }
  var names=hebMonthNames(r.hy);
  var out={
    year:r.hy, monthIndex:r.mi, monthName:names[r.mi]||'', day:r.day,
    dayLabel:hebDayLabel(r.day),
    yearLabelFull:hebYearLabelFull(r.hy),
    ok:true, src:src
  };
  if(_hebCacheN>=4000){ _hebCache={}; _hebCacheN=0; }
  _hebCache[ck]=out; _hebCacheN++;
  return Object.assign({},out);
}
// קלט פגום אינו הופך ל«היום» — jsDate || new Date() מציג את תאריך היום כאילו נתבקש;
// מחרוזת ריקה היא מה שכל הצרכנים יודעים לטפל בו, וקריאה בלי ארגומנט משמעה «היום».
function hebrewDate(jsDate){
  if(jsDate===undefined||jsDate===null) jsDate=new Date();
  if(!_hebIsDate(jsDate)){ _hebBadDate('hebrewDate',jsDate); return ''; }
  var h=hebDate(jsDate);
  if(!h.ok) return '';
  return h.dayLabel+' '+h.monthName+' '+h.yearLabelFull;
}

// ייצוא בשם ולא default — שם שנעלם נשבר בטעינה, ו-default היה נבלע בשקט.
export { HEB_DOW, hebDate, hebDayLabel, hebGematria, hebIntl, hebIsLeap, hebMonthNames,
         hebYearBase, hebYearLabelFull, hebrewDate };
