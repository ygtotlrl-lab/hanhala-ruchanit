// app/domain.arc.js — סדרים ושינה: הארכיון והייצוא, לשני הזרמים
import { MSG_DELETE, dayToday } from '../core/util.js';
import { idEq, tombKill } from '../core/sync.js';
import { ask, closeModal, esc, openModal, toast } from '../core/ui.js';
import { hebDayLabel } from '../core/hebrew.js';
import { MSG_EXPORT_FAIL, MSG_EXPORT_OK, MSG_EXPORT_PDF, MSG_EXPORT_XLS, MSG_NO_DATA_IN_RANGE,
         MSG_NO_EXPORT_DATA, MSG_ROW_DELETED } from './constants.js';
import { atvCls, getStudents, hrMarks, hrPdfFont, hrSortRecs, hrSortStudents } from './domain.js';
import { _hcBuild, _hcH, _hcMN, _hcYL, hrHebYearWin, hrSessHeb,
         hrSessHebFmt } from './domain.hebdate.js';
import { hrCachedArr, hrLoadData, hrMarkLabels, hrPullSessions, hrRenderTodaySessions, hrSaveData,
         hrSessionDefs, hrSortDayRecs, hrSortDays, hrSortHebMonths, hrSortHebYears,
         hrSummaryHTML } from './domain.sessions.js';

// ── ארכיון הסדרים ──
// קורא שמסר רשומות מקבל אותן כפי שהן — הוא כבר סינן, ורענון היה דורס.
async function hrRenderArchive(st, records) {
  var el=document.getElementById(st.p+'-arc-list');
  if(!el) return;
  if(records){ _hrPaintArchive(st, el, records, ''); return; }
  _hrPaintArchive(st, el, hrCachedArr(st.v+'Data',st.table)||[], '');
  var ok=await hrPullSessions(st, hrHebYearWin(_hcH(new Date()).hy));
  _hrPaintArchive(st, el, hrCachedArr(st.v+'Data',st.table)||[], ok?'':'⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר');
}

