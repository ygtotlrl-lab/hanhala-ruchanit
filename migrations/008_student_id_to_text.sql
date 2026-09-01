-- ============================================================================
-- 008_student_id_to_text.sql — `student_id` מ-`smallint` ל-`text` בשתי טבלאות השורות
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ⭐ **מה שהוליד אותה:** `005` הגדירה `student_id smallint` לפי מדידה שהייתה
--    נכונה באותו יום — מזהי התלמידים היו ≤ 71, כי הם הוקצו ב-`maxId++`.
-- באותו יום עצמו החליף את הקצאת המזהים ל-**uuid שנוצר במכשיר**
--    (כלל ברזל 6, «מזהים»), כדי ששני מכשירים שמייבאים מצבה במקביל לא יקצו
--    את אותו מזהה לשני אנשים. מרגע זה `smallint` לא יכול היה לייצג מזהה
--    תלמיד חדש, ו-`ysMarkRows` דילגה על כל סימוניו — שכבת השורות הייתה
--    מתחילה לפגר אחרי ה-`kv` בשקט.
--
-- ⛔ **ההכרעה: המרת העמודה הקיימת, ולא הוספת `student_key` לצידה** —
--    שתי עמודות למושג אחד הן מקור אמת כפול, בדיוק הלקח של `deleted`
--    שנוספה והוסרה מטבלאות המשתמשים באותו יום. ו-`text` הוא ממילא הדפוס
--    בשאר הארגון: `client_id` בארבע האפליקציות הוא טקסט.
--
-- ⚠️ **ההמרה שומרת על הערכים הקיימים** — `smallint` → `text` הוא
--    `USING student_id::text`, כלומר `71` הופך ל-`'71'`. המזהים עצמם לא
--    השתנו, ו⛔ אין לשנות מזהה קיים לעולם (הוא מפתח המיזוג).
-- ⚠️ **חמשת האינדקסים שורדים את ההמרה** — Postgres בונה אותם מחדש
--    אוטומטית ב-`ALTER COLUMN ... TYPE`, ומיון לקסיקוגרפי משרת את
--    `(student_id, date_iso desc)` בדיוק כמו קודם: השאילתה מסננת על
--    `student_id` שוויונית וממיינת על `date_iso`.
-- ⛔ אין נגיעה בנתונים — שינוי טיפוס בלבד.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ys_marks
  alter column student_id type text using student_id::text;

alter table public.ys_students_rows
  alter column student_id type text using student_id::text;

-- ---------- אימות ---------------------------------------------
-- select table_name, column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema='public' and column_name='student_id'
--    and table_name in ('ys_marks','ys_students_rows');
-- התקבל: ys_marks.student_id text NO · ys_students_rows.student_id text YES
--
-- select count(*) from public.ys_marks;          -- התקבל: 13,144
-- select count(*) from public.ys_students_rows;  -- התקבל: 71
-- select count(*) from public.ys_sessions;       -- התקבל: 274
--
-- select count(*) from pg_indexes where schemaname='public'
--   and tablename in ('ys_marks','ys_students_rows','ys_sessions');
-- התקבל: 11 (כולל מפתחות ראשיים) — אף אינדקס לא אבד בהמרה.
