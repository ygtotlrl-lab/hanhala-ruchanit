// app/screens/attend.arc.js — סדרים — הארכיון והייצוא
import { MSG_DELETE, dayToday } from '../../core/util.js';
import { idEq } from '../../core/sync.js';
import { ask, closeModal, esc, openModal, toast } from '../../core/ui.js';
import { MSG_DEL_SESSION_BODY, MSG_DEL_SESSION_TITLE, MSG_EXPORT_FAIL, MSG_EXPORT_OK,
         MSG_EXPORT_PDF, MSG_EXPORT_XLS, MSG_NO_DATA_IN_RANGE, MSG_NO_EXPORT_DATA,
         MSG_ROW_DELETED } from '../config.js';
import { _hcMN, hrHebYearWin, hrMarks, hrPdfFont, hrWho } from '../domain.js';
import { _atPullSessions, atLoadData, atRenderTodaySessions, atSaveData,
         atSortedSessions, atSummaryHtml, hrCachedArr } from './attend.reg.js';
import { getStudents, hrSortStudents } from './students.js';
import { HE, _hcBuild, _hcFmt, _hcH, _hcYL, atvCls } from '../main.js';

// ── נוכחות — ארכיון הסדרים ──
// קורא שמסר רשומות מקבל אותן כפי שהן — הוא כבר סינן, ורענון היה דורס.
async function atRenderArchive(records) {
  var el=document.getElementById('at-arc-list');
  if(!el) return;
  if(records){ _atPaintArchive(el, records, ''); return; }
  _atPaintArchive(el, hrCachedArr('_atData','hr_sessions')||[], '');
  var _okArc=await _atPullSessions(hrHebYearWin(_hcH(new Date()).hy));
  _atPaintArchive(el, hrCachedArr('_atData','hr_sessions')||[], _okArc?'':'⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר');
}

