-- PMDD tracker schema. Apply with: npm run db:schema:remote (or :local for dev).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_len INTEGER NOT NULL DEFAULT 28,
  luteal_start INTEGER NOT NULL DEFAULT 15
);

-- Each row is a period start date (= cycle day 1). The newest row anchors
-- every computation; logging a new one reorients the whole protocol.
CREATE TABLE IF NOT EXISTS cycles (
  start_date TEXT PRIMARY KEY, -- YYYY-MM-DD, client-local
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checkins (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  mood INTEGER, energy INTEGER, sleep INTEGER, cravings INTEGER, pain INTEGER, -- 1..5
  diet TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dose_log (
  date TEXT NOT NULL, -- YYYY-MM-DD
  item TEXT NOT NULL, -- aeon | glutathione | carnosine | sp6 | elix | elix_extra | d3k2
  done INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, item)
);

-- One row per consumable. remaining = qty_start - doses logged since opened_date.
CREATE TABLE IF NOT EXISTS supplies (
  item TEXT PRIMARY KEY,
  qty_start INTEGER NOT NULL,
  opened_date TEXT NOT NULL -- YYYY-MM-DD
);

INSERT OR IGNORE INTO settings (id, cycle_len, luteal_start) VALUES (1, 28, 15);
-- Anchor: client's most recent period start.
INSERT OR IGNORE INTO cycles (start_date) VALUES ('2026-08-07');
-- Opening inventory (doses per pack/bottle): Elix bottle = ~15 days at 1 tsp/day,
-- D3+K2 bottle = 30 servings of 2 mL.
INSERT OR IGNORE INTO supplies (item, qty_start, opened_date) VALUES
  ('aeon', 30, '2026-08-17'),
  ('glutathione', 30, '2026-08-17'),
  ('carnosine', 30, '2026-08-17'),
  ('sp6', 30, '2026-08-17'),
  ('elix', 15, '2026-08-17'),
  ('d3k2', 30, '2026-08-17');
