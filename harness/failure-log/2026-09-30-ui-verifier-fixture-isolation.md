# Failure — UI verifier leaked canonical state between suites

Classification: state  
Status: resolved  
Repeatable: yes  
Date: 2026-09-30  
PR/commit related: current change

## Symptom

`npm run verify:ui` passed E2E, accessibility and Storybook checks but failed all three Home goldens after the E2E had persisted 100% lesson progress.

## Evidence

The login baseline matched, while Home differed in desktop, tablet and mobile immediately after the canonical E2E. The same goldens passed 3/3 under `verify:full`, whose orchestrator resets the fixture before golden checks.

## Root cause

`verify-ui.mjs` executed state-mutating suites consecutively without recreating the canonical fixture. Its result therefore depended on whichever earlier suite last changed the local database.

## Responsible layer

UI verification orchestration.

## Immediate fix

When `CANONICAL_E2E=1`, prepare the canonical fixture before E2E, before accessibility and before golden regression, matching the isolation already used by `verify:full`.

## Permanent protection

The official UI verifier owns its fixture resets instead of requiring undocumented external setup.

## Test/eval created

`npm run verify:system` requires all three canonical fixture reset points in `scripts/verify-ui.mjs`.

## Reproduction

Prepare the canonical fixture once, run `npm run verify:ui`, and observe E2E persist 100% progress before the Home golden comparison.

## Before/after proof

Before: Home golden failed in all three projects because E2E state leaked forward.  
After: Direct `npm run verify:ui` passed E2E 2/2, accessibility 4/4, Storybook visual 6/6 and product goldens 3/3. The subsequent stopped-stack clean-room `npm run verify:full` also passed with exit code 0.
