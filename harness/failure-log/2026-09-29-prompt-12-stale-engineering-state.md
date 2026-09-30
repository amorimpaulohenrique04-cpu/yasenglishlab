# Failure — engineering entry points and persistent state drifted behind main

Classification: state  
Status: resolved  
Repeatable: yes  
Date: 2026-09-29  
PR/commit related: prompt-12-engineering-system-1-0

## Symptom

The root README and module/style maps still described a foundation-only repository, while the persistent agent plan still said PROMPT 11 was awaiting merge even though those capabilities were already present on main.

## Evidence

The independent PROMPT 12 audit read the current files directly and found stale phrases such as “engineering foundation only”, deferred design tokens and “merge pending” for a feature already marked done.

## Root cause

Completion checks validated the existence of Harness state but did not validate cross-file semantic consistency between the current repository surface, feature registry and active plan.

## Responsible layer

Harness / repository documentation state.

## Immediate fix

Reconciled the root/module/style maps, completed the missing engineering milestone registry entries and moved the active plan to PROMPT 12 remediation.

## Permanent protection

`scripts/verify-engineering-system.mjs` rejects known stale README markers, unresolved milestone dependencies and a completed feature whose active plan still claims pending/in-progress state. `verify:harness` executes it in Official CI.

## Test/eval created

The Engineering System verifier contains a controlled stale-plan fixture that must be rejected and a corrected fixture that must pass, then validates the real repository.

## Reproduction

Run `npm run verify:system`. The controlled bad fixture represents a done registry entry paired with “State: merge pending”.

## Before/after proof

Before: the controlled stale fixture is rejected and the pre-remediation real repository would fail the same consistency checks.  
After: the corrected fixture passes and the reconciled repository is validated by the same executable contract.
