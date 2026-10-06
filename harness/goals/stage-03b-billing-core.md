# GOAL — stage-03b-billing-core: atomic reconciliation

Status: in_progress

Owner: agent

Created: 2026-10-06

Updated: 2026-10-06

## Objective

Authenticated Asaas webhook normalizes a minimal event and atomically reconciles the existing checkout snapshot, Subscription and initial Placement. Retries and concurrent deliveries must not duplicate effects; stale events cannot undo newer state.

## Visible result

Confirmed first payment becomes PAID / ACTIVE / PAYMENT_CONFIRMED without premature Enrollment. Existing booking entitlements recognize ACTIVE. Invalid financial/linkage data persists a safe error without granting access.

## Relevant context

main@2afd4d1b4ee20bfbc1bb9ec4ad32216cea1d0381; 3A done/verified. docs/BILLING.md, docs/PLACEMENT.md, docs/AUTH_RBAC_RLS.md, docs/SECURITY.md. Existing immutable billing_events and begin_placement contracts.

## Acceptance criteria

- [x] Token authenticated before parsing; no secrets or PII persistence.
- [x] Atomic durable idempotent reconciliation with snapshot financial checks and ordering.
- [x] One initial Placement, no Auth impersonation or premature Enrollment.
- [x] Anon/authenticated denied billing RPC; service_role permitted.
- [ ] Focused checks and Official CI green before verified/merge.

## Allowed files / domains

Billing application/server, Asaas webhook Route Handler, additive migration, focused tests, Billing operational docs/env and Stage 3B Harness records.

## Forbidden areas

3A implementation/history, 3C, UI, public signup/checkout, notifications, general cleanup and dependency updates.

## Mandatory tests

User-authorized focused checks only: touched Prettier/ESLint, focused typecheck/Billing tests, real SQL/RLS, existing Placement/quota SQL, concurrency, verify:security and git diff --check. Official CI owns broad validation; no broad local verify:full/UI/E2E/Storybook suites.

## Required evidence

harness/evidence/stage-03b-billing-core/README.md: commands/results, normalized contract/provider sources, SQL/RLS/concurrency and Official CI links.

## Definition of done

Evidence inspected, focused checks and Official CI green, registry done/verified, PR merged, main updated clean. Stop before 3C.
