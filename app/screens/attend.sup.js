// app/screens/attend.sup.js — סדרים — השגחה, טיפולים והגדרות המודול
import { MSG_DELETE, dayToday, uniqHas } from '../../core/util.js';
import { idEq } from '../../core/sync.js';
import { ask, closeModal, esc, openModal, toast } from '../../core/ui.js';
import { MSG_CARE_MISSING, MSG_CARE_SAVED, MSG_DELETED_MARK, MSG_DEL_CARE_BODY,
         MSG_DEL_CARE_TITLE, MSG_EDIT_MARK, MSG_MARK_UPDATED, MSG_MONTH_DETAIL,
         MSG_ROW_MISSING, MSG_SETTINGS_SAVED } from '../constants.js';
import { AUTH, S, shell } from '../state.js';
import { HE, atvCls, getStudents, hrMarks, hrSortStudents, hrSupervisionAccess,
         hrWho } from '../domain.js';
import { _hcBase, _hcFmt, _hcH, _hcMN, _hcYL, hrHebMonthWin } from '../domain.hebdate.js';
import { atLoadData, atSaveData, hrCachedArr } from '../domain.sessions.js';
import { _atPullCfg, _atPullSessions, _atPullTreats, _atSupMonth, atCachedCfg,
         atDefaultCfg, atDow, atLiveTreats, atLoadTreats, atRenderTodaySessions,
         atSaveCfg, atSaveTreats } from './attend.js';

// ── נוכחות — השגחה, טיפולים והתראה ──
function atSupNav(dir) {
  var hy=S._atSupHY, mi=S._atSupMI;
  mi+=dir;
  var curMax=(_hcBase(hy)||{ml:[]}).ml.length-1;
  if(mi<0){hy--;var pb=_hcBase(hy);if(!pb)return;mi=pb.ml.length-1;}
  if(mi>curMax){hy++;if(!_hcBase(hy))return;mi=0;}
  S._atSupHY=hy;S._atSupMI=mi;
  atRenderSupervision();
}

async function atRenderSupervision() {
  var el=document.getElementById('at-sup-content');
  if(!el) return;
  if(!hrSupervisionAccess()){
    el.innerHTML='<div class="empty-note">🔒 גישה לחניכים בכירים ומנהלים בלבד</div>';return;
  }
  // מציג מיד — ניווט בין חודשים אינו ממתין לרשת; הרענון נשאר ובא אחרי הציור, כי המשגיח צריך נתון טרי
  var cD=hrCachedArr('_atData','hr_sessions');
  var cT=hrCachedArr('_atTreats','hr_attend_treats');
  if(cD&&cT) _atSupPaint(el,cD,cT,'');
  else el.innerHTML='<div class="loading-note">⏳ טוען...</div>';
  var okA=await Promise.all([_atPullSessions(hrHebMonthWin(_atSupMonth(), S._atSupMI)), _atPullTreats()]);
  // כשל משיכה מסומן גלוי — המשגיח מחליט על סמך מה שהוא רואה
  _atSupPaint(el, hrCachedArr('_atData','hr_sessions')||[],
                  hrCachedArr('_atTreats','hr_attend_treats')||[],
                  (okA[0]&&okA[1])?'':'⚠️ הרענון מהענן נכשל — המוצג הוא העותק שבמכשיר');
}

