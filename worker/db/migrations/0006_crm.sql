-- CRM + retention. Adds lifecycle/health signals to users, a unified customer
-- communication timeline, tags, admin follow-up tasks, and a triage stage on
-- inbound leads. All additive; existing rows default sensibly.

ALTER TABLE users ADD COLUMN last_active_at TEXT;                 -- ISO; touched on activity
ALTER TABLE users ADD COLUMN lifecycle      TEXT DEFAULT 'active'; -- lead|trial|active|at_risk|churned|won_back
ALTER TABLE users ADD COLUMN health_score   INTEGER;             -- 0-100, recomputed by cron
ALTER TABLE users ADD COLUMN plan_status    TEXT;                -- stripe: active|past_due|canceled|paused
ALTER TABLE users ADD COLUMN plan_renews_at TEXT;                -- ISO; current period end
ALTER TABLE users ADD COLUMN paused_until   TEXT;                -- ISO; cancel-save pause

CREATE INDEX IF NOT EXISTS idx_users_lifecycle ON users (lifecycle);
CREATE INDEX IF NOT EXISTS idx_users_health ON users (health_score);

-- One timeline per customer: outbound emails, inbound replies, and private notes.
CREATE TABLE IF NOT EXISTS customer_messages (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  direction  TEXT NOT NULL,   -- out | in | note
  channel    TEXT NOT NULL,   -- email | note | support
  subject    TEXT,
  body       TEXT,
  author     TEXT,            -- admin email, or 'system'
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cmsg_user ON customer_messages (user_id, created_at);

-- Free-form segmentation tags.
CREATE TABLE IF NOT EXISTS customer_tags (
  user_id    TEXT NOT NULL,
  tag        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, tag)
);

-- Admin follow-up reminders ("call the Hollis family Friday").
CREATE TABLE IF NOT EXISTS admin_tasks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,            -- optional: task about a specific customer
  title      TEXT NOT NULL,
  due_date   TEXT,
  done_at    TEXT,
  author     TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_open ON admin_tasks (done_at, due_date);

-- Lead inbox triage stage (leads table already exists from 0001).
ALTER TABLE leads ADD COLUMN stage TEXT DEFAULT 'new';  -- new|contacted|qualified|converted|archived
