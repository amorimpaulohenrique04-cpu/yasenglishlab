# GOAL — a11y-five-failures

Status: complete within requested a11y scope
Owner: agent
Created: 2026-10-03

## Objective / visible result

Prove and minimally correct the five reported accessibility failures, preserving design, keyboard assertions and Axe coverage.

## Relevant context

docs/TESTING.md, docs/UI_CONTRACT.md, docs/ACCESSIBILITY.md, harness/ratchet.md; tests/a11y/{critical-flows,placement}.spec.ts; original test-results error-context.

## Acceptance criteria

- Identify TeacherLoading's invalid naming semantics.
- Prove focus causes with node identity, activeElement, hydration errors, navigation and Tab observations before edits.
- Run only npm run test:a11y after fixes; stop on remaining failure without another correction round.

## Allowed files / domains

Teacher loading component, placement a11y tests and a narrowly necessary shared test helper; harness goal/state/evidence/failure record.

## Forbidden areas

RLS, migrations, dependencies, workflows, verified flags, unrelated existing changes; no commit/push.

## Mandatory tests

Only npm run test:a11y per explicit user instruction (overrides broader repository gates). Browser diagnostic probes before corrections are investigation, not another test-suite run.

## Required evidence / definition of done

Preserve original error-context, record one Laya triage, DOM probes and final suite results. Report unresolved failures honestly; do not change verified:true.
