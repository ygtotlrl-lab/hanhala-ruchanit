// app/screens/sleep.sup.js — שינה — השגחה, טיפולים והגדרות המודול
import { MSG_DELETE, dayToday, uniqHas } from '../../core/util.js';
import { idEq } from '../../core/sync.js';
import { ask, closeModal, esc, openModal, toast } from '../../core/ui.js';
import { MSG_CARE_MISSING, MSG_CARE_SAVED, MSG_DELETED_MARK, MSG_DEL_CARE_BODY,
         MSG_DEL_CARE_TITLE, MSG_EDIT_MARK, MSG_MARK_UPDATED, MSG_MONTH_DETAIL,
         MSG_ROW_MISSING, MSG_SETTINGS_SAVED } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { HE, atvCls, getStudents, hrDefaultCfg, hrMarks, hrSortStudents,
         hrSupervisionAccess, hrWho } from '../domain.js';
import { _hcBase, _hcFmt, _hcH, _hcMN, _hcYL, hrHebMonthWin } from '../domain.hebdate.js';
import { hrCachedArr, hrLoadData, hrSaveData } from '../domain.sessions.js';
import { _hrPullCfg, _hrPullSessions, _hrPullTreats, _hrSupMonth, hrCachedCfg, hrDow,
         hrLiveTreats, hrLoadTreats, hrRenderTodaySessions, hrSaveCfg,
         hrSaveTreats } from './sleep.js';

// ── שינה — השגחה וטיפולים ──
function hrSupNav(dir) {
  var hy=S._hrSupHY, mi=S._hrSupMI;
  mi+=dir;
  var curMax=(_hcBase(hy)||{ml:[]}).ml.length-1;
  if(mi<0){hy--;var pb=_hcBase(hy);if(!pb)return;mi=pb.ml.length-1;}
  if(mi>curMax){hy++;if(!_hcBase(hy))return;mi=0;}
  S._hrSupHY=hy;S._hrSupMI=mi;
  hrRenderSupervision();
}

async function hrRenderSupervision() {
  var el=document.getElementById('sl-sup-content');
  if(!el) return;
  if(!hrSupervisionAccess()){
    el.innerHTML='<div class="empty-note">🔒 גישה לחניכים בכירים ומנהלים בלבד</div>';return;
  }
  var cD=hrCachedArr('_hrData','hr_sleep_sessions');
  var cT=hrCachedArr('_hrTreats','hr_sleep_treats');
  if(cD&&cT) _hrSupPaint(el,cD,cT,'');
  else el.innerHTML='<div class="loading-note">⏳ טוען...</div>';
  var okS=await Promise.all([_hrPullSessions(hrHebMonthWin(_hrSupMonth(), S._hrSupMI)), _hrPullTreats()]);
  _hrSupPaint(el, hrCachedArr('_hrData','hr_sleep_sessions')||[],
                  hrCachedArr('_hrTreats','hr_sleep_treats')||[],
                  (okS[0]&&okS[1])?'':'⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר');
}

