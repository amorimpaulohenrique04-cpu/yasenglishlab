# Failure — Recurring live quota did not consume booking facts

Classification: architecture  
Status: resolved  
Repeatable: yes  
Date: 2026-10-02  
PR/commit related: current change — feat/p21-p0-foundation-closure

## Symptom

The main trigger checked positive entitlement and capacity but permitted two distinct same-week sessions with limit=1.

## Evidence

`harness/evidence/p21-p0-foundation-closure/upgrade-result.log` records the real main migration chain, two persisted BOOKED rows, then corrected quota denial after upgrade. The ambiguous cancellation preflight is also exercised before applying the migration.

## Root cause

No commercial usage window or per-Student serialization existed. A session-row lock alone cannot serialize two different sessions for the same Student.

## Responsible layer

PostgreSQL booking command and immutable commercial snapshot.

## Immediate fix

Use session-start Recife windows, booking facts and a transaction advisory Student lock after session lock; check quota and capacity transactionally. Preserve the UUID wrapper and introduce a result RPC for durable minimal denial audit.

## Permanent protection

Real SQL quota assertions, barrier-based two-session races, retry/cancel races and upgrade preflight run with the official database suite. Authenticated direct DML and commercial snapshot reads remain denied.

## Test/eval created

`supabase/tests/booking_quota.sql`, `scripts/test-schedule-concurrency.mjs`, `supabase/tests/rls_permissions.sql`, `scripts/verify-db.mjs`, `scripts/verify-security.mjs`.

## Reproduction

Reset local DB through main version `20261001190000`; run the evidence upgrade runner. For post-fix, run `test:integration:db`.

## Before/after proof

Before: RED main in upgrade-result.log.

After: PASS upgrade and focused SQL/concurrency logs. Broader final gates are recorded separately and are not implied by this regression result.
