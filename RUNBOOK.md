# Runbook

## Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response: `{ "status": "ok", "timestamp": "..." }`

## Common Alerts

### High API Error Rate (>5%)

1. Check Vercel function logs for 5xx errors
2. Verify TxLINE API key is valid and quota not exceeded
3. Check Supabase connection (service key rotation?)
4. Verify Solana RPC endpoint is responsive

### SSE Connections Dropping

1. Redis connection may be saturated — check Upstash metrics
2. Vercel Hobby plan has 10s function timeout — upgrade to Pro
3. Check SSE route logs for `cancel()` events

### Score Sync Not Running

1. Verify Inngest dashboard shows active `score-sync` function
2. Check `INNGEST_EVENT_KEY` matches Inngest config
3. Run manually:
   ```bash
   curl -X POST https://your-domain.com/api/internal/score-sync \
     -H "x-inngest-key: $INNGEST_EVENT_KEY"
   ```

### Settlement Failures

1. Oracle wallet must have SOL for tx fees
2. Check `ORACLE_PUBKEY` env var matches deployed oracle
3. Verify pool is in `locked` or `active` state
4. Run repair:
   ```bash
   curl -X POST https://your-domain.com/api/admin/repair-pool \
     -H "Authorization: Bearer $INNGEST_SIGNING_KEY" \
     -H "Content-Type: application/json" \
     -d '{"poolId": "<pool-id>"}'
   ```

### Redis Memory Usage High

- Shorten TTL on leaderboard cache
- Eviction policy: `allkeys-lru`
- Consider upgrading Upstash plan

## Database

### Migrations

```bash
npx supabase db push          # Apply pending migrations
npx supabase db diff -f name  # Create new migration
```

### Manual Queries

```sql
-- Check pool counts by status
SELECT status, COUNT(*) FROM pools GROUP BY status;

-- Find stale pools (no updates in 1h)
SELECT id, name, status, updated_at
FROM pools
WHERE updated_at < NOW() - INTERVAL '1 hour'
  AND status = 'active';

-- Member distribution
SELECT p.name, COUNT(m.id) as members
FROM pools p
LEFT JOIN members m ON m.pool_id = p.id
GROUP BY p.id, p.name;
```

## Redis

```bash
# Check leaderboard cache TTL
redis-cli TTL pool:<id>:leaderboard

# Flush stale cache (if needed)
redis-cli DEL pool:<id>:leaderboard
```

## Deployment

See [DEPLOY.md](./DEPLOY.md).

## Contact

For TxLINE API issues: https://txline.txodds.com
For Solana RPC issues: Check your RPC provider dashboard