function _atPaintArchive(el, records, warn) {
  var warnHtml=warn?'<div class="warn-note">'+esc(warn)+'</div>':'';
  if(records) records=records.filter(function(r){return !(r&&r.deleted);});
  if(!records||!records.length){
    el.innerHTML=warnHtml+'<div class="empty-note">אין רשומות</div>';return;
  }
  var students=getStudents();
  function nameById(id){var s=students.find(function(x){return String(x.id)===String(id);});return s?s.name:'?';}
  var ARC_LBL={p:'נוכח',l:'איחור',e:'חיסור',x:'היעדרות',ap:'אישור',ak:'בבית',a:'מנוחה'};

  var todG=new Date();
  var todayIso=dayToday();
  var todH=_hcH(todG);
  var curHY=todH.hy, curMI=todH.mi;

  var byYear={};
  records.forEach(function(rec){
    var hd=rec.date_heb;
    if(!hd||!hd.hy){var p=rec.date_iso.split('-');hd=_hcH(new Date(+p[0],+p[1]-1,+p[2]));}
    var hy=hd.hy,mi=hd.mi,iso=rec.date_iso;
    if(!byYear[hy]) byYear[hy]={};
    if(!byYear[hy][mi]) byYear[hy][mi]={};
    if(!byYear[hy][mi][iso]) byYear[hy][mi][iso]=[];
    byYear[hy][mi][iso].push({rec:rec,hd:hd});
  });

  var years=Object.keys(byYear).map(Number).sort(function(a,b){return b-a;});
  var idCtr=0; function uid(){return 'arc-col-'+(idCtr++);}

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

    var months=Object.keys(byYear[hy]).map(Number).sort(function(a,b){return b-a;});
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

      var _arcSessOrder={};
      atSortedSessions().forEach(function(s,i){_arcSessOrder[s.name]=i;});
      var days=Object.keys(byYear[hy][mi]).sort(function(a,b){return HE.compare(b,a);});
      days.forEach(function(iso){
        var dId=uid();
        var entries=byYear[hy][mi][iso].slice().sort(function(a,b){
          var ia=_arcSessOrder[a.rec.session]!=null?_arcSessOrder[a.rec.session]:999;
          var ib=_arcSessOrder[b.rec.session]!=null?_arcSessOrder[b.rec.session]:999;
          return ia-ib;
        });
        var hd0=entries[0].hd;
        var dayLabel=window.hebDayLabel(hd0.day)+' '+mName;
        var isToday=iso===todayIso;
        html+='<div class="arc-day">';
        html+='<div data-act="toggle-panel" data-panel="'+esc(dId)+'" '+
          'class="arc-day-head '+(isToday?'arc-day-today':'arc-day-plain')+'">'+
          '<span class="arc-head-lbl">'+dayLabel+(isToday?' — <span class="arc-today">היום</span>':'')+
          ' <span class="arc-day-count">('+entries.length+' סדרים)</span></span>'+
          '<span class="arc-day-chev">▾</span>'+
        '</div>';
        html+='<div id="'+dId+'" class="'+(isToday?'':'hidden')+' arc-day-body">';

        entries.forEach(function(entry){
          var rec=entry.rec;
          var cnts={};
          Object.values(hrMarks(rec)).forEach(function(m){if(m.s)cnts[m.s]=(cnts[m.s]||0)+1;});
          var summaryHtml=atSummaryHtml(cnts);
          var sId=uid();
          html+='<div class="arc-sess-card">';
          html+='<div class="arc-sess-head" data-act="toggle-panel" data-panel="'+esc(sId)+'">';
          html+='<span class="arc-sess-name">'+esc(rec.session)+'</span>';
          html+='<div class="arc-sess-summary">'+summaryHtml+'</div>';
          html+='<button data-act="at-del-session" data-id="'+esc(rec.id)+'" class="arc-sess-del">✕</button>';
          html+='</div>';
          html+='<div id="'+sId+'" class="arc-sess-body hidden">';
          var _mk2=hrMarks(rec);
          var rows=hrSortStudents(Object.keys(_mk2).map(function(sid2){
            var _st2=students.find(function(x){return String(x.id)===String(sid2);});
            // תלמיד שנמחק אחרי הסדר נשאר בשורה — הסדר שנרשם הוא עובדה, והיעדרו נקרא כמי שלא סומן
            return _st2||{id:sid2,name:nameById(sid2),cls:''};
          })).map(function(_s2){
            var sid2=String(_s2.id),m2=_mk2[sid2]||{};
            var sn=_s2.name;
            var lbl=m2.s==='l'?('איחור — '+(m2.min||0)+' ד׳'):(ARC_LBL[m2.s]||'לא סומן');
            var mkc=atvCls(m2.s);
            return '<div class="arc-mark-row">'+
              '<span>'+esc(sn)+'</span><span class="'+mkc+' arc-mark">'+esc(lbl)+'</span></div>';
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
  el.innerHTML=warnHtml+html;
}

function atDeleteSession(id) {
  ask(MSG_DEL_SESSION_TITLE, MSG_DEL_SESSION_BODY, MSG_DELETE)
    .then(function (yes) { if (yes) atDeleteSessionConfirmed(id); });
}

async function atDeleteSessionConfirmed(id) {
  var data=await atLoadData();
  var _dRec=data.find(function(r){return idEq(r.id,id);});
  if(_dRec){_dRec.deleted=true;_dRec.updatedAt=Date.now();_dRec.deletedBy=hrWho();}
  await atSaveData(data);
  atRenderArchive();
  atRenderTodaySessions();
  toast(MSG_ROW_DELETED, null, 'good');
}

// ── נוכחות — ייצוא ל-Excel ול-PDF ──
function atShowExportDialog(type) {
  openModal(type==='pdf'?MSG_EXPORT_PDF:MSG_EXPORT_XLS,
     '<div class="exp-from"><div class="form-label">מתאריך</div>'+_hcBuild('expF',null)+'</div>'
    +'<div class="exp-to"><div class="form-label">עד תאריך</div>'+_hcBuild('expT',null)+'</div>'
    +'<div class="md-hint-center">השאר ריק לייצוא כל הנתונים</div>',
     '<button data-act="at-export-go" data-type="'+esc(type)+'" class="md-btn-go">ייצא</button>'
    +'<button data-act="modal-close" class="md-btn-cancel">ביטול</button>');
}

async function atExportConfirm(type) {
  var fromIso=(document.getElementById('expF_iso')||{}).value||null;
  var toIso=(document.getElementById('expT_iso')||{}).value||null;
  // שני השדות נקראים לפני הסגירה — closeModal מרוקן את הגוף
  closeModal();
  if(type==='excel') await atExportExcel(fromIso,toIso);
  else await atExportPdf(fromIso,toIso);
}

async function atExportExcel(fromIso,toIso) {
  try {
    var data=await atLoadData();
    var students=getStudents();
    if(!data||!data.length){toast(MSG_NO_EXPORT_DATA);return;}
    data=data.filter(function(r){return !(r&&r.deleted);});
    if(fromIso) data=data.filter(function(r){return r.date_iso>=fromIso;});
    if(toIso)   data=data.filter(function(r){return r.date_iso<=toIso;});
    if(!data.length){toast(MSG_NO_DATA_IN_RANGE);return;}
    var sorted=data.slice().sort(function(a,b){return HE.compare(a.date_iso,b.date_iso);});
    // SpreadsheetML (Excel 2003 XML) עם ss:RightToLeft=1
    function xmlEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function cell(v){return '<Cell><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>';}
    function numCell(v){return '<Cell><Data ss:Type="Number">'+xmlEsc(v)+'</Data></Cell>';}
    function hdrCell(v){return '<Cell ss:StyleID="hdr"><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>';}
    var HDR=['תאריך','סדר','שם תלמיד','סטאטוס','דקות איחור','ממלא'];
    var xmlRows='<Row>'+HDR.map(hdrCell).join('')+'</Row>';
    sorted.forEach(function(rec){
      var hd=rec.date_heb;
      var dLabel=hd?_hcFmt(hd.hy,hd.mi,hd.day):rec.date_iso;
      Object.entries(hrMarks(rec)).forEach(function(e){
        var sid=e[0],m=e[1];
        var sn=(students.find(function(x){return String(x.id)===String(sid);})||{}).name||sid;
        var lbl=m.s==='p'?'נוכח':m.s==='l'?'איחור':m.s==='e'?'חיסור':m.s==='x'?'היעדרות':m.s==='ap'?'אישור':m.s==='ak'?'בבית':m.s==='a'?'מנוחה':'';
        var mins=m.s==='l'?(m.min||0):'';
        xmlRows+='<Row>'+cell(dLabel)+cell(rec.session)+cell(sn)+cell(lbl)+(mins!==''?numCell(mins):cell(''))+cell(rec.filled_by_name||'')+'</Row>';
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
    xml+='<Worksheet ss:Name="סדרים" ss:RightToLeft="1">';
    xml+='<Table ss:DefaultColumnWidth="80">';
    xml+='<Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="160"/><Column ss:Width="70"/><Column ss:Width="70"/><Column ss:Width="110"/>';
    xml+=xmlRows;
    xml+='</Table></Worksheet></Workbook>';
    var blob=new Blob(['\uFEFF'+xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='sdariim-'+dayToday()+'.xls';
    document.body.appendChild(a); a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},100);
    toast(MSG_EXPORT_OK, null, 'good');
  } catch(e){console.error('[excel]',e); toast(MSG_EXPORT_FAIL+e.message, null, 'bad');}
}

async function atExportPdf(fromIso,toIso) {
  try {
    var data=await atLoadData();
    var students=getStudents();
    if(!data||!data.length){toast(MSG_NO_EXPORT_DATA);return;}
    data=data.filter(function(r){return !(r&&r.deleted);});
    if(fromIso) data=data.filter(function(r){return r.date_iso>=fromIso;});
    if(toIso) data=data.filter(function(r){return r.date_iso<=toIso;});
    if(!data.length){toast(MSG_NO_DATA_IN_RANGE);return;}
    var sorted=data.slice().sort(function(a,b){return HE.compare(a.date_iso,b.date_iso);});
    var NB=' ';
    var fontName=hrPdfFont();
    function nb(s){return (s||'').replace(/ /g,NB);}
    function cell(s,opts){return Object.assign({text:nb(String(s)),alignment:'right'},opts||{});}
    var hdrRow=[
      cell('#',{bold:true}),cell('תאריך',{bold:true}),cell('סדר',{bold:true}),
      cell('נוכחים',{bold:true,color:'#276749'}),cell('חיסורים',{bold:true,color:'#742a2a'}),cell('מאחרים',{bold:true,color:'#dd6b20'})
    ];
    var body=[hdrRow];
    sorted.forEach(function(rec,i){
      var hd=rec.date_heb;
      var dLabel=hd?_hcFmt(hd.hy,hd.mi,hd.day):rec.date_iso;
      var p=Object.values(hrMarks(rec)).filter(function(m){return m.s==='p';}).length;
      var ab=Object.values(hrMarks(rec)).filter(function(m){return m.s==='e'||m.s==='x';}).length;
      var l=Object.values(hrMarks(rec)).filter(function(m){return m.s==='l';}).length;
      body.push([cell(i+1),cell(dLabel),cell(rec.session),cell(p),cell(ab),cell(l)]);
    });
    var contentArr=[
      {text:nb('ישיבת תומכי תמימים ראשל"צ'),fontSize:18,bold:true,alignment:'center',margin:[0,0,0,4],color:'#1a3a6b'},
      {text:nb('ארכיון שמירת סדרים'),direction:'rtl',fontSize:11,alignment:'center',color:'#555',margin:[0,0,0,fromIso||toIso?2:14]}
    ];
    if(fromIso||toIso){
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
    pdfMake.createPdf(dd).download('sdariim-'+dayToday()+'.pdf');
  } catch(e){toast(MSG_EXPORT_FAIL+e.message, null, 'bad');}
}

export { atDeleteSession, atExportConfirm, atRenderArchive, atShowExportDialog };
