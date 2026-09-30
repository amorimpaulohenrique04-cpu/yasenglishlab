# Failure — Windows Playwright cold-start worker contention

Classification: environment  
Status: resolved  
Repeatable: yes  
Date: 2026-09-30  
PR/commit related: current change

## Symptom

The canonical E2E repeatedly reached its final mobile pages but exceeded Playwright's default 30-second test timeout during Windows cold or loaded runs.

## Evidence

`npm run verify:full` first failed after 30.1 seconds with the final `/aulas` page in `error-context.md`. The identical spec and assertions passed in 22.0 seconds when run alone and in 21.4–26.5 seconds in subsequent serialized full gates. A clean-room `verify:ui` immediately after Storybook build reproduced the timeout at 30.2 seconds on the penultimate `/home` mobile assertion.

## Root cause

The local runner originally allowed two E2E specs to compete during a Windows/Turbopack cold start. Serializing removed that contention, but the canonical flow itself spans two authentication cycles, persistence assertions and six full-page screenshots across three viewports. Under post-build machine load, the default 30-second whole-test budget remained too narrow despite correct product behavior.

## Responsible layer

Local verification tooling.

## Immediate fix

Set the canonical Playwright configuration to one worker for both local and CI runs, and assign only the long canonical spec a 60-second whole-test budget. No assertion, per-expect timeout, retry or product behavior changed.

## Permanent protection

`playwright.config.ts` declares `workers: 1` at the shared configuration level, while `canonical-slice.spec.ts` explicitly declares its 60-second end-to-end budget.

## Test/eval created

`npm run verify:platform` rejects removal of either the single-worker invariant or the canonical spec's explicit time budget.

## Reproduction

Run `npm run verify:ui` or `npm run verify:full` from a cold Windows state, especially immediately after Storybook build. With the former default 30-second whole-test budget, the canonical flow can time out on one of its final mobile navigations.

## Before/after proof

Before: cold/loaded runs timed out at 30.1–30.2 seconds on the final mobile pages.  
After: Direct `npm run verify:ui` and the subsequent stopped-stack clean-room `npm run verify:full` both passed. The canonical flow completed in 23.1 seconds and 20.9 seconds respectively, with all original assertions intact.
