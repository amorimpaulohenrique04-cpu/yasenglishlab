# Stage 03B — Billing Core

Status: in_progress / verified:false. Official CI pending.

Base: main@2afd4d1b4ee20bfbc1bb9ec4ad32216cea1d0381, pulled once, initial tree clean.
Branch: feat/stage-03b-billing-core. 3A remains done/verified; macro remains in_progress/verified:false.

## Implementation

Asaas token authenticated before parsing or privileged client construction;
bounded body, safe empty responses, no raw payload/PII/secret persistence or logs.
Server-only normalization keeps neutral effects and whitelisted linkage/financial
fields. Official sources, ordering and period limitations: docs/BILLING.md.

One service-only RPC atomically reconciles immutable billing_events, the historical
3A snapshot, existing Subscription mirror and shared private Placement helper.
Per-event/provider-subscription/user locks and existing unique indexes serialize
independent connections. Domain failures roll back effects before safe error
insertion. Stale event/cycle guards, terminal cancellation and expired-cycle guards
prevent access regressions. No Auth impersonation, TRIALING, invented periods,
premature Enrollment or plan-name authorization. No UI, notification or 3C work.

## Checks actually executed

- `node node_modules/vitest/vitest.mjs run tests/integration/billing-core.test.ts`: **44 passed**, normalization and HTTP/repository integration without real network. Supported/unknown events, additional fields, invalid amount/date, identifiers, auth-before-body/client, token config, bounded stream, durable acknowledgements and storage errors.
- `node node_modules/typescript/bin/tsc --project harness/evidence/stage-03b-billing-core/tsconfig.focused.json`: passed.
- Installed Prettier/ESLint CLIs on touched supported files: passed. Docs follow existing Prettier ignore policy; SQL follows repository migration style.
- `node scripts/verify-security.mjs`: passed, boundary valid across 272 source files.
- `node harness/evidence/stage-03b-billing-core/check-sql.mjs`: passed on isolated real PostgreSQL 127.0.0.1:55484, using existing CI Auth bootstrap, migrations and seed, then **only** billing_core.sql, placement.sql and booking_quota.sql.
- billing_core.sql proves PAID/ACTIVE/PAYMENT_CONFIRMED, historical snapshot, provider subscription ID, immutable retry/conflicting retry, system audit provenance, no premature Enrollment, existing booking entitlement grant/loss, stale event/cycle, failure/cancel/refund, missing linkage, currency/amount mismatch, neutral events, bridge rollback, CREATING recovery, checkout-ID correlation and Student continuation. Raw/nested inputs rejected. Actual anon/authenticated RPC/financial writes denied; actual service execution permitted; helper not exposed.
- `node harness/evidence/stage-03b-billing-core/check-concurrency.mjs`: passed **three scenarios, eight independent connections each**, synchronized at a database clock barrier: same event; distinct events for same activation; conflicting provider subscriptions for same checkout. Each produces one applied effect, one mirror, one Placement and one reconciliation audit.
- `git diff --check`: passed.

Direct CLIs are used because existing global npm/npx shims are broken. No dependency
changes/installations or broad local full/typecheck/UI/E2E/Storybook/integration
suites. Official CI is the broad release authority.

## Limitations / follow-up

No live Asaas credentials or financial operations. Sandbox rollout must verify
checkout/externalReference propagation, delivery and provider clock. Official
schemas do not prove subscription period bounds: initial bounds remain null under
the existing contract, with provider-state access and dueDate only as cycle marker.
No fabricated 30-day period. Domain rejections are durably acknowledged; 3B does
not expose administrative replay. Partial refunds are neutral, with no invented
refund/proration policy. Details and official links: docs/BILLING.md.

No new out-of-scope failure observed. Historical ignored generated-file typecheck
issue from 3A was not rerun or modified. Temporary PostgreSQL must be stopped.

## Publication

PR / Official CI links pending. Claim done only after mandatory CI is green and
reviewed. Stop after 3B merge before 3C.
