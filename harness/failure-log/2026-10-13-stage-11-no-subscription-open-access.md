# Stage 11 — user without subscription treated as paid access

Classification: security

Status: open

Repeatable: yes

Date: 2026-10-13

PR/commit related: branch fix/etapa-11-fechamento-fluxo (PR pending)

## Symptom

A freshly signed-up account (fixed STUDENT role, no checkout, no enrollment) could list and start every published Practice activity. Separately, an `ACTIVE` subscription with a scheduled cancellation kept base content access indefinitely when the Asaas `SUBSCRIPTION_DELETED` webhook never arrived.

## Evidence

Read-only audit of main@9405647:

- `private.has_paid_access` returned true when no `subscriptions` row existed (`20261013170000_stage_04d_subscription_cancellation.sql:30`).
- `start_practice_attempt` had no enrollment check (`20261001155659_admin_content_v1.sql:558-585`), and the `practice_activities` SELECT policy only checked publication (`admin_content_v1.sql:65`).
- `request_subscription_cancellation` wrote `current_period_end` on an ACTIVE row (`stage_04d:141`), and `has_paid_access` granted ACTIVE regardless of that date (`stage_04d:30-36`).

## Root cause

The paid-access gate encoded "no subscription" as the seed/legacy exemption from ADR 0016 §5. The database cannot tell legacy students apart from new unpaid signups. Practice was the one student surface not scoped by enrollment, so the exemption became an open door. The ACTIVE branch ignored the scheduled cancellation end date.

## Responsible layer

Database (access predicate and Practice RLS/RPC), with the TypeScript mirror in `src/modules/billing/domain/access.ts`.

## Immediate fix

Migration `20261014120000_stage_11_access_closure.sql` (ADR 0017) makes the gate fail-closed. Access without a subscription now requires an explicit, audited `complimentary_access_grants` row, with a deterministic legacy backfill. The scheduled cancellation end date is enforced. Practice is scoped by enrollment.

## Permanent protection

`supabase/tests/access_closure.sql` asserts that a student without a subscription or grant is denied on content, Practice, progress and booking. It also covers grant expiry and revocation, and the cancel-scheduled ACTIVE row after its end date. The suite runs in the CI Database job (`scripts/ci/validate-migrations.sh` runs every `supabase/tests/*.sql`). `tests/unit/subscription-access.test.ts` locks the TypeScript mirror.

## Test/eval created

- `supabase/tests/access_closure.sql` (suite `access-closure` in `scripts/run-sql-tests.mjs`)
- `tests/unit/subscription-access.test.ts` (new cases)

## Reproduction

On a database migrated up to `20261014110000`: create an auth user with the STUDENT role and no subscription. As that user, call `start_practice_attempt` on a published activity; it succeeds.

## Before/after proof

Before: local clean database with migrations up to `20261014110000` plus seed. An auth user with only the STUDENT role (no subscription, no enrollment) saw `visible_activities=4` and got `attempt_started=true` from `start_practice_attempt('83000000-…-01')`.
After: the same reproduction on a clean database including `20261014120000` gives `visible_activities=0`, and `start_practice_attempt` raises `42501 Practice activity is unavailable`. Locally, `node scripts/run-sql-tests.mjs access-closure` passed (109 assertions), as did the `rls`, `subscription-access`, `subscription-cancellation`, `enrollment-integrity`, `function-privileges` and `sensitive-tables-negative` suites. Official CI Database job: pending.
