# Contributing to Sweepr

Thank you for considering contributing to Sweepr. This guide outlines the development process, coding standards, and pull request procedures.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Guidelines](#coding-guidelines)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Project Architecture](#project-architecture)

## Code of Conduct

This project is committed to providing a welcoming and harassment-free experience for everyone. Be respectful, constructive, and inclusive.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/sweepr.git
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Workflow

```bash
# Start the dev server
npm run dev

# Lint your code
npm run lint

# Type-check (incremental)
# TypeScript checking runs automatically in your editor
```

- The dev server runs on `http://localhost:3000` with hot module replacement
- Keep the server running while you work; changes reflect instantly
- Run `npm run lint` before committing to catch issues early

## Coding Guidelines

### General

- Write TypeScript — no `any` unless absolutely necessary; prefer `unknown`
- Use strict mode features (the project has `strict: true` in tsconfig)
- No commented-out code; delete what you don't need
- Keep components small and focused; extract reusable logic into `lib/` or `hooks/`

### Naming

- **Components**: PascalCase (`PoolCard`, `WalletButton`)
- **Functions**: camelCase (`formatUsdc`, `getPool`)
- **Files**: kebab-case for pages (`page.tsx`), camelCase for utilities (`wallet-provider.tsx`)
- **Types/Interfaces**: PascalCase (`Pool`, `Participant`)

### Components

- Use `"use client"` only when the component needs browser APIs or hooks
- Prefer server components by default (App Router convention)
- Import UI primitives from `@/components/ui/*`
- Use the `cn()` utility from `@/lib/utils` for class merging

### Styling

- Use Tailwind CSS utility classes exclusively
- Design tokens are defined in `app/globals.css` as CSS variables
- Use the custom utility classes:
  - `font-display` — Bricolage Grotesque (headings)
  - `font-body` — Inter (body text)
  - `font-mono` — JetBrains Mono (code, stats)
- Animations use Framer Motion; prefer `motion.div` with variants for consistency

### State Management

- Client state lives in `lib/store.ts` (localStorage-based for now)
- Do not introduce a state library without discussion
- Wallet state is managed via `WalletProvider` context

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
```

**Types:**

| Type     | Usage                          |
|----------|--------------------------------|
| `feat`   | A new feature                  |
| `fix`    | A bug fix                      |
| `style`  | UI or styling changes          |
| `refactor` | Code change with no behavior change |
| `docs`   | Documentation changes          |
| `chore`  | Build, CI, dependencies        |
| `perf`   | Performance improvements       |

**Examples:**

```
feat: add private pool passphrase support
fix: correct leaderboard score calculation on join
style: animate pool card entrance on dashboard
docs: update README with deployment steps
```

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run `npm run lint` and fix any issues
3. Write a clear PR title following the commit convention
4. In the description, explain what the change does and why
5. Link any related issues
6. Request review from at least one maintainer
7. Keep PRs focused — one feature or fix per PR

### PR Checklist

- [ ] Code follows the coding guidelines
- [ ] No lint errors (`npm run lint`)
- [ ] No TypeScript errors
- [ ] Tested in the browser
- [ ] Branch is up to date with `main`

## Project Architecture

```
app/          — Next.js App Router pages (file-based routing)
components/   — React components (UI primitives + feature components)
hooks/        — Custom React hooks (use-pool, use-countdown)
lib/          — Business logic, types, utilities
```

Key design decisions:

- **localStorage** is used for MVP state — on-chain settlement is the eventual target
- **WalletProvider** wraps the entire app; use `useWallet()` to access connection state
- **Random team assignment** happens on join; teams are unique per pool until exhausted
- **Pools expire** on July 19, 2026 (World Cup final)

For architectural questions, open a discussion or issue before writing code.
