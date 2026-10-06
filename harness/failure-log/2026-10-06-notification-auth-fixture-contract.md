# Failure — Notification SQL fixture exceeded CI Auth contract

Classification: test gap

Status: resolved

Repeatable: yes

Date: 2026-10-06

PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/46 / a102a2d

## Symptom

Official CI Database rejected the new notification_delivery.sql fixture before running its assertions.

## Evidence

Run 37541504099: column email_confirmed_at of relation users does not exist, notification_delivery.sql line 11. Quality, Supply Chain and Guardrail Simulations passed. Preview was skipped by the failed Database dependency.

## Root cause

The SQL test unnecessarily populated verified-email Auth fields available in real local Supabase but absent from the minimal Auth stub used by the migration gate. Verified-email behavior is tested through the Notification Auth adapter, not SQL notification generation.

## Responsible layer

Notification test fixture, owned by 3E. No application, Billing or CI infrastructure change was required.

## Immediate fix

Restrict both SQL Auth fixtures to durable id only. Preserve all generation, dedupe, retry, RLS and service-role assertions.

## Permanent protection

Use the shared minimal id-only contract and document why email confirmation is an adapter responsibility. The new Notification SQL test remains wired into clean/replay/upgrade migration validation and the existing SQL runner, so the minimal CI stub rejects future fixture expansion automatically.

## Test/eval created

supabase/tests/notification_delivery.sql exercises real Billing/outbox with portable Auth identities; tests/integration/notification-delivery.test.ts separately verifies confirmed-current-email resolution and rejection. The Official CI clean-database execution is the repeatable fixture portability eval.

## Reproduction

Run the initial a102a2d notification_delivery.sql against the Official CI minimal Auth schema. It fails on email_confirmed_at before any delivery assertion. Run the corrected id-only fixture against the same gate or real local Supabase.

## Before/after proof

Before: Official CI 37541504099 rejected the expanded Auth fixture with exit code 3.

After: the single affected local SQL/RLS rerun passed with exit code 0 and rollback after the id-only correction. The corrected-head Official CI result is recorded in Stage 03E evidence.