function _atSupPaint(el, rawData, rawTreats, warn) {
  var data=(rawData||[]).filter(function(r){ return !(r && r.deleted); });
  var students=hrSortStudents(getStudents());
  var treats=atLiveTreats(rawTreats);

  _atSupMonth();
  var hy=S._atSupHY,mi=S._atSupMI;
  var mNames=_hcMN(hy);
  var mLabel=mNames[mi]+' '+_hcYL(hy);

  var curMax=(_hcBase(hy)||{ml:[]}).ml.length-1;
  var hasPrev=mi>0||!!_hcBase(hy-1);
  var hasNext=mi<curMax||!!_hcBase(hy+1);

  var navStyle='sup-nav';
  var navHtml='<div class="sup-nav-bar">'+
    '<button data-act="at-sup-nav" data-dir="-1" class="'+navStyle+(hasPrev?'':' sup-nav-off')+'"'+(hasPrev?'':' disabled')+'>›</button>'+
    '<span class="sup-nav-label">'+mLabel+'</span>'+
    '<button data-act="at-sup-nav" data-dir="1" class="'+navStyle+(hasNext?'':' sup-nav-off')+'"'+(hasNext?'':' disabled')+'>‹</button>'+
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
      // נספרים רק חיסור והיעדרות — לא אישור, בבית או מנוחה
      if(m.s==='e' || m.s==='x'){
        stats[sid].absent++;
        stats[sid].records.push({recId:rec.id,session:rec.session,date_iso:rec.date_iso,date_heb:dh,mark:m.s,min:m.min||0});
      }
      if(m.s==='l'){
        stats[sid].lateMin+=m.min||0;
        stats[sid].records.push({recId:rec.id,session:rec.session,date_iso:rec.date_iso,date_heb:dh,mark:m.s,min:m.min||0});
      }
    });
  });

  // הרשימה נבנית מסדר התלמידים ולא מ-Object.entries — מפתח שנראה כמספר שלם ממוין מספרית לפני השאר
  var rows=students.map(function(s){return [String(s.id), stats[s.id]];})
    .filter(function(e){return e[1]&&(e[1].absent>0||e[1].lateMin>0);})
    .sort(function(a,b){return (b[1].absent-a[1].absent)||b[1].lateMin-a[1].lateMin;});

  if(!rows.length){
    el.innerHTML=navHtml+'<div class="empty-note">אין חיסורים ב'+mLabel+'</div>';return;
  }

  S._atSupRecords={};
  rows.forEach(function(e){S._atSupRecords[e[0]]=e[1].records||[];});

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
      lastHtml='<span class="badge-ok">📝 יום '+atDow(ltIso)+' '+esc(ltDateStr)+'</span>';
    }
    var alert20=st.absent>=20?'<span class="badge-bad">⚠️ 20+</span>':'';
    var alert300=st.lateMin>=300?'<span class="badge-warn">⏰ 300+</span>':'';
    var clsLabel=st.cls==='a'?'א':st.cls==='b'?'ב':st.cls==='g'?'ג':st.cls||'';
    var cardId='sup-card-'+sid;
    html+='<div id="'+cardId+'" class="sup-card-pane sup-card">';
    html+='<div class="sup-card-head" data-act="toggle-next" data-chev="sup-chev">';
    html+='<div class="sup-card-class">'+esc(clsLabel)+'</div>';
    html+='<div class="rec-main"><div class="rec-title">'+esc(st.name)+alert20+alert300+'</div>'+(lastHtml?'<div class="rec-last">'+lastHtml+'</div>':'')+'</div>';
    html+='<div class="sup-card-stats">';
    html+='<span class="rec-abs">חיסורים: <b>'+st.absent+'</b></span>';
    html+='<span class="rec-late">איחורים: <b>'+st.lateMin+'</b>ד׳</span>';
    html+='<span class="rec-muted">טיפולים: <b>'+stuTreats.length+'</b></span>';
    html+='<button data-act="at-sup-detail" data-id="'+esc(sid)+'" class="sup-detail-btn">🔍 פירוט</button>';
    html+='</div>';
    html+='<span class="sup-chev-icon sup-chev">›</span>';
    html+='</div>';
    html+='<div class="sup-card-body hidden">';
    html+='<div class="treat-add">';
    html+='<div class="panel-head-sm">➕ הוסף טיפול</div>';
    html+='<div class="chip-row ksave">';
    var cfg=S._atCfg||atDefaultCfg();
    html+='<select aria-label="סוג הטיפול" id="at-treat-type-'+sid+'" class="treat-select">'+
      cfg.treats.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'</select>';
    html+='<input aria-label="הערה (אופציונלי)" id="at-treat-note-'+sid+'" placeholder="הערה (אופציונלי)" class="treat-note-input">';
    html+='<button data-act="at-add-treat" data-ksave data-id="'+esc(sid)+'" class="treat-save-btn">שמור</button>';
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
          '<button data-act="at-del-treat" data-id="'+esc(t.id)+'" class="treat-del-btn">✕</button>'+
        '</div>';
      }).join('');
    }
    html+='</div></div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ── נוכחות — טיפולים ופירוט תלמיד ──
async function atAddTreat(sid) {
  var typeEl=document.getElementById('at-treat-type-'+sid);
  var noteEl=document.getElementById('at-treat-note-'+sid);
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
    updatedAt:now.getTime() // חובה למיזוג — רשומה בלי updatedAt נופלת
  };
  var treats=await atLoadTreats();
  treats.push(rec);
  await atSaveTreats(treats);
  if(noteEl) noteEl.value='';
  atRenderSupervision();
  toast(MSG_CARE_SAVED, null, 'good');
}

