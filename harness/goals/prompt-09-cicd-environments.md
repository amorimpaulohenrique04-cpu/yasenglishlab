# GOAL — prompt-09-cicd-environments: Safe CI/CD and environments

Status: in_progress  
Owner: agent/human  
Created: 2026-09-29  
Updated: 2026-09-29

## Objective

Build the official Yas English Lab CI/CD pipeline for LOCAL, PREVIEW, STAGING and PRODUCTION without changing user-facing features.

## Visible result

Pull requests are blocked by deterministic quality, database, RLS, security, supply-chain, E2E, accessibility and visual gates. Database migrations replay cleanly. Preview is always exercised in an isolated CI environment and can optionally publish through a non-production deployment adapter. Staging and production deploy workflows are environment-scoped and fail closed until infrastructure/secrets are configured.

## Relevant context

- `docs/OPERATIONS.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/ARCHITECTURE.md`
- `harness/evals/behavioral.md`
- `.github/workflows/foundation-verify.yml`
- `scripts/verify-security.mjs`
- `scripts/verify-full.mjs`
- `supabase/migrations/`

## Acceptance criteria

- [ ] Official PR CI executes deterministic install, lint, typecheck, unit, integration, real RLS, security, build, critical E2E, accessibility and visual checks.
- [ ] Supply-chain checks cover lockfile integrity, direct version policy, vulnerable dependencies, lifecycle scripts, action pinning and secret scanning.
- [ ] Schema history is migration-only, existing migrations are immutable and migrations replay on clean databases.
- [ ] PREVIEW is isolated from production secrets and always has a safe CI-local path; external preview is optional and environment-scoped.
- [ ] STAGING and PRODUCTION workflows use separate GitHub environments/secrets.
- [ ] Production requires green CI, reviewed merged PR, validated migrations and explicit release approval.
- [ ] Rollback strategy covers application, database forward-fix/restore and feature flags.
- [ ] CI simulations prove: valid PR passes; failing test is blocked; invalid migration is blocked; detectable secret is blocked.
- [ ] No user-facing feature is changed.

## Allowed files / domains

- `.github/**`
- `package.json`
- `package-lock.json`
- `.env.example`
- `scripts/**`
- `docs/**`
- `harness/**`
- `supabase/migrations/README.md`

## Forbidden areas

- `src/**`
- Product behavior/UI.
- New billing, practice, materials, CEFR or live-class features.
- Production secrets or production credentials in repository files.
- Manual production schema edits as normal deployment flow.

## Mandatory verification

- `npm ci`
- `npm run ci:supply-chain`
- `npm run ci:migrations`
- `npm run verify:agent`
- `npm run verify:full`
- clean migration replay
- CI simulation workflow with all four scenarios

## Required evidence

- Final feature-branch CI URL.
- PR CI URL.
- Four simulation job results.
- Post-merge `main` CI URL.
- `harness/evidence/prompt-09-cicd-environments/verification.json`.

## Definition of done

Done only after official workflows are read-only/minimum-privilege by default, all simulations behave as expected, final PR/head is green, no product file changed, and post-merge main is green.
