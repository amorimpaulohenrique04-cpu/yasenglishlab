# Failure — Full canonical reset inside a spec erased persisted E2E proof

Classification: state  
Status: resolved  
Repeatable: yes  
Date: 2026-10-25  
PR/commit related: current change on codex/teacher-sessions-redesign (CI runs 40159936638, 40162812580, 40163884836)

## Symptom

Preview (e2e) "Assert persistence and analytics" failed with `Persisted lesson progress was not found.` in
three consecutive runs although canonical-slice's progress journey passed.

## Evidence

`scripts/assert-canonical-e2e.mjs:87` in the e2e job logs of the three runs; canonical-slice
"login → progress → logout → login → persisted resume" reported `expected` in the same results.json.

## Root cause

`tests/e2e/teacher-students-workspace.spec.ts` (alphabetically after canonical-slice) ran the full
`scripts/setup-canonical-e2e.mjs` to restore its pending placement review. That script deletes the
canonical Student's `lesson_progress`, bookings and analytics before reseeding.

## Responsible layer

Harness / E2E fixtures.

## Immediate fix

Placement fixtures moved to `scripts/setup-placement-e2e.mjs`, imported at the end of the full setup and run
alone by the students spec.

## Permanent protection

Only canonical-slice (which runs before producing the proof) may invoke the full canonical setup.

## Test/eval created

`tests/unit/canonical-fixture-isolation.test.ts`.

## Reproduction

Run `npm run test:e2e` with the old students spec, then `node scripts/assert-canonical-e2e.mjs`.

## Before/after proof

Before: the guard lists `tests/e2e/teacher-students-workspace.spec.ts` against the previous spec (it called the full setup); CI runs above.  
After: guard passes on this change; Official CI on the pushed SHA is the after-proof for the assert.
