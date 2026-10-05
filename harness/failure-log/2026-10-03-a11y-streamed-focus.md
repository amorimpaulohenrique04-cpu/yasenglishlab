# Failure — A11y streamed focus and Teacher loading semantics

Classification: test gap  
Status: resolved  
Repeatable: yes  
Date: 2026-10-03  
PR/commit related: current branch `feat/stage-01-enrollment-core`, correction committed in `53148ace46bedaaf431df83819a5138f1949d90b`

## Symptom

Five accessibility checks failed around Placement keyboard focus and Teacher loading semantics even though the underlying controls and routes were present.

## Evidence

The five original error contexts are preserved under `harness/evidence/a11y-five-failures/original/`. Natural Chromium and controlled slow-frame observations are preserved in `dom-before.json` and `dom-slow-frame.json`. Hidden streamed `S:0` controls remained connected but could not receive native focus until React revealed them. The Teacher loading state independently exposed a generic `div` with a prohibited accessible name; the isolated Axe reproduction is preserved in `axe-before.json`.

## Root cause

Placement tests attempted focus while streamed content was still hidden, so native focus could not land on the connected controls. Separately, the Teacher loading component applied accessible-name/busy semantics without a valid status role.

## Responsible layer

Accessibility test synchronization for Placement plus UI loading semantics for Teacher.

## Immediate fix

Placement accessibility tests now wait for the real initial control to become visible before invoking the existing focus assertions. Teacher loading uses `role="status"` with its existing name/busy semantics.

## Permanent protection

The visibility assertions gate interaction on the actual streamed content without sleeps, forced focus, widened timeouts or retries. Existing Teacher P21 Axe coverage remains enabled, and the Placement keyboard assertions continue to exercise native focus and Tab behavior.

## Test/eval created

The existing Placement accessibility scenarios and Teacher P21 WCAG/Axe scenario are the permanent regression protection. A single authorized `npm run test:a11y` execution after the correction completed with 28 passed, 0 skipped and 0 failed.

## Reproduction

Use the preserved five original failure contexts and run the affected Placement/Teacher accessibility scenarios before the correction. For the streamed case, observe focus while the `S:0` subtree is hidden; for Teacher loading, run Axe against the loading state.

## Before/after proof

Before: five preserved accessibility failures reproduced the streamed-focus and loading-semantics defects.  
After: `npm run test:a11y` exited 0 with 28 passed, 0 skipped and 0 failed while retaining the original focus/keyboard assertions.

## 2026-10-05 Teacher new-session recurrence

PR related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/35

The final Student UI wrapper passed 28 E2E scenarios, then failed the Teacher P21 desktop focus assertion on the new-session title input. The same scenario passed in an isolated desktop/mobile run (2/2), consistent with the previously recorded streamed visibility hazard. The final title interaction lacked the visibility barrier already used by the availability controls immediately above it.

The correction adds a visible assertion before native focus. It retains the existing focused assertion, axe checks, routes, viewports and all timeouts. This strengthens readiness coverage without weakening keyboard behavior or changing Teacher product code.

Before: UI wrapper reported `getByLabel('Título')` inactive at the 5000 ms focus assertion. Isolated unchanged reproduction passed 2/2; the aggregate failure remains the red evidence.
After: focused desktop/mobile validation passed 2/2 with the visibility barrier and original focus assertions. Final UI/full gates remain pending; this follow-up is not yet claimed fully verified.
