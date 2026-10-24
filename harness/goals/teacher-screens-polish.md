# GOAL — teacher-screens-polish: Teacher screens polish (entrada, disponibilidade, alunos, shell)

Status: planned  
Owner: agent  
Created: 2026-10-23  
Updated: 2026-10-23

## Objective

Bring the Teacher screens Revisões de entrada (list and detail), Disponibilidade, Alunos and the teacher shell (sidebar, header, user menu, Ctrl K) from the current uncommitted implementation to the approved mock, fixing the functional and visual bugs found in the 2026-10-23 audit, without fake data and without changing RLS/auth. The full plan is executed in stages 0 to 6; stage 7 is a proposal outside this cycle.

Current stage: Stage 0 (mechanical preparation only): this goal file, plan.md section, removal of confirmed dead code, SQL runner registration, initials helper consolidation, focused typecheck and unit tests.

## Visible result

- The four teacher screens match the mock within the decisions below, with no invented data.
- Finishing a placement review leads to the next review; the pager stays correct ("N de M").
- Availability agenda has no visual overlap; availability toggle does not flicker.
- Sidebar keeps the user card visible at 1440x900 (only the nav list scrolls).
- Alunos follows `docs/TEACHER_STUDENTS.md`: no inferred CEFR, no e-mail, no "Adicionar aluno", no bulk selection.

## Relevant context

- Source plan (approved in chat): `C:\Users\PAULO HENRIQUE\.claude\plans\o-codex-implementou-essas-effervescent-torvalds.md`.
- Stages from that plan:
  - Stage 0: preparation (this goal, plan.md, dead code, SQL runner, initials helper).
  - Stage 1: shell and header (sidebar overflow fix, user menu via existing Dropdown, global Ctrl K, "PROFESSOR" heading, a11y of nav groups, heading typography token).
  - Stage 2: Revisões de entrada (2a additive migration for queue search/filter/completed-today; 2b backend neighbor and finalize flow fix; 2c UI: urgent badge, KPIs, kebab, detail evidence, feedback form, error modal, tabs keepMounted).
  - Stage 3: Disponibilidade (3a backend error mapping and KPIs plus SQL tests; 3b UI: overlap fix, KPI fixes, timezone label, read-only "Regras e preferências" card, multi-day chips, pointer-event drag, stable toggle).
  - Stage 4: Alunos (KPIs, sortable headers with aria-sort, row kebab, 300ms search debounce, relative dates, individual follow-up link, activity de-duplication and pager total fix via additive migration).
  - Stage 5: Tests (update selectors preserving assertion intent, new e2e/component/a11y coverage, no golden auto-update).
  - Stage 6: Verification (focused tests, verify:agent, verify:ui, verify:db, verify:security, verify:full; visual inspection at 1440, 768 and 375 px with evidence under `harness/evidence/`).
  - Stage 7 (proposal, out of cycle): KPI trends and sparklines (needs daily snapshot table); notification bell (needs notifications table with RLS).
- The four user decisions (2026-10-23):
  1. Alunos follows `docs/TEACHER_STUDENTS.md`: no inferred CEFR, no e-mail, no "Adicionar aluno", no bulk selection. Only the visuals move toward the mock.
  2. Disponibilidade gets a read-only "Regras e preferências" card with the real rules. Timezone becomes a label ("Horário de Brasília, GMT−3"), with no selector and no invented numbers.
  3. The header gets a user menu and a global Ctrl K. The notification bell is deferred.
  4. Revisões keeps the 24h SLA and the 4,000-character limit. Only labels change.
- Existing references: `docs/TEACHER_STUDENTS.md`, `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/AUTH_RBAC_RLS.md`, `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`.
- Migrations already applied locally must not be edited; new work uses additive migrations.
- Stage 0 touched only: `harness/goals/teacher-screens-polish.md`, `harness/agent-state/plan.md`, dead-code files confirmed unused, `scripts/run-sql-tests.mjs`, the shell layout files and the initials helper.

## Acceptance criteria

- [ ] Stage 0 done: goal file exists; plan.md section appended without overwriting prior content.
- [ ] Dead code removed only where `rg` over `src/`, `tests/` and `scripts/` shows no importer; anything still imported is reported, not deleted.
- [ ] `teacher_students_workspace.sql` is registered in `scripts/run-sql-tests.mjs` following the existing pattern.
- [ ] Initials duplicates in the shells consolidated into one shared helper with identical behavior; domain `initials` behavior unchanged.
- [ ] Typecheck and the three named unit test files pass or failures are reported with the relevant lines.
- [ ] Stages 1 to 6 accepted only with evidence for each mandatory gate.
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `harness/goals/teacher-screens-polish.md`, `harness/agent-state/plan.md`
- `src/modules/placement/ui`, `src/modules/teacher-operations/ui`, `src/modules/teacher-operations/domain`
- `src/server/placement`, `src/server/teacher-operations`
- `src/components/layout`, `src/components/ui/navigation.tsx`, `src/components/ui/overlays.tsx` (stages 1 to 2 only)
- Teacher route folders under `src/app/(protected)/(teacher)/teacher/` (revisoes, disponibilidade, alunos, sessoes, layout)
- `src/lib/initials.ts` (new shared helper, Stage 0 only)
- `scripts/run-sql-tests.mjs`
- Related tests in `tests/unit`, `tests/e2e`, `tests/a11y`, `tests/components` and `supabase/tests`
- Additive migrations under `supabase/migrations` (new files only)

## Forbidden areas

- Editing previously applied migrations.
- Weakening RLS, auth, AAL2, role or security checks to make a test pass.
- Auto-updating goldens or screenshot baselines; rewriting tests merely to turn them green.
- Billing/Asaas/checkout/subscription code (`yas-billing` domain).
- Adding a fake trend, sparkline, CEFR inference, e-mail field, bulk selection or notification bell.
- Changing the `session-calendar` domain `initials` semantics (first and last name, "?" fallback).
- Commit, push, merge or deploy without explicit authorization.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:ui` (visual changes)
- `npm run verify:db` (database and migration changes)
- `npm run verify:security` (auth, menu, Ctrl K and access changes)
- `npm run verify:full` (release-grade gate, run at the end only)
- Stage 0 focused checks: `npm run typecheck` (or `npx tsc --noEmit -p .`), `npx vitest run tests/unit/student-workspace.test.ts tests/unit/entry-workspace.test.ts tests/unit/availability-workspace.test.ts`.

## Required evidence

- Exact command results (PASS/FAIL with relevant lines only) for every gate.
- Screenshots at 1440x900, 768 and 375 px for the four screens, under `harness/evidence/teacher-screens-polish/`.
- SQL test output for new RPC/RLS tests and migration evidence for database changes.
- Failures and blockers recorded under `harness/failure-log/`.

## Definition of done

Done means every acceptance criterion passes, all mandatory gates pass (none skipped or diluted), evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. Until `verify:full` passes, the task is not marked fully verified.
