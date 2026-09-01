-- ============================================================================
-- 016_soft_delete_columns.sql — השלמת עמודות המחיקה הרכה
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ⭐ **מה משתנה:** כל טבלה שנושאת `deleted` מקבלת גם `deleted_at` ו-`deleted_by`.
--    ⚠️ `deleted` לבדה מוחקת בלי לתעד מי ומתי — ⛔ ואין ממה לשחזר כשמתברר
--    שהמחיקה הייתה שגויה.
--
-- ⚠️ **הטיפוס של `deleted_at` הוא הטיפוס של `updated_at` באותה טבלה** —
--    ⛔ הבדל מכוון: החותמת כאן היא מילישניות מהמכשיר ב-`bigint`, ⛔ ו-`timestamptz` היה מפתח הכרעה בסולם שני.
--
-- ⛔ **אידמפוטנטי** — `add column if not exists`, ⚠️ והרצה חוזרת אינה משנה דבר.
-- ⛔ **ואינו ממלא ערך לשורות קיימות** — ⚠️ `null` הוא «לא נבדק», ⭐ וערך שהומצא
--    בדיעבד היה נקרא כעדות.
-- ============================================================================

alter table public.ys_marks           add column if not exists deleted_at bigint;
alter table public.ys_marks           add column if not exists deleted_by text;

alter table public.ys_sessions        add column if not exists deleted_at bigint;

alter table public.ys_sleep_marks     add column if not exists deleted_at bigint;
alter table public.ys_sleep_marks     add column if not exists deleted_by text;

alter table public.ys_sleep_sessions  add column if not exists deleted_at bigint;

alter table public.ys_students_rows   add column if not exists deleted_at bigint;
alter table public.ys_students_rows   add column if not exists deleted_by text;
