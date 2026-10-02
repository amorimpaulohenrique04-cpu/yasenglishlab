# Failure — Isolated Next artifacts entered source lint

Classification: environment  
Status: resolved  
Repeatable: yes  
Date: 2026-10-02  
PR/commit related: current change — feat/p21-p0-foundation-closure

## Symptom

After isolated E2E, verify:agent lint scanned generated Next bundles/types and reported 998 errors and 7676 warnings.

## Evidence

`harness/evidence/p21-p0-foundation-closure/lint-generated-red.log` preserves the failing gate. Existing next.config.ts defines `.next-p18` and `.next-p18-build`; ESLint excluded only `.next`.

## Root cause

Generated verification directories were missing from lint/format ignores.

## Responsible layer

Local verification output classification.

## Immediate fix

Add the two exact generated directories to global ESLint and Prettier ignores. All src/tests/scripts remain checked. The task goal explicitly records this scope extension.

## Permanent protection

The ignores prevent compiler-owned JS/type files from being treated as source, just as the existing `.next` rule does.

## Test/eval created

The literal verify:agent gate after isolated browser execution proves this case; existing source lint/type/unit gates remain intact.

## Reproduction

Run isolated Playwright then verify:agent with the former ignores.

## Before/after proof

Before: lint-generated-red.log.

After: corrected verify-agent.log passed core format/lint/typecheck/unit/integration/build. Its Harness check found this record's proof formatting, corrected before the final rerun.
