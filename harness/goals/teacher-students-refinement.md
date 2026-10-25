# GOAL — teacher-students-refinement: Refinamento da tela Alunos do professor

Status: planned  
Owner: agent  
Created: 2026-10-24  
Updated: 2026-10-24

## Objective

Refine the teacher student workspace (`/teacher/alunos`) and student profile (`/teacher/alunos/[studentId]`) to fix the 14 problems found in the 2026-10-24 UX review: prioritize the teacher's work with a "Próximas ações" panel, give the table full width by removing the right rail, separate administrative, engagement and pending dimensions, explain KPI bases, clean the activity feed, improve hierarchy and accessibility, and make the profile CTA contextual. The work keeps `docs/TEACHER_STUDENTS.md` rules (no inferred CEFR, no e-mail, no bulk actions), uses only additive migrations, and does not change RLS, auth or AAL2. Executed in stages 0 to 6 of the approved plan.

Current stage: Stage 0 (registration only: this goal file, plan.md section and feature_list entry).

## Visible result

- The teacher sees the next action at the top of `/teacher/alunos` without scrolling, with up to 8 items (placement entry reviews, practice reviews, reassessment requests and inactive students), ordered by deadline.
- The table uses the full width; no status label breaks onto two lines at 1440 px.
- The "Com pendências" tab lists students with pending entry or practice reviews. "Precisam de atenção" keeps its current meaning.
- The donut shows only enrolled students by course; students awaiting enrollment appear as separate text.
- KPIs state their base ("7 alunos com trilha ativa", "1 de 14 alunos").
- The "Visão da carteira" section (distribution and relevant activity) is collapsible below the table.
- The feed shows only relevant events and labels placement assessments as "Teste de entrada".
- The profile hero shows a contextual primary CTA ("Revisar teste de entrada" or "Revisar prática"); "Pedir novo teste" moves into a "Mais ações" menu.
- The profile follow-up card shows last relevant interaction, 7-day trend, pending items and one suggested next action.
- No text below `--yas-font-size-xs` (0.75rem); common text meets 4.5:1 contrast.

## Relevant context

- Source plan (approved in chat): `C:\Users\PAULO HENRIQUE\.claude\plans\o-codex-implementou-essas-effervescent-torvalds.md`.
- Problems addressed (14 items): the page does not prioritize teacher work; the right rail squeezes the table; the chart mixes course with "Sem matrícula"; KPIs use different populations without explanation; administrative, engagement and pedagogical states are mixed; some actions are redundant; the feed is repetitive and uses technical names; contrast and font size need measurement; the profile has a low-value card and a prominent "Pedir novo teste".
- Data already available in RPC `teacher_students_workspace`: `practice_pending`, `entry_pending`, `inactive`, `inactivity_days`, `reassessment_open`, enrollments with classes and `progress`. `progress` is the partial average of lessons; `completed` counts only 100% completed lessons.
- User decisions (2026-10-24):
  1. "Próximas ações" includes entry and practice reviews, reassessment requests and students inactive for 7 days or more, ordered by deadline.
  2. Pending reviews are NOT part of "Precisam de atenção"; they get their own tab "Com pendências".
  3. The right rail is removed. Distribution and activity move to a collapsible "Visão da carteira" section below the table.
- Stages from the approved plan:
  - Stage 0: preparation (this goal, plan.md section, feature_list entry; Haiku).
  - Stage 1: data (additive migration with `create or replace` over the functions from `20261023211118_teacher_students_workspace.sql` and `20261024130000_…`; `actions`, `pending` tab support, `placement_state`, feed filter and "Teste de entrada" label, profile `engagement`; SQL tests, zod schemas and docs update; `yas-database`).
  - Stage 2: list (next-actions panel, full-width table, three separate dimension helpers, action menu cleanup, KPI bases, tabs, collapsible "Visão da carteira", hierarchy, font and contrast fixes; `yas-frontend`).
  - Stage 3: profile (contextual CTA and "Mais ações" menu, follow-up summary, explained progress, three dimensions in hero; `yas-frontend`).
  - Stage 4: sidebar (item 13): reproduce in Chrome at 1440x900 and 768 whether the sidebar shifts when the page is scrolled to the end; if it is only a full-page capture artifact, record it and do not change code; otherwise fix `src/components/layout/layout.css`.
  - Stage 5: tests (unit, e2e, accessibility with axe at 1440, 768 and 390 px, computed contrast check; selectors updated preserving assertion intent; no golden auto-update).
  - Stage 6: verification (SQL suite, unit tests, Alunos specs, `verify:db`, `verify:security`, `verify:ui`, `verify:agent`; visual check at 1440, 768 and 390 px with evidence under `harness/evidence/teacher-students-refinement/`).
