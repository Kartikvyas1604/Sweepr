-- FIX: Add missing index for wallet-based queries (user dashboard, join checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pool_members_wallet
  ON pool_members(wallet);

-- FIX: Add index for score sync queries (finding all members of a pool)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_score_events_txline_event_id
  ON score_events(txline_event_id);

-- FIX: Add composite index for leaderboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pool_members_pool_score
  ON pool_members(pool_id, score DESC, joined_at ASC);
