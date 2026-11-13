// app/screens/stats.js — סטטיסטיקה: שלושה סוגים — שמירת הסדרים · מבחנים · השעיות — ועשר סטטיסטיקות קבועות לכל סוג.
// לצפייה בלבד, לכל מי שנכנס; בלי בחירת תקופה ובלי סינון — כל סטטיסטיקה נושאת את התקופה שלה (החודש העברי, או השנה מול אשתקד).
// הכל נגזר מהמראה שבמכשיר בכל ציור, ואף סיכום אינו נשמר.
import { esc } from '../../core/ui.js';
import { dayDiff, dayIso, dayNoon, dayToday } from '../../core/util.js';
import { HR_ALERT_ABS, HR_ALERT_LATE, HR_CLS_LIST, HR_CLS_NAME, HR_EXAM_SUBJECTS } from '../constants.js';
import { S } from '../state.js';
import { getActiveAbsences, getStudents, hrMarks, hrMirrorRecs } from '../domain.js';
import { HR_STREAMS, hrExamGrp, hrIsLate, hrIsPrayer } from '../domain.sessions.js';
import { HR_PER, hrKeyParts, hrMonthKey, hrMonthKeyAdd, hrMonthKeyNow, hrMonthKeyOfIso } from '../domain.periods.js';
import { _hcMN, _hcYL } from '../domain.hebdate.js';
import { icon } from '../icons.js';

// שלושת הסוגים — הכפתור בראשי והלשונית במסך
var STX_KINDS = [
  { k: 'attend', ico: 'attend', name: 'שמירת הסדרים' },
  { k: 'exams', ico: 'exams', name: 'מבחנים' },
  { k: 'susp', ico: 'suspended', name: 'השעיות' }
];
var EXAM_GRPS = ['a', 'b', 'g'];   // השלוחים נבחנים עם ג׳ (hrExamGrp)
var GRADE_LOW = 70;                 // «צריכים חיזוק» — ממוצע שנתי מתחת לזה

// ── הרכיב בראשי ──
function statsHomeHTML() {
  return '<div class="stx-home"><div class="mods-lbl">סטטיסטיקה</div><div class="stx-btns">' +
    STX_KINDS.map(function (t) {
      return '<button class="stx-btn" data-act="stats" data-k="' + t.k + '"><span class="stx-btn-ic">' + icon(t.ico) + '</span>' +
        '<span class="stx-btn-name">' + t.name + '</span><span class="stx-btn-go">' + icon('prev') + '</span></button>';
    }).join('') + '</div></div>';
}

// ── המסך ──
function screenStatsHTML() {
  return '<div class="pg" id="pg-stats"><div class="inner">' +
    '<div class="at-tab-bar" id="stx-tabs"></div><div id="stx-body"></div></div></div>';
}

function statsKind() { var k = S._stxKind; return STX_KINDS.some(function (t) { return t.k === k; }) ? k : 'attend'; }
function statsOpen(k) { S._stxKind = k; }

function renderStats() {
  var tabs = document.getElementById('stx-tabs'), body = document.getElementById('stx-body');
  if (!tabs || !body) return;
  var k = statsKind();
  tabs.innerHTML = STX_KINDS.map(function (t) {
    return '<button data-act="stats-tab" data-k="' + t.k + '" class="' + (t.k === k ? 'at-tab-btn-on' : 'at-tab-btn') + '">' + t.name + '</button>';
  }).join('');
  var cards;
  try { cards = k === 'exams' ? examCards() : k === 'susp' ? suspCards() : attendCards(); }
  catch (e) { console.error('[stats]', e); cards = [card('', '', empty('לא ניתן לחשב את הסטטיסטיקה כעת'))]; }
  body.innerHTML = '<div class="stx-grid">' + cards.join('') + '</div>';
}

// ── חודשים ושנים ──
function mName(k) { var p = hrKeyParts(k); return p ? (_hcMN(p.hy)[p.mi] || '') : ''; }
function mLabel(k) { var p = hrKeyParts(k); return p ? mName(k) + ' ' + _hcYL(p.hy) : ''; }
function yLabel(hy) { return _hcYL(hy); }
// אותו חודש אשתקד — לפי שם החודש; אדר בשנה רגילה מול אדר ב׳ במעוברת, ואדר א׳ / ב׳ מול אדר
function lastYearOf(k) {
  var p = hrKeyParts(k); if (!p) return '';
  var name = _hcMN(p.hy)[p.mi], prev = _hcMN(p.hy - 1) || [], i = prev.indexOf(name);
  if (i < 0 && name.indexOf('אדר') === 0) {
    var adars = []; prev.forEach(function (n, j) { if (n.indexOf('אדר') === 0) adars.push(j); });
    if (adars.length) i = name === 'אדר' ? adars[adars.length - 1] : adars[0];
  }
  return i < 0 ? '' : hrMonthKey(p.hy - 1, i);
}
// השנה עד החודש הנוכחי, ואשתקד עד אותו חודש — המפתחות
function ytd() {
  var now = hrMonthKeyNow(), p = hrKeyParts(now), ly = lastYearOf(now), lp = hrKeyParts(ly);
  var cur = [], last = [];
  for (var i = 0; i <= p.mi; i++) cur.push(hrMonthKey(p.hy, i));
  if (lp) for (var j = 0; j <= lp.mi; j++) last.push(hrMonthKey(lp.hy, j));
  return { hy: p.hy, now: now, cur: cur, last: last };
}
// חודשי השנה הנוכחית מתשרי עד אלול, וכל אחד מול החודש שלו אשתקד
function yearMonths() {
  var hy = hrKeyParts(hrMonthKeyNow()).hy;
  return (_hcMN(hy) || []).map(function (n, i) { var k = hrMonthKey(hy, i); return { k: k, name: n, ly: lastYearOf(k) }; });
}
function inSet(list) { var o = {}; list.forEach(function (k) { o[k] = 1; }); return o; }

