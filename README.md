# Sweepr — World Cup Sweepstakes

Sweepr is a Solana program that enables friend groups to stake USDC into a pool,
get randomly assigned World Cup teams, and auto-settle payouts via on-chain escrow.

## Architecture

```
sweepr/
├── anchor/                    # Anchor program workspace
│   ├── programs/sweepr/       # Rust program source
│   ├── tests/sweepr.ts        # Mocha/Chai test suite
│   ├── migrations/deploy.ts   # Deployment script
│   ├── idl/                   # IDL + TypeScript types
│   ├── Anchor.toml            # Anchor config
│   └── package.json
├── lib/solana.ts              # Backend helper (Next.js server)
├── app/                       # Next.js frontend
├── components/                # React components
└── inngest/                   # Background job handlers
```

## Instructions

| Instruction | Auth | Description |
|---|---|---|
| `initializePool` | Authority | Create a pool (free or paid) |
| `joinPool` | Member (signer) | Join with USDC stake + team assignment |
| `updateScore` | Oracle | Update a member's score (idempotent via nonce) |
| `settlePool` | Oracle | Distribute 95% to winner, 5% protocol fee |
| `closePool` | Authority | Close a settled pool (refund rent) |

## Fees

- Protocol fee: **5%** (500 bps) of total pool
- Fee sent to `PROTOCOL_FEE_WALLET` constant

## Local Setup

```bash
# Prerequisites
rustup install 1.79.0  # Anchor 0.30 requires Rust <1.80
solana --version       # >= 1.18
anchor --version       # 0.31.0 (CLI)

# Install deps
cd anchor && npm install

# Build program
NO_DNA=1 anchor build

# Build without IDL (Rust 1.95+ workaround)
NO_DNA=1 cargo build-sbf --manifest-path programs/sweepr/Cargo.toml

# Run tests (requires localnet)
NO_DNA=1 anchor test --skip-lint
```

## Devnet Deployment

```bash
# 1. Set your deployer keypair
export ANCHOR_WALLET=~/.config/solana/id.json

# 2. Build
cd anchor && anchor build

# 3. Deploy
solana config set --url devnet
anchor deploy --provider.cluster devnet

# 4. Update anchor/idl/sweepr.json with the deployed program ID
# 5. Update SWEEPR_PROGRAM_ID in .env
```

## Mainnet Deployment

1. Build with `anchor build --verifiable` for deterministic builds
2. Deploy via Squads multisig for upgrade authority
3. Update constants.rs with production `ORACLE_PUBKEY` and `PROTOCOL_FEE_WALLET`
4. Verify on [Solana Explorer](https://explorer.solana.com/)

## Rotating ORACLE_PUBKEY

The oracle pubkey is a compile-time constant in `programs/sweepr/src/constants.rs`.
To rotate:

1. Generate new keypair: `solana-keygen new -o new-oracle.json`
2. Update `ORACLE_PUBKEY` in constants.rs
3. Rebuild and redeploy the program
4. Update `SETTLEMENT_KEYPAIR` in your backend .env

A future upgrade could move this to a config account for runtime rotation.

## Verifying Settlement

To verify a settlement transaction on Solana Explorer:

1. Get the transaction signature from `callSettlePool` response
2. Open `https://explorer.solana.com/tx/<SIG>?cluster=devnet`
3. Check the inner instructions for:
   - Token transfer from escrow vault → winner's ATA (payout)
   - Token transfer from escrow vault → protocol fee ATA (fee)
4. Verify amounts: `payout = total - (total * 500 / 10000)`

## Security Assumptions

| Component | Assumption | Risk if violated |
|---|---|---|
| Oracle key | Backend signer is secure | Unauthorized score updates, early settlement |
| USDC mint | Token program integrity | Fake USDC could be deposited |
| Pool authority | Creator is trusted | Authority can close pool early |
| On-chain data | All account data is public | Pool states visible on-chain |

## License

MIT

## Risk Notes

- **Signing**: The oracle keypair (`SETTLEMENT_KEYPAIR`) has full authority over
  `updateScore` and `settlePool`. Compromise = pool theft.
- **CPI Transfers**: Settlement uses `CpiContext::new_with_signer` with PDA seeds.
  Ensure the PDA is the escrow authority.
- **Arithmetic**: All math uses `checked_*` operations to prevent overflow.
- **Replay Protection**: `updateScore` uses per-event nonces (EventNonce PDA).
- **Token Program**: Uses standard SPL Token. Token-2022 not yet supported.
