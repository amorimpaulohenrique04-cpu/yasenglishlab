# PR 1 — journey, pedagogy and live classes: requirement → code → test → evidence

Branch `feat/yas-journey-pedagogy-closure`. Statuses are what was actually run; `NOT_RUN` means no evidence yet.
Local SQL runs used the project's Supabase on port 55322 (a long-lived dev database). Suites that commit their own
fixtures (`schedule_booking`, `rls_permissions`, `p21_core_experience`, `subscription_access`, `practice_authoring`)
only pass on a fresh database; their results come from CI.

| Block | Requirement | Main code | Tests | Status |
|---|---|---|---|---|
| 1A | Admin sees a suggested Teacher (lowest load), confirms or picks another; AAL2, idempotent, audited | `20261017120000_pr1_placement_teacher_assignment.sql`, `src/server/placement/teacher-assignment.ts`, `admin/enrollments` | `supabase/tests/placement_teacher_assignment.sql`, `tests/unit/placement-review-sla.test.ts` | SQL PASS, unit PASS |
| 1A | 24h review deadline visible to staff only | `src/modules/placement/domain/review-sla.ts` | unit | PASS (no Student surface renders it) |
| 1B | Cohorts have no student ceiling; live-session capacity (≤ 6) untouched | `20261017130000_pr1_cohorts_unlimited.sql` | `cohort_unlimited.sql` (101 students), `live_booking_integrity.sql`, `booking_quota.sql`, concurrency script | SQL PASS |
| 1B | Schedule compatibility compares instants (IANA zones, DST) | `20261017140000_…`, `windowFitsPreference` | `tests/unit/placement.test.ts` | unit PASS; SQL path only exercised for same-zone cases |
| 1B | Admin queue paginated | `20261017150000_…`, `count_placement_queue` | `placement_teacher_assignment.sql` | SQL PASS |
| 1C | Welcome catalog during review; server-enforced | `20261017160000_pr1_welcome_catalog.sql` | `welcome_catalog.sql` | SQL PASS |
| 1C | One persisted notification when review ends | `20261017170000_…` | `placement.sql` | SQL PASS |
| 1C | Mandatory dialog + pedagogic routes redirect while the decision is pending | `placement-decision-dialog.tsx`, `decision-gate.ts`, route layouts | — | typecheck only; E2E `NOT_RUN` |
| 1D | Feedbacks tab, own data, paginated | `20261017180000_…`, `/feedbacks` | `student_feedbacks.sql` | SQL PASS; page E2E `NOT_RUN` |
| 1D | Per-item teacher feedback in v3 result (#76) | `practice-session-player.tsx`, `manual-feedback.ts` | — | typecheck only; E2E `NOT_RUN` |
| 1D | Opening a lesson unlocks its practices (#77) | `markLessonStarted` | `learning-application.test.ts` | integration PASS |
| 1E | Google Meet-only links, join window unchanged, cancel notice + audit | `20261017190000_…`, `session-input.ts` | `live_booking_integrity.sql`, `p21-core-experience.test.ts` | SQL PASS, unit PASS |
| 1E | In-app notices inbox | `/avisos`, `student-inbox.ts` | — | typecheck only |
| 1E | Mux private video | — | `docs/VIDEO_HOMOLOGATION.md` | real provider `NOT_RUN_EXTERNAL` |
| 1F | Retest request with justification and history; no automatic effect | `20261017200000_…`, teacher/admin pages | `reassessment_requests.sql` | SQL PASS |
| 1F | CEFR language: evidence, no cut scores, no certification claim | `docs/CEFR_ASSESSMENT.md` | — | documented |
| 1F | Content readiness report | `scripts/sql/content-readiness.sql` | run once on dev DB | 0 issues on dev DB; production content not inspected |
| 1F | Fixtures #78 / #79 | `setup-canonical-e2e.mjs`, `rls_permissions.sql` | — | fixed in source; CI `NOT_RUN` |

## Known gaps / decisions to confirm

- Welcome catalog exposes the title of the course/module that holds a welcome lesson (needed to render it).
- Real-time Mux, Meet admission control, and the full gate (`verify:full`: E2E, a11y, visual, goldens) are not run.
- `PLACEMENT_READY` redirects pedagogic routes to Home; Support, Billing, Profile and onboarding stay open.
- The staff incident for a teacher cancellation is an audit-log entry (`TEACHER_SESSION_CANCELLED`); the Admin alert
  surface for it belongs to PR 2 block 2C.
