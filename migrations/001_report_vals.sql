-- גיליון הציונים וההנהגה: השדות שהרב ממלא — שורה לכל חודש עברי, תלמיד ושדה. client_id = <חודש>:<תלמיד>:<שדה>.
create table if not exists public.hr_report_vals (
  client_id text not null,
  month text not null,
  student_client_id text not null,
  field text not null,
  value text,
  deleted boolean not null default false,
  updated_at bigint not null,
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint hr_report_vals_pkey primary key (client_id)
);
create index if not exists hr_report_vals_month_idx on public.hr_report_vals using btree (month);
create index if not exists hr_report_vals_updated_idx on public.hr_report_vals using btree (updated_at desc);
revoke all on table public.hr_report_vals from anon, authenticated;
grant select, insert, update on table public.hr_report_vals to anon, authenticated;
grant all on table public.hr_report_vals to service_role;
alter table public.hr_report_vals enable row level security;
drop policy if exists hr_report_vals_all on public.hr_report_vals;
create policy hr_report_vals_all on public.hr_report_vals as permissive for all to anon, authenticated using (true) with check (true);

-- רשימת הפינוי של הגיבויים — הטבלה החדשה (זהה בשני הפרויקטים).
CREATE OR REPLACE FUNCTION public.bk_retention_keys()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select array[
    'ANCHOR:hr_sessions', 'DIFF:hr_sessions',
    'ANCHOR:hr_marks', 'DIFF:hr_marks',
    'ANCHOR:hr_students_rows', 'DIFF:hr_students_rows',
    'ANCHOR:hr_sleep_sessions', 'DIFF:hr_sleep_sessions',
    'ANCHOR:hr_sleep_marks', 'DIFF:hr_sleep_marks',
    'ANCHOR:hr_exams', 'DIFF:hr_exams',
    'ANCHOR:hr_exam_marks', 'DIFF:hr_exam_marks',
    'ANCHOR:hr_report_vals', 'DIFF:hr_report_vals',
    'ANCHOR:hr_settings', 'DIFF:hr_settings',
    'ANCHOR:sl_students', 'DIFF:sl_students',
    'ANCHOR:sl_transactions', 'DIFF:sl_transactions',
    'ANCHOR:sl_settings', 'DIFF:sl_settings',
    'ANCHOR:sl_lookups', 'DIFF:sl_lookups',
    'ANCHOR:rishon_ya_entries', 'DIFF:rishon_ya_entries',
    'ANCHOR:rishon_ya_settings_rishon', 'DIFF:rishon_ya_settings_rishon',
    'ANCHOR:ramataviv_ya_entries', 'DIFF:ramataviv_ya_entries',
    'ANCHOR:ramataviv_ya_settings_ramataviv', 'DIFF:ramataviv_ya_settings_ramataviv',
    'ANCHOR:g_donors', 'DIFF:g_donors',
    'ANCHOR:g_pledges', 'DIFF:g_pledges',
    'ANCHOR:g_txns', 'DIFF:g_txns',
    'ANCHOR:g_tasks', 'DIFF:g_tasks',
    'ANCHOR:g_targets', 'DIFF:g_targets',
    'ANCHOR:g_settings', 'DIFF:g_settings',
    'ANCHOR:g_lookups', 'DIFF:g_lookups',
    'ANCHOR:g_plan_items', 'DIFF:g_plan_items',
    'ANCHOR:g_notes', 'DIFF:g_notes',
    'ANCHOR:g_loans', 'DIFF:g_loans',
    'ANCHOR:g_budget_items', 'DIFF:g_budget_items',
    'ANCHOR:g_loan_moves', 'DIFF:g_loan_moves',
    'ANCHOR:g_events', 'DIFF:g_events',
    'ANCHOR:k_settings', 'DIFF:k_settings',
    'ANCHOR:k_pledges', 'DIFF:k_pledges',
    'ANCHOR:k_standing_orders', 'DIFF:k_standing_orders',
    'ANCHOR:k_so_instances', 'DIFF:k_so_instances',
    'ANCHOR:k_entries', 'DIFF:k_entries',
    'ANCHOR:k_lookups', 'DIFF:k_lookups',
    'ANCHOR:s_settings', 'DIFF:s_settings'
  ]::text[];
$function$;
