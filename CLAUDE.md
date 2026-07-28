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

## תאריך עברי — מקור אמת יחיד (יולי 2026)
- **המנוע = הלוח המובנה בדפדפן**, `Intl.DateTimeFormat('en-u-ca-hebrew')`. שמות החודשים נקראים
  באנגלית (יציבים בין גרסאות ICU) וממופים לטבלאות התצוגה העבריות שלנו.
- **הפונקציה המרכזית:** `window.ysHebDate(date)` → `{year, monthIndex, monthName, day, dayLabel,
  yearLabel, yearLabelFull, leap, ok, src}`. **כל צרכן תאריך חייב לעבור דרכה** —
  `hebrewDate` / `hebrewDateShort` / `hebrewDateFull` / `hebrewMonth` / `_hcH` / `_hcFmt` / לוח הסדרים.
- **נפילה-חזרה:** אם Intl חסר או מחזיר תוצאה לא צפויה → `_hcHTable` (המנוע הטבלאי על `_hcST`).
  `_hcST` נבדק ואומת מול הלוח האמיתי — הוא נכון; **אין למחוק אותו**, הוא רשת הביטחון.
- **שתי טבלאות ST כפולות** (ההיא של `hebrewDate` הישן) — הוסרה. היא הייתה שגויה ביום.
- **שכבת התצוגה:** גימטריה ב-`ysGematria` (זהה ל-`DAYS_HEB` לימים 1-30, כולל ט״ו/ט״ז);
  חודשים ב-`MONTHS_HEB` / `MONTHS_HEB_LEAP`; שנה ב-`ysHebYearLabel` (תשפ"ו) ו-`ysHebYearLabelFull` (ה׳תשפ״ו).
- **אב = "מנחם אב"** בכל המסכים.
- **תמיד לעגן תאריכים בצהריים מקומיים** (12:00) לפני חישוב/הוספת ימים. חצות + כפולות של 24 שעות
  נופל ליום הקודם במעבר לשעון חורף — כך `_hcG` החזיר תאריך מוקדם ביום (תוקן).
- טווח: `_hcBase` נבנה דינמית מ-Intl (`ysHebYearInfo`), כך שהלוח כבר לא נעצר ב-תשפ״ח.

## ידוע ולא תוקן — כניסה אופליין (סריקה יולי 2026)
ראה דוח מלא בסשן. בקצרה, לפי סדר חומרה:
1. **`sw.js` מחזיר `new Response('Offline',503)` לכל החטאה בקאש** — כולל בקשת הניווט עצמה.
   ה-APK טוען `.../?apk=1`, ו-`caches.match` ללא `ignoreSearch` לא מוצא את `./` שב-CORE.
   `activate` מוחק את הקאש הישן בכל קידום גרסה → מי שפתח אופליין לפני פתיחה מקוונת אחת
   מקבל **מסך שחור עם "Offline"**. זה ההסבר למסך השחור שדווח.
2. **סקריפטי ה-CDN לעולם לא נכנסים לקאש** (תגובה opaque, `status===0`, והתנאי הוא `===200`).
   כשה-HTTP cache של הדפדפן מתפנה — `supabase` לא מוגדר, `var SB=supabase.createClient(...)` זורק,
   וכל הסקריפט המוטבע מת. מסך הכניסה מוצג אבל הכפתור לא עושה כלום.
3. `loadPerms` — supabase-js **לא זורק** בכשל רשת אלא מחזיר `{error}`. לכן ה-`catch` שקורא
   את `ys_perms_cache` הוא קוד מת, ובאופליין תמיד נטענות `DEFAULT_PERMS` במקום ההרשאות האמיתיות.
4. אין timeout על שאילתת הכניסה — ברשת "חצי מחוברת" הספינר נתקע לנצח בלי הודעה.
5. `cache.find` ללא `Array.isArray` (ב-`doLogin` וב-`confirmSwitch`) — קאש פגום מסוג לא צפוי
   זורק TypeError שנבלע, והמשתמש נשאר עם ספינר בלי שום הודעה.
6. שגיאת שרת שאינה שגיאת רשת (פרויקט מושהה / מפתח פג) לא נופלת לעותק המקומי כלל.
7. `ys_users_cache` מחזיק את סיסמאות **כל** המשתמשים הפעילים ב-plaintext ב-localStorage.
