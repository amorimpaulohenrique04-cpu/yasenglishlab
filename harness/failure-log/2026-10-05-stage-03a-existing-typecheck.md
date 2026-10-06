# OUT_OF_SCOPE_EXISTING_FAILURE — Stage 03A typecheck

Classification: environment
Status: open
Repeatable: yes
Date: 2026-10-05
PR/commit related: current Stage 03A change

## Symptom

General local typecheck fails in unrelated generated artifacts.

## Evidence

`node node_modules/typescript/bin/tsc --noEmit` failed on pre-existing generated `.next-p18/dev/types/routes.d.ts` (TS1435 at line 81 and multiple syntax errors) and validator.ts (TS1128 at line 179). These ignored build artifacts are outside the Stage 03A diff; no causal relation to billing imports. Not investigated, changed, or retried.

## Root cause

Not investigated per explicit OUT_OF_SCOPE_EXISTING_FAILURE policy; syntax diagnostics occur in ignored build output outside diff.

## Responsible layer

Existing local generated build artifacts.

## Immediate fix

No unrelated changes or general typecheck retries.

## Permanent protection

General typecheck remains required in CI; failure stays open.

## Test/eval created

Focused billing typecheck uses a separate evidence config retaining the repository compiler options and excluding unrelated generated files. It does not replace or weaken the official typecheck/CI.

## Reproduction

node node_modules/typescript/bin/tsc --noEmit in the original local checkout.

## Before/after proof

Before: TS1435/TS1128 in .next-p18/dev/types.
After: not resolved; focused billing source typecheck passed.

Environment note: npx resolves a missing roaming npm installation; direct Node invocations of installed package CLIs used without changing tooling. Docker daemon unavailable; isolated loopback PostgreSQL used for focused SQL/RLS tests.
