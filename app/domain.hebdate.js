// app/domain.hebdate.js — התאריך העברי: חלונות החודש והשנה, התוויות ובורר התאריך
import { dayIso, dayNoon } from '../core/util.js';
import { esc } from '../core/ui.js';
import { hebDate, hebDayLabel, hebIntl, hebIsLeap, hebMonthNames, hebYearBase,
         hebYearLabelFull } from '../core/hebrew.js';
import { S } from './state.js';

function _hcMN(hy){return hebMonthNames(hy);}

function hrHebYearInfo(hy){
  hy=+hy;
  if(S._hrYearCache[hy]!==undefined) return S._hrYearCache[hy];
  var info=null;
  try{
    var leap=hebIsLeap(hy),nM=leap?13:12,start=null,k,d,r;
    // א׳ תשרי חל תמיד בין 5.9 ל-5.10 בשנה הגרגוריאנית hy-3761
    for(k=0;k<45;k++){
      d=dayNoon(hy-3761,8,1+k);
      r=hebIntl(d);
      if(r&&r.hy===hy&&r.mi===0&&r.day===1){start=d;break;}
    }
    if(start){
      var ml=[],cur=start,total=0,ok=true;
      for(var m=0;m<nM;m++){
        var p=new Date(cur.getTime()+29*86400000);
        var pr=hebIntl(dayNoon(p));
        if(!pr){ok=false;break;}
        var len=(pr.day===1)?29:30;
        ml.push(len);total+=len;
        var nx=new Date(cur.getTime()+len*86400000);
        cur=dayNoon(nx);
      }
      if(ok&&ml.length===nM&&total>=353&&total<=385)
        info={hy:hy,jd:new Date(start.getFullYear(),start.getMonth(),start.getDate()),ml:ml,leap:leap};
    }
  }catch(e){info=null;}
  S._hrYearCache[hy]=info;
  return info;
}

// הטבלה נקראת דרך hebYearBase ולא ישירות — _hcST הוא מצב פנימי של המודול, וקריאה ישירה בו נשברת בלי לזרוק.
function _hcBase(hy){return hrHebYearInfo(hy)||hebYearBase(hy);}

// עוגן בצהריים ולא בחצות — הוספת כפולות של 24 שעות מחצות נופלת ליום הקודם במעבר לשעון חורף.
function _hcG(hy,mi,day){
  var b=_hcBase(hy);if(!b)return new Date();
  var c=0;for(var m=0;m<mi;m++)c+=b.ml[m];c+=day-1;
  var anchor=dayNoon(b.jd);
  var d=new Date(anchor.getTime()+c*86400000);
  return dayNoon(d);}

// חודש עברי הוא טווח גרגוריאני רציף — gte/lte על date_iso מכסים אותו בדיוק. המנוע הוא _hcG ולא חשבון ידני.
function hrHebMonthWin(hy, mi) {
  var b = _hcBase(hy);
  if (!b || !b.ml || !b.ml.length) return null;
  var i = Math.max(0, Math.min(mi, b.ml.length - 1));
  return { col: 'date_iso', from: dayIso(_hcG(hy, i, 1)),
           to: dayIso(_hcG(hy, i, b.ml[i])) };
}

function hrHebYearWin(hy) {
  var b = _hcBase(hy);
  if (!b || !b.ml || !b.ml.length) return null;
  var last = b.ml.length - 1;
  return { col: 'date_iso', from: dayIso(_hcG(hy, 0, 1)),
           to: dayIso(_hcG(hy, last, b.ml[last])) };
}

function _hcH(d){
  var h=hebDate(d);
  return {hy:h.year,mi:h.monthIndex,day:h.day};}

function _hcYL(hy){return hebYearLabelFull(hy)||String(hy);}

function _hcFmt(hy,mi,day){return hebDayLabel(day)+' ב'+(_hcMN(hy)[mi]||'')+' '+_hcYL(hy);}

// שדה ריק מחזיר null ולא new Date() — אחרת «בלי תאריך סיום» הופך ל«מסתיים עכשיו» והסטטוס פג מיד.
// כל צרכני a.to מפרשים null כ«ללא תאריך סיום».
function _hcGet(pfx){
  var iso=(document.getElementById(pfx+'_iso')||{}).value;
  if(!iso) return null;
  var t=(document.getElementById(pfx+'_t')||{}).value;
  return iso+'T'+(t||'00:00');}

function _hcBuild(pfx,initH,tv){
  var label;
  if(initH){
    label=_hcFmt(initH.hy,initH.mi,initH.day);
    if(pfx==='sfmF'||pfx==='sfmT'||pfx==='at_date'){var _BD_DOW=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];var _bdG=_hcG(initH.hy,initH.mi,initH.day);label='יום '+_BD_DOW[_bdG.getDay()]+' '+label;}
  }else{label='בחר תאריך עברי';}
  var iso='';
  if(initH){var g=_hcG(initH.hy,initH.mi,initH.day);iso=dayIso(g);}
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

export { _hcBase, _hcBuild, _hcFmt, _hcG, _hcGet, _hcH, _hcMN, _hcYL, hrHebMonthWin,
         hrHebYearWin };