function _hrPaintArchive(st, el, records, warn) {
  var warnHTML=warn?'<div class="warn-note">'+esc(warn)+'</div>':'';
  if(records) records=records.filter(function(r){return !(r&&r.deleted);});
  if(!records||!records.length){
    el.innerHTML=warnHTML+'<div class="empty-note">אין רשומות</div>';return;
  }
  var students=getStudents();
  function nameById(id){var s=students.find(function(x){return String(x.client_id)===String(id);});return s?s.name:'?';}
  var LBL=hrMarkLabels(st);

  var todG=new Date();
  var todayIso=dayToday();
  var todH=_hcH(todG);
  var curHY=todH.hy, curMI=todH.mi;

  var byYear={};
  records.forEach(function(rec){
    var hd=hrSessHeb(rec);
    var hy=hd.hy,mi=hd.mi,iso=rec.session_date;
    if(!byYear[hy]) byYear[hy]={};
    if(!byYear[hy][mi]) byYear[hy][mi]={};
    if(!byYear[hy][mi][iso]) byYear[hy][mi][iso]=[];
    byYear[hy][mi][iso].push({rec:rec,hd:hd});
  });

  var years=hrSortHebYears(Object.keys(byYear).map(Number));
  var idCtr=0; function uid(){return st.p+'-arc-col-'+(idCtr++);}

  var html='<div>';
  years.forEach(function(hy){
    var yId=uid();
    var isYearCur=hy===curHY;
    html+='<div class="arc-year">';
    html+='<div data-act="toggle-panel" data-panel="'+esc(yId)+'" '+
      ' class="arc-year-head">'+
      '<span class="arc-head-lbl">📅 '+_hcYL(hy)+'</span><span class="arc-year-chev">▾</span>'+
    '</div>';
    html+='<div id="'+yId+'" class="'+(isYearCur?'':'hidden')+' arc-year-body">';

    var months=hrSortHebMonths(Object.keys(byYear[hy]).map(Number));
    months.forEach(function(mi){
      var mId=uid();
      var isMonthCur=isYearCur&&mi===curMI;
      var mName=_hcMN(hy)[mi];
      html+='<div class="arc-month">';
      html+='<div data-act="toggle-panel" data-panel="'+esc(mId)+'" '+
        ' class="arc-month-head">'+
        '<span class="arc-head-lbl">📆 '+mName+'</span><span class="arc-month-chev">▾</span>'+
      '</div>';
      html+='<div id="'+mId+'" class="'+(isMonthCur?'':'hidden')+' arc-month-body">';

      var defs=hrSessionDefs(st);
      var days=hrSortDays(Object.keys(byYear[hy][mi]));
      days.forEach(function(iso){
        var dId=uid();
        var entries=hrSortDayRecs(byYear[hy][mi][iso], defs, function(e){return e.rec;});
        var hd0=entries[0].hd;
        var dayLabel=hebDayLabel(hd0.day)+' '+mName;
        var isToday=iso===todayIso;
        html+='<div class="arc-day">';
        html+='<div data-act="toggle-panel" data-panel="'+esc(dId)+'" '+
          'class="arc-day-head '+(isToday?'arc-day-today':'arc-day-plain')+'">'+
          '<span class="arc-head-lbl">'+dayLabel+(isToday?' — <span class="arc-today">היום</span>':'')+
          ' <span class="arc-day-count">('+entries.length+' '+st.many+')</span></span>'+
          '<span class="arc-day-chev">▾</span>'+
        '</div>';
        html+='<div id="'+dId+'" class="'+(isToday?'':'hidden')+' arc-day-body">';

        entries.forEach(function(entry){
          var rec=entry.rec;
          var cnts={};
          Object.values(hrMarks(rec)).forEach(function(m){if(m.status)cnts[m.status]=(cnts[m.status]||0)+1;});
          var sId=uid();
          html+='<div class="arc-sess-card">';
          html+='<div class="arc-sess-head" data-act="toggle-panel" data-panel="'+esc(sId)+'">';
          html+='<span class="arc-sess-name">'+esc(rec.session)+'</span>';
          html+='<div class="arc-sess-summary">'+hrSummaryHTML(st, cnts)+'</div>';
          html+='<button data-act="'+st.p+'-del-session" data-id="'+esc(rec.client_id)+'" class="arc-sess-del">✕</button>';
          html+='</div>';
          html+='<div id="'+sId+'" class="arc-sess-body hidden">';
          var mk=hrMarks(rec);
          var rows=hrSortStudents(Object.keys(mk).map(function(sid2){
            var st2=students.find(function(x){return String(x.client_id)===String(sid2);});
            // תלמיד שנמחק אחרי הסדר נשאר בשורה — הסדר שנרשם הוא עובדה, והיעדרו נקרא כמי שלא סומן
            return st2||{client_id:sid2,name:nameById(sid2),cls:''};
          })).map(function(s2){
            var m2=mk[String(s2.client_id)]||{};
            var lbl=m2.status==='l'?('איחור — '+(m2.minutes||0)+' ד׳'):(LBL[m2.status]||'לא סומן');
            var noteStr=m2.note?(' — '+m2.note):'';
            return '<div class="arc-mark-row">'+
              '<span>'+esc(s2.name)+'</span><span class="'+atvCls(m2.status)+' arc-mark">'+esc(lbl)+esc(noteStr)+'</span></div>';
          });
          html+=rows.join('')+'</div></div>';
        });
        html+='</div></div>';
      });
      html+='</div></div>';
    });
    html+='</div></div>';
  });
  html+='</div>';
  el.innerHTML=warnHTML+html;
}

function hrDeleteSession(st, id) {
  ask(st.msg.delTitle, st.msg.delBody, MSG_DELETE)
    .then(function (yes) { if (yes) _hrDeleteSessionConfirmed(st, id); });
}

