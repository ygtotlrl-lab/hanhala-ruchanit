// app/domain.arc.js — סדרים ושינה: הארכיון והייצוא, לשני הזרמים
import { MSG_DELETE, dayToday } from '../core/util.js';
import { idEq, tombKill } from '../core/sync.js';
import { ask, closeModal, esc, openModal, toast } from '../core/ui.js';
import { exportPdf, exportXlsx } from '../core/export.js';
import { hebDayLabel } from '../core/hebrew.js';
import { HR_CLS_NAME, HR_EXAM_SUBJECTS, HR_ORG, MSG_EXPORT_FAIL, MSG_EXPORT_PDF, MSG_PDF_BUILDING, MSG_PDF_FAIL, MSG_EXPORT_XLS, MSG_NO_DATA_IN_RANGE, MSG_NO_EXPORT_DATA, MSG_PULL_STALE, MSG_ROW_DELETED } from './constants.js';
import { atvCls, getStudents, hrDayWin, hrMarks, hrSortRecs, hrSortStudents } from './domain.js';
import { _hcBuild, _hcH, _hcMN, _hcYL, hrDayHebFmt, hrHebYearWin, hrSessHeb,
         hrSessHebFmt, hrTodayHebFmt } from './domain.hebdate.js';
import { hrCachedArr, hrIsLate, hrLoadData, hrMarkLabels, hrPullSessions, hrRenderTodaySessions, hrSaveData,
         hrSessionDefs, hrSortDayRecs, hrSortDays, hrSortHebMonths, hrSortHebYears,
         hrExamGrp, hrExamSummaryHTML, hrRecLabel, hrSummaryHTML } from './domain.sessions.js';
import { hrEditSession, hrShowTab } from './domain.reg.js';
import { hrStudentOn } from './domain.periods.js';
import { S } from './state.js';
import { icon } from './icons.js';
import { stIcon } from '../core/icons.js';

// ── ארכיון הסדרים ──
// קורא שמסר רשומות מקבל אותן כפי שהן — הוא כבר סינן, ורענון היה דורס.
async function hrRenderArchive(st, records) {
  var el=document.getElementById(st.p+'-arc-list');
  if(!el) return;
  if(records){ _hrPaintArchive(st, el, records, ''); return; }
  _hrPaintArchive(st, el, hrCachedArr(st.v+'Data',st.table)||[], '');
  var ok=await hrPullSessions(st, hrHebYearWin(_hcH(new Date()).hy));
  _hrPaintArchive(st, el, hrCachedArr(st.v+'Data',st.table)||[], ok?'':MSG_PULL_STALE);
}

