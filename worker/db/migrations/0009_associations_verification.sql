-- Association site-license + data verification + crowd corrections + onboarding.
-- All additive. Apply to remote D1 before deploying the code that reads these.

-- Associations are the paying site-license customers. Any family that joins
-- with the association's invite code gets the Family plan bundled at no charge.
CREATE TABLE IF NOT EXISTS associations (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  abbreviation           TEXT,                 -- e.g. NHSRA, THSRA (matches map_events.association)
  state                  TEXT,
  contact_email          TEXT,
  invite_code            TEXT UNIQUE,          -- families join with this
  owner_user_id          TEXT,                 -- the account that bought / was granted it
  plan_status            TEXT DEFAULT 'active',-- active | paused | canceled
  seat_limit             INTEGER DEFAULT 200,  -- bundled family seats
  stripe_subscription_id TEXT,
  verified               INTEGER DEFAULT 0,    -- admin-confirmed real association (its data counts as verified)
  created_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assoc_code ON associations (invite_code);

CREATE TABLE IF NOT EXISTS association_admins (
  association_id TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  role           TEXT DEFAULT 'admin',        -- owner | admin
  created_at     TEXT NOT NULL,
  PRIMARY KEY (association_id, user_id)
);

-- Users: association membership, onboarding answers, and where their plan came from.
ALTER TABLE users ADD COLUMN association_id TEXT;
ALTER TABLE users ADD COLUMN disciplines    TEXT;   -- JSON array from onboarding
ALTER TABLE users ADD COLUMN plan_source    TEXT;   -- 'self' | 'association'
ALTER TABLE users ADD COLUMN onboarded_at   TEXT;
CREATE INDEX IF NOT EXISTS idx_users_assoc ON users (association_id);

-- Verification stamps on real data. NULL verified_at + source='perplexity' = AI-estimated.
ALTER TABLE map_events ADD COLUMN verified_at TEXT;
ALTER TABLE map_events ADD COLUMN verified_by TEXT;   -- association id | 'admin'
ALTER TABLE map_arenas ADD COLUMN verified_at TEXT;
ALTER TABLE map_arenas ADD COLUMN verified_by TEXT;

-- Crowd corrections: any signed-in family can flag/correct a field; admins or
-- the owning association review and apply.
CREATE TABLE IF NOT EXISTS data_corrections (
  id              TEXT PRIMARY KEY,
  target_type     TEXT NOT NULL,              -- event | arena
  target_id       TEXT NOT NULL,
  field           TEXT,                       -- entry_deadline | start_date | venue | ... | other
  suggested_value TEXT,
  note            TEXT,
  submitted_by    TEXT,                       -- user id
  status          TEXT DEFAULT 'pending',     -- pending | approved | rejected
  reviewed_by     TEXT,
  created_at      TEXT NOT NULL,
  reviewed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_corr_status ON data_corrections (status, created_at);
