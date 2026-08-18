-- ============================================================================
-- 006_migrate_kv_to_rows.sql — פירוק מפתחות ה-kv לשורות (סבב 36, שלב א)
-- ============================================================================
-- ⛔⛔ **נכתב ולא הורץ (סבב 36).** הרצה היא החלטת המנהל.
--     ⛔ **ואין להריץ לפני ש-`005` רץ ואומת, ולפני שהגיבוי היומי רץ ונמדד**
--     — הקובץ הזה מפרק 360KB של נתוני נוכחות לשורות, ובלי גיבוי טרי אין
--     נקודת חזרה. סדר ההרצה: גיבוי מאומת ← `005` ← `006` ← בדיקת השקילות
--     שבסוף הקובץ.
--
-- ── מה הוא עושה ────────────────────────────────────────────────────────────
-- מעתיק `kv.ys_attend_sessions` ל-`ys_sessions` + `ys_marks`, ו-`kv.ys_students`
-- ל-`ys_students_rows`. ⛔ **אינו מוחק דבר ואינו נוגע ב-`kv`** — `kv` נשאר
-- המאסטר לכל אורך שלב א, והכתיבה הכפולה שב-`index.html` היא שמחזיקה את שני
-- הצדדים מסונכרנים מכאן והלאה.
--
-- ⭐ **אידמפוטנטית דרך `on conflict do nothing`, ולא דרך `truncate`+טעינה.**
--    הרצה חוזרת אחרי שהכתיבה הכפולה כבר רצה **לא תדרוס** שורה שהמכשירים
--    עדכנו בינתיים. ⛔ זו הנקודה שאסור להפוך ל-`do update` (סבב 36):
--    ה-`kv` והשורות מתעדכנים משני מסלולים, ו-`do update` היה מחזיר את גרסת
--    ה-`kv` מעל עריכה חדשה יותר שכבר יושבת בשורה — כלומר אובדן עריכה שקט,
--    בדיוק מה שכלל ברזל 6 מתאר.
--    ⚠️ המשמעות המעשית: אם ההרצה הראשונה נעשית **אחרי** שהכתיבה הכפולה כבר
--    רצה זמן מה, היא תהיה בפועל **no-op** — וזו העדות שההרצה נותנת, בדיוק
--    כפי שקרה ב-yoman `002`+`003`.
--
-- ── ⚠️ שתי החלטות מיפוי שאינן מובנות מאליהן ────────────────────────────────
-- 1. **`ys_marks.updated_at` יורש את חותמת הסדר.** לסימון בודד אין `updatedAt`
--    משלו ב-`kv` — המבנה שם הוא `marks: { <student_id>: {s, min} }`, כלומר
--    החותמת היחידה שקיימת היא של הסדר כולו. ⛔ אין להמציא כאן `now()`
--    (סבב 36) — חותמת שנוצרת בזמן ההעברה הייתה **חדשה מכל עריכה מקומית
--    שטרם עלתה**, ובמיזוג הראשון הייתה דורסת אותה. ירושת חותמת האב היא
--    הערך היחיד שנכון גם למיזוג וגם לפינוי.
-- 2. **`ys_marks.deleted` יורש את `deleted` של האב.** ⛔ וזה **חובה** ולא
--    נוחות (סבב 36): הדוח פר-תלמיד קורא את `ys_marks` **בלי join לאב** —
--    זו כל הסיבה ש-`date_iso` שוכפל לשם — ולכן סימון של סדר מחוק שהיה
--    נשאר `deleted=false` היה **דולף לדוח** של תלמיד כרשומה חיה.
--    אותו כלל חל על הכתיבה הכפולה ב-`index.html`, ובדיקת סבב 36 אוכפת אותו.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ys_sessions — האב
-- ────────────────────────────────────────────────────────────────────────────
insert into public.ys_sessions
  (client_id, session, date_iso, date_heb, filled_by, filled_by_name,
   created_at, created_by, deleted_by, open, deleted, updated_at)
select
  e->>'id',
  coalesce(e->>'session', ''),
  coalesce(e->>'date_iso', ''),
  e->'date_heb',
  nullif(e->>'filled_by', '')::smallint,
  e->>'filled_by_name',
  e->>'created_at',
  e->>'createdBy',
  e->>'deletedBy',
  case when jsonb_typeof(e->'open') = 'boolean' then (e->>'open')::boolean end,
  coalesce(case when jsonb_typeof(e->'deleted') = 'boolean' then (e->>'deleted')::boolean end, false),
  coalesce(nullif(e->>'updatedAt', '')::bigint, 0)
from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e
where k.key = 'ys_attend_sessions'
  and jsonb_typeof(k.value::jsonb) = 'array'
  and e->>'id' is not null
on conflict (client_id) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ys_marks — הבן
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ `m.key !~ '^\d+$'` מסונן החוצה: מפתח `marks` הוא **תמיד** מזהה תלמיד
--    מספרי (נמדד: 13,083 סימונים, אפס חריגים), ומפתח שאינו כזה הוא נתון
--    פגום. ⛔ הוא מדולג ואינו מפיל את ההעברה, אבל הוא גם **ייספר כפער
--    בבדיקת השקילות** שלמטה — כלומר לא נעלם בשקט.
insert into public.ys_marks
  (client_id, session_client_id, student_id, date_iso, status, minutes,
   deleted, updated_at)
