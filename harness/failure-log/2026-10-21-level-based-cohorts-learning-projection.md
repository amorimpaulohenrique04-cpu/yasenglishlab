# Failure — Learning path projection after ordering and completion

Classification: ui contract

Status: open

Repeatable: yes

Date: 2026-10-21

PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/88

## Symptom

The Aulas mobile golden differed by 869 pixels and the canonical last-lesson checkpoint stayed at 0% after persistence reached 100%.

## Evidence

CI 39623020764 visual job 119302176466; local verify-full-release.log: 36 E2E passed, canonical line 477 failed. The local DB showed all three canonical lessons at 100% and enrollment COMPLETED; the failure screenshot showed the last lesson at 0%.

## Root cause

Internal path positions were exposed directly as display ordinals (Módulo 0). The checkpoint controls relied exclusively on implicit route revalidation across the final enrollment transition and did not explicitly refresh their server projection.

## Responsible layer

Shared Learning projection and client checkpoint/server action synchronization.

## Immediate fix

Sort modules by cohort position, then display one-based ordinals. Refresh the current server projection only after the progress action returns, without reporting local optimistic completion or weakening guards.

## Permanent protection

Existing repository integration asserts order and one-based ordinals; the unchanged canonical E2E requires last-lesson 100% immediately and persisted completion; approved golden baselines stay unchanged.

## Test/eval created

tests/integration/learning-cohort-path-repository.test.ts, tests/e2e/canonical-slice.spec.ts, existing Aulas golden.

## Reproduction

Run the repository integration, canonical E2E and Aulas mobile golden against the local fixture.

## Before/after proof

Before: canonical line 477 received 0 instead of 100 after final lesson; mobile Aulas baseline differed by 869 pixels.
After: pending focused and official UI verification.
