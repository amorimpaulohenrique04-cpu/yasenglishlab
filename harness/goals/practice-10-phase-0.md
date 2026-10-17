# GOAL — practice-10-phase-0: Practice attempt lifecycle, lesson gating and journey fixes

Status: in_progress  
Owner: agent  
Created: 2026-10-16  
Updated: 2026-10-16

## Objective

Make the Student Practice journey trustworthy before the multi-question engine: starting a practice resumes the open attempt instead of creating duplicates, stale open attempts become ABANDONED, practices linked to lessons the student has not reached cannot be started, the /pratica page has a single primary action and copy that matches the featured lesson state, the weekly summary is labelled as an estimate and is not capped by the history list, and the in-practice progress is exposed to assistive technology.

## Visible result

- Leaving a practice and clicking "Praticar" again on the same activity reopens the same attempt; the history no longer fills with duplicate "Em andamento" rows.
- Practices of lessons not yet reached appear as "Disponível após a aula X" without a start button and are refused by the database.
- /pratica shows one primary CTA (hero); the featured lesson never claims "o que você estudou" for an unreached lesson.
- The summary reads "≈ N min (estimativa)".
- Screen readers announce "Atividade X de Y" in the practice stage.

## Relevant context

- Plan: `C:\Users\PAULO HENRIQUE\.claude\plans\crie-um-plano-para-serialized-umbrella.md` (Fase 0).
- Failure records: `harness/failure-log/2026-10-16-practice-audit-*.md`.
- `docs/PRACTICE_ENGINE.md`, `docs/COHORT_PATH.md`.
- `supabase/migrations/20261014120000_stage_11_access_closure.sql` (start_practice_attempt), `20261015120000_stage_12c1_cohort_path_model.sql` (student_path_available, can_view_practice_activity), `20261015100000_stage_12a_practice_authoring.sql` (cohort_practice_assignments).

Decisions (approved with the plan):

- A. Teacher-assigned practices bypass lesson gating.
- C. An IN_PROGRESS attempt with activity in the last 24h is resumed; older ones become ABANDONED on the next start (lazy, no cron).

## Acceptance criteria

- [ ] Additive migration; existing duplicate IN_PROGRESS attempts are ABANDONED except the latest per (user, activity); partial unique index prevents new duplicates.
- [ ] start_practice_attempt resumes the recent open attempt, abandons stale ones, refuses unreached lessons, keeps idempotency, enrollment scope and subscription gate.
- [ ] SQL test matrix covers reached/unreached/assigned/unlinked/module-only, resume, expiry.
- [ ] UI grouping mirrors the rule; featured group is never unreached; one primary CTA.
- [ ] Summary uses a 7-day query window and estimate label.
- [ ] Practice stage progress is announced (no aria-hidden on the text).
- [ ] The three 2026-10-16 failure records are resolved with protection, test and before/after proof.
- [ ] No regression in practice unit/integration/SQL tests.

## Allowed files / domains

- `supabase/migrations/` (new file only), `supabase/tests/`, `scripts/run-sql-tests.mjs` (registration)
- `src/modules/practice/**`, `src/server/practice/**`
- `src/app/(protected)/(student)/pratica/**`, `src/app/(protected)/(practice-focus)/pratica/**`
- `tests/unit/practice*.test.ts`, `tests/unit/practice-grouping.test.ts`, `tests/integration/practice-application.test.ts`, `tests/a11y/critical-flows.spec.ts`, practice e2e specs
- `docs/PRACTICE_ENGINE.md`, `harness/**`

## Forbidden areas

- Applied migrations, billing/entitlements, auth/RLS weakening, lesson_progress/skill_scores writes.
- Multi-question content, spaced repetition (later phases).

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:db`
- `npm run verify:security`
- `npm run verify:ui`
- Targeted: `npm run test:unit -- practice`, integration practice-application, SQL practice_lifecycle.

## Required evidence

- Command results in `harness/evidence/practice-10-phase-0/`.
- Before/after browser observation as `student.dev@example.test`.

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.
