-- ============================================================================
-- 038_backup_policy_names_from_table.sql — שם המדיניות נגזר מהטבלה
-- ============================================================================
--
-- ⛔ **רצה במסד** — ⚠️ הוחלה בסבב 148 ואומתה: ⭐ אפס מדיניות בשם `kv_backup_*`
--    ב-`sh_backup`, ⛔ ושתי המדיניות נושאות את שם הטבלה החיה.
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסב את שתי המדיניות של `sh_backup` בפרויקט
--    המשותף — `alter policy … rename to`: ⭐ אפס שינוי בזכות, ⛔ אפס
--    `drop policy`, ⚠️ ואפס שינוי נתונים.
--
-- ⛔⛔ **הנימוק:** ⚠️ `kv_backup` הוא **מימוש שירד** — הטבלה הוסבה
--    ל-`sh_backup`, ⭐ והמדיניות נשארה עם שמה הישן: ⛔ שם שמתאר מה שאינו
--    הוא הערה שמתארת מצב שחלף, ⚠️ בלבוש של מדיניות — ⭐ ומי שמחפש את
--    המדיניות של `sh_backup` אינו מוצא אותה.
--    ⛔ **והשם החדש נגזר מתפקידה** — ⚠️ `<טבלה>_<פעולה>`, ⭐ בדיוק כמו
--    `sh_sync_log`: ⛔ ושם שאינו נגזר אינו ניתן לניחוש.
--
-- ⚠️ **ובעסקה אחת** — ⛔ שתי הסבות נפרדות הן רגע שבו אחת הוסבה והשנייה לא,
--    ⭐ ומי שקורא את הסכימה באותו רגע רואה שתי משפחות שמות.
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'sh_backup'
                and policyname = 'kv_backup_insert') then
    alter policy kv_backup_insert on public.sh_backup rename to sh_backup_insert;
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'sh_backup'
                and policyname = 'kv_backup_select') then
    alter policy kv_backup_select on public.sh_backup rename to sh_backup_select;
  end if;
end $$;

commit;
