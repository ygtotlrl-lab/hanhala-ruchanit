-- ============================================================================
-- 007_users_updated_at_touch.sql — `ys_users`: `updated_at` וטריגר החותמת
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ⛔ **`deleted` אינה כאן, ולא תחזור — היא נוספה ל-`sl_users` ואז
--    הוסרה, ולכאן היא מעולם לא הגיעה.** ההשבתה בארגון היא `active=false`
--    (כלל קריטי 4 ב-gius), ועמודה שנייה שמתארת «המשתמש הוסר» היא מקור
--    אמת שני. ⛔ אין להחזיר אותה לקובץ הזה, ל-`000_initial_schema.sql`
-- או לתיעוד. נבדק: `ys_users` **אינה מחזיקה** `deleted`.
--
-- מה שהמיגרציה מבטיחה, **אחרי ההרצה**:
--   id · username · password_hash · full_name · role · active · created_at ·
--   pass_salt · pass_fp · **updated_at** (timestamptz, not null, default now())
--   טריגר: **ys_users_touch** → `users_touch_updated_at()`
--
-- ⚠️ **`active` כבר הייתה קיימת** (boolean, default true), ולכן
-- `ysVerifyOffline` חוסמת משתמש מושבת — ⛔ אין כאן את
--    הפרצה שנסגרה ב-schar-limud, ואין לגעת בעמודה.
-- ⭐ **שלוש טבלאות המשתמשים בארגון זהות מעכשיו:** `active` · `updated_at` ·
--    טריגר חותמת · **בלי `deleted`**. `g_users` ב-gius הייתה הדפוס (היא
--    נשאה `g_users_touch` מלכתחילה).
-- ⛔ אין כאן `INSERT` ואין נגיעה בנתונים (כלל ברזל 10 סעיף 7) — מבנה
--    בלבד, וה-`UPDATE` היחיד ממלא עמודה שזה עתה נוספה.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ys_users add column if not exists updated_at timestamptz;
update public.ys_users set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.ys_users alter column updated_at set default now();
alter table public.ys_users alter column updated_at set not null;

-- ---------- טריגר החותמת ----------
-- ⚠️ **`public.users_touch_updated_at()` היא פונקציה אחת לשתי טבלאות
--    המשתמשים שבפרויקט המשותף** (`ys_users` כאן ו-`sl_users` בשכר לימוד) —
-- זו שהמנהל יצר, והיא מוגדרת באותו נוסח בדיוק גם
--    ב-`schar-limud/migrations/013`. ⛔ אין לגזור ממנה שם פר-אפליקציה
-- (`ys_touch_…`) — שתי הגדרות לאותה פונקציה בפרויקט אחד הן
-- גרסה שנייה שאיש אינו יודע עליה.
-- ⚠️ הטריגר נדרש כאן במיוחד מפני ש**האפליקציה עצמה כותבת שורות משתמש**
--    (`saveUser`, `changeMyPassword`), ובלעדיו החותמת נקבעת ב-INSERT
--    ואינה מתעדכנת ב-UPDATE.
create or replace function public.users_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ys_users_touch on public.ys_users;
create trigger ys_users_touch
  before update on public.ys_users
  for each row execute function public.users_touch_updated_at();

-- ---------- הרשאות ----------
-- ⛔ REVOKE לפני GRANT, ואין לקצר (כלל ברזל 10 סעיף 9) — GRANT הוא אדיטיבי
--    ואינו מסיר את ה-DELETE/TRUNCATE שהטבלה נולדה איתם.
revoke all on public.ys_users from anon, authenticated;
grant select, insert, update on public.ys_users to anon, authenticated;

-- ---------- אימות ------------------------------
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='ys_users';
-- התקבל: updated_at timestamptz NO now() · ⚠️ **אין `deleted`**
--
-- select trigger_name, action_statement from information_schema.triggers
--  where trigger_schema='public' and event_object_table='ys_users';
-- התקבל: ys_users_touch → EXECUTE FUNCTION users_touch_updated_at()
