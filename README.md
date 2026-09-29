# Yas English Lab

Official repository for the Yas English Lab SaaS.

This repository currently contains the **engineering foundation only**. Product screens and business domains are intentionally deferred to later phases.

## Requirements

- Node.js 24 LTS
- npm bundled with Node 24
- Git

Next.js 16 requires Node.js 20.9+; this repository standardizes on Node 24 because the current Supabase JavaScript ecosystem has ended Node 20 support.

## Setup from a clean checkout

```bash
git clone https://github.com/amorimpaulohenrique04-cpu/yasenglishlab.git
cd yasenglishlab
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

On Windows without `cp`, copy `.env.example` to `.env.local` using Explorer or PowerShell.

The placeholder app runs at `http://localhost:3000`.

## Environment

`.env.example` documents every foundation variable.

Browser-safe:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`

**Never** expose the service-role key through a `NEXT_PUBLIC_` variable. Client-safe Supabase helpers live in `src/lib/supabase/`; privileged helpers live in `src/server/` and use the `server-only` boundary.

The placeholder page does not require Supabase credentials to build or boot.

## Official commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run storybook
npm run storybook:build
npm run format
npm run format:check
npm run verify
npm run verify:full
```

`npm run verify` runs formatting check, lint, strict TypeScript, Vitest and the production Next.js build. `verify:full` additionally builds Storybook and runs Playwright.

## Source layout

```text
src/
├── app/                 # Next.js App Router
├── modules/             # business domains, added only when behavior exists
├── components/
│   ├── ui/              # shared primitives (future design-system task)
│   └── layout/          # shared shell/layout components
├── lib/                 # client-safe/shared infrastructure
├── server/              # server-only privileged infrastructure
├── styles/              # cross-cutting style infrastructure
└── types/               # project declarations

supabase/
├── migrations/
└── seed/

tests/
├── unit/
├── integration/
├── e2e/
├── rls/
└── visual/

scripts/
docs/
harness/
```

## Import alias

`@/*` maps to `src/*`.

Example:

```ts
import { APP_NAME } from "@/lib/constants";
```

## Architecture boundaries

- Organize product behavior by domain under `src/modules/`.
- UI must not import privileged server infrastructure.
- `src/server/` may use server-only secrets.
- The browser Supabase client can use only publishable public values.
- No dashboard, plan logic, Stripe integration or product database schema exists yet.

Read:
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/UI_CONTRACT.md`
- `docs/adr/0001-foundation-stack.md`

## Verification

A clean checkout is considered healthy when:

```bash
npm ci
npm run verify
npm run storybook:build
npx playwright install chromium
npm run test:e2e
```

The repository keeps a minimal GitHub Actions foundation verifier so the same commands run in a clean Linux environment. Full CI/CD policy is intentionally deferred to the dedicated CI/CD phase.