- Existing references: `docs/TEACHER_STUDENTS.md`, `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`, `docs/SECURITY.md`, `docs/AUTH_RBAC_RLS.md`, `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`.
- Main implementation files: `src/modules/teacher-operations/ui/students-workspace.tsx`, `ui/student-shared.tsx`, `ui/student-profile.tsx`, `ui/students.module.css`, `domain/student-workspace.ts`, and `src/server/teacher-operations/student-workspace.ts`.
- Migrations already applied locally must not be edited; new work uses additive migrations only.

## Acceptance criteria

- [ ] Stage 0 done: goal file exists; plan.md section appended without overwriting prior content; feature_list entry added as `in_progress` with `verified: false`.
- [ ] `actions` returns at most 8 items for the whole roster (independent of page and filters), ordered as specified, with `actionsTotal`, and is isolated between teachers.
- [ ] "Com pendências" tab filters and counts students with `entry_pending + practice_pending > 0`; "Precisam de atenção" KPI and tab are unchanged.
- [ ] Placement events are labeled "Teste de entrada"; the list feed shows only completed lesson, submitted practice, submitted assessment, attended session and recorded absence.
- [ ] Profile `engagement` counts learning events over the last 7 days and the previous 7 days.
- [ ] Table occupies full width; no status label breaks onto two lines at 1440 px.
- [ ] Administrative, engagement and pending dimensions are separate helpers and separate columns or labels.
- [ ] Distribution donut contains only enrolled students by course; "aguardando matrícula" is separate text.
- [ ] KPI cards state their base population.
- [ ] Kebab menu no longer contains "Ver perfil"; accessible name "Mais ações para {nome}" is kept.
- [ ] Profile hero shows a contextual primary CTA when a review is pending; "Pedir novo teste" is in the "Mais ações" menu.
- [ ] Profile follow-up summary shows interaction, trend, pending items and one suggested action following the rule: entry, then practice, then reassessment, then inactivity.
- [ ] No text below 0.75rem; common text contrast 4.5:1 or more, including `--yas-color-muted` on lilac backgrounds.
- [ ] Sidebar issue (item 13) either reproduced and fixed, or recorded as a capture artifact with evidence.
- [ ] Specs for Alunos and the SQL suite `teacher_students_workspace` pass; no assertion weakened.
- [ ] `docs/TEACHER_STUDENTS.md` updated for "Próximas ações", "Com pendências" and the three dimensions.
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `src/modules/teacher-operations/**`
- `src/server/teacher-operations/**`
- `src/app/(protected)/(teacher)/teacher/alunos/**`
- `src/components/layout/**`
- `src/components/ui/**`
- `supabase/migrations/**`
- `supabase/tests/teacher_students_workspace.sql`
- `tests/**`
- `docs/TEACHER_STUDENTS.md`
- `harness/**`

## Forbidden areas

- Editing previously applied migrations; only new additive migration files.
- Weakening RLS, auth, AAL2, role or security checks to make a test pass.
- Auto-updating goldens or screenshot baselines; rewriting tests merely to turn them green.
- Billing/Asaas/checkout/subscription code (`yas-billing` domain).
- Inferred CEFR, e-mail field, "Adicionar aluno", bulk selection, invented numbers or fake trends.
- Notification bell (deferred by product decision).
- Commit, push, merge or deploy without explicit authorization.
- Concurrent edits: one writing specialist at a time, with no overlapping files.

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:ui` (visual change)
- `npm run verify:db` (database and migration change)
- `npm run verify:security` (auth/access-related change to the profile and RPCs)
- Focused checks per stage: SQL suite `teacher_students_workspace`, `npx vitest run tests/unit/student-workspace.test.ts`, Alunos e2e specs (`tests/e2e/teacher-students-workspace.spec.ts`, and `tests/e2e/teacher-surfaces.spec.ts` if profile titles change), typecheck.
- `npm run verify:full` is release-grade and runs only at the end, if authorized.

## Required evidence

- Exact command results (PASS/FAIL with relevant lines only) for every gate.
- Screenshots at 1440x900, 768 and 390 px for the list and profile, under `harness/evidence/teacher-students-refinement/`.
- SQL test output for the migration and RPC changes; migration evidence for database changes.
- Sidebar reproduction notes (Stage 4) in the evidence folder.
- Failures and blockers recorded under `harness/failure-log/`.

## Definition of done

Done means every acceptance criterion passes, all mandatory gates pass (none skipped or diluted), evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. Until the mandatory gates pass, the task is not marked verified.
