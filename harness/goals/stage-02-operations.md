# GOAL — stage-02-operations: Operations

Status: done
Owner: agent/human
Created: 2026-10-03
Updated: 2026-10-04

## Objective

Implement Stage 02 Operations on `main@34f5e32f313fe16b8c09bcf13b64b4a7d11b9236`, adding bounded operational projections and commands for Admin and Teacher while preserving Stage 01 Enrollment Core, existing Teacher Operations, Admin Content, and their authorization boundaries.

## Visible result

Admin can operate overview, Students 360, Teachers, Cohorts V2, and CRM Leads through the product UI; Teachers retain only authorized pedagogical projections. No normal Stage 02 workflow requires manual PostgreSQL edits.

## Relevant context

- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`
- `docs/AUTH_RBAC_RLS.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/OPEN_QUESTIONS.md`
- `docs/PLACEMENT.md`, `docs/OPERATIONS.md`, `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`
- `harness/goals/stage-01-enrollment-core.md` and `harness/evidence/stage-01-enrollment-core/`
- Current Admin Content, Cohorts, Teacher Operations and protected routes

## Acceptance criteria

- [ ] Admin Shell and Overview provide bounded, real operational projections.
- [ ] Admin Students list and Student 360 reuse existing Placement, Cohort, progress, attendance, and enrollment sources.
- [ ] Admin Teacher lifecycle and Cohorts V2 operations preserve AAL2, role, capacity, schedule, and membership invariants.
- [ ] CRM Leads V1 supports leads, interactions, tasks, and linking only to an existing Auth user; CRM is protected by RLS and audit boundaries.
- [ ] Teacher surfaces show only assigned cohorts/students and remain pedagogical, not administrative.
- [ ] Stage 01, P21, Admin Content, and existing product behavior do not regress.
- [ ] Applicable tests, visual/a11y evidence, required gates, and Official CI are inspected before marking verified.

## Allowed files / domains

- `src/app/(protected)/(admin)/admin/**` and `src/app/(protected)/(teacher)/teacher/**`
- `src/modules/admin-content/**`, `src/modules/cohorts/**`, `src/modules/crm/**`
- `src/server/audit/**`, `src/server/cohorts/**`, `src/server/crm/**`, `src/server/students/**`, `src/server/teacher-operations/**`, `src/server/teachers/**`
- `supabase/migrations/**`, `supabase/tests/**`
- `tests/e2e/**`, `tests/helpers/**`, `tests/integration/**`, `tests/unit/**`, `tests/visual/**`
- `scripts/eval-agent.mjs`, `scripts/run-sql-tests.mjs`, `scripts/setup-canonical-e2e.mjs`, `scripts/verify-ui.mjs`
- `.gitignore`, `.prettierignore`, `eslint.config.mjs`
- `docs/**` contracts directly affected by implementation
- `harness/goals/stage-02-operations.md`, `harness/agent-state/**`, `harness/feature_list.json`, `harness/evidence/stage-02-operations/**`, `harness/failure-log/**`

## Forbidden areas

- Rebuilding or weakening Stage 01 Placement/Enrollment Core
- Billing provider, public signup, notification delivery, CEFR inference, Reports, or Settings
- Teacher access to Admin/CRM or students/cohorts outside authorized scope
- Editing `main`, merging the PR, or marking `verified: true` without evidence
- Resolving questions in `docs/OPEN_QUESTIONS.md` by inference

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:ui`
- `npm run verify:full`
- Focused tests per domain and Stage 01 regression checks

## Required evidence

- Current base SHA and branch/head SHA
- Focused and required gate outputs
- Database/RLS and Stage 01 regression evidence
- Admin/Teacher desktop, tablet, and mobile visual evidence as applicable
- Official CI run and PR URL

## Definition of done

All Stage 02 acceptance criteria are implemented and verified, Harness records match inspected evidence, required gates and Official CI pass, a PR is open against `main`, and no merge is performed.
