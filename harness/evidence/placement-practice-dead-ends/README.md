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

## Gates

See the PR description for the exact `verify:*` outcomes of this branch.
