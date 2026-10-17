# Evidence — practice-10-v3

Date: 2026-10-16. Branch `feat/practice-10-phase-0` (commits 61aaff7, 00ba810, 58d68f3 and the seed copy fix).

## SQL (isolated test stack 55422)

- `practice-items`, `practice-review-schedule`, `practice-lifecycle`, `practice-authoring`, `access-closure`, `function-privileges`, `sensitive-tables-negative` — PASS.
- `npm run verify:db` — PASS (49 migrations, 41 SQL invariant tests).
- The v3 migration also applied cleanly to the dev stack (55322) with `supabase migration up`.

## App tests

- `npx vitest run` (all unit + integration): 651 passed, 1 skipped, 1 failed — `tests/unit/check-format.test.ts` timed out (5 s) under parallel load and passes alone (1/1).
- `npx tsc --noEmit -p .`, eslint on changed areas, `npm run format:check` — PASS.

## Live Student journey (dev stack, dev server :3100, `student.dev@example.test`)

- /pratica features "Aula atual · Módulo 1 · Aula 01" with the two seeded v3 practices and their objectives; lesson 2 stays locked; hero shows "Continue de onde parou" for the open attempt.
- "Cumprimentos e present simple" (7 questions): pre-task screen with objective and rules; "Pergunta X de Y"; confidence toggle; after a miss the feedback region (aria-live, focused) shows verdict + explanation + option explanation and no answer key; reinforcement round "Reforço 1 de 3" with "Tentar de novo"/"Pular"; the correct answer appears only after the retry or a skip; summary "4 de 7 na 1ª tentativa · 1 recuperada" with per-item states.
- Database after finalize: attempt SUBMITTED, result score 4/7 INCORRECT, metrics `{itemCount 7, firstTryCorrect 4, recovered 1, skipped 2, highConfidenceErrors 1}`; schedules: missed items box 1 due 2026-10-17 (greet-1 flagged high-confidence error), first-try correct items box 2 due 2026-10-19.

## Found and fixed during verification

- Seed feedback texts for missed answers stated the correct answer, defeating decision B; rewritten to explain the rule without the answer (`supabase/seed.sql`). The dev stack keeps the old texts because the practice already has attempts (keys are frozen by the attempts guard); a reset applies the new seed.
- Seed v3 practices are published by the seed's publish loop; on the dev stack that loop was run manually and both passed `private.validate_content`.

## Not run yet

- Teacher builder in the browser, `verify:ui`, `verify:full`, Playwright e2e/a11y.

## Release gate (2026-10-17)

`npm run verify:full` on this branch:

- PASS: format, lint, typecheck, unit + integration, `verify:db`, 35 integration SQL files, 27 RLS SQL files, ratchet (44 records), engineering system, platform, harness, security, `eval:agent` (10 rules).
- Playwright e2e (full run, before the last fixes): 34 passed, 3 failed — canonical-slice, teacher-pedagogy, teacher-practices. Causes and fixes in commit 51814dd (Home recommendation gate, blank objective on v3 drafts, result card region, e2e following the new journey).
- Targeted re-run after the fixes (fresh `next build`, canonical fixtures): e2e canonical-slice 5/5, teacher-pedagogy and teacher-practices passed; a11y Prática (desktop + mobile), MANUAL_AUDIO, practice builder and Home/Aulas passed; SQL practice-items and practice-authoring passed.
- FAIL (intentional visual change, pending approval): golden `home` desktop + mobile — recommended practice card and the "Conta / Perfil" sidebar section. Tracked in issue #75; goldens were not updated.
- NOT re-run after the fixes: the rest of the a11y suite, Storybook visual and the other golden screens (unaffected files).

Environment notes: the PR 74 demo dev server was stopped (user-approved) because Next refuses a second dev server in the same directory; Playwright Chromium was reinstalled (the cache had been removed to free disk).

Follow-ups opened: #75 (golden), #76 (per-item teacher feedback in v3 result), #77 (opening a lesson does not unlock its practices), #78 (E2E fixture title visible to the dev student), #79 (non-RFC UUID in dev seed).
