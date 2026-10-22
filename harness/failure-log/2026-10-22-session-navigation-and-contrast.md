# Failure — session detail context and selected-mode contrast

Classification: ui contract
Status: resolved
Repeatable: yes
Date: 2026-10-22
PR/commit related: teacher-sessions-redesign (local delivery)

## Symptom and before evidence

The production browser run failed after saving attendance: the database persisted the mark, but refresh returned the uncontrolled Tabs to Overview and hid the participant badge. The same run found an axe color-contrast violation (1.19:1) when the active calendar mode retained white text over the shared soft-button hover background.

## Root cause and responsible layer

Session details did not persist the active tab across a server refresh. Module CSS styled only the resting selected link, leaving the shared hover rule active.

## Structural fix

Use the existing controlled Tabs with a validated `tab` search parameter and Next-supported native history replacement. Add module-scoped selected hover/focus colors using the approved purple tokens.

## Permanent protection and after evidence

`tests/e2e/teacher-operations.spec.ts` checks the badge after mutation and reload. `tests/e2e/teacher-sessions-redesign.spec.ts` scans the selected Week and Month modes using axe on desktop, tablet and mobile. The corrected production run passed all six selected E2E scenarios, including persistence, foreign-session isolation, exports and all responsive scans. No retries or accessibility exceptions were added.
