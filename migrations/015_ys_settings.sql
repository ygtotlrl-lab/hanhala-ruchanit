-- ============================================================================
-- 015_ys_settings.sql — טבלת ההגדרות המובנית `ys_settings`
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ⭐ **מה משתנה:** ההגדרות עוברות ממפתחות `kv` לטבלה מובנית — ⛔ מפתח ראשי
--    `key`, ערך `value`, ו-`client_id` לזהות שנוצרת במכשיר.
--
-- ⚠️ **הדפוס זהה ל-`sl_settings` שבשכר לימוד, אות באות** — ⛔ שתי טבלאות
--    הגדרות בשני דפוסים היו שני מנועי מיזוג, ⭐ ומפתח המיזוג כאן הוא `key`
--    בדיוק כמו שם: ⛔ מיפתוח לפי `client_id` היה יוצר שתי שורות לאותה הגדרה.
--
-- ⛔ **ההרשאה היא `select, insert, update` בלבד** — ⚠️ אין `delete` ואין
--    `truncate`: ⭐ מחיקה במסלול הזה היא מחיקה רכה, ⛔ ואין נתיב פיזי אליה.
--
-- ⛔ **החותמת נקבעת בשרת** — ⚠️ טריגר `ys_settings_touch` דורס כל `updated_at`
--    שהגיע מהלקוח: ⭐ שעון מכשיר שנסחף היה קובע מי מנצח במיזוג.
-- ============================================================================

create table if not exists public.ys_settings (
  key text primary key, value text,
  updated_at timestamptz not null default now(), client_id text );

grant select, insert, update on public.ys_settings to anon, authenticated;

alter table public.ys_settings enable row level security;
drop policy if exists ys_settings_all on public.ys_settings;
create policy ys_settings_all on public.ys_settings
  for all to anon, authenticated using (true) with check (true);

create or replace function public.ys_touch_updated_at()
  returns trigger language plpgsql as $$
  begin new.updated_at := now(); return new; end $$;

drop trigger if exists ys_settings_touch on public.ys_settings;
create trigger ys_settings_touch before update on public.ys_settings
  for each row execute function public.ys_touch_updated_at();
