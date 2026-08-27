-- ============================================================================
-- 014_backup_allowlist_drop_wa_phone.sql — גריעת `tb_wa_phone` מרשימת-ההיתר
-- (סבב 65) · הפרויקט המשותף `kxbtskqobynewvnckaaz`
-- ============================================================================
-- ⛔ **הקובץ הזה לא הורץ.** הוא נכתב בסבב 65 ונמסר להרצה ידנית ע"י המנהל
--    (ר' «גישת Supabase» ב-CLAUDE.md). ⛔ אין להריץ אותו מתוך סשן.
--
-- ⭐ **מה משתנה, ולמה מיגרציה חדשה ולא עריכה של 004** — מיגרציה שכבר רצה
--    אינה נערכת לעולם: המסד כבר החיל אותה, ועריכה שלה יוצרת מצב שבו הקובץ
--    שבריפו מתאר משהו אחר ממה שרץ בפועל. ⛔ שינוי מבני נעשה בקובץ הבא בתור.
--
-- ⚠️ **המדידה שהתירה את הגריעה (סבב 65):** מפתח המקור `tb_wa_phone` **אינו
--    קיים עוד** באף אחד משני המוסדות, ⛔ ואפס שורות גיבוי יושבות תחת
--    `rishon_tb_wa_phone` או `ramataviv_tb_wa_phone` ב-`kv_backup`. כלומר
--    אין מה לפנות, ואין מה להגן עליו.
--
-- ⛔ **וההשלכה נרשמת במפורש** (כלל ברזל 20): מפתח שאינו ברשימת-ההיתר **אינו
--    מתפנה לעולם**. הגריעה כאן בטוחה **רק** מפני שאין מקור שממשיך לכתוב
--    תחת השם הזה — ⛔ ואם ייווצר מקור כזה בעתיד, השם חוזר לרשימה **באותו
--    סבב** שמוסיף אותו ל-`BK_CFG.sources()`, בדיוק כפי שקבעה השלמת סבב 35ג.
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
    -- yoman-avoda — שמות גיבוי השגרה שיצאו משימוש בסבב 35 (ר' הנימוק למעלה)
    'rishon_tb_entries', 'rishon_tb_archive',
    'ramataviv_tb_entries', 'ramataviv_tb_archive',
    -- hanhala-ruchanit — מקורות `kind:'table'` של סבב 36 (שלב א).
    -- ⚠️ נוספו **באותו סבב** שהוסיף אותם ל-`BK_CFG.sources()`: מפתח גיבוי
    --    שאינו כאן אינו מתפנה לעולם, וזה בדיוק ההיסט שנמדד בהשלמת סבב 35ג.
    --    `test_round35c_cron.mjs` גוזר את הרשימה מהקוד ואוכף שקילות דו-כיוונית.
    'ys_sessions_rows', 'ys_marks_rows', 'ys_students_rows',
    -- hanhala-ruchanit — שכבת השורות של השינה (סבב 39), באותו כלל בדיוק.
    'ys_sleep_sessions_rows', 'ys_sleep_marks_rows'
  ]::text[];
$$;
