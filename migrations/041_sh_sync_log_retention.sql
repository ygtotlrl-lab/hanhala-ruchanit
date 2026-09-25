-- 041_sh_sync_log_retention.sql · רצה ואומתה במסד ב-2026-09-25
-- סבב 191 — `sh_sync_log` נשמר 30 יום, ⭐ בגריעה יומית ב-`pg_cron`
-- ⛔ רצה במסד «הישיבה» — ⚠️ בלי תקן שמירה היומן גדל לנצח, ⭐ ו-`sh_backup` כבר נשמר לפי תקן.
-- ⚠️ ב-03:20 — ⭐ אחרי פינוי הגיבויים (03:00) ושכבות הגיבוי (03:10), ⛔ ולא באותה דקה.

select cron.schedule('sh_sync_log_retention', '20 3 * * *',
  $$ delete from public.sh_sync_log where created_at < now() - interval '30 days'; $$);
