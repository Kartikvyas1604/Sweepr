ALTER TABLE pools
  ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN passphrase TEXT;

CREATE INDEX idx_pools_is_private ON pools(is_private);
