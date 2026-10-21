# Failure — atomic level transfer ordering

Classification: architecture  
Status: resolved  
Repeatable: yes  
Date: 2026-10-21  
PR/commit related: current change codex/level-based-cohorts

## Symptom

The first reordered transfer failed at placement.sql:120 with SQLSTATE 23514: "use Enrollment Core cohort transfer for enrolled Students".

## Evidence

Observed failing statement: UPDATE cohort_memberships SET status=LEFT before the placement case pointed to the target. Green SQL evidence: harness/evidence/level-based-cohorts/sql-placement.log; concurrency.log.

## Root cause

The existing relationship-end guard forbids retiring the membership still referenced by an enrolled placement. Reordering the transfer broke this valid protection.

## Responsible layer

PostgreSQL transaction boundaries and membership constraints.

## Immediate fix

Restore insert target → update case → retire previous ordering. Defer only the formal-level exclusivity constraint, then force it immediate before returning.

## Permanent protection

DEFERRABLE INITIALLY IMMEDIATE exclusivity checks final rows and serializes by enrollment. The relationship-end guard remains intact. No GUC bypass or disabled trigger.

## Test/eval created

Existing supabase/tests/placement.sql now exercises Basic→Intermediate promotion; scripts/test-placement-concurrency.mjs covers competing memberships and conflicting transfer retries.

## Reproduction

Run node scripts/run-sql-tests.mjs integration and node scripts/test-placement-concurrency.mjs against the migrated local test database.

## Before/after proof

Before: retiring the prior membership first failed deterministically with SQLSTATE 23514 at the existing Admin transfer.
After: sql-placement.log completes with ROLLBACK and concurrency.log reports exactly one active membership in both races.
