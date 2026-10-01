# GOAL — prompt-18-admin-content-v1: Admin Content V1

Status: in_progress
Owner: agent/human  
Created: 2026-10-01  
Updated: 2026-10-01

## Objective

Administer existing educational content with ADMIN + AAL2, validated publication, isolated preview, deterministic ordering and audit, without parallel CMS entities or incompatible Student contracts.

## Visible result

Authorized Admin edits DRAFT, previews without visibility changes, publishes/unpublishes valid content and reorders existing positioned entities. Product owner explicitly resolved the publication decision in the follow-up task.

## Relevant context

- `docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/SECURITY.md`, `docs/AUTH_RBAC_RLS.md`.
- `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`, `docs/ARCHITECTURE.md`.
- `docs/ADMIN_CONTENT.md`, `docs/adr/0006-admin-content-publication.md`.

- docs/OPEN_QUESTIONS.md: pedagogical review before publishing lesson/material/practice.
- docs/DATA_MODEL.md, docs/AUTH_RBAC_RLS.md, docs/AUDIT_LOG.md.
- Domain migrations and existing Student repositories.
- harness/evidence/prompt-18-admin-content-v1/README.md.

## Acceptance criteria

- [x] Explicit V1 publication/visibility contract resolves the necessary open decision.
- [x] Admin Content satisfies requested security, validity, preview, ordering and audit invariants through focused real-DB, E2E and accessibility evidence.
- [ ] All required implementation gates pass.
- [x] Discovery preserves runtime behavior and records the blocker.

## Allowed files / domains

- `next.config.ts`, `playwright.config.ts`, `playwright.a11y.config.ts`, `playwright.golden.config.ts`, `tsconfig.json`, `scripts/verify-full.mjs` — isolated port/build required because an existing server owns port 3000; preserve its process and defaults.

- `harness/**`
- `docs/ADMIN_CONTENT.md`, `docs/OPEN_QUESTIONS.md`, `docs/AUDIT_LOG.md`, `docs/DATA_MODEL.md`, `docs/AUTH_RBAC_RLS.md`, `docs/ARCHITECTURE.md`, `docs/README.md`, `docs/adr/**`
- `supabase/migrations/20261001155659_admin_content_v1.sql`, `supabase/seed.sql`, `supabase/tests/**`
- `src/modules/admin-content/**`, `src/server/admin-content/**`, `src/app/(protected)/(admin)/**`
- `src/server/learning/supabase-learning-repository.ts`, `src/server/materials/supabase-materials-repository.ts`, `src/server/practice/supabase-practice-repository.ts`, `src/server/audit/actions.ts`
- `tests/unit/admin-content.test.ts`, `tests/integration/admin-content-application.test.ts`, `tests/helpers/admin-mfa.ts`, `tests/e2e/admin-content.spec.ts`, `tests/a11y/critical-flows.spec.ts`
- `tests/e2e/materials.spec.ts` — preserve entitlement-negative coverage with an explicitly published fixture.
- `artifacts/prompt-18-admin-content/**` — focused E2E visual evidence.
- `scripts/setup-canonical-e2e.mjs`, `scripts/assert-canonical-e2e.mjs`, `scripts/run-sql-tests.mjs`, `scripts/verify-security.mjs`, `scripts/verify-db.mjs`, `scripts/verify-ui.mjs`, `.github/workflows/foundation-verify.yml`

P18 documentation/ADR and Harness; new append-only migration and DB tests; src/modules/admin-content, src/server/admin-content, src/app/(protected)/(admin); Student learning/material/practice repositories; existing protected-content/RPC authorization and authenticated persistence boundaries; audit taxonomy; focused tests, canonical fixtures and official verification wiring.

## Forbidden areas

No historical migration edits, parallel tables, assessment authoring, billing/refunds, role management, analytics dashboard, editorial versions, binary upload service or pedagogical review workflow.

## Mandatory tests

Implementation requires focused unit/integration/real DB-RLS/E2E/a11y then npm run verify:agent, verify:security, verify:db, verify:ui and verify:full. These gates are not claimed for an unimplemented feature.

Documentation-only phase: existing security unit tests and node scripts/verify-harness.mjs.

## Required evidence

Two read-only investigations, principal synthesis, exact blocker and actual check results in task evidence.

## Definition of done

Explicit contract resolution, minimal implementation and all passing mandatory evidence. Implementation is in progress and remains unverified until the required gates pass.
