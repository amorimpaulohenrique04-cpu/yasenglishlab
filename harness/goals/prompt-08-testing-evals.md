# GOAL — prompt-08-testing-evals: Complete test and eval system

Status: in_progress  
Owner: agent/human  
Created: 2026-09-29  
Updated: 2026-09-29

## Objective

Turn the canonical vertical slice into a regression-resistant testing system with deterministic unit/integration checks, executable database/RLS authorization tests, user-visible E2E, accessibility checks, golden visual baselines and behavioral coding-agent evals.

## Visible result

One documented test matrix and command surface can block regressions from deterministic logic through real Supabase authorization and Login/Home/Aulas UI at desktop, tablet and mobile sizes.

## Relevant context

- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/ACCESSIBILITY.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/SECURITY.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/ARCHITECTURE.md`
- `harness/README.md`
- `harness/evals/behavioral.md`
- `tests/e2e/canonical-slice.spec.ts`

## Acceptance criteria

- [ ] Five executable layers exist: unit, integration, RLS/authorization, E2E and visual regression.
- [ ] Critical Login/Home/Aulas flows run axe plus landmark/label/keyboard/focus assertions.
- [ ] Golden baselines cover Login/Home/Aulas on desktop, tablet and mobile.
- [ ] `npm run verify` blocks core regressions; `npm run verify:full` adds real DB/RLS, E2E, a11y and visual suites.
- [ ] Coding-agent behavioral evals automate safe diff-based rules and document irreducibly manual checks.
- [ ] A deliberate red test is observed in CI, then removed, with both failure and recovery recorded.
- [ ] No product feature beyond testing/eval infrastructure is introduced.

## Allowed files / domains

- `package.json`
- `.github/**`
- `playwright*.config.ts`
- `scripts/**`
- `tests/**`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `harness/**`

## Forbidden areas

- `src/**` product behavior or UI.
- New Prática, Materiais, Billing or CEFR features.
- Weakening RLS/auth or changing tests into warnings.

## Mandatory tests

- `npm run verify`
- `npm run verify:agent`
- `npm run test:integration:db`
- `npm run test:rls`
- `npm run test:e2e`
- `npm run test:a11y`
- `npm run test:visual:storybook`
- `npm run test:visual:golden`
- `npm run verify:full`

## Required evidence

- Green CI URL for final branch/head and post-merge main.
- Nine committed golden baselines.
- A11y and visual artifacts.
- One intentional CI failure URL plus the later corrected green run.
- `harness/evidence/prompt-08-testing-evals/verification.json`.

## Definition of done

Done only after all five layers execute, the deliberate failure is proven and corrected, final CI is green, golden evidence was inspected, and registry/report state matches Git.
