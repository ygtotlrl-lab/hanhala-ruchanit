// app/screens/sleep.arc.js — שינה — הארכיון והייצוא
import { MSG_DELETE, dayToday } from '../../core/util.js';
import { idEq, tombKill } from '../../core/sync.js';
import { ask, closeModal, esc, openModal, toast } from '../../core/ui.js';
import { hebDayLabel } from '../../core/hebrew.js';
import { MSG_DEL_ROW_BODY, MSG_DEL_ROW_TITLE, MSG_EXPORT_FAIL, MSG_EXPORT_OK,
         MSG_EXPORT_PDF, MSG_EXPORT_XLS, MSG_NO_DATA_IN_RANGE, MSG_NO_EXPORT_DATA,
         MSG_ROW_DELETED } from '../constants.js';
import { atvCls, getStudents, hrMarks, hrPdfFont, hrSortRecs, hrSortStudents } from '../domain.js';
import { _hcBuild, _hcH, _hcMN, _hcYL, hrHebYearWin, hrSessHeb,
         hrSessHebFmt } from '../domain.hebdate.js';
import { hrCachedArr, hrLoadData, hrSaveData, hrSortDayRecs, hrSortDays, hrSortHebMonths,
         hrSortHebYears } from '../domain.sessions.js';
import { _hrPullSessions, hrRenderTodaySessions, hrSessionDefs,
         hrSummaryHTML } from './sleep.js';

// ── שינה — ארכיון הסדרים ──
// קורא שמסר רשומות מקבל אותן כפי שהן — הוא כבר סינן, ורענון היה דורס.
async function hrRenderArchive(records) {
  var el=document.getElementById('sl-arc-list');
  if(!el) return;
  if(records){ _hrPaintArchive(el, records, ''); return; }
  _hrPaintArchive(el, hrCachedArr('_hrData','hr_sleep_sessions')||[], '');
  var _okArc=await _hrPullSessions(hrHebYearWin(_hcH(new Date()).hy));
  _hrPaintArchive(el, hrCachedArr('_hrData','hr_sleep_sessions')||[], _okArc?'':'⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר');
}

