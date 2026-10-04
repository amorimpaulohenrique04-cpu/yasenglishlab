# GOAL — stage-02-1-operations-ux: Operations UX/UI Closure

Status: in_progress
Owner: agent/human
Created: 2026-10-04
Updated: 2026-10-04

## Objective

Bring the Stage 02 Admin and Teacher operational surfaces to the approved visual and interaction standard using the roadmap HTML references as the visual objective, while preserving all existing domain behavior, source-of-truth ownership, authorization, RLS/AAL2, and data contracts.

## Visible result

Admin and Teacher can complete existing operational workflows through coherent, responsive, accessible surfaces with real bounded data, clear hierarchy, and interactions matching the approved references. No mockup-only data or business policies are introduced.

## Relevant context

- `C:/Users/PAULO HENRIQUE/Downloads/yas_english_lab_roadmap_completo_v3_student.html` and the user's Etapa 2.1 brief
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`
- `docs/AUTH_RBAC_RLS.md`, `docs/SECURITY.md`, `docs/CRM.md`, `docs/PLACEMENT.md`, `docs/LIVE_CLASSES.md`
- `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`, `docs/PERFORMANCE.md`, `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/OPEN_QUESTIONS.md`
- Stage 02 implementation under `src/app/(protected)/(admin)/`, `src/app/(protected)/(teacher)/`, `src/components/ui/`, and `src/components/layout/`

## Acceptance criteria

- [ ] Admin shell, Overview, Leads, Students, Student 360, Teachers, Cohorts, and Enrollments follow the approved visual grammar while preserving existing actions and server-side authorization.
- [ ] Teacher Home, Turmas, Alunos, student detail, Disponibilidade, and Revisões are responsive and pedagogy-scoped; availability uses a slot/calendar interaction instead of requiring ISO timestamp entry.
- [ ] Shared primitives are added only for real repeated consumers; existing Tabs, Badge, Dialog, and Drawer are reused where suitable.
- [ ] Desktop, tablet, and mobile are recomposed and verified; keyboard/focus, axe, loading/empty/error/partial states, and evidence are covered for changed surfaces.
- [ ] No fake metrics, commercial/provider data, new domain policies/states, UI-owned state tables, weaker RLS, or unrelated changes are introduced.
- [ ] `verify:agent`, `verify:security`, `verify:db`, `verify:ui`, `verify:full`, and applicable Official CI pass; inspected evidence supports every claim.
- [ ] Stage 02 remains `done / verified:true`; this task remains `in_progress / verified:false` until all acceptance criteria and gates are proven.

## Allowed files / domains

The executable scope below is intentionally machine-readable by `eval:agent`; each pattern is bounded to the Stage 2.1 work observed in this branch.

- `src/app/(protected)/(admin)/**`
- `src/app/(protected)/(teacher)/**`
- `src/app/globals.css`
- `src/components/ui/**`
- `src/modules/admin-content/ui/**`
- `src/modules/teacher-operations/**`
- `src/server/students/**`
- `src/styles/**`
- `supabase/migrations/20261004201105_admin_student_directory_visual_projection.sql`
- `supabase/tests/students_directory.sql`
- `scripts/run-sql-tests.mjs`
- `scripts/verify-security.mjs`
- `tests/e2e/**`
- `tests/a11y/**`
- `tests/visual/**`
- `tests/unit/teacher-operations.test.ts`
- `harness/agent-state/**`
- `harness/feature_list.json`
- `harness/goals/stage-02-1-operations-ux.md`
- `harness/goals/stage-02-operations.md`
- `harness/evidence/stage-02-1-operations-ux/**`

No other domain is authorized. This scope does not authorize new UI-owned state tables or changes to protected business transitions.

## Forbidden areas

- Placement/Enrollment transitions, CRM transitions, cohort capacity/membership, Teacher lifecycle, CEFR, billing, and notification policy
- Auth/RLS weakening, direct role mutation, service-role exposure, or migration history edits
- New mockup-only values, fake data, product routes for later roadmap phases, or edits to preexisting unrelated/untracked evidence

## Mandatory tests

- Focused unit/application and E2E tests for changed workflows
- `npm run test:a11y` and visual checks at desktop/tablet/mobile for changed surfaces
- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:ui`
- `npm run verify:full`

## Required evidence

- Desktop/tablet/mobile screenshots for each altered surface, stored under `harness/evidence/stage-02-1-operations-ux/` without overwriting prior evidence
- Focused and full-gate command results, visual review, and Official CI URL
- Registry and progress records consistent with the observed result

## Definition of done

Every acceptance criterion passes; visual/a11y evidence is inspected against the supplied references; all mandatory gates and applicable CI pass; no protected domain behavior changed; task state and evidence match reality.
