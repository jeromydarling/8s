-- Email verification + password reset support.

ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';

CREATE TABLE IF NOT EXISTS email_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  email      TEXT,
  kind       TEXT NOT NULL,        -- verify | reset
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tok_user ON email_tokens (user_id);
