# Agent Plan

## Active task

**prompt-11-ratchet-adrs**

State: implementation prepared on the feature branch; Official CI verification pending.

Goal: make every relevant repeatable failure produce a durable guard and evidence without turning the harness into bureaucracy.

### Execution

1. Reuse the existing docs/adr/ and harness/failure-log/ structures instead of creating parallel systems.
2. Add explicit ADR and failure-record templates.
3. Add harness/ratchet.md with the reproduce → evidence → root cause → structural fix → test/eval → red/green → record loop.
4. Add verify:ratchet with a controlled bad/good fixture and durable-record validation.
5. Wire the ratchet into the existing Harness invariants check so Official CI blocks on it.
6. Record the pre-existing harness gap as the controlled failure transformed into permanent protection.
7. Run Official CI and only then move the feature registry to done + verified.

### Scope boundary

Harness, ADR/process documentation and verification scripts only. No product UI, domain behavior, database or runtime application changes.
