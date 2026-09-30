# ADR 0005 — Failure-to-guard engineering ratchet

## Status

accepted

## Date

2026-09-29

## Context

The Yas harness already records blockers and runs strong automated checks, but a repeatable failure could still be resolved without requiring a root-cause record, permanent protection or a regression test/eval. That allows the same class of failure to consume engineering time again.

The repository also needs a durable distinction between ordinary task notes and architectural decisions so process documentation does not become bureaucracy.

## Decision

Adopt a failure-to-guard ratchet for relevant repeatable failures.

A resolved repeatable failure must contain evidence, root cause, responsible layer, immediate fix, permanent protection and the test/eval that enforces the protection. The repository validates this contract with npm run verify:ratchet, and Official CI runs the check through the harness invariant gate.

Failure records live in harness/failure-log/. The operating procedure lives in harness/ratchet.md. ADRs remain reserved for durable architectural decisions.

## Alternatives

- Keep failure notes manual-only. Rejected because completion would depend on memory and review discipline.
- Add every incident as a new global rule. Rejected because the harness itself would accumulate low-value debt.
- Require an ADR for every failure. Rejected because incidents and architecture decisions have different purposes.

## Consequences

Positive:

- repeatable failures become executable safeguards instead of tribal knowledge;
- red-to-green evidence is part of resolution;
- failures are classified consistently;
- the harness has an explicit review/removal process.

Trade-offs:

- relevant incidents require a small structured record;
- the ratchet verifier becomes part of CI and must remain fast and low-noise;
- guards that become redundant must be merged or retired rather than preserved indefinitely.
