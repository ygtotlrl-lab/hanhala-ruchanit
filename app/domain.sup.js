// app/domain.sup.js — סדרים ושינה: השגחה, טיפולים והגדרות המודול, לשני הזרמים
import { MSG_DELETE, dayToday, uniqHas } from '../core/util.js';
import { idEq, newClientId, tombKill } from '../core/sync.js';
import { sessUserId, usersNameOf } from '../core/auth.js';
import { ask, closeModal, esc, openModal, toast } from '../core/ui.js';
import { hebYearInfo } from '../core/hebrew.js';
import { MSG_CARE_MISSING, MSG_CARE_SAVED, MSG_DELETED_MARK, MSG_DEL_CARE_BODY,
         MSG_DEL_CARE_TITLE, MSG_EDIT_MARK, MSG_MARK_UPDATED, MSG_MONTH_DETAIL,
         MSG_ROW_MISSING, MSG_SETTINGS_SAVED } from './constants.js';
import { S } from './state.js';
import { atvCls, getStudents, hrMarks, hrSortStudents, hrSupervisionAccess } from './domain.js';
import { _hcMN, _hcYL, hrDayHebFmt, hrHebMonthWin, hrSessHeb } from './domain.hebdate.js';
import { hrCachedArr, hrCachedCfg, hrCfgOf, hrDow, hrLiveTreats, hrLoadData, hrLoadTreats,
         hrMarkLabels, hrPullCfg, hrPullSessions, hrPullTreats, hrRenderTodaySessions, hrSaveCfg,
         hrSaveData, hrSaveTreats, hrSortAbsenceRows, hrSortSupRecords, hrSortTreats,
         hrSupMonth } from './domain.sessions.js';
import { hrRenderArchive } from './domain.arc.js';

// ── השגחה, טיפולים והתראה ──
function hrSupNav(st, dir) {
  var hy=S[st.v+'SupHY'], mi=S[st.v+'SupMI'];
  mi+=dir;
  var curMax=(hebYearInfo(hy)||{ml:[]}).ml.length-1;
  if(mi<0){hy--;var pb=hebYearInfo(hy);if(!pb)return;mi=pb.ml.length-1;}
  if(mi>curMax){hy++;if(!hebYearInfo(hy))return;mi=0;}
  S[st.v+'SupHY']=hy;S[st.v+'SupMI']=mi;
  hrRenderSupervision(st);
}

async function hrRenderSupervision(st) {
  var el=document.getElementById(st.p+'-sup-content');
  if(!el) return;
  if(!hrSupervisionAccess()){
    el.innerHTML='<div class="empty-note">🔒 גישה לחניכים בכירים ומנהלים בלבד</div>';return;
  }
  // מציג מיד — ניווט בין חודשים אינו ממתין לרשת; הרענון נשאר ובא אחרי הציור, כי המשגיח צריך נתון טרי
  var cD=hrCachedArr(st.v+'Data',st.table);
  var cT=hrCachedArr(st.v+'Treats',st.treatsLs);
  if(cD&&cT) _hrSupPaint(st,el,cD,cT,'');
  else el.innerHTML='<div class="loading-note">⏳ טוען...</div>';
  var ok=await Promise.all([hrPullSessions(st, hrHebMonthWin(hrSupMonth(st), S[st.v+'SupMI'])), hrPullTreats(st)]);
  // כשל משיכה מסומן גלוי — המשגיח מחליט על סמך מה שהוא רואה
  _hrSupPaint(st, el, hrCachedArr(st.v+'Data',st.table)||[],
                      hrCachedArr(st.v+'Treats',st.treatsLs)||[],
                      (ok[0]&&ok[1])?'':'⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר');
}

