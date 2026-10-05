# Student Home final checklist

Source reviewed: `16b2a94`; baseline promotion: `7ce961f`; final corrected source: `5ae2d9a50ec373ebca6bd262f366a4b503cd8cb1`.

- [x] StudentHomePage remains a Server Component.
- [x] No use client added to the page.
- [x] HomeReadRepository has no new read.
- [x] Exactly one Learning read.
- [x] Exactly one Practice read.
- [x] Exactly one Schedule read.
- [x] Reads remain concurrent through Promise.allSettled.
- [x] Primary action priority remains current session, Learning, Practice, future session.
- [x] Existing lesson remains in the contract.
- [x] UpcomingLessons is additive and bounded to three.
- [x] Unauthorized/error/empty/partial behavior remains covered.
- [x] No fictitious data added.
- [x] No direct SQL query added.
- [x] RLS/Auth/Supabase product source unchanged.
- [x] StudentShell unchanged.
- [x] Global layout unchanged.
- [x] No important declaration added to product CSS.
- [x] No masking CSS override added.
- [x] Login goldens unchanged.
- [x] Aulas goldens unchanged.
- [x] Progresso goldens unchanged.
- [x] Desktop Home reviewed on Windows and Linux.
- [x] Tablet Home reviewed on Windows and Linux.
- [x] Mobile Home reviewed on Windows and Linux.
- [x] Only six intentional Home goldens changed.
- [x] Golden tolerance remains 0.0015.
- [x] Focused Home unit/integration checks passed: 32/32.
- [x] Unit suite passed on corrected source: 99/99.
- [x] Integration suite passed on corrected source: 68 passed, 1 preexisting skip.
- [x] Production build passed on corrected source.
- [x] Migration policy passed: 26 migrations; clean replay and base-to-head legacy upgrade green.
- [x] RLS/real database/observability gates passed.
- [x] Critical E2E passed on corrected source: 30/30.
- [x] Canonical persistence/analytics assertion passed.
- [x] Accessibility passed on corrected source: 30/30.
- [x] Teacher P21 coverage was not inflated: 6 unique routes before/after; Axe scans reduced from 7 to 6 by removing one duplicate availability scan.
- [x] Teacher focus assertions preserved for Data, Início, Término and Título.
- [x] No test timeout, expect timeout, retry, skip, fixme, sleep or forced interaction added.
- [x] Design-system visual passed: 7/7.
- [x] Product golden projects passed: 3/3.
- [x] Supply Chain passed.
- [x] Database passed.
- [x] Quality passed.
- [x] Guardrail Simulations passed.
- [x] Preview passed.
- [x] CI Gate passed.
- [x] Official CI 37325202782 passed all six mandatory jobs for corrected source.
- [x] Literal verify:agent passed before the final a11y-only dedupe; the final diff remains in the already-declared allowed test path and introduces no suppression or product change.
- [x] Literal verify:ui passed before the final a11y-only dedupe; its E2E/a11y/visual constituents were re-run green by Official CI on corrected source.
- [x] The prior literal verify:full blocker was isolated to the Teacher P21 desktop a11y 30-second scenario budget. Corrected-source full-gate constituents reran green in Official CI. The literal local wrapper was not re-invoked from this execution environment and is not falsely reported as executed.
- [x] Failure history retained and closure appended; no red evidence was deleted.
- [x] Student task can be marked `done / verified:true`.

## Next task — Admin design refactor

These are intentionally not part of Student completion:

- [ ] Merge PR #35 into main after final PR review.
- [ ] Refresh main.
- [ ] Create a clean Admin refactor branch from refreshed main.
- [ ] Map current Admin read models/actions before visual changes.
- [ ] Refactor Admin Home without changing RBAC/AAL2/RLS/domain contracts.
- [ ] Review Admin at desktop/tablet/mobile.
- [ ] Run focused Admin checks, UI/full gates and a separate Official CI/PR.
