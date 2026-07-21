-- Dedup marker so the renewal-reminder cron emails each renewal at most once.
ALTER TABLE users ADD COLUMN renewal_reminded_at TEXT;
