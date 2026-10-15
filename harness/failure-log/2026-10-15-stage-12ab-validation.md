# Failure — Stage 12 A/B validation boundaries

Classification: environment
Status: accepted-risk
Repeatable: yes
Date: 2026-10-15
PR/commit related: current change, stage-12-lacunas-operacionais

## Symptom

Next dev reported os error 112 (insufficient disk) during Turbopack persistent cache compaction. Browser validation could not complete reliably.

## Evidence

Playwright run on 2026-10-15 17:34 UTC: failed write .next-p18/dev/cache/turbopack/v16.3.8-b0fad0d4/00000157.sst. C: free space fell to 187 MB. Earlier attempts also exposed exact-label selectors missing required markers, route-announcer ambiguity, four default alternatives with only two filled, and short cold-compilation expectations. No product security boundary was weakened.

## Root cause

Low disk plus persistent development cache. Test authoring assumptions were corrected from actual accessible DOM and SQL version lifecycle. The structural action guard additionally assumed single-line function declarations and rejected an authorized multiline action.

## Responsible layer

Local environment and test harness.

## Immediate fix

Stopped test server, verified absolute cache path within workspace, removed only generated .next-p18/dev/cache/turbopack (free space 541 MB). Disabled persistent cache only for YAS_ISOLATED_VERIFY. Corrected selectors, completed alternatives, waited for actual transitions, and used a dedicated placement Student with restoration of the original entry flag. Structural action checks now inspect TypeScript function bodies.

## Permanent protection

Isolated next config disables persistent Turbopack dev cache; ordinary dev config unchanged. Existing action guards still require assertRole as first instruction, across multiline signatures. Browser specs assert real accessible labels, version retirement, explicit entry selection and immutable attempts.

## Test/eval created

tests/unit/isolated-next-config.test.ts; tests/unit/action-guards.test.ts; tests/e2e/admin-assessments.spec.ts; tests/e2e/teacher-practices.spec.ts; Stage 12 cases in tests/a11y/critical-flows.spec.ts.

## Reproduction

Run isolated browser suite with a nearly full C: and persistent Next cache enabled. For the guard issue, run the old line-based action-guards test against saveAssessmentAction's multiline signature.

## Before/after proof

Before: os112, 187 MB free; original full Vitest 541 passed/1 failed (action-guards).

After: corrected guard targeted 12/12 and full Vitest 542/542 passed; isolated cache disabled. Final browser validation passed A/B 2/2 and a11y 4/4 with exit 0, zero retries/skips. Controlled server and temporary runner configs avoided orphan processes during final validation. Remaining low-disk capacity is an accepted local environment risk for the later full gates; no product/security failure remains from this incident.
