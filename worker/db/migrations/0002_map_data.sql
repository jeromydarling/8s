-- Real-data events + arenas seeded via Perplexity (geocoded to lat/lng).
-- The app reads these when present and falls back to bundled seed otherwise.

CREATE TABLE IF NOT EXISTS map_events (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  association   TEXT,
  disciplines   TEXT,   -- JSON array
  divisions     TEXT,   -- JSON array
  venue         TEXT,
  city          TEXT,
  state         TEXT,
  start_date    TEXT,
  end_date      TEXT,
  entry_deadline TEXT,
  fee_per_event REAL,
  status        TEXT,
  lat           REAL,
  lng           REAL,
  source        TEXT,   -- 'perplexity' | 'seed' | 'manual'
  source_url    TEXT,
  created_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_map_events_start ON map_events (start_date);
CREATE INDEX IF NOT EXISTS idx_map_events_state ON map_events (state);

CREATE TABLE IF NOT EXISTS map_arenas (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  city            TEXT,
  state           TEXT,
  status          TEXT,
  years_active    INTEGER,
  threat          TEXT,
  story           TEXT,
  economic_impact REAL,
  lat             REAL,
  lng             REAL,
  source          TEXT,
  source_url      TEXT,
  created_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_map_arenas_status ON map_arenas (status);
