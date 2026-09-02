-- ============================================================================
-- 022_backup_allowlist_restore_ys_cls_years.sql — `ys_cls_years` חוזר לרשימה
-- ============================================================================
--
-- ⛔ **רץ במסד** — ⚠️ המנהל החזיר את המפתח לרשימה ב-2026-09-02, ⛔ והקובץ
--    נכתב **אחריו**: ⭐ הוא מה שמחזיר את הריפו לתאר את הסכימה החיה, ⛔ ואינו
--    הוראה להריץ שוב.
--
-- ⛔⛔ **הכיוון ב-`021` היה הפוך** — ⚠️ `bk_retention_sweep` גורע שורות
--    **שמפתחן ברשימה**: ⭐ הוצאת השם מהרשימה לא גרעה את שורותיו אלא
--    **הקפיאה אותן לנצח**, ⛔ ההפך מהתוצאה שנמסרה. ⚠️ `021` כבר רשמה את
--    המדידה הזו בבאנר שלה, ⛔ והקובץ הזה הוא התיקון בפועל.
--
-- ⭐ **נמדד במסד לפני הכתיבה:** ⛔ הרשימה החיה נושאת **35** מפתחות
--    (34 ב-`021` ועוד `ys_cls_years`), ⚠️ ול-`ys_cls_years` **שבע** שורות
--    ב-`kv_backup` — 2026-08-14 עד 2026-09-01. ⭐ הפינוי הבא יגרע מהן את
--    מה שחורג ממדיניות השמירה, ⛔ ואינו מוחק את הטרייה.
--
-- ⛔ **מיגרציה שכבר רצה אינה נערכת** — ⚠️ ולכן זהו קובץ חדש ⛔ ולא עריכה
--    של `021`: ⭐ קובץ שנערך אחרי שרץ מתאר מצב שאיש לא הריץ.
--
-- ⚠️ **והגריעה כאן היא מדיניות שמירה ⛔ ואינה מחיקת נתון** — ⭐ האיסור על
--    מחיקה אוטומטית של גיבויי `PRE_*`/`ORPHAN_*` נשאר בתוקף.
-- ============================================================================

-- רשימת-ההיתר של הפינוי, **במלואה**.
-- ⛔ הרשימה נכתבת במלואה ⛔ ולא כהפרש — ⚠️ `create or replace` מחליף את הגוף
--    כולו, ⭐ ורשימה חלקית הייתה מקפיאה כל מפתח שנשמט ממנה.
-- ⛔ והסדר הוא הסדר החי — ⚠️ `ys_cls_years` יושב אחרי `ys_perms`.
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
    'ys_cls_years', 'ys_settings_meta',
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
-- ⛔ המספר נגזר מהרשימה עצמה ⛔ ואינו מוקלד פעמיים.
do $$
declare n int; has_key boolean;
begin
  select array_length(public.bk_retention_keys(), 1) into n;
  select 'ys_cls_years' = any(public.bk_retention_keys()) into has_key;
  if not has_key then
    raise exception '022: ys_cls_years אינו ברשימת-ההיתר והצפוי שיהיה';
  end if;
  if n <> 35 then
    raise exception '022: נמדדו % מפתחות ברשימת-ההיתר והצפוי 35', n;
  end if;
end $$;
