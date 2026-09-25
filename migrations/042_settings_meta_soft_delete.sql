-- 042_settings_meta_soft_delete.sql · רצה ואומתה במסד ב-2026-09-25
-- סבב 192 — המפתח `settings_meta` ב-`hr_settings` נמחק מחיקה רכה
-- ⛔ ערכו `{}`, ⚠️ ואף קוד אינו קורא אותו מהענן: ⭐ מפתח חי בלי קורא נקרא כנתון שמישהו צריך.
-- ⚠️ רצה כעדכון נתונים ⛔ ולא כמיגרציה במעקב — ⭐ ולכן אין לה רשומה בטבלת המעקב.

update hr_settings set deleted = true, deleted_at = now(), deleted_by = 'סבב 192',
  updated_at = (extract(epoch from clock_timestamp())*1000)::bigint
  where key = 'settings_meta' and not deleted;
