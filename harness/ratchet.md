# Engineering Ratchet

The ratchet turns relevant repeatable failures into durable safeguards. It is not an incident diary and it is not a reason to add rules for every mistake.

## Failure classes

Use exactly one primary classification:

- context
- tool
- environment
- state
- architecture
- security
- ui contract
- test gap
- observability
- permission
- dependency
- agent behavior

## Ratchet loop

For every relevant repeatable failure:

1. **Reproduce** the failure deterministically.
2. **Capture evidence** before changing the system.
3. **Locate root cause** instead of stopping at the symptom.
4. **Make the smallest structural fix** at the responsible layer.
5. **Create a test/eval** that protects the failure class.
6. **Prove it failed before** with a red fixture, failing test, historical evidence or controlled simulation.
7. **Prove it passes after** with the same scenario corrected.
8. **Record** the result in harness/failure-log/ and link the related PR/commit.

A repeatable failure is not resolved until steps 1–8 are represented by evidence. If a deterministic reproduction is impossible, record why and keep the status open or accepted-risk instead of inventing proof.

## Choosing the permanent guard

Prefer the narrowest guard that catches the class at the earliest reliable boundary:

- broken approved UI → visual regression or accessibility test;
- duplicate primitive → UI contract/eval/lint when mechanically detectable;
- service-role secret in client code → security scanner/invariant;
- missing RLS → migration + executable RLS test;
- success claim without verification → behavioral eval/registry invariant;
- missing telemetry → observability integration test.

Do not add a global rule when a local type, schema, test or component contract is sufficient.

## ADR boundary

Use an ADR only when the failure exposes a durable architectural decision with meaningful alternatives/consequences. Ordinary bug fixes and task-specific choices stay in the failure record, code and task evidence.

## Harness review

Harness controls can become debt. Review the ratchet at least once per quarter or after 10 new resolved failure records, whichever happens first.

For each guard, inspect:

- the failure class it uniquely prevents;
- catches since the previous review;
- false positives or developer friction;
- runtime/maintenance cost;
- overlap with stronger checks added later;
- whether the original risk still exists.

Keep a guard when it still protects a meaningful invariant. Merge it when another check now covers the same class more directly. Remove it when it has no unique protection, has become obsolete, or costs more than the risk it mitigates. Any removal must leave a short rationale in the relevant failure record or a superseding ADR.

The goal is a smaller, stronger harness—not an ever-growing list of rules.
