# Stage 03A — Billing Provider Foundation

Base: main@28efe6a0d94a875e8ad58299116997f49d9d761b; pulled once, already current; initial worktree clean.
Branch: feat/stage-03a-billing-provider-foundation. Scope: 3A only.

## Implementation

ADR 0013 records authorized Asaas choice and official capability verification. Small BillingProvider port, server-only fetch/configuration, fake, application consumer and Supabase repository. Additive session table/RPC reserves one open intent per Student with historical Plan snapshot. Winner creates the checkout; others remain pending/reuse READY. Unknown outcomes stay reserved and require reconciliation. No public route, webhook, financial mirror mutation, UI or notification delivery.

## Checks actually executed

- Direct installed Prettier/ESLint CLIs on touched files: passed.
- `node node_modules/vitest/vitest.mjs run tests/integration/billing-provider.test.ts`: 16 tests passed.
- `node node_modules/typescript/bin/tsc --noEmit`: FAILED in existing ignored `.next-p18/dev/types` generated artifacts. OUT_OF_SCOPE_EXISTING_FAILURE; no general rerun or unrelated edits.
- `node node_modules/typescript/bin/tsc --project harness/evidence/stage-03a-billing-provider-foundation/tsconfig.focused.json`: passed after fixing two test array nullability errors.
- `node scripts/verify-db.mjs`: passed (structural migration checks).
- `node scripts/verify-security.mjs`: passed, server/client boundary across 267 source files.
- `node scripts/verify-harness.mjs`: passed after bringing new failure records into the required filename/template contract; Ratchet, engineering system and platform checks passed.
- `git diff --check`: passed.
- Real SQL on isolated local PostgreSQL 127.0.0.1:55483: all migrations/seed applied, focused `supabase/tests/billing_checkout.sql` passed. First failure exposed missing service_role SELECT grants; fixed explicitly and reran only SQL test. Checks snapshot, double reservation, different-plan conflict, ambiguity retention, completion idempotency, expiry/reuse, no subscription creation, client table/RPC denial and service-role execution.
- `node harness/evidence/stage-03a-billing-provider-foundation/check-concurrency.mjs`: passed, eight independent connections, one claim/intent.

## Limitations

No live Asaas credentials used and no real charges created. Sandbox live homologation remains an operator rollout prerequisite; future 3B owns ambiguous-event reconciliation and 3C owns authenticated/public routes. No broad UI/E2E/verify:full gates run. General local typecheck failure is recorded in harness/failure-log/2026-10-05-stage-03a-existing-typecheck.md. Do not call the package verified until required CI is known.

## PR / CI

[PR #39](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/39), opened and attached to this chat. Implementation commit: 7b9add328ded48c12e8ddb704bf129205f3fa3f3.

[CI run 37400249103](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37400249103) completed **failure** at implementation SHA: Supply Chain reports a high-severity `source-map-js` finding, GHSA-68fv-2mgg-jv7q; dependent quality/database/simulation/preview jobs were skipped. CI Gate failed accordingly. `git diff 28efe6a..HEAD -- package.json package-lock.json` is empty: existing dependency issue has no direct causal relation to this slice. Recorded OUT_OF_SCOPE_EXISTING_FAILURE; no dependency changes, investigation or manual CI reruns. Package status BLOCKED / blocked / verified:false. General local typecheck also remains an out-of-scope failure. Evidence-only commits may supersede the original run; no passing CI result is claimed.

Next package: 3B — Billing Core, only in a new execution after 3A merge. Temporary PostgreSQL was stopped after verification.
