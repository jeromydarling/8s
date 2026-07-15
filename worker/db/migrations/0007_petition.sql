-- Gatepost advocacy: persist a signed-in family's petition signatures so "Add
-- my name" survives a reload (was local React state only).
CREATE TABLE IF NOT EXISTS petition_signatures (
  user_id    TEXT NOT NULL,
  arena_id   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, arena_id)
);
CREATE INDEX IF NOT EXISTS idx_petition_arena ON petition_signatures (arena_id);
