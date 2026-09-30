# Failure — repeatable failures could close without permanent protection

Classification: agent behavior  
Status: resolved  
Repeatable: yes  
Date: 2026-09-29  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/15

## Symptom

The existing failure-log contract could record a relevant repeatable failure as resolved without requiring root cause, permanent protection, a regression test/eval or red-to-green proof.

## Evidence

Before PROMPT 11, harness/failure-log/README.md required observed failure, reproduction, impact, evidence, attempted fixes and next action, but no executable schema validated a resolved incident. scripts/verify-harness.mjs only checked that the failure-log README existed.

## Root cause

Failure logging was designed primarily for blockers. Resolution semantics and the conversion from repeatable failure to executable guard were not part of the harness contract.

## Responsible layer

Harness / agent behavior.

## Immediate fix

Expanded the failure-log schema and documented the eight-step ratchet lifecycle.

## Permanent protection

scripts/verify-ratchet.mjs validates all durable failure records. npm run verify:ratchet runs locally, and Official CI executes it through the blocking Harness invariants step.

## Test/eval created

scripts/verify-ratchet.mjs contains a controlled self-test: an intentionally resolved/repeatable record without permanent protection/test must be rejected, while the corrected record must pass. The behavioral rubric also checks “Repeated failure without ratchet?”.

## Reproduction

Run npm run verify:ratchet. The command always executes the controlled red fixture first and fails if the bad record is accepted.

## Before/after proof

Before: the controlled red fixture omits permanent protection and test/eval; the verifier requires both and proves the bad case is rejected.  
After: the same fixture is corrected with a permanent guard and eval; it passes, then the verifier validates every durable failure record in the repository. Official CI proof: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36653227178.
