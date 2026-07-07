-- ============================================================
-- הנהלה רוחנית — תשתית אבחון סנכרון + גיבוי (שלב 1)
-- הרץ ב-Supabase SQL Editor (פרויקט kxbtskqobynewvnckaaz)
-- ============================================================

-- לוג אבחון סנכרון
create table if not exists public.sync_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz default now(),
  device_id    text,
  user_name    text,
  action       text,
  key          text,
  record_count int,
  details      jsonb
);
grant insert, select on public.sync_log to anon;
alter table public.sync_log enable row level security;
drop policy if exists sync_log_anon on public.sync_log;
create policy sync_log_anon on public.sync_log for all to anon using (true) with check (true);

-- גיבוי יומי של ערכי ה-kv
create table if not exists public.kv_backup (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  key        text,
  value      text
);
grant insert, select on public.kv_backup to anon;
alter table public.kv_backup enable row level security;
drop policy if exists kv_backup_anon on public.kv_backup;
create policy kv_backup_anon on public.kv_backup for all to anon using (true) with check (true);