async function _hrDeleteSessionConfirmed(st, id) {
  var data=await hrLoadData(st);
  var rec=data.find(function(r){return idEq(r.client_id,id);});
  if(rec) tombKill(rec);
  await hrSaveData(st, data);
  hrRenderArchive(st);
  hrRenderTodaySessions(st);
  toast(MSG_ROW_DELETED, null, 'good');
}

// ── ייצוא ל-Excel ול-PDF ──
function hrShowExportDialog(st, type) {
  openModal(type==='pdf'?MSG_EXPORT_PDF:MSG_EXPORT_XLS,
     '<div class="exp-from"><div class="form-label">מתאריך</div>'+_hcBuild(st.p+'ExpF',null)+'</div>'
    +'<div class="exp-to"><div class="form-label">עד תאריך</div>'+_hcBuild(st.p+'ExpT',null)+'</div>'
    +'<div class="md-hint-center">השאר ריק לייצוא כל הנתונים</div>',
     '<button data-act="'+st.p+'-export-go" data-type="'+esc(type)+'" class="md-btn-go">ייצא</button>'
    +'<button data-act="modal-close" class="md-btn-cancel">ביטול</button>');
}

async function hrExportConfirm(st, type) {
  // שני השדות נקראים לפני הסגירה — closeModal מרוקן את הגוף
  var fromIso=(document.getElementById(st.p+'ExpF_iso')||{}).value||null;
  var toIso=(document.getElementById(st.p+'ExpT_iso')||{}).value||null;
  closeModal();
  if(type==='pdf') await _hrExportPdf(st,fromIso,toIso);
  else await _hrExportExcel(st,fromIso,toIso);
}

// הרשומות החיות בטווח, ממוינות — ו-null כשאין מה לייצא (וההודעה כבר ניתנה).
async function _hrExportRecs(st, fromIso, toIso) {
  var data=await hrLoadData(st);
  if(!data||!data.length){toast(MSG_NO_EXPORT_DATA);return null;}
  data=data.filter(function(r){return !(r&&r.deleted);});
  if(fromIso) data=data.filter(function(r){return r.session_date>=fromIso;});
  if(toIso)   data=data.filter(function(r){return r.session_date<=toIso;});
  if(!data.length){toast(MSG_NO_DATA_IN_RANGE);return null;}
  return hrSortRecs(data);
}

async function _hrExportExcel(st, fromIso, toIso) {
  try {
    var sorted=await _hrExportRecs(st, fromIso, toIso);
    if(!sorted) return;
    var students=getStudents();
    var LBL=hrMarkLabels(st);
    // SpreadsheetML (Excel 2003 XML) עם ss:RightToLeft=1
    function xmlEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function cell(v){return '<Cell><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>';}
    function numCell(v){return '<Cell><Data ss:Type="Number">'+xmlEsc(v)+'</Data></Cell>';}
    function hdrCell(v){return '<Cell ss:StyleID="hdr"><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>';}
    var HDR=['תאריך',st.one,'שם תלמיד','סטאטוס','דקות איחור'].concat(st.note?['הערה']:[],['ממלא']);
    var xmlRows='<Row>'+HDR.map(hdrCell).join('')+'</Row>';
    sorted.forEach(function(rec){
      var dLabel=hrSessHebFmt(rec);
      Object.entries(hrMarks(rec)).forEach(function(e){
        var sid=e[0],m=e[1];
        var sn=(students.find(function(x){return String(x.client_id)===String(sid);})||{}).name||sid;
        var mins=m.status==='l'?(m.minutes||0):'';
        xmlRows+='<Row>'+cell(dLabel)+cell(rec.session)+cell(sn)+cell(LBL[m.status]||'')+(mins!==''?numCell(mins):cell(''))+
          (st.note?cell(m.note||''):'')+cell(rec.filled_by_name||'')+'</Row>';
      });
    });
    var xml='<?xml version="1.0" encoding="UTF-8"?>';
    xml+='<?mso-application progid="Excel.Sheet"?>';
    xml+='<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"';
    xml+=' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"';
    xml+=' xmlns:x="urn:schemas-microsoft-com:office:excel">';
    xml+='<Styles>';
    xml+='<Style ss:ID="hdr"><Font ss:Bold="1"/><Alignment ss:Horizontal="Right"/></Style>';
    xml+='<Style ss:ID="def"><Alignment ss:Horizontal="Right"/></Style>';
    xml+='</Styles>';
    xml+='<Worksheet ss:Name="'+st.sheet+'" ss:RightToLeft="1">';
    xml+='<Table ss:DefaultColumnWidth="80">';
    xml+='<Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="160"/><Column ss:Width="70"/><Column ss:Width="70"/>'+
      (st.note?'<Column ss:Width="120"/>':'')+'<Column ss:Width="110"/>';
    xml+=xmlRows;
    xml+='</Table></Worksheet></Workbook>';
    var blob=new Blob(['﻿'+xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download=st.file+'-'+dayToday()+'.xls';
    document.body.appendChild(a); a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},100);
    toast(MSG_EXPORT_OK, null, 'good');
  } catch(e){console.error('[excel]',e); toast(MSG_EXPORT_FAIL+e.message, null, 'bad');}
}

