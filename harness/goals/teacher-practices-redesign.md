# GOAL — teacher-practices-redesign

Status: in_progress
Created: 2026-10-22
Owner: agent/human

## Objective

Implement the approved six-composition Teacher practices redesign with the Sessions/Reviews design system. Practices inherit lesson access, have one final submission, delayed correction, weighted objective items and Teacher autosave.

## Scope

- Teacher practices routes, teacher-operations practice UI/domain/server.
- Practice domain/player/repository/actions and recommendation/access projections required by the approved rules.
- Additive SQL migration, practice SQL/unit/integration/E2E tests, fixtures, docs and harness.
- Shared UI only where an existing primitive cannot express the required behavior; no global shell redesign.

## Decisions

- Violet primary CTA; lesson destination replaces cohort assignment/scheduling/deadlines.
- All students authorized for the lesson receive its published practices; no assignment bypass.
- Draft answers are editable and resumable; correction and key only after final submission. No retry or spaced review for lesson practices.
- Objective weights 1..100 (default 1); manual questions never receive automatic scores.
- Existing history is preserved; missing lesson links must be regularized, never inferred.
- Economic agents use gpt-6-luna low/medium for bounded work; complex player work uses gpt-6-sol high. Main owns contracts, SQL, security and integration. Maximum three workers; disjoint file ownership.

## Acceptance and mandatory verification

- Three-step authoring, real autosave with conflict protection, seven question formats and shared student preview.
- Access, submission, assets and grading enforced in SQL, including concurrent/idempotent requests.
- Responsive evidence at 1440, 834 and 390 px; keyboard and reduced-motion checks.
- npm run verify:agent; npm run verify:ui; npm run verify:security; npm run verify:db; npm run verify:full.
- Evidence: harness/evidence/teacher-practices-redesign/. No success claim while required checks fail.

## Preservation and delivery

Preexisting harness changes and untracked artifacts belong to prior work. Preserve them. Local reviewable delivery; no remote deployment, push or PR.
