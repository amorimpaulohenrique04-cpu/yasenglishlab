# GOAL — pre-p13-environment-gate: Reproducible local full verification

Status: done  
Owner: agent  
Created: 2026-09-30  
Updated: 2026-09-30

## Objective

Make the existing `npm run verify:full` complete successfully from a clean local Windows setup using an isolated, disposable local Supabase stack, without implementing Prompt 13 or changing product behavior.

## Visible result

A developer with Node 24, Docker, the supported Supabase CLI, PostgreSQL client and Playwright Chromium can rebuild the local database and run the full official verification end to end with no production credentials.

## Relevant context

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/CI_CD.md`
- `scripts/verify-full.mjs`
- `scripts/run-sql-tests.mjs`
- `supabase/`

## Acceptance criteria

- [x] Node 24, Docker daemon, supported Supabase CLI, `psql` and Playwright Chromium are functionally validated.
- [x] `supabase start` and `supabase db reset` rebuild migrations and seed from zero using only local infrastructure.
- [x] DB integration, RLS, E2E, accessibility, Storybook visual and golden suites pass.
- [x] A clean-room restart/reset followed by `npm run verify:full` returns exit code 0.
- [x] No production secret, endpoint or product feature is introduced.
- [x] No unrelated behavior regressed.

## Allowed files / domains

- `scripts/**`
- `supabase/config.toml`
- `supabase/.gitignore`
- `package.json`
- `package-lock.json`
- `playwright.config.*`
- `tests/visual/goldens/**` only to separate existing Linux baselines from reviewed Windows baselines
- `tests/e2e/canonical-slice.spec.ts` only for its Windows-safe end-to-end time budget
- `docs/**` only when local tooling documentation needs correction
- `harness/agent-state/**`
- `harness/goals/pre-p13-environment-gate.md`
- `harness/evidence/pre-p13-environment-gate/**`
- `harness/failure-log/**` for repeatable failures found by this task
- `harness/feature_list.json`
- Machine-local PATH/tool configuration needed by the checks
- Pre-existing, preserved `windows-local-tooling` branch changes (not modified by this task):
  - `.gitattributes`
  - `.gitignore`
  - `tsconfig.json`
  - `harness/goals/windows-local-tooling.md`
  - `harness/evidence/windows-local-tooling/**`

## Forbidden areas

- Prompt 13 / Learning Core feature work.
- Product UI or domain behavior changes.
- Production Supabase, production secrets or production data.
- Weakening tests, RLS, auth, security or verification gates.
- Historical migration edits unless an unequivocal clean-rebuild defect is proven first.

## Mandatory tests

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run verify:harness`
- `npm run verify:security`
- `npm run verify:system`
- `npm run verify:db`
- `npm run verify:ui`
- `npm run verify:full`
- Clean-room `supabase stop --no-backup`, `supabase start`, `supabase db reset`, then `npm run verify:full`

## Required evidence

- Exact prerequisite versions and Docker daemon status.
- Local Supabase status with credential values redacted.
- Clean database rebuild, SQL integration/RLS and complete verification exit codes.
- Final diff/security inspection under `harness/evidence/pre-p13-environment-gate/`.

## Definition of done

Done means every acceptance criterion and mandatory check passes, evidence is inspected and persisted without secrets, progress/decisions/blockers reflect reality, and `harness/feature_list.json` is marked done only after the clean-room `verify:full` returns exit code 0.
