-- ============================================================================
-- 021_soft_delete_ys_cls_years.sql — `ys_cls_years` נגרע, ועמודות שהיו חסרות
-- ============================================================================
--
-- ⛔ **רץ במסד** — ⚠️ שלושת החלקים הוחלו ידנית ב-2026-09-02, ⛔ והקובץ נכתב
--    **אחריהם**: ⭐ הוא מה שמחזיר את הריפו לתאר את הסכימה החיה, ⛔ ואינו
--    הוראה להריץ שוב. ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ שינוי נוסף נעשה
--    בקובץ הבא בתור.
--
-- ⭐ **שלושת החלקים — כולם נמדדו במסד לפני הכתיבה:**
--    (א) ⛔ `ys_settings` נוצרה **בלי** שלוש עמודות המחיקה הרכה — ⚠️ `016`
--        השלימה אותן לכל טבלה שנשאה `deleted`, ⛔ ו-`ys_settings` נוצרה
--        ב-`015` בלי אף אחת מהן: ⭐ נמדד שהשלוש קיימות היום.
--    (ב) ⛔ `ys_cls_years` סומן מחוק — ⚠️ נמדד `deleted=true` ו-`deleted_by`
--        `admin:cleanup-2026-09-02`; ⛔ ואין `delete` פיזי בשום מסלול.
--    (ג) ⛔ שמו הוסר מ-`bk_retention_keys` — ⚠️ נמדד שאינו ברשימה החיה,
--        ⭐ ושהיא זהה לרשימת `019` פחות השם הזה.
--
-- ⚠️ **ו-`019` רצה** — ⛔ הבאנר שלה אמר «נכתב ולא רץ» ותוקן באותו סבב:
--    ⭐ הרשימה החיה מכילה את `ys_settings`, ⛔ שנוסף בה ולא ב-`014`.
--
-- ⛔⛔ **ההשלכה נרשמת כפי שנמדדה, ⛔ ולא כפי שנמסרה** — ⚠️ `bk_retention_sweep`
--    גורע שורות **שמפתחן ברשימה**: ⭐ מפתח שיצא ממנה אינו מתפנה לעולם.
--    ⛔ ולכן שבע שורות `ys_cls_years` שב-`kv_backup` (14.8–1.9) **קפאו**
--    ואינן נגרעות — ⚠️ ההפך מהתוצאה שנמסרה. ⭐ החזרת השם לרשימה תגרע אותן
--    בריצה הבאה, ⛔ וזו הכרעת מנהל ואינה פעולה שסשן מבצע.
-- ============================================================================

-- (א) שלוש עמודות המחיקה הרכה ל-`ys_settings`.
-- ⛔ הטיפוס הוא הטיפוס של `updated_at` באותה טבלה — ⚠️ כאן `timestamptz`,
--    ⭐ ששרת מייצר אותו בטריגר; ⛔ `bigint` היה מפתח הכרעה בסולם שני.
alter table public.ys_settings add column if not exists deleted    boolean not null default false;
alter table public.ys_settings add column if not exists deleted_at timestamptz;
alter table public.ys_settings add column if not exists deleted_by text;

-- (ב) גריעת `ys_cls_years` — סימון וחותמת, ⛔ ולא מחיקה פיזית.
-- ⛔ החותמת אינה מומצאת בדיעבד — ⚠️ זו החותמת שנרשמה בהרצה עצמה,
--    ⭐ והכתיבה אידמפוטנטית: הרצה חוזרת אינה משנה שורה שכבר מחוקה.
update public.ys_settings
   set deleted    = true,
       deleted_at = timestamptz '2026-09-02 07:04:26.163938+00',
       deleted_by = 'admin:cleanup-2026-09-02',
       updated_at = timestamptz '2026-09-02 07:04:26.163938+00'
 where key = 'ys_cls_years'
   and deleted is distinct from true;

-- (ג) רשימת-ההיתר של הפינוי, בלי `ys_cls_years`.
-- ⛔ הרשימה נכתבת **במלואה** ⛔ ולא כהפרש — ⚠️ `create or replace` מחליף את
--    הגוף כולו, ⭐ ורשימה חלקית הייתה מקפיאה כל מפתח שנשמט ממנה.
create or replace function public.bk_retention_keys()
returns text[]
language sql
immutable
as $$
  select array[
    -- hanhala-ruchanit — מפתחות ה-`kv` שיצאו משימוש בסבב 80
    'ys_students', 'ys_attend_sessions', 'ys_attend_cfg',
    'ys_attend_treats', 'ys_sleep_sessions', 'ys_sleep_cfg', 'ys_sleep_treats',
    'ys_reasons', 'ys_absence_reasons', 'ys_approvals', 'ys_perms',
    'ys_settings_meta',
    -- schar-limud
    'sl_students', 'sl_transactions', 'sl_settings', 'sl_lists',
    -- yoman-avoda — ראשון לציון
    'rishon_tb_entries_rows', 'rishon_tb_cats', 'rishon_tb_subs',
    'rishon_tb_subs_meta',
    -- yoman-avoda — רמת אביב
    'ramataviv_tb_entries_rows', 'ramataviv_tb_cats', 'ramataviv_tb_subs',
    'ramataviv_tb_subs_meta',
    -- yoman-avoda — שמות גיבוי השגרה שיצאו משימוש
    'rishon_tb_entries', 'rishon_tb_archive',
    'ramataviv_tb_entries', 'ramataviv_tb_archive',
    -- hanhala-ruchanit — מקורות `kind:'table'` של שכבת השורות
    'ys_sessions_rows', 'ys_marks_rows', 'ys_students_rows',
    'ys_sleep_sessions_rows', 'ys_sleep_marks_rows',
    -- hanhala-ruchanit — ההגדרות, שירשו את שלושה-עשר מפתחות ה-`kv`
    'ys_settings'
  ]::text[];
$$;

-- ⛔ שער שקילות — ⚠️ המיגרציה נכשלת ברעש במקום להשאיר מצב חלקי.
do $$
declare miss int; still int;
begin
  select count(*) into miss from (values ('deleted'), ('deleted_at'), ('deleted_by')) v(c)
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'ys_settings'
                        and column_name = v.c);
  if miss <> 0 then
    raise exception '021: חסרות % עמודות מחיקה רכה ב-ys_settings והצפוי אפס', miss;
  end if;
  select count(*) into still from unnest(public.bk_retention_keys()) k where k = 'ys_cls_years';
  if still <> 0 then
    raise exception '021: ys_cls_years עדיין ברשימת-ההיתר והצפוי אפס';
  end if;
end $$;
