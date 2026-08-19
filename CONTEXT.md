# הנהלה רוחנית — קונטקסט פיתוח

## פרטי ריפו
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit` (שונה מ-`yeshiva-manager`)
- **GitHub Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **טוקן:** מנוהל ב-Windows Credential Manager (host `github.com`) — לעולם לא בקובץ
- **קובץ ראשי:** `index.html`
- **Supabase:** project `kxbtskqobynewvnckaaz` (⚠️ **משותף** עם yoman-avoda
  ועם schar-limud) | טבלאות `kv` / `ys_*` (ראה למטה)

---

## ⚠️ Supabase — GRANT חובה לטבלאות חדשות

כל טבלה חדשה שנוצרת ב-`public` schema חייבת לכלול GRANT מפורש — אחרת supabase-js
לא יוכל לגשת אליה. **⛔ והסדר הוא `revoke` ואז `grant`, ולא `grant` לבדו:**

```sql
revoke all on public.TABLE_NAME from anon, authenticated;
grant select, insert, update on public.TABLE_NAME to anon, authenticated;
grant all on public.TABLE_NAME to service_role;
alter table public.TABLE_NAME enable row level security;
```

⚠️ **הסיבה:** `GRANT` הוא **אדיטיבי בלבד ואינו מסיר דבר**, ופרויקט Supabase
סטנדרטי מגיע עם `alter default privileges … grant all on tables` — כלומר
**כל טבלה נולדת עם `DELETE` ו-`TRUNCATE`**. מחיקה בארגון היא תמיד `deleted=true`
או tombstone (כלל ברזל 6 סעיף 1), ולכן ההרשאות האלה מיותרות בהגדרה ומסוכנות
בפועל: מפתח ה-anon יושב גלוי ב-`index.html` הציבורי. ר' כלל ברזל 10 סעיף 9,
`migrations/001_revoke_delete_anon.sql` ו-`migrations/002_revoke_log_tables.sql`.

מקור האמת המלא לסכימה: `migrations/000_initial_schema.sql` (כלל קריטי 6).

---

## כללים קריטיים לפיתוח

1. **`node tools/check-js.mjs` לפני כל push** — חובה מוחלטת. הוא מחלץ את ה-JS
   המוטבע מ-`index.html`, מריץ `node --check` עליו ועל `sw.js`, ומריץ את כל
   שערי האחידות ואת חבילות בדיקות הסבבים.
2. **קידום `CACHE_NAME` ב-`sw.js` ו-`YS_APP_VER` בהתאם** בכל שינוי קוד — בלי
   זה העדכון לא מגיע למשתמשים, ויומן הכניסה רושם `sw_version` שגוי.
3. **⛔ אסור `async\nfunction`** · **⛔ אין `var X = [H(...)]` גלובלי** ·
   `onclick` חייב `window.functionName()` · גרשיים בתוך `onclick` רק
   `onclick="f(\"x\")"`.
4. **כתיבה ל-localStorage אך ורק דרך `lsSet`** — `setItem` ישיר זורק באחסון
   חסום והורג את נתיב הכתיבה באמצע, בלי הודעה (כלל ברזל 1).
5. **`esc()`** על כל ערך משתמש שנכנס ל-`innerHTML`; ⛔ אין קוד JS במאפייני HTML.

```bash
node tools/check-js.mjs      # השער — חובה לפני כל push
```

---

## טבלאות

| טבלה | תפקיד | הערות |
|---|---|---|
| `kv` | **מקור הנתונים היחיד של האפליקציה** | סדרי נוכחות ושינה, טיפולים, מצבה, הרשאות — כערכי `kv` |
| `ys_users` | משתמשים | `role` = `admin`/`senior`/`junior`, `NOT NULL` בלי DEFAULT · ⛔ מוחרגת מהגיבוי |
| `ys_sessions`, `ys_marks` | שכבת השורות של הנוכחות | אב/בן (`migrations/005`–`006`, הורצו) · ⛔ ה-`kv` עדיין המאסטר |
| `ys_students_rows` | שכבת השורות של המצבה | אותו שלב א |
| `ys_sleep_sessions`, `ys_sleep_marks` | שכבת השורות של השינה | `migrations/009`–`010` — ⛔ **נכתבו ולא הורצו** (סבב 39) |
| `sync_log`, `kv_backup` | יומן וגיבוי | `INSERT`+`SELECT` בלבד — יומני ראיות (כלל ברזל 10 סעיף 9) |

⚠️ **התנגשות שמות:** הקידומת `sl` כאן = **שינה** (`slSaveData`, `slOpenSession`…)
— **פונקציות JS בלבד** שכותבות ל-`kv`; ב-`schar-limud` קיימות טבלאות `sl_*`
שפירושן **שכר לימוד**, באותו פרויקט Supabase. פירוט מלא ב-CLAUDE.md של שניהם.

⚠️ **פרויקט Supabase משותף:** `kv_backup`, `sync_log` ומשימת ה-`pg_cron` לפינוי
הגיבויים חיים בפרויקט **אחד** עם yoman-avoda ועם schar-limud. לכן מיגרציית
הפינוי `migrations/004` שיושבת כאן מכסה גם את מפתחות הגיבוי שלהן — **קובץ אחד
לפרויקט אחד**, ולא עותק בכל ריפו.

---

## מצב נוכחי
- מצבת תלמידים ✅ (75 תלמידים, שיעורות א/ב/ג) · סדרי נוכחות ושינה ✅
- PDF נוכחות ✅ (**pdfmake**, לא html2pdf — בעיות RTL)
- כניסה אופליין מרובת-משתמשים מול `pass_salt`+`pass_fp` ✅ (סבב 22)
- עבודה אופליין מלאה: מיזוג ברמת רשומה, tombstones, סימון ⏳ ✅
- גיבוי יומי ויומן פעולות מהמודול המשותף ✅ · שחזור מקומי מהענן ✅
- PWA + באנר עדכון ✅ · מעטפת APK מסוג WebView ב-`android/` ✅
- **דוחות חודשיים / מבחנים / תיקים אישיים — בבנייה** (`UNDER_CONSTRUCTION`)
- ⛔ **חלון חם — רדום** (`HW_CFG.enabled=false`): הנתונים הם ערכי `kv` שלמים,
  ופינוי פר-רשומה מעליהם היה מוחק את הערך כולו. ההפעלה בשלב ב.

**מצב המיגרציות:** `000`–`010` — ר' הטבלה המלאה ב-CLAUDE.md.

## פרטי מערכת
- ⛔ **לעולם לא TWA ולא PWABuilder** — TWA מריץ את האתר בתוך כרום, וסינון התוכן
  במכשירי המשתמשים חוסם את כרום. זה נמדד: ה-TWA של gius פשוט לא נפתח.
- ⛔ **המפתח הישן שישב ב-`/tmp` אבד.** המפתח הקבוע היחיד הוא
  `signing/hanhala.keystore` שבריפו; ⛔ לעולם לא ליצור keystore חדש.
- ⛔ **אין פרטי כניסה בשום קובץ בריפו** (כלל ברזל 8 סעיף 7, כלל ברזל 10
  סעיפים 3 ו-8) — הריפו ציבורי, ומפתח ה-anon יושב ב-`index.html`. המשתמש
  הראשון נוצר **ידנית** ב-SQL Editor, כמתואר ב-`migrations/000`.
- סנכרון: משיכה ← מיזוג ← דחיפת-מצב פר-קטגוריה. `ys_offline_queue` הוא מנגנון
  **פר-מפתח `kv` בלבד** ו⛔ אינו תור פעולות (כלל ברזל 6).
- תאריך עברי: מנוע יחיד — `window.ysHebDate` מעל `Intl` עם נפילה-חזרה טבלאית
  (`_hcST`). ⛔ אין למחוק את הטבלה, היא רשת הביטחון.

הכללים המחייבים והתיעוד המלא — ב-[CLAUDE.md](CLAUDE.md).
