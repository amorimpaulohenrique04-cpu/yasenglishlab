# Failure — Teacher screens polish: shell regressions, fixture drift and gate false negatives

Classification: test gap
Status: open
Repeatable: yes
Date: 2026-10-24
PR/commit related: current change on `codex/teacher-sessions-redesign` (uncommitted)

## Symptom

1. Six e2e specs locating tabs by exact name (`"Participantes"`, `"Recursos e tarefas"`) stopped finding them after tab counters were added to the accessible name.
2. `teacher-sessions-redesign.spec.ts:43/145` — `getByLabel("Buscar")` resolved to two elements after the global search trigger was added to the topbar.
3. `scripts/setup-canonical-e2e.mjs` aborted with FK violation `placement_review_drafts_placement_case_id_fkey` after any run that saved an entry-review draft.
4. `/admin/enrollments` showed "Fila de matrículas indisponível" (ZodError invalid UUID in `loadPlacementCohortSettings`).
5. `npm run format:check` failed with ENOENT for tracked files deleted in the working tree.
6. Teacher layout re-render cost (search index loaded on every request) made server-action redirects exceed e2e 5 s expectations.

## Evidence

- Playwright logs in the task scratchpad (`gates/verify-ui.log`), `core-live.spec.ts:184` timeout on `getByRole('tab', { name: 'Participantes', exact: true })`.
- Dev log: `POST /teacher/sessoes/nova` 3.7–4.8 s with `saveSessionResultAction` 584 ms.
- Seed stderr: `update or delete on table "placement_cases" violates foreign key constraint "placement_review_drafts_placement_case_id_fkey"`.
- Leftover row `cohorts.id = 83300000-0000-0000-0000-000000000001` ("Slice cohort").

## Root cause

1. Tab badge rendered as sr-only text inside the tab, changing its accessible name.
2. Topbar trigger used `aria-label="Buscar (Ctrl K)"`; `getByLabel` matches labels by substring.
3. New draft table added without the seed's explicit child-table cleanup.
4. `supabase/tests/vertical_slice_persistence.sql` inserts a non-RFC UUID cohort and cleans it up only at the end; an aborted run (ON_ERROR_STOP at line 47) leaves it behind.
5. `check-format.mjs` lists files with `git ls-files`, which includes tracked-but-deleted paths.
6. `loadTeacherSearchIndex()` (3 RPCs) ran in the teacher layout.

## Responsible layer

UI primitive (1), UI shell (2, 6), harness fixture (3), database test hygiene (4), harness gate (5).

## Immediate fix

1. `src/components/ui/navigation.tsx`: count exposed via `aria-describedby`; accessible name is the label.
2. `TeacherSearchTrigger`: no `aria-label`; name comes from visible "Buscar…" text (kept as visually-hidden text on mobile).
3. Seed deletes `placement_review_drafts` before `placement_cases`.
4. Applied the test's own cleanup statements locally.
5. `check-format.mjs` skips tracked files absent from the working tree.
6. Search index loads lazily through a server action on first palette open.

## Permanent protection

- Existing exact-name tab locators in e2e/a11y specs now guard the accessible-name contract.
- New `tests/e2e/teacher-entry-workspace.spec.ts`, `teacher-availability-workspace.spec.ts`, `teacher-students-workspace.spec.ts` cover the redesigned screens.
- Seed cleanup is exercised by every `verify:ui` / e2e run.
- Item 4 remains open: the SQL test should wrap its fixture in a transaction or use an RFC-valid UUID.

## Test/eval created

The three new e2e specs above; `core-live`, `teacher-surfaces`, `placement-enrollment`, `teacher-sessions-redesign` as regression guards; `npm run format:check`.

## Reproduction

`node scripts/setup-canonical-e2e.mjs` after saving an entry draft (3); `npx playwright test tests/e2e/core-live.spec.ts` (1, 6); `npm run format:check` with a deleted tracked file (5).

## Before/after proof

Before: failures listed in Symptom (logs above).
After: `teacher-surfaces` 1/1, `placement-enrollment` 2/2, three new specs 3/3, `format:check` "Formatting passed: 903 tracked source files"; gate reruns recorded in `harness/agent-state/progress.md`.
