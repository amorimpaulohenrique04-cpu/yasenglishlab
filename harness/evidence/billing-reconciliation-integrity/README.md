# Billing reconciliation integrity — PR 1

Base: `8ef0965436e98ab7bb8c2473f63d04d0345282f8` (origin/main after fetch).
Baseline Official CI: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/39076925621 — success.
Clean worktree created before edits; original checkout and untracked files preserved.

## Regression evidence

- Same two focused integration suites against original runtime: 18 failed, 11 passed (`red.log`).
- Corrected runtime: 29 passed, zero skipped (`green.log`).
- Initial verify:agent passed formatting, lint, types, 339 unit tests and 352 integration tests; one pre-existing live integration test requires an environment and was skipped by its existing condition. Build rejected the external node_modules junction. Resolved environment setup by copying existing installed dependencies into this worktree; no dependency installation or configuration bypass.
- Final `npm run verify:agent`: passed, including production build, harness/ratchet, security and behavioral eval. Eval will also be rerun after committing so it inspects the actual change against origin/main.
- Focused production E2E (`billing-ui.spec.ts`, Chromium): **2 passed**, zero retries/skips; real ADMIN+AAL2, failed RPC resolution followed by successful resolution, invalid cursor rejected, partial/restart/next controls and Student privacy. Axe, reflow and 44px target assertions passed at 1440/1024/390px.
- Open findings exposed an existing 19px investigation link; corrected using billing's existing link class. No CSS or assertion changes. Screenshots inspected: `screenshots/panel-desktop.png`, `panel-tablet.png`, `panel-mobile.png` are unscaled bottom crops of full-page captures, retained locally in the same directory.

## Scope and review

Four existing runtime files; two integration suites (one existing, one new); existing billing E2E; billing contract and required harness records. No SQL/migration, provider write, financial state, entitlement, auth/RLS, workflow, dependency or golden changes.

`rg -n 'grantUserRole|revokeUserRole|changeUserRole' src tests` found definitions and internal forwarding only in `src/server/auth/admin.ts`; potentially unused legacy helper left unchanged. Asaas >10 charges remains NOT_RUN_EXTERNAL pending sandbox evidence.

Intentional UI changes are restricted to the reconciliation card: partial/failure/unavailable feedback, next batch, explicit restart and the existing link's accessible hit target. Existing primitives/styles reused; approved screens and snapshots unchanged.

## Pending gates

Local verify:ui encountered an unchanged canonical lesson-completion assertion at `tests/e2e/canonical-slice.spec.ts:469`: expected visible 100%, observed 0% within 5 seconds. Trace confirmed a POST for lesson `42000000-0000-4000-8000-000000000002` with completionPercent=100; a read-only query of the isolated DB confirmed 100% persisted. The response stream was incomplete at assertion failure. No pedagogical code, assertion, retry or timeout was changed. Billing E2E passed both focused and within the complete suite. This remains an open local gate; no success/merge is authorized by these results.

Local verify:full and final SHA Official CI pending. Publish only one draft PR while gates are pending. Status in_progress, verified false. Go-live BLOCKED; PR 2 depends on hosting and external homologation/restore/alerts/approvals.
