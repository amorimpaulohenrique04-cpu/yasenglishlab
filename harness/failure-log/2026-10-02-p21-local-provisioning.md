# Failure — concurrent local database provisioning

Classification: environment
Status: resolved
Repeatable: yes
Date: 2026-10-02
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/30

## Root cause

An independent Supabase restart had not completed when verify:full began its own reset. Both provisioning processes failed. This is local orchestration, not a schema assertion failure.

## Immediate fix

Run the literal verify:full once, allowing it to own start/reset/stop. Await completion before any further Supabase command. No database test, migration or health assertion is weakened.

## Permanent protection

The documented final-gate procedure runs provisioning serially; the existing full verifier owns the lifecycle in its try/finally block.

## Test/eval created

Existing literal full verification exercises the lifecycle and both executable SQL suites.

## Before/after proof

Before: DbSetupError during concurrent start/reset.

After: serial literal verify:full passed all stages; see verify-full.log.

## Symptom

Final gate rejected the recorded failure condition described above.

## Evidence

See harness/evidence/p21-p0-foundation-closure/verify-full.log and verify-ui.log.

## Responsible layer

Local verification environment and platform evidence.

## Reproduction

Run the final literal verification alias as described above.
