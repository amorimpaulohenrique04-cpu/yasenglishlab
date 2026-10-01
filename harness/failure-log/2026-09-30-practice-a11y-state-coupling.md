# Failure — Practice accessibility test coupled to recommendation state

Classification: test gap
Status: resolved
Repeatable: yes
Date: 2026-09-30
PR/commit related: current change

## Symptom

The mobile Practice accessibility test could not find the hard-coded `meet` answer after the desktop project had completed the vocabulary activity successfully.

## Evidence

The desktop project passed, persisted its attempt and changed the next deterministic recommendation. The following mobile project then failed at `getByLabel("meet")`, while the page correctly displayed a different contracted activity.

## Root cause

The test asserted a seed-specific answer instead of the accessible control contract. Practice recommendation intentionally depends on the student's durable attempt history, so a preceding project may select another supported activity.

## Responsible layer

Accessibility test harness.

## Immediate fix

Focus and inspect the first rendered radio option after starting the current recommendation, independent of which contracted deterministic activity is selected.

## Permanent protection

The Practice accessibility spec now selects by the stable `radio` role and runs in both desktop and mobile projects against shared durable recommendation state.

## Test/eval created

`npm run test:a11y` executes the corrected Practice scenario in both configured viewports; the two targeted Practice cases passed sequentially after the desktop attempt changed recommendation state.

## Reproduction

Run the Practice accessibility test in the desktop project and then the mobile project without resetting attempts between projects while the selector is hard-coded to the vocabulary answer `meet`.

## Before/after proof

Before: desktop passed and mobile failed because the valid next recommendation did not contain `meet`.
After: desktop and mobile Practice accessibility cases both passed using the current activity's first accessible radio control.
