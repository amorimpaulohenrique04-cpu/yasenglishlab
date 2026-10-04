# Stage 02 Operations — evidence

Status: in progress; this evidence covers Admin Overview, Students/Student 360, Admin Teachers, Cohorts V2, Teacher surfaces, and CRM Leads V1. Final gates and Official CI are pending; the Stage 02 feature remains `verified: false`.

Base: `main@34f5e32f313fe16b8c09bcf13b64b4a7d11b9236`
Branch: `feat/stage-02-operations`
Pull request: [#33](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/33), open; merge intentionally left to the user.
The first Official CI run (`37213468368`) found a test-fixture permission error in `admin_teachers.sql`: the test queried `teachers` while running as `service_role`. The fixture now captures the reconciliation RPC result and compares retry output without table reads under that role; table-state assertions run after resetting the role. The focused Admin Teachers SQL/RLS suite passed locally after the correction. A new Official CI run for the correction is pending. Stage 02 remains `in_progress / verified:false`.
The worktree also contains preserved, untracked visual artifacts under `artifacts/canonical-slice/` and `artifacts/p21-foundation/`; they remain untouched and are not part of the PR.

## Admin Overview

The `/admin` route now reads the existing Placement `REVIEW_PENDING` and `STUDENT_DECISION` queues through the authenticated `get_placement_queue` RPC. That RPC enforces `ADMIN+AAL2` and caps each state at 100 rows. The UI reports `100+` at the cap, shows up to five oldest cases in each queue, and links to the existing filtered Matrículas screen. The shared Admin shell now opens at Visão geral while retaining Matrículas, Turmas, and Conteúdos navigation.

Focused browser test: `tests/e2e/cohorts-booking.spec.ts` — `Admin default entry after MFA administers cohort metadata` passed against the local canonical Supabase fixture. It covered Admin MFA, both queue states, axe WCAG 2 A/AA at desktop/tablet/mobile viewports, screenshots, and existing Cohorts metadata editing.

Screenshots, inspected after the passing run:

- `screenshots/admin-overview-desktop.png`
- `screenshots/admin-overview-tablet.png`
- `screenshots/admin-overview-mobile.png`

Local static checks passed: TypeScript (`node_modules/.bin/tsc.cmd --noEmit`), ESLint on changed TS/TSX files, Prettier on changed files, and `git diff --check`.

## Remaining

### Students directory and Student 360

`/admin/students` uses a name-only Admin+AAL2 RPC with stable ordering, bounded paging, literal wildcard search, and no email exposure. Its focused SQL test proves Admin+AAL2 allow, Admin+AAL1/Teacher/Student deny, row/page limits, RLS-protected base-table reads, no authenticated write grants, and an authenticated-only function grant.

`/admin/students/[id]` reads existing profile, Enrollment, active Cohort/Course, primary `cohort_teachers` assignment, Placement/Review/Decision/Transfer history, next booked scheduled session, curricular summary, recent Practice, Attendance, scored Assessment, and local Subscription status. Every list query has a fixed cap; the curricular summary is a read-only Admin+AAL2 aggregate capped at 20 active enrollments. The detail loader checks the target's `STUDENT` role before loading detailed records. No `student_360` state table or billing-provider/financial data was introduced. Account active/suspended status is not modeled in the public domain and is not inferred. Teacher access is excluded by the protected Admin layout and `requirePageRole("ADMIN")`.

Focused SQL migration/RLS tests and the Chromium directory-to-360 E2E/Axe assertions passed. The Playwright test process still hangs in auxiliary webServer teardown after its single test reports success; the process was interrupted and this caveat remains recorded in `verification.json`.

### Admin Teachers

`/admin/teachers` provides a bounded, searchable Admin+AAL2 directory with safe name/email projection, active/inactive and orphan-role state, cohorts with primary designation, availability, Course capabilities, next sessions, derived workload, and defensible operational alerts. Workload is read from existing assignments/cohorts/sessions/reviews; Courses are reused for learning-track capabilities.

Provisioning uses a server-only Auth invitation when the identity is absent, followed by an idempotent service-role-only reconciliation RPC that hardcodes `TEACHER`. The browser never supplies authority for role or teacher identity, no temporary password is stored, and the UI reports only that an invitation was requested, not delivered. Activation, capability changes, cohort assignment, and critical provisioning are audited. Deactivation blocks on future sessions, primary cohorts, or pending Placement/Practice reviews; no automatic reassignment occurs. Existing `manage_cohort()` semantics preserve temporal `cohort_teachers.is_primary` history.

Migration: `supabase/migrations/20261004130000_stage_02_admin_teachers.sql`, applied to the local Supabase database. Focused SQL/RLS and application tests passed; TypeScript, focused ESLint, formatting, and diff checks passed. The SQL suite proves Admin+AAL2 allow, AAL1/Teacher/Student/Support/anonymous denials, no Teacher self-role/status mutation, no direct role mutation, service-only reconciliation, bounded projections, idempotent retry, deactivation dependency guards, audit, and no global authenticated access to the capability table.

The canonical local fixture was prepared with the repository's existing helper and an ephemeral process-only password. Admin Teachers Playwright/Axe then passed in the same combined run as Admin Students, Admin Cohorts and Admin Leads.

### Admin Cohorts V2

Migration `20261004140000_stage_02_admin_cohort_directory.sql` is applied locally. `/admin/cohorts` has a bounded Admin+AAL2 directory with authoritative Placement capacity/recurring schedule, occupancy, capped roster, active/primary teachers, next scheduled sessions, and preserved query/pagination after actions. Direct removal of enrolled memberships remains behind Stage01 transfer; ending a Teacher relation with future sessions is blocked. SQL checks passed in `admin-cohorts`, `cohorts.sql`, and `placement.sql`; the focused Chromium/Axe test passed desktop and mobile and screenshots were inspected.

### Teacher surfaces

Migration `20261004150000_stage_02_teacher_surface_projection.sql` is applied locally. The existing teacher RPC now caps cohorts/roster, students, availability, sessions, and the default Practice review queue while keeping auth.uid()/AAL2 and assignment scope. `/teacher/turmas` presents authorized recurring schedule, occupancy, roster, and next sessions; `/teacher/alunos/[studentId]` adds a fixed-query bounded pedagogical projection for existing enrollments/Courses, curriculum progress, Practice, scored Assessment, Attendance, Placement, own booked-session homework, and internal notes. Course progress is explicitly not proficiency; billing, CRM, and private Admin notes are absent. SQL P21/Teacher Operations/cohort/Placement suites passed. Canonical Teacher MFA E2E/Axe covered the dashboard, cohorts, Student list/detail, mobile overflow, and mobile accessibility. Screenshot: `screenshots/teacher-student-mobile.png`.

### CRM Leads V1

Migration `20261004160000_stage_02_crm_leads_v1.sql` is applied locally. `/admin/leads` provides bounded search and stage-filtered records, create/edit, terminal Won/Lost transitions, owner validation, interaction history, tasks, completion, overdue indication, and link to an existing Student. CRM tables are RLS-enabled with no direct anon/authenticated table grants; Admin+AAL2 is checked in both server actions and database RPCs. Leads do not create Auth/profile/role/enrollment/Placement state. No consent state or delivery claim is invented. `admin-crm` SQL/RLS and CRM unit tests (2/2) passed. Canonical Admin MFA Playwright/Axe passed desktop/mobile with screenshot `screenshots/admin-leads-mobile.png`.

The earlier Student 360 auxiliary Playwright teardown caveat remains recorded as historical evidence. A later combined run of Admin Students, Teachers, Cohorts, and Leads completed with exit 0; the caveat is not treated as a current block. The full gate previously passed on `3c6db60` after clean local Supabase reset/replay: integration/RLS, E2E 28/28, a11y 28/28, Storybook 6/6 and golden 3/3. On the corrected fixture worktree, a fresh `verify:full` reset/replayed migrations and passed core, integration, SQL/RLS, Harness, security and all 10 agent eval rules, then finished E2E at 26/28. Two out-of-scope `workspace-entry.spec.ts` tests failed: Admin MFA remained at `/mfa?next=` after submitting TOTP; Teacher route-guard test timed out although the captured page was `/profile` with access denied. Accessibility and visual gates did not run in this attempt. The corrected `admin_teachers.sql` focused suite passed independently against local Supabase. Official CI rerun and final-state checks remain pending. Stage 02 remains `in_progress / verified:false`.
