# GOAL — level-based-cohorts: Formal pedagogical levels

Status: in_progress
Owner: agent
Created: 2026-10-21
Updated: 2026-10-21

## Objective

Consolidate BASIC/INTERMEDIATE/ADVANCED cohorts sharing one course, level-aware placement, scheduled lesson-linked practices and safe final completion in exactly one PR from main.

## Visible result

Admin configures levels and existing paths; Teacher recommends levels and schedules assignments; Students receive authorized resources. Early levels keep enrollment ACTIVE.

## Relevant context

- `docs/COHORT_PATH.md`
- `docs/PLACEMENT.md`
- `docs/PRACTICE_ENGINE.md`
- `docs/LIVE_CLASSES.md`
- `docs/DATA_MODEL.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/OPEN_QUESTIONS.md`

## Acceptance criteria

- [ ] Nullable levels preserve legacy cohorts and shared content.
- [ ] Placement filters course and level; justified Admin transfers preserve history.
- [ ] Conflicting same-course memberships rejected under concurrency.
- [ ] Practice release/deadline independent; lesson availability enforced in DB/assets.
- [ ] BASIC/INTERMEDIATE keep course active; final and legacy completion correct.
- [ ] Existing cohort paths and live booking authorization verified.
- [ ] Required gates executed, evidence recorded, exactly one PR created.

## Allowed files / domains

- `supabase/migrations/**`
- `supabase/tests/**`
- `src/modules/cohorts/**`
- `src/modules/placement/**`
- `src/modules/teacher-operations/**`
- `src/modules/practice/**`
- `src/modules/learning/**`
- `src/server/cohorts/**`
- `src/server/placement/**`
- `src/server/teacher-operations/**`
- `src/server/learning/**`
- `src/app/(protected)/(admin)/admin/cohorts/**`
- `src/app/(protected)/(admin)/admin/enrollments/**`
- `src/app/(protected)/(teacher)/teacher/praticas/**`
- `src/app/(protected)/(teacher)/teacher/revisoes/placement/**`
- `src/app/(protected)/(student)/onboarding/placement/page.tsx`
- `tests/**`
- `scripts/run-sql-tests.mjs`
- `scripts/test-placement-concurrency.mjs`
- `docs/COHORT_PATH.md`
- `docs/PLACEMENT.md`
- `docs/PRACTICE_ENGINE.md`
- `docs/DATA_MODEL.md`
- `docs/LIVE_CLASSES.md`
- `docs/OPEN_QUESTIONS.md`
- `harness/goals/level-based-cohorts.md`
- `harness/agent-state/**`
- `harness/feature_list.json`
- `harness/evidence/level-based-cohorts/**`
- `harness/failure-log/2026-10-21-level-based-cohorts-transfer.md`
- `harness/failure-log/2026-10-21-level-based-cohorts-legacy-assignment.md`

## Forbidden areas

Billing/Asaas, commercial plans, entitlements policy, CRM, landing, Practice V3 internals, assessment scoring, Mux, Meet, design system, deployment and production data.

## Mandatory tests

- npm run verify:agent
- npm run verify:ui
- npm run verify:security
- npm run verify:db
- npm run verify:full
- Existing unit/integration suites and SQL/RLS regressions.

## Required evidence

Exact commands/results, SQL allow/deny, UI evidence and blockers in harness/evidence/level-based-cohorts/.

## Definition of done

Acceptance criteria and gates pass, evidence inspected, persistent state truthful and one PR created. Blocked gates never reported as passing.

## Scope update

The existing Placement concurrency script is extended to protect same-course membership and transfer races at two real database connections.

The existing Student choice page also displays the explicit recommended level so it stays distinct from the shared course title.

The user explicitly requires module order per cohort, resolving the prior open question about module ordering; only that answered question is removed.

The existing Admin enrollment screen and review operation also support a justified level override before student confirmation, preserving the immutable Teacher review.

- Failure record in scope: `harness/failure-log/2026-10-21-level-based-cohorts-legacy-assignment.md` (canonical setup exposed a legacy reach-assignment contract).

The existing live join-reference guard repeats current cohort authorization after transfers; booking history and meeting provider behavior remain unchanged.
