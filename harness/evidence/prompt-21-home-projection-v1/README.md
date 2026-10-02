# P21 — Home definitiva / Student Home Projection V1 evidence

Status: in_progress / verification pending  
Branch: `feat/p21-home-projection-v1`  
Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/25

## Recovery note

The previous closure was reopened after an integrity audit found that Harness
reported `done / verified:true` for an older implementation SHA while the
branch head had moved, and the P21 branch also carried temporary edits to the
Official CI workflow.

Historical successful runs remain valid only for the exact SHAs they tested.
They are not final proof for the current or future P21 head.

## Required final evidence

P21 can return to `done / verified:true` only after:

- Official CI workflow matches `main` with no P21-only verification job.
- Schedule Home read excludes CANCELLED/COMPLETED/ended sessions and is bounded
  to the relevant current/next own booking.
- Focused unit/integration/E2E regression coverage is green.
- Final `main...branch` scope audit is clean.
- A clean implementation head passes the unmodified Official CI.
- Visual desktop/tablet/mobile evidence is inspected when applicable.
- Harness/evidence is updated only after those facts exist.

No merge is part of P21.
