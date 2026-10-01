# Agent Plan

## Active task

**prompt-17-teacher-operations-v1**

State: in progress — implementation and verification pending.

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
