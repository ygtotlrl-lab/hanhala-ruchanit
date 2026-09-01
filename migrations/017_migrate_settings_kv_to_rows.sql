-- ============================================================================
-- 017_migrate_settings_kv_to_rows.sql — עשרת מפתחות ההגדרות עוברים לטבלה
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ⛔⛔ **תנאי מוקדם, ואין לעקוף אותו:** `015` רצה — ⚠️ בלי `ys_settings`
--     ה-`INSERT` שכאן ייפול, וזה הרצוי.
--
-- ⭐ **מה משתנה:** עשרה מפתחות הגדרות עוברים מ-`kv` לטבלה המובנית.
--    ⚠️ הרשימה **שמית ולא קידומת** — ⛔ `ys_%` היה תופס גם את
--    `ys_attend_sessions`, `ys_sleep_sessions` ו-`ys_students`, ⭐ שהם
--    נתונים ולא הגדרות ⛔ ובתיהם הם הטבלאות המובנות.
--
-- ⛔ **`do nothing` ולא `do update`** — ⚠️ מרגע שהאפליקציה כותבת לטבלה,
--    השורה שם עשויה להיות **חדשה יותר** מזו שב-`kv`: ⛔ `do update` היה
--    דורס אותה בערך ישן יותר, ⭐ כלומר מחזיר הגדרות אחורה בשקט.
--    ⛔ אין להחליף ל-`do update` בשום מצב.
--
-- ⛔ **והחותמת עוברת כמות שהיא** — ⚠️ `now()` היה מסמן עשר הגדרות ישנות
--    כטריות ביותר, ⛔ והמיזוג היה מעדיף אותן על עריכה אמיתית שקדמה להן.
--
-- ⚠️ **המפתחות נשארים ב-`kv`, וזו החלטה** — ⛔ מחיקתם היא פעולת מנהל
--    ובקובץ נפרד: ⭐ כל עוד גרסה ישנה מותקנת במכשיר כלשהו היא עדיין
--    קוראת משם, ⛔ ומחיקה כאן הייתה מרוקנת לו את המסך.
--
-- ⛔ **אידמפוטנטי** — `on conflict do nothing`, ⚠️ והרצה חוזרת היא no-op גמור.
-- ============================================================================

insert into public.ys_settings (key, value, updated_at)
select key, value, updated_at
  from public.kv
 where key in ('ys_perms','ys_attend_cfg','ys_sleep_cfg',
   'ys_reasons','ys_absence_reasons','ys_cls_years','ys_approvals',
   'ys_attend_treats','ys_settings_meta','ys_last_changed')
on conflict (key) do nothing;


-- ============================================================================
-- ⭐ בדיקת שקילות — שני הכיוונים. ⛔ תנאי למעבר.
-- ============================================================================
-- ⚠️ שקילות **חד-כיוונית אינה שקילות**: «כל מפתח בטבלה קיים ב-`kv`»
--    מתקיים גם כשלא עבר אף מפתח.
do $$
declare miss bigint; diff bigint;
begin
  select count(*) into miss
    from public.kv k
   where k.key in ('ys_perms','ys_attend_cfg','ys_sleep_cfg',
     'ys_reasons','ys_absence_reasons','ys_cls_years','ys_approvals',
     'ys_attend_treats','ys_settings_meta','ys_last_changed')
     and not exists (select 1 from public.ys_settings s where s.key = k.key);
  if miss > 0 then
    raise exception '⛔ % מפתחות לא עברו — לעצור ולהבין מי הם', miss;
  end if;

  -- ⚠️ ערך שנחתך או שהומר בדרך אינו נראה בספירה — ⛔ ולכן הוא נבדק בערך עצמו.
  select count(*) into diff
    from public.kv k
    join public.ys_settings s on s.key = k.key
   where k.key in ('ys_perms','ys_attend_cfg','ys_sleep_cfg',
     'ys_reasons','ys_absence_reasons','ys_cls_years','ys_approvals',
     'ys_attend_treats','ys_settings_meta','ys_last_changed')
     and s.value::text is distinct from k.value::text;
  if diff > 0 then
    raise exception '⛔ % מפתחות עברו בערך שונה — לעצור ולהבין מה השתנה', diff;
  end if;
end $$;
