# GOAL — prompt-20-progress-v1: Progresso V1 / Student Progress Read Model

Status: done  
Owner: agent/human  
Created: 2026-10-01  
Updated: 2026-10-01

## Objective

Deliver `/progresso` as a server-side read model/projection that answers “Estou evoluindo?” by composing authorized facts from Learning, Practice, Live/Attendance and Assessment without creating a new source of truth, without writes, and without inferring CEFR from curricular or objective-score percentages.

## Visible result

An authenticated Student can open `/progresso` from Sidebar or mobile Drawer and see real curricular completion, recent Practice, attendance facts, objective Assessment SkillScores, real-history events and an explicit CEFR-unavailable state while standard setting remains open. Empty, partial and error states remain distinguishable, and desktop/tablet/mobile follow the approved Progress reference without inventing unsupported goals/streaks.

## Relevant context

- `docs/PRODUCT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/CEFR_ASSESSMENT.md`
- `docs/PRACTICE_ENGINE.md`
- `docs/LIVE_CLASSES.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/SECURITY.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/PERFORMANCE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/reference-ui/progresso/`
- P13 Learning Core, P15 Practice, P16 Agenda, P17 Teacher Attendance and P19 Assessment Engine implementations.

## Acceptance criteria

- [x] `/progresso` exists and is present in Student Sidebar + Drawer.
- [x] Progress is read-only and composes real Learning, Practice, Attendance and Assessment facts.
- [x] No new authoritative table, snapshot, persisted streak, goal, score or CEFR fallback is introduced.
- [x] Curricular completion reuses the Learning progress semantics; multiple courses remain separate.
- [x] Practice score/status remains Practice-only and pending is never converted to zero/proficiency.
- [x] Attendance distinguishes ATTENDED, NO_SHOW, BOOKED-without-attendance and cancelled bookings.
- [x] Assessment exposes only attempt/SkillScore facts needed by Progress; no answer key/rubric/scoring config.
- [x] CEFR remains unavailable while standard setting/cut scores are unresolved.
- [x] History uses real timestamps only and does not invent improvement claims.
- [x] unauthorized, empty, success, partial and error states are distinct.
- [x] Independent reads execute concurrently and repository/database calls remain bounded as row counts grow.
- [x] Student A/B isolation remains enforced by current RLS and no service-role bypass is used.
- [x] Desktop/tablet/mobile, a11y, E2E and golden visual coverage are integrated with the existing systems.
- [x] No unrelated behavior regressed and the PR is opened against `main` without merge.

## Allowed files / domains

- `src/app/(protected)/(student)/progresso/**`
- `src/modules/progress/**`
- `src/server/progress/**`
- `src/modules/learning/ui/student-shell.tsx` for Progress navigation only
- `src/app/globals.css` only to import Progress CSS
- Progress-focused `tests/**`
- existing E2E/a11y/golden configuration/specs only to include Progress
- `scripts/setup-canonical-e2e.mjs` only for deterministic Progress facts
- existing RLS tests only for Progress-specific assertions if necessary
- `harness/**`
- `docs/**` only if executable behavior requires contract synchronization

## Forbidden areas

- Historical migrations or new authoritative Progress tables.
- Assessment Authoring, retake policy, standard setting/cut scores, AI Speaking/Pronunciation.
- Billing/refunds, new attendance/booking policy, Teacher/Admin dashboard changes.
- Persisted goals, gamification, ranking, XP, badges, streaks, recommendation engine or new analytics events/providers.
- Learning/Practice/Attendance/Assessment write-path behavior unrelated to Progress.

## Mandatory tests

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run test:a11y`
- `npm run test:visual:golden`
- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:ui`
- `npm run verify:full`
- existing PR Database/CI gate remains green; `verify:db` becomes mandatory if any DB/SQL change is introduced.

## Required evidence

- Official CI workflow runs/jobs for the final PR head SHA.
- Progress-focused unit/application evidence, including partial/error semantics and bounded repository calls.
- E2E evidence using real local Supabase facts, including a no-data state and CEFR-unavailable assertion.
- Existing RLS/DB evidence or added Progress-specific RLS assertions proving Student isolation.
- Desktop/tablet/mobile golden evidence and a11y results.
- Durable records under `harness/evidence/prompt-20-progress-v1/`.

## Definition of done

Done means every acceptance criterion and applicable gate is observed green, Progress remains a read-only projection, visual/security/performance evidence is inspected, open pedagogical questions remain unresolved by inference, registry/progress/evidence match reality, the PR targets `main`, and no merge is performed.
