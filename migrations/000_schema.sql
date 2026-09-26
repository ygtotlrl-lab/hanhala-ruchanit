-- ═══ 000_schema.sql — הנהלה רוחנית: הסכימה החיה ════════════════════════

-- ─── משותף לפרויקט ─────────────────────────────────────────────────────

create extension if not exists pg_cron;

create table if not exists public.sh_backup (
  id bigint generated always as identity,
  created_at timestamp with time zone default now(),
  key text,
  value text,
  constraint sh_backup_pkey PRIMARY KEY (id)
);

create table if not exists public.sh_sync_log (
  id bigint generated always as identity,
  created_at timestamp with time zone default now(),
  device_id text,
  user_name text,
  action text,
  key text,
  record_count integer,
  details jsonb,
  constraint sh_sync_log_pkey PRIMARY KEY (id)
);

create index if not exists sh_backup_key_created_idx ON public.sh_backup USING btree (key, created_at DESC);

-- ⛔ revoke לפני grant — GRANT מוסיף ואינו מחליף, וטבלה חדשה ב-Supabase נולדת
--    עם DELETE ו-TRUNCATE ל-anon: המחיקה היא deleted=true, ולא DELETE.
-- ⚠️ יומן תוספת-בלבד — אין לו UPDATE: גיבוי ולוג נכתבים פעם אחת.
revoke all on table public.sh_backup from anon, authenticated;
grant select, insert on table public.sh_backup to anon, authenticated;
grant all on table public.sh_backup to service_role;
revoke all on table public.sh_sync_log from anon, authenticated;
grant select, insert on table public.sh_sync_log to anon, authenticated;
grant all on table public.sh_sync_log to service_role;
revoke all on sequence public.sh_backup_id_seq from anon, authenticated;
grant usage, select, update on sequence public.sh_backup_id_seq to anon, authenticated, service_role;
revoke all on sequence public.sh_sync_log_id_seq from anon, authenticated;
grant usage, select, update on sequence public.sh_sync_log_id_seq to anon, authenticated, service_role;

alter table public.sh_backup enable row level security;
drop policy if exists sh_backup_insert on public.sh_backup;
create policy sh_backup_insert on public.sh_backup as permissive for insert to anon, authenticated with check (true);
drop policy if exists sh_backup_select on public.sh_backup;
create policy sh_backup_select on public.sh_backup as permissive for select to anon, authenticated using (true);
alter table public.sh_sync_log enable row level security;
drop policy if exists sh_sync_log_insert on public.sh_sync_log;
create policy sh_sync_log_insert on public.sh_sync_log as permissive for insert to anon, authenticated with check (true);
drop policy if exists sh_sync_log_select on public.sh_sync_log;
create policy sh_sync_log_select on public.sh_sync_log as permissive for select to anon, authenticated using (true);

