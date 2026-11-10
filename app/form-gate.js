// app/form-gate.js — בשלושת הדפים הציבוריים (טופס הרישום · קבלה לישיבה · שיבוץ לאסיפת הורים): מספר הזהות פותח את הטופס,
// והטיוטה נשמרת בשרת — דרך השער hr-gate, במפתח שנגזר מהטופס וממספר הזהות (או הדרכון). כל השאר מוצג באפור ונעול עד אז.
// הדף מוסר: form · A (כתובת ומפתח) · state() — מה שנשמר · restore(d) — טעינת טיוטה · onOpen(id, kind, draft) · onReset();
// או lookup(id, kind) — בדיקה משלו במקום הטיוטה (השיבוץ), שמחזירה אם לפתוח.
(function () {
  'use strict';
  var FG = {};
  var T = {
    idLabel: 'מספר תעודת זהות של התלמיד',
    noId: 'אין לתלמיד תעודת זהות ישראלית',
    passport: 'מספר דרכון',
    lock: 'יש למלא את מספר הזהות כדי לפתוח את הטופס',
    bad: 'מספר הזהות אינו תקין',
    found: 'מצאנו טופס שהתחלתם למלא. ממשיכים מאיפה שעצרתם.',
    reset: 'להתחיל מחדש',
    saved: 'הפרטים נשמרים אוטומטית, וניתן לחזור ולהשלים עם אותו מספר זהות'
  };
  FG.T = T;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ספרת הביקורת של מספר זהות ישראלי — עד 9 ספרות, משלימים באפסים משמאל
  FG.validId = function (s) {
    s = String(s || '').replace(/\D/g, '');
    if (!s.length || s.length > 9) return false;
    s = ('000000000' + s).slice(-9);
    var sum = 0;
    for (var i = 0; i < 9; i++) { var d = +s[i] * (i % 2 ? 2 : 1); sum += d > 9 ? d - 9 : d; }
    return sum % 10 === 0 && +s > 0;
  };

  FG.html = function () {
    return '<section class="sec fg"><div class="f" data-f="_fg">' +
      '<span class="t">' + esc(T.idLabel) + ' <span class="q">*</span></span>' +
      '<input class="in" id="fg-id" inputmode="numeric" dir="ltr" autocomplete="off" maxlength="9">' +
      '<label class="chk"><input type="checkbox" id="fg-pp"><span>' + esc(T.noId) + '</span></label>' +
      '<div id="fg-ppw" hidden><span class="t">' + esc(T.passport) + ' <span class="q">*</span></span>' +
        '<input class="in" id="fg-pn" dir="ltr" autocomplete="off" maxlength="20"></div>' +
      '<span class="msg">' + esc(T.bad) + '</span></div>' +
      '<p class="fg-lock" id="fg-lock">' + esc(T.lock) + '</p>' +
      '<div class="fg-found" id="fg-found" hidden><span>' + esc(T.found) + '</span><button type="button" class="btn out sm" id="fg-reset">' + esc(T.reset) + '</button></div>' +
      '</section>';
  };
  FG.savedNote = function () { return '<p class="fg-saved">' + esc(T.saved) + '</p>'; };

  FG.css = '.fg [hidden],#fb[hidden]{display:none!important}' +
    '.fg-lock{margin:0;color:var(--text-2);font-size:13.5px}' +
    '.fg-found{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:var(--brand-soft,#e8eef8);border-radius:12px;padding:10px 12px;font-size:13.5px}' +
    '.fg-found .btn{width:auto;padding:6px 14px;font-size:13px}' +
    '.fb-locked{opacity:.45;pointer-events:none;filter:grayscale(.4);user-select:none}' +
    '.fg-saved{text-align:center;color:var(--text-2);font-size:12.5px;margin:0}';

  FG.mount = function (o) {
    // נקרא בכל ציור של הטופס — הסגנון והמאזינים למסמך פעם אחת, והשדות מחדש
    if (!FG._css) { var st = document.createElement('style'); st.textContent = FG.css; document.head.appendChild(st); FG._css = true; }
    var key = null, timer = null, opened = false;
    var $ = function (id) { return document.getElementById(id); };
    function api(body) {
      return fetch(o.A.url + '/functions/v1/hr-gate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: o.A.key, Authorization: 'Bearer ' + o.A.key },
        body: JSON.stringify(body)
      }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    function lock(on) {
      var fb = $(o.body || 'fb'); if (fb) fb.classList.toggle('fb-locked', !!on);
      var l = $('fg-lock'); if (l) l.hidden = !on;
    }
    function err(on) { var f = document.querySelector('[data-f="_fg"]'); if (f) f.classList.toggle('err', !!on); }
    async function open(id, kind) {
      if (opened) return;
      opened = true;
      key = kind + ':' + id;
      $('fg-id').disabled = true; $('fg-pp').disabled = true; if ($('fg-pn')) $('fg-pn').disabled = true;
      err(false);
      // בלי טיוטה — הדף בודק את המספר בעצמו (השיבוץ: התלמיד במצבה); לא נמצא — השדות נפתחים שוב
      if (o.lookup) {
        var okL = await o.lookup(id, kind);
        if (!okL) { opened = false; key = null; $('fg-id').disabled = $('fg-pp').checked; $('fg-pp').disabled = false; $('fg-pn').disabled = false; return; }
        lock(false); return;
      }
      var r = await api({ action: 'draft_get', form: o.form, key: key });
      var d = r && r.draft;
      if (d) { o.restore(d); $('fg-found').hidden = false; }
      o.onOpen(id, kind, d || null);
      lock(false);
    }
    FG.save = function () {
      if (!key || o.lookup) return;
      clearTimeout(timer);
      timer = setTimeout(function () { api({ action: 'draft_put', form: o.form, key: key, draft: o.state() }); }, 1200);
    };
    FG.drop = function () { clearTimeout(timer); if (key) return api({ action: 'draft_del', form: o.form, key: key }); };
    FG.key = function () { return key; };
    lock(true);
    $('fg-id').addEventListener('input', function () {
      var v = this.value.replace(/\D/g, ''); if (v !== this.value) this.value = v;
      if (v.length < 9) { err(false); return; }
      if (FG.validId(v)) open(v, 'id'); else err(true);
    });
    $('fg-id').addEventListener('change', function () {
      var v = this.value.replace(/\D/g, '');
      if (v && v.length < 9) { if (FG.validId(v)) open(('000000000' + v).slice(-9), 'id'); else err(true); }
    });
    $('fg-pp').addEventListener('change', function () {
      $('fg-ppw').hidden = !this.checked; $('fg-id').disabled = this.checked; err(false);
      if (this.checked) $('fg-pn').focus();
    });
    $('fg-pn').addEventListener('change', function () {
      var v = this.value.trim().toUpperCase().replace(/\s+/g, '');
      if (v.length >= 5) open(v, 'pp');
    });
    $('fg-reset').addEventListener('click', function (e) {
      e.stopPropagation(); // אחרת הלחיצה עצמה הייתה שומרת מיד טיוטה ריקה
      $('fg-found').hidden = true;
      FG.drop();
      o.onReset();
    });
    // כל שינוי אחרי הפתיחה — גם בחלונות הבחירה שמחוץ לטופס — נשמר, אחרי הפסקה קצרה
    FG._opened = function () { return opened; };
    if (!FG._doc) { FG._doc = true; ['input', 'change', 'click'].forEach(function (ev) { document.addEventListener(ev, function () { if (FG._opened()) FG.save(); }); }); }
  };
  window.FormGate = FG;
})();
