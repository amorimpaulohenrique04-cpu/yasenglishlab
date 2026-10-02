# GOAL — p21-p0-foundation-closure: Role routing, quota and cohorts V1

Status: in_progress  
Owner: agent/human  
Created: 2026-10-02  
Updated: 2026-10-02

## Objective

Implement the approved `harness/plans/p21-p0-foundation-closure.md` on `feat/p21-p0-foundation-closure`, based on main `94b574b40b8b05ed798f996294d2297ba92b5e31`. Close role routing, commercial booking usage and cohorts while preserving P13–P21.

## Visible result

Authorized workspace after login/MFA, transactional weekly/monthly booking quotas, and isolated cohort administration/Student/Teacher access.

## Relevant context

- `docs/PRODUCT.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/SECURITY.md`
- `docs/THREAT_MODEL.md`
- `docs/LIVE_CLASSES.md`
- `docs/BILLING.md`
- `docs/ADMIN_CONTENT.md`
- `docs/PRACTICE_ENGINE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/AUDIT_LOG.md`
- `docs/OBSERVABILITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPERATIONS.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `harness/plans/p21-p0-foundation-closure.md`

## Acceptance criteria

- [ ] P21.1: role-aware safe next, staff MFA, selector and explicit STUDENT boundary.
- [ ] P21.2: session-start Recife WEEK/MONTH quotas, snapshots, cancellation/rebooking, audit and real concurrency.
- [ ] P21.3: cohort model, enrollment prerequisite, admin commands and strict cross-cohort RLS, legacy assignments preserved.
- [ ] P13–P21 regression checks, clean replay/upgrade and all final aliases pass.
- [ ] PR against main, no merge, CI dispatched/status reported and inspected local evidence. User explicitly waived waiting for green CI in the latest instruction.

## Allowed files / domains

- `src/modules/auth/**`
- `src/server/auth/**`
- `src/server/student/request-context.ts`
- `src/app/(auth)/login/**`
- `src/app/auth/**`
- `src/app/mfa/**`
- `src/app/(protected)/workspace/**`
- `src/app/(protected)/(admin)/admin/page.tsx`
- `src/app/(protected)/(admin)/admin/cohorts/**`
- `src/app/(protected)/(student)/agenda/**`
- `src/modules/schedule/**`
- `src/server/schedule/**`
- `src/server/live/book-session.ts`
- `src/modules/cohorts/**`
- `src/server/cohorts/**`
- `src/modules/admin-content/ui/admin-shell.tsx` only navigation to cohorts
- `src/server/audit/**`
- `supabase/migrations/**` new migrations only
- `supabase/tests/**`
- `supabase/seed.sql`
- `scripts/run-sql-tests.mjs`
- `scripts/test-schedule-concurrency.mjs`
- `scripts/setup-canonical-e2e.mjs`
- `scripts/assert-canonical-e2e.mjs`
- `scripts/verify-db.mjs`
- `scripts/verify-security.mjs`
- `eslint.config.mjs`, `.prettierignore` only exclude generated isolated Next outputs already defined by next.config.ts; lint/format continue scanning all source/tests/scripts.
- `tests/**`
- `docs/**`
- `harness/**`

## Forbidden areas

- Historical migrations, Official CI workflow, unrelated product refactors, new billing/video/meeting providers and P21.4+.
- Weakening RLS/AAL2, privileged browser writes, golden updates masking regressions.

## Mandatory tests

- Focused Auth, Schedule, Cohorts unit/integration/SQL/RLS/concurrency/E2E.
- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:ui`
- `npm run verify:full`
- Dispatch Official CI and report its current status; do not wait for green, as explicitly directed by the user. Two clean replays and upgrade evidence remain required.

## Required evidence

Logs, SHA, DB/RLS/concurrency assertions, UI screenshots/a11y and CI artifacts under `harness/evidence/p21-p0-foundation-closure/`.

## Definition of done

All local checkpoints/gates pass with inspected evidence, docs/ADRs and Harness updated, PR created and current Official CI status reported; no merge. The user's latest instruction supersedes waiting for green CI.
