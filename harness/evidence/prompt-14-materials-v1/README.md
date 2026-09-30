# Verification evidence — prompt-14-materials-v1

Task: `prompt-14-materials-v1`
Implementation/evidence commit: `1f1018b998639b7285e898ae15d456939bcade8a`
Official CI: `36770674489`
Preview artifact: `11124245839`
Verified at: `2026-09-30T17:14:54-03:00`

## Conclusion

`P14 CLOSED — READY FOR P15`

Materiais V1 is implemented using the existing Material/Favorite model, authenticated RLS client, private Supabase Storage, existing server-only signed-URL service, product analytics contract and Yas Design System. No admin/CMS, new provider, public-storage bypass or parallel Recents tracking was introduced.

## Source of truth

- Goal: `harness/goals/prompt-14-materials-v1.md`
- Implementation/evidence commit: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/commit/1f1018b998639b7285e898ae15d456939bcade8a
- Official CI: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36770674489
- Preview artifact: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36770674489/artifacts/11124245839
- Artifact digest: `sha256:63457b3fdfb841fd4b1a14548c350194c81d43454f93ace84ded03702cde3597`
- Approved visual reference: `docs/reference-ui/materiais/reference.webp`

## Functional evidence

The student surface at `/materiais` reads only columns already exposed to authenticated users and relies on existing `materials_authorized_select` RLS. It supplies deterministic module/lesson/type context, accent-insensitive search, deterministic category filters and a responsive course-material library.

Favorites use the existing `material_favorites` ownership policies and `unique (user_id, material_id)`. Integration evidence proves first favorite/unfavorite transitions change state and repeated requests are idempotent; browser evidence proves favorite → unfavorite → favorite through the rendered UI.

There is no Recents implementation. The durable model has no material-access history, and `docs/ANALYTICS.md` forbids product analytics from becoming application state. The approved reference's history-dependent sections are therefore intentionally omitted rather than simulated with parallel tracking.

## Protected asset and authorization evidence

The browser never receives a storage path from the Materials repository. Authorized opens go through `/materiais/[materialId]/abrir`, re-authorize the material with the authenticated RLS client, then call the existing server-only protected-asset service for a 120-second signed URL.

The signed-URL service resolves `storage_path` only after authorization using the server admin client. The service role remains server-only. Audit/observability metadata contains asset kind/id and TTL, not the storage path or signed URL.

Critical E2E passed 3/3. The Materials flow proved an authorized private asset returns a signed Storage redirect and a direct request for an entitlement-protected material returns 404.

Current Supabase documentation was checked during implementation: private buckets require authenticated access or a time-limited signed URL, while public buckets bypass retrieval access controls. The implementation keeps `yas-protected-assets` private.

## Database and RLS evidence

P14 did not change schema, grants, policies or RLS, so no artificial migration was created.

The existing Data API grant on `public.materials` intentionally omits `storage_path`. `supabase/tests/rls_permissions.sql` includes executable assertions that:

- a student with the required entitlement can read the paid material;
- a student without that entitlement cannot read it;
- the authenticated role does not have SELECT privilege on `materials.storage_path` or the protected storage-path columns of lesson/recording assets.

Official CI Database validation ran all SQL invariant files on clean migrated/seeded databases and completed successfully.

## Analytics and privacy evidence

`material_favorited` carries only `material_id`. `material_opened` carries only `material_id` and `material_type`.

After the browser flow, `scripts/assert-canonical-e2e.mjs` required both event types and rejected material analytics properties containing `storage_path`, `signed_url`, `service_role` or `yas-protected-assets/`. It completed with:

`Canonical E2E persistence and analytics evidence passed.`

Product analytics is evidence/measurement only and is not used as the source of truth for favorites, search, authorization or Recents.

## Automated verification

Official CI run `36770674489` completed with every mandatory job green:

- Supply Chain: success.
- Quality: format, lint, typecheck, unit, integration, Harness, security and production build passed.
- Database: migration policy, clean migration/seed/SQL validation and replay passed.
- Guardrail Simulations: success.
- Preview: Critical E2E, post-E2E analytics assertion, accessibility, Storybook/design-system visuals and product golden regression passed.
- CI Gate: success.

Materials-specific unit tests: 4 passed.
Materials application integration tests: 4 passed.
Critical E2E total: 3 passed.
Accessibility: 6 passed across `desktop-a11y` and `mobile-a11y`.
Product golden regression: 3 passed across desktop/tablet/mobile.

The repository's Official CI distributes the underlying checks that local orchestration commands group together. `verify:security` is invoked literally in Quality. The `verify:agent`, `verify:ui`, `verify:db` and `verify:full` wrapper names are not all invoked literally by Actions; their relevant core/Harness/security/DB-RLS/E2E/a11y/visual constituents are executed by Quality, Database and Preview. No claim is made that a wrapper ran when it did not.

## Visual inspection

The final artifact preserves loaded screenshots at:

- `artifacts/canonical-slice/materiais-desktop.png`
- `artifacts/canonical-slice/materiais-tablet.png`
- `artifacts/canonical-slice/materiais-mobile.png`

All three were inspected directly against the approved Materiais reference. Desktop preserves the approved hierarchy of navigation, page title, search, type filters, course-material accordion and Favorites. Tablet removes the desktop sidebar and recomposes Favorites below the library. Mobile remains a single readable column with wrapped filters, full-width primary actions, visible favorite controls and no horizontal overflow.

The reference's `Continue revisando` and `Recentes` sections are intentionally absent because their semantics require durable access-history data that the current model does not provide.

## Scope conclusion

No DB/RLS migration was needed. No admin upload/CMS, provider, public bucket/material URL, browser service role, analytics-as-state shortcut, RLS weakening or future feature was added.

The only non-product closure changes after implementation are Harness status/evidence updates. P15 has not been started.
