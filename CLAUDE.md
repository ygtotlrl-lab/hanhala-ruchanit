# הנהלה רוחנית — CLAUDE.md

## סביבת עבודה
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit`
- **Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **טוקן:** מאוחסן ב-Windows Credential Manager (host `github.com`) — לעולם לא בקובץ. `git push`/`clone` מושכים אותו אוטומטית דרך GCM.
- **קובץ ראשי:** `index.html`
- **Supabase:** `kxbtskqobynewvnckaaz`

## גישת Supabase
כשזמין ה-Supabase MCP, נהג לפי הכללים הבאים — ללא יוצאים מן הכלל:
- **שינויי סכימה** (יצירה/שינוי/מחיקת טבלאות, עמודות, פוליסות, הרשאות) — **אך ורק דרך `apply_migration`** עם שם ברור ותיאורי (למשל `add_sync_log_table`). לא דרך `execute_sql`.
- **שאילתות אבחון וקריאה** (SELECT, בדיקת מבנה, ספירות, `list_tables` וכו') — **חופשיות**, ללא אישור.
- **עדכון או מחיקת נתונים בטבלאות `kv`** (וכל טבלת נתונים אחרת: `sync_log`, `kv_backup`, `ys_users` וכו') — **מחייבים אישור מפורש מהמשתמש לפני הרצה**. אין להריץ `UPDATE`/`DELETE`/`upsert` על נתונים בלי אישור.

## התחלת סשן — חובה
```bash
# שכפל את הריפו
git clone https://github.com/ygtotlrl-lab/hanhala-ruchanit.git /tmp/yeshiva-manager
cd /tmp/yeshiva-manager
git config user.email "dev@yeshiva.com" && git config user.name "Dev"
```

## לפני כל push — חובה: בדיקת V8-parse של ה-JS המוטבע
**כל שינוי ב-`index.html` חייב לעבור את הבדיקה הזו לפני דחיפה. דחיפה ללא הבדיקה — אסורה.**
בדיקת איזון-סוגריים בלבד אינה מספיקה (עיוורת לשגיאות בתוך מחרוזות — כך נפלה שגיאת ה-onclick שהשביתה את כל האפליקציה). `new Function` ב-V8 = parse מלא אמיתי.
```bash
# 1) חלץ את כל ה-JS המוטבע לקובץ
python3 -c "
import io, re
s = io.open('index.html', encoding='utf-8').read()
js = chr(10).join(re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', s, re.DOTALL))
io.open('_app.js', 'w', encoding='utf-8').write(js)
"
# 2) harness שמריץ new Function (parse בלבד, ללא הרצה)
cat > _harness.html <<'EOF'
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="out">PENDING</div>
<script>
fetch('_app.js').then(function(r){return r.text();}).then(function(code){
  try { new Function(code); document.getElementById('out').textContent = 'SYNTAX-OK'; }
  catch(e) { document.getElementById('out').textContent = 'SYNTAX-ERR: ' + e.message; }
}).catch(function(e){ document.getElementById('out').textContent = 'FETCH-ERR: ' + e.message; });
</script></body></html>
EOF
# 3) הרץ ב-Chrome headless ובדוק את התוצאה — חובה לראות SYNTAX-OK
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --allow-file-access-from-files --virtual-time-budget=8000 \
  --dump-dom "file:///$(cygpath -m "$PWD")/_harness.html" 2>/dev/null | grep -o '<div id="out">[^<]*</div>'
rm -f _app.js _harness.html
```
אם התוצאה אינה `SYNTAX-OK` — אסור לדחוף. (node אינו מותקן במכונה זו; Chrome headless הוא מנוע הבדיקה.)

## Push
```bash
cd /tmp/yeshiva-manager
git add . && git commit -m "תיאור השינוי"
git push origin main   # GCM מספק את הטוקן אוטומטית — אין טוקן בפקודה
```

## כללים קריטיים
1. **בדיקת V8-parse לפני כל push** (הסעיף למעלה) — חובה מוחלטת. כל שינוי ב-`index.html` חייב לעבור חילוץ-JS + `new Function` ב-V8 (Chrome headless) ולהחזיר `SYNTAX-OK`. דחיפה בלי זה — אסורה.
2. **אסור `async\nfunction`** — אסור רווח/שורה בין async לfunction
3. **`H()` גלובלי** — אסור `var X = [H(...)]` גלובלי
4. **`onclick`** — חובה `window.functionName()`
5. **גרשיים בתוך onclick** — `onclick="f(\"x\")"` בלבד
6. **מקור אמת יחיד לאפליקציה = `index.html`** — זה הקובץ ש-Pages מגיש, שאליו מצביע `start_url`, ושה-APK טוען. כל עדכון קוד נכנס לכאן בלבד; אסור ליצור קובץ HTML כפול של האפליקציה. (`setup-db.html` הוא כלי עזר חד-פעמי נפרד להגדרת מסד הנתונים — לא עותק של האפליקציה. אין כאן אוטו-אפדייט מבוסס raw.githubusercontent — הרענון הוא דרך ה-Service Worker.)

## APK
- Keystore: `/tmp/yeshiva.keystore` | alias=yeshiva | pass=yeshiva123
- אייקון: `בלוי_מיט_ווייסן_הינטערגרונט.png` (כחול על לבן)
- URLs ב-smali: `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- cache APK: תמיד `TS=$(date +%s)` בשם הקובץ

## PDF
- ספרייה: **pdfmake** (לא html2pdf — בעיות RTL)
- Scripts:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
  ```
- `defaultStyle: { font: 'Roboto', alignment: 'right' }`

## מצב נוכחי
- מצבת תלמידים ✅ (75 תלמידים, שיעורות א/ב/ג)
- PDF נוכחות ✅ (pdfmake)
- הגדרות ✅
- PWA auto-reload ✅
