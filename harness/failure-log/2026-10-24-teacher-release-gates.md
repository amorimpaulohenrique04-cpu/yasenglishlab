# Failure — Teacher branch release certification remains incomplete

Classification: state
Status: open
Repeatable: yes
Date: 2026-10-24
PR/commit related: `codex/teacher-sessions-redesign`, release closure after `40f2327`

## Symptom

`npm run eval:agent` exits 1 on the full branch comparison. A subsequent focused browser invocation also emitted two failed cases and did not close naturally. Release must not be declared green.

## Evidence

Executor observed two failing rules: new UI primitives require semantic review (`calendar`, `command-palette`, `popover`, `stepper`, `time-field`, `toast`), and a newly added canonical-environment `test.skip` in Teacher practices is rejected.

Focused browser evidence: five cases emitted PASS, Teacher practices remained on /pratica after the 5-second navigation assertion, and the combined Sessions scenario exhausted its180-second budget at the first CSV request after22 screenshots. Runtime captures completed without the historical UNKNOWN open error. A broad manual process filter incorrectly terminated the runner wrapper during teardown; JSON was not generated. These individual results are not an officially completed suite.

## Root cause

The historical branch includes new primitives and an environment-dependent skip. The evaluator compares the complete `origin/main...HEAD` history and refuses to treat new primitives as automatically reviewed. Its current implementation has no input for accepting semantic review evidence.

## Responsible layer

Branch/harness state. No RLS, product authorization or Windows security change is implicated.

## Immediate fix

Commit `6e6296c` makes Teacher practices reject a missing canonical environment explicitly instead of skipping. A focused evaluator rerun confirms the skip rule now passes; one primitive-review rule still fails. Semantic review found no functional duplicates and is recorded in `harness/evidence/teacher-release-gates/semantic-review.md`; the evaluator itself remains unchanged.

Browser investigation: preserve all assertions while splitting the aggregate Sessions scenario by viewport and authenticated exports. Instrument only sanitized POST status/duration and attempt count for the Practice action before deciding on a fix. Cleanup now requires exact helper/Next PIDs validated against the current execution; never select the runner by broad command-text filters. This procedure has not yet been proved by a final run.

## Permanent protection

Existing `scripts/eval-agent.mjs` remains fail-closed. Full history, actual check results and unverified registry state are preserved.

## Test/eval created

The existing behavioral eval is the executable guard. No new test is claimed for a process blocker; focused/full execution evidence belongs to `harness/evidence/teacher-release-gates/README.md`.

## Reproduction

On this branch with `teacher-release-gates` active in the plan, run `npm run eval:agent` with the default `origin/main...HEAD` comparison.

## Before/after proof

Before: exit 1, two rules above failed after `40f2327`.
After: after `6e6296c`, the skip rule passes and the automatic primitive-review rule still fails. This record stays open while any mandatory release gate fails or has not run.