function atDeleteTreat(id) {
  ask(MSG_DEL_CARE_TITLE, MSG_DEL_CARE_BODY, MSG_DELETE)
    .then(function (yes) { if (yes) atDeleteTreatConfirmed(id); });
}

async function atDeleteTreatConfirmed(id) {
  closeModal();
  var treats=await atLoadTreats();
  // tombstone ולא filter — רשומה שנעלמת בלי סימון חוזרת מהענן במיזוג הבא
  var ts=Date.now(), by=hrWho(), found=false;
  treats.forEach(function(t){
    if(!t||String(t.id)!==String(id)||t.deleted) return;
    t.deleted=true; t.updatedAt=ts; t.deletedBy=by; found=true;
  });
  if(!found){ toast(MSG_CARE_MISSING, null, 'bad'); atRenderSupervision(); return; }
  await atSaveTreats(treats);
  atRenderSupervision();
  toast(MSG_DELETED_MARK, null, 'good');
}

// ── פירוט חודשי לתלמיד ──
var ARC_LBL_DET={p:'נוכח',l:'איחור',e:'חיסור',x:'היעדרות',ap:'אישור',ak:'בבית',a:'מנוחה'};

function atSupDetail(sid) {
  var students=getStudents();
  var st=students.find(function(s){return String(s.id)===String(sid);});
  var name=st?st.name:'תלמיד';
  var records=(S._atSupRecords&&S._atSupRecords[sid])||[];

  var rowsHtml='';
  if(!records.length){rowsHtml='<div class="loading-note">אין חיסורים בחודש זה</div>';}
  else{
    records.slice().sort(function(a,b){return HE.compare(a.date_iso,b.date_iso)||HE.compare(a.session,b.session);}).forEach(function(r){
      var hd=r.date_heb;
      var hbr=hd?_hcFmt(hd.hy,hd.mi,hd.day):r.date_iso;
      var dowStr='יום '+atDow(r.date_iso);
      var lbl=r.mark==='l'?('איחור — '+(r.min||0)+' ד׳'):(ARC_LBL_DET[r.mark]||r.mark);
      var mkc=atvCls(r.mark);
      rowsHtml+='<div class="mark-hist-row">';
      rowsHtml+='<span class="mark-hist-dow">'+(dowStr)+'</span>';
      rowsHtml+='<span class="mark-hist-date">'+esc(hbr)+'</span>';
      rowsHtml+='<span class="mark-hist-sess">'+esc(r.session)+'</span>';
      rowsHtml+='<span class="'+mkc+' hist-mark">'+esc(lbl)+'</span>';
      rowsHtml+='<button data-act="at-mark-edit" data-rec="'+esc(r.recId)+'" data-sid="'+esc(sid)+'" data-code="'+esc(r.mark)+'" '+
        ' class="mark-edit-btn">✏️ ערוך</button>';
      rowsHtml+='</div>';
    });
  }

  openModal(MSG_MONTH_DETAIL+name,
    '<div class="scroll-pane">'+rowsHtml+'</div>','');
}

function atSupEditMarkDlg(recId, sid, curMark) {
  var CODES=[
    {c:'p', lbl:'✓ נוכח'},
    {c:'l', lbl:'⏰ איחור'},
    {c:'e', lbl:'− חיסור'},
    {c:'x', lbl:'✕ היעדרות'},
    {c:'ap', lbl:'א אישור'},
    {c:'ak', lbl:'ב בבית'},
    {c:'a', lbl:'ג מנוחה'}
  ];
  var btnsHtml=CODES.map(function(cd){
    var active=cd.c===curMark?'mark-on':'mark-off';
    return '<button data-act="at-mark-set" data-rec="'+esc(recId)+'" data-sid="'+esc(sid)+'" data-code="'+esc(cd.c)+'" '+
      'class="'+atvCls(cd.c)+' '+active+' mark-pick">'+cd.lbl+'</button>';
  }).join('');
  openModal(MSG_EDIT_MARK,
    '<div class="chip-row">'+btnsHtml+'</div>',
    '<button data-act="modal-close" class="md-btn-ghost">ביטול</button>');
}

