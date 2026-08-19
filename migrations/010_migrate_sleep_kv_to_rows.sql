-- ============================================================================
-- 010_migrate_sleep_kv_to_rows.sql — העברת סדרי השינה לשכבת השורות (סבב 39)
-- ============================================================================
-- ⛔⛔ **הקובץ הזה נכתב ולא הורץ (סבב 39) — «נכתב» אינו «רץ».** הרצתו היא
--     החלטת המנהל, ⛔ **אחרי** `009` ואחרי גיבוי מאומת של `kv.ys_sleep_sessions`
--     — הוא נקודת החזרה. סדר ההרצה: גיבוי מאומת ← `009` ← `010` ← בדיקת
--     השקילות שבסוף הקובץ.
--
-- ── מה הוא עושה ────────────────────────────────────────────────────────────
-- מעתיק `kv.ys_sleep_sessions` ל-`ys_sleep_sessions` + `ys_sleep_marks`.
-- ⛔ **אינו מוחק דבר ואינו נוגע ב-`kv`** — `kv` נשאר המאסטר לכל אורך שלב א,
-- והכתיבה הכפולה שב-`index.html` היא שמחזיקה את שני הצדדים מסונכרנים.
--
-- ⭐ **אידמפוטנטית דרך `on conflict do nothing`, ולא דרך `truncate`+טעינה.**
--    ⛔ זו הנקודה שאסור להפוך ל-`do update` (סבב 36, וחל כאן מילה במילה):
--    ה-`kv` והשורות מתעדכנים משני מסלולים, ו-`do update` היה מחזיר את גרסת
--    ה-`kv` מעל עריכה חדשה יותר שכבר יושבת בשורה — אובדן עריכה שקט.
--    ⚠️ ולכן אם ההרצה נעשית **אחרי** שהכתיבה הכפולה כבר רצה זמן מה, היא
--    תהיה בפועל **no-op** — וזו העדות שההרצה נותנת.
--
-- ── ⚠️ שלוש החלטות מיפוי, ושתיים מהן זהות ל-`006` ──────────────────────────
-- 1. **`updated_at` של הסימון יורש את חותמת הסדר.** לסימון בודד אין
--    `updatedAt` משלו ב-`kv`. ⛔ אין להמציא כאן `now()` (סבב 36) — חותמת
--    שנוצרת בזמן ההעברה היא חדשה מכל עריכה מקומית שטרם עלתה, ובמיזוג הראשון
--    הייתה דורסת אותה.
-- 2. **`deleted` של הסימון יורש את `deleted` של האב.** ⛔ חובה ולא נוחות
--    (סבב 36): הדוח פר-תלמיד קורא את טבלת הבן **בלי join לאב**, ולכן סימון
--    של סדר מחוק שהיה נשאר `deleted=false` היה דולף לדוח כרשומה חיה.
--    ⚠️ באף סדר שינה עדיין לא נעשתה מחיקה, ולכן `deleted` פשוט אינו מופיע
--    ברשומות — ה-`coalesce(...,false)` הוא מה שמטפל בכך, ⛔ ואין להסיר אותו
--    בטענה ש«השדה תמיד קיים» (סבב 39): הוא אינו.
-- 3. ⭐ **`note` מועבר, ולא מושמט** (סבב 39) — זה ההבדל היחיד מהנוכחות.
--    25 סימונים נושאים הערה, הארוכה 248 תווים. ⛔ השמטתו הייתה הופכת את
--    בדיקת השקילות שלמטה לשקר: היא הייתה עוברת בזמן שהערה שנכתבה במכשיר
--    אינה מגיעה לשכבת השורות כלל.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. ys_sleep_sessions — האב
-- ────────────────────────────────────────────────────────────────────────────
insert into public.ys_sleep_sessions
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
where k.key = 'ys_sleep_sessions'
  and jsonb_typeof(k.value::jsonb) = 'array'
  and e->>'id' is not null