select
  (e->>'id') || ':' || m.key,
  e->>'id',
  m.key::smallint,
  coalesce(e->>'date_iso', ''),
  m.value->>'s',
  coalesce(nullif(m.value->>'min', '')::numeric, 0)::smallint,
  coalesce(case when jsonb_typeof(e->'deleted') = 'boolean' then (e->>'deleted')::boolean end, false),
  coalesce(nullif(e->>'updatedAt', '')::bigint, 0)
from public.kv k,
     lateral jsonb_array_elements(k.value::jsonb) e,
     lateral jsonb_each(e->'marks') m
where k.key = 'ys_attend_sessions'
  and jsonb_typeof(k.value::jsonb) = 'array'
  and e->>'id' is not null
  and jsonb_typeof(e->'marks') = 'object'
  and m.key ~ '^\d+$'
on conflict (client_id) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. ys_students_rows — המצבה
-- ────────────────────────────────────────────────────────────────────────────
insert into public.ys_students_rows
  (client_id, student_id, updated_at, deleted, data)
select
  e->>'id',
  nullif(e->>'id', '')::smallint,
  coalesce(nullif(e->>'updatedAt', '')::bigint, 0),
  coalesce(case when jsonb_typeof(e->'deleted') = 'boolean' then (e->>'deleted')::boolean end, false),
  e
from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e
where k.key = 'ys_students'
  and jsonb_typeof(k.value::jsonb) = 'array'
  and e->>'id' is not null
on conflict (client_id) do nothing;


-- ============================================================================
-- בדיקת שקילות דו-כיוונית (SELECT בלבד — להריץ אחרי ההעברה)
-- ============================================================================
-- ⚠️ **דו-כיוונית ולא ספירה אחת.** ספירה שווה אינה שקילות: היא עוברת גם
--    כששורה אחת חסרה ושורה אחרת עודפת. שתי השאילתות שלמטה מחזירות את
--    ההפרש **בשני הכיוונים**, וההצלחה היא **אפס שורות בשתיהן**.
--
-- --- א. סדרים -------------------------------------------------------------
--   with kvs as (
--     select e->>'id' cid,
--            coalesce(e->>'session','') ses,
--            coalesce(e->>'date_iso','') d,
--            coalesce(nullif(e->>'updatedAt','')::bigint,0) upd,
--            coalesce(case when jsonb_typeof(e->'deleted')='boolean'
--                          then (e->>'deleted')::boolean end,false) del
--     from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e
--     where k.key='ys_attend_sessions' and e->>'id' is not null)
--   select 'kv בלבד' src, cid, ses, d from (
--     select cid,ses,d,upd,del from kvs
--     except select client_id,session,date_iso,updated_at,deleted from public.ys_sessions) x
--   union all
--   select 'שורות בלבד', client_id, session, date_iso from (
--     select client_id,session,date_iso,updated_at,deleted from public.ys_sessions
--     except select cid,ses,d,upd,del from kvs) y;
--   -- ציפייה: אפס שורות.
--
-- --- ב. סימונים -----------------------------------------------------------
--   with kvm as (
--     select (e->>'id')||':'||m.key cid,
--            (e->>'id') scid,
--            m.key::smallint sid,
--            coalesce(e->>'date_iso','') d,
--            m.value->>'s' st,
--            coalesce(nullif(m.value->>'min','')::numeric,0)::smallint mn
--     from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e,
--          lateral jsonb_each(e->'marks') m
--     where k.key='ys_attend_sessions' and e->>'id' is not null
--       and jsonb_typeof(e->'marks')='object' and m.key ~ '^\d+$')
--   select 'kv בלבד' src, cid from (
--     select cid,scid,sid,d,st,mn from kvm
--     except select client_id,session_client_id,student_id,date_iso,status,minutes
--            from public.ys_marks) x
--   union all
--   select 'שורות בלבד', client_id from (
--     select client_id,session_client_id,student_id,date_iso,status,minutes
--     from public.ys_marks
--     except select cid,scid,sid,d,st,mn from kvm) y;
--   -- ציפייה: אפס שורות.
--
-- --- ג. מפתחות `marks` שאינם מספריים (הדילוג המתועד שלמעלה) ---------------
--   select e->>'id' session_id, m.key bad_key
--   from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e,
--        lateral jsonb_each(e->'marks') m
--   where k.key='ys_attend_sessions' and jsonb_typeof(e->'marks')='object'
--     and m.key !~ '^\d+$';
--   -- ציפייה: אפס שורות. שורה כאן = סימון שלא עבר, ו⛔ אין להריץ את
--   -- שלב ב לפני שהוכרע מה לעשות איתו.
--
-- --- ד. תלמידים -----------------------------------------------------------
--   with kvst as (
--     select e->>'id' cid, e body
--     from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e
--     where k.key='ys_students' and e->>'id' is not null)
--   select 'kv בלבד' src, cid from (select cid,body from kvst
--     except select client_id,data from public.ys_students_rows) x
--   union all
--   select 'שורות בלבד', client_id from (
--     select client_id,data from public.ys_students_rows
--     except select cid,body from kvst) y;
--   -- ציפייה: אפס שורות.
--
-- --- ה. ספירות, כאימות-נוסף בלבד ------------------------------------------
--   select (select count(*) from public.ys_sessions)       sessions_rows,
--          (select count(*) from public.ys_marks)          marks_rows,
--          (select count(*) from public.ys_students_rows)  students_rows;
--   -- נמדד ב-2026-08-18 (לפני ההרצה): 273 סדרים · 13,083 סימונים · 71 תלמידים.
--   -- ⚠️ המספרים האלה **יגדלו** עד ההרצה — הם נקודת ייחוס, לא יעד.
