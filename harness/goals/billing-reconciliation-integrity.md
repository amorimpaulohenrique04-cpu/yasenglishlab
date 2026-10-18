# GOAL — billing-reconciliation-integrity: Complete and failure-visible reconciliation

Status: blocked
Owner: agent
Created: 2026-10-17
Updated: 2026-10-17

## Objective

Execute PR 1 of the supplied surgical plan: inspect eligible subscriptions in bounded UUID cursor batches and expose provider, persistence, resolution and reading failures without changing financial state.

## Visible result

ADMIN+AAL2 can start, advance batches and restart partial reconciliation. Unavailable findings differ from an empty list; failed writes never produce success feedback.

## Relevant context

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/BILLING.md`
- `docs/CI_CD.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `harness/ratchet.md`

## Acceptance criteria

- [x] 0, 50, 51 and 120 subscriptions are processed without silent truncation.
- [x] Provider errors produce partial results; persistence failures throw.
- [x] Reading/resolution errors are visible; ADMIN+AAL2 remains enforced.
- [x] Existing SQL, financial mutations, dependencies and CI workflows remain unchanged.
- [ ] Final SHA CI Gate succeeds before merge; merged main is verified.

## Allowed files / domains

- `src/server/billing/reconciliation.ts`
- `src/app/(protected)/(admin)/admin/billing/actions.ts`
- `src/app/(protected)/(admin)/admin/billing/page.tsx`
- `src/modules/billing/ui/reconciliation-panel.tsx`
- `tests/integration/billing-reconciliation*.test.ts`
- `tests/e2e/billing-ui.spec.ts`
- `docs/BILLING.md`
- `harness/**`

## Forbidden areas

Migrations, SQL contracts, auth/RLS, entitlements, provider writes, shared primitives, global styles, pedagogical modules, dependencies, CI workflows and PR 2.

## Mandatory tests

- Focused reconciliation Vitest and billing E2E.
- `npm run format:check`, `npm run lint`, `npm run typecheck`.
- `npm run test:unit`, `npm run test:integration`.
- `npm run verify:security`, `npm run verify:agent`, `npm run verify:ui`.
- `npm run verify:full` if local prerequisites are available; otherwise record NOT_RUN_LOCAL and require full Official CI.

## Required evidence

Base SHA 8ef0965436e98ab7bb8c2473f63d04d0345282f8, clean worktree and baseline Official CI https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/39076925621 confirmed before edits. Red/green regression results, visual evidence and final CI under `harness/evidence/billing-reconciliation-integrity/`.

## Definition of done

Required gates pass, evidence inspected, failures/decisions/progress recorded, registry truthful and final CI verified. Go-live stays BLOCKED pending external approvals and homologation.
