// app/form-texts.js — הטקסטים הקבועים בשלושת הדפים הציבוריים (טופס הרישום · קבלה לישיבה · שיבוץ לאסיפת הורים), ועריכתם מההגדרות.
// כל טקסט נשמר בהגדרת הטופס תחת texts, במפתח הנוסח המקורי: { "<מקור>": "<נוסח חדש>" }; טקסט שלא שונה — אינו נשמר.
// בדף — FormTexts.apply(texts) מחליף כל צומת טקסט (ו-placeholder / title) שכולו הנוסח המקורי, גם מה שנוצר אחר כך (MutationObserver).
// {1} {2} — חלק משתנה (מספר, שעה), שעובר לנוסח החדש באותו מקום.
// הקובץ נטען בדפים כסקריפט רגיל, ובאפליקציה ב-import — ובשניהם נרשם ב-self.FormTexts.
(function (g) {
  'use strict';
  var CAT = {
    gate: [
      'מספר תעודת זהות של התלמיד', 'אין לתלמיד תעודת זהות ישראלית', 'מספר דרכון', 'יש למלא את מספר הזהות כדי לפתוח את הטופס',
      'מספר הזהות אינו תקין', 'מצאנו טופס שהתחלתם למלא. ממשיכים מאיפה שעצרתם.', 'להתחיל מחדש',
      'הפרטים נשמרים אוטומטית, וניתן לחזור ולהשלים עם אותו מספר זהות'
    ],
    common: [
      'ישיבת תומכי תמימים ראשון לציון', 'השדות המסומנים ב-* הם חובה.', 'שדה חובה', 'בחירה', '＋ העלאת קובץ', 'צילום',
      'שליחת הטופס', 'שולח…', 'יש למלא את השדות המסומנים', 'כתובת אימייל אינה תקינה', 'השליחה נכשלה — נא לנסות שוב',
      'העלאת הקובץ נכשלה — נא לנסות שוב', 'הורדת העתק הטופס (PDF)', 'מכין את הקובץ…', 'הכנת הקובץ נכשלה — נא לנסות שוב',
      'תודה רבה!', 'הפרש של יום אחד',
      'התאריך העברי מאוחר ביום אחד מהתאריך הלועזי. כך זה כשהתלמיד נולד בערב, אחרי השקיעה — אז כבר מתחיל היום העברי הבא.',
      'התאריכים אינם תואמים', 'התאריך העברי שנבחר אינו מתאים לתאריך הלועזי. נא לבדוק את שניהם.', 'התלמיד נולד אחרי השקיעה',
      'יש לסמן את התיבה, או לחזור לתיקון', '✓ שני התאריכים תואמים', '✓ נשמר: נולד אחרי השקיעה', 'תאריך עברי שנבחר:',
      'תאריך לועזי שנבחר:', 'חזרה לתיקון', 'אישור', 'ביטול', 'אין חיבור — נסו שוב מאוחר יותר', 'הטופס אינו זמין', 'הטופס סגור כעת.', 'טוען…',
      'יחי אדוננו מורנו ורבינו מלך המשיח לעולם ועד'
    ],
    enroll: [
      'טופס רישום', 'אודות הישיבה - חב"דפדיה', 'תמונה מהווי הישיבה · {1} מתוך {2}', 'רישום לשנת הלימודים הקרובה',
      'רישום לשנת הלימודים הנוכחית', 'לשנת הלימודים הקרובה', 'לשנת הלימודים הנוכחית', 'הטופס נשלח בהצלחה'
    ],
    intake: [
      'קבלה לישיבה', 'מסמכים לצפייה', 'מסמכים לחתימה', 'צפייה במסמך', 'פתיחת המסמך נכשלה', 'יש לחתום כאן באצבע', 'ניקוי',
      'אפשרות אחרת', 'בהמשך', 'המסמכים נשלחו בהצלחה', 'נתראה בעזרת השם בתחילת זמן אלול'
    ],
    meeting: [
      'שיבוץ לאסיפת הורים', 'ישיבת תומכי תמימים ראשון לציון', 'השיבוץ לאסיפה סגור.', 'לפרטים:', 'אין תלמיד במספר זה',
      'אפשר לבחור עד שניים מרבני השיעור, ולכל אחד שעה פנויה. כל פגישה {1} דקות.', 'רבני השיעור · {1} מתוך 2', 'הנהלת הישיבה',
      'אחרי שבחרתם רב שיעור, אפשר לבחור גם פגישה אחת עם הנהלת הישיבה.', 'אפשר לבחור פגישה אחת עם הנהלת הישיבה.', 'שעה זו תפוסה',
      'סיום', 'הבחירה נשמרה', 'השיבוץ נקלט. נשמח לראותכם!', 'הוספה ליומן', 'שינוי או ביטול השיבוץ', 'שעה זו כבר נתפסה',
      'ניתן לבחור עד שניים מרבני השיעור', 'ניתן לבחור פגישה אחת עם הנהלת הישיבה', 'יש לבחור קודם רב שיעור',
      'כדי לבטל פגישה עם רב השיעור, יש לבטל קודם את הפגישה עם הנהלת הישיבה', 'אין חיבור — נסו שוב', 'הדף אינו זמין',
      'אין חיבור — נסו שוב מאוחר יותר', 'טוען…', 'יחי אדוננו מורנו ורבינו מלך המשיח לעולם ועד'
    ]
  };
  // הרשימה לכל טופס, בלי כפילות
  function list(form) {
    var parts = form === 'meeting' ? ['gate', 'meeting'] : ['gate', 'common', form], out = [];
    parts.forEach(function (k) { (CAT[k] || []).forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); }); });
    return out;
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function rules(map) {
    return Object.keys(map || {}).filter(function (k) { return map[k] && map[k] !== k; }).map(function (k) {
      var slots = k.match(/\{\d\}/g) || [];
      var re = new RegExp('^' + reEsc(k).replace(/\\\{(\d)\\\}/g, '(.+?)') + '$');
      return { re: re, slots: slots, to: map[k] };
    });
  }
  function conv(rs, s) {
    var t = s.trim();
    if (!t) return null;
    for (var i = 0; i < rs.length; i++) {
      var m = t.match(rs[i].re);
      if (!m) continue;
      var r = rs[i], out = r.to;
      r.slots.forEach(function (sl, j) { out = out.split(sl).join(m[j + 1]); });
      var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
      return lead + out + trail;
    }
    return null;
  }
  // החלפה בדף: הצמתים הקיימים, ומה שנוסף או משתנה אחר כך; מה שכבר הוחלף אינו מוחלף שוב (נוסח חדש שמכיל את הישן)
  var OBS = null, LAST = null;
  function apply(map) {
    var key = JSON.stringify(map || {});
    if (key === LAST) return;
    LAST = key;
    if (OBS) { OBS.disconnect(); OBS = null; }
    var rs = rules(map);
    if (!rs.length) return;
    var done = new WeakMap();
    function text(n) {
      if (done.get(n) === n.nodeValue) return;
      var v = conv(rs, n.nodeValue);
      if (v != null) n.nodeValue = v;
      done.set(n, n.nodeValue);
    }
    function attrs(el) {
      ['placeholder', 'title', 'aria-label'].forEach(function (a) {
        var v = el.getAttribute && el.getAttribute(a); if (!v) return;
        var c = conv(rs, v); if (c != null) el.setAttribute(a, c);
      });
    }
    function walk(root) {
      if (root.nodeType === 3) { text(root); return; }
      if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.tagName === 'TEXTAREA') return;
      attrs(root);
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) { var p = n.parentNode; if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'TEXTAREA')) continue; text(n); }
        else attrs(n);
      }
    }
    walk(document.body);
    var t = conv(rs, document.title); if (t != null) document.title = t;
    OBS = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') text(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  g.FormTexts = { CAT: CAT, list: list, apply: apply };
})(typeof self !== 'undefined' ? self : this);
