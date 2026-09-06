-- ============================================================================
-- 029_stamp_bigint_drop_touch.sql — החותמת היא `bigint` של המכשיר
-- ============================================================================
--
-- ⛔ **רץ במסד.**
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסיר את טריגרי ה-`touch` שבצד השרת, ⛔ וממיר
--    את `updated_at` מ-`timestamptz` ל-`bigint` — ⭐ מילישניות מאז העידן,
--    בדיוק מה ש-`Date.now()` מייצר.
--
-- ⛔⛔ **הנימוק:** ⚠️ חותמת שרת הופכת מכשיר שערך אופליין לחדש יותר בטעות
--    ודורסת את עריכתו האמיתית — ⭐ מנוע ההכרעה חייב מקור חותמת **אחד**,
--    ⛔ והוא המכשיר שערך. ⚠️ חמש טבלאות השורות כאן כבר נשאו `bigint` בלי
--    טריגר, ⛔ ושתיים לא: ⭐ ושני טיפוסים לאותו מושג הם שני מנועי הכרעה.
--
-- ⚠️ **ואין `default`** — ⛔ ולא `now()` במילישניות: ⭐ ברירת מחדל בצד השרת
--    היא מקור חותמת שני שמתמלא בשקט כשהקוד שוכח. ⚠️ `not null` בלי ברירה
--    מפיל כתיבה כזו ברעש, ⛔ וזה הרצוי.
--
-- ⛔⛔ **וגם `default 0` יורדת** — ⚠️ מהטבלאות שכבר נשאו `bigint`: ⭐ אפס
--    אינו «לא ידוע» אלא **הישן ביותר**, ⛔ וכתיבה ששכחה את החותמת הייתה
--    מקבלת אותו בשקט וכל עריכה הייתה מנצחת אותה. ⚠️ **נמדד: אפס שורות
--    נושאות אפס** בשש הטבלאות, ⛔ ולכן הברירה מעולם לא נבחרה בפועל.
--
-- ⛔⛔ **`users_touch_updated_at()` נגרעת כאן ובכאן בלבד** — ⚠️ היא משרתת
--    את `ys_users` **ואת** `sl_users`, ⭐ ולכן היא של הפרויקט המשותף:
--    ⛔ והריפו הזה הוא בעליה. ⚠️ ה-`cascade` גורע איתה את שני הטריגרים
--    שתלויים בה, ⛔ ולכן הוא מפורש ואינו תופעת לוואי.
--
-- ⛔ **נמדד לפני ההמרה:** ⚠️ 11 שורות ב-`ys_settings` · 6 ב-`ys_users`.
-- ============================================================================

drop trigger if exists ys_settings_touch  on public.ys_settings;
drop trigger if exists ys_users_touch     on public.ys_users;
-- ⛔ שני הטריגרים האלה נוצרו בריפו הזה על טבלאות שהן של היומן — ⚠️ ולכן
--    הגריעה שלהם כאן: ⭐ מי שיצר הוא שגורע, ⛔ והריפו שבבעלותו הטבלאות
--    גורע אותם אף הוא: ⚠️ `if exists` הופך את השני לחסר-פעולה.
drop trigger if exists kv_rishon_touch    on public.kv_rishon;
drop trigger if exists kv_ramataviv_touch on public.kv_ramataviv;

drop function if exists public.ys_touch_updated_at();
drop function if exists public.kv_touch_updated_at();

-- ⛔ `cascade` — ⚠️ גורע את `sl_users_touch` שנשען עליה, ⭐ אם הוא עדיין קיים.
drop function if exists public.users_touch_updated_at() cascade;

do $$
declare t text;
begin
  foreach t in array array['ys_settings','ys_users'] loop
    if (select data_type from information_schema.columns
          where table_schema = 'public' and table_name = t
            and column_name = 'updated_at') is distinct from 'bigint' then
      execute format('alter table public.%I alter column updated_at drop default', t);
      execute format('alter table public.%I alter column updated_at type bigint '
                     'using (extract(epoch from updated_at) * 1000)::bigint', t);
    end if;
  end loop;
end $$;

-- ⛔ חמש הטבלאות שכבר נשאו `bigint` — ⚠️ הברירה בלבד יורדת מהן.
do $$
declare t text;
begin
  foreach t in array array['ys_marks','ys_sessions','ys_sleep_marks',
                           'ys_sleep_sessions','ys_students_rows'] loop
    execute format('alter table public.%I alter column updated_at drop default', t);
  end loop;
end $$;
