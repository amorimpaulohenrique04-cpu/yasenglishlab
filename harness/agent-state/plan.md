# Agent Plan

## Active task

**prompt-16-agenda-v1**

State: in progress — implementation and verification pending.

### Objective

Deliver Agenda V1 as the Student projection of the existing Live domain, with safe aggregated availability, auth.uid-owned booking, PostgreSQL-authoritative entitlement/capacity checks, retry-safe persistence and approved responsive UI.

### Small plan

1. Preserve existing Live tables/RLS/trigger contracts and add only the minimum authenticated booking RPC plus safe availability read model.
2. Implement schedule domain/application ports, server-only Supabase adapter and `/agenda` using existing Design System primitives and StudentShell.
3. Seed relative demonstrable sessions without inventing meeting/cancellation/credit policy; add Agenda to the canonical fixture.
4. Prove derived status/eligibility, booking analytics, auth/RLS, duplicate behavior and real capacity=1 concurrency with unit/integration/PostgreSQL/E2E/a11y/visual coverage.
5. Open PR, inspect Official CI/logs/evidence, correct only root causes, then close Harness state only after every required gate is green.

### Declared scope

Only Agenda/schedule vertical-slice files, one append-only migration, minimal seed/test/CI wiring, Student navigation and Harness evidence. Cancellation, meeting providers, credit-window semantics, Teacher/Admin portals, CEFR, Practice and curricular-progress behavior are excluded.
