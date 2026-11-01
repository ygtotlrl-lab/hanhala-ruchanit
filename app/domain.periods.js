// app/domain.periods.js — תקופות הפעילות של התלמידים: המנוע המשותף (core/periods.js) על הלוח העברי
// «פעיל» אינו נשמר — חודש עברי בתוך תקופה הוא חודש שבו התלמיד בישיבה: מופיע בסדרים, בשינה ובמבחנים, ונספר בהשגחה ובגיליון.
import { dayNoon } from '../core/util.js';
import { hebYearInfo } from '../core/hebrew.js';
import { periodsEngine } from '../core/periods.js';
import { MSG_PERIOD_END_BEFORE, MSG_PERIOD_NONE, MSG_PERIOD_OPEN_LAST, MSG_PERIOD_OVERLAP } from './constants.js';
import { getStudents } from './domain.js';
import { _hcH, _hcMN, _hcYL } from './domain.hebdate.js';
import { icon } from './icons.js';

// המפתח — «שנה-חודש»: השנה העברית ומספר החודש בתוכה מתשרי, בשתי ספרות (01…13) — אדר א׳ ואדר ב׳ הם שני חודשים.
// כמו בקופה; המחרוזת ממוינת כרונולוגית, ולכן המנוע משווה בלי המרה.
var KEY_RE = /^(\d{4})-(0[1-9]|1[0-3])$/;
function hrMonthKey(hy, mi) { return hy + '-' + String(mi + 1).padStart(2, '0'); }
function hrKeyParts(k) { var m = KEY_RE.exec(String(k || '')); return m ? { hy: +m[1], mi: +m[2] - 1 } : null; }
function _months(hy) { var b = hebYearInfo(hy); return (b && b.ml) ? b.ml.length : 0; }
function _valid(k) { var p = hrKeyParts(k); return !!p && p.mi < _months(p.hy); }

// החודש של יום (ISO) — החודש העברי שבו חל היום האזרחי.
function hrMonthKeyOfIso(iso) { var h = _hcH(dayNoon(iso)); return hrMonthKey(h.hy, h.mi); }
function hrMonthKeyNow() { var h = _hcH(new Date()); return hrMonthKey(h.hy, h.mi); }

// n חודשים קדימה או אחורה, דרך אורך השנה במנוע — שנה מעוברת נושאת שלושה-עשר חודשים.
function hrMonthKeyAdd(k, n) {
  var p = hrKeyParts(k); if (!p) return '';
  var hy = p.hy, mi = p.mi + n;
  while (mi < 0) { hy--; if (!_months(hy)) return ''; mi += _months(hy); }
  while (mi >= _months(hy)) { if (!_months(hy)) return ''; mi -= _months(hy); hy++; }
  return hrMonthKey(hy, mi);
}

function hrMonthKeyLabel(k) { var p = hrKeyParts(k); return p ? ((_hcMN(p.hy)[p.mi] || '') + ' ' + _hcYL(p.hy)) : ''; }

var HR_PER = periodsEngine({
  valid: _valid, now: hrMonthKeyNow, add: hrMonthKeyAdd, label: hrMonthKeyLabel,
  msg: { openLast: MSG_PERIOD_OPEN_LAST, overlap: MSG_PERIOD_OVERLAP, endBefore: MSG_PERIOD_END_BEFORE, none: MSG_PERIOD_NONE },
  removeIcon: icon('close')
});

// פעיל ביום (ISO) — לפי חודשו העברי; בלי יום — החודש הנוכחי.
function hrStudentOn(s, iso) { return HR_PER.inMonth(s, iso ? hrMonthKeyOfIso(iso) : null); }

// פעיל בחודש עברי (hy, mi) — ההשגחה והגיליון.
function hrStudentInHebMonth(s, hy, mi) { return HR_PER.inMonth(s, hrMonthKey(hy, mi)); }

// «פעילים» במצבה — מי שנשאר בישיבה אחרי החודש הנוכחי, או שתקופתו עוד לא התחילה; מי שנסגר החודש עדיין נספר בסדרי החודש.
function hrStudentListed(s) { var k = hrMonthKeyNow(); return HR_PER.continues(s) || HR_PER.list(s).some(function (p) { return p.start > k; }); }

// הרצפה של בוררי התאריך והחודש — החודש הראשון שבו תלמיד כלשהו פעיל; אין תקופות — החודש הנוכחי.
function hrFirstMonthKey() { return HR_PER.first(getStudents()) || hrMonthKeyNow(); }

export { HR_PER, hrFirstMonthKey, hrKeyParts, hrMonthKey, hrMonthKeyAdd, hrMonthKeyLabel, hrMonthKeyNow, hrMonthKeyOfIso,
         hrStudentInHebMonth, hrStudentListed, hrStudentOn };
