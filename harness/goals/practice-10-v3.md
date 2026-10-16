# GOAL — practice-10-v3: Multi-question practices, per-item feedback, spaced review and teacher authoring

Status: in_progress  
Owner: agent  
Created: 2026-10-16  
Updated: 2026-10-16

## Objective

Deliver phases 1–4 of the practice-10 plan in one PR (commits per area): a practice holds several questions chosen by the Teacher (content v3), the Student answers one question at a time with elaborated per-item feedback and a reinforcement round, objective items enter a deterministic spaced-review schedule, /pratica surfaces due reviews and real history states, and the Teacher builder authors v3 practices with per-option explanations and a pronunciation template.

## Visible result

- A v3 practice runs question by question, shows the explanation (never the answer) after a miss, offers a reinforcement round, then a per-item summary.
- Missed items return in "Revisão de hoje" after one day; correct ones space out 3/7/14/30 days.
- Teachers add, reorder and remove questions, write per-option explanations and preview with the Student player.

## Relevant context

- Contract: `docs/PRACTICE_V3.md`; plan `C:\Users\PAULO HENRIQUE\.claude\plans\crie-um-plano-para-serialized-umbrella.md`; decisions A–D in `harness/agent-state/decisions.md`.
- Phase 0: `harness/goals/practice-10-phase-0.md` (commit bd5e81b).

## Acceptance criteria

- [ ] Migration `20261016130000_stage_13b_practice_v3.sql` additive; SQL suites practice-items and practice-review-schedule pass; regressions (practice-lifecycle, practice-authoring, access-closure, function-privileges, sensitive-tables-negative) pass.
- [ ] Answer keys / correct answers never reach a Student in round 1; practice never writes lesson_progress/assessment_attempts/skill_scores.
- [ ] Unit/integration tests for session, spaced review, content v3, recommendation, builder and teacher commands pass.
- [ ] Browser: Student v3 flow and Teacher builder work on the dev stack; a11y of the player (focus, aria-live, progress).
- [ ] `verify:ui` and `verify:full` pass.

## Allowed files / domains

- `supabase/migrations/` (new), `supabase/tests/`, `supabase/seed.sql`, `scripts/run-sql-tests.mjs`
- `src/modules/practice/**`, `src/server/practice/**`, student practice routes
- `src/modules/teacher-operations/**`, `src/server/teacher-operations/**`, teacher practice/review routes
- practice/teacher tests, `docs/PRACTICE_V3.md`, `docs/PRACTICE_ENGINE.md`, `harness/**`

## Forbidden areas

- Applied migrations, billing/entitlements, RLS weakening, CEFR/skill_scores writes.

## Mandatory tests

- `npm run verify:agent`, `npm run verify:db`, `npm run verify:security`, `npm run verify:ui`, `npm run verify:full`

## Required evidence

- `harness/evidence/practice-10-v3/`

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.
