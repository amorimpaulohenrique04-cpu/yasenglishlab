# Failure — canonical practice stopped before persisted completion

Classification: test gap  
Status: open  
Repeatable: yes  
Date: 2026-10-17  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/80

## Symptom

37 browser tests passed, but the post-check found no practice_completed event. The session player also announced completion while finalize was pending.

## Evidence

harness/evidence/pr80-gates/ci-before.md and canonical-focused.log.

## Root cause

The canonical journey only answered item one after v3 introduced seven items. Item responses are persisted independently; only finalize emits completion. The UI rendered its success summary before awaiting finalize.

## Responsible layer

E2E journey and practice session UI.

## Immediate fix

Complete/resume all items and reinforcement, await finalized persistence, and withhold success during pending/error states.

## Permanent protection

Canonical E2E checks partial persistence, failed/delayed finalize, retry, result/event counts and reload; post-check binds analytics to the real submitted attempt. verify:ui now invokes the post-check too.

## Test/eval created

tests/e2e/canonical-slice.spec.ts, scripts/assert-canonical-e2e.mjs, tests/integration/practice-application.test.ts.

## Reproduction

Prepare the canonical fixture in a disposable stack, run E2E, then scripts/assert-canonical-e2e.mjs.

## Before/after proof

Before: Official CI #703 e2e job passed 37 browser cases then failed practice_completed assertion.
After: focused run passed the new practice assertions, but the complete canonical/full gates are still pending; record final results before resolution.
