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
- [x] E2E green in verify:ui: 28 tests (verify:full repetition failed separately).
- [x] Accessibility green: 30 tests.
- [x] Design-system visual green: seven tests.
- [x] Windows product golden green: all three complete spec projects.
- [x] Linux product golden green in Official CI 37264212150.
- [x] Verify agent green.
- [x] Verify UI green.
- [ ] Verify full green.
- [ ] Official CI entirely green for final source; 9ca3de5 passed, 570893f failed E2E and correction remains pending.

Unchecked items are pending, not waived. Admin work remains gated by Student completion.
