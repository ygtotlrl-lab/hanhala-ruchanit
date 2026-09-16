-- ============================================================================
-- 037_prefix_from_repo_name.sql — תחילית הטבלאות נגזרת משם הריפו
-- ============================================================================
--
-- ⛔ **רצה במסד** — ⚠️ הוחלה בסבב 148 ואומתה: ⭐ אפס אובייקט בשם ישן
--    ב-`pg_class`, ⛔ ו-121 מפתחות גיבוי שנשאו `ys_` נכתבו מחדש.
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסב את שבע טבלאות ההנהלה מ-`ys_` ל-`hr_` —
--    ⭐ ראשי התיבות של `hanhala-ruchanit`: ⛔ `rename` אינו העתקה, ⚠️ והנתונים,
--    האינדקסים, האילוצים והמדיניות נשמרים · ⛔⛔ **ורשימת-ההיתר של הפינוי
--    נכתבת מחדש באותה עסקה** — ⚠️ היא **הצרכן היחיד לשם הטבלה במסד**,
--    ⭐ והיא אינה בעץ: ⛔ שם ישן בה הוא גיבוי שאינו מתפנה לעולם, ⚠️ **בשקט**.
--
-- ⛔⛔ **הנימוק:** ⚠️ תחילית שאינה נגזרת משם הריפו אינה ניתנת לניחוש —
--    ⭐ `ys` אינו `hanhala-ruchanit` בשום קריאה: ⛔ והשם שנבחר פעם אחת חי
--    בכל שאילתה, בכל מפתח גיבוי, ובכל מפתח אחסון מקומי.
--
-- ⛔ **ו-`_rows` נשאר ב-`hr_students_rows`** — ⚠️ הוא שכבת השורות, ⭐ ומפתח
--    הגיבוי `hr_students` הוא שכבת ה-`kv` שקדמה לה: ⛔ שני שמות שאינם אותו
--    דבר, ⚠️ ואיחודם היה מאחד שתי שכבות גיבוי לדלי אחד.
--
-- ⛔ **ואין כאן מחיקת נתונים** — ⚠️ אפס `delete`, ⛔ ואפס `drop`.
-- ⚠️ **ובמסד רצה יחד עם המיגרציה המקבילה של היומן, בעסקה אחת.**
-- ============================================================================

alter table if exists public.ys_settings          rename to hr_settings;
alter table if exists public.ys_users             rename to hr_users;
alter table if exists public.ys_sessions          rename to hr_sessions;
alter table if exists public.ys_sleep_sessions    rename to hr_sleep_sessions;
alter table if exists public.ys_marks             rename to hr_marks;
alter table if exists public.ys_sleep_marks       rename to hr_sleep_marks;
alter table if exists public.ys_students_rows     rename to hr_students_rows;

-- ⛔ האילוצים והאינדקסים נגזרים ⛔ ואינם מוקלדים — ⚠️ `rename to` על טבלה
--    אינו נוגע בהם, ⭐ ושם אילוץ שנשאר ישן הוא השם היחיד שהמסד עוד נוקב בו.
--    ⛔ **והאילוץ קודם לאינדקס** — ⚠️ שינוי שם אילוץ משנה גם את האינדקס
--    שמגבה אותו, ⭐ והלולאה השנייה מוצאת רק את מה שנותר.
do $$
declare r record; nn text;
begin
  for r in
    select c.conname, c.conrelid::regclass::text rel
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public' and c.conname like 'ys\_%'
  loop
    nn := replace(r.conname, 'ys_', 'hr_');
    execute format('alter table public.%I rename constraint %I to %I', r.rel, r.conname, nn);
  end loop;
  for r in
    select indexname from pg_indexes
     where schemaname = 'public' and indexname like 'ys\_%'
  loop
    nn := replace(r.indexname, 'ys_', 'hr_');
    execute format('alter index public.%I rename to %I', r.indexname, nn);
  end loop;
end $$;

-- ⛔ מדיניות אחת נושאת את שם הטבלה בשמה — ⚠️ השאר נקראות `allow_all`,
--    ⭐ ואין בהן שם טבלה שיתיישן.
alter policy ys_settings_all on public.hr_settings rename to hr_settings_all;

-- ⛔ מפתחות הגיבוי — ⚠️ שלושה מבני מפתח: `<טבלה>` · `<מוסד>_<טבלה>` · ועם
--    קידומת `ANCHOR:` · `DIFF:` · `pre-…:` — ⭐ ו-`replace` תופס את שלושתם.
update public.sh_backup set key = replace(key, 'ys_', 'hr_') where key like '%ys\_%';

-- ⛔⛔ רשימת-ההיתר של הפינוי — ⚠️ בעלותה כאן, ⭐ והיא משרתת את שלוש
--     האפליקציות שבפרויקט: ⛔ שם שאינו בה אינו מתפנה לעולם, ⚠️ ושם שבה
--     ואין לו מפתח גיבוי חי אינו מזיק — ⭐ והוא נמדד בשער.
create or replace function public.bk_retention_keys()
returns text[] language sql immutable as $function$
  select array[
    'hr_students', 'hr_attend_sessions', 'hr_attend_cfg',
    'hr_attend_treats', 'hr_sleep_sessions', 'hr_sleep_cfg', 'hr_sleep_treats',
    'hr_reasons', 'hr_absence_reasons', 'hr_approvals', 'hr_perms',
    'hr_cls_years', 'hr_settings_meta',
    'sl_students', 'sl_transactions', 'sl_settings', 'sl_lists',
    'rishon_ya_entries_rows', 'rishon_ya_cats', 'rishon_ya_subs',
    'rishon_ya_subs_meta',
    'ramataviv_ya_entries_rows', 'ramataviv_ya_cats', 'ramataviv_ya_subs',
    'ramataviv_ya_subs_meta',
    'rishon_ya_entries', 'rishon_ya_archive',
    'ramataviv_ya_entries', 'ramataviv_ya_archive',
    'hr_sessions_rows', 'hr_marks_rows', 'hr_students_rows',
    'hr_sleep_sessions_rows', 'hr_sleep_marks_rows',
    'hr_settings'
  ]::text[];
$function$;
