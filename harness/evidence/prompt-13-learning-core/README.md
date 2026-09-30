# Verification evidence — prompt-13-learning-core

Task: `prompt-13-learning-core`
Implementation commit: `1adb44e5ca75860d261da1afd6de1d50d1e68f15`
Official CI: `36756026206`
Release: `36756622829`
Closed at: `2026-09-30T15:13:00-03:00`

## Conclusion

`P13 CLOSED — READY FOR P14`

This directory records sanitized, verifiable closure evidence for the already-implemented Prompt 13. P13.1 changes Harness/evidence state only and does not modify product behavior.

## Source of truth inspected

- GOAL: `harness/goals/prompt-13-learning-core.md`
- Implementation commit: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/commit/1adb44e5ca75860d261da1afd6de1d50d1e68f15
- Official CI: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36756026206
- Release: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36756622829
- Preview artifact: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36756026206/artifacts/11116523588
- Artifact digest: `sha256:37471c9b9ced00dc1dff8128ae6dafcb7aff76e782eebbdefa3ead18071d1663`

## Official CI result

Official CI run `36756026206` is `completed / success` on head SHA `1adb44e5ca75860d261da1afd6de1d50d1e68f15`.

All mandatory jobs finished successfully: Supply Chain, Database, Guardrail Simulations, Quality, Preview and CI Gate.

Release run `36756622829` is also `completed / success` on the same SHA.

## Database and migration evidence

The Database job reported migration policy passed for 5 migrations, validation from a clean database passed, replay from a second clean database passed, and both `supabase/tests/rls_permissions.sql` and `supabase/tests/vertical_slice_persistence.sql` executed successfully.

The isolated Preview stack applied `supabase/migrations/20260930172100_harden_learning_progress_analytics.sql`.

The RLS test includes executable assertions that an inactive draft course, its modules and its lessons are not visible to a student, and that progress/learning analytics cannot be written for draft learning content.

## Canonical learning flow, persistence and analytics

The Preview job ran `npm run test:e2e`: 2 tests passed. The canonical test includes `login → progress → logout → login → persisted resume`.

After E2E, `scripts/assert-canonical-e2e.mjs` completed and printed `Canonical E2E persistence and analytics evidence passed.`

That assertion verifies persisted completion and learning analytics after the browser flow. The implementation requires stable idempotency keys for `lesson_started`, `lesson_completed` and `module_completed`; the post-E2E assertion requires the expected retry-safe counts and unique critical keys.

The SQL persistence test also proves a stale retry cannot reduce `completion_percent` or `last_position_seconds`.

## Accessibility and visual evidence

The inspected Preview artifact contains reports bound to the implementation SHA and Official CI run:

- accessibility: 4/4 passed, including Home/Aulas landmarks, focusable navigation and axe checks on desktop and mobile;
- golden visual regression: 3/3 passed for login/home/aulas on desktop, tablet and mobile;
- the Official CI Preview job also completed the design-system visual check step successfully.

No snapshot/golden update was made by the P13.1 closure task.

## Scope conclusion

The implementation commit was inspected for changed paths. P13 implementation touched the declared learning slice, matching tests/migration/docs and Harness state; it did not introduce Materiais/P14 or another future feature.

P13.1 itself is limited to GOAL/plan/progress/registry/evidence closure files. No product code, UI, migration, schema, RLS, auth runtime, analytics runtime, functional test, golden, dependency or architecture file is changed by this closure.
