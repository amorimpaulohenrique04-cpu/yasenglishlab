# GOAL — prompt-12-engineering-system-1-0: Final engineering-system audit remediation

Status: done  
Owner: agent/human  
Created: 2026-09-29  
Updated: 2026-09-29

## Objective

Close every repository-internal gap found by the independent Yas Engineering System 1.0 audit without adding product features, and turn repeatable audit failures into executable guards.

## Visible result

A fresh agent can enter through `AGENTS.md`, trust the current documentation/state, run the official verification commands, and have CI reject regressions across the canonical slice, security, RLS, accessibility, golden UI, observability and Ratchet contracts.

## Relevant context

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/UI_CONTRACT.md`
- `docs/SECURITY.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/TESTING.md`
- `docs/CI_CD.md`
- `docs/OBSERVABILITY.md`
- `docs/DEFINITION_OF_DONE.md`
- `harness/README.md`
- `harness/ratchet.md`

## Acceptance criteria

- [x] Stale foundation-only documentation is removed from current entry-point maps.
- [x] Feature registry contains every implemented engineering milestone and all dependencies resolve.
- [x] Persistent plan state no longer claims an already-merged task is pending.
- [x] `npm run verify:ui` runs E2E, a11y, Storybook visual and product golden regression checks.
- [x] `npm run verify:system` rejects controlled stale-state/incomplete-UI fixtures and validates the real repository.
- [x] Harness CI executes the Engineering System verifier.
- [x] Repeatable audit findings have durable failure records with permanent protections.
- [x] Official CI passes on the implementation branch state.
- [x] No product feature, database schema, RLS policy or visual design behavior changes.

## Allowed files / domains

- `README.md`
- `package.json`
- `src/styles/README.md`
- `src/modules/README.md`
- `scripts/verify-ui.mjs`
- `scripts/verify-harness.mjs`
- `scripts/verify-engineering-system.mjs`
- `harness/**`

## Forbidden areas

- `src/app/**`
- `src/server/**` runtime behavior
- `src/modules/**` runtime behavior other than the module README
- `src/components/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- product visual references/goldens
- provider/deployment product decisions

## Mandatory tests

- `npm run format:check`
- `npm run verify:harness`
- `npm run verify:system`
- Official CI including Preview

## Required evidence

- PR #16.
- Implementation head `a49327f03b3d9726b5da02a2775734af181cb874`.
- Official CI run 36657346038.
- Preview artifact 11073276378.
- Harness/System log proving controlled bad fixtures are rejected.
- Preview evidence proving E2E, accessibility, visual/golden and observability remain green.

## Definition of done

All acceptance criteria pass, Official CI is green on the implementation head, evidence is persisted, the registry is `done` + `verified: true`, persistent plan state is closed, and no forbidden product/runtime scope changed.
