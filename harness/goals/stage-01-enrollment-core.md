# GOAL — stage-01-enrollment-core: Enrollment Core

Status: in_progress
Owner: agent
Created: 2026-10-03
Updated: 2026-10-03

## Objective

Deliver confirmed commercial entry through onboarding, existing Assessment, scoped Teacher review, deterministic cohort matching and atomic enrollment. Branch `feat/stage-01-enrollment-core`; fetched base `22b0562eaf308fabd363107feeecb639a126484e` matches requested base.

## Visible result

Student resumes persisted answers, waits for review, sees a learning track and compatible cohorts, confirms membership; Teacher reviews with AAL2 and scope; Admin follows the composed journey and transfers safely.

## Relevant context

`AGENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/AUTH_RBAC_RLS.md`, `docs/SECURITY.md`, `docs/CEFR_ASSESSMENT.md`, `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/OPEN_QUESTIONS.md`, `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`, `docs/BILLING.md`; Assessment and Cohorts V1, existing auth/analytics and installed Next.js guides.

## Acceptance criteria

- [ ] Harness reconciled without deleting historical records or claiming real Mux smoke.
- [ ] Durable Placement transitions, preferences, immutable recommendation and separate choice.
- [ ] Existing Assessment persists/resumes safely; no private scoring data or inferred CEFR.
- [ ] Teacher AAL2 and assignment/cohort scope; immutable idempotent review.
- [ ] Deterministic schedule/track/capacity matching and atomic last-seat enrollment.
- [ ] Admin read projection and audited atomic transfer; minimal Home projection.
- [ ] Positive/negative RLS, real SQL/concurrency/E2E, a11y/visual and all gates/CI pass.

## Allowed files / domains

- `harness/**`
- `docs/**`
- `src/modules/placement/**`
- `src/server/placement/**`
- `src/modules/assessments/**`
- `src/server/assessments/**`
- `src/modules/domain/**`
- `src/server/home/**`
- `src/app/**`
- `src/components/layout/**`
- `src/modules/admin-content/ui/admin-shell.tsx`

The existing Admin shell receives only the Matrículas navigation link so the authorized new surface is discoverable; no shell redesign.

- `supabase/migrations/20261003*`
- `supabase/tests/**`
- `tests/**`
- `scripts/setup-canonical-e2e.mjs`
- `scripts/run-sql-tests.mjs`
- `scripts/test-placement-concurrency.mjs`

## Forbidden areas

Historical migrations, Billing provider/checkout, notification delivery, CEFR/cut scores, retake policy, broad redesign/refactor, main merge; preserve existing untracked Laya scripts.

## Mandatory tests

Focused unit/application/SQL/RLS/concurrency/E2E/a11y/visual; `npm run verify:agent`, `npm run verify:security`, `npm run verify:db`, `npm run verify:ui`, `npm run verify:full`; Official CI.

## Required evidence

Actual check results and reviewed desktop/tablet/mobile captures under `harness/evidence/stage-01-enrollment-core/`; CI URL, migration replay, Auth/RLS and two-connection last-seat proof. No unexecuted PASS.

## Definition of done

All acceptance criteria and gates pass, evidence inspected, registry verified only then; PR against main without merge. Open questions preserved.
