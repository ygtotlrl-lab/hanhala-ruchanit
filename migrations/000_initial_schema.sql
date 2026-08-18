-- ============================================================================
-- הנהלה רוחנית — קובץ ההתקנה המלא (סבב 28)
-- פרויקט Supabase: kxbtskqobynewvnckaaz
-- הרצה: Supabase SQL Editor →
--   https://supabase.com/dashboard/project/kxbtskqobynewvnckaaz/sql
-- ============================================================================
--
-- ⭐ זהו **מקור האמת היחיד לסכימה** של האפליקציה הזו (סבב 28). הרצתו על מסד
--    ריק נותנת התקנה עובדת; הרצה חוזרת על מסד קיים מתכנסת אליו בלי לגעת
--    בנתונים. עד סבב 28 לא היה כאן קובץ כזה כלל: `setup-db.html` הציג SQL
--    ל-`ys_users` בלבד — בלי `kv`, שהוא **מקור הנתונים היחיד** של האפליקציה,
--    ובלי `sync_log` ו-`kv_backup`. התקנה טרייה לפיו נתנה מסך כניסה ותו לא.
--
-- ⛔ אין ליצור עותק שני של הסכימה בשום קובץ אחר (כלל קריטי 6 + הלקח של
--    השלמת סבב 24 ב-schar-limud) — שני עותקים מתיישנים בשקט, וההתקנה
--    הטרייה היא בדיוק המקום שבו זה מתגלה מאוחר מדי. `setup-db.html` מפנה
--    לכאן ואינו מחזיק סכימה משלו.
--
-- ⚠️ אידמפוטנטיות אמיתית (כלל ברזל 10 סעיף 7, נלמד בסבב 27):
--    `create table if not exists` **מדלג על טבלה קיימת ועל כל מה שבתוכה** —
--    עמודה שנוספה אחרי ההתקנה הראשונה, אינדקס, פוליסה או אילוץ. לכן לכל
--    שינוי מבני שנעשה כאן מאז ההקמה יושבת בקובץ **גם** שורת התכנסות:
--    `add column if not exists` · `drop policy if exists` + `create policy` ·
--    `revoke`+`grant` מפורשים.
--    ⛔ ואין לגעת בנתונים — מבנה בלבד. אין בקובץ הזה אף `insert`, `update`
--    או `delete`.
--
-- ⛔ אין כאן משתמש, סיסמה או תפקיד — גם לא «לדוגמה» (כלל ברזל 8 סעיף 7,
--    כלל ברזל 10 סעיפים 3 ו-8). המשתמש הראשון נוצר ידנית; הפקודה עם מצייני
--    המקום יושבת בסוף הקובץ, מוערת.
--
-- ⚠️ מקור הנתונים של הקובץ: **מיפוי מלא מול המסד החי בסבב 28** —
--    `information_schema.columns`, `pg_indexes`, `pg_constraint`, `pg_policies`,
--    `information_schema.role_table_grants` ו-`information_schema.triggers`.
--    ⛔ הוא **לא** נכתב מתוך קריאת קוד האפליקציה. אי-ודאות שנותרה רשומה
--    במפורש בהערות «⚠️ טרם אומת» שלמטה, ואין אף אחת כזו שקטה.
--
-- ⚠️ הפרויקט הזה משותף עם schar-limud (טבלאות `sl_*`) ועם yoman-avoda
--    (`kv_rishon` / `kv_ramataviv`). הקובץ הזה יוצר **רק** את ארבע הטבלאות
--    של הנהלה רוחנית ואינו נוגע בהן.
--    ⚠️ `kv_backup` ו-`sync_log` נכתבות **גם** ע"י schar-limud באותו פרויקט.
--    בהתקנה על פרויקט חדש הן נוצרות כאן; בפרויקט המשותף הן כבר קיימות,
--    והקובץ מתכנס אליהן בלי לשנות אותן.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. kv — מקור הנתונים היחיד של האפליקציה
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ כל נתוני האפליקציה יושבים כאן כזוגות מפתח/ערך, כשהערך הוא JSON כמחרוזת:
--    `ys_students` · `ys_attend` · `ys_attend_sessions` · `ys_attend_cfg` ·
--    `ys_attend_treats` · `ys_sleep_sessions` · `ys_sleep_cfg` ·
--    `ys_sleep_treats` · `ys_reasons` · `ys_absence_reasons` · `ys_approvals` ·
--    `ys_perms` · `ys_cls_years` · `ys_settings_meta` · `ys_last_changed`.
--    ⛔ אין טבלאות `students`/`attendance` — הן נטושות מאז יולי 2026 ואין
--    להחזיר אליהן שאילתות (ר' «דוחות חודשיים» ב-CLAUDE.md).
-- ⚠️ אותה טבלה מכילה גם מפתחות `tb_*` — **שרידים של yoman-avoda** מלפני
--    המעבר ל-`kv_rishon`/`kv_ramataviv`. ⛔ אין למחוק אותם כאן: מחיקת נתונים
--    מחייבת אישור מפורש של המנהל, וקובץ התקנה אינו המקום לכך.
create table if not exists public.kv (
  key   text primary key,
  value text
);

alter table public.kv enable row level security;
drop policy if exists allow_all on public.kv;
create policy allow_all on public.kv using (true) with check (true);

-- ⚠️ ההרשאות של `anon` צומצמו בסבב 29, בהחלטת המנהל (`migrations/001`).
--    ⛔ **`revoke` לפני `grant`, ואין לקצר לשורת `grant` אחת:** פרויקט
--    Supabase סטנדרטי מגיע עם `alter default privileges … grant all`, ולכן
--    הטבלה **נולדת** עם `delete` ו-`truncate` ל-anon — ו-GRANT הוא אדיטיבי
--    בלבד ואינו מסיר אותם. השורה הזו היא גם שורת ההתכנסות להתקנה שנוצרה
--    לפני סבב 29.
-- ⛔ אין להחזיר ל-anon את `delete`/`truncate` (סבב 29) — האפליקציה אינה
--    מוחקת שורות `kv` בשום מסלול (כל כתיבה היא `upsert`, ומחיקה היא
--    tombstone בתוך הערך), ולכן ההרשאה מיותרת ורק פותחת ריקון של מקור
--    הנתונים היחיד למי שמחזיק את המפתח הציבורי.
revoke delete, truncate, references, trigger on public.kv from anon, authenticated;
grant select, insert, update on public.kv to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.kv to service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ys_users — משתמשי המערכת
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ `role` הוא `not null` **בלי `default`** (כלל ברזל 10 סעיף 1): יצירת
--    משתמש בלי תפקיד נכשלת במסד, וזו ההתנהגות הרצויה — תפקיד הוא החלטה ולא
--    ערך שנופל מאליו. שלושת הערכים כאן: `admin` / `senior` / `junior`.
--    ⛔ הם אינם משותפים עם schar-limud או gius ואין ליישר ביניהם.
-- ⚠️ `password_hash` הוא **שם מטעה משריד היסטורי** — הוא מחזיק את הסיסמה
--    עצמה בטקסט גלוי, בשש ספרות, ולא גיבוב. זו החלטה תפעולית מתועדת
--    (כלל ברזל 10 סעיף 4, ופרק «מודל הסיסמאות» ב-CLAUDE.md): המנהל מנהל
--    סיסמאות מתוך «ניהול משתמשים». ⛔ אין להסיק מהשם שיש כאן הצפנה, ואין
--    להגר את העמודה בלי החלטה מפורשת של המנהל.
-- ⚠️ `pass_salt`+`pass_fp` הן טביעת PBKDF2-SHA256 (100,000 סיבובים, מלח
--    אקראי פר-משתמש) — **מה שיורד למכשיר לכניסה אופליין**. ⛔ הסיסמה עצמה
--    לעולם אינה יורדת לדיסק (סבב 22).
create table if not exists public.ys_users (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  password_hash text not null,
  full_name     text not null,
  role          text not null,
  -- ⭐ `active` הוא המחיקה הרכה של משתמש. ⛔ אין כאן `deleted`, ואין להוסיף
  --    (סבב 37) — `active=false` הוא המנגנון בארגון כולו (כלל קריטי 4
  --    ב-gius), ועמודה שנייה לאותו מושג היא מקור אמת שני. העמודה נוספה
  --    ל-`sl_users` והוסרה באותו יום בהכרעת המנהל, ולכאן לא הגיעה כלל.
  active        boolean default true,
  created_at    timestamptz default now(),
  -- ⭐ `updated_at` — שובר-שוויון דטרמיניסטי להתנגשות על שורת משתמש
  --    (סבב 37, `migrations/007`). הטריגר `ys_users_touch` נוצר בהמשך הקובץ.
  updated_at    timestamptz not null default now(),
  pass_salt     text,
  pass_fp       text
);

-- שורות התכנסות להתקנה שנוצרה לפני סבב 22 (הטביעה) — ⛔ בלי הן, הרצה חוזרת
-- «רצה בהצלחה» ונשארת בלי כניסה אופליין, בשקט.
alter table public.ys_users add column if not exists pass_salt text;
-- שורת התכנסות ל-007 (סבב 37) — התקנה שנוצרה לפניה נשארת בלי חותמת עדכון.
alter table public.ys_users add column if not exists updated_at timestamptz;
update public.ys_users set updated_at = coalesce(created_at, now()) where updated_at is null;
alter table public.ys_users alter column updated_at set default now();
alter table public.ys_users alter column updated_at set not null;
alter table public.ys_users add column if not exists pass_fp   text;

-- אילוץ ה-`role` — ⛔ אין `add constraint if not exists` ב-Postgres, ולכן
-- הבדיקה היא ב-`do` block מול `pg_constraint`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ys_users'::regclass and conname = 'ys_users_role_check'
  ) then
    alter table public.ys_users
      add constraint ys_users_role_check check (role in ('admin','senior','junior'));
  end if;
