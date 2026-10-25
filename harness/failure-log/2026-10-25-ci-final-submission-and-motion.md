# Failure — CI proof predates final submission and measures transition colors

Classification: test gap  
Status: open  
Repeatable: yes  
Date: 2026-10-25  
PR/commit related: PR #89, reference HEAD 02c06b1

## Symptom

Quality rejects two undeclared goldens; placement and Teacher practices report transient contrast;
canonical post-run proof demands an eighth reinforcement answer after a seven-answer final submission.

## Evidence

`harness/evidence/ci-recovery-final-submission/README.md` links both Official CI runs and inventories
every unexpected result from the eight downloaded Preview artifacts.

## Root cause

Incomplete historical scope; reduced motion did not disable the opacity fade; outline controls faded
when autosave re-enabled them; persistence assertion still implemented the superseded round contract.

## Responsible layer

Harness, shared UI state styling and placement entrance motion.

## Immediate fix

Exact golden paths declared; queue honors reduced motion; disabled outline text uses opaque AA colors;
canonical proof follows the accepted ADR 0025 (explicitly confirmed by user in this chat).

## Permanent protection

The same attempt-scoped DB proof runs in canonical browser finalization/reload and after all E2E tests.
The Storybook regression measures enabled opacity immediately after clearing disabled, with full motion.

## Test/eval created

`tests/unit/canonical-practice-proof.test.ts` (14 cases), strengthened canonical-slice DB assertions,
and outline transition regression in `tests/visual/design-system.spec.ts`.

## Reproduction

Official CI on 02c06b1 reproduces the failures. The old persistence predicate fails the new valid-proof
case and accepts the obsolete eight-response case. Autosave contrast depends on scan timing.

## Before/after proof

Before: runs 40166442125 / 40166440160; two deterministic persistence unit regressions red.
After: focused unit checks pass, eval/harness/ratchet/security/DB structural pass.
Full browser/golden/SQL and Official CI certification pending; keep this record open until inspected.

First corrected CI (1a28d35): a11y 34/34, visual 12+9, DB/RLS and canonical persistence pass.
Admin cohorts still scans during a save redirect (F07); explicit Server Action/destination
completion now replaces the old-row-only synchronization. Push E2E had a setup-only port conflict
(F08), no tests executed. See the evidence matrix for exact run/job context.
