# Failure — immutable Assessment fixture replay

Classification: state  
Status: resolved  
Repeatable: yes  
Date: 2026-10-03  
PR/commit related: current branch `feat/stage-01-enrollment-core`, implementation `9571c47`

## Symptom

The second canonical fixture preparation failed before the next browser suite.

## Evidence

`setup-canonical-e2e.mjs:736` failed with SQLSTATE `55000`: `submitted assessment responses are immutable`, from `private.validate_assessment_response`. The corrected setup subsequently completed before and after the full Placement browser journey.

## Root cause

The new local fixture teardown deleted submitted responses while the existing Assessment mutation guard remained active. That guard correctly protects production history.

## Responsible layer

Local deterministic test fixture lifecycle, not Assessment authorization.

## Immediate fix

Within the explicitly localhost-only privileged cleanup transaction, suspend the four history guards only while removing the four dedicated synthetic students' records; restore each guard before commit. Rollback also restores trigger state. Runtime migrations retain all guards and RLS.

## Permanent protection

Canonical setup is replayed between the real E2E and accessibility suites by the existing verification orchestrators. Placement SQL continues to prove submitted/history immutability and direct DML denial after preparation.

## Test/eval created

`tests/e2e/placement-enrollment.spec.ts` creates and submits real persisted responses; `tests/a11y/placement.spec.ts` consumes the reset fixtures after the same canonical setup. `supabase/tests/placement.sql` verifies immutable review history and forbidden mutations.

## Reproduction

Run canonical setup, submit the Placement pending/ready fixtures, then run canonical setup again against the same local database. The initial teardown failed deterministically on submitted responses.

## Before/after proof

Before: second setup exited 1 with `submitted assessment responses are immutable`.  
After: setup completed, both Placement E2E tests passed, and the following setup completed again to start the four desktop/mobile accessibility scenarios. Final gate results are recorded in the Stage 01 evidence.
