-- ============================================================================
-- 036_rename_shared_tables_to_sh.sql — תחילית המשותף לטבלת הגיבוי וליומן הפעולות
-- ============================================================================
--
-- ⛔ **רצה במסד** — ⚠️ הוחלה בסבב 144 ואומתה: ספירת השורות זהה למה שהיה,
--    ⛔ ואפס שמות ישנים ב-`pg_class` ובגוף שתי הפונקציות.
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסב את `kv_backup` ל-`sh_backup` ואת
--    `sync_log` ל-`sh_sync_log`, ⭐ וכותב מחדש את שתי הפונקציות
--    שנוקבות בהן בשמן.
--
-- ⛔⛔ **הנימוק:** ⚠️ שתי הטבלאות משרתות את כל האפליקציות שבפרויקט —
--    ⭐ ותחילית `kv_` היא תחילית של מנגנון ולא של בעלים: ⛔ והיא נראתה
--    כשייכת ליומן, שהוא היחיד שטבלאות המפתח-ערך שלו נשאו אותה.
--
-- ⛔⛔ **וגוף `plpgsql` הוא טקסט** — ⚠️ הסבת שם טבלה אינה נוגעת בו:
--    ⭐ `bk_prune_layer` ו-`bk_retention_sweep` נוקבות בשתי הטבלאות,
--    ⛔ ובלי הכתיבה מחדש הפינוי הלילי נופל ב-03:00 — ⚠️ והגיבוי מפסיק
--    להתפנות בשקט, בדיוק הכשל שהמנגנון הזה נבנה כדי למנוע.
--
-- ⛔ **ועבודות ה-`cron` אינן משתנות** — ⚠️ הן קוראות לפונקציות בשמן,
--    ⭐ והשמות לא זזו.
--
-- ⛔ **אידמפוטנטי** — ⚠️ ההסבה רצה רק אם השם הישן עדיין קיים,
--    ⭐ ו-`create or replace` אינו תלוי במצב.
--
-- ============================================================================

do $$
begin
  if to_regclass('public.kv_backup') is not null
     and to_regclass('public.sh_backup') is null then
    alter table public.kv_backup rename to sh_backup;
  end if;
  if to_regclass('public.sync_log') is not null
     and to_regclass('public.sh_sync_log') is null then
    alter table public.sync_log rename to sh_sync_log;
  end if;
end $$;

-- ⛔ שתי הפונקציות נכתבות מחדש — ⚠️ גוף `plpgsql` הוא טקסט, ⭐ והסבת שם
--    הטבלה אינה נוגעת בו: ⛔ בלי הכתיבה מחדש הפינוי הלילי נופל ב-03:00,
--    ⚠️ והגיבוי מפסיק להתפנות בשקט.

create or replace function public.bk_prune_layer(p_prefix text, p_keep integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      from public.sh_backup
     where key like p_prefix || '%'
  )
  delete from public.sh_backup b
   using ranked r
   where b.id = r.id and r.rn > p_keep;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    insert into public.sh_sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_deleted,
            jsonb_build_object('layer', p_prefix, 'keep', p_keep));
  end if;
  return v_deleted;
end;
$function$;

create or replace function public.bk_retention_sweep(p_days integer default 30, p_keep integer default 7, p_manual_days integer default 14)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_keys   text[] := public.bk_retention_keys();
  v_age    integer := 0;
  v_cap    integer := 0;
  v_manual integer := 0;
begin
  if v_keys is null or cardinality(v_keys) = 0 then
    raise exception 'bk_retention_sweep: רשימת-ההיתר ריקה — מסרב לרוץ';
  end if;
  if exists (select 1 from unnest(v_keys) k
              where k like 'PRE\_%' or k like 'ORPHAN\_%' or k like 'pre-delete-%') then
    raise exception 'bk_retention_sweep: רשימת-ההיתר מכילה מפתח מוגן — מסרב לרוץ';
  end if;
  if p_days is null or p_days < 7 then
    raise exception 'bk_retention_sweep: חלון קצר מ-7 ימים — מסרב לרוץ';
  end if;
  if p_keep is null or p_keep < 1 then
    raise exception 'bk_retention_sweep: תקרת עותקים קטנה מ-1 — מסרב לרוץ';
  end if;
  if p_manual_days is null or p_manual_days < 7 then
    raise exception 'bk_retention_sweep: חלון ידני קצר מ-7 ימים — מסרב לרוץ';
  end if;

  delete from public.sh_backup
   where key = any (v_keys)
     and created_at < now() - make_interval(days => p_days);
  get diagnostics v_age = row_count;

  with ranked as (
    select id,
           row_number() over (partition by key
                              order by created_at desc, id desc) as rn
      from public.sh_backup
     where key = any (v_keys)
  )
  delete from public.sh_backup b
   using ranked r
   where b.id = r.id
     and r.rn > p_keep;
  get diagnostics v_cap = row_count;

  delete from public.sh_backup
   where key like 'pre-%'
     and created_at < now() - make_interval(days => p_manual_days);
  get diagnostics v_manual = row_count;

  if (v_age + v_cap + v_manual) > 0 then
    insert into public.sh_sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_age + v_cap + v_manual,
            jsonb_build_object('days', p_days, 'keep', p_keep, 'manual_days', p_manual_days,
                               'keys', cardinality(v_keys), 'aged', v_age,
                               'capped', v_cap, 'manual', v_manual));
  end if;

  return v_age + v_cap + v_manual;
end;
$function$;
