# Failure — Availability grid cell partially covered by a session block fails WCAG 2.2 target size

Classification: ui contract
Status: resolved
Repeatable: yes
Date: 2026-10-24
PR/commit related: `ca16dd5` on `codex/teacher-sessions-redesign` (Teacher availability workspace)

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

`tests/unit/availability-grid-geometry.test.ts` and the fixed partial-hour Playwright case above. Execution completed against production builds: the same fixed session failed before with 14.890625px and passed after (1 test, exit 0), including geometry, axe and composer interaction. Reviewed screenshots are in `harness/evidence/teacher-release-gates/availability-before.png` and `availability-after.png`.

## Reproduction

Schedule a Teacher session from 22:40 to 23:40 on a future day, open `/teacher/disponibilidade` on desktop for that week and run axe with WCAG 2.2 AA tags; the 23:00 cell fails `target-size`.

## Before/after proof

Before: production run with the dedicated fixed 2099-10-24 22:40–23:40 session measured 14.890625px and failed the >=24px assertion; historical axe violation independently recorded above.
After: same scenario against the corrected production build passed geometry >= 24 px, WCAG 2.2 AA axe and pointer selection 23:45; Playwright 1 passed (4.1 min), exit 0. Runtime teardown required cleanup of the confirmed server tree; no claim is made that teardown is fixed. See `harness/evidence/teacher-release-gates/README.md`.
