# Stage 03A — Billing Provider Foundation

Status: **done / verified:true** following green Official CI [37403716495](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37403716495) at 7764114d0a2e54f4944f75fc959e4d14598a9281. Supply Chain, Quality (including clean typecheck, unit/integration/build), Database, Guardrail Simulations, Preview and CI Gate all passed. Stage 03 macro remains in_progress / verified:false; no 3B implementation.

The independent security [PR #40](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/40) updated only package-lock.json (source-map-js 1.2.1 → 1.2.2), passed Official CI [37402365170](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37402365170), and merged to main at 89317e0782c6dfeb5c06c8058ff9323861c72ec6. The 3A branch then merged that main and pushed 7764114. `git diff fff5f2c..7764114 -- src supabase tests docs .env.example` is empty: Billing implementation unchanged.

Local micro-PR checks passed: npm ci, verify:supply-chain, ci:policy, verify:dependency-patches and git diff --check. The existing braces patch was reapplied to node_modules after npm ci using the same prerequisite step as Official CI. No broad local suite was run. Historical local generated-file typecheck failure remains documented; clean Official CI typecheck passed and is the release authority. Earlier blocked state below is historical, superseded by this green run.

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

[CI run 37400249103](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37400249103) originally completed **failure** at implementation SHA: Supply Chain reported the existing source-map-js high-severity finding GHSA-68fv-2mgg-jv7q and skipped dependent jobs. The original 3A diff did not change dependencies. That historical OUT_OF_SCOPE_EXISTING_FAILURE was resolved independently by PR #40; the green run above supersedes the blocked state. No implementation changes were made to obtain green.

Next package: 3B — Billing Core, only in a new execution after 3A merge. Temporary PostgreSQL was stopped after verification.
