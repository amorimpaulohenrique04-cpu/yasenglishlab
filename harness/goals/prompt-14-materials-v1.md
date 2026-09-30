# GOAL — prompt-14-materials-v1: Materiais V1

Status: in_progress
Owner: agent/human
Created: 2026-09-30
Updated: 2026-09-30

## Objective

Deliver the first release-grade Materiais experience using the existing Material model, student authorization/RLS, private Supabase Storage, protected signed-URL service, product analytics contract and approved Yas Design System.

## Visible result

An authenticated student can open `/materiais`, see only authorized active materials in deterministic pedagogical context, search/filter them, favorite or unfavorite them idempotently, and open an authorized protected asset through a short server-created signed URL. Unauthorized materials remain invisible and cannot be opened directly.

## Relevant context

- `docs/PRODUCT.md`
- `docs/MATERIALS.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/ANALYTICS.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/reference-ui/materiais/`

## Acceptance criteria

- [ ] Student navigation exposes Materiais without redesigning the shared shell.
- [ ] The page lists only active materials authorized by existing RLS/enrollment/entitlement rules.
- [ ] Material context preserves module/lesson/type and ordering is deterministic.
- [ ] Search and category filtering are deterministic and accessible.
- [ ] Favorite/unfavorite is ownership-safe and idempotent.
- [ ] Recent materials are shown only if a durable non-analytics source already exists; otherwise the section is intentionally omitted.
- [ ] Protected assets open only after server-side authorization and use the existing short signed-URL service.
- [ ] No product log/audit/analytics payload includes storage paths, service-role credentials or signed URLs.
- [ ] `material_opened` and `material_favorited` are emitted with minimized properties and do not become a source of truth.
- [ ] Loading, empty, error and unauthorized states exist.
- [ ] UI composes existing Design System primitives and follows the approved Materiais desktop composition with responsive tablet/mobile recomposition.
- [ ] Unit/integration, authorization/E2E, accessibility and visual evidence cover the delivered behavior.
- [ ] No admin upload/CMS, new provider, public-storage bypass or unrelated future feature is introduced.

## Allowed files / domains

- `src/modules/materials/**`
- `src/server/materials/**`
- `src/app/(protected)/(student)/materiais/**`
- `src/modules/learning/ui/student-shell.tsx` only for shared student navigation.
- `src/app/globals.css` only to register Materiais styles.
- `supabase/seed.sql` for deterministic development material metadata only.
- `scripts/setup-canonical-e2e.mjs` for isolated test user/storage fixtures only.
- `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`, `tests/a11y/**`, `tests/visual/**` for Materiais coverage.
- `playwright.golden.config.ts` only if required to register approved Materiais golden names.
- `supabase/migrations/**` and `supabase/tests/**` only if a real DB/RLS gap is proven before implementation.
- Matching Materials/architecture/testing documentation only where the executable contract changes.
- Harness goal, plan, progress, registry and durable evidence for this task.

## Forbidden areas

- Admin upload/CMS or authoring workflow.
- New storage, analytics, billing, media or content provider.
- Public bucket/material URL used to bypass authorization.
- Service-role access in browser/student UI.
- Weakening existing RLS, entitlement or enrollment rules.
- Using product analytics as the source of truth for Recents.
- Practice, Agenda, Assessment, Billing or unrelated feature implementation.
- Arbitrary golden/snapshot updates to hide regressions.

## Mandatory tests

- Materials domain/application unit and integration tests.
- Existing SQL/RLS suite; extend only if DB/RLS changes.
- E2E authorized list/open + unauthorized direct-open denial + favorite state.
- Accessibility coverage on desktop and mobile.
- Approved Materiais visual evidence for desktop/tablet/mobile.
- `npm run verify:agent`
- `npm run verify:ui`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:full`

## Required evidence

- Exact relevant command/CI results.
- Inspected desktop/tablet/mobile visual evidence against `docs/reference-ui/materiais/reference.webp`.
- Positive authorized open and negative unauthorized direct-open evidence.
- Favorite idempotency evidence.
- Proof that Data API still does not expose protected storage paths.
- Durable artifacts under `harness/evidence/prompt-14-materials-v1/`.

## Definition of done

Done means every applicable acceptance criterion is proven, all official gates pass, security/visual evidence is inspected, no forbidden scope was introduced, blockers/TODOs are recorded, and the registry reflects the verified state.
