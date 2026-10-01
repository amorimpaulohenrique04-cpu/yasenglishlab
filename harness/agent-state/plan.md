# Agent Plan

## Active task

**prompt-20-progress-v1**

State: in_progress / unverified.

Baseline: `main@93666bf0478b9dabdc35c89dab72596026d7da9e`.  
Branch: `feat/p20-progress-v1`.

### Small plan

1. Compose one explicit Progress DTO from Learning, Practice, Attendance and Assessment source facts; keep CEFR unavailable while standard setting remains open.
2. Implement a server-only authenticated adapter with bounded bulk reads and `Promise.allSettled` orchestration so one failed domain yields `partial` instead of false zeros.
3. Build `/progresso` with the existing Student shell/primitives, add Progress navigation, responsive CSS and explicit unavailable/empty/local-error states.
4. Add unit/application tests for semantics, concurrency/bounded repository calls and no-write behavior; extend E2E/a11y/golden through the existing test systems.
5. Open PR, inspect Official CI for the head SHA, correct root causes only, then mark Harness done/verified only after all applicable gates are green.

### Scope guard

No DB migration is planned. No Progress source-of-truth table, persisted streak/goal, CEFR mapping, analytics event, service-role bypass or unrelated write-path change is allowed.

## Parallel repository state

P18 remains independently `in_progress / verified:false`. P19 is incorporated in `main` and is the Assessment dependency for P20.