end $$;

-- ⛔ שורת התכנסות: ל-`role` אין `default` באף התקנה (כלל ברזל 10 סעיף 1).
alter table public.ys_users alter column role drop default;

alter table public.ys_users enable row level security;
drop policy if exists allow_all on public.ys_users;
create policy allow_all on public.ys_users using (true) with check (true);

-- ⚠️ אותו דפוס כמו ב-`kv` שלמעלה, ומאותה סיבה — ר' ההסבר שם.
-- ⛔ אין להחזיר ל-anon את `delete`/`truncate` (סבב 29) — משתמש אינו נמחק
--    כאן לעולם; ההשבתה היא `active=false`, כלומר UPDATE.
revoke delete, truncate, references, trigger on public.ys_users from anon, authenticated;
grant select, insert, update on public.ys_users to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.ys_users to service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. sync_log — יומן אבחון סנכרון
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ יומן בלבד — האפליקציה כותבת אליו ואינה קוראת ממנו במסלול חי.
--    `insert` ו-`select` בלבד, ולכן **אין הרשאה לערוך או למחוק רישום קיים**.
--    זו הבחנה מכוונת מול `kv` שלמעלה, ששם `update` נחוץ ל-upsert.
create table if not exists public.sync_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz default now(),
  device_id    text,
  user_name    text,
  action       text,
  key          text,
  record_count integer,
  details      jsonb
);

