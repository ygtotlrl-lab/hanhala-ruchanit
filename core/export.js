// core/export.js — ייצוא: מסמך (PDF) מתבנית HTML אחת, וגיליון (xlsx). היציאה — core/share.js.
// המסמך נבנה כדף HTML שלם — הגופנים, הסמל והתמונות מוטמעים בו — ונהפך ל-PDF במנוע ההדפסה של המערכת (printFile):
// טקסט וקטורי, והעברית בו כמו במסך. הגיליון — ExcelJS, מימין לשמאל.
import { esc } from './ui.js';
import { printFile, shareFile } from './share.js';

var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// התצורה נמסרת מהאפליקציה: שם המוסד, הסמל (לבן — על הפס הכהה) וקובצי הגופן.
var CFG = { org: '', logo: '', fonts: [] };
function exportConfigure(c) { CFG = Object.assign({}, CFG, c || {}); }

// ── אסימוני הצבע ──
// מהערכה הבהירה שבגיליון הסגנון — מסמך מודפס תמיד בהיר, גם כשהמכשיר בערכה הכהה; כלל בתוך @media אינו נקרא.
function _tokens() {
  var map = {};
  [].forEach.call(document.styleSheets, function (sh) {
    var rules;
    try { rules = sh.cssRules; } catch (e) { return; }
    [].forEach.call(rules || [], function (r) {
      if (r.type !== 1 || r.selectorText !== ':root') return;
      for (var i = 0; i < r.style.length; i++) {
        var n = r.style[i];
        if (n.indexOf('--') === 0) map[n] = r.style.getPropertyValue(n).trim();
      }
    });
  });
  function val(n, depth) {
    var v = map[n] || '';
    return depth > 8 ? v : v.replace(/var\((--[\w-]+)\s*(?:,([^)]*))?\)/g, function (m, k, fb) {
      return map[k] ? val(k, depth + 1) : (fb || '').trim();
    });
  }
  var t = {};
  ['brand-ink', 'brand-soft', 'text', 'text-2', 'text-3', 'border', 'card-2',
   'ok', 'ok-soft', 'ok-line', 'warn', 'warn-soft', 'warn-line', 'bad', 'bad-soft', 'bad-line', 'info', 'info-soft']
    .forEach(function (k) { t[k] = val('--' + k, 0); });
  return t;
}

// ── נכסים מוטמעים ──
var _dataCache = {};
// קובץ מהאפליקציה כ-data URL — מסמך מודפס הוא דף עצמאי, בלי גישה לנתיבים יחסיים.
function exportDataUrl(url) {
  if (!url) return Promise.resolve('');
  if (!_dataCache[url]) {
    _dataCache[url] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' — ' + r.status);
      return r.blob();
    }).then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(String(fr.result)); };
        fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    }).catch(function (e) { delete _dataCache[url]; throw e; });
  }
  return _dataCache[url];
}

// הגופנים של האפליקציה, כ-@font-face מוטמע, בשם F.
async function exportFontCss(family) {
  var faces = await Promise.all(CFG.fonts.map(function (f) {
    return exportDataUrl(f.url).then(function (d) {
      return '@font-face{font-family:' + family + ';font-weight:' + f.weight + ';src:url(' + d + ') format("woff2")' +
        (f.range ? ';unicode-range:' + f.range : '') + '}';
    });
  }));
  return faces.join('');
}

// ── המסמך ──
// doc: { title, sub, date, name, kpis: [{ n, label, tone }], sections: [{ title, note, cols, rows, groups, flow, empty }] }
// cols: [{ label, num, w }] · תא: מחרוזת, או { text, tone } לתגית בגוון (ok · warn · bad · info)
// groups: [{ label, rows }] — כותרת ביניים בתוך הטבלה · flow — רשימה בשני טורים, בלי טבלה (שורה = [מספר, שם])
function _cell(c) {
  if (c && typeof c === 'object') return c.tone ? '<span class="tag t-' + c.tone + '">' + esc(c.text) + '</span>' : esc(c.text);
  return esc(c == null || c === '' ? '—' : c);
}

function _table(s) {
  var cols = s.cols || [];
  var head = '<thead><tr>' + cols.map(function (c) {
    return '<th' + (c.num ? ' class="n"' : '') + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.label) + '</th>';
  }).join('') + '</tr></thead>';
  var row = function (r) {
    return '<tr>' + r.map(function (c, i) { return '<td' + (cols[i] && cols[i].num ? ' class="n"' : '') + '>' + _cell(c) + '</td>'; }).join('') + '</tr>';
  };
  var body = s.groups
    ? s.groups.map(function (g) { return '<tr class="grp"><td colspan="' + cols.length + '">' + esc(g.label) + '</td></tr>' + g.rows.map(row).join(''); }).join('')
    : (s.rows || []).map(row).join('');
  return '<table>' + head + '<tbody>' + body + '</tbody></table>';
}

