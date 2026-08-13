-- ============================================================================
-- הנהלה רוחנית — מיגרציה 001
-- צמצום הרשאות `anon` ו-`authenticated` על `kv` ועל `ys_users` (סבב 29)
-- הרצה: Supabase SQL Editor (פרויקט kxbtskqobynewvnckaaz) →
--   https://supabase.com/dashboard/project/kxbtskqobynewvnckaaz/sql
-- ============================================================================
--
-- ⭐ **זו המיגרציה הראשונה כאן מאז קובץ ההתקנה** (`000_initial_schema.sql`,
--    סבב 28). היא מפעילה את ההצעה שנרשמה שם מוערת בסוף הקובץ
--    («⚠️ הצעה שלא בוצעה — הקשחת ההרשאות על kv») — **בהחלטת המנהל**,
--    ומרחיבה אותה גם ל-`ys_users`.
--
-- **הבעיה שנמדדה.** מיפוי `information_schema.role_table_grants` מול המסד
-- החי מצא ש-`anon` מחזיק על `kv` ועל `ys_users`:
--     DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
-- כלומר גם **מחיקת שורות** וגם **ריקון טבלה שלמה**. מפתח ה-anon יושב גלוי
-- ב-`index.html` בריפו ציבורי, וה-RLS כאן הוא `using (true)` — ולכן מי
-- שמחזיק בו יכול תיאורטית לרוקן את `kv`, שהיא **מקור הנתונים היחיד** של
-- האפליקציה: מצבת התלמידים, הנוכחות, הסדרים, הטיפולים וההרשאות, הכול.
--
-- ⚠️ **מאיפה זה הגיע:** לא מקובץ ההתקנה. פרויקט Supabase סטנדרטי מגיע עם
--     alter default privileges in schema public grant all on tables
--       to anon, authenticated, service_role;
-- ולכן **כל טבלה שנוצרה כאן נולדה עם DELETE ו-TRUNCATE**, וה-`grant` שבקובץ
-- ההתקנה רק תיאר את המצב הזה. ⛔ **GRANT הוא אדיטיבי בלבד** ואינו יכול
-- להסיר דבר; רק `REVOKE` מסיר.
--
-- **למה ההסרה בטוחה — נמדד, לא הונח.** ⛔ אין באפליקציה שום מסלול מחיקה
-- מול המסד: סריקה של כל קבצי הריפו מצאה **אפס** קריאות `.delete()` ל-
-- PostgREST (ההתאמות היחידות הן `caches.delete()` של ה-service worker
-- ו-`Set.delete` ברתמת הבדיקה). כל כתיבה ל-`kv` היא `upsert`, ומחיקה
-- באפליקציה היא **tombstone בתוך הערך** — `deleted=true` + חותמת בתוך
-- ה-JSON — ולא הסרת שורה. ההרשאה מיותרת לחלוטין, והסרתה אינה שוברת דבר.
--
-- **מה נשאר ל-anon:** `SELECT, INSERT, UPDATE` — בדיוק מה ש-`ysKvSet`
-- (upsert) ומסלולי המשתמשים צריכים.
--
-- ⛔ **`sync_log` ו-`kv_backup` אינן כאן, ואין להוסיף אותן.** הן כבר מחזיקות
-- `INSERT, SELECT` בלבד ל-anon (כך נמדד, וכך כתוב בקובץ ההתקנה) — היעדר
-- ה-UPDATE שם הוא **הגנה מכוונת**: יומן ראיות שאי אפשר לזייף בו רישום
-- קיים. ⛔ אין «ליישר» אותן לסט של שתי הטבלאות שכאן. ר' כלל ברזל 10 סעיף 9.
--
-- ⚠️ **הפרויקט משותף** עם schar-limud (`sl_*`) ועם yoman-avoda
-- (`kv_rishon`/`kv_ramataviv`). המיגרציה הזו נוגעת **רק** בשתי הטבלאות של
-- הנהלה רוחנית; לכל אחת מהאחיות מיגרציה מקבילה משלה, באותו סבב.
--
-- אדיטיבית, אידמפוטנטית, ⛔ **ואינה נוגעת בנתונים** — הרשאות בלבד. אין
-- כאן `insert`, `update` או `delete` על אף שורה.
-- ============================================================================

begin;

do $$
declare t text;
begin
  foreach t in array array['kv', 'ys_users']
  loop
    -- ⛔ revoke ואז grant, בסדר הזה. `grant select, insert, update` לבדו
    -- אינו מסיר את delete/truncate שכבר קיימים — הוא רק מוסיף.
    execute format(
      'revoke delete, truncate, references, trigger on table public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update on table public.%I to anon, authenticated', t);
  end loop;
end $$;

-- טבלה עתידית בסכימה הזו לא תיוולד עם ההרשאות האלה.
-- ⚠️ **אינו תחליף לשורות שלמעלה:** `alter default privileges` משפיע רק על
-- ברירות מחדל שבבעלות התפקיד שמריץ אותו, ורק על טבלאות שייווצרו **מכאן
-- והלאה**. אם ברירות המחדל של Supabase נקבעו ע"י תפקיד אחר, זהו no-op.
-- ⛔ ולכן הכלל נשאר: **כל מיגרציה שמוסיפה טבלה חייבת revoke מפורש משלה.**
alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;

commit;

-- ============================================================================
-- אימות אחרי ההרצה
-- ============================================================================
--   select table_name,
--          string_agg(distinct privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public'
--     and table_name in ('kv','ys_users','sync_log','kv_backup')
--   group by table_name order by table_name;
--
-- מצופה:
--   kv          → INSERT, SELECT, UPDATE
--   ys_users    → INSERT, SELECT, UPDATE
--   kv_backup   → INSERT, SELECT      (לא נגע)
--   sync_log    → INSERT, SELECT      (לא נגע)

-- ============================================================================
-- ⚠️ `authenticated` צומצם כאן יחד עם `anon`
-- ============================================================================
-- לתפקיד הזה היו בדיוק אותן הרשאות מלאות, מאותה ירושה. הבקשה המקורית הייתה
-- על המפתח הציבורי בלבד, וההרחבה נעשתה **בהחלטת המנהל**: התפקיד קיים ומחזיק
-- הרשאות עודפות **היום**, ופתיחת signup או Auth בעתיד הייתה פוערת את ההגנה
-- בשקט. ⚠️ זהו גם **יישור ל-gius**, שמיגרציה 0002 שלה כבר צמצמה את שניהם.
--
-- ⚠️ **הצמצום נעשה כשאין משתמשי Auth כלל** — `select count(*) from auth.users`
-- מחזיר 0, ולכן הוא **אינו נבדק מול מסלול חי**. אם ייפתח Auth בעתיד, יש
-- לוודא ש-`select, insert, update` מספיקים למסלול שייבנה.
--
-- אימות:
--   select grantee, table_name,
--          string_agg(distinct privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon','authenticated')
--     and table_name in ('kv', 'ys_users')
--   group by grantee, table_name order by table_name, grantee;
--
-- מצופה, לכל השורות: INSERT, SELECT, UPDATE
-- ⛔ `service_role` לא נגע ואינו אמור להשתנות — הוא תפקיד השרת.
