# Failure — Dev server renders Next 404 for existing dynamic routes during long e2e runs

Classification: environment
Status: open
Repeatable: yes
Date: 2026-10-24
PR/commit related: local verification of `codex/teacher-sessions-redesign` (no product code involved)

## Symptom

During full Playwright runs against `next dev`, existing dynamic routes (for example `/aulas/[courseSlug]/modulos/[moduleId]` and its lesson route, Teacher/Admin detail pages) started answering with Next's default page ("404 · This page could not be found", `<h1 class="next-error-h1">`). In one full e2e run this caused 24 of 49 failures that looked like unrelated UI regressions.

## Evidence

- `GET /aulas/yas-foundations/modulos/41000000-0000-4000-8000-000000000001/aulas/welcome-to-yas 404` in the dev server log, with application code executing; the route files exist and contain no `notFound()`.
- Same request returned 200 immediately after removing `.next/dev` and `.next/cache` and restarting `next dev`; later in the next long run the 404s returned.
- The disk had filled up earlier in the session (C: below 1 GB), which also left the persistent Turbopack cache in a bad state.
- With `YAS_ISOLATED_VERIFY=1` (separate `distDir`, `turbopackFileSystemCacheForDev: false`) the 404s did not occur (24 → 6 failures), but cold compiles became slow enough to time out several a11y tests.

## Root cause

The persistent Turbopack filesystem cache for `next dev` (`.next/dev`) loses dynamic route entries over long sessions; aggravated by a disk-full event. Not an application defect.

## Responsible layer

environment / local tooling (Next dev server cache).

## Immediate fix

Stop the dev server, delete only the generated `.next/dev` and `.next/cache`, restart. For gate runs, prefer the production runtime used by `verify:full` (`CANONICAL_E2E=1 YAS_E2E_PRODUCTION=1`, `next build` + `next start`), which has neither the cache problem nor cold compiles.

## Permanent protection

Pending: decide whether local e2e/a11y gate scripts should default to the production runtime (as `verify:full` already does) instead of `next dev`.

## Test/eval created

None yet — the symptom is visible as Next's default 404 in Playwright error context; `tests/unit/isolated-next-config.test.ts` already covers the isolated dev configuration.

## Reproduction

Run the whole `tests/e2e` suite with `--workers=1` against `next dev` with the persistent Turbopack cache after a disk-full event; watch the server log for 404s on existing dynamic routes.

## Before/after proof

Before: route 404 with Next's default page; after cache removal and restart: same route 200 (canonical Student, `/aulas/.../modulos/...`). Production-runtime proof pending.
