// app/capture.js — צילום מסמך במצלמה, עמוד אחר עמוד, ומיזוג לקובץ PDF אחד; והקטנת תמונה לפני העלאה.
// סקריפט רגיל ולא מודול — הדפים הציבוריים (enroll.html · intake.html) טוענים אותו בתג script, והאפליקציה מייבאת אותו;
// בשני המקרים הוא נרשם ב-window.Capture. אין תלות חיצונית: ה-PDF נבנה כאן, עמוד JPEG לכל צילום.
(function () {
  if (window.Capture) return;

  var MAX_SIDE = 2000;   // צלע ארוכה — כתב יד וציון קריאים לגמרי, ועמוד שוקל מאות קילובייט ולא מגה
  var JPEG_Q = 0.82;
  var PAGE_W = 595.28;   // רוחב A4 בנקודות; הגובה — לפי יחס הצילום

  var CAM_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';

  function css() {
    if (document.getElementById('cap-css')) return;
    var s = document.createElement('style');
    s.id = 'cap-css';
    s.textContent =
      '.cap-veil{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center}' +
      '.cap-box{background:#fff;color:#1a2340;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:20px 20px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));direction:rtl;font-family:inherit;box-sizing:border-box}' +
      '@media (min-width:640px){.cap-veil{align-items:center}.cap-box{border-radius:20px}}' +
      '.cap-h{display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:17px;margin-bottom:12px}' +
      '.cap-x{border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:inherit;padding:4px 8px}' +
      '.cap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-bottom:14px}' +
      '.cap-th{position:relative;border:1px solid #d8e2f0;border-radius:12px;overflow:hidden;aspect-ratio:3/4;background:#f0f4fa}' +
      '.cap-th img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.cap-th b{position:absolute;bottom:4px;right:6px;background:rgba(255,255,255,.9);border-radius:8px;padding:0 6px;font-size:12px}' +
      '.cap-del{position:absolute;top:4px;left:4px;width:26px;height:26px;border-radius:50%;border:0;background:rgba(15,23,42,.7);color:#fff;font-size:15px;line-height:26px;cursor:pointer;padding:0}' +
      '.cap-empty{color:#8a97b0;text-align:center;padding:18px 0;font-size:14px}' +
      '.cap-row{display:flex;gap:10px}' +
      '.cap-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;padding:12px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;border:1.5px solid var(--brand,#1a3a6b);background:#fff;color:var(--brand,#1a3a6b)}' +
      '.cap-btn.cap-go{background:var(--brand,#1a3a6b);color:#fff}' +
      '.cap-btn[disabled]{opacity:.45;cursor:default}' +
      '.cap-busy{text-align:center;padding:10px 0;font-size:14px;color:#4a5568}';
    document.head.appendChild(s);
  }

  function loadImg(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { ok({ im: im, url: url }); };
      im.onerror = function () { URL.revokeObjectURL(url); bad(new Error('img')); };
      im.src = url;
    });
  }

  // תמונה ⟵ JPEG מוקטן (ובגווני אפור כשביקשו). מחזיר {blob, w, h}.
  async function toJpeg(file, gray) {
    var r = await loadImg(file), im = r.im;
    var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    if (gray) g.filter = 'grayscale(1)';
    g.drawImage(im, 0, 0, w, h);
    URL.revokeObjectURL(r.url);
    var blob = await new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', JPEG_Q); });
    return { blob: blob, w: w, h: h };
  }

  // תמונה שהועלתה — מוקטנת ל-JPEG; קובץ אחר (PDF) — כמו שהוא.
  async function compress(file, opts) {
    if (!file || !/^image\/(jpeg|png|webp|heic|heif|bmp)$/i.test(file.type || '')) return file;
    try {
      var j = await toJpeg(file, opts && opts.gray);
      if (!j.blob || j.blob.size >= file.size) return file;
      var base = String(file.name || 'image').replace(/\.[^.]+$/, '');
      return new File([j.blob], base + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return file; }
  }

  // ── PDF מינימלי: עמוד לכל JPEG, התמונה ממלאת את העמוד ──
  function pdfFromJpegs(pages) {
    var enc = new TextEncoder(), parts = [], off = 0, xref = [];
    function push(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; }
    function obj(n, body) { xref[n] = off; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); }
    push('%PDF-1.4\n');
    var n = pages.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    obj(1, function () { push('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { push('<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>'); });
    pages.forEach(function (p, i) {
      var pn = 3 + i * 3, cn = pn + 1, inum = pn + 2;
      var W = PAGE_W, H = +(PAGE_W * p.h / p.w).toFixed(2);
      var content = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im' + i + ' Do Q';
      obj(pn, function () {
        push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im' + i + ' ' + inum + ' 0 R >> >> /Contents ' + cn + ' 0 R >>');
      });
      obj(cn, function () { push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
      obj(inum, function () {
        push('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n');
        push(p.bytes);
        push('\nendstream');
      });
    });
    var total = 3 + n * 3, xo = off, s = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var k = 1; k < total; k++) s += String(xref[k]).padStart(10, '0') + ' 00000 n \n';
    s += 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF\n';
    push(s);
    return new Blob(parts, { type: 'application/pdf' });
  }

  // ── הצילום ──
  // opts: {title, name, gray}. מחזיר Promise ל-File (PDF) או null בביטול.
  // הפתיחה חייבת לבוא מלחיצה — המצלמה נפתחת מיד באותה לחיצה, והחלון מחזיק את הצילומים.
  function camera(opts) {
    opts = opts || {};
    css();
    return new Promise(function (resolve) {
      var shots = [], busy = false, done = false;
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
      inp.style.display = 'none';
      document.body.appendChild(inp);

      var veil = document.createElement('div');
      veil.className = 'cap-veil';
      veil.setAttribute('role', 'dialog');
      veil.setAttribute('aria-modal', 'true');
      veil.innerHTML = '<div class="cap-box"><div class="cap-h"><span>' + (opts.title || 'צילום מסמך') + '</span>' +
        '<button type="button" class="cap-x" data-cap="cancel" aria-label="ביטול">✕</button></div>' +
        '<div class="cap-grid"></div><div class="cap-msg"></div>' +
        '<div class="cap-row"><button type="button" class="cap-btn" data-cap="more">' + CAM_SVG + '<span>צילום</span></button>' +
        '<button type="button" class="cap-btn cap-go" data-cap="done" disabled>סיום</button></div></div>';
      document.body.appendChild(veil);
      var grid = veil.querySelector('.cap-grid'), msg = veil.querySelector('.cap-msg');
      var moreLbl = veil.querySelector('[data-cap="more"] span'), doneBtn = veil.querySelector('[data-cap="done"]');

      function draw() {
        grid.innerHTML = shots.length ? shots.map(function (s, i) {
          return '<div class="cap-th"><img src="' + s.url + '" alt=""><b>עמוד ' + (i + 1) + '</b>' +
            '<button type="button" class="cap-del" data-cap="del" data-i="' + i + '" aria-label="הסרת עמוד ' + (i + 1) + '">✕</button></div>';
        }).join('') : '';
        msg.innerHTML = shots.length ? '' : '<div class="cap-empty">עדיין אין צילום</div>';
        moreLbl.textContent = shots.length ? 'צילום נוסף' : 'צילום';
        doneBtn.disabled = !shots.length || busy;
      }
      function close(result) {
        if (done) return; done = true;
        shots.forEach(function (s) { URL.revokeObjectURL(s.url); });
        veil.remove(); inp.remove();
        resolve(result);
      }
      inp.addEventListener('change', async function () {
        var f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        busy = true; msg.innerHTML = '<div class="cap-busy">מעבד…</div>'; doneBtn.disabled = true;
        try {
          var j = await toJpeg(f, opts.gray);
          shots.push({ blob: j.blob, w: j.w, h: j.h, url: URL.createObjectURL(j.blob) });
        } catch (e) { /* צילום שלא נקרא — מדלגים */ }
        busy = false; draw();
      });
      veil.addEventListener('click', async function (e) {
        var b = e.target.closest('[data-cap]');
        if (!b) { if (e.target === veil && !shots.length) close(null); return; }
        var a = b.getAttribute('data-cap');
        if (a === 'cancel') close(null);
        else if (a === 'more') inp.click();
        else if (a === 'del') { var i = +b.getAttribute('data-i'); URL.revokeObjectURL(shots[i].url); shots.splice(i, 1); draw(); }
        else if (a === 'done' && shots.length && !busy) {
          busy = true; doneBtn.disabled = true; msg.innerHTML = '<div class="cap-busy">מאחד לקובץ אחד…</div>';
          var pages = [];
          for (var k = 0; k < shots.length; k++)
            pages.push({ w: shots[k].w, h: shots[k].h, bytes: new Uint8Array(await shots[k].blob.arrayBuffer()) });
          var name = (opts.name || 'צילום') + '.pdf';
          var out = new File([pdfFromJpegs(pages)], name, { type: 'application/pdf' });
          out.pages = pages.length;
          close(out);
        }
      });
      draw();
      inp.click();
    });
  }

  window.Capture = { camera: camera, compress: compress, icon: CAM_SVG };
})();
