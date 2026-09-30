# GOAL — prompt-13-learning-core: Aulas learning core

Status: in_progress  
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

- [ ] Published course modules and lessons are presented in deterministic model-defined order; students cannot see draft content.
- [ ] Module and lesson screens expose documented loading, empty and error behavior, progress and accessible responsive navigation using existing shell, tokens and primitives.
- [ ] Lesson progress writes are idempotent and owned by the authenticated student, with deterministic lesson/module completion.
- [ ] Logout/login resumes the real persisted learning position.
- [ ] `lesson_started`, `lesson_completed` and `module_completed` are emitted according to the analytics contract without retry/refresh duplication.
- [ ] Unit, integration, SQL/RLS when applicable, E2E, accessibility and approved Aulas golden evidence cover the delivered behavior.
- [ ] Home remains a projection and no out-of-scope product area or media provider is introduced.
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `src/modules/learning/**`
- `src/server/learning/**`
- `src/app/(protected)/(student)/aulas/**`
- Existing Home learning projection only if contract compatibility requires a scoped update.
- Existing shared models, ports, adapters, analytics, auth context, tokens and primitives only where required for reuse or extension.
- Matching learning, analytics, architecture and testing documentation when executable contracts change.
- `supabase/migrations/**` and `supabase/tests/**` only if the audited model/RLS requires a database change.
- Learning-focused tests, approved Aulas visual baselines and Harness state/evidence.

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

## Definition of done

Done means every acceptance criterion passes, all applicable official gates pass, visual/security/persistence evidence was inspected, progress and decisions were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the verified system state.
