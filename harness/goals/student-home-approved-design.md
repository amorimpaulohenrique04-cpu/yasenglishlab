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
- `scripts/ci/validate-upgrade.sh`
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

- `tests/helpers/admin-mfa.ts`
- `src/components/ui/overlays.tsx`
- `tests/e2e/cohorts-booking.spec.ts`
- `harness/failure-log/2026-10-05-admin-overview-e2e-budget.md`
- `tests/a11y/critical-flows.spec.ts`
- `harness/failure-log/2026-10-03-a11y-streamed-focus.md`
- `scripts/ci/validate-upgrade.sh`
- `src/app/(protected)/(student)/home/page.tsx`
- `src/modules/home/ui/home.css`
- `src/components/ui/display.tsx`
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

The existing `validate-upgrade.sh` correction is explicitly retained: no head-only migration means the base-to-head upgrade is not applicable after successful migration/seed replay. This is not authorization to bypass upgrade validation when new migrations exist.

2026-10-05 scope addition: final UI verification reproduced a Teacher new-session focus failure on streamed content. Apply the existing Ratchet visibility-before-focus guard only to that assertion and record the recurrence. Keep native focus, axe, viewports and timeouts intact; no Teacher product change is authorized.

2026-10-05 verification scope addition: the existing Admin default-entry test combines real MFA, three overview captures and cohort mutation in one 30-second test. Two full runs exhausted that budget at different cohort stages; the identical isolated flow passed in 14.8 seconds after environment restoration. Separate overview evidence from cohort mutation into independent original-budget scenarios, retaining every assertion and screenshot. Do not alter Admin product code, authorization, retries or timeouts. Record before/after evidence; completion remains pending until aggregate gates pass.

2026-10-05 hydration investigation scope addition: Official CI 37269576841 failed all three cohort-mutation attempts after an apparently successful click on the visible, enabled DetailDrawer trigger. The trace preserves focus on Gerenciar, no drawer and no JavaScript error. The existing OperationOverlay primitive exposes its client-only interaction enabled in server HTML. Add controlled pre-hydration coverage before applying a narrow hydration readiness guard to this existing primitive. This exception changes no shell, global layout, domain read, authorization or API; verify shared overlay consumers through full UI coverage.

Verification setup clarification: freshTotp in the existing real-MFA helper may wait almost 30 seconds to avoid replaying a submitted code. Authentication setup for the separated Admin scenarios therefore runs in its own 60-second fixture budget, matching the helper's existing destination wait. Functional scenario budgets stay at 30 seconds and assertion timeouts stay unchanged. No MFA shortcut, session impersonation or retry is introduced. Hydration readiness uses aria-disabled plus activation gating to retain keyboard focus during loading; controlled coverage asserts both readiness and native focus.

Final setup scope correction: the same freshTotp wait exhausted the existing Admin-overview accessibility scenario after Admin Content. Isolate only this mandatory cryptographic wait centrally in the test helper by adding its exact scheduled duration to the current scenario budget. Remove the task-local MFA fixture; all tests continue using the original helper and original functional budget. This is not a blanket timeout increase: zero extra time is granted when no fresh-window wait occurs, assertion timeouts remain unchanged, and real MFA is retained. Record this limitation explicitly in evidence and validate full E2E/a11y/CI.

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
