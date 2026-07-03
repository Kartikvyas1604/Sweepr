# Sweepr — World Cup Sweepstakes, Automated

Create a World Cup sweepstakes pool, share a link, and let the smart contract settle the payout. No trust. No spreadsheets. Just vibes.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| Database | Supabase (Postgres + RLS) |
| Cache / Pub-Sub | Upstash Redis |
| Auth | Solana wallet signature → JWT (jose) |
| Real-time | Server-Sent Events (SSE) |
| Jobs | Inngest (cron + scheduled) |
| Validation | Zod (every input, env var, API response) |
| Solana | @solana/web3.js + Anchor |

## Local Development

### Prerequisites

- Node.js 20+
- Supabase CLI (`brew install supabase/tap/supabase`)
- Upstash account (free tier)
- Inngest account (free tier)
- TxLINE API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars
cp .env.example .env.local
# Edit .env.local with your Supabase, Upstash, TxLINE, Solana, and Inngest credentials

# 3. Start Supabase locally
supabase start
npx supabase migration up

# 4. Start Inngest dev server (separate terminal)
npx inngest-cli dev

# 5. Start Next.js dev server
npm run dev
```

### Environment Variables

See `.env.example` for all required vars. The app will throw a clear error at startup if any are missing.

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/nonce` | No | Request sign-in nonce |
| POST | `/api/auth/verify` | No | Verify wallet signature, get JWT |
| POST | `/api/pools` | JWT | Create a pool |
| GET | `/api/pools/[joinCode]` | No | Get pool details + leaderboard |
| POST | `/api/pools/[joinCode]/join` | JWT | Join a pool |
| GET | `/api/pools/[joinCode]/leaderboard` | No | Get leaderboard + recent events |
| GET | `/api/stream/[poolId]` | No | SSE real-time updates |
| GET | `/api/teams` | No | All 32 World Cup teams |
| GET | `/api/fixtures` | No | Fixtures (use `?live=true`) |
| POST | `/api/internal/score-sync` | Inngest | Process live goals (cron) |
| POST | `/api/internal/settle` | Inngest | Settle all active pools |
| GET/POST | `/api/inngest` | Inngest | Inngest serve handler |

## Production Deployment (Vercel)

### Pre-deployment Checklist

1. **Supabase**: Run migration against production database
   ```bash
   npx supabase db push
   ```

2. **Upstash**: Create Redis database, note REST URL + token

3. **Solana**: Deploy Anchor program to mainnet
   ```bash
   anchor deploy --provider.cluster mainnet
   ```
   Copy the program ID to `SWEEPR_PROGRAM_ID`

4. **Oracle Keypair**: Generate and fund
   ```bash
   solana-keygen grind --starts-with oracle:1
   solana airdrop 1 oracle-keypair.json --url mainnet-beta
   ```
   Base58 encode: use `bs58` to encode the secret key bytes

5. **TxLINE**: Obtain API key from TxLINE

6. **Inngest**: Create app in Inngest dashboard, copy signing key + event key

### Deploy

```bash
# Set all env vars in Vercel project dashboard
vercel --prod
# Or: set in Vercel Project Settings → Environment Variables
```

### Post-deployment

1. Verify `/api/pools` returns 401 without auth
2. Verify `/api/fixtures` returns real World Cup data
3. Check Inngest dashboard shows cron function active
4. Test full flow: create pool → join → verify SSE stream

## Triggering Tournament Settlement Manually

```bash
curl -X POST https://sweepr.xyz/api/internal/settle \
  -H "x-inngest-key: $INNGEST_EVENT_KEY"
```

Or send the Inngest event from the dashboard:
```
Event: sweepr/tournament.end
Data: {}
```

## Rotating the Oracle Keypair

1. Generate new keypair
2. Fund it with SOL
3. Update `SETTLEMENT_KEYPAIR` and `ORACLE_PUBKEY` in env
4. Redeploy

## Monitoring

| What to watch | Where |
|---|---|
| API errors | Vercel Logs → JSON structured logs |
| Score sync failures | Inngest Dashboard → Runs |
| Redis cache misses | Upstash Console → Metrics |
| Supabase slow queries | Supabase Dashboard → Query Performance |
| On-chain settlement failures | Solana Explorer → Program ID |

## Architecture

```
Client → Next.js API Routes → Supabase (pools, members, scores)
                            → Upstash Redis (cache, rate limits, pub-sub)
                            → TxLINE (live match data)
                            → Solana (escrow, settlement)
                            → Inngest (cron scoring)
                                  ↓
                            SSE stream → connected clients
```
