-- ═══════════════════════════════════════════════════════════════════════════
-- 007 — `ys_users`: `updated_at` (+ טריגר) ו-`deleted`
-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ נכתבה ולא הורצה (סבב 37) — «נכתב» אינו «רץ». ההרצה היא החלטת המנהל.
--
-- ⭐ **הדפוס נקבע ב-2026-08-18** כשהמנהל הריץ את
--    `schar_013_users_active_updated_deleted` בפרויקט המשותף: טבלת משתמשים
--    בארגון נושאת `active` · `updated_at` · `deleted`. הקובץ הזה מיישר את
--    `ys_users` לאותו דפוס.
--
-- מה שנמדד כאן מול המסד החי ב-2026-08-18:
--   קיים:  id · username · password_hash · full_name · role · active ·
--          created_at · pass_salt · pass_fp
--   חסר:   updated_at · deleted    ·    טריגרים על הטבלה: **אפס**
--
-- ⚠️ **`active` כבר קיימת** (boolean, default true), ולכן `ysVerifyOffline`
--    כבר חוסמת משתמש מושבת מאז סבב 22 — ⛔ אין כאן את הפרצה שנסגרה
--    ב-schar-limud, ואין לגעת בעמודה.
-- ⚠️ **הטריגר כן נכלל כאן, בניגוד ל-`sl_users`** — ולא «לשם אחידות»: כאן
--    האפליקציה עצמה כותבת שורות משתמש (`saveUser`, `changeMyPassword`),
--    ו-`g_users` ב-gius נושאת `g_users_touch` על אותה סיבה בדיוק. ב-schar
--    המשתמשים מנוהלים מלוח הבקרה בלבד, ושם ההחלטה שרצה בפועל לא כללה
--    טריגר.
-- ⛔ אין כאן `INSERT` ואין נגיעה בנתונים (כלל ברזל 10 סעיף 7) — מבנה
--    בלבד, וה-`UPDATE`-ים היחידים ממלאים עמודות שזה עתה נוספו.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ys_users add column if not exists updated_at timestamptz;
update public.ys_users set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.ys_users alter column updated_at set default now();
alter table public.ys_users alter column updated_at set not null;

alter table public.ys_users add column if not exists deleted boolean;
update public.ys_users set deleted = false where deleted is null;
alter table public.ys_users alter column deleted set default false;
alter table public.ys_users alter column deleted set not null;

create or replace function public.ys_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ys_users_touch on public.ys_users;
create trigger ys_users_touch
  before update on public.ys_users
  for each row execute function public.ys_touch_updated_at();

-- ---------- הרשאות ----------
-- ⛔ REVOKE לפני GRANT, ואין לקצר (כלל ברזל 10 סעיף 9) — GRANT הוא אדיטיבי
--    ואינו מסיר את ה-DELETE/TRUNCATE שהטבלה נולדה איתם.
revoke all on public.ys_users from anon, authenticated;
grant select, insert, update on public.ys_users to anon, authenticated;

-- ---------- אימות ----------
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='ys_users'
--    and column_name in ('updated_at','deleted');
-- מצופה: updated_at timestamptz NO now() · deleted boolean NO false
--
-- select tgname from pg_trigger
--  where tgrelid='public.ys_users'::regclass and not tgisinternal;
-- מצופה: ys_users_touch
