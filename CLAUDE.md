# הנהלה רוחנית — CLAUDE.md

## סביבת עבודה
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit`
- **Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **קובץ ראשי:** `index.html`
- **Supabase:** `kxbtskqobynewvnckaaz`
- **אופן העבודה (נכון ליולי 2026):** העבודה מתנהלת בסשני ענן (Claude Code cloud) — הריפו משוכפל טרי בתחילת כל סשן, העבודה נעשית על ענף ייעודי, והדחיפה בסוף הסשן. **אין עותקים מקומיים קבועים.**
- **עבודה מקומית במחשב (אם בכל זאת):** שכפול **אך ורק** לתיקייה יציבה כמו `C:\Users\F\Documents\repos\` — **לעולם לא ל-Temp** (מנקה Windows / Storage Sense מוחק משם קבצים באמצע עבודה; זה גרם ל"מחיקות רפאים" חוזרות). טוקן: מאוחסן ב-Windows Credential Manager (host `github.com`) — לעולם לא בקובץ; `git push`/`clone` מושכים אותו אוטומטית דרך GCM.

## גישת Supabase
כשזמין ה-Supabase MCP, נהג לפי הכללים הבאים — ללא יוצאים מן הכלל:
- **שינויי סכימה** (יצירה/שינוי/מחיקת טבלאות, עמודות, פוליסות, הרשאות) — **אך ורק דרך `apply_migration`** עם שם ברור ותיאורי (למשל `add_sync_log_table`). לא דרך `execute_sql`.
- **שאילתות אבחון וקריאה** (SELECT, בדיקת מבנה, ספירות, `list_tables` וכו') — **חופשיות**, ללא אישור.
- **עדכון או מחיקת נתונים בטבלאות `kv`** (וכל טבלת נתונים אחרת: `sync_log`, `kv_backup`, `ys_users` וכו') — **מחייבים אישור מפורש מהמשתמש לפני הרצה**. אין להריץ `UPDATE`/`DELETE`/`upsert` על נתונים בלי אישור.

## כללי ענפים
- כל עבודה נעשית על **ענף ייעודי** — לא ישירות על `main`.
- **מיזוג ל-`main` רק לאחר אישור מפורש מהמשתמש**, אחרי שבדק את השינוי בבדיקה חיצונית.
- **מחיקת ענפים מרוחקים חסומה בסביבת הענן** — אין לנסות למחוק; לדלג ולדווח למשתמש שהענף נותר.

## לפני כל push — חובה: בדיקת תחביר עם node
**כל שינוי בקוד (`index.html` או `sw.js`) חייב לעבור את הבדיקה הזו לפני דחיפה. דחיפה ללא הבדיקה — אסורה.**
בדיקת איזון-סוגריים בלבד אינה מספיקה (עיוורת לשגיאות בתוך מחרוזות — כך נפלה שגיאת ה-onclick שהשביתה את כל האפליקציה). `node --check` = parse מלא אמיתי ב-V8. (node זמין בסביבת הענן; הנוהל הישן עם Chrome headless היה נכון לסביבה המקומית שבה node לא היה מותקן.)
```bash
# 1) חלץ את כל ה-JS המוטבע מ-index.html לקובץ
python3 -c "
import io, re
s = io.open('index.html', encoding='utf-8').read()
js = chr(10).join(re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', s, re.DOTALL))
io.open('_app.js', 'w', encoding='utf-8').write(js)
"
# 2) בדיקת parse — חובה ששתי הפקודות יעברו בלי שגיאה
node --check _app.js
node --check sw.js
rm -f _app.js
```
אם `node --check` מדווח שגיאה — אסור לדחוף עד שהיא מתוקנת.

## עדכוני Service Worker
- **כל שינוי בקוד מחייב קידום `CACHE_NAME` ב-`sw.js` לגרסה הבאה** — בלי זה המשתמשים לא יקבלו את העדכון.
- מנגנון באנר "גרסה חדשה זמינה" קיים באפליקציה — המשתמשים מקבלים את העדכון בלחיצה על הבאנר.

## Push
```bash
git add . && git commit -m "תיאור השינוי"
git push -u origin <שם-הענף>   # דחיפה לענף העבודה — לא ל-main
```

## סיום משימה
בסיום כל משימה משמעותית — **עדכן קובץ זה בתמצית** לפני סיום הסשן: מה שונה, מה הוחלט. כך הסשן הבא מתחיל עם תמונת מצב עדכנית.

## כללים קריטיים
1. **בדיקת תחביר עם `node --check` לפני כל push** (הסעיף למעלה) — חובה מוחלטת. כל שינוי ב-`index.html` חייב לעבור חילוץ-JS + `node --check` (וגם `sw.js`). דחיפה בלי זה — אסורה.
2. **אסור `async\nfunction`** — אסור רווח/שורה בין async לfunction
3. **`H()` גלובלי** — אסור `var X = [H(...)]` גלובלי
4. **`onclick`** — חובה `window.functionName()`
5. **גרשיים בתוך onclick** — `onclick="f(\"x\")"` בלבד
6. **מקור אמת יחיד לאפליקציה = `index.html`** — זה הקובץ ש-Pages מגיש, שאליו מצביע `start_url`, ושה-APK טוען. כל עדכון קוד נכנס לכאן בלבד; אסור ליצור קובץ HTML כפול של האפליקציה. (`setup-db.html` הוא כלי עזר חד-פעמי נפרד להגדרת מסד הנתונים — לא עותק של האפליקציה. אין כאן אוטו-אפדייט מבוסס raw.githubusercontent — הרענון הוא דרך ה-Service Worker.)
7. **קידום `CACHE_NAME` בכל שינוי קוד** (הסעיף למעלה) — בלי זה העדכון לא מגיע למשתמשים.

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
