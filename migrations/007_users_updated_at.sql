-- ═══════════════════════════════════════════════════════════════════════════
-- 007 — `ys_users`: עמודת `updated_at` + טריגר
-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ נכתבה ולא הורצה (סבב 37) — «נכתב» אינו «רץ». ההרצה היא החלטת המנהל.
--
-- ⭐ מה שנמדד מול המסד החי ב-2026-08-18: ל-`ys_users` יש `active`
--    (boolean, default true) — ולכן `ysVerifyOffline` כבר חוסמת משתמש
--    מושבת — **אבל אין לה `updated_at`**. המשמעות: להתנגשות על שורת משתמש
--    אין שובר-שוויון דטרמיניסטי, ושני מכשירים שערכו את אותו משתמש מגיעים
--    לתוצאות שונות בלי שאיש יידע.
--
-- ⚠️ **`deleted` אינה נוספת כאן, ובכוונה.** בארגון מחיקת משתמש היא
--    `active=false` ולא tombstone — כך ב-`g_users` (כלל קריטי 4 ב-gius:
--    «משתמשים הם החריג… `active` הוא המחיקה הרכה שלהם»), וכך גם כאן.
--    עמודה שנייה לאותו מושג הייתה יוצרת שני מקורות אמת למצב של משתמש.
-- ⛔ אין כאן `INSERT` ואין נגיעה בנתונים (כלל ברזל 10 סעיף 7) — מבנה בלבד,
--    וה-`UPDATE` היחיד ממלא עמודה שזה עתה נוספה.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ys_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table public.ys_users
  add column if not exists updated_at timestamptz;
update public.ys_users set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.ys_users alter column updated_at set default now();
alter table public.ys_users alter column updated_at set not null;

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
--  where table_schema='public' and table_name='ys_users' and column_name='updated_at';
-- מצופה: updated_at timestamptz NO now()
--
-- select tgname from pg_trigger
--  where tgrelid='public.ys_users'::regclass and not tgisinternal;
-- מצופה: ys_users_touch
