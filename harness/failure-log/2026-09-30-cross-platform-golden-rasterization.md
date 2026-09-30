# Failure — Cross-platform golden font rasterization

Classification: environment  
Status: resolved  
Repeatable: yes  
Date: 2026-09-30  
PR/commit related: current change

## Symptom

Golden login screenshots failed on desktop, tablet and mobile in Windows even though the rendered layout, colors, dimensions and content matched the approved baselines visually.

## Evidence

The diffs contained 3999–4236 changed pixels concentrated on glyph edges. Expected and actual images had identical geometry; direct inspection showed only operating-system font antialiasing differences. The existing baselines pass the official Ubuntu CI.

## Root cause

`snapshotPathTemplate` omitted Playwright's `{platform}` token, forcing Windows Chromium output to compare against Linux-generated PNGs. Playwright documents that host operating systems render fonts differently and require environment-matched baselines.

## Responsible layer

Visual regression tooling.

## Immediate fix

Preserve the existing images as Linux baselines and add separately reviewed Windows baselines under the same strict pixel-diff threshold.

## Permanent protection

The golden snapshot path includes `{platform}` so each supported host compares only against a baseline produced by the same rendering environment.

## Test/eval created

`npm run verify:platform` rejects a golden Playwright configuration that omits `{platform}`.

## Reproduction

Run `npm run test:visual:golden` on Windows while using the former platform-neutral Linux baseline paths.

## Before/after proof

Before: all three login comparisons failed with 1–2% glyph-edge pixel differences and no layout drift.  
After: Linux baselines remained unchanged, the reviewed Windows baselines were selected on `win32`, and `npm run verify:full` passed the strict golden suite 3/3 without increasing tolerance.
