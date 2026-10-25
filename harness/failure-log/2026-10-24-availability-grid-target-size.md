# Failure — Availability grid cell partially covered by a session block fails WCAG 2.2 target size

Classification: ui contract
Status: open
Repeatable: yes
Date: 2026-10-24
PR/commit related: `codex/teacher-sessions-redesign` (Teacher availability workspace)

## Symptom

`tests/a11y/critical-flows.spec.ts:276` ("Teacher P21 operations pages…", desktop) failed with axe `target-size` (serious) on `/teacher/disponibilidade` in a production-runtime run; the same test passed in the previous run.

## Evidence

- Button `Adicionar horário em sábado, 24 de outubro de 2026 às 23:00` (`.gridCell`, height `100 / hours.length %` of a 2.8rem-per-hour column) was partially obscured by a scheduled-session block `22:40 – 23:40` rendered over it: "smallest space is 76px by 14.9px, should be at least 24px by 24px"; safe clickable diameter 6px.
- The run happened close to 23:00 local time and an earlier e2e spec had created a session near "now", so the overlap only exists for some clock/data combinations.

## Root cause

Hour cells in `src/modules/teacher-operations/ui/availability-board.tsx:~248` stay interactive under absolutely positioned slot/session blocks. When a block covers most of an hour, the uncovered sliver of the cell becomes a target smaller than 24×24 px.

## Responsible layer

UI (availability board grid).

## Immediate fix

User chose larger hour rows on 2026-10-24. The board now uses an 80px base row and increases it for the shortest positive uncovered fragment across the week, allowing 26px (24px plus rounding margin). Overlapping blocks are merged for this measurement. The axis stretches with the same grid height. No cells are disabled by this change.

Tradeoff: minute-precision schedules can produce very tall rows (a one-minute gap needs 1560px/hour). This preserves the selected interaction without hiding the small gap; a different compact interaction would require a separate UX decision.

## Permanent protection

`tests/e2e/teacher-availability-workspace.spec.ts` has a dedicated unbooked fixed 2099-10-24 session at 22:40–23:40, checks the free target height, axe WCAG 2.2 AA and clicks the free remainder to fill the composer with the existing 15-minute pointer snapping. It deletes the dedicated session in finally. The fixture does not calculate its interval from the current clock. Unit cases cover overlapping blocks and one-minute gaps.

The first fixture attempt tried to move the booked canonical session and was rejected with SQLSTATE 23514 (reserved session identity is immutable). That was an invalid fixture, not a product defect; the database protection remains unchanged.

## Test/eval created

`tests/unit/availability-grid-geometry.test.ts` and the fixed partial-hour Playwright case above. Execution and before/after production evidence pending; status stays open until the same scenario is proved red then green.

## Reproduction

Schedule a Teacher session from 22:40 to 23:40 on a future day, open `/teacher/disponibilidade` on desktop for that week and run axe with WCAG 2.2 AA tags; the 23:00 cell fails `target-size`.

## Before/after proof

Before: axe `target-size` violation on the 23:00 cell (prod-runtime a11y run, 2026-10-24). After: pending.
