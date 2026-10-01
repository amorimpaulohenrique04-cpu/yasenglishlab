# Failure — Accessibility flow used stale-page headings as readiness signals

Classification: test gap
Status: resolved
Repeatable: yes
Date: 2026-09-30
PR/commit related: current change

## Symptom

Both desktop and mobile accessibility projects reached a 404 while traversing Aulas, even though their intermediate heading assertions had passed.

## Evidence

The error contexts showed the final page as Next.js 404. `Getting Started` and `Welcome to Yas` also exist as card headings on each preceding page, so the unscoped heading checks could pass before client-side navigation finished.

## Root cause

The accessibility flow treated content duplicated across source and destination pages as a navigation-readiness signal.

## Responsible layer

Accessibility test harness.

## Immediate fix

Wait for each destination URL and then require the destination page's level-one heading before continuing.

## Permanent protection

The Aulas accessibility journey now asserts the module and lesson route shapes explicitly and scopes the corresponding titles to heading level one.

## Test/eval created

`npm run test:a11y` exercises the corrected transitions in both desktop and mobile projects.

## Reproduction

Run the full canonical E2E and then the accessibility suite against the same dev server; the old title-only waits can resolve on the source page before the Next.js transition settles.

## Before/after proof

Before: both viewport projects passed the ambiguous title checks and then reported a 404 at the lesson-navigation assertion.
After: the same projects must reach the explicit module and lesson URLs and their level-one headings before axe analysis proceeds.