function _hrPaintArchive(st, el, records, warn) {
  // הרענון שאחרי המשיכה אינו סוגר מה שהמשתמש פתח — המזהים יציבים, ומצב כל לוח נלכד לפני הציור ומוחל אחריו
  var shown={};
  el.querySelectorAll('[data-panel]').forEach(function(h){
    var b=document.getElementById(h.getAttribute('data-panel'));
    if(b) shown[b.id]=!b.classList.contains('hidden');
  });
  var warnHTML=warn?'<div class="warn-note">'+stIcon('warn')+esc(warn)+'</div>':'';
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
  function uid(key){return st.p+'-arc-'+String(key).replace(/[^A-Za-z0-9_-]/g,'_');}

  var html='<div>';
  years.forEach(function(hy){
    var yId=uid('y'+hy);
    var isYearCur=hy===curHY;
    html+='<div class="arc-year">';
    html+='<div data-act="toggle-panel" data-panel="'+esc(yId)+'" '+
      ' class="arc-year-head">'+
      '<span class="arc-head-lbl">'+_hcYL(hy)+'</span><span class="arc-year-chev">'+icon('down')+'</span>'+
    '</div>';
    html+='<div id="'+yId+'" class="'+(isYearCur?'':'hidden')+' arc-year-body">';

    var months=hrSortHebMonths(Object.keys(byYear[hy]).map(Number));
    months.forEach(function(mi){
      var mId=uid('m'+hy+'_'+mi);
      var isMonthCur=isYearCur&&mi===curMI;
      var mName=_hcMN(hy)[mi];
      html+='<div class="arc-month">';
      html+='<div data-act="toggle-panel" data-panel="'+esc(mId)+'" '+
        ' class="arc-month-head">'+
        '<span class="arc-head-lbl">'+mName+'</span><span class="arc-month-chev">'+icon('down')+'</span>'+
      '</div>';
      html+='<div id="'+mId+'" class="'+(isMonthCur?'':'hidden')+' arc-month-body">';

      // מבחנים — כמו בחודש עצמו: לימוד ככותרת, ושורה לכל שיעור, ולא לפי ימים
      if(st.exam){ html+=_hrExamMonthHTML(st, byYear[hy][mi], uid, students)+'</div></div>'; return; }
      var defs=hrSessionDefs(st);
      var days=hrSortDays(Object.keys(byYear[hy][mi]));
      days.forEach(function(iso){
        var dId=uid('d'+iso);
        var entries=hrSortDayRecs(byYear[hy][mi][iso], defs, function(e){return e.rec;});
        var hd0=entries[0].hd;
        var dayLabel=hebDayLabel(hd0.day)+' '+mName;
        var isToday=iso===todayIso;
        html+='<div class="arc-day">';
        html+='<div data-act="toggle-panel" data-panel="'+esc(dId)+'" '+
          'class="arc-day-head '+(isToday?'arc-day-today':'arc-day-plain')+'">'+
          '<span class="arc-head-lbl">'+dayLabel+(isToday?' — <span class="arc-today">היום</span>':'')+
          ' <span class="arc-day-count">('+entries.length+' '+st.many+')</span></span>'+
          '<span class="arc-day-chev">'+icon('down')+'</span>'+
        '</div>';
        html+='<div id="'+dId+'" class="'+(isToday?'':'hidden')+' arc-day-body">';

        entries.forEach(function(entry){
          var rec=entry.rec;
          var cnts={};
          Object.values(hrMarks(rec)).forEach(function(m){if(m.status)cnts[m.status]=(cnts[m.status]||0)+1;});
          var sId=uid('s'+rec.client_id);
          html+='<div class="arc-sess-card">';
          html+='<div class="arc-sess-head" data-act="toggle-panel" data-panel="'+esc(sId)+'">';
          html+='<span class="arc-sess-name">'+esc(hrRecLabel(rec))+'</span>';
          html+='<div class="arc-sess-summary">'+(st.exam?hrExamSummaryHTML(rec):hrSummaryHTML(st, cnts))+'</div>';
          html+='<button data-act="'+st.p+'-del-session" data-id="'+esc(rec.client_id)+'" aria-label="מחיקה" title="מחיקה" class="arc-sess-del">'+icon('del')+'</button>';
          html+='</div>';
          html+='<div id="'+sId+'" class="arc-sess-body hidden">';
          var mk=hrMarks(rec);
          var rows=hrSortStudents(Object.keys(mk).map(function(sid2){
            var st2=students.find(function(x){return String(x.client_id)===String(sid2);});
            // תלמיד שנמחק אחרי הסדר נשאר בשורה — הסדר שנרשם הוא עובדה, והיעדרו נקרא כמי שלא סומן
            return st2||{client_id:sid2,name:nameById(sid2),cls:''};
          })).map(function(s2){
            var m2=mk[String(s2.client_id)]||{};
            var lbl=st.exam?(m2.grade!=null&&m2.grade!==''?('ציון '+m2.grade):'לא נבחן'):
              m2.status==='l'?('איחור — '+(m2.minutes||0)+' ד׳'):(LBL[m2.status]||'לא סומן');
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
  Object.keys(shown).forEach(function(id){
    var b=document.getElementById(id);
    if(b) b.classList.toggle('hidden',!shown[id]);
  });
}

// ── מבחנים בארכיון — לימוד ⟵ שיעור ──
// בסדר הגיליון, ובתוכו א׳ ⟵ ב׳ ⟵ ג׳, המבחן של הקובייה לפני מבחן נוסף. ברשימה — תלמידי השיעור בלבד (hrExamGrp):
// מי שבחודש של המבחן, ומי מהשיעור שקיבל בו ציון גם אם יצא מאז.
function _hrExamMonthHTML(st, byDay, uid, students) {
  var recs=[];
  Object.keys(byDay).forEach(function(iso){ byDay[iso].forEach(function(e){ recs.push(e.rec); }); });
  var co='abgz';
  recs.sort(function(a,b){
    var ia=HR_EXAM_SUBJECTS.indexOf(a.session), ib=HR_EXAM_SUBJECTS.indexOf(b.session);
    return ((ia<0?99:ia)-(ib<0?99:ib))||String(a.session||'').localeCompare(String(b.session||''),'he')||
      (co.indexOf(a.cls||'z')-co.indexOf(b.cls||'z'))||((a.extra?1:0)-(b.extra?1:0))||(a.session_date<b.session_date?-1:a.session_date>b.session_date?1:0);
  });
  var html='', last=null;
  recs.forEach(function(rec){
    if(rec.session!==last){ last=rec.session; html+='<div class="arc-subj">'+esc(rec.session||'')+'</div>'; }
    var sId=uid('s'+rec.client_id), mk=hrMarks(rec);
    var name=rec.cls?(HR_CLS_NAME[rec.cls]||rec.cls)+(rec.extra?' · מבחן נוסף':''):hrRecLabel(rec);
    html+='<div class="arc-sess-card">'+
      '<div class="arc-sess-head" data-act="toggle-panel" data-panel="'+esc(sId)+'">'+
        '<span class="arc-sess-name">'+esc(name)+'<small>'+esc(hrSessHebFmt(rec))+'</small></span>'+
        '<div class="arc-sess-summary">'+hrExamSummaryHTML(rec)+'</div>'+
        '<button data-act="'+st.p+'-arc-edit" data-id="'+esc(rec.client_id)+'" aria-label="עריכה" title="עריכה" class="arc-sess-edit">'+icon('edit')+'</button>'+
        '<button data-act="'+st.p+'-del-session" data-id="'+esc(rec.client_id)+'" aria-label="מחיקה" title="מחיקה" class="arc-sess-del">'+icon('del')+'</button>'+
      '</div>'+
      '<div id="'+sId+'" class="arc-sess-body hidden">'+
        (rec.material?'<div class="arc-ex-mat">'+esc(rec.material)+'</div>':'');
    var list=hrSortStudents(students.filter(function(s){
      var m=mk[String(s.client_id)];
      var graded=m&&m.grade!=null&&m.grade!=='';
      return (!rec.cls||hrExamGrp(s.cls)===rec.cls)&&(graded||hrStudentOn(s, rec.session_date));
    }));
    html+=list.length?list.map(function(s){
      var m=mk[String(s.client_id)]||{}, g=m.grade!=null&&m.grade!=='';
      return '<div class="arc-mark-row"><span>'+esc(s.name)+'</span>'+
        '<span class="'+atvCls(m.status)+' arc-mark">'+esc(g?('ציון '+m.grade):'לא נבחן')+'</span></div>';
    }).join(''):'<div class="empty-note">אין תלמידים</div>';
    html+='</div></div>';
  });
  return html;
}

// עריכה מהארכיון — המבחן נפתח ברישום, כמו מבחן של החודש
function hrArcEdit(st, id) {
  S[st.v+'ArcEditing']=true;
  hrShowTab(st, 'reg');
  return hrEditSession(st, id);
}

function hrDeleteSession(st, id) {
  ask(st.msg.delTitle, st.msg.delBody, MSG_DELETE, icon('del'))
    .then(function (yes) { if (yes) _hrDeleteSessionConfirmed(st, id); });
}

async function _hrDeleteSessionConfirmed(st, id) {
  var data=await hrLoadData(st);
  var rec=data.find(function(r){return idEq(r.client_id,id);});
  if(rec) tombKill(rec);
  await hrSaveData(st, data, rec?hrDayWin(rec.session_date):undefined);
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
    +'<button data-act="modal-close" class="md-btn-cancel">ביטול</button>', icon(type==='pdf'?'pdf':'table'));
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

// גוון לכל קוד סימון — כמו במסך: נוכח ירוק · איחורים צהוב · חיסור והיעדרות אדום · באישור, בבית ומנוחה כחול.
var HR_MARK_TONE={p:'ok',l:'warn',lk:'warn',lm:'warn',e:'bad',x:'bad',ap:'info',ak:'info',a:'info'};

function _hrRangeLabel(fromIso, toIso){
  if(!fromIso&&!toIso) return 'כל הנתונים';
  return (fromIso?'מ־'+hrDayHebFmt(fromIso):'מההתחלה')+' '+(toIso?'עד '+hrDayHebFmt(toIso):'ועד היום');
}

function _hrExportName(st){ return st.doc+' '+hrTodayHebFmt(); }

// הגיליון — «פירוט»: שורה לכל תלמיד בכל סדר; ו«לפי תלמיד»: הסיכום של כל תלמיד בטווח.
async function _hrExportExcel(st, fromIso, toIso) {
  try {
    var sorted=await _hrExportRecs(st, fromIso, toIso);
    if(!sorted) return;
    var byId={};
    getStudents().forEach(function(s){byId[String(s.client_id)]=s;});
    var LBL=hrMarkLabels(st);
    var detail=[], per={};
    sorted.forEach(function(rec){
      var heb=hrSessHebFmt(rec);
      Object.entries(hrMarks(rec)).forEach(function(e){
        var s=byId[String(e[0])]||{name:e[0]}, m=e[1], cls=HR_CLS_NAME[s.cls]||'';
        var acc=per[e[0]]||(per[e[0]]={name:s.name,cls:cls,c:{},mins:0,grades:[]});
        if(st.exam){
          var g=m.grade!=null&&m.grade!==''?Number(m.grade):null;
          if(g!=null&&isFinite(g)) acc.grades.push(g);
          detail.push([rec.session_date,heb,hrRecLabel(rec),rec.material||'',s.name,cls,g,rec.filled_by_name||'']);
          return;
        }
        if(m.status) acc.c[m.status]=(acc.c[m.status]||0)+1;
        if(m.status==='l') acc.mins+=m.minutes||0;
        detail.push([rec.session_date,heb,rec.session,s.name,cls,m.status?{v:LBL[m.status]||m.status,tone:HR_MARK_TONE[m.status]}:'',
          m.status==='l'?(m.minutes||0):null].concat(st.note?[m.note||'']:[],[rec.filled_by_name||'']));
      });
    });
    var D=[{label:'תאריך',type:'date'},{label:'תאריך עברי',type:'text'},{label:st.one,type:'text'}];
    var cols=st.exam
      ? D.concat([{label:'החומר',type:'text'},{label:'שם התלמיד',type:'text'},{label:'שיעור',type:'text'},{label:'ציון',type:'number'},{label:'ממלא',type:'text'}])
      : D.concat([{label:'שם התלמיד',type:'text'},{label:'שיעור',type:'text'},{label:'סימון',type:'text'},{label:'דקות איחור',type:'number'}],
          st.note?[{label:'הערה',type:'text'}]:[],[{label:'ממלא',type:'text'}]);
    var people=hrSortStudents(Object.keys(per).map(function(id){return Object.assign({client_id:id},byId[id]||{},{_a:per[id]});}));
    var sumCols, sumRows;
    if(st.exam){
      sumCols=[{label:'שם התלמיד',type:'text'},{label:'שיעור',type:'text'},{label:'מבחנים',type:'number'},{label:'ממוצע',type:'number'}];
      sumRows=people.map(function(p){var a=p._a,n=a.grades.length;
        return [a.name,a.cls,n,n?Math.round(a.grades.reduce(function(x,y){return x+y;},0)/n):null];});
    } else {
      var codes=Object.keys(LBL).filter(function(k){return people.some(function(p){return p._a.c[k];});});
      sumCols=[{label:'שם התלמיד',type:'text'},{label:'שיעור',type:'text'}]
        .concat(codes.map(function(k){return {label:LBL[k],type:'number'};}),[{label:'דקות איחור',type:'number'}]);
      sumRows=people.map(function(p){var a=p._a;
        return [a.name,a.cls].concat(codes.map(function(k){return a.c[k]?{v:a.c[k],tone:HR_MARK_TONE[k]}:0;}),[a.mins]);});
    }
    await exportXlsx({name:_hrExportName(st), sheets:[
      {name:'פירוט', cols:cols, rows:detail},
      {name:'לפי תלמיד', cols:sumCols, rows:sumRows}
    ]});
  } catch(e){console.error('[xlsx]',e); toast(MSG_EXPORT_FAIL+((e&&e.message)||e), null, 'bad');}
}

// המסמך — קוביות הסיכום לטווח, וטבלה לכל חודש עברי: שורה לכל סדר.
async function _hrExportPdf(st, fromIso, toIso) {
  try {
    var sorted=await _hrExportRecs(st, fromIso, toIso);
    if(!sorted) return;
    toast(MSG_PDF_BUILDING);
    var groups=[], cur=null, tot={n:0,p:0,l:0,ab:0,ok:0,gr:[]};
    sorted.forEach(function(rec){
      var h=hrSessHeb(rec), label=(_hcMN(h.hy)[h.mi]||'')+' '+_hcYL(h.hy);
      if(!cur||cur.label!==label){cur={label:label,rows:[]};groups.push(cur);}
      var ms=Object.values(hrMarks(rec)), heb=hebDayLabel(h.day)+' ב'+(_hcMN(h.hy)[h.mi]||'');
      tot.n++;
      if(st.exam){
        var gs=ms.map(function(m){return m.grade!=null&&m.grade!==''?Number(m.grade):NaN;}).filter(isFinite);
        tot.gr=tot.gr.concat(gs);
        cur.rows.push([String(tot.n),heb,hrRecLabel(rec),rec.material||'',String(gs.length),
          gs.length?String(Math.round(gs.reduce(function(a,b){return a+b;},0)/gs.length)):'',
          rec.extra?'':{text:'כן',tone:'info'}]);
        return;
      }
      var p=ms.filter(function(m){return m.status==='p';}).length;
      var l=ms.filter(function(m){return hrIsLate(m.status);}).length;
      var ab=ms.filter(function(m){return m.status==='e'||m.status==='x';}).length;
      var ok=ms.filter(function(m){return m.status==='ap'||m.status==='ak'||m.status==='a';}).length;
      tot.p+=p; tot.l+=l; tot.ab+=ab; tot.ok+=ok;
      var den=p+l+ab;
      cur.rows.push([String(tot.n),heb,rec.session,String(p),String(l),String(ab),String(ok),den?Math.round((p+l)/den*100)+'%':'']);
    });
    var kpis, cols;
    if(st.exam){
      var avg=tot.gr.length?Math.round(tot.gr.reduce(function(a,b){return a+b;},0)/tot.gr.length):'—';
      kpis=[{n:tot.n,label:st.many,tone:'info'},{n:tot.gr.length,label:'ציונים',tone:'ok'},{n:avg,label:'ממוצע',tone:'info'}];
      cols=[{label:'#',num:true,w:'9mm'},{label:'תאריך'},{label:'לימוד'},{label:'החומר'},{label:'נבחנו',num:true},{label:'ממוצע',num:true},{label:'בגיליון',num:true}];
    } else {
      var den=tot.p+tot.l+tot.ab;
      kpis=[{n:tot.n,label:st.many,tone:'info'},{n:den?Math.round((tot.p+tot.l)/den*100)+'%':'—',label:'נוכחות',tone:'ok'},
            {n:tot.l,label:'איחורים',tone:'warn'},{n:tot.ab,label:st.absMany,tone:'bad'}];
      cols=[{label:'#',num:true,w:'9mm'},{label:'תאריך'},{label:st.one},{label:'נוכחים',num:true},{label:'מאחרים',num:true},
            {label:st.absMany,num:true},{label:'באישור ובבית',num:true},{label:'נוכחות',num:true}];
    }
    await exportPdf({title:st.doc, sub:HR_ORG+' · '+_hrRangeLabel(fromIso,toIso), date:hrTodayHebFmt(), name:_hrExportName(st),
      kpis:kpis, sections:[{title:'לפי חודש', note:tot.n+' '+st.many, cols:cols, groups:groups}]});
  } catch(e){console.error('[pdf]',e); toast(MSG_PDF_FAIL+((e&&e.message)||e), null, 'bad');}
}

export { hrArcEdit, hrDeleteSession, hrExportConfirm, hrRenderArchive, hrShowExportDialog };
