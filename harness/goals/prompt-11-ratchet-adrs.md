# GOAL — prompt-11-ratchet-adrs: Ratchet, ADRs and permanent learning

## Objective

Make relevant repeatable failures produce durable engineering protection so the same failure class is not solved twice.

## Visible result

The repository has an ADR template, structured failure records, an executable ratchet verifier, a periodic harness-review process and one controlled red-to-green demonstration.

## Relevant context

- AGENTS.md
- harness/README.md
- harness/failure-log/README.md
- harness/evals/behavioral.md
- docs/TESTING.md
- docs/DEFINITION_OF_DONE.md
- docs/adr/README.md

## Acceptance criteria

- ADR template contains Context, Decision, Alternatives, Consequences, Status and Date.
- Failure records contain the required incident fields and supported classification.
- Resolved repeatable failures cannot pass the ratchet without permanent protection, test/eval and before/after proof.
- npm run verify:ratchet demonstrates a controlled bad record being rejected and corrected record passing.
- Official CI blocks on the ratchet check.
- Harness review includes an explicit removal/merge process for obsolete controls.

## Allowed files / domains

- package.json
- docs/adr/**
- harness/**
- scripts/verify-harness.mjs
- scripts/verify-ratchet.mjs

## Forbidden areas

- src/**
- supabase/**
- user-facing product behavior
- database schema

## Mandatory tests

- npm run format:check
- npm run lint
- npm run typecheck
- npm run verify:harness
- npm run verify:ratchet
- Official CI

## Required evidence

- controlled red fixture rejected by verify:ratchet;
- corrected green fixture accepted;
- final Official CI run URL;
- durable failure record under harness/failure-log/.

## Definition of done

Ratchet/ADR/failure-log contracts are implemented, the controlled failure is transformed into a blocking guard, Official CI is green, evidence is persisted, and the feature registry is marked done + verified.
