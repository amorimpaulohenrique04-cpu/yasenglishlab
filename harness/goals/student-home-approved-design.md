# GOAL — student-home-approved-design: Student Home approved design refactor

Status: in_progress  
Owner: agent/human  
Created: 2026-10-04  
Updated: 2026-10-04

## Objective

Refactor the Student Home to the supplied approved visual direction while preserving the current Home application architecture, domain ownership, authorization, primary-action priority, partial/error semantics, accessibility contracts and all existing product behavior. The only application-model addition permitted is a bounded, derived list of upcoming lessons composed from the already-loaded Learning projection; no new database read, mutation, policy or analytics model is authorized.

## Visible result

The Student Home presents a stronger dashboard hierarchy matching the approved reference: dominant next-action hero, curricular progress, a short upcoming-lesson path, schedule and recommended practice. All visible data remains real and derives from existing Learning, Practice and Schedule sources. Desktop, tablet and mobile are recomposed without changing the shared Student shell.

## Relevant context

- User-supplied approved Student Home screenshot in the implementation request
- `docs/reference-ui/home/README.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `src/app/(protected)/(student)/home/page.tsx`
- `src/modules/home/**`
- `tests/unit/home-projection.test.ts`
- `tests/integration/home-application.test.ts`
- `tests/e2e/canonical-slice.spec.ts`
- `tests/a11y/critical-flows.spec.ts`
- `tests/visual/golden.spec.ts`

## Acceptance criteria

- [ ] Existing Home reads remain exactly one Learning, one Practice and one Schedule read, started concurrently.
- [ ] Primary-action priority and all existing unauthorized/error/empty/partial states remain unchanged.
- [ ] The Home page remains a Server Component and does not acquire direct SQL, mutations or a new data owner.
- [ ] A bounded `upcomingLessons` projection, if needed, is derived only from the already-loaded Learning course and does not replace the existing `lesson` contract.
- [ ] The Home visually follows the approved hierarchy without fake streak, fake analytics, fake search, fake notifications or hardcoded product metrics.
- [ ] Shared Student shell, Aulas and Progresso visuals are not changed by this task.
- [ ] Existing accessible names used by E2E/a11y remain stable where behavior is unchanged.
- [ ] Desktop 1440×900, tablet 834×1112 and mobile 390×844 have no horizontal document overflow and preserve logical reading order.
- [ ] Only intentional Student Home golden baselines change; visual tolerance is not weakened.
- [ ] Focused tests, `verify:agent`, `verify:ui`, `verify:full` and applicable Official CI pass before the task can be marked verified.

## Allowed files / domains

- `src/app/(protected)/(student)/home/page.tsx`
- `src/modules/home/ui/home.css`
- `src/modules/home/domain/models.ts`
- `src/modules/home/application/queries.ts`
- `tests/unit/home-projection.test.ts`
- `tests/visual/goldens/desktop/home-linux.png`
- `tests/visual/goldens/desktop/home-win32.png`
- `tests/visual/goldens/tablet/home-linux.png`
- `tests/visual/goldens/tablet/home-win32.png`
- `tests/visual/goldens/mobile/home-linux.png`
- `tests/visual/goldens/mobile/home-win32.png`
- `harness/agent-state/**`
- `harness/feature_list.json`
- `harness/goals/student-home-approved-design.md`
- `harness/evidence/student-home-approved-design/**`

## Forbidden areas

- Student/Admin/Teacher shared shell or global layout refactors.
- `src/server/**`, `supabase/**`, auth/RLS, migrations, entitlements, CEFR, analytics and notification policy.
- New third-party UI dependencies or duplicate Design System primitives.
- CSS overrides used to mask incorrect component behavior; global `!important`; visual-test tolerance increases.
- `.skip`, `.fixme`, test weakening, hidden assertions, fake metrics or mockup-only routes.

## Mandatory tests

- `npm run test:unit -- tests/unit/home-projection.test.ts`
- `npm run test:integration -- tests/integration/home-application.test.ts`
- focused canonical Home E2E/a11y where applicable
- `npm run verify:agent`
- `npm run verify:ui`
- `npm run verify:full`
- Official CI on the pull request

## Required evidence

- Focused test output proving Home behavior remained stable.
- Desktop/tablet/mobile Home screenshots and reviewed golden diffs.
- Evidence that Login/Aulas/Progresso goldens did not change.
- Final verification/Official CI URL recorded under `harness/evidence/student-home-approved-design/`.

## Definition of done

Done means every acceptance criterion passes, intentional visual changes were reviewed at all three viewports, no architecture/security/data boundary was weakened, mandatory checks pass, evidence was inspected, and `harness/feature_list.json` reflects the observed state. A golden update by itself is not proof of correctness.
