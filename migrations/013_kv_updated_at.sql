-- ============================================================================
-- 013_kv_updated_at.sql — `updated_at` לשלוש טבלאות ה-kv (סבב 62)
-- ============================================================================
-- ⛔⛔ **הקובץ הזה נכתב ולא הורץ (סבב 62) — «נכתב» אינו «רץ».** הרצתו היא
--     החלטת המנהל. הקוד ב-`index.html` בטוח לפריסה גם בלי הרצה: מסלול
--     ה-`updated_at` יושב מאחורי `YS_KV_UPDATED_AT` שכבוי, והמפה הישנה
--     (`ys_settings_meta`) נשארת המקור עד שהדגל יידלק.
--
-- ⚠️ **הקובץ הוא של הפרויקט המשותף** (`kxbtskqobynewvnckaaz`) ולכן הוא נוגע
--    בשלוש הטבלאות של שלוש האפליקציות שחיות בו — `kv` (הנהלה),
--    `kv_rishon` ו-`kv_ramataviv` (יומן). ⛔ קובץ אחד לפרויקט אחד, ולא
--    עותק בכל ריפו — אותו כלל של `004`.
--
-- ── מה זה פותר ─────────────────────────────────────────────────────────────
-- נמדד ב-26.8.2026 מול המסד, ולא הונח: `sl_settings` ו-`g_config` — שתי
-- טבלאות המפתח/ערך האחרות בארגון — נושאות `updated_at`, ⛔ ושלוש טבלאות
-- ה-`kv` לא. כלומר אותו מבנה בדיוק, בלי חותמת, בשלוש מתוך חמש.
--
-- ⛔ ובהיעדרה הומצאו **מנגנוני פיצוי בתוך הערך** — מפות חותמות שיושבות
--    כערך `kv` בפני עצמו (`ys_settings_meta` בהנהלה, `tb_subs_meta` ביומן).
--    זה בדיוק «פיצוי על מגבלה מבנית» שכלל ברזל 12 (הממד הרביעי) מחייב
--    לבדוק מחדש כשהמבנה מתוקן.
--
-- ⚠️ **ומדידה שמראה עד כמה הפיצוי שביר:** `kv.ys_settings_meta` מחזיק
--    **`{}` — שני בתים** (נמדד 26.8). כלומר `rts` הוא תמיד 0, התנאי
--    `rts > lts` לעולם אינו מתקיים, ⛔ וה-LWW של שלושת מפתחות ההגדרות
--    (`ys_reasons` · `ys_absence_reasons` · `ys_cls_years`) מת: **האחרון
--    שדוחף מנצח**, בלי תנאי.
--
-- ⚠️⚠️ **ומה שהמיגרציה הזו אינה פותרת, ⛔ ואין להסיק שכן:**
--    `tb_subs_meta` של יומן **אינו** אותו מקרה. הוא מחזיק חותמת
--    **לכל תת-מפתח בתוך ערך `kv` יחיד** (`tb_subs` הוא `{מפתח: [מחרוזות]}`,
--    ו-`mergeSubs` מכריע פר-תת-מפתח). ⛔ `updated_at` הוא חותמת **לשורה**,
--    ולכן הוא אינו יכול להחליף אותו: שני מכשירים שערכו תתי-מפתח **שונים**
--    היו דורסים זה את זה. ⚠️ והוא חי ומאוכלס (1,122 בתים בראשון לציון,
--    760 ברמת אביב — נמדד), ⛔ ואין להסירו.
--
-- ── ⛔ שני לקחים מסבב 61 שחלים כאן מילה במילה ──────────────────────────────
-- 1. ⛔ **`drop function` מפורש לפני יצירה מחדש כשהחתימה משתנה** — ב-Postgres
--    החתימה היא חלק מזהות הפונקציה, ולכן `create or replace` עם חתימה אחרת
--    יוצר פונקציה **שנייה** שחיה לצד הישנה, וכל קריאה בשם נעשית דו-משמעית
--    ונכשלת **בשקט**. ⚠️ כאן החתימה זהה לזו של `007` (`() returns trigger`),
--    ⛔ ולכן אין `drop` — אבל הכלל נרשם כאן כדי שהסבב הבא לא ילמד אותו שוב.
-- 2. ⛔ **`revoke execute … from public, anon, authenticated`** — פונקציה
--    חדשה **אינה יורשת** הרשאות והיא נולדת נגישה כ-RPC לכל מי שמחזיק את
--    המפתח הציבורי שב-`index.html`.
--
-- ── ⛔ מבנה בלבד, ואין נגיעה בנתונים ───────────────────────────────────────
-- כלל ברזל 10 סעיף 7: ה-`UPDATE` היחיד המותר הוא מילוי עמודה שזה עתה
-- נוספה, ורק ב-`WHERE <col> IS NULL`. ⚠️ וגם הוא אינו נחוץ כאן — ה-`DEFAULT`
-- ממלא את השורות הקיימות בזמן ה-`ADD COLUMN`.
-- ============================================================================

