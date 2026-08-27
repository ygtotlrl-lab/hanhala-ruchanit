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

## מצב נוכחי
- מצבת תלמידים ✅ · נוכחות ✅ · שינה ✅ · טיפולים ✅
- PDF נוכחות ✅ (pdfmake — ר' למטה)
- כניסה אופליין מול טביעת PBKDF2, ⛔ בלי סיסמה על הדיסק ✅
- גיבוי יומי ל-`kv_backup` + יומן פעולות ל-`sync_log` ✅
- **דוחות חודשיים / מבחנים / תיקים אישיים — בבנייה** (`UNDER_CONSTRUCTION`)
- PWA + באנר עדכון — ⛔ ערך `CACHE_NAME` ב-`sw.js` בלבד

---

⛔ **הקובץ הזה מחזיק לקוח וצורך בלבד** (כלל ברזל 23) — כללי הפיתוח,
הסכימה ופרטי המערכת יושבים ב-[CLAUDE.md](CLAUDE.md), ב-[README.md](README.md)
וב-[android/README.md](android/README.md). ⛔ תיאור שחוזר משם נסחף בשקט.
