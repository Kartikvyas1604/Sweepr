# Sweepr

**Office pool, automated.**

Sweepr brings the tradition of World Cup office pools on-chain. Create a sweepstakes, share a link, and let the smart contract handle the rest — no spreadsheets, no "who has the cash?" group chats.

Built on Solana for instant, low-cost settlements with USDC.

## Features

- **Create Pools** — Set a name, entry fee (USDC), and optional passphrase for private pools
- **Random Team Assignment** — Each participant gets a randomly assigned World Cup team
- **Live Leaderboard** — Track standings in real time as matches play out
- **Auto Settlement** — Smart contract escrow pays the winner automatically
- **Wallet-First** — Connect with any Solana wallet via wallet-standard
- **Dashboard** — View your active and past pools, track wins and finishes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Fonts | Bricolage Grotesque, Inter, JetBrains Mono |
| Blockchain | Solana |
| Wallet | wallet-standard / wallet-adapter |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm, pnpm, or bun
- A Solana wallet (Phantom, Backpack, etc.)

### Installation

```bash
git clone https://github.com/your-org/sweepr.git
cd sweepr
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Usage

1. **Create a pool** — Enter a name, set the USDC entry fee, and choose public or private
2. **Share the link** — Send the pool link to friends; they join and are randomly assigned a team
3. **Watch the tournament** — Scores update live as World Cup matches are played
4. **Get paid** — The smart contract automatically settles the pot to the winner's wallet

## Project Structure

```
sweepr/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # User dashboard
│   ├── join/[id]/        # Join a pool
│   ├── pool/[id]/        # Pool detail & leaderboard
│   ├── pools/            # Browse public pools
│   ├── globals.css       # Global styles & design tokens
│   ├── layout.tsx        # Root layout with wallet provider
│   └── page.tsx          # Landing page
├── components/
│   ├── ui/               # shadcn-style UI primitives
│   └── wallet-provider.tsx
├── hooks/                # Custom React hooks
├── lib/
│   ├── store.ts          # Client-side state (localStorage)
│   ├── types.ts          # TypeScript interfaces & constants
│   └── utils.ts          # Utility functions
├── public/               # Static assets
└── package.json
```

## Roadmap

- [ ] Solana program (Anchor) for on-chain escrow & settlement
- [ ] Oracle integration for live match scores
- [ ] Multi-tournament support (not just World Cup)
- [ ] Mobile-first responsive design refinements
- [ ] Tipping / split-payout modes

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT
