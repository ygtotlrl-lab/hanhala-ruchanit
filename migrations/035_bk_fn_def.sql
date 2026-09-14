-- ============================================================================
-- 035_bk_fn_def.sql — ההגדרה החיה נקראת מהמסד
-- ============================================================================
--
-- ⛔ **רץ במסד** — ⚠️ הוחלה בסבב 144 ואומתה: `bk_fn_def` מחזירה את
--    ההגדרה החיה לשלושת השמות המוכרזים, ⛔ ו-`null` לכל שם אחר.
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מוסיף פונקציית קריאה אחת, `bk_fn_def`,
--    ⭐ שמחזירה את ההגדרה החיה של פונקציית פינוי אחת מתוך שלוש
--    מוכרזות — `pg_get_functiondef` על הקטלוג.
--
-- ⛔⛔ **הנימוק:** ⚠️ גוף `plpgsql` הוא טקסט, ⛔ והסבת שם טבלה אינה
--    נוגעת בו: ⭐ קובץ המיגרציה מתאר את מה שנכתב פעם, ⛔ וההגדרה החיה
--    היא מה שירוץ הלילה. ⚠️ ובלי מסלול קריאה, השער מודד היסטוריה
--    ומדווח «עבר» על פינוי שנופל ב-03:00.
--
-- ⛔ **ורשימת ההיתר בגוף הפונקציה** — ⚠️ שלושה שמות ותו לא:
--    ⭐ הקטלוג פתוח לקריאה לכל תפקיד, ⛔ אבל פונקציה שמחזירה כל הגדרה
--    היא כלי סריקה — ⚠️ והיא מחזירה `null` לכל שם אחר.
--
-- ⛔ **ואין בה נתונים** — ⚠️ היא קוראת מ-`pg_proc` בלבד: ⭐ אפס גישה
--    לטבלאות, ⛔ ולכן `security invoker` ו-`stable`.
--
create or replace function public.bk_fn_def(p_name text)
returns text
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = p_name
     and p_name in ('bk_retention_keys', 'bk_retention_sweep', 'bk_prune_layer')
   limit 1;
$function$;

revoke all on function public.bk_fn_def(text) from public;
grant execute on function public.bk_fn_def(text) to anon, authenticated, service_role;
