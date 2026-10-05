# Agent Plan

## Active task

**stage-02-1-operations-ux**

Base `f7ca51a5c0b2bb74b4e620d298454c93ab426b21` (Stage 02 merge #33); branch `feat/stage-02-1-operations-ux`.

1. Treat the supplied roadmap HTML/screenshots as the approved visual objective; keep domain/security/accessibility contracts authoritative for behavior.
2. Audit the real Admin/Teacher pages and reusable UI primitives; reconcile Stage 02 GOAL metadata with its verified registry state.
3. Implement shared presentation primitives only where multiple real consumers exist, then redesign Admin Overview, Leads, Students/Student 360, Teachers, Cohorts, Enrollments, and Teacher operational pages in focused blocks.
4. Preserve projections, actions, source-of-truth ownership, RLS/AAL2, lifecycle and all existing domain transitions; only add a bounded read projection if a verified UI dependency is missing.
5. Per block, run focused behavior/E2E/a11y/visual checks and inspect desktop/tablet/mobile evidence without touching existing untracked artifacts; then run required verification gates sequentially and record actual results.
6. Update task evidence and Harness to observed status; do not mark this feature verified or claim green checks until evidence and applicable Official CI confirm it.
