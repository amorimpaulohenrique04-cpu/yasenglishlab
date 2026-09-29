# GOAL — <task-id>: <short title>

Status: planned  
Owner: agent/human  
Created: YYYY-MM-DD  
Updated: YYYY-MM-DD

## Objective

What must change, in one precise outcome-oriented paragraph?

## Visible result

What should a human be able to observe when this task is complete?

## Relevant context

Link only the documents, ADRs, screenshots, issues or existing implementation needed to do this task correctly.

## Acceptance criteria

- [ ] Criterion 1 is externally verifiable.
- [ ] Criterion 2 is externally verifiable.
- [ ] No unrelated behavior regressed.

## Allowed files / domains

- `path/or/domain`

## Forbidden areas

- Areas that must not be modified.
- Product/domain decisions explicitly out of scope.

## Mandatory tests

- `npm run verify:agent`
- Add task-specific checks here.
- Visual task: include `npm run verify:ui`.
- Security/auth task: include `npm run verify:security`.
- DB/migration task: include `npm run verify:db`.

## Required evidence

- Exact command/check results.
- Screenshots or visual diff for visual work.
- Test/policy evidence for security changes.
- Migration/RLS evidence for DB changes.
- Links/paths stored under `harness/evidence/` when durable evidence is needed.

## Definition of done

Done means every acceptance criterion passes, mandatory checks pass, evidence was inspected, decisions/progress were recorded, blockers/TODOs were registered, and `harness/feature_list.json` reflects the real state. A written claim without matching system state is not done.