function _hrSupPaint(st, el, rawData, rawTreats, warn) {
  var data=(rawData||[]).filter(function(r){ return !(r && r.deleted); });
  var students=hrSortStudents(getStudents());
  var treats=hrLiveTreats(rawTreats);
  var p=st.p;

  hrSupMonth(st);
  var hy=S[st.v+'SupHY'],mi=S[st.v+'SupMI'];
  var mLabel=_hcMN(hy)[mi]+' '+_hcYL(hy);

  var curMax=(hebYearInfo(hy)||{ml:[]}).ml.length-1;
  var hasPrev=mi>0||!!hebYearInfo(hy-1);
  var hasNext=mi<curMax||!!hebYearInfo(hy+1);

  var navStyle='sup-nav';
  var navHTML='<div class="sup-nav-bar">'+
    '<button data-act="'+p+'-sup-nav" data-dir="-1" class="'+navStyle+(hasPrev?'':' sup-nav-off')+'"'+(hasPrev?'':' disabled')+'>›</button>'+
    '<span class="sup-nav-label">'+mLabel+'</span>'+
    '<button data-act="'+p+'-sup-nav" data-dir="1" class="'+navStyle+(hasNext?'':' sup-nav-off')+'"'+(hasNext?'':' disabled')+'>‹</button>'+
  '</div>';
  if(warn) navHTML='<div class="warn-note">'+esc(warn)+'</div>'+navHTML;

  if(!data||!data.length){
    el.innerHTML=navHTML+'<div class="empty-note">אין נתונים עדיין</div>';return;
  }

  var stats={};
  students.forEach(function(s){stats[s.client_id]={name:s.name,cls:s.cls,absent:0,lateMin:0,records:[]};});
  data.forEach(function(rec){
    var dh=rec.session_date?hrSessHeb(rec):null;
    if(!dh||dh.hy!==hy||dh.mi!==mi) return;
    Object.entries(hrMarks(rec)).forEach(function(e){
      var sid=e[0],m=e[1];
      if(!stats[sid]) return;
      var r={client_id:rec.client_id,session:rec.session,session_date:rec.session_date,mark:m.status,minutes:m.minutes||0};
      if(st.note) r.note=m.note||'';
      // נספרים רק חיסור ו-x — לא אישור, בבית או מנוחה
      if(m.status==='e' || m.status==='x'){
        stats[sid].absent++;
        stats[sid].records.push(r);
      }
      if(m.status==='l'){
        stats[sid].lateMin+=m.minutes||0;
        stats[sid].records.push(r);
      }
    });
  });

  // הרשימה נבנית מסדר התלמידים ולא מ-Object.entries — מפתח שנראה כמספר שלם ממוין מספרית לפני השאר
  var rows=hrSortAbsenceRows(students.map(function(s){return [String(s.client_id), stats[s.client_id]];})
    .filter(function(e){return e[1]&&(e[1].absent>0||e[1].lateMin>0);}));

  if(!rows.length){
    el.innerHTML=navHTML+'<div class="empty-note">אין '+st.absMany+' ב'+mLabel+'</div>';return;
  }

  S[st.v+'SupRecords']={};
  rows.forEach(function(e){S[st.v+'SupRecords'][e[0]]=e[1].records||[];});

  var cfg=hrCfgOf(st);
  var html=navHTML+'<div class="status-choice-list">';
  rows.forEach(function(e){
    var sid=e[0],sr=e[1];
    var stuTreats=treats.filter(function(t){return String(t.student_client_id)===String(sid);});
    var lastTreat=stuTreats.length?hrSortTreats(stuTreats)[0]:null;
    var lastHTML='';
    if(lastTreat){
      var ltIso=lastTreat.treat_date||'';
      var ltDateStr=ltIso?hrDayHebFmt(ltIso):'';
      lastHTML='<span class="badge-ok">📝 יום '+hrDow(ltIso)+' '+esc(ltDateStr)+'</span>';
    }
    var alert20=sr.absent>=20?'<span class="badge-bad">⚠️ 20+</span>':'';
    var alert300=sr.lateMin>=300?'<span class="badge-warn">⏰ 300+</span>':'';
    var clsLabel=sr.cls==='a'?'א':sr.cls==='b'?'ב':sr.cls==='g'?'ג':sr.cls||'';
    html+='<div id="'+p+'-sup-card-'+sid+'" class="sup-card-pane sup-card">';
    html+='<div class="sup-card-head" data-act="toggle-next" data-chev="'+p+'-sup-chev">';
    html+='<div class="sup-card-class">'+esc(clsLabel)+'</div>';
    html+='<div class="rec-main"><div class="rec-title">'+esc(sr.name)+alert20+alert300+'</div>'+(lastHTML?'<div class="rec-last">'+lastHTML+'</div>':'')+'</div>';
    html+='<div class="sup-card-stats">';
    html+='<span class="rec-abs">'+st.absMany+': <b>'+sr.absent+'</b></span>';
    html+='<span class="rec-late">איחורים: <b>'+sr.lateMin+'</b>ד׳</span>';
    html+='<span class="rec-muted">טיפולים: <b>'+stuTreats.length+'</b></span>';
    html+='<button data-act="'+p+'-sup-detail" data-id="'+esc(sid)+'" class="sup-detail-btn">🔍 פירוט</button>';
    html+='</div>';
    html+='<span class="sup-chev-icon '+p+'-sup-chev">›</span>';
    html+='</div>';
    html+='<div class="sup-card-body hidden">';
    html+='<div class="treat-add">';
    html+='<div class="panel-head-sm">➕ הוסף טיפול</div>';
    html+='<div class="chip-row" data-ks>';
    html+='<select aria-label="סוג הטיפול" id="'+p+'-treat-type-'+sid+'" class="treat-select">'+
      cfg.treats.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'</select>';
    html+='<input aria-label="הערה (אופציונלי)" id="'+p+'-treat-note-'+sid+'" placeholder="הערה (אופציונלי)" class="treat-note-input">';
    html+='<button data-act="'+p+'-add-treat" data-ksave data-id="'+esc(sid)+'" class="treat-save-btn">שמור</button>';
    html+='</div></div>';
    if(stuTreats.length){
      html+='<div class="panel-head-sm">📋 היסטוריית טיפולים</div>';
      html+=stuTreats.slice().reverse().map(function(t){
        var dl=t.treat_date?hrDayHebFmt(t.treat_date):'';
        return '<div class="treat-row">'+
          '<span class="rec-muted">'+esc(dl)+'</span>'+
          '<span class="treat-type">'+esc(t.type)+'</span>'+
          (t.note?'<span class="rec-muted">— '+esc(t.note)+'</span>':'')+
          '<span class="gap"></span>'+
          '<span class="unit-hint">'+esc(usersNameOf(t.created_by_client_id))+'</span>'+
          '<button data-act="'+p+'-del-treat" data-id="'+esc(t.id)+'" class="treat-del-btn">✕</button>'+
        '</div>';
      }).join('');
    }
    html+='</div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ── טיפולים ופירוט תלמיד ──
async function hrAddTreat(st, sid) {
  var typeEl=document.getElementById(st.p+'-treat-type-'+sid);
  var noteEl=document.getElementById(st.p+'-treat-note-'+sid);
  if(!typeEl) return;
  var now=new Date();
  var rec={
    id:newClientId(),
    student_client_id:sid,
    treat_date:dayToday(),
    type:typeEl.value,
    note:noteEl?noteEl.value:'',
    created_by_client_id:sessUserId(),
    created_at:now.toISOString(),
    updated_at:now.getTime() // חובה למיזוג — רשומה בלי updated_at נופלת
  };
  var treats=await hrLoadTreats(st);
  treats.push(rec);
  await hrSaveTreats(st, treats);
  if(noteEl) noteEl.value='';
  hrRenderSupervision(st);
  toast(MSG_CARE_SAVED, null, 'good');
}

function hrDeleteTreat(st, id) {
  ask(MSG_DEL_CARE_TITLE, MSG_DEL_CARE_BODY, MSG_DELETE)
    .then(function (yes) { if (yes) _hrDeleteTreatConfirmed(st, id); });
}

async function _hrDeleteTreatConfirmed(st, id) {
  closeModal();
  var treats=await hrLoadTreats(st);
  // tombstone ולא filter — רשומה שנעלמת בלי סימון חוזרת מהענן במיזוג הבא
  var ts=Date.now(), found=false;
  treats.forEach(function(t){
    if(!t||String(t.id)!==String(id)||t.deleted) return;
    tombKill(t, ts); found=true;
  });
  if(!found){ toast(MSG_CARE_MISSING, null, 'bad'); hrRenderSupervision(st); return; }
  await hrSaveTreats(st, treats);
  hrRenderSupervision(st);
  toast(MSG_DELETED_MARK, null, 'good');
}

// ── פירוט חודשי לתלמיד ──
function hrSupDetail(st, sid) {
  var students=getStudents();
  var stu=students.find(function(s){return String(s.client_id)===String(sid);});
  var name=stu?stu.name:'תלמיד';
  var records=(S[st.v+'SupRecords']&&S[st.v+'SupRecords'][sid])||[];
  var LBL=hrMarkLabels(st);

  var rowsHTML='';
  if(!records.length){rowsHTML='<div class="loading-note">אין '+st.absMany+' בחודש זה</div>';}
  else{
    hrSortSupRecords(records).forEach(function(r){
      var lbl=r.mark==='l'?('איחור — '+(r.minutes||0)+' ד׳'):(LBL[r.mark]||r.mark);
      var noteStr=r.note?(' — '+r.note):'';
      rowsHTML+='<div class="mark-hist-row">';
      rowsHTML+='<span class="mark-hist-dow">יום '+hrDow(r.session_date)+'</span>';
      rowsHTML+='<span class="mark-hist-date">'+esc(hrDayHebFmt(r.session_date))+'</span>';
      rowsHTML+='<span class="mark-hist-sess">'+esc(r.session)+'</span>';
      rowsHTML+='<span class="'+atvCls(r.mark)+' hist-mark">'+esc(lbl)+esc(noteStr)+'</span>';
      rowsHTML+='<button data-act="'+st.p+'-mark-edit" data-rec="'+esc(r.client_id)+'" data-sid="'+esc(sid)+'" data-code="'+esc(r.mark)+'" '+
        ' class="mark-edit-btn">✏️ ערוך</button>';
      rowsHTML+='</div>';
    });
  }

  openModal(MSG_MONTH_DETAIL+name,
    '<div class="scroll-pane">'+rowsHTML+'</div>','');
}

function hrSupEditMarkDlg(st, recId, sid, curMark) {
  var CODES=[
    {c:'p', lbl:'✓ נוכח'},
    {c:'l', lbl:'⏰ איחור'},
    {c:'e', lbl:'− חיסור'},
    {c:'x', lbl:'✕ '+st.xOne},
    {c:'ap', lbl:'א אישור'},
    {c:'ak', lbl:'ב בבית'},
    {c:'a', lbl:'ג מנוחה'}
  ];
  var btnsHTML=CODES.map(function(cd){
    var active=cd.c===curMark?'mark-on':'mark-off';
    return '<button data-act="'+st.p+'-mark-set" data-rec="'+esc(recId)+'" data-sid="'+esc(sid)+'" data-code="'+esc(cd.c)+'" '+
      'class="'+atvCls(cd.c)+' '+active+' mark-pick">'+cd.lbl+'</button>';
  }).join('');
  openModal(MSG_EDIT_MARK,
    '<div class="chip-row">'+btnsHTML+'</div>',
    '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>');
}

async function hrEditMark(st, recId, sid, newCode) {
  var data=await hrLoadData(st);
  var rec=data.find(function(r){return idEq(r.client_id,recId);});
  if(!rec){toast(MSG_ROW_MISSING, null, 'bad');return;}
  if(!rec.marks||typeof rec.marks!=='object') rec.marks={};
  if(!rec.marks[sid]) rec.marks[sid]={};
  rec.marks[sid].status=newCode;
  if(newCode!=='l') rec.marks[sid].minutes=0;
  rec.updated_at=Date.now();
  // הטוסט אחרי הכתיבה לדיסק, שסינכרונית בראש השמירה; ההמתנה שאחריה היא הרשת בלבד.
  // ההבטחה מוחזרת כדי שנקודת הניתוב תשחרר את הכפתור לפיה.
  var _p=hrSaveData(st, data);
  closeModal();
  hrRenderTodaySessions(st);
  hrRenderArchive(st);
  hrRenderSupervision(st);
  toast(MSG_MARK_UPDATED, null, 'good');
  await _p;
}

// ── הגדרות המודול ──
// רשימת הסדרים נערכת רק בזרם שהצהיר עליה (sessEdit) — בשינה הדו"ח אחד, ואין מה לערוך.
async function hrRenderSettings(st) {
  hrCachedCfg(st);
  _hrPaintSettings(st);
  await hrPullCfg(st);
  _hrPaintSettings(st);
}

function _hrPaintSettings(st) {
  var cfg=hrCfgOf(st);
  var sc=st.sessEdit?document.getElementById(st.p+'-cfg-sessions'):null;
  var tc=document.getElementById(st.p+'-cfg-treats');
  if(sc){
    sc.innerHTML=cfg.sessions.map(function(s){
      return '<div data-sess-row="1" class="sess-edit-row">'+
        '<input aria-label="שם הסדר" data-sess-name="1" value="'+esc(s.name)+'" placeholder="שם הסדר" class="sess-field">'+
        '<input data-sess-time="1" aria-label="שעת הסדר" type="time" value="'+esc(s.start_time||'')+'" class="cfg-row-input">'+
        '<button data-act="row-remove" class="row-del-btn">✕</button>'+
      '</div>';
    }).join('');
  }
  if(tc){
    tc.innerHTML=cfg.treats.map(function(t,i){
      return '<div class="badge-row">'+
        '<input aria-label="שם הטיפול" value="'+esc(t)+'" id="'+st.p+'-treat-inp-'+i+'" class="sess-field">'+
        '<button data-act="row-remove" class="row-del-btn">✕</button>'+
      '</div>';
    }).join('');
  }
}

function hrAddSessionRow(st) {
  var sc=document.getElementById(st.p+'-cfg-sessions');
  if(!sc) return;
  var div=document.createElement('div');
  div.setAttribute('data-sess-row','1');
  div.className='edit-row sess-edit-row-gap';
  div.innerHTML='<input aria-label="שם הסדר" data-sess-name="1" placeholder="שם הסדר" class="sess-field">'+
    '<input data-sess-time="1" aria-label="שעת הסדר" type="time" class="cfg-row-input">'+
    '<button data-act="row-remove" class="row-del-btn">✕</button>';
  sc.appendChild(div);div.querySelector('[data-sess-name]').focus();
}

function hrAddTreatRow(st) {
  var tc=document.getElementById(st.p+'-cfg-treats');
  if(!tc) return;
  var div=document.createElement('div');
  div.className='edit-row';
  div.innerHTML='<input aria-label="שם הטיפול" placeholder="שם הטיפול" class="sess-field"><button data-act="row-remove" class="row-del-btn">✕</button>';
  tc.appendChild(div);div.querySelector('input').focus();
}

async function hrSaveSettingsCfg(st) {
  var cfg=hrCfgOf(st);
  var oldSessions=(cfg.sessions||[]).slice();
  var sc=st.sessEdit?document.getElementById(st.p+'-cfg-sessions'):null;
  if(sc){
    var newSess=[];
    sc.querySelectorAll('[data-sess-row]').forEach(function(row,i){
      var nameInp=row.querySelector('[data-sess-name]');
      var timeInp=row.querySelector('[data-sess-time]');
      var name=(nameInp?nameInp.value.trim():''); if(!name) return;
      // השם הוא הזהות כאן — שורה שנייה באותו שם הייתה מקבלת את אותו id
      if(uniqHas(newSess, {name:name}, function(x){return x.name;})) return;
      var sessStart=(timeInp?timeInp.value.trim():'');
      var existing=oldSessions.find(function(s){return s.name===name;});
      var entry={id:existing?existing.id:('s_'+Date.now()+'_'+i),name:name};
      if(sessStart) entry.start_time=sessStart;
      newSess.push(entry);
    });
    cfg.sessions=newSess;
  }
  var tc=document.getElementById(st.p+'-cfg-treats');
  if(tc){
    var newTreats=[];
    // טיפול באותו שם אינו נאסף פעמיים — שתי אפשרויות זהות בבורר אינן ניתנות להבחנה
    tc.querySelectorAll('input').forEach(function(inp){
      var v=inp.value.trim();
      if(!v||uniqHas(newTreats, v)) return;
      newTreats.push(v);
    });
    cfg.treats=newTreats;
  }
  S[st.v+'Cfg']=null;
  await hrSaveCfg(st, cfg);
  S[st.v+'Cfg']=cfg;
  toast(MSG_SETTINGS_SAVED, null, 'good');
}

export { hrAddSessionRow, hrAddTreat, hrAddTreatRow, hrDeleteTreat, hrEditMark, hrRenderSettings,
         hrRenderSupervision, hrSaveSettingsCfg, hrSupDetail, hrSupEditMarkDlg, hrSupNav };
