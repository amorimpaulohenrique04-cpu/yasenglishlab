# GOAL — prompt-13-learning-core: Aulas learning core

Status: done
Owner: agent/human
Created: 2026-09-30
Updated: 2026-09-30

## Objective

Promote the existing canonical learning slice into the release-grade Aulas experience, preserving the documented course/module/lesson, publication, progress, authorization, analytics and UI contracts while keeping Home as a read-only projection of learning state.

## Visible result

An authenticated student can browse a deterministically ordered published course, open an ordered module and structured lesson, complete learning idempotently, navigate to the previous or next lesson, sign out, sign back in and resume from persisted progress on desktop, tablet and mobile. Draft content and another student's progress remain inaccessible.

## Relevant context

- `docs/DATA_MODEL.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/ANALYTICS.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/reference-ui/aulas/`
- `src/modules/learning/`
- `src/server/learning/`
- `src/app/(protected)/(student)/aulas/`

## Acceptance criteria

- [x] Published course modules and lessons are presented in deterministic model-defined order; students cannot see draft content.
- [x] Module and lesson screens expose documented loading, empty and error behavior, progress and accessible responsive navigation using existing shell, tokens and primitives.
- [x] Lesson progress writes are idempotent and owned by the authenticated student, with deterministic lesson/module completion.
- [x] Logout/login resumes the real persisted learning position.
- [x] `lesson_started`, `lesson_completed` and `module_completed` are emitted according to the analytics contract without retry/refresh duplication.
- [x] Unit, integration, SQL/RLS when applicable, E2E, accessibility and approved Aulas golden evidence cover the delivered behavior.
- [x] Home remains a projection and no out-of-scope product area or media provider is introduced.
- [x] No unrelated behavior regressed.

## Allowed files / domains

- `src/modules/learning/**`
- `src/server/learning/**`
- `src/app/(protected)/(student)/aulas/**`
- Existing Home learning projection only if contract compatibility requires a scoped update.
- Existing shared models, ports, adapters, analytics, auth context, tokens and primitives only where required for reuse or extension.
- Matching learning, analytics, architecture and testing documentation when executable contracts change.
- `supabase/migrations/**` and `supabase/tests/**` only if the audited model/RLS requires a database change.
- Learning-focused tests, approved Aulas visual baselines and Harness state/evidence.
- Harness closure/evidence only: `harness/goals/prompt-13-learning-core.md`, `harness/agent-state/plan.md`, `harness/agent-state/progress.md`, `harness/feature_list.json`, `harness/evidence/prompt-13-learning-core/**`.

## Forbidden areas

- Materiais, Prática, Agenda, Assessment and Billing feature implementation.
- A definitive Home redesign or using Home as the learning source of truth.
- Selecting or integrating Mux, Cloudflare or any other media provider.
- Service-role access in the student flow or weakened auth/RLS/security checks.
- General redesign or replacement of approved shell/primitives/tokens.

## Mandatory tests

- Learning-domain unit tests.
- Learning application/adapter integration tests.
- Executable positive and negative SQL/RLS cases if schema or RLS changes.
- E2E course → module → lesson → complete → logout/login → resume.
- A11y and desktop/tablet/mobile golden/screenshot checks for UI changes.
- `npm run verify:agent`
- `npm run verify:ui`
- `npm run verify:security` if authorization changes.
- `npm run verify:db` if schema/RLS changes.
- `npm run verify:full`

## Required evidence

- Exact required command results with exit codes.
- Inspected desktop/tablet/mobile screenshots or visual diffs.
- Executable ownership/draft-visibility and retry/idempotency evidence.
- Durable artifacts under `harness/evidence/prompt-13-learning-core/`.

## Closure evidence

- Implementation commit: `1adb44e5ca75860d261da1afd6de1d50d1e68f15`.
- Official CI run: `36756026206` — completed with conclusion `success` on the implementation SHA.
- Release run: `36756622829` — completed with conclusion `success` on the same SHA.
- Database evidence: migration policy passed for 5 migrations; clean-database validation and replay passed; `rls_permissions.sql` and `vertical_slice_persistence.sql` executed successfully.
- Preview evidence: canonical E2E 2/2 passed; persistence/analytics assertion passed; accessibility 4/4 passed; desktop/tablet/mobile golden checks 3/3 passed.
- Preview artifact: `11116523588`, digest `sha256:37471c9b9ced00dc1dff8128ae6dafcb7aff76e782eebbdefa3ead18071d1663`.
- Durable evidence: `harness/evidence/prompt-13-learning-core/README.md` and `harness/evidence/prompt-13-learning-core/verification.json`.
- Closed at: `2026-09-30T15:13:00-03:00`.

## Definition of done

Done means every acceptance criterion passes, all applicable official gates pass, visual/security/persistence evidence was inspected, progress and decisions were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the verified system state.