-- ---------- 1. העמודה ----------
-- ⚠️ `default now()` ולא `null`: שורה קיימת מקבלת חותמת **בזמן ההרצה**, ולכן
--    היא «ישנה כמו כולן» ואף מכשיר אינו זוכה בה במיזוג על פני אחר.
--    ⛔ עמודה שנולדת `null` הייתה נקראת כ-0 בכל השוואה, כלומר כל מכשיר היה
--    מנצח אותה — בדיוק הבאג שהמיגרציה באה לסגור.
alter table public.kv            add column if not exists updated_at timestamptz not null default now();
alter table public.kv_rishon     add column if not exists updated_at timestamptz not null default now();
alter table public.kv_ramataviv  add column if not exists updated_at timestamptz not null default now();

-- ---------- 2. הטריגר ----------
-- ⛔ פונקציה אחת לשלוש הטבלאות (סבב 62) — שלוש הגדרות לאותה לוגיקה הן שלוש
--    הזדמנויות שאחת מהן תיסחף (הלקח של סבב 36).
-- ⛔ ושם חדש ולא `users_touch_updated_at` של `007` — אותה חתימה בדיוק, אבל
--    שיתוף שם בין טבלאות שונות היה הופך כל שינוי עתידי באחת לשינוי בכולן.
create or replace function public.kv_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ⛔ `before update` בלבד — ב-`INSERT` ה-`DEFAULT` כבר עשה את העבודה,
--    וטריגר שהיה דורס גם ב-INSERT היה מוחק חותמת שנמסרה מהמכשיר.
drop trigger if exists kv_touch            on public.kv;
drop trigger if exists kv_rishon_touch     on public.kv_rishon;
drop trigger if exists kv_ramataviv_touch  on public.kv_ramataviv;

create trigger kv_touch
  before update on public.kv
  for each row execute function public.kv_touch_updated_at();
create trigger kv_rishon_touch
  before update on public.kv_rishon
  for each row execute function public.kv_touch_updated_at();
create trigger kv_ramataviv_touch
  before update on public.kv_ramataviv
  for each row execute function public.kv_touch_updated_at();

-- ---------- 3. הרשאות ----------
-- ⛔ הפונקציה נולדת עם `execute` ל-`public` ואינה יורשת דבר (הלקח של סבב 61).
revoke all on function public.kv_touch_updated_at() from public, anon, authenticated;

-- ⛔ REVOKE לפני GRANT, ואין לקצר (כלל ברזל 10 סעיף 9) — GRANT הוא אדיטיבי
--    ואינו מסיר את ה-DELETE/TRUNCATE שהטבלה נולדה איתם.
revoke all on public.kv            from anon, authenticated;
revoke all on public.kv_rishon     from anon, authenticated;
revoke all on public.kv_ramataviv  from anon, authenticated;
grant select, insert, update on public.kv            to anon, authenticated;
grant select, insert, update on public.kv_rishon     to anon, authenticated;
grant select, insert, update on public.kv_ramataviv  to anon, authenticated;

-- ---------- 4. אימות (הרצה ידנית אחרי המיגרציה) ----------
-- ⚠️ שלוש השאילתות האלה הן **פעולת מנהל** ואינן חלק מהמיגרציה — השערים
--    שבריפו קוראים קבצים ⛔ ואינם רואים את המסד החי (כלל ברזל 20).
--
--   -- א. העמודה קיימת בשלושתן
--   select table_name, column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public' and column_name = 'updated_at'
--      and table_name in ('kv','kv_rishon','kv_ramataviv');
--
--   -- ב. שלושת הטריגרים דרוכים
--   select event_object_table, trigger_name, action_timing, event_manipulation
--     from information_schema.triggers
--    where trigger_name in ('kv_touch','kv_rishon_touch','kv_ramataviv_touch');
--
--   -- ג. ⛔ והחותמת באמת מתקדמת ב-UPDATE (⚠️ מריצים על מפתח בדיקה בלבד,
--   --    ⛔ לא על נתון חי — עדכון נתונים מחייב אישור מפורש)
--   select key, updated_at from public.kv order by updated_at desc limit 5;
