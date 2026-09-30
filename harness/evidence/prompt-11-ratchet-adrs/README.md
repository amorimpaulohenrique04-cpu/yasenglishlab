# PROMPT 11 — Ratchet, ADRs and permanent learning

## Verified implementation

Official CI run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36653227178  
Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/15  
Verified implementation head: `06a8c20b7b46e0604f8119a63ba93e4640f55d71`

The Official CI passed Supply Chain, Database, Guardrail Simulations, Quality, Preview and CI Gate.

## Ratchet proof

The blocking `Harness invariants` step executed `scripts/verify-ratchet.mjs` and reported:

- controlled red fixture rejected;
- corrected green fixture accepted;
- 1 durable failure record verified.

The controlled failure is recorded in `harness/failure-log/2026-09-29-prompt-11-unprotected-repeatable-failure.md`.

## Permanent protections

- `harness/ratchet.md` defines the reproduce → evidence → root cause → structural fix → test/eval → red/green → record loop.
- `scripts/verify-ratchet.mjs` blocks resolved repeatable failures without permanent protection, test/eval and before/after proof.
- `scripts/verify-harness.mjs` executes the ratchet verifier, making it part of the existing Official CI Quality gate.
- `docs/adr/TEMPLATE.md` and ADR 0005 keep architectural decisions distinct from incident records.
- the Harness review policy requires periodic keep/merge/remove decisions so safeguards do not become permanent debt by default.
