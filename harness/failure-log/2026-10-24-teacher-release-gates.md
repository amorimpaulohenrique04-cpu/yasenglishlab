# Failure — Teacher branch release certification remains incomplete

Classification: state
Status: open
Repeatable: yes
Date: 2026-10-24
PR/commit related: `codex/teacher-sessions-redesign`, release closure after `40f2327`

## Symptom

`npm run eval:agent` exits 1 on the full branch comparison. Release must not be declared green.

## Evidence

Executor observed two failing rules: new UI primitives require semantic review (`calendar`, `command-palette`, `popover`, `stepper`, `time-field`, `toast`), and a newly added canonical-environment `test.skip` in Teacher practices is rejected.

## Root cause

The historical branch includes new primitives and an environment-dependent skip. The evaluator compares the complete `origin/main...HEAD` history and refuses to treat new primitives as automatically reviewed. Its current implementation has no input for accepting semantic review evidence.

## Responsible layer

Branch/harness state. No RLS, product authorization or Windows security change is implicated.

## Immediate fix

Commit `6e6296c` makes Teacher practices reject a missing canonical environment explicitly instead of skipping. A focused evaluator rerun confirms the skip rule now passes; one primitive-review rule still fails. Semantic review found no functional duplicates and is recorded in `harness/evidence/teacher-release-gates/semantic-review.md`; the evaluator itself remains unchanged.

## Permanent protection

Existing `scripts/eval-agent.mjs` remains fail-closed. Full history, actual check results and unverified registry state are preserved.

## Test/eval created

The existing behavioral eval is the executable guard. No new test is claimed for a process blocker; focused/full execution evidence belongs to `harness/evidence/teacher-release-gates/README.md`.

## Reproduction

On this branch with `teacher-release-gates` active in the plan, run `npm run eval:agent` with the default `origin/main...HEAD` comparison.

## Before/after proof

Before: exit 1, two rules above failed after `40f2327`.
After: after `6e6296c`, the skip rule passes and the automatic primitive-review rule still fails. This record stays open while any mandatory release gate fails or has not run.
