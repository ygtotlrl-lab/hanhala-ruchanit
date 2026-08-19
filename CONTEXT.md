# הנהלה רוחנית — קונטקסט פיתוח

## פרטי ריפו
- **ריפו:** `ygtotlrl-lab/hanhala-ruchanit` (שונה מ-`yeshiva-manager`)
- **GitHub Pages:** `https://ygtotlrl-lab.github.io/hanhala-ruchanit/`
- **טוקן:** מנוהל ב-Windows Credential Manager (host `github.com`) — לעולם לא בקובץ
- **קובץ ראשי:** `index.html`
- **Supabase:** project `kxbtskqobynewvnckaaz` | טבלאות `kv`, `ys_*` (ראה למטה)

---

<!-- SHARED:start id="context-grant" -->
## ⚠️ Supabase — GRANT חובה לטבלאות חדשות

כל טבלה חדשה שנוצרת ב-`public` schema חייבת לכלול GRANT מפורש — אחרת supabase-js
לא יוכל לגשת אליה. **⛔ וכאן הסדר הוא `revoke` ואז `grant`, ולא `grant` לבדו:**

```sql
revoke all on public.TABLE_NAME from anon, authenticated;
grant select, insert, update on public.TABLE_NAME to anon, authenticated;
grant all on public.TABLE_NAME to service_role;
alter table public.TABLE_NAME enable row level security;
```
<!-- SHARED:end -->

⚠️ **הסיבה:** `GRANT` הוא **אדיטיבי בלבד ואינו מסיר דבר**, ופרויקט Supabase
סטנדרטי מגיע עם `alter default privileges … grant all on tables` — כלומר
**כל טבלה נולדת עם `DELETE` ו-`TRUNCATE`**. מחיקה בארגון היא תמיד `deleted=true`
(כלל ברזל 6 סעיף 1), ולכן ההרשאות האלה מיותרות בהגדרה ומסוכנות בפועל: מפתח
ה-anon יושב גלוי ב-`index.html` הציבורי. ר' `migrations/001`+`002`.

מקור האמת המלא לסכימה: `migrations/000_initial_schema.sql` (כלל קריטי 6 ב-CLAUDE.md).

---

## כללים קריטיים לפיתוח

1. **`node tools/check-js.mjs` לפני כל push** — חובה מוחלטת. השער מחלץ את ה-JS
   המוטבע מ-`index.html`, מריץ `node --check` עליו ועל `sw.js`, ומריץ את כל
   שערי האחידות ואת חבילות בדיקות הסבבים.
2. **קידום `CACHE_NAME` ב-`sw.js` בכל שינוי קוד**, ו-`YS_APP_VER` מיושר אליו —
   הוא שדה `sw_version` שנרשם ביומן הכניסה.
3. **⛔ אסור `async` ו-`function` בשתי שורות** — אסור רווח או שורה ביניהם.
4. **`H()` גלובלי** — ⛔ אסור `var X = [H(...)]` גלובלי.
5. **`onclick`** — חובה `window.functionName()`, וגרשיים בצורה `onclick="f(\"x\")"`.
6. **כתיבה ל-localStorage אך ורק דרך `lsSet`/`lsSetArray`** (כלל ברזל 1).
7. **`esc()`** על כל ערך משתמש שנכנס ל-`innerHTML` (ו-`xmlEsc` בייצוא).

---

## טבלאות

| טבלה | תפקיד | הערות |
|---|---|---|
| `kv` | **מקור הנתונים היחיד של האפליקציה** | סדרי נוכחות ושינה, טיפולים, מצבת התלמידים, הרשאות — הכול כערכי `kv` |
| `ys_users` | משתמשים | `role text NOT NULL` בלי `DEFAULT`, `CHECK (role in ('admin','senior','junior'))`, `pass_salt`+`pass_fp`, `active`, `updated_at` + טריגר |
| `ys_sessions` | מטא הסדר, שורה לסדר | שלב א של מעבר הטבלאות (סבב 36) — ⛔ ה-`kv` עדיין המאסטר |
| `ys_marks` | שורה לכל תלמיד×סדר | `student_id` הוא `text` (סבב 37ב); ⛔ בלי מפתח זר פיזי |
| `ys_students_rows` | מצבת התלמידים כשורות | אותו שלב א |
| `sync_log` | יומן פעולות | `INSERT`+`SELECT` בלבד לשני התפקידים — יומן ראיות |
| `kv_backup` | גיבוי יומי | `INSERT`+`SELECT` בלבד; פינוי יומי ב-`pg_cron` (`migrations/004`) |