on conflict (client_id) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ys_sleep_marks — הבן
-- ────────────────────────────────────────────────────────────────────────────
-- ⭐ **מפתח ה-`marks` עובר כמחרוזת, בלי סינון וללא המרה** — הלקח של `008`
--    מיושם כאן **מלכתחילה**: מזהה תלמיד הוא uuid מסבב 37, וסינון `^\d+$`
--    או `::smallint` היה משמיט בשקט את כל הסימונים של התלמידים החדשים.
insert into public.ys_sleep_marks
  (client_id, session_client_id, student_id, date_iso, status, minutes,
   note, deleted, updated_at)
select
  (e->>'id') || ':' || m.key,
  e->>'id',
  m.key,
  coalesce(e->>'date_iso', ''),
  m.value->>'s',
  coalesce(nullif(m.value->>'min', '')::numeric, 0)::smallint,
  m.value->>'note',
  coalesce(case when jsonb_typeof(e->'deleted') = 'boolean' then (e->>'deleted')::boolean end, false),
  coalesce(nullif(e->>'updatedAt', '')::bigint, 0)
from public.kv k,
     lateral jsonb_array_elements(k.value::jsonb) e,
     lateral jsonb_each(e->'marks') m
where k.key = 'ys_sleep_sessions'
  and jsonb_typeof(k.value::jsonb) = 'array'
  and e->>'id' is not null
  and jsonb_typeof(e->'marks') = 'object'
on conflict (client_id) do nothing;


-- ============================================================================
-- בדיקת שקילות דו-כיוונית (SELECT בלבד — להריץ אחרי ההעברה)
-- ============================================================================
-- ⚠️ **דו-כיוונית ולא ספירה אחת.** ספירה שווה אינה שקילות: היא עוברת גם
--    כששורה אחת חסרה ושורה אחרת עודפת. שתי השאילתות מחזירות את ההפרש
--    **בשני הכיוונים**, וההצלחה היא **אפס שורות בשתיהן**.
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
--     where k.key='ys_sleep_sessions' and e->>'id' is not null)
--   select 'kv בלבד' src, cid, ses, d from (
--     select cid,ses,d,upd,del from kvs
--     except select client_id,session,date_iso,updated_at,deleted
--            from public.ys_sleep_sessions) x
--   union all
--   select 'שורות בלבד', client_id, session, date_iso from (
--     select client_id,session,date_iso,updated_at,deleted from public.ys_sleep_sessions
--     except select cid,ses,d,upd,del from kvs) y;
--   -- ציפייה: אפס שורות.
--
-- --- ב. סימונים (כולל `note`) ---------------------------------------------
--   ⭐ `note` נכלל בהשוואה בכוונה — בלעדיו הבדיקה הייתה עוברת גם אם ההערות
--      לא הועברו כלל.
--   with kvm as (
--     select (e->>'id')||':'||m.key cid,
--            (e->>'id') scid,
--            m.key sid,
--            coalesce(e->>'date_iso','') d,
--            m.value->>'s' st,
--            coalesce(nullif(m.value->>'min','')::numeric,0)::smallint mn,
--            m.value->>'note' nt
--     from public.kv k, lateral jsonb_array_elements(k.value::jsonb) e,
--          lateral jsonb_each(e->'marks') m
--     where k.key='ys_sleep_sessions' and e->>'id' is not null
--       and jsonb_typeof(e->'marks')='object')
--   select 'kv בלבד' src, cid from (
--     select cid,scid,sid,d,st,mn,nt from kvm
--     except select client_id,session_client_id,student_id,date_iso,status,minutes,note
--            from public.ys_sleep_marks) x
--   union all
--   select 'שורות בלבד', client_id from (
--     select client_id,session_client_id,student_id,date_iso,status,minutes,note
--     from public.ys_sleep_marks
--     except select cid,scid,sid,d,st,mn,nt from kvm) y;
--   -- ציפייה: אפס שורות.
--
-- --- ג. מונים (לעין בלבד — ⛔ אינם תחליף לסעיפים א/ב) ----------------------
--   select (select count(*) from public.ys_sleep_sessions) sessions,
--          (select count(*) from public.ys_sleep_marks)    marks;
--   -- נמדד ב-2026-08-19 ב-`kv`: 21 סדרים · 988 סימונים.
