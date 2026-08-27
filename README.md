# הנהלה רוחנית

אפליקציית PWA לניהול הנהלה רוחנית בישיבה — מצבת תלמידים, נוכחות, סדרי שינה
וטיפולים. עברית מלאה, RTL, מובייל ודסקטופ.

**https://ygtotlrl-lab.github.io/hanhala-ruchanit/**

⚠️ הכותרת כאן הייתה `yeshiva-manager` — שם הריפו הישן, לפני השינוי. תוקן בסבב 33.

## הפעלה ראשונה

1. הריצו את `migrations/000_initial_schema.sql` מול פרויקט ה-Supabase
   (`kxbtskqobynewvnckaaz`) דרך ה-SQL Editor. הקובץ אידמפוטנטי.
2. צרו את המשתמש הראשון **ידנית** ב-SQL Editor — ⛔ אין משתמש ברירת מחדל ואין
   סיסמה שכתובה בריפו. ההוראה, עם מצייני מקום, נמצאת בקובץ ההתקנה.
3. `setup-db.html` הוא כלי עזר חד-פעמי שמושך את אותו קובץ ומציג אותו להעתקה.

### התקנת מסד הנתונים
מריצים את **`migrations/000_initial_schema.sql`** ב-Supabase SQL Editor —
הקובץ אידמפוטנטי ומגדיר את ארבע הטבלאות: `kv` (מקור הנתונים היחיד),
`ys_users` (כולל `pass_salt`/`pass_fp` וה-`CHECK` על `role`), `sync_log`
ו-`kv_backup`. `setup-db.html` הוא כלי חד-פעמי שמושך את הקובץ
(`cache:'no-store'`) ואינו מחזיק עותק משלו.
**הרשאות:** `kv` ו-`ys_users` — `INSERT, SELECT, UPDATE` לשני התפקידים;
`sync_log` ו-`kv_backup` — `INSERT`+`SELECT` בלבד (יומני ראיות).
המשתמש הראשון נוצר **ידנית**, עם `role` מפורש.

## מסכים

- **מצבת תלמידים** — רשימה, כרטיס תלמיד, סטטוסים והיעדרויות.
- **נוכחות** — סדרי נוכחות, סימון חי, טיפולים והשגחה.
- **שינה** — סדרי שינה, באותו מבנה.
- **הגדרות** — משתמשים, הרשאות, ואזור המצב (סנכרון · מידע טכני).

## פיתוח

הכל בקובץ אחד: `index.html`. אין build.

```bash
node tools/check-js.mjs   # חובה לפני כל push
```

<!-- SHARED:start id="readme-gate" -->
השער מחלץ את ה-JS המוטבע מ-`index.html`, מריץ `node --check` עליו ועל `sw.js`,
ומריץ את כל שערי האחידות ואת חבילות בדיקות הסבבים.
<!-- SHARED:end -->

⚠️ קידום `CACHE_NAME` ב-`sw.js` הוא חובה בכל שינוי קוד, ו-`YS_APP_VER`
ב-`index.html` מיושר אליו — הוא שדה `sw_version` שנרשם ביומן הכניסה.

### PDF
ספריית **pdfmake** (לא html2pdf — בעיות RTL), מ-`cdnjs` בגרסה נעוצה
`0.2.7` (`pdfmake.min.js` + `vfs_fonts.js`), עם
`defaultStyle: { font: 'Roboto', alignment: 'right' }`.

<!-- SHARED:start id="readme-apk" -->
## APK

מעטפת אנדרואיד מסוג **WebView** (⛔ לא TWA) ב-[`android/`](android/README.md),
שטוענת את כתובת ה-Pages מהרשת. בנייה: Actions → **Build APK** → Run workflow.
שחרור קוד web אינו מצריך APK חדש.

הכללים המחייבים והתיעוד המלא — ב-[CLAUDE.md](CLAUDE.md).
<!-- SHARED:end -->
