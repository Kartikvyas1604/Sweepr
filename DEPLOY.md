# Deploy

## Prerequisites

- Vercel account (Pro plan recommended for 300s serverless functions)
- Upstash Redis instance
- Supabase project
- Inngest account
- TxLINE API key
- Solana RPC (Helius, Triton, or public)

## Environment Variables

Set these in Vercel dashboard (or `vercel env add`):

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

UPSTASH_REDIS_URL=https://your-region.upstash.io
UPSTASH_REDIS_TOKEN=your-token

INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

TXLINE_API_KEY=your-txline-api-key
TXLINE_BASE_URL=https://api.txline.io/v2

JWT_SECRET=openssl rand -hex 32
JWT_EXPIRY=86400

SOLANA_KEYPAIR={"your":"local-wallet-keypair-json"}
ORACLE_PUBKEY=EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb
PROTOCOL_FEE_WALLET=Hb17qysxGiG6LPGXNqEYpZKfQH7Fc7XDGkVJvqx4zSLp
USDC_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
```

## Steps

1. **Push to GitHub** and connect repo in Vercel.

2. **Set env vars** — use `vercel env add` for each or paste in dashboard.

3. **Deploy:**
   ```bash
   vercel --prod
   ```
   The build runs `npx @rainbowatcher/vercel-build` (see `vercel.json`).

4. **Run database migrations:**
   ```bash
   npx supabase db push
   ```

5. **Register Inngest functions:**
   ```bash
   curl -X POST https://your-domain.com/api/inngest \
     -H "Content-Type: application/json" \
     -d '{"name": "score-sync"}'
   ```

6. **Verify health:**
   ```bash
   curl https://your-domain.com/api/health
   ```

## Post-Deploy Verification

- Create a pool via the UI and verify it appears in the pool list
- Join the pool with a test wallet (devnet or mainnet)
- Confirm SSE stream connects and sends live score updates
- Verify Inngest dashboard shows scheduled score-sync runs

## Rollback

```bash
vercel rollback
```

## Monitoring

- **Vercel Dashboard** — function duration, errors, invocations
- **Upstash Dashboard** — Redis latency and evictions
- **Inngest Dashboard** — function runs and failures
- **Sentry** (if configured) — error tracking
