# P20 — Progresso V1 evidence

Status: done / verified  
Branch: `feat/p20-progress-v1`  
Baseline: `main@93666bf0478b9dabdc35c89dab72596026d7da9e`  
Verified implementation head: `5f4ea8ccdad9cb394ba17d55b39fc60bc464d024`  
Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/24

## Architecture and behavior

- Progress is a read-only server-side projection over Learning, Practice,
  Attendance and Assessment.
- No Progress table, snapshot, migration, persisted streak, goal or write
  command was added.
- Student identity comes from the authenticated server guard and runtime reads
  use the normal Supabase client/RLS path.
- Learning completion reuses canonical Learning semantics and keeps courses
  separate.
- Practice score/status remains Practice-only; pending or absent values are not
  converted to zero or proficiency.
- Attendance keeps ATTENDED, NO_SHOW, BOOKED-without-attendance and cancelled
  states distinct.
- Assessment exposes only the attempt/SkillScore facts required by Progress.
  Browser-boundary E2E rejects answer keys, rubrics, scoring configuration and
  service-role material.
- CEFR remains explicitly unavailable while standard setting/cut scores are
  unresolved.
- History and seven-day consistency use real source facts/timestamps only.
- Independent domain reads execute concurrently and remain bounded at the
  repository boundary.
- Empty, success, partial, error and unauthorized states remain distinct.

## Verification

The implementation candidate
`5f4ea8ccdad9cb394ba17d55b39fc60bc464d024` passed the mandatory gates:

- `npm run verify:agent`: PASS in run
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36940521369
- `npm run verify:security`: PASS as part of `verify:agent`.
- `npm run verify:ui`: PASS in run
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36940763408
- `npm run verify:full`: PASS in isolated run
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36941525866
- Official CI #359: PASS in run
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36941525748
- Official CI Preview artifact:
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36941525748/artifacts/11200173871

Official CI #359 passed Supply Chain, Quality, Database, Guardrail Simulations,
Preview and CI Gate. Preview passed real DB integration/concurrency, RLS,
observability, canonical fixture, Critical E2E, persistence/analytics,
accessibility, Storybook/design-system visuals and product golden visuals.

## Visual evidence

- The first Progress golden run failed because the new desktop/tablet/mobile
  Linux baselines did not yet exist.
- Actual screenshots produced by Official CI were downloaded and visually
  inspected before promotion.
- No clipping, overflow, broken responsive grid or incorrect Progress state was
  observed.
- The inspected images were promoted unchanged to:
  - `tests/visual/goldens/desktop/progresso-linux.png`
  - `tests/visual/goldens/tablet/progresso-linux.png`
  - `tests/visual/goldens/mobile/progresso-linux.png`
- Golden tolerance was not loosened and no retry/skip was added to make the
  visual gate pass.

## Failure/correction history

- The Live fixture initially booked after session completion; fixture ordering
  was corrected without weakening the database guard.
- The Assessment fixture initially inserted an item after publication; ordering
  was corrected to DRAFT → item → PUBLISHED.
- Early visual capture could observe the loading state; tests now wait for
  loaded Progress semantics.
- Missing golden baselines were corrected only after visual inspection.
- New Progress E2E coverage was moved under the existing canonical suite so the
  agent ratchet did not require new skip/fixme suppressions.
- Formatting failures were corrected with repository-pinned Prettier.
- A combined `verify:ui` + `verify:full` helper contaminated the workspace
  with generated artifact JSON; `verify:full` was rerun alone in a clean
  workspace and passed.

## Scope audit

- No historical migration was edited and no new Progress migration was added.
- No runtime service-role bypass was introduced.
- No Assessment Authoring, retake policy, standard setting, automatic
  Speaking/Pronunciation grading, billing, Teacher/Admin dashboard,
  meeting-provider feature or recommendation engine was implemented.
- No new analytics event/provider was added.
- PR #24 targets `main`, remains open and is intentionally unmerged.
