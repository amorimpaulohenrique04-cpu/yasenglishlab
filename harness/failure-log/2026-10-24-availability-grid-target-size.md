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

None applied. Options need a product/UX decision, so they are not decided here: (a) make hour cells that are mostly covered by a block non-interactive (adding availability over a booked session would then go through the composer only); (b) change grid geometry so uncovered remnants are never smaller than 24 px; (c) let a click on a block's free remainder open the composer for that hour from a full-size target.

## Permanent protection

Pending: once the behavior is decided, add a deterministic e2e/a11y case with a session that covers 40 of 60 minutes of an hour cell, independent of the current clock.

## Test/eval created

Pending — the existing a11y scan detects it only when the clock/data line up (time-dependent).

## Reproduction

Schedule a Teacher session from 22:40 to 23:40 on a future day, open `/teacher/disponibilidade` on desktop for that week and run axe with WCAG 2.2 AA tags; the 23:00 cell fails `target-size`.

## Before/after proof

Before: axe `target-size` violation on the 23:00 cell (prod-runtime a11y run, 2026-10-24). After: pending.
