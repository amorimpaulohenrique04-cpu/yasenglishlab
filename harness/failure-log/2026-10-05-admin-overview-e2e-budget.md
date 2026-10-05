# Failure - Combined Admin overview and cohort E2E budget

Classification: test gap  
Status: open  
Repeatable: yes  
Date: 2026-10-05  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/35

## Symptom

The combined Admin default-entry scenario exhausted its 30-second test budget in two full verification runs. It included real MFA, three responsive overview captures, navigation to Cohorts and a metadata mutation.

## Evidence

First full run: 25/28 E2E passed; this scenario timed out navigating to Cohorts. Second full run: the scenario timed out filling the cohort dialog after Cohorts loaded in six seconds. Isolated unchanged reproduction passed in 14.8 seconds after restoring local disk capacity and cache location. The failures occur at different stages of the same aggregate budget, not at a consistently failing domain assertion.

## Root cause

Independent overview evidence and cohort mutation were coupled into one test budget. Local environment latency exposed that coupling. The domain operation itself passed unchanged in isolated reproduction. Subsequent Official CI 37269576841 exposed a separate pre-hydration interaction defect: all three attempts clicked Gerenciar but never opened a drawer. Its trace preserved focus on the enabled trigger and no JavaScript exception. A controlled local test holding application scripts reproduced the trigger enabled before hydration; the disabled assertion failed deterministically.

## Responsible layer

E2E scenario composition; no product or authorization change.

## Immediate fix

Separate responsive overview evidence and cohort metadata mutation into independent scenarios. Both perform real Admin MFA. Preserve every heading assertion, viewport capture, mutation, success assertion and axe check. The existing OperationOverlay primitive now uses server/client hydration snapshots to disable its trigger until its event handler is available.

## Permanent protection

Each scenario retains the existing 30-second budget with no sleeps, forced interactions, widened timeout or retry. The complete E2E suite executes both scenarios.

The controlled hydration scenario holds application scripts, verifies the server trigger is disabled, releases scripts and verifies the trigger enables and opens the actual drawer. It failed before the primitive correction and passed twice afterward. No network synchronization workaround replaces the product interaction.

## Test/eval created

`tests/e2e/cohorts-booking.spec.ts` now independently verifies responsive default entry and cohort metadata mutation.

## Reproduction

Run `verify:full` with the original combined scenario; preserved failures occurred at the navigation and dialog phases. Run both separated scenarios and then the aggregate suite to validate the correction.

## Before/after proof

Before: two full-gate failures exhausted the combined 30-second budget. After: both separated scenarios passed twice (4/4); metadata mutation completed in 21.7 and 20.3 seconds. Both retain default Admin entry followed by explicit Cohorts navigation, all original assertions and viewport sizes. An intermediate direct-to-Cohorts MFA experiment still raced streamed content and was not retained. Aggregate verification remains pending; not resolved yet.

The separated scenarios passed within verify:ui (29/29 E2E), but CI failed cohort mutation 3/3 before the hydration correction. Controlled pre-hydration test: red enabled-trigger assertion before, two green scenarios after. The first post-edit aggregate-focused repetition had a separate save-confirmation test-budget timeout and is not promoted as a fully green result. Full verification and final CI remain required.
