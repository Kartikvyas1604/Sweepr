# Sweepr — World Cup Sweepstakes

Sweepr is a Solana sweepstakes platform where friends stake SOL into a pool,
get randomly assigned World Cup teams, and compete for the prize pool based on
real-world match results.

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind, shadcn/ui
- **Backend:** Next.js API routes, Supabase (Postgres), Upstash Redis
- **Blockchain:** Solana (Anchor 0.30), @solana/web3.js
- **Auth:** SIWS (Sign In With Solana), JWT (jose)
- **Data:** TxLINE API (live football scores)
- **Background:** Inngest (cron + event-driven functions)
- **Testing:** Vitest, k6 (load tests)

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env.local

# Run development server
npm run dev
```

## Environment Variables

All validated at boot via `lib/env.ts` (Zod schema). Required:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOLANA_RPC` | Solana RPC endpoint |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `UPSTASH_REDIS_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis token |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `INNGEST_SIGNING_KEY` | Inngest signing key |
| `TXLINE_API_KEY` | TxLINE API key |
| `JWT_SECRET` | Random 32-byte hex |
| `SOLANA_KEYPAIR` | Local wallet keypair JSON |

## Testing

```bash
# Unit + integration tests
npx vitest run

# Type check
npx tsc --noEmit

# Coverage
npx vitest run --coverage
```

## Load Testing

```bash
brew install k6
k6 run tests/load/k6.js
```

## Deploy

See [DEPLOY.md](./DEPLOY.md).

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## On-Chain Program

The Anchor program lives in `anchor/`. Key instructions:

| Instruction | Auth | Description |
|---|---|---|
| `initializePool` | Authority | Create a pool |
| `joinPool` | Member | Join with SOL stake |
| `updateScore` | Oracle | Update member score |
| `settlePool` | Oracle | Distribute prize pool |
| `closePool` | Authority | Close settled pool |

- Program ID: `6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC`
- Oracle: `EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb`
- Protocol fee: `Hb17qysxGiG6LPGXNqEYpZKfQH7Fc7XDGkVJvqx4zSLp`
- Protocol fee: **5%** (500 bps)

## License

MIT