// ── תלמידים ──
function studentsMap() { var m = {}; getStudents().forEach(function (s) { m[String(s.client_id)] = s; }); return m; }
function clsShort(s) { return s && HR_CLS_NAME[s.cls] ? HR_CLS_NAME[s.cls] : ''; }

// ── רכיבי התצוגה ──
function card(title, sub, body, wide) {
  return '<section class="stx-card' + (wide ? ' stx-wide' : '') + '">' +
    (title ? '<div class="stx-h"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' : '') +
    '<div class="stx-b">' + body + '</div></section>';
}
function empty(msg) { return '<div class="stx-empty">' + esc(msg) + '</div>'; }
function pct(v) { return v == null ? '—' : Math.round(v) + '%'; }
function cnt(v) { return v == null ? '—' : String(v); }
function num1(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('he-IL'); }
// שינוי מול השוואה: חץ וגוון — up=true כשעלייה היא שיפור
function delta(cur, base, unit, up, label) {
  if (cur == null || base == null) return '<span class="stx-d stx-d-na">' + esc(label) + ': אין נתונים</span>';
  var d = Math.round((cur - base) * 10) / 10;
  var tone = d === 0 ? 'eq' : ((d > 0) === up ? 'good' : 'bad');
  var arr = d === 0 ? '' : '<span class="stx-arr' + (d > 0 ? ' up' : '') + '">' + icon('down') + '</span>';
  return '<span class="stx-d stx-d-' + tone + '">' + arr + (d > 0 ? '+' : '') + d.toLocaleString('he-IL') + unit +
    ' <em>' + esc(label) + '</em></span>';
}
function big(value, caption, deltas) {
  return '<div class="stx-big"><div class="stx-big-n">' + value + '</div>' + (caption ? '<div class="stx-big-l">' + esc(caption) + '</div>' : '') +
    (deltas && deltas.length ? '<div class="stx-ds">' + deltas.join('') + '</div>' : '') + '</div>';
}
// השנה מול אשתקד — שני מספרים זה לצד זה והשינוי ביניהם
function duo(curV, lastV, fmt, curL, lastL, up) {
  return '<div class="stx-duo"><div class="stx-duo-c"><span>' + esc(curL) + '</span><b>' + fmt(curV) + '</b></div>' +
    '<div class="stx-duo-c stx-duo-ly"><span>' + esc(lastL) + '</span><b>' + fmt(lastV) + '</b></div></div>' +
    '<div class="stx-ds">' + (lastV == null ? '<span class="stx-d stx-d-na">אין נתונים משנה שעברה</span>' : delta(curV, lastV, fmt === pct ? ' נק׳' : '', up, 'מול אשתקד')) + '</div>';
}
// עמודות לכל חודש — השנה (בצבע הזהות) ואשתקד (עמום); הסולם — מהערך הגבוה, או 100 באחוזים
function monthBars(rows, fmt, isPct) {
  var max = isPct ? 100 : 0;
  rows.forEach(function (r) { if (r.cur != null) max = Math.max(max, r.cur); if (r.last != null) max = Math.max(max, r.last); });
  if (!rows.some(function (r) { return r.cur != null || r.last != null; })) return empty('אין נתונים עדיין');
  max = max || 1;
  var h = function (v) { return v == null ? 0 : Math.max(0.02, v / max); };
  var col = function (v, cls) { return '<span class="stx-col ' + cls + '" style="--v:' + h(v).toFixed(3) + '"></span>'; };
  // הערכים — מעל העמודה הגבוהה שבזוג, הגבוה מעל הנמוך ובצבע העמודה (כמו בגיוס)
  var vals = function (r) {
    var a = r.cur != null ? { v: r.cur, c: 'cur' } : null, b = r.last != null ? { v: r.last, c: 'ly' } : null;
    var L = [a, b].filter(Boolean).sort(function (x, y) { return x.v - y.v; });
    if (!L.length) return '';
    return '<span class="stx-vals" style="--v:' + Math.max(h(r.cur), h(r.last)).toFixed(3) + '">' +
      L.map(function (x) { return '<i class="' + x.c + '">' + fmt(x.v) + '</i>'; }).join('') + '</span>';
  };
  return '<div class="stx-legend"><span><i class="cur"></i>השנה</span><span><i class="ly"></i>אשתקד</span></div>' +
    '<div class="stx-bars">' + rows.map(function (r) {
      return '<div class="stx-mon"><div class="stx-pair">' + col(r.cur, 'cur') + col(r.last, 'ly') + vals(r) + '</div><span class="stx-ml">' + esc(r.label) + '</span></div>';
    }).join('') + '</div>';
}
// רשימה עם פס: תווית · פס · ערך
function hbars(rows, fmt, max) {
  if (!rows.length) return empty('אין נתונים עדיין');
  max = max || Math.max.apply(null, rows.map(function (r) { return r.v || 0; })) || 1;
  return '<div class="stx-hl">' + rows.map(function (r) {
    return '<div class="stx-hr' + (r.tone ? ' stx-t-' + r.tone : '') + '"><span class="stx-hr-l">' + esc(r.label) +
      (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span>' +
      '<span class="stx-track"><span style="width:' + Math.max(2, Math.min(100, (r.v || 0) / max * 100)).toFixed(1) + '%"></span></span>' +
      '<b class="stx-hr-v">' + fmt(r.v) + '</b></div>';
  }).join('') + '</div>';
}
// רשימת תלמידים ממוספרת: שם ושיעור, ובצד תגיות
var PEOPLE_MAX = 12;   // רשימה ארוכה — שתים עשרה הראשונים, ושורת «ועוד N»
function people(rows, emptyMsg) {
  if (!rows.length) return empty(emptyMsg);
  var more = rows.length - PEOPLE_MAX;
  if (more > 0) rows = rows.slice(0, PEOPLE_MAX);
  return '<ol class="stx-pl">' + rows.map(function (r, i) {
    return '<li><span class="stx-pn">' + (i + 1) + '</span><span class="stx-pw"><b>' + esc(r.name) + '</b><small>' + esc(r.sub || '') + '</small></span>' +
      '<span class="stx-pills">' + (r.pills || []).map(function (p) { return '<span class="stx-pill stx-pill-' + (p.tone || 'n') + '">' + esc(p.t) + '</span>'; }).join('') + '</span></li>';
  }).join('') + '</ol>' + (more > 0 ? '<div class="stx-more">ועוד ' + more + '</div>' : '');
}

// ═══════════════ שמירת הסדרים ═══════════════
// נוכחות — נוכחים ומאחרים מתוך מי שסומן נוכח או נעדר (כמו בקוביות «היום»); חיסור — e · x; איחור בדקות — l בסדרים,
// ובתפילה — קל ומשמעותי (כמו בהשגחה).
function attendIndex() {
  var st = HR_STREAMS.attend, SM = studentsMap();
  var recs = (hrMirrorRecs('hr_sessions') || []).filter(function (r) { return r && !r.deleted && r.session_date; });
  var M = {};   // חודש ⟵ סיכומים
  var bucket = function (k) {
    return M[k] || (M[k] = { pres: 0, abs: 0, cls: {}, sess: {}, stu: {}, pray: {} });
  };
  var keyOf = {};
  recs.forEach(function (rec) {
    var d = rec.session_date, k = keyOf[d] || (keyOf[d] = hrMonthKeyOfIso(d)), b = bucket(k);
    var pr = hrIsPrayer(st, rec.session), name = String(rec.session || '');
    var ss = b.sess[name] || (b.sess[name] = { pres: 0, abs: 0, pr: pr });
    var pp = pr ? (b.pray[name] || (b.pray[name] = { abs: 0, lk: 0, lm: 0 })) : null;
    var marks = hrMarks(rec);
    Object.keys(marks).forEach(function (sid) {
      var m = marks[sid] || {}, c = m.status, s = SM[sid];
      var isAbs = c === 'e' || c === 'x', isPres = c === 'p' || hrIsLate(c);
      if (!isAbs && !isPres) return;
      var cl = s ? s.cls : '';
      var cc = b.cls[cl] || (b.cls[cl] = { pres: 0, abs: 0 });
      var su = b.stu[sid] || (b.stu[sid] = { abs: 0, pres: 0, late: 0 });
      if (isAbs) { b.abs++; cc.abs++; ss.abs++; su.abs++; if (pp) pp.abs++; }
      else { b.pres++; cc.pres++; ss.pres++; su.pres++; }
      if (c === 'l') su.late += Math.round(Number(m.minutes) || 0);
      if (pp && (c === 'lk' || c === 'lm')) pp[c]++;
    });
  });
  return { M: M, SM: SM };
}
function rate(o) { return o && (o.pres + o.abs) > 0 ? o.pres / (o.pres + o.abs) * 100 : null; }
function sumRate(M, keys) {
  var t = { pres: 0, abs: 0 };
  keys.forEach(function (k) { if (M[k]) { t.pres += M[k].pres; t.abs += M[k].abs; } });
  return rate(t);
}

function attendCards() {
  var I = attendIndex(), M = I.M, SM = I.SM, Y = ytd(), now = Y.now, prev = hrMonthKeyAdd(now, -1), ly = lastYearOf(now);
  var cur = M[now], out = [];

  // 1 · אחוז הנוכחות החודש
  out.push(card('אחוז הנוכחות החודש', mLabel(now),
    big(pct(rate(cur)), 'נוכחים ומאחרים מתוך מי שסומן', [
      delta(rate(cur), rate(M[prev]), ' נק׳', true, 'מול ' + mName(prev)),
      delta(rate(cur), rate(M[ly]), ' נק׳', true, 'מול ' + mName(ly) + ' אשתקד')])));

  // 2 · השנה מול שנה שעברה
  out.push(card('השנה מול שנה שעברה', 'מתשרי ועד ' + mName(now) + ', בשתי השנים',
    duo(sumRate(M, Y.cur), Y.last.length ? sumRate(M, Y.last) : null, pct, 'שנת ' + yLabel(Y.hy), 'שנת ' + yLabel(Y.hy - 1), true)));

  // 3 · מגמה חודשית — השנה מול אשתקד
  out.push(card('נוכחות לפי חודש', 'שנת ' + yLabel(Y.hy) + ' מול ' + yLabel(Y.hy - 1),
    monthBars(yearMonths().map(function (m) { return { label: m.name, cur: rate(M[m.k]), last: rate(M[m.ly]) }; }), pct, true), true));

  // 4 · לפי שיעור
  var clsRows = HR_CLS_LIST.map(function (c) {
    var o = cur && cur.cls[c], r = rate(o);
    return r == null ? null : { label: HR_CLS_NAME[c], v: r, sub: (o.pres + o.abs) + ' סימונים' };
  }).filter(Boolean);
  out.push(card('נוכחות לפי שיעור', mLabel(now), hbars(clsRows, pct, 100)));

  // 5 · לפי סדר — מהחלש לחזק
  var sessRows = cur ? Object.keys(cur.sess).map(function (n) { return { label: n, v: rate(cur.sess[n]) }; })
    .filter(function (r) { return r.v != null; }).sort(function (a, b) { return a.v - b.v; }) : [];
  sessRows.forEach(function (r) { r.tone = r.v < 80 ? 'bad' : r.v < 90 ? 'warn' : 'ok'; });
  out.push(card('נוכחות לפי סדר', mLabel(now) + ' · מהחלש לחזק', hbars(sessRows, pct, 100)));

  var stuOf = function (k) { return (M[k] && M[k].stu) || {}; };
  var nameRow = function (sid) { var s = SM[sid]; return { name: s ? s.name : '—', sub: clsShort(s) }; };

  // 6 · החורגים
  var cs = stuOf(now);
  var over = Object.keys(cs).filter(function (sid) { return SM[sid] && (cs[sid].abs >= HR_ALERT_ABS || cs[sid].late >= HR_ALERT_LATE); })
    .sort(function (a, b) { return (cs[b].abs * 15 + cs[b].late) - (cs[a].abs * 15 + cs[a].late); })
    .map(function (sid) {
      var r = nameRow(sid), o = cs[sid];
      r.pills = [{ t: o.abs + ' חיסורים', tone: o.abs >= HR_ALERT_ABS ? 'bad' : 'n' }, { t: o.late + ' דק׳ איחור', tone: o.late >= HR_ALERT_LATE ? 'warn' : 'n' }];
      return r;
    });
  out.push(card('החורגים', mLabel(now) + ' · ' + HR_ALERT_ABS + ' חיסורים או ' + HR_ALERT_LATE + ' דקות', people(over, 'אין חורגים החודש')));

  // 7 · הכי הרבה חיסורים
  var topAbs = Object.keys(cs).filter(function (sid) { return SM[sid] && cs[sid].abs > 0; })
    .sort(function (a, b) { return cs[b].abs - cs[a].abs; }).slice(0, 10)
    .map(function (sid) { var r = nameRow(sid); r.pills = [{ t: cs[sid].abs + ' חיסורים', tone: 'bad' }]; return r; });
  out.push(card('הכי הרבה חיסורים', mLabel(now), people(topAbs, 'אין חיסורים החודש')));

  // 8 · הכי הרבה דקות איחור
  var topLate = Object.keys(cs).filter(function (sid) { return SM[sid] && cs[sid].late > 0; })
    .sort(function (a, b) { return cs[b].late - cs[a].late; }).slice(0, 10)
    .map(function (sid) { var r = nameRow(sid); r.pills = [{ t: cs[sid].late + ' דק׳', tone: 'warn' }]; return r; });
  out.push(card('הכי הרבה דקות איחור', mLabel(now), people(topLate, 'אין איחורים החודש')));

  // 9 · המשתפרים — הירידה באחוז החיסור מול החודש הקודם (אחוז ולא מספר — החודש הנוכחי עוד לא נגמר)
  var ps = stuOf(prev), absPct = function (o) { return o && (o.abs + o.pres) > 0 ? o.abs / (o.abs + o.pres) * 100 : null; };
  var better = Object.keys(ps).filter(function (sid) { return SM[sid] && cs[sid] && absPct(ps[sid]) != null && absPct(cs[sid]) != null; })
    .map(function (sid) { return { sid: sid, a: absPct(ps[sid]), b: absPct(cs[sid]) }; })
    .filter(function (x) { return x.a - x.b >= 1; }).sort(function (x, y) { return (y.a - y.b) - (x.a - x.b); }).slice(0, 10)
    .map(function (x) {
      var r = nameRow(x.sid);
      r.pills = [{ t: '−' + Math.round(x.a - x.b) + ' נק׳', tone: 'ok' }, { t: 'חיסור ' + Math.round(x.a) + '% ⟵ ' + Math.round(x.b) + '%', tone: 'n' }];
      return r;
    });
  out.push(card('המשתפרים', 'אחוז החיסור · ' + mLabel(now) + ' מול ' + mName(prev), people(better, 'אין עדיין ירידה בחיסורים מול ' + mName(prev))));

  // 10 · תפילות
  var pray = cur ? Object.keys(cur.pray) : [];
  out.push(card('תפילות', mLabel(now), pray.length ? '<div class="stx-tbl"><table><thead><tr><th>תפילה</th><th>חיסורים</th><th>איחור קל</th><th>איחור משמעותי</th></tr></thead><tbody>' +
    pray.map(function (n) { var o = cur.pray[n]; return '<tr><td>' + esc(n) + '</td><td class="stx-c-bad">' + o.abs + '</td><td class="stx-c-warn">' + o.lk + '</td><td class="stx-c-warn">' + o.lm + '</td></tr>'; }).join('') +
    '</tbody></table></div>' : empty('אין תפילות מסומנות החודש')));
  return out;
}

// ═══════════════ מבחנים ═══════════════
// המבחן של הקובייה בלבד — לא «מבחן נוסף», כמו בגיליון; ציון — 0–100.
function examIndex() {
  var SM = studentsMap();
  var recs = (hrMirrorRecs('hr_exams') || []).filter(function (r) { return r && !r.deleted && !r.extra && r.session_date; });
  var G = [];   // { k, subj, grp, sid, g }
  var cubes = {};   // חודש ⟵ { "לימוד|קבוצה": true }
  recs.forEach(function (rec) {
    var k = hrMonthKeyOfIso(rec.session_date), grp = hrExamGrp(rec.cls), subj = String(rec.session || '');
    (cubes[k] || (cubes[k] = {}))[subj + '|' + grp] = true;
    var marks = hrMarks(rec);
    Object.keys(marks).forEach(function (sid) {
      var g = marks[sid] && marks[sid].grade;
      if (g === null || g === undefined || g === '') return;
      g = Number(g); if (!isFinite(g)) return;
      G.push({ k: k, subj: subj, grp: grp, sid: sid, g: g });
    });
  });
  return { G: G, cubes: cubes, SM: SM };
}
function avg(list) { return list.length ? list.reduce(function (a, x) { return a + x.g; }, 0) / list.length : null; }

function examCards() {
  var I = examIndex(), G = I.G, SM = I.SM, Y = ytd(), out = [];
  var ofMonth = function (k) { return G.filter(function (x) { return x.k === k; }); };
  // חודש המבחנים — החודש האחרון עד היום שיש בו ציונים
  var ks = {}; G.forEach(function (x) { if (x.k <= Y.now) ks[x.k] = 1; });
  var months = Object.keys(ks).sort(), M = months[months.length - 1] || Y.now, prevM = months[months.length - 2] || '';
  var cur = ofMonth(M), lyM = lastYearOf(M), lyG = ofMonth(lyM);
  var ml = mLabel(M);
  var subjOrder = HR_EXAM_SUBJECTS.slice();
  G.forEach(function (x) { if (subjOrder.indexOf(x.subj) < 0) subjOrder.push(x.subj); });
  var tone = function (v) { return v == null ? '' : v < GRADE_LOW ? 'bad' : v < 85 ? 'warn' : 'ok'; };

  // 1 · ממוצע לכל לימוד — מול אותו חודש אשתקד
  var subjRows = subjOrder.map(function (s) {
    var a = avg(cur.filter(function (x) { return x.subj === s; })); if (a == null) return null;
    var b = avg(lyG.filter(function (x) { return x.subj === s; }));
    return { label: s, v: a, tone: tone(a), sub: b == null ? '' : 'אשתקד ' + num1(b) };
  }).filter(Boolean);
  out.push(card('ממוצע לכל לימוד', ml + (lyG.length ? ' · מול ' + mName(lyM) + ' אשתקד' : ''), hbars(subjRows, num1, 100)));

  // 2 · השנה מול שנה שעברה
  var curY = inSet(Y.cur), lastY = inSet(Y.last);
  var gy = G.filter(function (x) { return curY[x.k]; }), gl = G.filter(function (x) { return lastY[x.k]; });
  out.push(card('השנה מול שנה שעברה', 'ממוצע הציונים מתשרי ועד ' + mName(Y.now),
    duo(avg(gy), gl.length ? avg(gl) : null, num1, 'שנת ' + yLabel(Y.hy), 'שנת ' + yLabel(Y.hy - 1), true)));

  // 3 · מגמה חודשית
  out.push(card('ממוצע לפי חודש', 'שנת ' + yLabel(Y.hy) + ' מול ' + yLabel(Y.hy - 1),
    monthBars(yearMonths().map(function (m) { return { label: m.name, cur: avg(ofMonth(m.k)), last: avg(ofMonth(m.ly)) }; }), num1, true), true));

  // 4 · לימוד מול שיעור
  var grpName = { a: "א'", b: "ב'", g: "ג'" };
  out.push(card('ממוצע לפי לימוד ושיעור', ml, cur.length ? '<div class="stx-tbl"><table><thead><tr><th>לימוד</th>' +
    EXAM_GRPS.map(function (g) { return '<th>' + grpName[g] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    subjOrder.filter(function (s) { return cur.some(function (x) { return x.subj === s; }); }).map(function (s) {
      return '<tr><td>' + esc(s) + '</td>' + EXAM_GRPS.map(function (g) {
        var a = avg(cur.filter(function (x) { return x.subj === s && x.grp === g; }));
        return '<td class="stx-c-' + (tone(a) || 'na') + '">' + num1(a) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>' : empty('אין ציונים עדיין'), true));

  // 5 · התפלגות הציונים
  var buckets = [['90 ומעלה', 90, 101, 'ok'], ['80–89', 80, 90, 'ok'], ['70–79', 70, 80, 'warn'], ['מתחת ל־70', -1, 70, 'bad']];
  out.push(card('התפלגות הציונים', ml + ' · ' + cur.length + ' ציונים', hbars(buckets.map(function (b) {
    var n = cur.filter(function (x) { return x.g >= b[1] && x.g < b[2]; }).length;
    return { label: b[0], v: n, tone: b[3], sub: cur.length ? Math.round(n / cur.length * 100) + '%' : '' };
  }), function (v) { return String(v); }, cur.length || 1)));

  // 6 · מי לא נבחן — במבחנים של החודש שנפתחו, תלמיד פעיל של השיעור בלי ציון
  var cubesM = I.cubes[M] || {}, missing = {};
  Object.keys(cubesM).forEach(function (key) {
    var p = key.split('|'), subj = p[0], grp = p[1];
    Object.keys(SM).forEach(function (sid) {
      var s = SM[sid];
      if (hrExamGrp(s.cls) !== grp || !HR_PER.inMonth(s, M)) return;
      if (cur.some(function (x) { return x.sid === sid && x.subj === subj; })) return;
      (missing[sid] || (missing[sid] = [])).push(subj);
    });
  });
  var missRows = Object.keys(missing).sort(function (a, b) { return missing[b].length - missing[a].length; }).map(function (sid) {
    var s = SM[sid];
    return { name: s.name, sub: clsShort(s), pills: missing[sid].map(function (t) { return { t: t, tone: 'warn' }; }) };
  });
  out.push(card('מי לא נבחן', ml, people(missRows, 'כל התלמידים נבחנו במבחנים שנפתחו')));

  // 7 · המצטיינים · 8 · צריכים חיזוק — ממוצע השנה
  var byStu = {};
  gy.forEach(function (x) { (byStu[x.sid] || (byStu[x.sid] = [])).push(x); });
  var stuAvg = Object.keys(byStu).filter(function (sid) { return SM[sid]; }).map(function (sid) { return { sid: sid, a: avg(byStu[sid]), n: byStu[sid].length }; });
  var stuRow = function (x, t) { var s = SM[x.sid]; return { name: s.name, sub: clsShort(s), pills: [{ t: num1(x.a), tone: t }, { t: x.n + ' מבחנים', tone: 'n' }] }; };
  out.push(card('המצטיינים', 'ממוצע שנת ' + yLabel(Y.hy), people(stuAvg.slice().sort(function (a, b) { return b.a - a.a; }).slice(0, 10)
    .map(function (x) { return stuRow(x, 'ok'); }), 'אין ציונים השנה')));
  out.push(card('צריכים חיזוק', 'ממוצע שנת ' + yLabel(Y.hy) + ' מתחת ל־' + GRADE_LOW, people(stuAvg.filter(function (x) { return x.a < GRADE_LOW; })
    .sort(function (a, b) { return a.a - b.a; }).map(function (x) { return stuRow(x, 'bad'); }), 'אין תלמידים מתחת ל־' + GRADE_LOW)));

  // 9 · המשתפרים — ממוצע החודש מול חודש המבחנים הקודם
  var pr = prevM ? ofMonth(prevM) : [], up = [];
  if (pr.length) {
    var pa = {}, ca = {};
    pr.forEach(function (x) { (pa[x.sid] || (pa[x.sid] = [])).push(x); });
    cur.forEach(function (x) { (ca[x.sid] || (ca[x.sid] = [])).push(x); });
    up = Object.keys(ca).filter(function (sid) { return pa[sid] && SM[sid]; })
      .map(function (sid) { return { sid: sid, a: avg(ca[sid]), b: avg(pa[sid]) }; })
      .filter(function (x) { return x.a > x.b; }).sort(function (x, y) { return (y.a - y.b) - (x.a - x.b); }).slice(0, 10)
      .map(function (x) { var s = SM[x.sid]; return { name: s.name, sub: clsShort(s), pills: [{ t: '+' + num1(x.a - x.b), tone: 'ok' }, { t: num1(x.b) + ' ⟵ ' + num1(x.a), tone: 'n' }] }; });
  }
  out.push(card('המשתפרים', prevM ? ml + ' מול ' + mName(prevM) : ml, people(up, prevM ? 'אין עלייה בממוצע מול ' + mName(prevM) : 'אין עדיין חודש קודם להשוואה')));

  // 10 · אחוז הנבחנים לפי שיעור
  var testedRows = EXAM_GRPS.map(function (g) {
    var subs = Object.keys(cubesM).filter(function (key) { return key.split('|')[1] === g; }).map(function (key) { return key.split('|')[0]; });
    if (!subs.length) return null;
    var act = Object.keys(SM).filter(function (sid) { return hrExamGrp(SM[sid].cls) === g && HR_PER.inMonth(SM[sid], M); });
    var need = act.length * subs.length; if (!need) return null;
    var got = cur.filter(function (x) { return x.grp === g && subs.indexOf(x.subj) >= 0 && act.indexOf(x.sid) >= 0; }).length;
    var v = got / need * 100;
    return { label: HR_CLS_NAME[g], v: v, tone: v < 80 ? 'warn' : 'ok', sub: got + ' מתוך ' + need + ' ציונים' };
  }).filter(Boolean);
  out.push(card('אחוז הנבחנים לפי שיעור', ml, hbars(testedRows, pct, 100)));
  return out;
}

// ═══════════════ השעיות ═══════════════
// השעיה — סטטוס `suspended` בתלמיד; נזקפת לחודש שבו התחילה, ומשכה בימים — עד הסיום, ובלעדיו עד היום.
function suspIndex() {
  var L = [], today = dayToday();
  getStudents().forEach(function (s) {
    (Array.isArray(s.absences) ? s.absences : []).forEach(function (a) {
      if (!a || a.deleted || a.type !== 'suspended' || !a.from_at) return;
      var f = new Date(a.from_at); if (isNaN(f.getTime())) return;
      var t = a.to_at ? new Date(a.to_at) : null; if (t && isNaN(t.getTime())) t = null;
      var fi = dayIso(f), ti = t ? dayIso(t) : null;
      L.push({ s: s, a: a, from: f, to: t, fi: fi, ti: ti, k: hrMonthKeyOfIso(fi), days: Math.max(1, dayDiff(fi, ti && ti < today ? ti : today) + 1) });
    });
  });
  return L;
}
function fmtDay(d) { return d ? d.getDate() + '.' + (d.getMonth() + 1) : ''; }

// תחילת הרישום — החודש של הסדר הראשון; לפניו אין «אפס השעיות» אלא אין נתונים, והשוואה לאשתקד — רק מחודש זה
function dataStart() {
  var first = '';
  (hrMirrorRecs('hr_sessions') || []).forEach(function (r) { if (r && !r.deleted && r.session_date && (!first || r.session_date < first)) first = r.session_date; });
  return first ? hrMonthKeyOfIso(first) : hrMonthKeyNow();
}
function suspCards() {
  var L = suspIndex(), Y = ytd(), now = Y.now, today = dayToday(), out = [], DS = dataStart();
  var ly = lastYearOf(now); if (ly && ly < DS) ly = '';
  var ofKeys = function (keys) { var o = inSet(keys); return L.filter(function (x) { return o[x.k]; }); };
  var days = function (list) { return list.reduce(function (a, x) { return a + x.days; }, 0); };
  var curY = ofKeys(Y.cur), lastY = ofKeys(Y.last);

  // 1 · מושעים עכשיו
  var nowRows = [];
  getStudents().forEach(function (s) {
    getActiveAbsences(s).filter(function (a) { return a.type === 'suspended'; }).forEach(function (a) {
      var t = a.to_at ? new Date(a.to_at) : null;
      nowRows.push({ name: s.name, sub: clsShort(s) + (a.reason ? ' · ' + a.reason : ''), t: t ? t.getTime() : Infinity,
        pills: [{ t: t ? 'עד ' + fmtDay(t) : 'ללא תאריך סיום', tone: 'bad' }] });
    });
  });
  nowRows.sort(function (a, b) { return a.t - b.t; });
  out.push(card('מושעים עכשיו', nowRows.length ? nowRows.length + ' תלמידים' : '', people(nowRows, 'אין מושעים כרגע')));

  // 2 · השעיות החודש — מול אותו חודש אשתקד
  var cm = ofKeys([now]), lm = ly ? ofKeys([ly]) : [];
  out.push(card('השעיות החודש', mLabel(now), big(String(cm.length), days(cm) + ' ימי השעיה', [
    ly ? delta(cm.length, lm.length, '', false, 'מול ' + mName(ly) + ' אשתקד') : '<span class="stx-d stx-d-na">אין נתונים משנה שעברה</span>'])));

  // 3 · השנה מול שנה שעברה — מספר וימים
  var lastHas = Y.last.length && Y.last[0] >= DS;
  out.push(card('השנה מול שנה שעברה', 'מתשרי ועד ' + mName(now) + ', בשתי השנים',
    duo(curY.length, lastHas ? lastY.length : null, cnt, 'שנת ' + yLabel(Y.hy), 'שנת ' + yLabel(Y.hy - 1), false) +
    '<div class="stx-note">ימי השעיה: ' + days(curY) + ' השנה' + (lastHas ? ' · ' + days(lastY) + ' אשתקד' : '') + '</div>'));

  // 4 · מגמה חודשית
  var byK = {}; L.forEach(function (x) { byK[x.k] = (byK[x.k] || 0) + 1; });
  out.push(card('השעיות לפי חודש', 'שנת ' + yLabel(Y.hy) + ' מול ' + yLabel(Y.hy - 1),
    monthBars(yearMonths().map(function (m) {
      return { label: m.name, cur: m.k <= now && m.k >= DS ? (byK[m.k] || 0) : null, last: m.ly && m.ly >= DS ? (byK[m.ly] || 0) : null };
    }), cnt, false), true));

  // 5 · לפי סיבה · 6 · לפי שיעור — השנה
  var tally = function (list, f) { var o = {}; list.forEach(function (x) { var k = f(x); o[k] = (o[k] || 0) + 1; }); return o; };
  var rs = tally(curY, function (x) { return x.a.reason || 'ללא סיבה'; });
  out.push(card('לפי סיבה', 'שנת ' + yLabel(Y.hy), hbars(Object.keys(rs).sort(function (a, b) { return rs[b] - rs[a]; })
    .map(function (k) { return { label: k, v: rs[k], tone: 'bad' }; }), String)));
  var cs = tally(curY, function (x) { return x.s.cls || ''; });
  out.push(card('לפי שיעור', 'שנת ' + yLabel(Y.hy), hbars(HR_CLS_LIST.filter(function (c) { return cs[c]; })
    .map(function (c) { return { label: HR_CLS_NAME[c], v: cs[c], tone: 'bad' }; }), String)));

  // 7 · חוזרים — שתי השעיות ומעלה השנה
  var per = {}; curY.forEach(function (x) { var id = String(x.s.client_id); (per[id] || (per[id] = { s: x.s, n: 0, d: 0 })).n++; per[id].d += x.days; });
  out.push(card('חוזרים', 'שתי השעיות ומעלה בשנת ' + yLabel(Y.hy), people(Object.keys(per).filter(function (id) { return per[id].n >= 2; })
    .sort(function (a, b) { return per[b].n - per[a].n; })
    .map(function (id) { var p = per[id]; return { name: p.s.name, sub: clsShort(p.s), pills: [{ t: p.n + ' השעיות', tone: 'bad' }, { t: p.d + ' ימים', tone: 'n' }] }; }),
    'אין תלמיד עם יותר מהשעיה אחת השנה')));

  // 8 · ממוצע אורך השעיה — השנה מול אשתקד
  var mean = function (list) { return list.length ? days(list) / list.length : null; };
  out.push(card('ממוצע אורך השעיה', 'בימים · מתשרי ועד ' + mName(now),
    duo(mean(curY), lastHas ? mean(lastY) : null, num1, 'שנת ' + yLabel(Y.hy), 'שנת ' + yLabel(Y.hy - 1), false)));

  // 9 · חזרו בשבוע האחרון · 10 · חוזרים בשבוע הקרוב
  var weekAgo = dayIso(dayNoon(new Date(Date.now() - 7 * 864e5))), weekOn = dayIso(dayNoon(new Date(Date.now() + 7 * 864e5)));
  var back = L.filter(function (x) { return x.ti && x.ti >= weekAgo && x.ti < today; }).sort(function (a, b) { return b.to - a.to; })
    .map(function (x) { return { name: x.s.name, sub: clsShort(x.s), pills: [{ t: 'חזר ' + fmtDay(x.to), tone: 'ok' }, { t: x.days + ' ימים', tone: 'n' }] }; });
  out.push(card('חזרו בשבוע האחרון', '', people(back, 'אף תלמיד לא חזר מהשעיה בשבוע האחרון')));
  var soon = L.filter(function (x) { return x.ti && x.ti >= today && x.ti <= weekOn && x.fi <= today; }).sort(function (a, b) { return a.to - b.to; })
    .map(function (x) { return { name: x.s.name, sub: clsShort(x.s), pills: [{ t: 'חוזר ' + fmtDay(x.to), tone: 'info' }] }; });
  out.push(card('חוזרים בשבוע הקרוב', '', people(soon, 'אין השעיה שמסתיימת בשבוע הקרוב')));
  return out;
}

export { renderStats, screenStatsHTML, statsHomeHTML, statsKind, statsOpen };
