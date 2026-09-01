-- ============================================================================
-- 005_structured_tables.sql — הנהלה רוחנית עוברת לטבלאות מובנות
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- ── מה זה פותר ─────────────────────────────────────────────────────────────
-- hanhala-ruchanit היא האחרונה בארגון שנתוניה אינם בטבלאות אלא כמפתחות `kv`,
-- כשכל מפתח הוא **ערך יחיד** (מטריצת היכולות, שורה 15). נבדק מול המסד
--, ב-`SELECT` בלבד:
--   kv.ys_attend_sessions   360,542 בתים · 273 סדרים · 13,083 סימונים
--   kv.ys_sleep_sessions     38,010 בתים
--   kv.ys_students           13,210 בתים ·  71 תלמידים
-- המשמעות: **כל סימון נוכחות בודד דורס את מלוא 360KB**, המיזוג בענן הוא
-- ברמת קובץ, ופינוי סלקטיבי אינו אפשרי בצד הענן — ולכן גם החלון החם של
-- יושב כאן רדום (`HW_CFG.enabled=false`).
--
-- ── ⭐ ההכרעה המרכזית: שתי טבלאות, אב ובן ───────────────────────────────────
-- **שורה לכל סימון, לא סנאפשוט-יום** — וההפרדה היא לאב (`ys_sessions`) ולבן
-- (`ys_marks`). שתי החלופות נשקלו ונדחו, ושתיהן מאותו נימוק מדוד:
--
--   א. **טבלה אחת שטוחה** (סימון + מטא הסדר באותה שורה) — `filled_by`
--      ו-`filled_by_name` היו משוכפלים ~48 פעם לכל סדר. בחלון החם המתוכנן
--      (~12,000 שורות) זה ניפוח ישיר של מה שיורד למכשיר, ובדיוק המשקל
--      שהמעבר הזה בא להוריד.
--   ב. **`marks` כגוש jsonb בתוך שורת הסדר** — אז כל סימון עדיין דורס את
--      כל הסדר (47 סימונים), וההכרעה «שורה לסימון» מתרוקנת מתוכן. זה היה
--      מקטין את הדריסה מ-360KB ל-~1.3KB, אבל לא מבטל אותה.
--
-- ⚠️ **`date_iso` משוכפל לתוך `ys_marks` למרות שהוא באב — דנורמליזציה
--    מכוונת ומתועדת.** הדוח פר-תלמיד ושאילתת החלון החם מסננות לפי תלמיד
--    ותאריך; בלי השכפול כל אחת מהן הייתה דורשת `join` לאב, כלומר **משיכת
--    טבלת האב למכשיר** רק כדי לדעת מתי היה הסדר. שדה אחד קצר, מול join
--    בכל שאילתת חלון.
--
-- ⛔ **בלי מפתח זר פיזי מ-`ys_marks` לאב** — המחיקה בארגון היא רכה
--    בלבד (`deleted=true`, כלל ברזל 6 סעיף 1), ורשומות מגיעות ממכשירים
--    אופליין **בסדר לא ידוע**: `FK` היה דוחה סימון שהגיע לפני האב שלו,
--    כלומר הופך כתיבה תקפה לכישלון קשיח בדיוק בתרחיש שכל שכבת הסנכרון
--    בנויה לשרת. הקשר נאכף בקוד (`session_client_id` נגזר מ-`id` של האב).
--
-- ── ⚠️ ממצא ששינה את הסכימה: (session, date_iso) אינו ייחודי ───────────────
-- התכנון המקורי קרא לאינדקס **ייחודי** על `(session, date_iso)`. מדידה מול
-- הנתונים החיים הראתה **5 התנגשויות** — שני סדרים חיים לאותו
-- שם-סדר ולאותו יום:
--
-- ⛔ **ולכן האינדקס כאן אינו ייחודי.** שלוש סיבות, ולא אחת:
--   א. אינדקס ייחודי היה מפיל את מיגרציית ההעברה (`006`) על הנתונים
--      הקיימים — כלומר שער שנשבר ברגע הראשון.
--   ב. הוא היה הופך כתיבה **תקפה היום** לכישלון: האפליקציה מרשה לפתוח את
--      אותו סדר פעמיים ביום, וזה מה שקרה בפועל חמש פעמים.
--   ג. **`id` הוא מפתח הזהות, ולא הצמד** — `_ysSessionsMerge` ממזג לפי
-- `r.id`, ו-`client_id` נגזר ממנו. אילוץ ייחודיות על צמד
--      שאינו מפתח הזהות היה ממציא כאן זהות שנייה, וזו בדיוק הכפילות
--      ש-`client_id` נגזר-ממפתח-המיזוג בא למנוע (הלקח של yoman, `002`).
-- ⛔ **ואין לפתור את זה באינדקס חלקי** (`where not deleted`) — אינדקס חלקי
--    שובר את הסקת `ON CONFLICT` של PostgREST (`42P10`), וזה הלקח המדוד של
--    `schar-limud/migrations/007`. ר' הפרק על אינדקסים למטה.
--
-- ── מה **לא** עובר בשלב א, ובכוונה ─────────────────────────────────────────
--   • `ys_sleep_sessions` — אותו מבנה בדיוק, ויעבור באותו דפוס בסבב ייעודי.
--   • `ys_attend` — מנגנון **נפרד** (נוכחות-כניסה יומית, `togglePresent`/
--     `recordTime`), חי ופעיל בקוד. ⛔ אינו מומר כאן ואינו נוגע.
--   • הגדרות קטנות (`ys_settings_meta`, `ys_perms`, `ys_reasons`,
--     `ys_cls_years`, `ys_absence_reasons`, `ys_attend_cfg`, `ys_sleep_cfg`)
--     ⛔ **נשארות ב-`kv`** — לא כל דבר צריך טבלה; הן נכתבות נדיר ובשלמותן.
--
-- ⛔ אידמפוטנטית ואינה נוגעת בנתונים — מבנה בלבד (כלל ברזל 10 סעיף 7).
--    פירוק הנתונים עצמו נמצא ב-`006`, בקובץ נפרד ובכוונה.
-- ============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- 1. ys_sessions — טבלת האב: שורה לכל סדר
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ השדות כאן הם **בדיוק** שדות רשומת הסדר שב-`kv`, אחד לאחד, כדי
--    שההעברה תהיה מועתקת ולא משוחזרת. `date_heb` נשמר **כמות שהוא**
-- (`jsonb`) ו⛔ **אינו נגזר מחדש מ-`date_iso`** — שחזור תאריך
-- עברי הוא שכבת תצוגה בלבד, וזה הלקח שנרשם ב-yoman (`snapHDate`
--    טהורה ואינה כותבת לסנאפשוט). גזירה מחדש כאן הייתה הופכת נתון שמור
--    לנתון מחושב, ומייצרת מקור אמת שני ללוח העברי.
-- ⚠️ `created_at` הוא **טקסט** ולא `timestamptz` — הוא מחזיק את המחרוזת
-- שהמכשיר כתב (חותמת ISO מהמכשיר), ו-`timestamptz` היה מחזיר
--    אותה בפורמט אחר, כלומר שובר את בדיקת השקילות הדו-כיוונית של `006`.
create table if not exists public.ys_sessions (
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
-- ⚠️ **אינו ייחודי** — ר' הממצא בראש הקובץ (5 התנגשויות בנתונים החיים).
create index if not exists ys_sessions_session_date_idx
  on public.ys_sessions (session, date_iso desc);
create index if not exists ys_sessions_date_idx
  on public.ys_sessions (date_iso desc);
create index if not exists ys_sessions_updated_idx
  on public.ys_sessions (updated_at desc);

alter table public.ys_sessions enable row level security;
drop policy if exists allow_all on public.ys_sessions;
create policy allow_all on public.ys_sessions for all to anon using (true) with check (true);

-- ⛔ `SELECT, INSERT, UPDATE` ותו לא (כלל ברזל 10 סעיף 9) — מחיקה כאן
--    היא `deleted=true` + חותמת ולעולם לא הסרת שורה, ולכן ההרשאה מיותרת
--    בהגדרה. ⚠️ והסדר `revoke` ואז `grant` הוא מה שעובד: `GRANT` אדיטיבי,
--    וטבלה חדשה **נולדת** עם `delete` ו-`truncate` מברירות המחדל של הפרויקט.
revoke all on public.ys_sessions from anon, authenticated;
grant select, insert, update on public.ys_sessions to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.ys_sessions to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. ys_marks — טבלת הבן: שורה לכל סימון (תלמיד × סדר)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ **טיפוסים מינימליים בכוונה** — זו הטבלה שתמלא את החלון החם
--    (~12,000 שורות = 80 תלמידים × 3 סדרים × ~50 ימי לימוד), ומשקל שורה
--    מתורגם ישירות ללחץ על מכסת ה-localStorage המשותפת לארבע האפליקציות.
-- נבדק מהנתונים החיים : `minutes` בטווח 0–55, ו-`status` באורך 2 תווים
--    לכל היותר (`p`/`e`/`l`/`ak`/`ap`/`x`/`a`/`''`).
--    ⛔ אין להרחיב את `minutes` ל-`integer` «ליתר ביטחון» — `smallint` מכסה
-- פי אלף מהטווח שנבדק, וההרחבה היא 4 בתים לשורה על שום דבר.
-- ⭐ **`student_id` הוא `text`, ולא `smallint` כפי שנוצר.**
-- הגרסה שרצה יצרה `smallint` לפי המדידה שהייתה נכונה אז
--    (המזהים היו ≤ 71); באותו יום עבר הארגון למזהה שנוצר במכשיר — uuid —
--    ו-`hanhala_008_student_id_to_text` המירה את העמודה. הקובץ מתאר את
--    המצב **הסופי**, ו-`008` היא שורת ההתכנסות להתקנה שכבר רצה.
-- ⛔ ואין כאן `student_key` נפרד לצד `student_id` — שתי עמודות
--    למושג אחד הן מקור אמת כפול, בדיוק הלקח של `deleted` באותו יום.
-- ⚠️ **`status` נשאר `text` ובלי `CHECK` על הערכים** — קוד סטטוס חדש שיתווסף
--    באפליקציה היה נדחה במסד ומפיל שמירת נוכחות, בזמן ש-`kv` (המאסטר
--    בשלב א) היה מקבל אותו. אילוץ שמפיל את הבן ולא את המאסטר הוא כשל
--    א-סימטרי שקשה לאבחן.
create table if not exists public.ys_marks (
  client_id         text        primary key,
  session_client_id text        not null,
  student_id        text        not null,
  date_iso          text        not null,
  status            text,
  minutes           smallint,
  deleted           boolean     not null default false,
  updated_at        bigint      not null default 0,
  synced_at         timestamptz not null default now()
);

-- ⛔ שני האינדקסים **מלאים** — ר' הנימוק ב-`ys_sessions` (42P10).
-- ⚠️ הצמד `(session_client_id, student_id)` **כן** ייחודי, ובניגוד לצמד של
--    האב — הוא בדיוק מפתח הזהות: `marks` ב-`kv` הוא אובייקט שמפתחו מזהה
--    התלמיד, ולכן לתלמיד יש לכל היותר סימון אחד בסדר. `client_id` נגזר
--    ממנו (`<session_client_id>:<student_id>`) ואינו uuid חדש.
create unique index if not exists ys_marks_session_student
  on public.ys_marks (session_client_id, student_id);
-- הדוח פר-תלמיד — הדרישה שנקבעה מראש. `date_iso` הוא ISO, ולכן מיון
-- לקסיקוגרפי עליו **הוא** מיון כרונולוגי; אין כאן המרת טיפוס בשני הכיוונים.
-- ⚠️ ומאז `008` גם `student_id` הוא `text`, ולכן כל השוואה עליו היא השוואת
-- מחרוזות. ⛔ אין להחזיר `::smallint` או מיון מספרי — הם היו
--    מפילים כל מזהה uuid.
create index if not exists ys_marks_student_date_idx
  on public.ys_marks (student_id, date_iso desc);
-- שאילתת החלון החם — כל הסימונים בטווח תאריכים.
create index if not exists ys_marks_date_idx
  on public.ys_marks (date_iso desc);
create index if not exists ys_marks_session_idx
  on public.ys_marks (session_client_id);

alter table public.ys_marks enable row level security;
drop policy if exists allow_all on public.ys_marks;
create policy allow_all on public.ys_marks for all to anon using (true) with check (true);

revoke all on public.ys_marks from anon, authenticated;
grant select, insert, update on public.ys_marks to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.ys_marks to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. ys_students_rows — שורה לכל תלמיד (מצבה)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ כאן **`data jsonb`** ולא עמודות — וזו הבחנה מכוונת מול `ys_marks`.
-- רשומת התלמיד היא בעלת צורה **משתנה**: נבדקו 13 שדות שונים, מהם 9
--    אופציונליים (`present`, `absences`, `status`, `statusReason`,
--    `statusFrom`, `statusTo`, `cohortYear`, `active`, `createdBy`), והמבנה
--    השתנה לאורך הסבבים. פיצוץ שלו לעמודות היה יוצר **מקור אמת שני לצורת
--    הרשומה** — בדיוק מה שנרשם ב-yoman `002`. ⚠️ ובניגוד ל-`ys_marks`, כאן
--    אין שיקול משקל: 71 שורות, לא 12,000.
--    ⛔ העמודות שמחוץ ל-`data` הן אך ורק אלה שהמיזוג נשען עליהן, והן
--    משוכפלות מתוכה במכוון.
create table if not exists public.ys_students_rows (
  client_id  text        primary key,
  student_id text,
  updated_at bigint      not null default 0,
  deleted    boolean     not null default false,
  data       jsonb       not null,
  synced_at  timestamptz not null default now()
);

create index if not exists ys_students_rows_updated_idx
  on public.ys_students_rows (updated_at desc);

alter table public.ys_students_rows enable row level security;
drop policy if exists allow_all on public.ys_students_rows;
create policy allow_all on public.ys_students_rows for all to anon using (true) with check (true);

revoke all on public.ys_students_rows from anon, authenticated;
grant select, insert, update on public.ys_students_rows to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.ys_students_rows to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. ברירות מחדל לטבלאות עתידיות
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ **אינו תחליף ל-`revoke` המפורש** — הוא משפיע רק על ברירות
--    מחדל שבבעלות התפקיד שמריץ אותו, ורק על טבלאות שייווצרו מכאן והלאה.
--    ⛔ הכלל נשאר: כל מיגרציה שמוסיפה טבלה חייבת `revoke` משלה.
alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;


-- ============================================================================
-- אימות אחרי ההרצה (SELECT בלבד)
-- ============================================================================
--   select table_name, string_agg(distinct privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema='public'
--     and table_name in ('ys_sessions','ys_marks','ys_students_rows')
--     and grantee in ('anon','authenticated')
--   group by table_name;
--   -- ציפייה: INSERT, SELECT, UPDATE — ⛔ אפס DELETE ואפס TRUNCATE, בשני התפקידים.
--
--   select indexname, indexdef from pg_indexes
--   where schemaname='public'
--     and tablename in ('ys_sessions','ys_marks','ys_students_rows');
--   -- ⛔ ציפייה: אין `WHERE` באף `indexdef` — כל האינדקסים מלאים.
