// core/share.js — שליחת קובץ שהאפליקציה יצרה (תמונה, PDF או גיליון): במעטפת — גשר השיתוף, ובדפדפן — גיליון השיתוף, ובלעדיו הורדה
// החתימה היא חוזה עם Java (tools/java/MainActivity.java.in, shareFile) ומשתנה בשני הצדדים יחד.

// AndroidShareBridge (addWebMessageListener) נוסה ראשון — בו WebView עצמו אוכף את רשימת המקורות;
// AndroidShare (addJavascriptInterface) נשאר ל-WebView ישן מ-88, והמעטפת מאמתת בו את מקור הדף.
function _bridge(b64, mime) {
  try {
    var br = window.AndroidShareBridge;
    if (br && typeof br.postMessage === 'function') {
      br.postMessage(JSON.stringify({ data: b64, mime: mime }));
      return true;
    }
    if (window.AndroidShare && typeof window.AndroidShare.shareFile === 'function') {
      window.AndroidShare.shareFile(b64, mime);
      return true;
    }
  } catch (e) { /* נופל לשיתוף של הדפדפן */ }
  return false;
}

function _blob(b64, mime) {
  var bin = atob(b64), u = new Uint8Array(bin.length), i;
  for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}

// הורדה בלבד, בלי קישור-עומק ליעד — קישור כזה הוא מסלול שיתוף שני שאיש אינו בודק, ונשבר בשקט.
function _download(blob, name) {
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
}

// אין כאן פרמטר יעד — בורר המערכת בוחר.
function shareFile(b64, mime, name) {
  if (_bridge(b64, mime)) return;
  var blob = _blob(b64, mime);
  try {
    var file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function (err) {
        if (err && err.name !== 'AbortError') _download(blob, name);
      });
      return;
    }
  } catch (e) { /* הורדה */ }
  _download(blob, name);
}

// קובץ שנבנה כ-Blob (גיליון, CSV) — אותו מסלול, דרך base64.
function shareBlob(blob, mime, name) {
  var r = new FileReader();
  r.onload = function () { shareFile(String(r.result).split(',')[1] || '', mime, name); };
  r.readAsDataURL(blob);
}

export { shareBlob, shareFile };