alter table public.sync_log enable row level security;
-- ⚠️ שתי פוליסות נפרדות (`insert` ו-`select`) ולא אחת ל-ALL — כך נמדד במסד
--    החי. ⛔ `supabase-sync-log.sql` הישן הצהיר על פוליסה אחת בשם
--    `sync_log_anon`; היא **לא הייתה קיימת שם בפועל**, וזו בדיוק הסחיפה
--    השקטה שקובץ ההתקנה הזה בא לסגור. הקובץ ההוא **נמחק בסבב 33** — שתי
--    הטבלאות מוגדרות כאן לפי מיפוי מול המסד החי, ו-`drop policy if exists`
--    שלמטה מנקה גם את השם הישן בהתקנה שנוצרה לפיו.
drop policy if exists sync_log_anon   on public.sync_log;
drop policy if exists sync_log_insert on public.sync_log;
drop policy if exists sync_log_select on public.sync_log;
create policy sync_log_insert on public.sync_log for insert to anon with check (true);
create policy sync_log_select on public.sync_log for select to anon using (true);

-- ⛔ **יומן ראיות — `insert`+`select` בלבד, לשני התפקידים** (סבב 29, השלמה).
--    ⚠️ עד ההשלמה הזו העניק הקובץ ל-`authenticated` את הסט המלא — כולל
--    `update`, `delete` ו-`truncate` — ולכן ההגנה על היומן התקיימה **מול
--    `anon` בלבד**. ⛔ אין להחזיר להם `update`/`delete`: יומן שניתן לערוך
--    אינו יומן ראיות. השורה הזו היא גם שורת ההתכנסות להתקנה קיימת.
-- ⚠️ הפוליסות שלמעלה מוגבלות ל-`anon`, ולכן RLS חוסם ממילא — **אבל אלה שתי
--    שכבות נפרדות**, ואין להסתמך על האחת כדי להשאיר את השנייה פתוחה.
revoke all on public.sync_log from anon, authenticated;
grant insert, select on public.sync_log to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.sync_log to service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. kv_backup — גיבוי יומי של ערכי ה-kv
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ `ysMaybeDailyBackup` כותבת לכאן פעם ביממה, **ורק אחרי שכל המפתחות גובו
--    בהצלחה** נכתב הדגל `ys_last_backup` (סבב 6). אותה הבחנה כמו ב-sync_log:
--    `insert`+`select` בלבד, לשני התפקידים.
create table if not exists public.kv_backup (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  key        text,
  value      text
);

alter table public.kv_backup enable row level security;
drop policy if exists kv_backup_anon   on public.kv_backup;
drop policy if exists kv_backup_insert on public.kv_backup;
drop policy if exists kv_backup_select on public.kv_backup;
create policy kv_backup_insert on public.kv_backup for insert to anon with check (true);
create policy kv_backup_select on public.kv_backup for select to anon using (true);