function _hrSupPaint(el, rawData, rawTreats, warn) {
  var data=(rawData||[]).filter(function(r){ return !(r && r.deleted); });
  var students=hrSortStudents(getStudents());
  var treats=hrLiveTreats(rawTreats);

  _hrSupMonth();
  var hy=S._hrSupHY,mi=S._hrSupMI;
  var mNames=_hcMN(hy);
  var mLabel=mNames[mi]+' '+_hcYL(hy);

  var curMax=(_hcBase(hy)||{ml:[]}).ml.length-1;
  var hasPrev=mi>0||!!_hcBase(hy-1);
  var hasNext=mi<curMax||!!_hcBase(hy+1);

  var navStyle='sup-nav';
  var navHtml='<div class="sup-nav-bar">'+
    '<button data-act="sl-sup-nav" data-dir="-1" class="'+navStyle+(hasPrev?'':' sup-nav-off')+'"'+(hasPrev?'':' disabled')+'>›</button>'+
    '<span class="sup-nav-label">'+mLabel+'</span>'+
    '<button data-act="sl-sup-nav" data-dir="1" class="'+navStyle+(hasNext?'':' sup-nav-off')+'"'+(hasNext?'':' disabled')+'>‹</button>'+
  '</div>';
  if(warn) navHtml='<div class="warn-note">'+esc(warn)+'</div>'+navHtml;

  if(!data||!data.length){
    el.innerHTML=navHtml+'<div class="empty-note">אין נתונים עדיין</div>';return;
  }

  var stats={};
  students.forEach(function(s){stats[s.id]={name:s.name,cls:s.cls,absent:0,lateMin:0,records:[]};});
  data.forEach(function(rec){
    var dh=rec.date_heb;
    if(!dh||!dh.hy){var p=(rec.date_iso||'').split('-');if(p.length===3)dh=_hcH(new Date(+p[0],+p[1]-1,+p[2]));}
    if(!dh||dh.hy!==hy||dh.mi!==mi) return;
    Object.entries(hrMarks(rec)).forEach(function(e){
      var sid=e[0],m=e[1];
      if(!stats[sid]) return;
      if(m.s==='e'||m.s==='x'){
        stats[sid].absent++;
        stats[sid].records.push({recId:rec.id,session:rec.session,date_iso:rec.date_iso,date_heb:dh,mark:m.s,min:m.min||0,note:m.note||''});
      }
      if(m.s==='l'){
        stats[sid].lateMin+=m.min||0;
        stats[sid].records.push({recId:rec.id,session:rec.session,date_iso:rec.date_iso,date_heb:dh,mark:m.s,min:m.min||0,note:m.note||''});
      }
    });
  });

  // הרשימה נבנית מסדר התלמידים ולא מ-Object.entries — מפתח שנראה כמספר שלם ממוין מספרית לפני השאר
  var rows=students.map(function(s){return [String(s.id), stats[s.id]];})
    .filter(function(e){return e[1]&&(e[1].absent>0||e[1].lateMin>0);})
    .sort(function(a,b){return (b[1].absent-a[1].absent)||b[1].lateMin-a[1].lateMin;});

  if(!rows.length){
    el.innerHTML=navHtml+'<div class="empty-note">אין אירועים ב'+mLabel+'</div>';return;
  }

  S._hrSupRecords={};
  rows.forEach(function(e){S._hrSupRecords[e[0]]=e[1].records||[];});

  var html=navHtml+'<div class="status-choice-list">';
  rows.forEach(function(e){
    var sid=e[0],st=e[1];
    var stuTreats=treats.filter(function(t){return String(t.sid)===String(sid);});
    var lastTreat=stuTreats.length?stuTreats.slice().sort(function(a,b){return HE.compare(b.date_iso||'',a.date_iso||'');})[0]:null;
    var lastHtml='';
    if(lastTreat){
      var ltHd=lastTreat.date_heb;
      var ltIso=lastTreat.date_iso||'';
      var ltDateStr=ltHd?_hcFmt(ltHd.hy,ltHd.mi,ltHd.day):ltIso;
      lastHtml='<span class="badge-ok">📝 יום '+hrDow(ltIso)+' '+esc(ltDateStr)+'</span>';
    }
    var alert20=st.absent>=20?'<span class="badge-bad">⚠️ 20+</span>':'';
    var alert300=st.lateMin>=300?'<span class="badge-warn">⏰ 300+</span>':'';
    var clsLabel=st.cls==='a'?'א':st.cls==='b'?'ב':st.cls==='g'?'ג':st.cls||'';
    var cardId='sl-sup-card-'+sid;
    html+='<div id="'+cardId+'" class="sup-card-pane sup-card">';
    html+='<div class="sup-card-head" data-act="toggle-next" data-chev="sl-sup-chev">';
    html+='<div class="sup-card-class">'+esc(clsLabel)+'</div>';
    html+='<div class="rec-main"><div class="rec-title">'+esc(st.name)+alert20+alert300+'</div>'+(lastHtml?'<div class="rec-last">'+lastHtml+'</div>':'')+'</div>';
    html+='<div class="sup-card-stats">';
    html+='<span class="rec-abs">אירועים: <b>'+st.absent+'</b></span>';
    html+='<span class="rec-late">איחורים: <b>'+st.lateMin+'</b>ד׳</span>';
    html+='<span class="rec-muted">טיפולים: <b>'+stuTreats.length+'</b></span>';
    html+='<button data-act="sl-sup-detail" data-id="'+esc(sid)+'" class="sup-detail-btn">🔍 פירוט</button>';
    html+='</div>';
    html+='<span class="sup-chev-icon sl-sup-chev">›</span>';
    html+='</div>';
    html+='<div class="sup-card-body hidden">';
    html+='<div class="treat-add">';
    html+='<div class="panel-head-sm">➕ הוסף טיפול</div>';
    html+='<div class="chip-row ksave">';
    var hrCfg=S._hrCfg||hrDefaultCfg();
    html+='<select aria-label="סוג הטיפול" id="sl-treat-type-'+sid+'" class="treat-select">'+
      hrCfg.treats.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'</select>';
    html+='<input aria-label="הערה (אופציונלי)" id="sl-treat-note-'+sid+'" placeholder="הערה (אופציונלי)" class="treat-note-input">';
    html+='<button data-act="sl-add-treat" data-ksave data-id="'+esc(sid)+'" class="treat-save-btn">שמור</button>';
    html+='</div></div>';
    if(stuTreats.length){
      html+='<div class="panel-head-sm">📋 היסטוריית טיפולים</div>';
      html+=stuTreats.slice().reverse().map(function(t){
        var hd=t.date_heb;
        var dl=hd?_hcFmt(hd.hy,hd.mi,hd.day):t.date_iso;
        return '<div class="treat-row">'+
          '<span class="rec-muted">'+esc(dl)+'</span>'+
          '<span class="treat-type">'+esc(t.type)+'</span>'+
          (t.note?'<span class="rec-muted">— '+esc(t.note)+'</span>':'')+
          '<span class="gap"></span>'+
          '<span class="unit-hint">'+esc(t.by_name)+'</span>'+
          '<button data-act="sl-del-treat" data-id="'+esc(t.id)+'" class="treat-del-btn">✕</button>'+
        '</div>';
      }).join('');
    }
    html+='</div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

async function hrAddTreat(sid) {
  var typeEl=document.getElementById('sl-treat-type-'+sid);
  var noteEl=document.getElementById('sl-treat-note-'+sid);
  if(!typeEl) return;
  var now=new Date();
  var rec={
    id:Date.now()+'_'+Math.random().toString(36).substr(2,5),
    sid:sid,
    date_iso:dayToday(),
    date_heb:_hcH(now),
    type:typeEl.value,
    note:noteEl?noteEl.value:'',
    by:AUTH.user?AUTH.user.client_id:'',
    by_name:AUTH.user?AUTH.user.full_name:'',
    created_at:now.toISOString(),
    updatedAt:now.getTime() // חותמת המכשיר — מפתח ההכרעה במיזוג
  };
  var treats=await hrLoadTreats();
  treats.push(rec);
  await hrSaveTreats(treats);
  if(noteEl) noteEl.value='';
  hrRenderSupervision();
  toast(MSG_CARE_SAVED, null, 'good');
}

function hrDeleteTreat(id) {
  ask(MSG_DEL_CARE_TITLE, MSG_DEL_CARE_BODY, MSG_DELETE)
    .then(function (yes) { if (yes) hrDeleteTreatConfirmed(id); });
}

async function hrDeleteTreatConfirmed(id) {
  closeModal();
  var treats=await hrLoadTreats();
  // tombstone ולא הסרה — היעדר נקרא «אין לי» ולא «נמחק»
  var ts=Date.now(), by=hrWho(), found=false;
  treats.forEach(function(t){
    if(!t||String(t.id)!==String(id)||t.deleted) return;
    t.deleted=true; t.updatedAt=ts; t.deletedBy=by; found=true;
  });
  if(!found){ toast(MSG_CARE_MISSING, null, 'bad'); hrRenderSupervision(); return; }
  await hrSaveTreats(treats);
  hrRenderSupervision();
  toast(MSG_DELETED_MARK, null, 'good');
}

// ── פירוט חודשי לתלמיד ──
var HR_LBL_DET={p:'נוכח',l:'איחור',e:'חיסור',x:'אירוע',ap:'אישור',ak:'בבית',a:'מנוחה'};

function hrSupDetail(sid) {
  var students=getStudents();
  var st=students.find(function(s){return String(s.id)===String(sid);});
  var name=st?st.name:'תלמיד';
  var records=(S._hrSupRecords&&S._hrSupRecords[sid])||[];

  var rowsHtml='';
  if(!records.length){rowsHtml='<div class="loading-note">אין אירועים בחודש זה</div>';}
  else{
    records.slice().sort(function(a,b){return HE.compare(a.date_iso,b.date_iso)||HE.compare(a.session,b.session);}).forEach(function(r){
      var hd=r.date_heb;
      var hbr=hd?_hcFmt(hd.hy,hd.mi,hd.day):r.date_iso;
      var dowStr='יום '+hrDow(r.date_iso);
      var lbl=r.mark==='l'?('איחור — '+(r.min||0)+' ד׳'):(HR_LBL_DET[r.mark]||r.mark);
      var noteStr=r.note?(' — '+r.note):'';
      var mkc=atvCls(r.mark);
      rowsHtml+='<div class="mark-hist-row">';
      rowsHtml+='<span class="mark-hist-dow">'+dowStr+'</span>';
      rowsHtml+='<span class="mark-hist-date">'+esc(hbr)+'</span>';
      rowsHtml+='<span class="mark-hist-sess">'+esc(r.session)+'</span>';
      rowsHtml+='<span class="'+mkc+' hist-mark">'+esc(lbl)+esc(noteStr)+'</span>';
      rowsHtml+='<button data-act="sl-mark-edit" data-rec="'+esc(r.recId)+'" data-sid="'+esc(sid)+'" data-code="'+esc(r.mark)+'" '+
        ' class="mark-edit-btn">✏️ ערוך</button>';
      rowsHtml+='</div>';
    });
  }

  openModal(MSG_MONTH_DETAIL+name,
    '<div class="scroll-pane">'+rowsHtml+'</div>','');
}

function hrSupEditMarkDlg(recId, sid, curMark) {
  var CODES=[
    {c:'p', lbl:'✓ נוכח'},
    {c:'l', lbl:'⏰ איחור'},
    {c:'e', lbl:'− חיסור'},
    {c:'x', lbl:'✕ אירוע'},
    {c:'ap', lbl:'א אישור'},
    {c:'ak', lbl:'ב בבית'},
    {c:'a', lbl:'ג מנוחה'}
  ];
  var btnsHtml=CODES.map(function(cd){
    var active=cd.c===curMark?'mark-on':'mark-off';
    return '<button data-act="sl-mark-set" data-rec="'+esc(recId)+'" data-sid="'+esc(sid)+'" data-code="'+esc(cd.c)+'" '+
      'class="'+atvCls(cd.c)+' '+active+' mark-pick">'+cd.lbl+'</button>';
  }).join('');
  openModal(MSG_EDIT_MARK,
    '<div class="chip-row">'+btnsHtml+'</div>',
    '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>');
}

async function hrEditMark(recId, sid, newCode) {
  var data=await hrLoadData();
  var rec=data.find(function(r){return idEq(r.id,recId);});
  if(!rec){toast(MSG_ROW_MISSING, null, 'bad');return;}
  if(!rec.marks||typeof rec.marks!=='object') rec.marks={};
  if(!rec.marks[sid]) rec.marks[sid]={};
  rec.marks[sid].s=newCode;
  if(newCode!=='l') rec.marks[sid].min=0;
  rec.updatedAt=Date.now();
  // הטוסט אחרי הכתיבה לדיסק, שסינכרונית בראש hrCfgSet; ההמתנה שאחריה היא הרשת בלבד.
  // ההבטחה מוחזרת כדי שנקודת הניתוב תשחרר את הכפתור לפיה.
  var _p=hrSaveData(data);
  closeModal();
  hrRenderTodaySessions();
  shell.hrRenderArchive();
  hrRenderSupervision();
  toast(MSG_MARK_UPDATED, null, 'good');
  await _p;
}

// ── הגדרות מודול השינה ──
async function renderSleepSettings() {
  hrCachedCfg();
  _hrPaintSettings();
  await _hrPullCfg();
  _hrPaintSettings();
}

function _hrPaintSettings() {
  var cfg=S._hrCfg||hrDefaultCfg();
  var tc=document.getElementById('sl-cfg-treats');
  if(tc){
    tc.innerHTML=cfg.treats.map(function(t,i){
      return '<div class="badge-row">'+
        '<input aria-label="שם הטיפול" value="'+esc(t)+'" id="sl-treat-inp-'+i+'" class="sess-field">'+
        '<button data-act="row-remove" class="row-del-btn">✕</button>'+
      '</div>';
    }).join('');
  }
}

function hrAddTreatRow() {
  var tc=document.getElementById('sl-cfg-treats');
  if(!tc) return;
  var div=document.createElement('div');
  div.className='edit-row';
  div.innerHTML='<input aria-label="שם הטיפול" placeholder="שם הטיפול" class="sess-field"><button data-act="row-remove" class="row-del-btn">✕</button>';
  tc.appendChild(div);div.querySelector('input').focus();
}

async function hrSaveSettingsCfg() {
  var cfg=S._hrCfg||hrDefaultCfg();
  var tc=document.getElementById('sl-cfg-treats');
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
  S._hrCfg=null;
  await hrSaveCfg(cfg);
  S._hrCfg=cfg;
  toast(MSG_SETTINGS_SAVED, null, 'good');
}

export { hrAddTreat, hrAddTreatRow, hrDeleteTreat, hrEditMark, hrRenderSupervision,
         hrSaveSettingsCfg, hrSupDetail, hrSupEditMarkDlg, hrSupNav,
         renderSleepSettings };