CREATE OR REPLACE FUNCTION public.bk_fn_def(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = p_name
     and p_name in ('bk_retention_keys', 'bk_retention_sweep', 'bk_prune_layer')
   limit 1;
$function$;
revoke all on function public.bk_fn_def(text) from public, anon, authenticated, service_role;
grant execute on function public.bk_fn_def(text) to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bk_prune_layer(p_prefix text, p_keep integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deleted integer := 0;
begin
  if p_prefix is null or p_prefix not in ('ANCHOR:', 'DIFF:') then
    raise exception 'bk_prune_layer: תבנית שאינה מוכרת — %', p_prefix;
  end if;
  if p_keep is null or p_keep < 2 then
    raise exception 'bk_prune_layer: תקרה קטנה משניים — מסרב לרוץ';
  end if;
  with ranked as (
    select id, row_number() over (partition by key order by created_at desc) rn
      from public.sh_backup
     where key like p_prefix || '%'
  )
  delete from public.sh_backup b
   using ranked r
   where b.id = r.id and r.rn > p_keep;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    insert into public.sh_sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_deleted,
            jsonb_build_object('layer', p_prefix, 'keep', p_keep));
  end if;
  return v_deleted;
end;
$function$;
revoke all on function public.bk_prune_layer(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.bk_prune_layer(text,integer) to service_role;

-- ⛔ רשימת-ההיתר היא בדיוק מפתחות הגיבוי שהקוד כותב — מפתח שאינו בה אינו מתפנה.
CREATE OR REPLACE FUNCTION public.bk_retention_keys()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select array[
    'hr_sessions_rows', 'hr_marks_rows', 'hr_students_rows',
    'hr_sleep_sessions_rows', 'hr_sleep_marks_rows', 'hr_settings',
    'sl_students', 'sl_transactions', 'sl_settings', 'sl_lists',
    'rishon_ya_entries_rows', 'rishon_ya_cats', 'rishon_ya_subs', 'rishon_ya_subs_meta',
    'ramataviv_ya_entries_rows', 'ramataviv_ya_cats', 'ramataviv_ya_subs', 'ramataviv_ya_subs_meta'
  ]::text[];
$function$;
revoke all on function public.bk_retention_keys() from public, anon, authenticated, service_role;
grant execute on function public.bk_retention_keys() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bk_retention_sweep(p_days integer DEFAULT 30, p_keep integer DEFAULT 7)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_keys text[] := public.bk_retention_keys();
  v_age  integer := 0;
  v_cap  integer := 0;
begin
  if v_keys is null or cardinality(v_keys) = 0 then
    raise exception 'bk_retention_sweep: רשימת-ההיתר ריקה — מסרב לרוץ';
  end if;
  if p_days is null or p_days < 7 then
    raise exception 'bk_retention_sweep: חלון קצר מ-7 ימים — מסרב לרוץ';
  end if;
  if p_keep is null or p_keep < 1 then
    raise exception 'bk_retention_sweep: תקרת עותקים קטנה מ-1 — מסרב לרוץ';
  end if;

  delete from public.sh_backup
   where key = any (v_keys)
     and created_at < now() - make_interval(days => p_days);
  get diagnostics v_age = row_count;

  with ranked as (
    select id,
           row_number() over (partition by key
                              order by created_at desc, id desc) as rn
      from public.sh_backup
     where key = any (v_keys)
  )
  delete from public.sh_backup b
   using ranked r
   where b.id = r.id
     and r.rn > p_keep;
  get diagnostics v_cap = row_count;

  if (v_age + v_cap) > 0 then
    insert into public.sh_sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_age + v_cap,
            jsonb_build_object('days', p_days, 'keep', p_keep,
                               'keys', cardinality(v_keys), 'aged', v_age, 'capped', v_cap));
  end if;

  return v_age + v_cap;
end;
$function$;
revoke all on function public.bk_retention_sweep(integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.bk_retention_sweep(integer,integer) to service_role;

-- ⚠️ משימה לפי שמה — cron.schedule בשם קיים מעדכן אותה, ואינו מוסיף שנייה.
select cron.schedule('bk_prune_layers', '10 3 * * *', 'select public.bk_prune_layer(''ANCHOR:'', 4), public.bk_prune_layer(''DIFF:'', 30);');
select cron.schedule('bk_retention_daily', '0 3 * * *', 'select public.bk_retention_sweep(30, 7);');
select cron.schedule('sh_sync_log_retention', '20 3 * * *', 'delete from public.sh_sync_log where created_at < now() - interval ''30 days'';');
select cron.schedule('cron_run_log_retention', '25 3 * * *', 'delete from cron.job_run_details where start_time < now() - interval ''30 days'' or jobid not in (select jobid from cron.job);');

-- ─── הנהלה רוחנית ──────────────────────────────────────────────────────

create table if not exists public.hr_marks (
  client_id text not null,
  session_client_id text not null,
  student_id text not null,
  date_iso text not null,
  status text,
  minutes smallint,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint hr_marks_pkey PRIMARY KEY (client_id)
);

create table if not exists public.hr_sessions (
  client_id text not null,
  session text not null,
  date_iso text not null,
  date_heb jsonb,
  filled_by smallint,
  filled_by_name text,
  created_at text,
  created_by text,
  deleted_by text,
  open boolean,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  constraint hr_sessions_pkey PRIMARY KEY (client_id)
);

create table if not exists public.hr_settings (
  key text not null,
  value text,
  updated_at bigint not null,
  client_id text,
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint hr_settings_pkey PRIMARY KEY (key),
  constraint hr_settings_value_json CHECK (((value IS NULL) OR ((value)::jsonb IS NOT NULL)))
);

create table if not exists public.hr_sleep_marks (
  client_id text not null,
  session_client_id text not null,
  student_id text not null,
  date_iso text not null,
  status text,
  minutes smallint,
  note text,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint hr_sleep_marks_pkey PRIMARY KEY (client_id)
);

create table if not exists public.hr_sleep_sessions (
  client_id text not null,
  session text not null,
  date_iso text not null,
  date_heb jsonb,
  filled_by smallint,
  filled_by_name text,
  created_at text,
  created_by text,
  deleted_by text,
  open boolean,
  deleted boolean not null default false,
  updated_at bigint not null,
  synced_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  constraint hr_sleep_sessions_pkey PRIMARY KEY (client_id)
);

create table if not exists public.hr_students_rows (
  client_id text not null,
  student_id text,
  updated_at bigint not null,
  deleted boolean not null default false,
  data jsonb not null,
  synced_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint hr_students_rows_pkey PRIMARY KEY (client_id)
);

create table if not exists public.hr_users (
  client_id text not null,
  username text not null,
  full_name text not null,
  role text not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  pass_salt text,
  pass_fp text,
  constraint hr_users_pkey PRIMARY KEY (client_id),
  constraint hr_users_username_key UNIQUE (username),
  constraint hr_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'junior'::text])))
);

