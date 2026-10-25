# Failure — audio accessibility fixture lacked legitimate lesson access

Classification: test gap  
Status: open  
Repeatable: yes  
Date: 2026-10-17  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/80

## Symptom

Desktop and mobile a11y could not find the start button for Canonical Speaking Review.

## Evidence

harness/evidence/pr80-gates/ci-before.md and a11y-focused.log.

## Root cause

The fixture linked the activity to a future lesson without progress or an explicit assignment. The start gate correctly withheld access.

## Responsible layer

Canonical test fixture and accessibility navigation.

## Immediate fix

Assign the activity to canonical cohort A through the existing assignment relation and assert the real attempt route.

## Permanent protection

Positive a11y on both viewports; negative UI/RPC E2E for unassigned cohort B; existing SQL lifecycle allow/deny tests.

## Test/eval created

tests/e2e/practice-access.spec.ts and tests/a11y/critical-flows.spec.ts.

## Reproduction

Run fixture preparation, then test:a11y with the MANUAL_AUDIO filter, plus the practice-access E2E.

## Before/after proof

Before: both CI #703 audio a11y cases timed out waiting for start.
After: focused a11y passed 2/2. Full suite and new negative proof pending.
