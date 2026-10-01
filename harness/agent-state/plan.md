# Agent Plan

## Active task

**prompt-19-assessment-engine-v1**

State: in_progress — discovery complete; implementation and verification pending.

Baseline: `main@af0857d79345db9ed02f8624868c6b061cc71d0f`.  
Branch: `feat/p19-assessment-engine-v1`.

### Objective

Deliver the existing Assessment domain as a secure, immutable-version, retry-safe engine. Preserve all open pedagogical decisions and keep CEFR interpretation absent from V1.

### Small plan

1. Reuse the existing Assessment tables/triggers and Practice V1 layering; do not create parallel result/version tables.
2. Add the smallest append-only migration for start idempotency, version freeze, narrow safe Student read columns and authenticated lifecycle RPCs.
3. Implement `src/modules/assessments/**` and `src/server/assessments/**` with explicit objective/manual item contracts, ProductAnalyticsPort integration and no UI route.
4. Add unit/application and real PostgreSQL/RLS tests covering retries, ownership, cross-version rejection, answer-key secrecy, historical immutability, pending/manual and CEFR-null invariants.
5. Wire the Assessment SQL proof into existing DB/RLS runners, open a PR, inspect every Official CI job, correct root causes only, then persist verification evidence. Do not merge.

### Declared scope

Assessment Engine only. No Progress dashboard, Assessment Authoring/CMS, new analytics provider, standard-setting/cut-score policy, retake policy or automatic Speaking/Pronunciation scoring.

### Known security gap being closed

Current historical grants give `authenticated` table-wide SELECT on `assessment_versions` and `assessment_items`, exposing fields that include scoring configuration and answer keys whenever row RLS allows access. P19 will replace those grants with safe column-level reads and keep scoring server-side.

## Previous active task state

P18 remains independently recorded as `in_progress / verified:false` in the registry. P19 does not mark P18 done and does not alter its unresolved verification history.
