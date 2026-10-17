# GOAL — pr80-gates: Restore practice release gates

Status: in_progress  
Owner: Codex  
Created: 2026-10-17  
Updated: 2026-10-17

## Objective

Diagnose Official CI run 39004676948 for PR #80 and implement minimal corrections for complete practice persistence/analytics, authorized audio accessibility fixtures, and the visual build. Preserve existing product/access contracts and unrelated workspace changes.

## Visible result

The canonical student completes and resumes a real multi-question attempt; completion is announced only after persistence. Authorized audio practice is accessible. Build and visual checks execute with reviewable evidence.

## Relevant context

- AGENTS.md
- docs/TESTING.md
- docs/DEFINITION_OF_DONE.md
- docs/PRACTICE_V3.md
- docs/OPEN_QUESTIONS.md
- docs/ACCESSIBILITY.md
- docs/UI_CONTRACT.md
- docs/DESIGN_SYSTEM.md
- docs/AUTH_RBAC_RLS.md
- docs/SECURITY.md
- harness/ratchet.md
- https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/80
- https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/39004676948
- User-provided Plano_Correcao_Gates_YasEnglishLab_PR80.md (investigation hypotheses, not evidence by itself).

## Acceptance criteria

- [ ] Canonical E2E completes all items, resumes partial work, and proves exactly one persisted completion event.
- [ ] Audio accessibility passes on desktop/mobile with legitimate access; unauthorized start remains denied.
- [ ] Visual build diagnosis is evidence-based; Storybook/goldens run without relaxed tolerances or unapproved baseline replacement.
- [ ] Required checks pass on the final code, or remaining blockers are explicitly recorded without claiming completion.

## Allowed files / domains

- `tests/visual/goldens/*/aulas-win32.png`, `tests/visual/goldens/*/progresso-win32.png` (reviewed 2026-10-17: intentional sidebar profile/help card, next-lesson panel and row actions from earlier redesign commits; fonts unchanged)
- `tests/e2e/**`, `tests/a11y/**`, `tests/unit/**`, `tests/integration/**`
- `scripts/setup-canonical-e2e.mjs`, `scripts/assert-canonical-e2e.mjs`, `scripts/verify-ui.mjs`
- `src/modules/practice/ui/practice-session-player.tsx`
- `.github/workflows/foundation-verify.yml`, `.github/actions/preview-setup/**`, `scripts/ci/**`, `next.config.ts`, `src/app/layout.tsx`, `src/app/fonts.css`, `public/fonts/**`, `docs/DESIGN_SYSTEM.md`
- `harness/goals/pr80-gates.md`, `harness/agent-state/**`, `harness/feature_list.json`, `harness/evidence/pr80-gates/**`, `harness/failure-log/**`

Scope refinement: the controlled Next 16.3.8 reproduction confirms the extensionless Google Font query bug (upstream #99114/#100158). Vendor the exact previously built WOFF2 bytes and equivalent font-face/fallback declarations, preserving all subsets and weights. No dependency/bundler change; document font delivery and test integrity/offline build.

## Forbidden areas

- Unrelated existing changes, main, product decisions in OPEN_QUESTIONS, relaxed authorization/RLS, existing migrations.
- Snapshot replacement without reviewed differences and explicit approval. Unrelated issues #76–79 unless proven gate dependencies.

## Mandatory tests

- npm run verify:agent
- npm run verify:ui
- npm run verify:security
- npm run verify:db
- npm run verify:full (dedicated disposable Supabase stack only)
- Canonical E2E + post-check, a11y, relevant unit/integration/SQL authorization checks and repeated clean builds.

## Required evidence

CI job excerpts, original SHA 0592091c47c343a0aedfbdfd8e7cf5e821a568ef, commands/results and reviewed artifacts in harness/evidence/pr80-gates; ratchet records with truthful before/after status.

## Definition of done

All applicable checks pass, visual differences are reviewed/approved, CI is green on the verified state, and harness state reflects evidence. Otherwise remain in_progress and record blockers.
