-- ============================================================================
-- 025_backup_anchor_diff_retention.sql — שכבות העוגן והדיפרנציאלי בפינוי
-- ============================================================================
--
-- ⛔ **נכתבה ולא רצה** — ⚠️ הרצה היא פעולת מנהל, ⛔ ואין כאן הוראה להריץ.
--
-- ⛔⛔ **הבעיה שנמדדה:** הגיבוי היומי קרא את הטבלה בבקשה **אחת** בלי עימוד,
--    ⚠️ ו-PostgREST מחזיר תקרה קבועה **בלי שגיאה**: ⭐ נמדד ב-2026-09-03 —
--    `ys_marks_rows` גובתה **1,000** שורות בעוד שבטבלה **18,085**, כלומר
--    94.5% מעולם לא גובו; ⛔ `ramataviv_tb_entries_rows` 1,000 מול 1,249;
--    ⚠️ ו-`ys_sleep_marks_rows` 988 — שתים-עשרה שורות מהתקרה.
--
-- ⭐ **המבנה שנבחר:** עוגן מלא אחת לשבוע (`ANCHOR:<מפתח>`) ודיפרנציאלי בכל
--    שאר הימים (`DIFF:<מפתח>`), ⛔ ושתי השכבות כפופות לפינוי הקיים.
--
-- ⛔ **ולכל שכבה תקרה משלה** — ⚠️ עוגן שבועי בן ארבעה עותקים הוא כיסוי של
--    חודש, ⭐ ודיף יומי בן 30 עותקים הוא אותו חודש בדיוק: ⛔ תקרה אחת
--    לשתיהן הייתה גורעת את העוגן הרבה לפני הדיפים שנשענים עליו.
--
-- ⚠️ **והאיסור על מחיקה אוטומטית של `PRE_*`/`ORPHAN_*` נשאר בתוקף** —
--    ⛔ הפונקציה מסרבת לרוץ אם מפתח מוגן נכנס לרשימה.
-- ============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- 1. גריעה לפי תבנית, עם תקרת עותקים לכל מפתח
-- ───────────────────────────────────────────────────────────────────────────
-- ⛔ תבנית ולא רשימה שמית — ⚠️ מפתחות העוגן והדיף נגזרים משמות המקורות,
--    ⭐ ומקור חדש מקבל אותן שתיים בלי שינוי במסד: ⛔ רשימה שמית הייתה
--    מחייבת מיגרציה בכל תוספת, ⚠️ ומפתח שאינו בה אינו מתפנה לעולם.
-- ⛔ והתקרה היא **מספר עותקים למפתח** ⛔ ולא גיל — ⚠️ עוגן שבועי בן חודש
--    הוא ארבעה עותקים, ⭐ וגריעה לפי גיל בלבד הייתה מוחקת את כולם בשבוע
--    שבו לא רץ גיבוי.
create or replace function public.bk_prune_layer(p_prefix text, p_keep integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_prefix is null or p_prefix not in ('ANCHOR:', 'DIFF:') then
    raise exception 'bk_prune_layer: תבנית שאינה מוכרת — %', p_prefix;
  end if;
  if p_keep is null or p_keep < 2 then
    raise exception 'bk_prune_layer: תקרה קטנה משניים — מסרב לרוץ';
  end if;

  with ranked as (
    select id, row_number() over (partition by key order by created_at desc) rn
      from public.kv_backup
     where key like p_prefix || '%'
  )
  delete from public.kv_backup b
   using ranked r
   where b.id = r.id and r.rn > p_keep;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_deleted,
            jsonb_build_object('layer', p_prefix, 'keep', p_keep));
  end if;

  return v_deleted;
end;
$$;

revoke all on function public.bk_prune_layer(text, integer) from public;
revoke all on function public.bk_prune_layer(text, integer) from anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. התזמון — אחרי הפינוי היומי הקיים
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ 03:10 UTC — עשר דקות אחרי `bk_retention_sweep`, ⛔ כדי ששתי הגריעות
--    לא ירוצו על אותה טבלה באותו רגע.
select cron.unschedule('bk_prune_layers') where exists
  (select 1 from cron.job where jobname = 'bk_prune_layers');
select cron.schedule('bk_prune_layers', '10 3 * * *',
  $cron$ select public.bk_prune_layer('ANCHOR:', 4), public.bk_prune_layer('DIFF:', 30); $cron$);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. שער שקילות — ⛔ נכשל ברעש במקום להשאיר מצב חלקי
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  if not exists (select 1 from pg_proc where proname = 'bk_prune_layer') then
    raise exception '025: bk_prune_layer אינה קיימת';
  end if;
  select count(*) into n from cron.job where jobname = 'bk_prune_layers';
  if n <> 1 then
    raise exception '025: נמדדו % משימות cron בשם bk_prune_layers והצפוי אחת', n;
  end if;
end $$;