function _flow(s) {
  var item = function (r) { return '<div class="it"><span class="n">' + esc(r[0]) + '</span>' + esc(r[1]) + '</div>'; };
  return '<div class="flow">' + (s.groups || [{ label: '', rows: s.rows || [] }]).map(function (g) {
    return (g.label ? '<div class="fg">' + esc(g.label) + '</div>' : '') + g.rows.map(item).join('');
  }).join('') + '</div>';
}

function _section(s) {
  var n = s.groups ? s.groups.reduce(function (a, g) { return a + g.rows.length; }, 0) : (s.rows || []).length;
  return '<section><h2>' + esc(s.title) + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</h2>' +
    (n ? (s.flow ? _flow(s) : _table(s)) : '<p class="empty">' + esc(s.empty || 'אין') + '</p>') + '</section>';
}

function _docCss(t, fontCss) {
  return fontCss +
    '@page{size:A4;margin:14mm 14mm 16mm;' +
      '@bottom-left{content:"עמוד " counter(page) " מתוך " counter(pages);font:8pt F,sans-serif;color:' + t['text-3'] + '}' +
      '@bottom-right{content:"' + String(CFG.org).replace(/"/g, '״') + '";font:8pt F,sans-serif;color:' + t['text-3'] + '}}' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'body{font-family:F,sans-serif;color:' + t.text + ';font-size:10pt;direction:rtl;background:#fff}' +
    '.hd{display:flex;align-items:center;gap:5mm;background:' + t['brand-ink'] + ';color:#fff;border-radius:4mm;padding:5mm 6mm}' +
    '.hd img{height:14mm;width:auto}.hd .t{flex:1}.hd h1{font-size:17pt;font-weight:700}.hd .s{font-size:9.5pt;opacity:.85;margin-top:.5mm}' +
    '.hd .d{text-align:left;font-size:9.5pt;line-height:1.5}' +
    '.kp{display:flex;margin:6mm 0 7mm;border:1px solid ' + t.border + ';border-radius:3mm}' +
    '.kp div{flex:1;text-align:center;padding:3mm 0;border-left:1px solid ' + t.border + '}.kp div:last-child{border-left:0}' +
    '.kp b{display:block;font-size:20pt;line-height:1.15}.kp span{font-size:9pt;color:' + t['text-2'] + '}' +
    '.k-ok b{color:' + t.ok + '}.k-warn b{color:' + t.warn + '}.k-bad b{color:' + t.bad + '}.k-info b{color:' + t.info + '}' +
    'section{margin-bottom:7mm}' +
    'h2{font-size:12pt;font-weight:700;color:' + t['brand-ink'] + ';margin-bottom:2.5mm;break-after:avoid}' +
    'h2 small{font-size:9pt;font-weight:400;color:' + t['text-2'] + ';margin-right:2mm}' +
    'table{width:100%;border-collapse:collapse}thead{display:table-header-group}tr{break-inside:avoid}' +
    'th{background:' + t['card-2'] + ';color:' + t['brand-ink'] + ';font-weight:700;text-align:right;padding:2mm 3mm;border-bottom:1.5px solid ' + t['brand-ink'] + ';font-size:9pt}' +
    'td{padding:1.8mm 3mm;border-bottom:1px solid ' + t.border + '}' +
    'th.n,td.n{text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    'tr.grp td{font-weight:700;color:' + t['text-2'] + ';font-size:9pt;padding-top:3mm;border-bottom:1px solid ' + t['text-2'] + '}' +
    '.tag{display:inline-block;border-radius:99px;padding:.3mm 2.5mm;font-size:8.5pt;font-weight:700;border:1px solid}' +
    '.t-ok{background:' + t['ok-soft'] + ';color:' + t.ok + ';border-color:' + t['ok-line'] + '}' +
    '.t-warn{background:' + t['warn-soft'] + ';color:' + t.warn + ';border-color:' + t['warn-line'] + '}' +
    '.t-bad{background:' + t['bad-soft'] + ';color:' + t.bad + ';border-color:' + t['bad-line'] + '}' +
    '.t-info{background:' + t['info-soft'] + ';color:' + t.info + ';border-color:' + t.border + '}' +
    '.flow{column-count:2;column-gap:10mm}.fg{font-weight:700;color:' + t['text-2'] + ';font-size:9pt;padding:2.5mm 0 1mm;border-bottom:1px solid ' + t['text-2'] + ';break-after:avoid}' +
    '.it{padding:1.5mm 0;border-bottom:1px solid ' + t.border + ';break-inside:avoid}' +
    '.it .n{display:inline-block;min-width:8mm;color:' + t['text-3'] + ';font-variant-numeric:tabular-nums}' +
    '.empty{color:' + t['text-3'] + ';padding:2mm 0}';
}

