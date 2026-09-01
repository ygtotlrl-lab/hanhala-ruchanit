-- ============================================================================
-- 009_sleep_structured_tables.sql — סדרי השינה עוברים לטבלאות מובנות
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ── מה זה פותר ─────────────────────────────────────────────────────────────
-- `ys_sleep_sessions` הוא המפתח האחרון מסוגו שנשאר מחוץ לשכבת השורות:
-- העביר את הנוכחות (`ys_attend_sessions`) ואת המצבה, והשינה נשארה בחוץ
-- **מטעמי היקף בלבד** — לא מטעם מבני. נבדק מול המסד,
-- ב-`SELECT` בלבד:
--   kv.ys_sleep_sessions   39,368 בתים · 21 סדרים · 988 סימונים
-- כלומר כל סימון שינה בודד דורס את מלוא הערך, בדיוק כמו בנוכחות.
--
-- ── ⭐ אותו דפוס בדיוק, ולא דפוס חדש ────────────────────────────────────────
-- המבנה נבדק והושווה לנוכחות לפני שנכתבה כאן שורה: רשומת סדר שינה
-- נושאת **אותם שדות** כמו רשומת נוכחות — `id`, `session`, `date_iso`,
-- `date_heb`, `filled_by`, `filled_by_name`, `created_at`, `createdBy`,
-- `open`, `marks`, `updatedAt` (ו-`deleted`/`deletedBy` כשהן קיימות; באף סדר
-- שינה עדיין לא נעשתה מחיקה, ולכן המפתחות פשוט אינם מופיעים).
-- ⛔ ולכן אין כאן הכרעה ארכיטקטונית חדשה — אב ובן, בדיוק כמו `005`. כל
--    הנימוקים שם (למה לא טבלה שטוחה, למה לא `marks` כגוש jsonb, למה
--    `date_iso` משוכפל לבן, למה בלי מפתח זר פיזי) חלים כאן מילה במילה.
--
-- ⭐ **ההבדל היחיד: לסימון שינה יש שדה `note`.** בנוכחות הסימון הוא
--    `{s, min}` בלבד; בשינה הוא `{s, min, note}` — 25 סימונים נושאים הערה,
-- הארוכה שבהן 248 תווים. ⛔ הוא **חייב** עמודה משלו: השמטתו
--    הייתה הופכת את בדיקת השקילות של `010` לשקר — הערה שנכתבה במכשיר לא
--    הייתה מגיעה לשכבת השורות כלל, בשקט.
--
-- ⚠️ **שם הטבלה זהה לשם מפתח ה-`kv`, וזה מכוון.** בנוכחות המפתח הוא
--    `ys_attend_sessions` והטבלה `ys_sessions`; כאן `ys_sessions` כבר תפוס,
--    ולכן הטבלה היא `ys_sleep_sessions`. אלה שני מרחבי-שמות נפרדים (שורה
--    ב-`kv` מול טבלה ב-`public`), ⛔ ומפתח הגיבוי נושא סיומת `_rows`
--    (`ys_sleep_sessions_rows`) בדיוק כדי שלא יתנגש בגיבוי ה-`kv` הישן.
--
-- ── טיפוסים — נגזרים מהנתונים ──────────────────────────────────────────────
--   minutes  smallint  — הטווח בפועל 0–30
--   status   text      — קוד באורך 2 תווים לכל היותר
--   note     text      — עד 248 תווים בפועל; ⛔ בלי `varchar(n)` שרירותי
--   student_id text    — ⛔ ולא `smallint` (הלקח של `008`): מזהה תלמיד הוא
-- uuid, ו-`::smallint` היה מפיל כל סימון חדש
-- ============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- א. טבלת האב — מטא הסדר
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ `created_at` הוא **טקסט** ולא `timestamptz` — הוא מחזיק את המחרוזת
--    שהמכשיר כתב, ו-`timestamptz` היה מחזיר אותה בפורמט אחר, כלומר שובר את
--    בדיקת השקילות הדו-כיוונית של `010`. אותו נימוק בדיוק כמו ב-`005`.
create table if not exists public.ys_sleep_sessions (
  client_id      text        primary key,
  session        text        not null,
  date_iso       text        not null,
  date_heb       jsonb,
  filled_by      smallint,
  filled_by_name text,
  created_at     text,
  created_by     text,
  deleted_by     text,
  open           boolean,
  deleted        boolean     not null default false,
  updated_at     bigint      not null default 0,
  synced_at      timestamptz not null default now()
);

