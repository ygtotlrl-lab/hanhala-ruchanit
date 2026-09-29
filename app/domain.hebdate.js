// app/domain.hebdate.js — התאריך העברי: חלונות החודש והשנה, התוויות ובורר התאריך
import { dayIso, dayNoon } from '../core/util.js';
import { esc } from '../core/ui.js';
import { HEB_DOW, hebDate, hebDayLabel, hebMonthNames, hebToGreg, hebYearInfo,
         hebYearLabelFull } from '../core/hebrew.js';

function _hcMN(hy){return hebMonthNames(hy);}

// חודש עברי הוא טווח גרגוריאני רציף — gte/lte על session_date מכסים אותו בדיוק. המנוע הוא hebToGreg ולא חשבון ידני.
function hrHebMonthWin(hy, mi) {
  var b = hebYearInfo(hy);
  if (!b || !b.ml || !b.ml.length) return null;
  var i = Math.max(0, Math.min(mi, b.ml.length - 1));
  return { col: 'session_date', from: dayIso(hebToGreg(hy, i, 1)),
           to: dayIso(hebToGreg(hy, i, b.ml[i])) };
}

function hrHebYearWin(hy) {
  var b = hebYearInfo(hy);
  if (!b || !b.ml || !b.ml.length) return null;
  var last = b.ml.length - 1;
  return { col: 'session_date', from: dayIso(hebToGreg(hy, 0, 1)),
           to: dayIso(hebToGreg(hy, last, b.ml[last])) };
}

function _hcH(d){
  var h=hebDate(d);
  return {hy:h.year,mi:h.monthIndex,day:h.day};}

function _hcYL(hy){return hebYearLabelFull(hy)||String(hy);}

function _hcFmt(hy,mi,day){return hebDayLabel(day)+' ב'+(_hcMN(hy)[mi]||'')+' '+_hcYL(hy);}

// שדה ריק מחזיר null ולא new Date() — אחרת «בלי תאריך סיום» הופך ל«מסתיים עכשיו» והסטטוס פג מיד.
// כל צרכני a.to_at מפרשים null כ«ללא תאריך סיום».
function _hcGet(pfx){
  var iso=(document.getElementById(pfx+'_iso')||{}).value;
  if(!iso) return null;
  var t=(document.getElementById(pfx+'_t')||{}).value;
  return iso+'T'+(t||'00:00');}

function _hcBuild(pfx,initH,tv){
  var label;
  if(initH){
    label=_hcFmt(initH.hy,initH.mi,initH.day);
    var g=hebToGreg(initH.hy,initH.mi,initH.day);
    if(g&&(pfx==='sfmF'||pfx==='sfmT'||pfx==='at_date'))label='יום '+HEB_DOW[g.getDay()]+' '+label;
  }else{label='בחר תאריך עברי';}
  var iso=g?dayIso(g):'';
  var trg='hc-trigger';
  return '<div class="hc-wrap">'+
    '<div id="'+pfx+'_trg" data-act="hc-open" data-pfx="'+esc(pfx)+'" data-pop-trg="'+esc(pfx)+'" class="'+trg+'">'+
      '<span id="'+pfx+'_lbl">'+label+'</span>'+
      '<span class="hc-trigger-ico">📅</span>'+
    '</div>'+
    '<input type="hidden" id="'+pfx+'_iso" value="'+iso+'">'+
    '<div id="'+pfx+'_pop" data-pop="'+esc(pfx)+'" class="hidden hc-pop-box hc-pop"></div>'+
    (tv!==undefined?'<div class="hc-time-row"><span class="hc-time-lbl">שעה:</span><input type="time" aria-label="שעה" id="'+pfx+'_t" value="'+(tv||'')+'" class="hc-time-inp"></div>':'')+
  '</div>';}

// התאריך העברי של יום נגזר ממנו בתצוגה ואינו נשמר — עוגן צהריים לפני החשבון.
function hrDayHeb(iso){return _hcH(dayNoon(String(iso)));}
function hrDayHebFmt(iso){if(!iso)return '';var h=hrDayHeb(iso);return _hcFmt(h.hy,h.mi,h.day);}
function hrSessHeb(rec){return hrDayHeb(rec.session_date);}
function hrSessHebFmt(rec){return hrDayHebFmt(rec&&rec.session_date);}

export { _hcBuild, _hcFmt, _hcGet, _hcH, _hcMN, _hcYL, hrDayHeb, hrDayHebFmt,
         hrHebMonthWin, hrHebYearWin, hrSessHeb, hrSessHebFmt };