create index if not exists hr_marks_date_idx ON public.hr_marks USING btree (date_iso DESC);
create index if not exists hr_marks_session_idx ON public.hr_marks USING btree (session_client_id);
create UNIQUE index if not exists hr_marks_session_student ON public.hr_marks USING btree (session_client_id, student_id);
create index if not exists hr_marks_student_date_idx ON public.hr_marks USING btree (student_id, date_iso DESC);
create index if not exists hr_sessions_date_idx ON public.hr_sessions USING btree (date_iso DESC);
create index if not exists hr_sessions_session_date_idx ON public.hr_sessions USING btree (session, date_iso DESC);
create index if not exists hr_sessions_updated_idx ON public.hr_sessions USING btree (updated_at DESC);
create index if not exists hr_sleep_marks_date_idx ON public.hr_sleep_marks USING btree (date_iso DESC);
create index if not exists hr_sleep_marks_session_idx ON public.hr_sleep_marks USING btree (session_client_id);
create UNIQUE index if not exists hr_sleep_marks_session_student ON public.hr_sleep_marks USING btree (session_client_id, student_id);
create index if not exists hr_sleep_marks_student_date_idx ON public.hr_sleep_marks USING btree (student_id, date_iso DESC);
create index if not exists hr_sleep_sessions_date_idx ON public.hr_sleep_sessions USING btree (date_iso DESC);
create index if not exists hr_sleep_sessions_session_date_idx ON public.hr_sleep_sessions USING btree (session, date_iso DESC);
create index if not exists hr_sleep_sessions_updated_idx ON public.hr_sleep_sessions USING btree (updated_at DESC);
create index if not exists hr_students_rows_updated_idx ON public.hr_students_rows USING btree (updated_at DESC);

-- ⛔ revoke לפני grant — GRANT מוסיף ואינו מחליף, וטבלה חדשה ב-Supabase נולדת
--    עם DELETE ו-TRUNCATE ל-anon: המחיקה היא deleted=true, ולא DELETE.
revoke all on table public.hr_marks from anon, authenticated;
grant select, insert, update on table public.hr_marks to anon, authenticated;
grant all on table public.hr_marks to service_role;
revoke all on table public.hr_sessions from anon, authenticated;
grant select, insert, update on table public.hr_sessions to anon, authenticated;
grant all on table public.hr_sessions to service_role;
revoke all on table public.hr_settings from anon, authenticated;
grant select, insert, update on table public.hr_settings to anon, authenticated;
grant all on table public.hr_settings to service_role;
revoke all on table public.hr_sleep_marks from anon, authenticated;
grant select, insert, update on table public.hr_sleep_marks to anon, authenticated;
grant all on table public.hr_sleep_marks to service_role;
revoke all on table public.hr_sleep_sessions from anon, authenticated;
grant select, insert, update on table public.hr_sleep_sessions to anon, authenticated;
grant all on table public.hr_sleep_sessions to service_role;
revoke all on table public.hr_students_rows from anon, authenticated;
grant select, insert, update on table public.hr_students_rows to anon, authenticated;
grant all on table public.hr_students_rows to service_role;
revoke all on table public.hr_users from anon, authenticated;
grant select, insert, update on table public.hr_users to anon, authenticated;
grant all on table public.hr_users to service_role;

alter table public.hr_marks enable row level security;
drop policy if exists hr_marks_all on public.hr_marks;
create policy hr_marks_all on public.hr_marks as permissive for all to anon, authenticated using (true) with check (true);
alter table public.hr_sessions enable row level security;
drop policy if exists hr_sessions_all on public.hr_sessions;
create policy hr_sessions_all on public.hr_sessions as permissive for all to anon, authenticated using (true) with check (true);
alter table public.hr_settings enable row level security;
drop policy if exists hr_settings_all on public.hr_settings;
create policy hr_settings_all on public.hr_settings as permissive for all to anon, authenticated using (true) with check (true);
alter table public.hr_sleep_marks enable row level security;
drop policy if exists hr_sleep_marks_all on public.hr_sleep_marks;
create policy hr_sleep_marks_all on public.hr_sleep_marks as permissive for all to anon, authenticated using (true) with check (true);
alter table public.hr_sleep_sessions enable row level security;
drop policy if exists hr_sleep_sessions_all on public.hr_sleep_sessions;
create policy hr_sleep_sessions_all on public.hr_sleep_sessions as permissive for all to anon, authenticated using (true) with check (true);
alter table public.hr_students_rows enable row level security;
drop policy if exists hr_students_rows_all on public.hr_students_rows;
create policy hr_students_rows_all on public.hr_students_rows as permissive for all to anon, authenticated using (true) with check (true);
alter table public.hr_users enable row level security;
drop policy if exists hr_users_all on public.hr_users;
create policy hr_users_all on public.hr_users as permissive for all to anon, authenticated using (true) with check (true);
