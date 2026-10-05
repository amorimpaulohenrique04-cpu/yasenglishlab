# Student Home final checklist

Source reviewed: `16b2a94`; baseline promotion: `7ce961f`.

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
- [x] Unauthorized/error/empty/partial behavior remains covered by focused passing tests.
- [x] No fictitious data added.
- [x] No direct SQL query added.
- [x] RLS/Auth/Supabase product source unchanged.
- [x] StudentShell unchanged.
- [x] Global layout unchanged.
- [x] No important declaration added to product CSS.
- [x] No masking CSS override added in this completion pass.
- [x] Login goldens unchanged.
- [x] Aulas goldens unchanged.
- [x] Progresso goldens unchanged.
- [x] Desktop Home reviewed on Windows and Linux.
- [x] Tablet Home reviewed on Windows and Linux.
- [x] Mobile Home reviewed on Windows and Linux.
- [x] Home goldens updated only after review.
- [x] Unit suite green: 99 tests.
- [x] Integration suite green: 68 passed, one preexisting skip.
- [x] E2E green in verify:ui and latest verify:full: 30 tests.
- [x] Accessibility green: 30 tests.
- [x] Design-system visual green: seven tests.
- [x] Windows product golden green: all three complete spec projects.
- [x] Linux product golden green in Official CI 37317448834.
- [x] Verify agent green.
- [x] Verify UI green.
- [ ] Verify full green: latest run failed Teacher P21 desktop accessibility at the 30-second scenario budget; 29 a11y passed.
- [x] Official CI entirely green for final tested source 7f9715d: all six jobs in run 37317448834.
- [ ] Official CI for the final evidence commit inspected.
- [ ] Admin branch created from refreshed main after Student closure.
- [ ] Admin page/CSS refactor, three-viewports review, tests and separate PR.

Unchecked items are pending, not waived. Admin work remains gated by Student completion.
