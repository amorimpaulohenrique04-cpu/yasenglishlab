# GOAL — admin-home-approved-design: Admin Home approved design refactor

Status: in_progress
Owner: agent
Created: 2026-10-05
Updated: 2026-10-05

## Objective

Refactor the Admin home (`/admin`) presentation to follow the approved dashboard reference while preserving the current Server Component data contract, existing Admin routes, authorization, and real read models only.

## Visible result

Admins see a denser, polished overview with real indicators, an operational onboarding summary, priority tasks, and useful shortcuts/lists that recomposes cleanly on desktop, tablet, and mobile.

## Relevant context

- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- Attached Admin dashboard reference image
- `src/app/(protected)/(admin)/admin/page.tsx`
- `src/app/(protected)/(admin)/admin/admin-overview.module.css`
- `src/app/(protected)/(admin)/layout.tsx`
- `src/modules/admin-content/ui/admin-shell.tsx`
- `src/modules/admin-content/ui/admin-content.module.css`

## Acceptance criteria

- [ ] `/admin` uses only the existing four concurrent reads and real derived values.
- [ ] No fake search, notifications, charts, agenda, payment/report/settings routes, backend, migration, RLS, or auth changes are added.
- [ ] Desktop, tablet, and mobile layouts have no horizontal overflow and keep accessible navigation/focus.
- [ ] Focused Admin checks, `verify:agent`, `verify:ui`, and final `verify:full` are recorded.

## Allowed files / domains

- `src/app/(protected)/(admin)/admin/page.tsx`
- `src/app/(protected)/(admin)/admin/admin-overview.module.css`
- `harness/agent-state/plan.md`
- `harness/goals/admin-home-approved-design.md`
- Evidence/progress files if needed for validation records.
- `src/modules/admin-content/ui/admin-shell.tsx` and its local CSS: bounded sidebar footer adjustment supporting the approved Admin reference.
- `harness/feature_list.json`: task registration with verified:false.

## Forbidden areas

- `supabase/migrations/**`
- Auth/RLS/MFA/security policies
- Global layout/primitives unless a real shared defect is proven
- Routes or read models not already available to the Admin home

## Mandatory tests

- `npx prettier --check <changed files>`
- `npx eslint <changed files>`
- `npm run typecheck`
- Focused Admin a11y/smoke check that covers `/admin`
- `npm run verify:agent`
- `npm run verify:ui`
- `npm run verify:full`

## Required evidence

- Exact command/check results.
- Desktop/tablet/mobile visual review of `/admin`.
- Final CI status when available.

## Definition of done

Done means the visual refactor is implemented with real data only, required focused and official checks are green, visual review is complete, and the harness state reflects the work.

## Closure evidence

Implementation and focused Admin validation are complete. The global UI gate remains blocked by OUT_OF_SCOPE_EXISTING_FAILURE; registry stays in_progress / verified:false. See `harness/evidence/admin-home-approved-design/validation.md`. Per the user's closure instruction, verify:full is NOT RUN and no gates are repeated.
