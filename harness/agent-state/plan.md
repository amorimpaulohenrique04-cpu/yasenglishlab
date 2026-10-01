# Agent Plan

## Active task

**prompt-15-practice-engine-v1**

State: in progress — implementation and verification pending.

### Objective

Deliver deterministic Practice V1 with a domain-owned catalog/recommendation rule, idempotent attempt/response/result persistence, owner-only access, objective feedback for answer-key activities, explicit pending/manual boundaries for Speaking/Pronunciation, analytics and the approved Practice UI.

### Small plan

1. Refine Practice domain contracts and implement deterministic catalog, recommendation and evaluation policies behind ports.
2. Add an append-only migration/RPC boundary for idempotent attempts, responses and results, with owner-only RLS and analytics idempotency.
3. Seed only contracted content, then implement server adapters/actions and `/pratica` states using existing primitives.
4. Add unit, integration, DB/RLS, E2E, accessibility and visual coverage; run every applicable official gate.
5. Inspect evidence, update docs/progress/registry, and mark done only if all required checks are green.

### Declared scope

Practice route/module/server adapter, a single Practice migration and seed additions, Practice tests/evidence/docs, and the student navigation entry. CEFR assessment, course progress and any invented Speaking/Pronunciation scoring are forbidden.
