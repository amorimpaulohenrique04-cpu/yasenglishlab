# Failure — unpatched upstream braces advisory

Classification: dependency  
Status: open  
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

No safe compatible release was available when inspected. Keep the audit gate and lockfile intact. Do not execute the proposed force downgrade to eslint-config-next 14.2.35 against Next 16.3.6, suppress the advisory, or introduce an unreviewed fork. Continue local product gates and report the CI failure honestly.

## Permanent protection

The existing mandatory audit remains active and blocks merging. Resolution requires a compatible reviewed dependency remediation followed by the unchanged CI gate.

## Test/eval created

No new test substitutes for the existing `npm audit --audit-level=high` check. The gate reproduces the open failure; Placement DB/RLS/E2E checks remain independent evidence, not a replacement.

## Reproduction

Install the unchanged locked dependency graph in a clean checkout and run `npm audit --audit-level=high`.

## Before/after proof

Before: Official CI and local audit exit 1 for the same advisory.  
After: unresolved; no green result or verified feature is claimed. The final Stage 01 evidence links the final head's CI run.