⛔ **הטבלאות `students`/`attendance` נטושות ואין להחזיר אליהן שאילתות** (סבב 7).
⚠️ **התנגשות שמות:** הקידומת `sl` כאן = **שינה** (`slSaveData`, `slOpenSession`…) —
פונקציות JS בלבד; ב-`schar-limud` `sl_` עם קו תחתון = טבלאות שכר לימוד, באותו
פרויקט Supabase.

---

## מצב נוכחי
- מצבת תלמידים ✅ · נוכחות ✅ · שינה ✅ · טיפולים ✅
- PDF נוכחות ✅ (pdfmake — ר' למטה)
- כניסה אופליין מול טביעת PBKDF2, ⛔ בלי סיסמה על הדיסק ✅
- גיבוי יומי ל-`kv_backup` + יומן פעולות ל-`sync_log` ✅
- **דוחות חודשיים / מבחנים / תיקים אישיים — בבנייה** (`UNDER_CONSTRUCTION`)
- PWA + באנר עדכון — `CACHE_NAME` נוכחי `hanhala-ruchanit-v51`

## פרטי מערכת
- מעטפת APK: **WebView מקורי** ב-`android/` שטוען מהרשת — ⛔ לא TWA ולא PWABuilder
- חתימה: `signing/hanhala.keystore` (alias `hanhala`) — ⛔ המפתח הקבוע
- סנכרון: `ysAutoSync` לפי חותמת `ys_last_changed`; `ys_offline_queue` הוא מנגנון
  **פר-מפתח `kv`** ⛔ ואינו תור פעולות
- ⛔ **אין סיסמאות בקובץ הזה ולא יהיו** — הן חיות ב-`ys_users` בלבד (כלל ברזל 10
  סעיף 8). ⚠️ עד סבב 39 ישבה כאן סיסמת admin בטקסט גלוי; היא הוסרה, ⛔ אך
  היסטוריית ה-git שומרת אותה — הטיפול היחיד הוא החלפתה במסד.

---

## מודול PDF נוכחות

**pdfmake** (הוחלפה מ-html2pdf בגלל בעיות RTL):
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
```
`defaultStyle: { font: 'Roboto', alignment: 'right' }`

**מבנה:** כותרת הישיבה · תאריך `DD.M.YYYY — דוח נוכחות` (direction:ltr) · קו
מפריד כחול · שורת סיכום `סה"כ | נוכחים | נעדרים` · טבלת נוכחים (כחול) וטבלת
נעדרים (אדום).
⚠️ **שורת הסיכום צוירה בעבר כתמונת canvas** כדי לעקוף היפוך RTL של html2pdf;
עם pdfmake היא `columns` ישירות, ⛔ ואין צורך להחזיר את ה-canvas.

---

## תיקון URL ב-APK קיים ובנוי (בלי מקור) — smali בלבד

⚠️ **הפרק הזה רלוונטי רק ל-APK ישן שנבנה לפני `android/`.** בנייה רגילה היום היא
מ-`android/` דרך `.github/workflows/build-apk.yml`, והמעטפת טוענת מהרשת.

```bash
apktool d <app>.apk -o /tmp/hanhala_work -f
# תקן את ה-URL ב-MainActivity.smali ו-MainActivity$2.smali
rm -rf /tmp/hanhala_work/build     # חובה לפני בנייה חוזרת
apktool b /tmp/hanhala_work -o built.apk
zipalign -f 4 built.apk aligned.apk
apksigner sign --ks signing/hanhala.keystore --ks-key-alias hanhala \
  --ks-pass pass:hanhala123 --key-pass pass:hanhala123 --out output.apk aligned.apk
```

⛔ **smali בלבד — לא binary patch.**
⚠️ **המפתח הישן שישב ב-`/tmp` אבד**; המפתח הקבוע הוא `signing/hanhala.keystore`,
ולכן מעבר מה-APK הישן הוא **הסרה + התקנה** חד-פעמית.

### ⚠️ Cache APK — כלל זהב
שם קובץ חוזר נתפס במטמון. תמיד שם חדש:
```bash
TS=$(date +%s) && apksigner sign ... --out hanhala-${TS}.apk
```

הכללים המחייבים והתיעוד המלא — ב-[CLAUDE.md](CLAUDE.md).
