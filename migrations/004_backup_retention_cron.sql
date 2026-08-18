-- ============================================================================
-- 004_backup_retention_cron.sql — פינוי אוטומטי ל-kv_backup דרך pg_cron
-- (סבב 35ג) · הפרויקט המשותף `kxbtskqobynewvnckaaz`
-- ============================================================================
-- ⛔ **הקובץ הזה לא הורץ.** הוא נכתב בסבב 35ג ונמסר להרצה ידנית ע"י המנהל
--    (ר' «גישת Supabase» ב-CLAUDE.md — שינוי סכימה דרך `apply_migration`,
--    ומחיקת נתונים באישור מפורש). ⛔ אין להריץ אותו מתוך סשן.
--
-- ⭐ **למה במסד ולא בקוד** (סבב 35ג): מדיניות השמירה נכתבה למודול הגיבוי
--    בהשלמת סבב 35 והיא **דרוכה אך אינה יכולה לרוץ** — ל-`kv_backup` יש
--    `insert`+`select` בלבד לשני התפקידים (כלל ברזל 10 סעיף 9), ו⛔ אין
--    לפתוח לה `delete` ל-`anon`: זה היה נותן לכל מי שמחזיק את המפתח הגלוי
--    שב-`index.html` דרך למחוק גיבויים. המשימה המתוזמנת רצה **בתוך המסד**,
--    בהרשאות פנימיות, ואינה נוגעת בהרשאות האפליקציה.
--
-- ⚠️ **שתי השכבות מכוונות, ואינן כפילות** (סבב 35ג): המסד מפנה, והלקוח
--    **לא יכול ולא צריך**. `_bkRetention` שבמודול המשותף נשארת כפי שהיא —
--    שכבה שנכשלת-סגור: היא מנסה, מקבלת דחייה מהמסד, ומדלגת בשקט בלי להפיל
--    את הגיבוי. ⛔ אין להסיר אותה מהקוד (סבב 35ג) — היא מה שיפעל אם ביום
--    מן הימים תוענק הרשאה סקופית, והיא גם מה שהבדיקות אוכפות.
--
-- ⛔ אידמפוטנטי לחלוטין: `create extension if not exists`,
--    `create or replace function`, ו-`unschedule` לפני `schedule` מחדש.
--    אין כאן `insert`/`update` על נתוני אפליקציה.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. התוסף
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. רשימת-ההיתר — מפתחות הגיבוי היומי, במפורש
-- ────────────────────────────────────────────────────────────────────────────
-- ⛔⛔ **רשימת-היתר מפורשת ולא קידומת** (סבב 35ג) — זו הנקודה המסוכנת
--     בקובץ. קידומת (`like 'ys\_%'`, ובוודאי קידומת ריקה) הייתה תופסת גם
--     גיבויים חד-פעמיים וגם מפתחות של אפליקציה אחרת שחיה באותו פרויקט.
--     הרשימה כאן היא **אותה רשימה מבנית שבמודול** — `BK_CFG.sources()` של
--     שלוש האפליקציות שחולקות את הפרויקט הזה, בתוספת הקידומת הפר-מוסדית
--     של yoman-avoda:
--       · hanhala-ruchanit — 14 מפתחות `kv`, בלי קידומת
--       · schar-limud      — ארבע טבלאות, בלי קידומת
--       · yoman-avoda      — חמישה מקורות × שני מוסדות (`rishon_`/`ramataviv_`),
--                            ועוד שני שמות שיצאו משימוש × שני מוסדות
--
-- ⛔ **מפתח שאינו ברשימה אינו נמחק לעולם** — וזה כולל, במפורש:
--    `PRE_SYNC_UNIFY_*` · `PRE_ROUND3B_*` · `ORPHAN_*` · `pre-delete-*`.
--
-- ⭐ **ארבעת שמות הגיבוי היומי שיצאו משימוש נכללים כן ברשימה** (השלמת
--    סבב 35ג, בהחלטת המנהל): `rishon_tb_entries` · `rishon_tb_archive` ·
--    `ramataviv_tb_entries` · `ramataviv_tb_archive`. אלה שמות **גיבוי
--    השגרה** שרצו עד סבב 35, לפני שהיומן והארכיון עברו לגיבוי-טבלאות
--    (`*_tb_entries_rows`). ⚠️ נמדד מול המסד: 23 שורות שגרה שהרשימה
--    הראשונה החמיצה, ולכן לא היו מתפנות לעולם — היסט **שמות**, ולא
--    היסטוריה שיש להגן עליה. ⛔ וההוספה היא ארבעה שמות מפורשים ולא
--    קידומת (השלמת סבב 35ג) — `like 'rishon\_%'` היה תופס גם את
--    גיבויי ה-`PRE_*` הפר-מוסדיים.
create or replace function public.bk_retention_keys()
returns text[]
language sql
immutable
as $$
  select array[
    -- hanhala-ruchanit
    'ys_students', 'ys_attend', 'ys_attend_sessions', 'ys_attend_cfg',
    'ys_attend_treats', 'ys_sleep_sessions', 'ys_sleep_cfg', 'ys_sleep_treats',
    'ys_reasons', 'ys_absence_reasons', 'ys_approvals', 'ys_perms',
    'ys_cls_years', 'ys_settings_meta',
    -- schar-limud
    'sl_students', 'sl_transactions', 'sl_settings', 'sl_lists',
    -- yoman-avoda — ראשון לציון
    'rishon_tb_entries_rows', 'rishon_tb_cats', 'rishon_tb_subs',
    'rishon_tb_subs_meta', 'rishon_tb_wa_phone',
    -- yoman-avoda — רמת אביב
    'ramataviv_tb_entries_rows', 'ramataviv_tb_cats', 'ramataviv_tb_subs',
    'ramataviv_tb_subs_meta', 'ramataviv_tb_wa_phone',
    -- yoman-avoda — שמות גיבוי השגרה שיצאו משימוש בסבב 35 (ר' הנימוק למעלה)
    'rishon_tb_entries', 'rishon_tb_archive',
    'ramataviv_tb_entries', 'ramataviv_tb_archive'
  ]::text[];
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. הגריעה עצמה — 30 יום, רשימת-היתר, ובדיקות שפיות שמסרבות לרוץ
-- ────────────────────────────────────────────────────────────────────────────
-- ⛔ **שתי בדיקות שפיות שמסרבות לרוץ** (סבב 35ג) — פונקציה שמוחקת נתוני
--    גיבוי חייבת להיכשל ברעש ולא למחוק «לפי מה שיש»:
--      א. רשימת-היתר ריקה או `null` ⇒ `raise exception`. בלי הבדיקה הזו,
--         שגיאה עתידית שמרוקנת את הרשימה הייתה הופכת את התנאי
--         `key = any('{}')` ל-«אף שורה», וזה נראה תמים — אבל מוטציה שהופכת
--         את התנאי או מסירה אותו הייתה מוחקת **הכול**.
--      ב. מפתח מוגן שנכנס לרשימה בטעות ⇒ `raise exception`. הגנה כפולה על
--         `PRE_*`/`ORPHAN_*`: גם אם מישהו יוסיף אותם לרשימה, הפונקציה
--         מסרבת במקום למחוק את נקודות החזרה שאין להן עותק אחר.
-- ⚠️ `security definer` — הפונקציה רצה בהרשאות הבעלים כדי שתוכל למחוק
--    מטבלה שלשני התפקידים אין בה `delete`. ⛔ ולכן סעיף 5 מסיר ממנה את
--    הרשאת ההרצה מ-`anon`/`authenticated` — בלעדיו היא הייתה נתיב מחיקה
--    זמין דרך RPC של PostgREST, כלומר בדיוק החור שהיא באה לעקוף.
create or replace function public.bk_retention_sweep(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys    text[] := public.bk_retention_keys();
  v_deleted integer := 0;
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

  delete from public.kv_backup
   where key = any (v_keys)
     and created_at < now() - make_interval(days => p_days);
  get diagnostics v_deleted = row_count;

  -- רישום ליומן הראיות — רק כשנמחק משהו בפועל (זהה להתנהגות המודול בקוד).
  if v_deleted > 0 then
    insert into public.sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_deleted,
            jsonb_build_object('days', p_days, 'keys', cardinality(v_keys)));
  end if;

  return v_deleted;
end;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. התזמון — יומי, בשעה שאינה מתנגשת עם הגיבוי
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ 03:17 UTC בכוונה (סבב 35ג): הדגל היומי של הגיבוי הוא תאריך **UTC**
--    (`toISOString().slice(0,10)`), ולכן חצות UTC היא הרגע שבו כל המכשירים
--    מתחילים לגבות. שעה שלוש ורבע לפנות בוקר רחוקה מהגל הזה, ומכל מקום
--    הגריעה נוגעת רק בשורות בנות 30+ יום ולעולם לא בעותק שנכתב היום.
-- ⛔ `unschedule` לפני `schedule` (סבב 35ג) — `cron.schedule` על שם קיים
--    מעדכן, אבל הסרה מפורשת היא מה שהופך את הקובץ לאידמפוטנטי גם כשהשעה
--    או הפקודה משתנות, ומונע שתי משימות שמריצות את אותה גריעה פעמיים.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bk_retention_daily') then
    perform cron.unschedule('bk_retention_daily');
  end if;
end;
$$;

select cron.schedule(
  'bk_retention_daily',
  '17 3 * * *',
  $$select public.bk_retention_sweep(30);$$
);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. הרשאות — ⛔ הפונקציה אינה נגישה לאפליקציה
-- ────────────────────────────────────────────────────────────────────────────
-- ⛔ **בלי הסעיף הזה המיגרציה פותחת בדיוק את מה שהיא באה לסגור** (סבב 35ג):
--    כל פונקציה ב-`public` נגישה כ-RPC דרך PostgREST, ופונקציית
--    `security definer` שנגישה ל-`anon` היא נתיב מחיקה לכל מי שמחזיק את
--    המפתח הגלוי. ההרצה שמורה ל-`cron` (שרץ כבעלים) ול-`service_role`.
revoke all on function public.bk_retention_keys()          from public, anon, authenticated;
revoke all on function public.bk_retention_sweep(integer)   from public, anon, authenticated;
grant execute on function public.bk_retention_keys()        to service_role;
grant execute on function public.bk_retention_sweep(integer) to service_role;

-- ⛔ ו-`kv_backup` עצמה נשארת `insert`+`select` בלבד לשני התפקידים
--    (כלל ברזל 10 סעיף 9) — הקובץ הזה **אינו** מעניק לה `delete`, וזו כל
--    הנקודה: המחיקה קורית בתוך המסד, לא מהדפדפן.
