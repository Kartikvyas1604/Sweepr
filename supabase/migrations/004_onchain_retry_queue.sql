-- Queue for failed on-chain calls that need to be retried.
CREATE TABLE IF NOT EXISTS onchain_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('update_score', 'settle_pool', 'initialize_pool')),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onchain_retry_queue_next_retry
  ON onchain_retry_queue (next_retry_at)
  WHERE next_retry_at <= now();

-- Auto-increment the score using a PG function for consistency
CREATE OR REPLACE FUNCTION increment_score(
  p_member_id UUID,
  p_points INT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pool_members
  SET score = score + p_points
  WHERE id = p_member_id;
END;
$$;
