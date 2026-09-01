-- ============================================================================
-- 014_backup_allowlist_drop_wa_phone.sql — גריעת `tb_wa_phone` מרשימת-ההיתר
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ⛔ **וההשלכה נרשמת במפורש** (כלל ברזל 20): מפתח שאינו ברשימת-ההיתר **אינו
--    מתפנה לעולם**. הגריעה כאן בטוחה **רק** מפני שאין מקור שממשיך לכתוב
--    תחת השם הזה — ⛔ ואם ייווצר מקור כזה בעתיד, השם חוזר לרשימה **באותו
-- סבב** שמוסיף אותו ל-`BK_CFG.sources()`, בדיוק.
-- ============================================================================

create or replace function public.bk_retention_keys()
returns text[]
language sql
immutable
as $$
  select array[
    -- hanhala-ruchanit
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
    -- yoman-avoda — שמות גיבוי השגרה שיצאו משימוש (ר' הנימוק למעלה)
    'rishon_tb_entries', 'rishon_tb_archive',
    'ramataviv_tb_entries', 'ramataviv_tb_archive',
    -- hanhala-ruchanit — מקורות `kind:'table'` של (שלב א).
    -- ⚠️ נוספו **באותו שינוי** שהוסיף אותם ל-`BK_CFG.sources()`: מפתח גיבוי
    -- שאינו כאן אינו מתפנה לעולם, וזה בדיוק ההיסט.
    --    `test_round35c_cron.mjs` גוזר את הרשימה מהקוד ואוכף שקילות דו-כיוונית.
    'ys_sessions_rows', 'ys_marks_rows', 'ys_students_rows',
    -- hanhala-ruchanit — שכבת השורות של השינה, באותו כלל בדיוק.
    'ys_sleep_sessions_rows', 'ys_sleep_marks_rows'
  ]::text[];
$$;
