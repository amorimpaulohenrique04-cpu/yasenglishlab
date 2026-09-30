# Yas English Lab

Official repository for the Yas English Lab SaaS.

The repository contains the **Yas Engineering System 1.0 foundation** plus the canonical learning vertical slice used as the reference implementation for future product work. It is intentionally not the full portal yet: new domains and screens must be added incrementally through the documented architecture, Harness and verification gates.

## Requirements

- Node.js 24 LTS
- npm bundled with Node 24
- Git
- Docker + Supabase CLI + PostgreSQL client for full local verification
- Playwright Chromium for browser verification

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

On Windows, use `Copy-Item .env.example .env.local`.

The application runs at `http://localhost:3000`. Protected/authenticated flows require the Supabase environment documented in `.env.example`.

## Environment

Browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROTECTED_ASSETS_BUCKET`

Never expose the service-role key through a `NEXT_PUBLIC_*` variable. Client-safe Supabase helpers live in `src/lib/supabase/`; privileged helpers live in `src/server/` behind the `server-only` boundary.

## Official commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:a11y
npm run test:visual:storybook
npm run test:visual:golden
npm run build
npm run storybook
npm run storybook:build

npm run verify:agent
npm run verify:system
npm run verify:ui
npm run verify:security
npm run verify:db
npm run verify:full
```

`verify:full` is the release-grade local verifier: it provisions isolated Supabase, runs database/RLS tests, E2E, accessibility, Storybook visual checks and product golden regression tests.

## Source layout

```text
src/
├── app/                 # Next.js App Router routes and Server Actions
├── modules/             # domain/application contracts and behavior
├── components/
│   ├── ui/              # shared design-system primitives
│   └── layout/          # shared shell/layout components
├── lib/                 # client-safe/shared infrastructure
├── server/              # server-only adapters and privileged boundaries
├── styles/              # executable design tokens and shared styles
└── types/               # project declarations

supabase/
├── migrations/          # immutable schema history
├── tests/               # real SQL integration/RLS contracts
└── seed.sql             # deterministic canonical fixture

tests/
├── unit/
├── integration/
├── e2e/
├── a11y/
└── visual/

scripts/
docs/
harness/
```

## Current engineering surface

Implemented and executable:

- modular product/architecture/domain/security/testing/operations documentation;
- progressive-disclosure Harness with GOAL, persistent state, registry, evidence and behavioral evals;
- design tokens, reusable primitives, Storybook and approved UI references;
- durable domain schema, RBAC/RLS and threat model;
- canonical learning vertical slice with persistence and product analytics;
- unit, integration, SQL/RLS, E2E, accessibility and golden visual regression tests;
- fail-closed Official CI, isolated Preview verification and release promotion gates;
- structured logs, correlation, technical error persistence and append-only audit logs;
- ADRs, failure log and executable failure-to-guard Ratchet.

Provider-specific product decisions that remain intentionally open are listed in `docs/OPEN_QUESTIONS.md`.

## Architecture boundaries

- Product behavior is organized by domain under `src/modules/`.
- UI must not import privileged server infrastructure.
- `src/server/` may use server-only secrets only after explicit authorization.
- Browser Supabase clients use publishable values only.
- Durable writes derive identity from verified auth context; browser-supplied `user_id` is never authority.
- Product capabilities use entitlements instead of scattered plan-name conditionals.
- Relevant structural decisions are recorded in `docs/adr/`.

Start with:

- `AGENTS.md`
- `docs/README.md`
- `harness/README.md`

## Verification

A clean checkout intended for engineering work is healthy when the applicable fast gates pass. Before declaring a release-grade task complete, run:

```bash
npm run verify:full
```

GitHub Actions runs the same critical contracts against a clean Linux/Supabase environment and publishes preview evidence.
