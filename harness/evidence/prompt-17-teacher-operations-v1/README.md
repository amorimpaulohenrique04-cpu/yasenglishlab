# Evidence — prompt-17-teacher-operations-v1

Status: in progress — Official CI evidence pending.

## Baseline

- Base branch: `main`
- Base SHA: `a77386df147805f8ecd236f63657c90d251b3c63`
- Working branch: `feat/teacher-operations-v1`
- Agenda V1: PR #20 merged at the baseline SHA.
- Dependencies: P15 and P16 were already `done` / `verified`.

## Implemented evidence surfaces

- Migration: `supabase/migrations/20261001030000_teacher_operations_v1.sql`
- DB/RLS evidence: `supabase/tests/teacher_operations.sql`
- Unit: `tests/unit/teacher-operations.test.ts`
- Application integration: `tests/integration/teacher-operations-application.test.ts`
- E2E: `tests/e2e/teacher-operations.spec.ts`
- A11y: Teacher flow added to `tests/a11y/critical-flows.spec.ts`
- Real MFA helper: `tests/helpers/teacher-mfa.ts`
- Runtime fixture: `scripts/setup-canonical-e2e.mjs`
- Persistence/audit postcondition: `scripts/assert-canonical-e2e.mjs`
- Security ratchet: `scripts/verify-security.mjs`
- DB ratchet: `scripts/verify-db.mjs`

## Security facts encoded in executable tests

- STUDENT denied.
- SUPPORT without TEACHER denied.
- ADMIN without TEACHER denied.
- TEACHER AAL1 denied.
- TEACHER AAL2 allowed.
- Teacher A cannot read/operate Teacher B session and vice versa.
- TEACHER + ADMIN remains Teacher-scoped inside Teacher Operations.
- Roster result contract excludes email/phone/user_id/subscription/billing/entitlement/assessment/meeting fields.
- Broader Student profile context remains assignment-scoped.
- Direct authenticated attendance INSERT/UPDATE remains denied.
- Attendance retry reuses one unique row.
- marked_by_user_id derives from authenticated Teacher.
- Cancelled booking and unsupported attendance states are rejected.
- Attendance audit actor/session/booking/final state are asserted and privacy-scanned.
- Audit trigger is transaction-coupled to attendance mutation.

## UI evidence contract

The Teacher E2E captures:

- `artifacts/canonical-slice/teacher-desktop.png`
- `artifacts/canonical-slice/teacher-tablet.png`
- `artifacts/canonical-slice/teacher-mobile.png`

These are initial implementation evidence, not an invented approved golden reference.

## Pending

- Official CI run ID/link.
- Exact conclusion for Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate.
- Downloadable preview evidence artifact ID/link.
- Final diff/privacy/scope audit after the last CI correction.
- Final verification JSON and registry transition to `done` / `verified: true`.

Do not interpret this file as completion evidence until the pending items are filled with observed CI results.
