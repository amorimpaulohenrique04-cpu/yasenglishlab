# Failure — unpatched upstream braces advisory

Classification: dependency  
Status: resolved  
Repeatable: yes  
Date: 2026-10-03  
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/32

## Symptom

Official CI stopped at Supply Chain / Audit locked dependency graph. Mandatory downstream jobs did not execute.

## Evidence

Run [37148144442](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37148144442), implementation head `9571c471f4e44463fec9c0ae93b7873f506beefa`: `npm audit --audit-level=high` exited 1, reporting five high findings propagated from `braces` through micromatch, fast-glob and the existing Next ESLint configuration. Local clean `npm ci` and audit reproduced the finding. Package manifest and lockfile are unchanged from the audited base.

## Root cause

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), reviewed/updated October 2, covers braces through 3.0.3. The authoritative advisory lists no patched version; `npm view braces versions --json` ends at 3.0.3. This precedes execution of the Stage 01 runtime tests.

## Responsible layer

Existing upstream development dependency supply chain, outside Placement implementation.

## Immediate fix

Because no compatible patched npm release was available, keep `audit-level=high` and the production audit intact while applying a narrow source-reviewed backport of the upstream depth guard to the installed dev-only `braces@3.0.3`. Bind the patch to immutable provenance, verify the exploit boundary, and permit the full audit only when every reported high finding belongs to that exact patched advisory chain. No force downgrade, severity reduction or generic advisory suppression was introduced.

## Permanent protection

Official CI now verifies patch provenance/bytes and depth behavior, requires a clean production-dependency audit, keeps the full audit visible, and fails on any additional advisory or dependency-path drift. The backport is temporary and must be removed when an official compatible fixed release is available.

## Test/eval created

`npm run verify:dependency-patches` proves patch provenance and the 100/101 nesting boundary; `npm run verify:supply-chain` proves the production audit is clean and that the only temporary dev finding is the exact patched GHSA chain. Official CI Supply Chain remains mandatory.

## Reproduction

Install the unchanged locked dependency graph in a clean checkout and run `npm audit --audit-level=high`.

## Before/after proof

Before: Official CI and local audit exited 1 for the same advisory.  
After: implementation head `8e793d9678d080d813c1236e3090e3b063226ab7` passed Supply Chain and all downstream jobs in Official CI #498 / run `37164246623`; Stage 01 Full Verify run `37164246619` also passed all five mandatory aliases.
