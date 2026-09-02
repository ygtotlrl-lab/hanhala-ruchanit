-- ============================================================================
-- 019_backup_allowlist_add_ys_settings.sql — `ys_settings` נכנס לרשימת-ההיתר
-- ============================================================================
--
-- ⛔ **נכתב ולא רץ.** ⛔ ההרצה היא פעולת מנהל, ⚠️ ואין להריץ מיגרציה מתוך
--    סשן. ⛔ מיגרציה שכבר רצה אינה נערכת, ולכן השינוי הוא קובץ חדש
--    ולא עריכה של `014`.
--
-- ⭐ **מה שהוליד אותה:** `018` הפילה את טבלת `kv`, ⛔ ושלושה-עשר מקורות
--    הגיבוי של הנהלה המשיכו להצביע עליה. ⚠️ נמדד במסד ב-1.9: עשרה מהם
--    לא גובו כלל באותו יום, ⛔ ושלושת הנותרים גובו עד **שש פעמים** —
--    גיבוי שנכשל אינו כותב את הדגל היומי, ⭐ ולכן הוא רץ שוב ושוב.
--    ⛔ התוכן עצמו לא אבד: הוא עבר ל-`ys_settings` בסבב 78.
--
-- ⛔ **וההשלכה נרשמת במפורש** (כלל ברזל 20): מפתח שאינו ברשימת-ההיתר
--    **אינו מתפנה לעולם**. ⭐ ולכן שלושה-עשר המפתחות הישנים **נשארים**
--    ברשימה — ⚠️ יש להם עותקי גיבוי במסד, וגריעתם מהרשימה הייתה מקפיאה
--    אותם לנצח; ⛔ הם מוצהרים ב-`test_cron` כ-`legacyKeys`.
-- ============================================================================

create or replace function public.bk_retention_keys()
returns text[]
language sql
immutable
as $$
  select array[
    -- hanhala-ruchanit — מפתחות ה-`kv` שיצאו משימוש בסבב 80 (ר' הנימוק למעלה)
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
