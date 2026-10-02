# Failure — P21 session overlap invalidated canonical E2E fixture

Classification: test gap  
Status: resolved  
Repeatable: yes  
Date: 2026-10-02  
PR/commit related: PR #31 — feat/p21-p1-core-experience

## Symptom

Official CI Preview failed in `Prepare canonical preview fixture` with PostgreSQL `23514: Teacher session overlap`.

## Evidence

The fixture bulk-upserted `Home Now`, `Home Cancelled` and `Home Completed` as `SCHEDULED` for the same Teacher with overlapping timestamps. The latter two were converted to historical terminal states only after the insert, so the intermediate write violated the production overlap invariant.

## Root cause

The fixture modeled only its intended final state and did not respect the database invariant during intermediate setup writes. P21.4 correctly moved Teacher overlap protection into `private.guard_session_v2()`, exposing this stale fixture assumption.

## Responsible layer

Canonical E2E fixture preparation.

## Immediate fix

Keep `Home Now` as the only current scheduled fixture. Move the cancelled/completed fixtures to non-overlapping historical/future intervals before inserting them, then apply their terminal statuses. The production overlap trigger is unchanged.

## Permanent protection

Canonical setup must be valid at every intermediate write, not only after later status mutations. Official Preview runs the setup repeatedly: before Critical E2E, before accessibility and before golden visual checks. Any future overlap regression therefore fails the canonical setup itself.

## Test/eval created

`scripts/setup-canonical-e2e.mjs` now uses overlap-safe timestamps while preserving Home assertions. P21 Critical E2E and repeated Preview fixture resets exercise the same setup against the production database invariants.

## Reproduction

On a clean current database, use the pre-fix canonical fixture that inserts all three Home sessions as overlapping `SCHEDULED` rows in one upsert. `private.guard_session_v2()` rejects the write with `Teacher session overlap`.

## Before/after proof

Before: Official CI run 37029465747 failed Preview at canonical fixture preparation with `23514 Teacher session overlap`.

After: the fixture no longer enters an overlapping scheduled state; the overlap trigger remains unchanged. Final proof is the mandatory Preview/Official CI gate for this candidate.
