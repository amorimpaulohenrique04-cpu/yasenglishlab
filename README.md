# Yas English Lab

Official repository for the Yas English Lab SaaS.

The repository contains the executable engineering foundation, security model, canonical learning vertical slice, regression test system and official CI/CD pipeline.

## Requirements

- Node.js 24 LTS
- npm bundled with Node 24
- Git
- Docker + Supabase CLI + PostgreSQL client for `verify:full`

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

## Environment

Official lifecycle:

```text
LOCAL → PREVIEW → STAGING → PRODUCTION
```

`.env.example` is for local placeholders only. Runtime secrets for remote environments live in separate GitHub Environments/provider projects.

Browser-safe variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROTECTED_ASSETS_BUCKET`

Never expose service-role credentials through `NEXT_PUBLIC_*`.

See `docs/CI_CD.md` for preview/staging/production setup and release gates.

## Official commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:rls
npm run test:e2e
npm run test:a11y
npm run test:visual:golden
npm run verify:core
npm run verify
npm run verify:full
npm run ci:supply-chain
npm run ci:migrations
```

`verify:core` is the fast no-infrastructure gate. `verify` adds real DB integration/RLS when `DATABASE_URL` is provided. `verify:full` provisions local Supabase and runs the complete integrated chain.

## CI/CD

Pull requests to `main` run `Yas CI`, which blocks on:

- deterministic dependency install and supply-chain checks;
- lint/typecheck/unit/integration/security/build;
- clean migration replay and RLS tests;
- critical E2E;
- accessibility and visual regression;
- aggregate `PR Gate`.

After a green PR CI, an isolated preview is built in CI. Remote preview, staging and production adapters remain disabled until separate non-prod/prod infrastructure and GitHub Environments are configured.

Production is manual and gated by a reviewed `main` SHA with green CI. See `docs/CI_CD.md`.

## Source layout

```text
src/                  # application and product code
supabase/migrations/  # immutable versioned schema history
supabase/tests/       # database/RLS evidence
tests/                # unit/integration/e2e/a11y/visual
scripts/              # verification and CI safety gates
docs/                 # modular source of truth
harness/              # agent goals/evals/evidence
.github/workflows/    # official CI/CD control plane
```

## Architecture boundaries

- Organize product behavior by domain under `src/modules/`.
- UI must not import privileged server infrastructure.
- `src/server/` may use server-only secrets.
- The browser Supabase client can use only publishable public values.
- Authorization is server-side + RLS.
- Schema changes require migrations.
- Deployment providers stay behind reversible operational adapters.

Read:

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/CI_CD.md`
- `docs/OPERATIONS.md`
- `docs/OPEN_QUESTIONS.md`

## Verification

A release-grade clean checkout is healthy only when the relevant CI jobs and `npm run verify:full` are green. Automatically detected failures return a non-zero exit code; warnings do not replace required gates.
