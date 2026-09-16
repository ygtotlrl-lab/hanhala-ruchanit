-- ============================================================================
-- 039_sync_log_policy_names_from_table.sql — שם המדיניות נגזר מהטבלה
-- ============================================================================
--
-- ⛔ **רצה במסד** — ⚠️ הוחלה בסבב 148 ואומתה: ⭐ אפס מדיניות בשם
--    `sync_log_*` ב-`sh_sync_log`, ⛔ ושתי המדיניות נושאות את שם הטבלה החיה.
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסב את שתי המדיניות של `sh_sync_log` —
--    `alter policy … rename to`: ⭐ אפס שינוי בזכות, ⛔ אפס `drop policy`,
--    ⚠️ ואפס שינוי נתונים.
--
-- ⛔⛔ **הנימוק:** ⚠️ `sync_log` הוא **שם שירד** — הטבלה הוסבה
--    ל-`sh_sync_log`, ⭐ והמדיניות נגררה איתה בשמה הישן: ⛔ `alter table
--    … rename` אינו נוגע בשם המדיניות, ⚠️ ולכן הסבה שנראתה שלמה השאירה
--    משפחת שמות שנייה — ⭐ **ונמדד במסד**, ⛔ ולא שוער: `sh_backup` נושאת
--    `sh_backup_insert`/`_select`, ⚠️ ו-`sh_sync_log` נשאה `sync_log_*`.
--    ⛔ **והסבב שסגר את `sh_backup` הצהיר «בדיוק כמו `sh_sync_log`»** —
--    ⚠️ הצהרה שלא נמדדה, ⭐ והיא שהותירה את הפער.
--
-- ⚠️ **ובעסקה אחת** — ⛔ שתי הסבות נפרדות הן רגע שבו אחת הוסבה והשנייה לא,
--    ⭐ ומי שקורא את הסכימה באותו רגע רואה שתי משפחות שמות.
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'sh_sync_log'
                and policyname = 'sync_log_insert') then
    alter policy sync_log_insert on public.sh_sync_log rename to sh_sync_log_insert;
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'sh_sync_log'
                and policyname = 'sync_log_select') then
    alter policy sync_log_select on public.sh_sync_log rename to sh_sync_log_select;
  end if;
end $$;

commit;
