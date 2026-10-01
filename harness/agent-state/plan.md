# Agent Plan

## Active task

**prompt-18-admin-content-v1**

State: in_progress — product owner explicitly resolved the V1 publication decision; historical discovery below is preserved.

Execution: inspect two read-only reports; principal owns migration/RLS/RPC/audit and final persistence review; delegate isolated Admin domain/server/UI and Student consumer/test changes with disjoint files; validate focused tests, real DB, Admin E2E/a11y then official gates once stable. Runtime allowlist is declared in the P18 goal. Workflow is separate DRAFT/PUBLISHED, Admin+AAL2 direct publication, unpublish-before-edit, no versions or review queues.

Plan: two read-only investigations → principal synthesis → record the initial blocker → apply the explicit owner decision through the smallest migration, server/UI slice and focused tests. Investigation/synthesis completed. Runtime/schema work is authorized by ADR 0006 and the P18 goal. Previous P17 closure below is historical state.

## Historical task

**prompt-17-teacher-operations-v1**

State: done — verified by Official CI #300; PR #21 remains open and unmerged.

Baseline: `main` at `a77386df147805f8ecd236f63657c90d251b3c63`.  
Branch: `feat/teacher-operations-v1`.

### Objective

Deliver Teacher Operations V1 with strict TEACHER + AAL2 entry, explicit teacher-scoped session/roster read models, authorized ATTENDED/NO_SHOW mutation, and durable auditability without expanding Teacher into Admin/Support/commercial capabilities.

### Small plan

1. Inspect the existing Live schema, auth/RLS helpers, audit contracts, Agenda V1 vertical-slice patterns and canonical test/CI wiring.
2. Add the smallest append-only DB boundary required for teacher-scoped session/roster reads and atomic attendance + audit mutation, deriving identity from `auth.uid()`.
3. Implement a dedicated Teacher application/domain/server slice and `/teacher` UI using existing Design System primitives and current Next.js patterns.
4. Add deterministic fixtures plus unit/integration/DB-RLS/E2E/a11y/visual coverage, including cross-teacher and MFA negative paths.
5. Run/inspect Official CI, correct only root causes, then persist evidence and mark the registry done/verified only after every required gate is green.

### Declared scope

Teacher Operations only: own sessions, minimum roster, ATTENDED/NO_SHOW and audit. No Admin CMS, authoring, billing, assignment management, availability CRUD, cancellation/rescheduling, credit/no-show policy, meeting provider or unrelated Practice/CEFR changes.

### Closure

Teacher Operations V1 passed Official CI run `36816618361` with every mandatory gate green. Persistence/audit and responsive visual artifacts were inspected. Durable evidence is under `harness/evidence/prompt-17-teacher-operations-v1/`. No merge to `main` was performed.