function _hrPaintArchive(el, records, warn) {
  var warnHTML=warn?'<div class="warn-note">'+esc(warn)+'</div>':'';
  if(records) records=records.filter(function(r){return !(r&&r.deleted);});
  if(!records||!records.length){
    el.innerHTML=warnHTML+'<div class="empty-note">אין רשומות</div>';return;
  }
  var students=getStudents();
  function nameById(id){var s=students.find(function(x){return String(x.client_id)===String(id);});return s?s.name:'?';}
  var ARC_LBL={p:'נוכח',l:'איחור',e:'חיסור',x:'אירוע',ap:'אישור',ak:'בבית',a:'מנוחה'};

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
  var idCtr=0; function uid(){return 'sl-arc-col-'+(idCtr++);}

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

      var _arcDefs=hrSessionDefs();
      var days=hrSortDays(Object.keys(byYear[hy][mi]));
      days.forEach(function(iso){
        var dId=uid();
        var entries=hrSortDayRecs(byYear[hy][mi][iso], _arcDefs, function(e){return e.rec;});
        var hd0=entries[0].hd;
        var dayLabel=hebDayLabel(hd0.day)+' '+mName;
        var isToday=iso===todayIso;
        html+='<div class="arc-day">';
        html+='<div data-act="toggle-panel" data-panel="'+esc(dId)+'" '+
          'class="arc-day-head '+(isToday?'arc-day-today':'arc-day-plain')+'">'+
          '<span class="arc-head-lbl">'+dayLabel+(isToday?' — <span class="arc-today">היום</span>':'')+
          ' <span class="arc-day-count">('+entries.length+' דוחות)</span></span>'+
          '<span class="arc-day-chev">▾</span>'+
        '</div>';
        html+='<div id="'+dId+'" class="'+(isToday?'':'hidden')+' arc-day-body">';

        entries.forEach(function(entry){
          var rec=entry.rec;
          var cnts={};
          Object.values(hrMarks(rec)).forEach(function(m){if(m.status)cnts[m.status]=(cnts[m.status]||0)+1;});
          var summaryHTML=hrSummaryHTML(cnts);
          var sId=uid();
          html+='<div class="arc-sess-card">';
          html+='<div class="arc-sess-head" data-act="toggle-panel" data-panel="'+esc(sId)+'">';
          html+='<span class="arc-sess-name">'+esc(rec.session)+'</span>';
          html+='<div class="arc-sess-summary">'+summaryHTML+'</div>';
          html+='<button data-act="sl-del-session" data-id="'+esc(rec.client_id)+'" class="arc-sess-del">✕</button>';
          html+='</div>';
          html+='<div id="'+sId+'" class="arc-sess-body hidden">';
          var _mk2=hrMarks(rec);
          var rows=hrSortStudents(Object.keys(_mk2).map(function(sid2){
            var _st2=students.find(function(x){return String(x.client_id)===String(sid2);});
            // תלמיד שנמחק אחרי הסדר נשאר בשורה — הסדר שנרשם הוא עובדה, והיעדרו נקרא כמי שלא סומן
            return _st2||{client_id:sid2,name:nameById(sid2),cls:''};
          })).map(function(_s2){
            var sid2=String(_s2.client_id),m2=_mk2[sid2]||{};
            var sn=_s2.name;
            var lbl=m2.status==='l'?('איחור — '+(m2.minutes||0)+' ד׳'):(ARC_LBL[m2.status]||'לא סומן');
            var noteStr=m2.note?(' — '+m2.note):'';
            var mkc=atvCls(m2.status);
            return '<div class="arc-mark-row">'+
              '<span>'+esc(sn)+'</span><span class="'+mkc+' arc-mark">'+esc(lbl)+esc(noteStr)+'</span></div>';
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

function hrDeleteSession(id) {
  ask(MSG_DEL_ROW_TITLE, MSG_DEL_ROW_BODY, MSG_DELETE)
    .then(function (yes) { if (yes) hrDeleteSessionConfirmed(id); });
}

async function hrDeleteSessionConfirmed(id) {
  var data=await hrLoadData();
  var _dRec=data.find(function(r){return idEq(r.client_id,id);});
  if(_dRec) tombKill(_dRec);
  await hrSaveData(data);
  hrRenderArchive();
  hrRenderTodaySessions();
  toast(MSG_ROW_DELETED, null, 'good');
}

// ── שינה — ייצוא ל-Excel ול-PDF ──
function hrShowExportDialog(type) {
  openModal(type==='pdf'?MSG_EXPORT_PDF:MSG_EXPORT_XLS,
    '<div class="exp-from"><div class="form-label">מתאריך</div>'+_hcBuild('hrExpF',null)+'</div>'+
    '<div class="exp-to"><div class="form-label">עד תאריך</div>'+_hcBuild('hrExpT',null)+'</div>'+
    '<div class="md-hint-center">השאר ריק לייצוא כל הנתונים</div>',
    '<button data-act="sl-export-go" data-type="'+esc(type)+'" class="md-btn-go">ייצא</button>'+
    '<button data-act="modal-close" class="md-btn-cancel">ביטול</button>');
}

// שני השדות נקראים לפני הסגירה — closeModal מרוקן את הגוף
function hrExportConfirm(type) {
  var fromIso=(document.getElementById('hrExpF_iso')||{}).value||null;
  var toIso=(document.getElementById('hrExpT_iso')||{}).value||null;
  closeModal();
  if(type==='pdf') hrExportPdf(fromIso,toIso);
  else hrExportExcel(fromIso,toIso);
}

async function hrExportExcel(fromIso,toIso) {
  try {
    var data=await hrLoadData();
    var students=getStudents();
    if(!data||!data.length){toast(MSG_NO_EXPORT_DATA);return;}
    data=data.filter(function(r){return !(r&&r.deleted);});
    if(fromIso) data=data.filter(function(r){return r.session_date>=fromIso;});
    if(toIso)   data=data.filter(function(r){return r.session_date<=toIso;});
    if(!data.length){toast(MSG_NO_DATA_IN_RANGE);return;}
    var sorted=hrSortRecs(data);
    function xmlEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function cell(v){return '<Cell><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>';}
    function numCell(v){return '<Cell><Data ss:Type="Number">'+xmlEsc(v)+'</Data></Cell>';}
    function hdrCell(v){return '<Cell ss:StyleID="hdr"><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>';}
    var HDR=['תאריך','דו"ח','שם תלמיד','סטאטוס','דקות איחור','הערה','ממלא'];
    var xmlRows='<Row>'+HDR.map(hdrCell).join('')+'</Row>';
    sorted.forEach(function(rec){
      var dLabel=hrSessHebFmt(rec);
      Object.entries(hrMarks(rec)).forEach(function(e){
        var sid=e[0],m=e[1];
        var sn=(students.find(function(x){return String(x.client_id)===String(sid);})||{}).name||sid;
        var lbl=m.status==='p'?'נוכח':m.status==='l'?'איחור':m.status==='e'?'חיסור':m.status==='x'?'אירוע':m.status==='ap'?'אישור':m.status==='ak'?'בבית':m.status==='a'?'מנוחה':'';
        var mins=m.status==='l'?(m.minutes||0):'';
        xmlRows+='<Row>'+cell(dLabel)+cell(rec.session)+cell(sn)+cell(lbl)+(mins!==''?numCell(mins):cell(''))+cell(m.note||'')+cell(rec.filled_by_name||'')+'</Row>';
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
    xml+='<Worksheet ss:Name="שינה" ss:RightToLeft="1">';
    xml+='<Table ss:DefaultColumnWidth="80">';
    xml+='<Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="160"/><Column ss:Width="70"/><Column ss:Width="70"/><Column ss:Width="120"/><Column ss:Width="110"/>';
    xml+=xmlRows;
    xml+='</Table></Worksheet></Workbook>';
    var blob=new Blob(['\uFEFF'+xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='shinah-'+dayToday()+'.xls';
    document.body.appendChild(a); a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},100);
    toast(MSG_EXPORT_OK, null, 'good');
  } catch(e){toast(MSG_EXPORT_FAIL+e.message, null, 'bad');}
}

async function hrExportPdf(fromIso,toIso) {
  try {
    var data=await hrLoadData();
    var students=getStudents();
    if(!data||!data.length){toast(MSG_NO_EXPORT_DATA);return;}
    data=data.filter(function(r){return !(r&&r.deleted);});
    if(fromIso) data=data.filter(function(r){return r.session_date>=fromIso;});
    if(toIso)   data=data.filter(function(r){return r.session_date<=toIso;});
    if(!data.length){toast(MSG_NO_DATA_IN_RANGE);return;}
    var sorted=hrSortRecs(data);
    var NB=' ';
    var fontName=hrPdfFont();
    function nb(s){return (s||'').replace(/ /g,NB);}
    function cell(s,opts){return Object.assign({text:nb(String(s==null?'':s)),alignment:'right'},opts||{});}
    var hdrRow=[
      cell('#',{bold:true}),cell('תאריך',{bold:true}),cell('דו"ח',{bold:true}),
      cell('נוכחים',{bold:true,color:'#276749'}),cell('אירועים',{bold:true,color:'#742a2a'}),cell('מאחרים',{bold:true,color:'#dd6b20'})
    ];
    var body=[hdrRow];
    sorted.forEach(function(rec,i){
      var dLabel=hrSessHebFmt(rec);
      var p=Object.values(hrMarks(rec)).filter(function(m){return m.status==='p';}).length;
      var ab=Object.values(hrMarks(rec)).filter(function(m){return m.status==='e'||m.status==='x';}).length;
      var l=Object.values(hrMarks(rec)).filter(function(m){return m.status==='l';}).length;
      body.push([cell(i+1),cell(dLabel),cell(rec.session),cell(p),cell(ab),cell(l)]);
    });
    var contentArr=[
      {text:nb('ארכיון זמן שינה'),fontSize:18,bold:true,alignment:'center',margin:[0,0,0,4],color:'#1a3a6b'}
    ];
    if(fromIso||toIso){
      contentArr.push({text:[
        {text:'('},
        {text:fromIso||'תחילה',direction:'ltr'},
        {text:' — '},
        {text:toIso||'סוף',direction:'ltr'},
        {text:')'}
      ],alignment:'center',fontSize:10,color:'#777',margin:[0,0,0,14]});
    } else {
      contentArr[0].margin=[0,0,0,14];
    }
    contentArr.push({table:{widths:['auto','auto','*','auto','auto','auto'],body:body},margin:[0,0,0,10]});
    var dd={pageSize:'A4',pageMargins:[40,40,40,40],
      content:contentArr,defaultStyle:{font:fontName,alignment:'right'}};
    pdfMake.createPdf(dd).download('shinah-'+dayToday()+'.pdf');
  } catch(e){toast(MSG_EXPORT_FAIL+e.message, null, 'bad');}
}

export { hrDeleteSession, hrExportConfirm, hrRenderArchive, hrShowExportDialog };
