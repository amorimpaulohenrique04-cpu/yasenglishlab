# Evidence — placement-practice-dead-ends

Date: 2026-10-18. Branch `claude/upbeat-bhabha-d3406d` (base main@97e39c6).

## SQL (local Supabase, port 55322)

The shared local database was one migration behind main (20261018130000). To avoid mutating it, each SQL
suite ran inside a single transaction that applied `20261018140000_rate_limit_window_identity.sql` and
`20261018150000_placement_practice_dead_ends.sql`, then the test, then rolled back:

| Suite | Result |
| --- | --- |
| `placement_practice_dead_ends.sql` (new) | pass |
| `operational_alerts.sql` (7 categories) | pass |
| `placement_teacher_assignment.sql` | pass |
| `admin_course_enrollment.sql` | pass |
| `function_privileges.sql` | pass |

## App tests

- `tests/unit/placement.test.ts`, `tests/unit/practice.test.ts`, `tests/unit/admin-plans-alerts.test.ts`
- `tests/integration/placement-journey-gate.test.ts`, `tests/integration/placement-reviewer-reassignment.test.ts`

After the rolled-back runs, the two pending additive migrations (main's `20261018140000` and this
`20261018150000`) were applied to the local stack with `supabase migration up --local`. Running every
suite from `scripts/run-sql-tests.mjs` individually against that non-reset database: 42/48 pass. The 6
failures are fixture collisions with leftover local rows and do not reference anything changed here:
`vertical_slice_persistence`, `schedule_booking`, `p21_core_experience`, `subscription_access`,
`practice_authoring` (`count(*)=1` over all assignments), `rls_permissions` (idempotency key reuse).
The official proof is CI's clean preview database (`database-proofs`).

## Gates (local, Windows)

| Gate | Result |
| --- | --- |
| `npm run verify:agent` | pass (format, lint, typecheck, 342 unit, 363 integration, verify:db, build, harness, ratchet, security, behavioral eval) |
| `npm run verify:db` | pass (static contract, included in verify:agent) |
| `CANONICAL_E2E=1 npm run verify:ui` | **blocked locally**: build and Storybook build pass; `scripts/setup-canonical-e2e.mjs` aborts with `23514 Unpublish before editing content` because the shared local DB is not freshly reset. Not resetting the user's local data; CI `Preview (e2e/accessibility/visual)` runs on a clean database. |

No screenshots were captured: reaching the "no compatible cohort" and admin-enrolled states needs the
canonical fixture that could not be prepared locally. Visual proof is pending CI.
