-- 8 Seconds — accounts, persistence, alerts, analytics, supply-side submissions.

-- First-party analytics (no third party needed).
CREATE TABLE IF NOT EXISTS analytics_events (
  id         TEXT PRIMARY KEY,
  ts         TEXT NOT NULL,
  session    TEXT,
  user_id    TEXT,
  name       TEXT NOT NULL,
  path       TEXT,
  referrer   TEXT,
  props      TEXT
);
CREATE INDEX IF NOT EXISTS idx_an_ts ON analytics_events (ts);
CREATE INDEX IF NOT EXISTS idx_an_name ON analytics_events (name);

-- Real user accounts.
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  salt        TEXT NOT NULL,
  name        TEXT,
  role        TEXT,
  state       TEXT,
  home_lat    REAL,
  home_lng    REAL,
  created_at  TEXT NOT NULL
);

-- Per-user roster.
CREATE TABLE IF NOT EXISTS contestants_u (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT,
  birthdate   TEXT,
  division    TEXT,
  associations TEXT,
  disciplines TEXT,
  back_number TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cu_user ON contestants_u (user_id);

CREATE TABLE IF NOT EXISTS horses_u (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  rider_id    TEXT,
  name        TEXT NOT NULL,
  barn_name   TEXT,
  breed       TEXT,
  color       TEXT,
  role        TEXT,
  farrier_due TEXT,
  vet_due     TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hu_user ON horses_u (user_id);

-- Events a user is watching / entered (references map_events.id or seed id).
CREATE TABLE IF NOT EXISTS watchlist (
  user_id    TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  status     TEXT DEFAULT 'watching', -- watching | entered
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

-- Alert subscriptions + the alert feed the cron fills.
CREATE TABLE IF NOT EXISTS alert_subs (
  user_id     TEXT PRIMARY KEY,
  email       TEXT,
  channels    TEXT,          -- json: ["email"]
  states      TEXT,          -- json array
  disciplines TEXT,          -- json array
  lead_days   INTEGER DEFAULT 7,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  event_id   TEXT,
  kind       TEXT,           -- entry-deadline | draw-posted
  title      TEXT,
  body       TEXT,
  due_date   TEXT,
  created_at TEXT NOT NULL,
  read_at    TEXT,
  sent_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id, created_at);

-- Supply side: associations/secretaries submit events for review.
CREATE TABLE IF NOT EXISTS event_submissions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  association  TEXT,
  disciplines TEXT,
  venue       TEXT,
  city        TEXT,
  state       TEXT,
  start_date  TEXT,
  entry_deadline TEXT,
  contact_email TEXT,
  source_url  TEXT,
  status      TEXT DEFAULT 'pending', -- pending | approved | rejected
  created_at  TEXT NOT NULL
);
