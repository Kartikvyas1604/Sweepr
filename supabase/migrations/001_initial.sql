-- ENUMS
CREATE TYPE pool_status AS ENUM ('waiting', 'active', 'settled');
CREATE TYPE event_type AS ENUM ('goal', 'own_goal', 'penalty');

-- POOLS
CREATE TABLE pools (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 60),
  created_by          TEXT NOT NULL,
  join_code           TEXT UNIQUE NOT NULL,
  status              pool_status NOT NULL DEFAULT 'waiting',
  entry_fee_usdc      NUMERIC(18,6) NOT NULL DEFAULT 0
                        CHECK (entry_fee_usdc = 0
                               OR entry_fee_usdc >= 1),
  total_staked_usdc   NUMERIC(18,6) NOT NULL DEFAULT 0,
  escrow_pda          TEXT,
  winner_wallet       TEXT,
  settlement_tx       TEXT,
  max_members         INT NOT NULL DEFAULT 32
                        CHECK (max_members BETWEEN 2 AND 32),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at          TIMESTAMPTZ
);

-- POOL MEMBERS
CREATE TABLE pool_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  wallet          TEXT NOT NULL,
  display_name    TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
  team_id         TEXT NOT NULL,
  team_name       TEXT NOT NULL,
  team_flag_url   TEXT,
  team_group      TEXT,
  score           INT NOT NULL DEFAULT 0,
  rank            INT,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stake_tx        TEXT,
  UNIQUE(pool_id, wallet),
  UNIQUE(pool_id, team_id)
);

-- SCORE EVENTS
CREATE TABLE score_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id           UUID NOT NULL REFERENCES pools(id),
  member_id         UUID NOT NULL REFERENCES pool_members(id),
  fixture_id        TEXT NOT NULL,
  event_type        event_type NOT NULL,
  minute            INT,
  player_name       TEXT,
  team_id           TEXT NOT NULL,
  points_awarded    INT NOT NULL,
  txline_event_id   TEXT NOT NULL UNIQUE,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PROCESSED EVENT NONCES
CREATE TABLE processed_nonces (
  nonce     TEXT PRIMARY KEY,
  pool_id   UUID NOT NULL REFERENCES pools(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_pool_members_pool_id ON pool_members(pool_id);
CREATE INDEX idx_pool_members_score ON pool_members(pool_id, score DESC);
CREATE INDEX idx_score_events_pool_id ON score_events(pool_id);
CREATE INDEX idx_score_events_fixture ON score_events(fixture_id);
CREATE INDEX idx_pools_join_code ON pools(join_code);
CREATE INDEX idx_pools_status ON pools(status);

-- ROW LEVEL SECURITY
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;

-- pools: anyone can read
CREATE POLICY "pools_select_public" ON pools FOR SELECT USING (true);
CREATE POLICY "pools_insert_auth" ON pools FOR INSERT
  WITH CHECK (true);
CREATE POLICY "pools_update_creator" ON pools FOR UPDATE
  USING (true);

-- pool_members: public read, service role writes
CREATE POLICY "members_select_public" ON pool_members FOR SELECT USING (true);
CREATE POLICY "members_insert_service" ON pool_members FOR INSERT WITH CHECK (true);

-- score_events: public read, service role only writes
CREATE POLICY "events_select_public" ON score_events FOR SELECT USING (true);

-- RPC: increment member score atomically
CREATE OR REPLACE FUNCTION increment_score(p_member_id UUID, p_points INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pool_members
  SET score = score + p_points
  WHERE id = p_member_id;
END;
$$;
