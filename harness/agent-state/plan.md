# Agent Plan

## Active task

**prompt-11-ratchet-adrs**

State: implementation complete and verified by Official CI; final state-only CI and merge pending.

Goal: make every relevant repeatable failure produce a durable guard and evidence without turning the harness into bureaucracy.

### Completed

1. Reused the existing `docs/adr/` and `harness/failure-log/` structures instead of creating parallel systems.
2. Added explicit ADR and failure-record templates.
3. Added `harness/ratchet.md` with the reproduce → evidence → root cause → structural fix → test/eval → red/green → record loop.
4. Added `verify:ratchet` with a controlled bad/good fixture and durable-record validation.
5. Wired the ratchet into the existing Harness invariants check so Official CI blocks on it.
6. Recorded the pre-existing harness gap as the controlled failure transformed into permanent protection.
7. Official CI #169 passed all mandatory gates; durable evidence is stored under `harness/evidence/prompt-11-ratchet-adrs/`.

### Scope boundary

Harness, ADR/process documentation and verification scripts only. No product UI, domain behavior, database or runtime application changes.
