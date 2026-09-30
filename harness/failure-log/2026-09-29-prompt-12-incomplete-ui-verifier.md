# Failure — official local UI verifier omitted blocking UI gates

Classification: test gap  
Status: resolved  
Repeatable: yes  
Date: 2026-09-29  
PR/commit related: prompt-12-engineering-system-1-0

## Symptom

`AGENTS.md` required `npm run verify:ui` for visual changes, but that command did not execute critical-flow accessibility tests or product golden regression tests.

## Evidence

The independent PROMPT 12 audit read `scripts/verify-ui.mjs` directly. It ran Storybook build, E2E and design-system visual checks while only asserting that a11y/golden files existed.

## Root cause

The CI Preview pipeline evolved to include stronger UI gates, but the local official wrapper was not ratcheted to remain equivalent.

## Responsible layer

Testing / Harness.

## Immediate fix

Expanded `verify:ui` to execute E2E, `test:a11y`, `test:visual:storybook` and `test:visual:golden` after the Storybook build.

## Permanent protection

`scripts/verify-engineering-system.mjs` validates that the official UI verifier invokes every required UI gate, and Harness verification runs that check in CI.

## Test/eval created

The Engineering System verifier contains a controlled incomplete UI-verifier fixture. It must be rejected for missing a11y/golden commands; the corrected complete fixture must pass.

## Reproduction

Run `npm run verify:system`. The controlled bad fixture contains only E2E + Storybook visual commands.

## Before/after proof

Before: the controlled incomplete verifier is rejected for missing `test:a11y` and `test:visual:golden`.  
After: the complete fixture passes and the real `scripts/verify-ui.mjs` is checked against the same command contract.