// כותרת ה-PDF — שורה ראשונה גדולה ושאר השורות קטנות; מתחת לאחרונה — הטווח, או אוויר.
async function _hrExportPdf(st, fromIso, toIso) {
  try {
    var sorted=await _hrExportRecs(st, fromIso, toIso);
    if(!sorted) return;
    var NB=' ';
    var fontName=hrPdfFont();
    function nb(s){return (s||'').replace(/ /g,NB);}
    function cell(s,opts){return Object.assign({text:nb(String(s==null?'':s)),alignment:'right'},opts||{});}
    var hdrRow=[
      cell('#',{bold:true}),cell('תאריך',{bold:true}),cell(st.one,{bold:true}),
      cell('נוכחים',{bold:true,color:'#276749'}),cell(st.absMany,{bold:true,color:'#742a2a'}),cell('מאחרים',{bold:true,color:'#dd6b20'})
    ];
    var body=[hdrRow];
    sorted.forEach(function(rec,i){
      var ms=Object.values(hrMarks(rec));
      var p=ms.filter(function(m){return m.status==='p';}).length;
      var ab=ms.filter(function(m){return m.status==='e'||m.status==='x';}).length;
      var l=ms.filter(function(m){return m.status==='l';}).length;
      body.push([cell(i+1),cell(hrSessHebFmt(rec)),cell(rec.session),cell(p),cell(ab),cell(l)]);
    });
    var ranged=!!(fromIso||toIso), last=st.pdfHead.length-1;
    var contentArr=st.pdfHead.map(function(txt,i){
      var bottom=i<last?4:(ranged?2:14);
      return i===0
        ? {text:nb(txt),fontSize:18,bold:true,alignment:'center',margin:[0,0,0,bottom],color:'#1a3a6b'}
        : {text:nb(txt),direction:'rtl',fontSize:11,alignment:'center',color:'#555',margin:[0,0,0,bottom]};
    });
    if(ranged){
      contentArr.push({text:[
        {text:'('},
        {text:fromIso||'תחילה',direction:'ltr'},
        {text:' — '},
        {text:toIso||'סוף',direction:'ltr'},
        {text:')'}
      ],alignment:'center',fontSize:10,color:'#777',margin:[0,0,0,14]});
    }
    contentArr.push({table:{widths:['auto','auto','*','auto','auto','auto'],body:body},margin:[0,0,0,10]});
    var dd={pageSize:'A4',pageMargins:[40,40,40,40],
      content:contentArr,defaultStyle:{font:fontName,alignment:'right'}};
    pdfMake.createPdf(dd).download(st.file+'-'+dayToday()+'.pdf');
  } catch(e){toast(MSG_EXPORT_FAIL+e.message, null, 'bad');}
}

export { hrDeleteSession, hrExportConfirm, hrRenderArchive, hrShowExportDialog };
