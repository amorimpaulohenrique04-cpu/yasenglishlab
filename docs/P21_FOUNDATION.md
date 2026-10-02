# P21 foundation closure

Scope: P21.1 role routing, P21.2 commercial live usage, P21.3 cohorts V1. Base main: `94b574b40b8b05ed798f996294d2297ba92b5e31`. Branch: `feat/p21-p0-foundation-closure`.

The authoritative decisions are [workspace routing](adr/0007-role-aware-workspaces.md), [transactional usage](adr/0008-transactional-live-usage.md) and [cohort compatibility](adr/0009-cohorts-compatible-scope.md).

## Contracts

Student page context now explicitly requires STUDENT. Claims, durable roles and staff MFA retain their existing meanings. Workspace selection grants no permission. Subscription/plan entitlements remain the sole paid-capability authority. Course progress remains completion, never CEFR proficiency. Attendance remains a separate unique Teacher-owned fact. Home keeps its bounded, read-only own BOOKED/SCHEDULED projection and existing single primary action. Practice and Assessment scoring/answer-key boundaries remain unchanged.

## Migration rollout

Apply the four timestamped `202610020421*` migrations in order. Before rollout, inventory existing bookings by status, cancellation timestamp and temporal entitlement recoverability. A CANCELLED row without cancelled_at blocks rollout: reconcile against actual evidence, never assume a refund. LEGACY_UNRESOLVED snapshots preserve key/session time for conservative usage; no fabricated historical config is introduced. Verify unresolved counts after upgrade. Keep historical migrations intact.

Run two clean replays plus an upgrade from the main migration chain with legacy bookings. Confirm UUID/status/booked_at preservation, timestamped cancellations, correct provenance, no auto-cohort assignments, RLS and old UUID RPC compatibility. Rollback uses the deployment rollback procedure; do not drop booking history or commercial snapshots in place.

## Operations

`/admin/cohorts` requires ADMIN+AAL2. Create a course-linked cohort, link enrolled Students and active Teachers, then activate. Removing links ends the episode. Sessions must reference a linked Teacher and fit the cohort period. Existing reserved session identity/usage schedule cannot be changed. Teacher cancellation uses `cancel_teacher_live_session`, deriving the Teacher from auth; it never accepts an actor from the browser.

Support is not a Teacher or Admin workspace. Billing/video/meeting providers, Stripe decisions, live rescheduling and later P21 phases remain unresolved/out of scope. This task does not decide open provider questions.

## Verification and regression risks

Focused tests cover role/next matrices, real MFA, Student route refresh denial, weekly/monthly windows, quota denial audit, cancellation/rebooking, NO_SHOW, cross-session concurrency, own cohort reads, cross-cohort isolation and direct-assignment compatibility. Final gates are `verify:agent`, `verify:security`, `verify:db`, `verify:ui`, `verify:full` and Official CI. Evidence is stored in `harness/evidence/p21-p0-foundation-closure/`; pending checks remain explicitly pending.

Risks: unresolved historical cancellations; new quota enforcement rejecting previously unlimited recurring bookings; stricter Student guards for staff-only accounts; stale cohort UI after revocation; privileged imports outside the command lock protocol; changing canonical fixtures affecting goldens. Mitigations are preflight reconciliation, immutable snapshots, server/RLS rechecks, nullable cohort compatibility, isolated canonical accounts, real race tests and untouched approved golden baselines.
