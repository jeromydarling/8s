-- 8 Seconds — initial schema.
-- The app runs on bundled seed data without a database; provisioning D1 and
-- applying this migration unlocks persistent lead capture and write-back.

CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT,
  org         TEXT,
  state       TEXT,
  disciplines TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email ON leads (email);

CREATE TABLE IF NOT EXISTS families (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  home_town TEXT,
  state     TEXT,
  plan      TEXT DEFAULT 'Free',
  motto     TEXT
);

CREATE TABLE IF NOT EXISTS contestants (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL REFERENCES families(id),
  first_name   TEXT NOT NULL,
  last_name    TEXT,
  age          INTEGER,
  division     TEXT,
  associations TEXT,   -- JSON array
  disciplines  TEXT,   -- JSON array
  back_number  TEXT,
  bio          TEXT
);
CREATE INDEX IF NOT EXISTS idx_contestants_family ON contestants (family_id);

CREATE TABLE IF NOT EXISTS horses (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  rider_id      TEXT REFERENCES contestants(id),
  name          TEXT NOT NULL,
  barn_name     TEXT,
  breed         TEXT,
  age           INTEGER,
  color         TEXT,
  bloodlines    TEXT,
  role          TEXT,
  trainer       TEXT,
  farrier_due   TEXT,
  vet_due       TEXT,
  vax_current   INTEGER DEFAULT 0,
  insured       INTEGER DEFAULT 0,
  notes         TEXT,
  record        TEXT
);
CREATE INDEX IF NOT EXISTS idx_horses_family ON horses (family_id);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  association    TEXT,
  disciplines    TEXT,  -- JSON array
  divisions      TEXT,  -- JSON array
  venue          TEXT,
  city           TEXT,
  state          TEXT,
  start_date     TEXT,
  end_date       TEXT,
  entry_deadline TEXT,
  draw_posted    INTEGER DEFAULT 0,
  fee_per_event  REAL,
  status         TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_date);

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  contestant_id TEXT REFERENCES contestants(id),
  horse_id      TEXT REFERENCES horses(id),
  event_name    TEXT,
  discipline    TEXT,
  date          TEXT,
  result        TEXT,
  placing       INTEGER,
  points        INTEGER DEFAULT 0,
  footing       TEXT,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_contestant ON runs (contestant_id);

CREATE TABLE IF NOT EXISTS sponsors (
  id            TEXT PRIMARY KEY,
  contestant_id TEXT REFERENCES contestants(id),
  brand         TEXT NOT NULL,
  category      TEXT,
  tier          TEXT,
  annual_value  REAL,
  status        TEXT,
  renewal_date  TEXT,
  deliv_done    INTEGER DEFAULT 0,
  deliv_total   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS arenas (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  city            TEXT,
  state           TEXT,
  status          TEXT,
  years_active    INTEGER,
  threat          TEXT,
  story           TEXT,
  signatures      INTEGER DEFAULT 0,
  signature_goal  INTEGER DEFAULT 0,
  economic_impact REAL DEFAULT 0,
  supporters      INTEGER DEFAULT 0
);
