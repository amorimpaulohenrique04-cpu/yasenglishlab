# GOAL — prompt-17-teacher-operations-v1: Teacher Operations V1

Status: done  
Owner: agent  
Created: 2026-09-30  
Updated: 2026-10-01

## Objective

Deliver a minimal, secure Teacher Operations V1 that lets an authenticated TEACHER at AAL2 access only the teacher area associated with their own `auth.uid()`, list only their own live sessions, view the minimum operational roster for those sessions, and persist `ATTENDED` / `NO_SHOW` attendance with durable auditability. The feature must preserve existing RBAC/RLS, teacher-student assignment boundaries, booking semantics and open product questions without turning Teacher into Admin, Support or a commercial operator.

## Visible result

A TEACHER at AAL2 can open `/teacher`, see only their own sessions, open a session roster, and mark a valid BOOKED participant as Present or Absent. Refresh preserves the attendance state. Student, Support-only, Admin-only and Teacher AAL1 accounts cannot use the area. A teacher cannot access or mutate another teacher's session/roster/attendance.

## Relevant context

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/LIVE_CLASSES.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/SECURITY.md`
- `docs/AUDIT_LOG.md`
- `docs/OBSERVABILITY.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- Prompt 16 Agenda V1 implementation and tests
- Existing auth guards, audit writer, Live domain tables and RLS helpers

## Acceptance criteria

- [x] `/teacher` exists and requires durable role TEACHER + AAL2.
- [x] STUDENT, SUPPORT-only, ADMIN-only and TEACHER AAL1 are denied.
- [x] Multi-role users remain teacher-scoped inside Teacher Operations.
- [x] Teacher session reads derive teacher identity from `auth.uid()`; no caller-supplied teacher id exists.
- [x] Teacher sees only sessions whose `live_sessions.teacher_id -> teachers.user_id` matches the authenticated user and whose teacher record is active.
- [x] Roster is available only for the authenticated teacher's own session and exposes only operational fields required by V1.
- [x] Broader pedagogical student context remains governed by active `teacher_student_assignments`.
- [x] Attendance accepts only `ATTENDED` and `NO_SHOW`, only for a valid `BOOKED` booking in the teacher's own session.
- [x] Attendance retry/update reuses the existing unique row; no duplicate attendance history table is created.
- [x] `marked_by_user_id` is derived from authenticated context and `marked_at` is set by the trusted boundary.
- [x] Direct authenticated INSERT/UPDATE on `attendance` remains denied.
- [x] Attendance mutation produces a durable audit fact identifying actor, session, booking, attendance and resulting status without secrets or unnecessary PII.
- [x] NO_SHOW has no invented commercial consequence.
- [x] No cancellation, rescheduling, credit policy, meeting provider, Admin CMS, Teacher authoring or availability CRUD is introduced.
- [x] Loading, empty, error, success, forbidden, MFA-required and no-participant states are covered according to existing route/guard patterns.
- [x] DB/RLS, integration, E2E, a11y and visual evidence pass.
- [x] Official CI is green and the final diff is scope-audited before closure.
- [x] No unrelated behavior regressed.

## Allowed files / domains

Primary:

- `src/app/(protected)/(teacher)/**`
- `src/modules/teacher-operations/**`
- `src/server/teacher-operations/**`

When necessary:

- `src/server/auth/**` — reuse/refine only when justified
- `src/lib/supabase/browser.ts` — P17 MFA exposed the pre-existing dynamic `process.env[name]` browser lookup; static `NEXT_PUBLIC_*` access is required so Next.js can inline the existing public Supabase configuration without changing auth semantics
- `src/app/mfa/mfa-panel.tsx` — P17 real-MFA retries exposed a pre-existing enrollment recovery bug: Supabase returns unverified factors only in `data.all`, and stale Strict Mode effects can race enrollment; refine preparation only so the existing mandatory AAL2 contract is deterministic without changing authorization semantics
- `src/server/audit/**` — attendance audit action/integration only
- `src/modules/domain/contracts.ts` — Teacher contracts only if required
- `supabase/migrations/**` — one append-only Teacher Operations V1 migration
- `supabase/seed.sql` — deterministic Teacher fixtures only if required
- `supabase/config.toml` — P17 real-MFA E2E exposed that the local/Preview TOTP provider was disabled despite the existing staff AAL2 contract; enable only TOTP enrollment/verification so Preview can exercise the real contract
- `supabase/tests/**`
- `tests/unit/**`
- `tests/integration/**`
- `tests/e2e/**`
- `tests/a11y/**`
- `tests/visual/**`
- `scripts/**`, `playwright.*.config.ts` — only required Teacher test wiring
- `docs/LIVE_CLASSES.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/AUDIT_LOG.md`
- `docs/DATA_MODEL.md`
- `docs/OPEN_QUESTIONS.md`
- `harness/**`

Any file outside this list requires a justification recorded in this GOAL before modification.

## Forbidden areas

- Turning Teacher into Admin or Support.
- Generic `staff` authorization or `TEACHER || SUPPORT || ADMIN` access to Teacher Operations.
- Browser-controlled `teacher_id`, `marked_by_user_id`, actor identity or role.
- New role/authorization system, client-side role authority or `user_metadata` authorization.
- Direct authenticated INSERT/UPDATE grants on `attendance`.
- Global widening of profile visibility for Teacher.
- Billing/subscription/entitlement editor access.
- Teacher-created student assignments.
- Commercial no-show consequences, credits, reposições, cancellation or rescheduling.
- Meeting provider/URL/token implementation.
- Teacher availability CRUD without an explicit existing contract.
- Admin CMS, Teacher authoring or unrelated Practice/CEFR changes.
- Editing historical migrations.
- New `.skip` / `.fixme`, weakened assertions or wider visual tolerance.

## Mandatory tests

- Teacher unit tests for deterministic mapping/validation where applicable.
- Teacher application/server integration tests.
- Real PostgreSQL DB/RLS tests covering role/AAL2/session/roster/attendance/audit and negative paths.
- Real E2E: TEACHER AAL2 → own session → roster → ATTENDED → refresh persists.
- E2E negative cross-teacher session path.
- MFA path: TEACHER AAL1 is redirected/blocked according to the current auth contract.
- Accessibility checks for the Teacher flow and attendance controls.
- Responsive visual evidence for desktop/tablet/mobile.
- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:ui`
- `npm run verify:full`

When operating through GitHub MCP, Official CI may provide the executable environment for the aggregate gates; claims must match observed jobs/logs exactly.

## Required evidence

- Baseline `main` SHA and branch.
- New migration and executable DB/RLS assertions.
- Positive/negative Teacher role + AAL2 evidence.
- Cross-teacher isolation evidence.
- Roster-minimization/privacy evidence.
- Attendance persistence, retry/update and direct-DML-denial evidence.
- Audit actor/session/booking/attendance/status evidence.
- Integration, E2E, a11y and responsive visual evidence.
- Exact Official CI run/job conclusions and artifact links.
- Final `main...feat/teacher-operations-v1` scope audit.
- Durable records under `harness/evidence/prompt-17-teacher-operations-v1/`.

## Definition of done

Done means every acceptance criterion passes, every applicable gate passes, Official CI evidence is inspected, the final diff is reviewed for scope/security/privacy regressions, decisions/progress/blockers are recorded, and `harness/feature_list.json` reflects the verified state. No merge to `main` is performed without explicit user instruction.
