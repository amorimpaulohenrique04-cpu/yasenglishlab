# Failure — session detail context and selected-mode contrast

Classification: ui contract
Status: resolved
Repeatable: yes
Date: 2026-10-22
PR/commit related: teacher-sessions-redesign (local delivery)

## Symptom

The production browser run failed after saving attendance: the database persisted the mark, but refresh returned the uncontrolled Tabs to Overview and hid the participant badge. The same run found an axe color-contrast violation when the active calendar mode retained white text over the shared soft-button hover background.

## Evidence

Production browser run after saving attendance (participant badge hidden after refresh) and an axe color-contrast violation of 1.19:1 on the selected calendar mode.

## Root cause

Session details did not persist the active tab across a server refresh. Module CSS styled only the resting selected link, leaving the shared hover rule active.

## Responsible layer

UI (session details tabs and the calendar mode module CSS).

## Immediate fix

Use the existing controlled Tabs with a validated `tab` search parameter and Next-supported native history replacement. Add module-scoped selected hover/focus colors using the approved purple tokens.

## Permanent protection

`tests/e2e/teacher-operations.spec.ts` checks the badge after mutation and reload. `tests/e2e/teacher-sessions-redesign.spec.ts` scans the selected Week and Month modes using axe on desktop, tablet and mobile. No retries or accessibility exceptions were added.

## Test/eval created

`tests/e2e/teacher-operations.spec.ts` (badge after mutation and reload) and `tests/e2e/teacher-sessions-redesign.spec.ts` (axe on selected Week/Month modes at desktop, tablet and mobile).

## Reproduction

Save attendance on a session detail, refresh the page, and check the Participants tab badge; hover the selected Week/Month calendar mode and run axe.

## Before/after proof

Before: participant badge hidden after refresh; axe contrast 1.19:1 on the selected mode.
After: the corrected production run passed all six selected E2E scenarios, including persistence, foreign-session isolation, exports and all responsive scans.
