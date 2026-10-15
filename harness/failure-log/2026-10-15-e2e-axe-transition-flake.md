# Failure - E2E axe scanned a tab mid-transition

Classification: test gap  
Status: resolved  
Repeatable: no  
Date: 2026-10-15  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/73

## Symptom

`tests/e2e/admin-students.spec.ts` (Student 360) failed on the first attempt with an axe `color-contrast` violation on the selected "Histórico" tab (foreground #dedce3 on #8248df, 3.92:1) and passed on retry. The CI retry gate rejects tests that pass only after a retry.

## Evidence

Official CI run 38801062038, job Preview (e2e): `1 flaky`. The reported colors are intermediate values of the `.yas-tab` color/background transition; the final selected-tab colors (white on purple-600) pass. Quality, Database, Preview accessibility, visual and database-proofs passed on the same commit.

## Root cause

The default E2E config did not emulate `prefers-reduced-motion`, so the `.yas-tab` transition was still running when axe scanned right after the tab click. The accessibility, visual and golden configs already emulate reduced motion for this reason; many E2E specs also run axe.

## Responsible layer

Test configuration; no product or authorization change.

## Immediate fix

`reducedMotion: "reduce"` in `playwright.config.ts`. No axe rule, tag, assertion or retry was changed.

## Permanent protection

`tests/unit/playwright-e2e-motion.test.ts` requires reduced-motion emulation in all four Playwright configs.

## Test/eval created

`tests/unit/playwright-e2e-motion.test.ts`.

## Reproduction

Run `tests/e2e/admin-students.spec.ts` repeatedly with the previous config; the scan races the transition. Not reproduced locally (full E2E not run for cost reasons); confirmation depends on the PR CI.

## Before/after proof

Before: one flaky test in CI run 38801062038. After: pending the CI run of this fix.