async function atEditMark(recId, sid, newCode) {
  var data=await atLoadData();
  var rec=data.find(function(r){return idEq(r.id,recId);});
  if(!rec){toast(MSG_ROW_MISSING, null, 'bad');return;}
  if(!rec.marks||typeof rec.marks!=='object') rec.marks={};
  if(!rec.marks[sid]) rec.marks[sid]={};
  rec.marks[sid].s=newCode;
  if(newCode!=='l') rec.marks[sid].min=0;
  rec.updatedAt=Date.now();
  // הטוסט אחרי הכתיבה לדיסק, שסינכרונית בראש hrCfgSet; ההמתנה שאחריה היא הרשת בלבד.
  // ההבטחה מוחזרת כדי שנקודת הניתוב תשחרר את הכפתור לפיה.
  var _p=atSaveData(data);
  closeModal();
  atRenderTodaySessions();
  shell.atRenderArchive();
  atRenderSupervision();
  toast(MSG_MARK_UPDATED, null, 'good');
  await _p;
}

// ── הגדרות מודול ──
async function renderAttendSettings() {
  atCachedCfg();
  _atPaintSettings();
  await _atPullCfg();
  _atPaintSettings();
}

function _atPaintSettings() {
  var cfg=S._atCfg||atDefaultCfg();
  var sc=document.getElementById('at-cfg-sessions');
  var tc=document.getElementById('at-cfg-treats');
  if(sc){
    sc.innerHTML=cfg.sessions.map(function(s){
      return '<div data-sess-row="1" class="sess-edit-row">'+
        '<input aria-label="שם הסדר" data-sess-name="1" value="'+esc(s.name)+'" placeholder="שם הסדר" class="sess-field">'+
        '<input data-sess-time="1" aria-label="שעת הסדר" type="time" value="'+esc(s.startTime||'')+'" class="cfg-row-input">'+
        '<button data-act="row-remove" class="row-del-btn">✕</button>'+
      '</div>';
    }).join('');
  }
  if(tc){
    tc.innerHTML=cfg.treats.map(function(t,i){
      return '<div class="badge-row">'+
        '<input aria-label="שם הטיפול" value="'+esc(t)+'" id="at-treat-inp-'+i+'" class="sess-field">'+
        '<button data-act="row-remove" class="row-del-btn">✕</button>'+
      '</div>';
    }).join('');
  }
}

function atAddSession() {
  var sc=document.getElementById('at-cfg-sessions');
  if(!sc) return;
  var div=document.createElement('div');
  div.setAttribute('data-sess-row','1');
  div.className='edit-row sess-edit-row-gap';
  div.innerHTML='<input aria-label="שם הסדר" data-sess-name="1" placeholder="שם הסדר" class="sess-field">'+
    '<input data-sess-time="1" aria-label="שעת הסדר" type="time" class="cfg-row-input">'+
    '<button data-act="row-remove" class="row-del-btn">✕</button>';
  sc.appendChild(div);div.querySelector('[data-sess-name]').focus();
}

function atAddTreatRow() {
  var tc=document.getElementById('at-cfg-treats');
  if(!tc) return;
  var div=document.createElement('div');
  div.className='edit-row';
  div.innerHTML='<input aria-label="שם הטיפול" placeholder="שם הטיפול" class="sess-field"><button data-act="row-remove" class="row-del-btn">✕</button>';
  tc.appendChild(div);div.querySelector('input').focus();
}

async function atSaveSettingsCfg() {
  var cfg=S._atCfg||atDefaultCfg();
  var oldSessions=(cfg.sessions||[]).slice();
  var sc=document.getElementById('at-cfg-sessions');
  if(sc){
    var newSess=[];
    sc.querySelectorAll('[data-sess-row]').forEach(function(row,i){
      var nameInp=row.querySelector('[data-sess-name]');
      var timeInp=row.querySelector('[data-sess-time]');
      var name=(nameInp?nameInp.value.trim():''); if(!name) return;
      // השם הוא הזהות כאן — שורה שנייה באותו שם הייתה מקבלת את אותו id
      if(uniqHas(newSess, {name:name}, function(x){return x.name;})) return;
      var startTime=(timeInp?timeInp.value.trim():'');
      var existing=oldSessions.find(function(s){return s.name===name;});
      var entry={id:existing?existing.id:('s_'+Date.now()+'_'+i),name:name};
      if(startTime) entry.startTime=startTime;
      newSess.push(entry);
    });
    cfg.sessions=newSess;
  }
  var tc=document.getElementById('at-cfg-treats');
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
  S._atCfg=null;
  await atSaveCfg(cfg);
  S._atCfg=cfg;
  toast(MSG_SETTINGS_SAVED, null, 'good');
}

export { atAddSession, atAddTreat, atAddTreatRow, atDeleteTreat, atEditMark,
         atRenderSupervision, atSaveSettingsCfg, atSupDetail, atSupEditMarkDlg, atSupNav,
         renderAttendSettings };