-- ⛔ אותו דפוס כמו ב-`sync_log` שלמעלה, ומאותה סיבה (סבב 29, השלמה) —
--    ר' ההסבר המלא שם. ⛔ ואין להעניק כאן `update`/`delete` לאף תפקיד.
revoke all on public.kv_backup from anon, authenticated;
grant insert, select on public.kv_backup to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.kv_backup to service_role;


-- ============================================================================
-- אחרי ההרצה — יצירת המשתמש הראשון, ידנית
-- ============================================================================
-- ⛔ אין כאן `insert` פעיל, וגם לא ערך «לדוגמה» (כלל ברזל 10 סעיף 8).
--    הריפו ציבורי ומפתח ה-anon יושב ב-`index.html`, ולכן סיסמה שנדחפת לכאן
--    היא סיסמה שכל אחד יכול להשתמש בה מול המסד החי — ומחיקה מאוחרת אינה
--    מסירה אותה מהיסטוריית ה-git.
--
-- החלף את שלושת מצייני המקום והרץ בנפרד:
--
--   insert into public.ys_users (username, password_hash, full_name, role, active)
--   values ('<שם המשתמש>', '<שש ספרות>', '<שם מלא>', 'admin', true)
--   on conflict (username) do nothing;
--
-- ⚠️ `role` חובה ובמפורש — אין לעמודה `default`, ו-INSERT בלעדיו נכשל במסד.


-- ============================================================================
-- ✅ ההצעה מסבב 28 — בוצעה בסבב 29
-- ============================================================================
-- בסוף הקובץ הזה ישבה עד סבב 28 הצעה מוערת לצמצם את `delete`/`truncate`
-- של `anon` על `kv`. **המנהל אישר, והיא מיושמת** — גם כאן (השורות שליד
-- כל טבלה) וגם ב-`migrations/001_revoke_delete_anon.sql` להתקנה קיימת.
-- מה שנמדד לפני הביצוע: **אפס** קריאות `.delete()` ל-PostgREST בכל הריפו.
--
-- ⛔ **`sync_log` ו-`kv_backup` — `insert`+`select` בלבד, לשני התפקידים**
-- (סבב 29, השלמה; מיגרציה `002_revoke_log_tables.sql` להתקנה קיימת).
-- **בלי `update` ובלי `delete`**, כדי שלא ניתן יהיה לזייף או להעלים רישום
-- קיים ביומן ראיות. ⛔ אין «ליישר» אותן ל-`kv` ול-`ys_users` בשם האחידות
-- (כלל ברזל 10 סעיף 9) — הסט הצר שם **הוא** ההגנה.
-- ⚠️ **וזה תוקן בהשלמה ולא נולד נכון:** הקובץ העניק ל-`authenticated` את
-- הסט המלא על שתיהן, ולכן ההגנה התקיימה מול `anon` בלבד. ⛔ הלקח —
-- **הרשאה שהוחלה על תפקיד אחד היא הגנה חלקית**; בדיקת הרשאות סורקת את
-- שני התפקידים.
--
-- ⚠️ **`authenticated` צומצם יחד עם `anon`**, בהחלטת המנהל: לתפקיד היו
-- בדיוק אותן הרשאות מלאות, מאותה ירושה, ופתיחת signup או Auth בעתיד הייתה
-- פוערת את ההגנה בשקט. זהו גם **יישור ל-gius**, שמיגרציה 0002 שלה כבר
-- צמצמה את שניהם.
-- ⚠️ **הצמצום נעשה כשאין משתמשי Auth כלל** (`auth.users` ריקה), ולכן הוא
-- **אינו נבדק מול מסלול חי**. אם ייפתח Auth בעתיד — יש לוודא
-- ש-`select, insert, update` מספיקים למסלול שייבנה.
-- ⛔ `service_role` לא נגע — הוא תפקיד השרת.

-- ============================================================
-- 007 (סבב 37) — חותמת עדכון וטריגר על טבלת המשתמשים
-- ============================================================
-- ⚠️ **`public.users_touch_updated_at()` היא פונקציה אחת לשתי טבלאות
--    המשתמשים שבפרויקט המשותף** — `ys_users` כאן ו-`sl_users` בשכר לימוד —
--    וזו שהמנהל יצר ב-2026-08-18. ⛔ אין לגזור ממנה שם פר-אפליקציה
--    (`ys_touch_…`) (סבב 37): שתי הגדרות לאותה פונקציה בפרויקט אחד הן
--    גרסה שנייה שאיש אינו יודע עליה (הלקח של סבב 36).
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
