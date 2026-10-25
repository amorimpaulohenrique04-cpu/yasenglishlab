# Failure — Teacher practices redesign verification failures

Classification: ui contract
Status: open
Repeatable: yes
Date: 2026-10-22
PR/commit related: teacher-practices-redesign (local delivery; no PR in the original task context)

## Symptom

- The animated practice editor stage rendered with computed opacity `0` when its layout did not provide `MotionProvider`.
- Draft autosave remounted the editor at stage 0 even though the save succeeded.
- A Teacher could not directly SELECT their own practice draft (`practice_authoring` assertion).

## Evidence

- Evidence index: [teacher-practices-redesign evidence](../evidence/teacher-practices-redesign/README.md).
- The earlier E2E log predates the latest fixes and fails to find the “Questões” heading after continuing from Information: [e2e.log](../evidence/teacher-practices-redesign/e2e.log).
- The earlier SQL failure is retained in [sql-audit-summary.log](../evidence/teacher-practices-redesign/sql-audit-summary.log). Other SQL scenarios in the available logs still fail, so this does not establish a green database suite.

## Root cause

- Missing motion context: animated children could remain hidden without the provider.
- Revalidating the listing route (`revalidatePath(LIST)`) during draft autosave caused a stateful editor remount and stage reset.
- The draft SELECT policy did not account for the visibility rule needed by the Teacher authoring flow (`private.content_visible`).

## Responsible layer

UI/layout integration (motion provider), application (autosave revalidation) and database policy (draft read guard).

## Immediate fix

- Motion provider added at the layout boundary.
- Listing-route revalidation removed from autosave.
- The raw draft read guard now consults `private.content_visible`.

## Permanent protection

- The E2E asserts that each practice stage reaches opacity `1` ([teacher-practices.spec.ts](../../tests/e2e/teacher-practices.spec.ts)).
- The authoring E2E should verify that the editor remains on the intended stage after saving; rerun evidence is pending.
- `practice_authoring.sql` covers the Teacher draft read.

## Test/eval created

`tests/e2e/teacher-practices.spec.ts` stage-opacity assertion; `supabase/tests/practice_authoring.sql` Teacher draft read.

## Reproduction

- Motion visibility: render the practice editor layout without `MotionProvider`; the stage computes to opacity `0`.
- Autosave stage reset: save/autosave a draft while editing a later stage with listing-route revalidation enabled; the editor remounts at stage 0.
- Draft read: run `practice_authoring.sql` as the canonical Teacher against an owned draft.

## Before/after proof

Before: opacity `0` stage, stage-0 remount after autosave, and the red `practice_authoring` result in `sql-audit-summary.log`.
After: the main run reports `practice_authoring` red → green; fresh passing E2E artifacts for motion and autosave are still pending, so the status stays `open`. The recorded build and some focused gates passed, but global verification remains pending.
