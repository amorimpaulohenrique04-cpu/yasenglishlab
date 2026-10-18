# Failure — local canonical progress response did not settle within its assertion

Classification: environment
Status: open
Repeatable: no
Date: 2026-10-17
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/83

## Symptom

Local verify:ui stopped after E2E: 36 passed, one unchanged canonical journey failed at canonical-slice.spec.ts:469. Visible lesson progress remained 0 instead of 100 within the original 5-second assertion.

## Evidence

Local `harness/evidence/billing-reconciliation-integrity/verify-ui.log` and Playwright trace (uncommitted runtime artifacts). Billing tests passed both focused (2/2) and within the complete suite. Trace POST to introductions-that-sound-natural included lessonId 42000000-0000-4000-8000-000000000002 and completionPercent=100. A read-only query on isolated DB 56322 confirmed that lesson's 100% checkpoint persisted; the action response was incomplete at assertion failure.

## Root cause

The visible response did not settle in time; the underlying cause of the local response delay remains unproven. No claim that this is harmless or fixed. The failing learning code/test is unchanged by this PR.

## Responsible layer

Existing canonical learning action/rendering and local production-test environment; no reconciliation code executes on this route.

## Immediate fix

Record the failed gate and run the mandated verify:full once on a freshly reset isolated stack. Preserve the assertion, timeout, zero retries and learning code.

## Permanent protection

The existing canonical E2E already blocks this visible failure; further changes require a reproducible cause. No product fix claimed.

## Test/eval created

Existing canonical E2E retained unchanged. Reconciliation tests and scoped E2E remain green independently.

## Reproduction

Run verify:ui with real local Supabase, production Next build and canonical fixture on Windows. The failing journey completes Welcome, opens Introductions and submits its completion form.

## Before/after proof

Before: local verify:ui, 36 passed / 1 failed; DB persisted 100 while UI assertion saw 0.

After: Full clean-stack verification pending. OPEN until supported by final evidence; no bypass, forced snapshot or increased timeout/retry.