async function exportPdfHtml(doc) {
  var t = _tokens();
  var parts = await Promise.all([exportFontCss('F'), exportDataUrl(CFG.logo).catch(function () { return ''; })]);
  return '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(doc.name || doc.title) + '</title>' +
    '<style>' + _docCss(t, parts[0]) + '</style></head><body>' +
    '<div class="hd">' + (parts[1] ? '<img src="' + parts[1] + '" alt="">' : '') +
      '<div class="t"><h1>' + esc(doc.title) + '</h1><div class="s">' + esc(doc.sub || CFG.org) + '</div></div>' +
      (doc.date ? '<div class="d">' + esc(doc.date) + '</div>' : '') + '</div>' +
    (doc.kpis && doc.kpis.length ? '<div class="kp">' + doc.kpis.map(function (k) {
      return '<div class="k-' + (k.tone || 'info') + '"><b>' + esc(k.n) + '</b><span>' + esc(k.label) + '</span></div>';
    }).join('') + '</div>' : '') +
    (doc.sections || []).map(_section).join('') +
    '</body></html>';
}

async function exportPdf(doc) {
  printFile(await exportPdfHtml(doc), doc.name || doc.title);
}

// ── הגיליון ──
// book: { name, sheets: [{ name, cols: [{ label, type: 'text' | 'number' | 'date', width }], rows }] }
// תא: ערך, או { v, tone } לדיו בגוון · תאריך — 'YYYY-MM-DD', ונכתב כתאריך של Excel
function _argb(hex, fb) {
  var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return fb;
  var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  return 'FF' + h.toUpperCase();
}

function _b64(buf) {
  var b = new Uint8Array(buf), out = [];
  for (var i = 0; i < b.length; i += 8192) out.push(String.fromCharCode.apply(null, b.subarray(i, i + 8192)));
  return btoa(out.join(''));
}

async function exportXlsx(book) {
  if (typeof ExcelJS === 'undefined') throw new Error('מנוע הגיליון לא נטען — יש להתחבר לרשת ולנסות שוב');
  var t = _tokens();
  var ink = _argb(t['brand-ink'], 'FF1A3A6B'), soft = _argb(t['brand-soft'], 'FFE8EEF8'), line = _argb(t.border, 'FFD8E2F0');
  var tone = { ok: _argb(t.ok), warn: _argb(t.warn), bad: _argb(t.bad), info: _argb(t.info) };
  var wb = new ExcelJS.Workbook();
  wb.creator = CFG.org;
  book.sheets.forEach(function (sh) {
    var ws = wb.addWorksheet(String(sh.name).slice(0, 31), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    var cols = sh.cols;
    var width = cols.map(function (c) { return String(c.label).length; });
    ws.addRow(cols.map(function (c) { return c.label; }));
    sh.rows.forEach(function (r) {
      var row = ws.addRow(r.map(function (c, i) {
        var v = c && typeof c === 'object' ? c.v : c;
        if (v == null || v === '') return null;
        if (cols[i].type === 'date') {
          var p = String(v).split('-');
          return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
        }
        if (cols[i].type === 'number') { var n = Number(v); return isFinite(n) ? n : String(v); }
        return String(v);
      }));
      r.forEach(function (c, i) {
        var cell = row.getCell(i + 1);
        width[i] = Math.max(width[i], cols[i].type === 'date' ? 10 : String(c && typeof c === 'object' ? c.v : (c == null ? '' : c)).length);
        if (cols[i].type === 'date') cell.numFmt = 'dd/mm/yyyy';
        if (cols[i].type !== 'text') cell.alignment = { horizontal: 'center' };
        if (c && typeof c === 'object' && tone[c.tone]) cell.font = { color: { argb: tone[c.tone] }, bold: true };
        cell.border = { bottom: { style: 'thin', color: { argb: line } } };
      });
    });
    cols.forEach(function (c, i) { ws.getColumn(i + 1).width = c.width || Math.min(50, Math.max(8, width[i] + 3)); });
    var head = ws.getRow(1);
    head.height = 22;
    head.eachCell(function (cell) {
      cell.font = { bold: true, color: { argb: ink } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: soft } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'medium', color: { argb: ink } } };
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  });
  var buf = await wb.xlsx.writeBuffer();
  shareFile(_b64(buf), XLSX_MIME, book.name + '.xlsx');
}

export { exportConfigure, exportDataUrl, exportFontCss, exportPdf, exportPdfHtml, exportXlsx };