-- ⛔ **אינדקס מלא ולא חלקי** (הלקח מ-`schar-limud/migrations/007`): אינדקס עם
--    `WHERE` שובר את הסקת `ON CONFLICT`, ו-PostgREST אינו יכול לצרף את התנאי —
--    כלומר כל `upsert` נופל ב-42P10 והשמירה מפסיקה לעבוד.
--    ⛔ אין ליצור אינדקס חלקי על העמודות האלה בשום מיגרציה עתידית.
-- ⚠️ **ואינו ייחודי — למרות שבנתונים היום אין אף התנגשות** (נבדק: 0 זוגות
--    `(session, date_iso)` כפולים, מול 5 בנוכחות). ⛔ אפס היום הוא **נתון,
-- לא אילוץ**: אותה מציאות תפעולית שיצרה חמש התנגשויות בנוכחות
--    קיימת גם כאן — שני סדרי שינה באותו שם ובאותו יום הם כתיבה תקפה — ואינדקס
--    ייחודי היה הופך אותה לכישלון. מפתח הזהות נשאר `client_id`.
create index if not exists ys_sleep_sessions_session_date_idx
  on public.ys_sleep_sessions (session, date_iso desc);
create index if not exists ys_sleep_sessions_date_idx
  on public.ys_sleep_sessions (date_iso desc);
create index if not exists ys_sleep_sessions_updated_idx
  on public.ys_sleep_sessions (updated_at desc);

alter table public.ys_sleep_sessions enable row level security;
drop policy if exists allow_all on public.ys_sleep_sessions;
create policy allow_all on public.ys_sleep_sessions for all to anon using (true) with check (true);

-- ⛔ `SELECT, INSERT, UPDATE` ותו לא (כלל ברזל 10 סעיף 9) — מחיקה כאן
--    היא `deleted=true` + חותמת ולעולם לא הסרת שורה, ולכן ההרשאה מיותרת
--    בהגדרה. ⚠️ והסדר `revoke` ואז `grant` הוא מה שעובד: `GRANT` אדיטיבי,
--    וטבלה חדשה **נולדת** עם `delete` ו-`truncate` מברירות המחדל של הפרויקט.
revoke all on public.ys_sleep_sessions from anon, authenticated;
grant select, insert, update on public.ys_sleep_sessions to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.ys_sleep_sessions to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- ב. טבלת הבן — שורה לכל תלמיד×סדר
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.ys_sleep_marks (
  client_id         text        primary key,
  session_client_id text        not null,
  student_id        text        not null,
  date_iso          text        not null,
  status            text,
  minutes           smallint,
  note              text,
  deleted           boolean     not null default false,
  updated_at        bigint      not null default 0,
  synced_at         timestamptz not null default now()
);

-- ⛔ כל האינדקסים **מלאים** — ר' הנימוק באב (42P10).
-- ⚠️ הצמד `(session_client_id, student_id)` **כן** ייחודי, ובניגוד לצמד של
--    האב — הוא בדיוק מפתח הזהות: `marks` ב-`kv` הוא אובייקט שמפתחו מזהה
-- התלמיד, ולכן לתלמיד יש לכל היותר סימון אחד בסדר. נבדק: אפס מפתחות
--    כפולים ב-988 הסימונים. `client_id` נגזר ממנו
--    (`<session_client_id>:<student_id>`) ואינו uuid חדש.
create unique index if not exists ys_sleep_marks_session_student
  on public.ys_sleep_marks (session_client_id, student_id);
-- הדוח פר-תלמיד. `date_iso` הוא ISO, ולכן מיון לקסיקוגרפי עליו **הוא** מיון
-- כרונולוגי. ⛔ אין להחזיר `::smallint` או מיון מספרי על `student_id`
-- (הלקח של `008`) — הם היו מפילים כל מזהה uuid.
create index if not exists ys_sleep_marks_student_date_idx
  on public.ys_sleep_marks (student_id, date_iso desc);
-- שאילתת החלון החם — כל הסימונים בטווח תאריכים.
create index if not exists ys_sleep_marks_date_idx
  on public.ys_sleep_marks (date_iso desc);
create index if not exists ys_sleep_marks_session_idx
  on public.ys_sleep_marks (session_client_id);

alter table public.ys_sleep_marks enable row level security;
drop policy if exists allow_all on public.ys_sleep_marks;
create policy allow_all on public.ys_sleep_marks for all to anon using (true) with check (true);

revoke all on public.ys_sleep_marks from anon, authenticated;
grant select, insert, update on public.ys_sleep_marks to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.ys_sleep_marks to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- ג. ברירות מחדל לטבלאות עתידיות
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ **אינו תחליף ל-`revoke` המפורש** — הוא משפיע רק על טבלאות
--    שייווצרו מכאן ואילך, ולא על השתיים שנוצרו למעלה.
--    ⛔ הכלל נשאר: כל מיגרציה שמוסיפה טבלה חייבת `revoke` משלה.
alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- ד. אימות אחרי הרצה — `SELECT` בלבד
-- ───────────────────────────────────────────────────────────────────────────
--   select table_name,
--          string_agg(distinct privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name in ('ys_sleep_sessions','ys_sleep_marks')
--     and grantee in ('anon','authenticated')
--   group by table_name;
--   -- מצופה: INSERT, SELECT, UPDATE — ⛔ ואפס DELETE/TRUNCATE.
--
--   select indexname, indexdef from pg_indexes
--   where schemaname='public' and tablename like 'ys_sleep_%';
--   -- מצופה: אפס `WHERE` בכל ה-indexdef (⛔ אין אינדקס חלקי).
