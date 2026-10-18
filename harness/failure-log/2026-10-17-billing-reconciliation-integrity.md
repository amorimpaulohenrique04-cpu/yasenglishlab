# Billing reconciliation truncation and misleading success

Classification: observability
Status: resolved
Repeatable: yes
Date: 2026-10-17
PR/commit related: fix/billing-reconciliation-integrity, baseline 8ef0965436e98ab7bb8c2473f63d04d0345282f8

## Symptom

Repeated reconciliation omitted eligible subscriptions and presented misleading success on provider/persistence failures.

## Evidence

Focused regression logs: `harness/evidence/billing-reconciliation-integrity/red.log` and `green.log`. Final gates remain required for overall task completion.

## Root cause

The old query repeatedly returned the first 50 rows ordered by updated_at, without a continuation cursor. Its broad catch classified persistence errors as provider failures, ignored clear/audit RPC errors and the action reported success regardless of providerErrors. Resolution ignored RPC errors; the page replaced findings read errors with an empty list.

## Responsible layer

Existing server-only billing orchestration, admin Server Actions and reconciliation card/page.

The new real open-finding E2E fixture also exposed an existing 19px investigation link hit target. The reconciliation card now reuses billing.module.css's existing 44px link class; no stylesheet or shared primitive changed, and the original target-size assertions remain intact.

## Immediate fix

UUID pagination, narrowly caught provider reads, checked RPC errors and explicit UI error states.

## Permanent protection

The existing service now requests 51 UUID-ordered rows, processes at most 50, returns the last processed UUID only when another page exists, and validates cursors. Only provider reads are caught per item; failed writes/audit throw. Existing actions/UI expose complete-batch, partial, failed, resolution-error and unavailable states without changing financial state or authorization.

## Test/eval created

`tests/integration/billing-reconciliation.test.ts` protects 0/50/51/120 rows, no duplicate provider reads, both provider failure points, each persistence RPC failure, cursor validation and actual ADMIN+AAL2 guards. `tests/integration/billing-reconciliation-ui.test.ts` protects action redirects, failure feedback, page unavailable handling and batch/restart controls. Existing billing E2E is extended for real ADMIN+AAL2 actions, RPC resolution and three-viewport accessibility/screenshots.

## Reproduction

Run both focused suites with the four runtime files temporarily restored from baseline, then restore the implementation and run the exact same suites.

## Before/after proof

Before: 18 failed / 11 passed against baseline runtime (`red.log`).

After: 29 passed, zero skipped against corrected runtime (`green.log`).

## Remaining gates

Local full verification and final SHA Official CI are required before completion/merge. No external Asaas/Mux/Meet homologation, hosting or restore evidence is implied.
