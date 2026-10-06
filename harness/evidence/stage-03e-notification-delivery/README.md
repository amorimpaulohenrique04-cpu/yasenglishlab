# Stage 03E — Notification Delivery

Status: done / verified:true, implementation verified by Official CI 37541866527.

Base: main@aa7bc4824363b69b1cebdeb5df74b9146ad17ba9.

Branch: feat/stage-03e-notification-delivery.

## Delivery

Additive migration 20261006221528_stage_03e_notification_delivery.sql creates the server-only EMAIL outbox. The AFTER INSERT BillingEvent trigger requires processed/error-free history, matching mirror timestamp/priority/status and the existing APPLIED billing_reconciled audit witness for that exact event. It does not change the reconciler. SQL proves that even a distinct STALE event with equal timestamp/priority emits nothing. No historical backfill or provider network call occurs inside Billing transactions.

notifications remains the notification-state source, with a partial unique dedupe_key. Deliveries are unique per notification/channel. Current verified Auth email is resolved by durable user_id; no recipient is copied into the outbox. The three deterministic V1 templates cover confirmation, payment issue and subscription end.

NotificationDeliveryProvider has Resend native-fetch and explicit Fake adapters. processPendingNotificationDeliveries(limit) is a trusted server library, not a public endpoint or scheduled job. ADR 0014 records the authorized provider and current official documentation before implementation. Sender/API key stay server-only; no real email was sent during verification.

## Reliability and security

Atomic SKIP LOCKED claim: default 10, maximum 25, two-minute lease and fresh fencing token. The bounded batch starts immediately; Auth/database/provider requests have 15-second timeouts. Attempts are capped at five, with persisted 60/120/240/480-second backoff and no retry loop. Provider-accepted message ID is required for SENT; terminal deliveries cannot be requeued.

Generated stable idempotency key never changes across retry or lease recovery. Provider acceptance followed by failed DB persistence leaves SENDING recoverable with the same key. A 23-hour automatic retry horizon stays inside Resend's documented 24-hour idempotency window. Late uncertainty becomes FAILED rather than an automatic resend. Current sender/recipient changes can produce a permanent payload conflict; keys are never rotated to circumvent that protection. SENT means provider acceptance, not confirmed inbox delivery.

429, 5xx, network failures and documented concurrent-provider conflicts retry; request/config/recipient failures are permanent. Only allowlisted codes are persisted, never raw provider bodies/secrets. Missing production configuration fails before claim; Fake is forbidden in production. Delivery RLS is enabled with no anon/authenticated grants; service RPCs are invoker functions with least-privilege grants. The only new definer function is an uncallable private transactional trigger. Existing own-notification visibility is preserved.

## Focused local verification

All checks completed with exit code 0:

| Check            | Command / result                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting       | node node_modules/prettier/bin/prettier.cjs --check on touched supported files; passed                                                         |
| ESLint           | node node_modules/eslint/bin/eslint.js on Notification source/tests, server/env.ts and touched SQL runner helpers; passed                      |
| TypeScript       | node node_modules/typescript/bin/tsc --noEmit -p tsconfig.notifications.json; passed                                                           |
| Unit/integration | node node_modules/vitest/vitest.mjs run tests/unit/notification-delivery.test.ts tests/integration/notification-delivery.test.ts; 28/28 passed |
| Migration        | local docker psql --single-transaction -v ON_ERROR_STOP=1 -f - with the new migration only; passed                                             |
| SQL/RLS          | local docker psql -v ON_ERROR_STOP=1 -f - with supabase/tests/notification_delivery.sql; passed, fixtures rolled back                          |
| Concurrency      | node scripts/test-notification-delivery-concurrency.mjs; overlapping workers claimed 2 + 2 distinct rows, one attempt each; fixtures removed   |
| Advisors         | supabase db advisors --local --type security --level warn --fail-on none --output-format json; results: []                                     |
| Diff             | git diff --check; passed                                                                                                                       |

SQL/RLS covers APPLIED-only generation, duplicate/same-priority stale/older stale/ignored/rejected/amount mismatch/unknown checkout exclusion, local dedupe, bounded claim, fencing, SENT protection, retry scheduling/exhaustion, abandoned lease recovery, provider-window expiration, sanitized codes, own-versus-other Notification RLS, anon/authenticated denial and actual service-role claim/failure. Provider failures leave Subscription and Placement unchanged. The shared SQL runner includes this file and the concurrency proof in the Official CI path.

No local broad gate, UI/E2E, Storybook, visual or accessibility tests were run. No source dependency or Billing implementation changed. No scheduler, new infrastructure or 3F work.

## Official CI and PR

PR: [#46](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/46). Initial CI [37541504099](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37541504099) passed Quality/Supply Chain/Guardrail Simulations but rejected the new SQL fixture's unnecessary email_confirmed_at column against CI's minimal Auth stub. The fix uses id-only fixtures; verified-email assertions remain in the Auth adapter tests. One affected local SQL/RLS rerun passed; no unrelated check was repeated. Ratchet: harness/failure-log/2026-10-06-notification-auth-fixture-contract.md.

Corrected implementation head eadbce8a9ac0aebd8d381ec0bf3f76074189dcba passed [Official CI 37541866527](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37541866527): Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate all succeeded. Database proved clean/replay/upgrade compatibility. Preview proved real integration/concurrency, RLS, observability, E2E/persistence, accessibility, Storybook and goldens. The Notification concurrency helper passed through the CI runner as well as locally. These broad checks ran only in Official CI.

The Harness closure commit is subject to the same [final-head PR checks](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/46/checks). Merge requires their success and the exact current head SHA; the PR records the resulting merge commit. Final sequence: merge, fast-forward main, confirm clean checkout, stop before 3F.

3A–3E are done/verified:true; macro Stage 3 remains in_progress/verified:false; 3F remains planned/verified:false.

## Out of scope

No existing failure identified. Production sender/domain verification, API key provisioning and trusted scheduled invocation remain deployment responsibilities under the open hosting decision; no production homologation is claimed.
