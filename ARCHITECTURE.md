# Architecture

## Overview

Sweepr is a World Cup sweepstakes platform where users stake SOL into a pool, get randomly assigned a national team, and compete for the prize pool based on their team's real-world performance.

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Browser   │────▶│  Next.js 16  │────▶│  Supabase  │
│  (React)    │◀────│  (Vercel)    │◀────│ (Postgres) │
└─────────────┘     └──────┬───────┘     └────────────┘
                           │
                    ┌──────┴───────┐     ┌────────────┐
                    │   Upstash    │     │   Inngest  │
                    │    Redis     │     │  (Cron)    │
                    └──────────────┘     └──────┬─────┘
                                                │
                                         ┌──────┴──────┐
                                         │   TxLINE    │
                                         │  (API)      │
                                         └─────────────┘
                           │
                    ┌──────┴───────┐
                    │  Solana SVM  │
                    │   (Anchor)   │
                    └──────────────┘
```

## Key Flows

### Pool Creation
1. User connects wallet (Solana wallet adapter)
2. Signs a SIWS (Sign In With Solana) message → JWT
3. Frontend calls `POST /api/pools` with name, fee, max members
4. Server derives escrow PDA, sends `initializePool` instruction
5. On confirmation, inserts row in Supabase `pools` table
6. Generates join code, publishes to Redis for SSE

### Pool Join
1. User browses pools via `GET /api/pools`
2. Selects pool → `POST /api/pools/:code/assign-team` → assigned random team (Fisher-Yates shuffle on remaining teams)
3. User sends SOL entry fee to escrow PDA
4. `POST /api/pools/:code/join` with tx signature → verifies transfer, inserts member

### Live Scoring (SSE)
- `GET /api/stream/:poolId` — Server-Sent Events endpoint
- Pool members connect and receive real-time leaderboard updates
- Updates pushed from two sources:
  - **TxLINE poll**: Inngest cron runs every 60s, fetches live fixtures, processes scoring
  - **On-chain events**: `callUpdateScore` Anchor instruction

### Settlement
- Pool reaches terminal state (World Cup ends) or manually settled
- Inngest `settle-pool` function calls `callSettlePool` on-chain
- Oracle verifies final ranking, distributes prize pool via `SettlePool` instruction

## Route Map

### Public API (`/api/`)
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/health` | GET | No | Health check |
| `/pools` | GET | No | List pools |
| `/pools` | POST | JWT | Create pool |
| `/pools/:code` | GET | No | Pool detail + leaderboard |
| `/pools/:code/assign-team` | POST | JWT | Assign random team |
| `/pools/:code/join` | POST | JWT | Join pool with SOL |
| `/pools/:code/leaderboard` | GET | No | Leaderboard + recent events |
| `/stream/:poolId` | GET | No | SSE live updates |
| `/teams` | GET | No | List all teams |
| `/fixtures` | GET | No | List fixtures |
| `/auth/nonce` | POST | No | SIWS nonce |
| `/auth/verify` | POST | No | Verify SIWS sig |

### Internal (`/api/internal/`)
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/score-sync` | POST | Inngest key | Sync scores |
| `/settle` | POST | Inngest key | Settle pool |

### Admin (`/api/admin/`)
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/repair-pool` | POST | Admin key | Repair on-chain pool |

## Data Model

### `pools` (Supabase)
- `id` UUID PK, `join_code` TEXT UNIQUE, `name` TEXT
- `entry_fee_sol` NUMERIC, `entry_fee_usdc` NUMERIC(10,2) ≥ 0.0001
- `max_members` INT4, `is_private` BOOL, `passphrase` TEXT
- `status` TEXT (draft, active, locked, settled)
- `escrow_pda` TEXT, `pool_pda` TEXT
- `winner_id` UUID FK → members, `winner_payout` NUMERIC

### `members` (Supabase)
- `id` UUID PK, `pool_id` UUID FK → pools
- `wallet` TEXT, `display_name` TEXT
- `team_id` INT4, `team_name` TEXT
- `stake_tx_signature` TEXT
- `score` INT4 DEFAULT 0, `rank` INT4
- `paid_out` BOOL DEFAULT false

### Redis (Upstash)
- `pool:{id}:leaderboard` — cached leaderboard JSON
- `pool:{id}:members` — member count
- `pool:{id}:teams_remaining` — available teams set
- `pubsub:pool:{id}` — SSE publish channel

### Solana (Anchor)
- `PoolState` account (PDA) — config, escrow, member count
- Escrow PDA — holds pooled SOL
- `InitializePool`, `JoinPool`, `UpdateScore`, `SettlePool` instructions

## Key Design Decisions

- **No WebSocket** — SSE chosen for simplicity with serverless (one-way, reconnection-friendly)
- **Redis pub/sub** — bridges SSE across multiple Vercel instances
- **Fisher-Yates shuffle** — deterministic team assignment per pool
- **TxLINE for data** — real-world fixture/score data; no oracles needed for results
- **Oracle for settlement** — on-chain oracle signs final ranking for trustless payout
- **JWT auth** — stateless, no session DB needed; SIWS for wallet verification
