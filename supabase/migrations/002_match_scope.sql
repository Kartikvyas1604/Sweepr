-- Pool scope mode
CREATE TYPE pool_scope AS ENUM ('all', 'single', 'custom');

-- Add scope to pools table
ALTER TABLE pools 
  ADD COLUMN scope pool_scope NOT NULL DEFAULT 'all';

-- Junction table: which fixtures are in a custom/single pool
-- For 'all' scope this table is empty (all fixtures apply)
CREATE TABLE pool_fixtures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  fixture_id  TEXT NOT NULL,         -- TxLINE fixture ID
  home_team_id   TEXT NOT NULL,
  away_team_id   TEXT NOT NULL,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_flag_url  TEXT,
  away_flag_url  TEXT,
  kickoff        TIMESTAMPTZ,
  stage          TEXT,               -- "group","r16","qf","sf","final"
  group_name     TEXT,               -- "A" through "H", null for knockouts
  UNIQUE(pool_id, fixture_id)
);

-- Update pool_members: team choice is now explicit, not random
-- team_id was already there — no change needed, just how it's 
-- populated changes (user-chosen vs random)

-- Add claim timestamp for race-condition ordering
ALTER TABLE pool_members
  ADD COLUMN team_chosen_at TIMESTAMPTZ DEFAULT NOW();

-- Index for fast "which teams are taken in this pool"
CREATE INDEX idx_pool_fixtures_pool_id ON pool_fixtures(pool_id);
CREATE INDEX idx_pool_members_team ON pool_members(pool_id, team_id);

-- RLS
ALTER TABLE pool_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fixtures_select_public" ON pool_fixtures 
  FOR SELECT USING (true);
CREATE POLICY "fixtures_insert_service" ON pool_fixtures 
  FOR INSERT WITH CHECK (true);
