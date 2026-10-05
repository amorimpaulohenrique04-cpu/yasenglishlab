# Student Home approved design refactor — evidence

Status: in progress.

## Scope checklist

- [x] Existing Home ports unchanged.
- [x] Existing Home Server Component boundary preserved.
- [x] Bounded upcoming-lesson projection derives only from already-loaded Learning data.
- [x] Student shell/global layout untouched.
- [x] No DB, migration, RLS/auth, entitlement, CEFR or analytics change.
- [x] No fake streak, fake weekly-minutes, search or notification controls.
- [x] No global CSS override or visual tolerance change.
- [ ] Focused unit/integration checks green.
- [ ] Canonical E2E and a11y green.
- [ ] Desktop/tablet/mobile visual evidence inspected.
- [ ] Only intentional Home goldens updated.
- [ ] `verify:agent`, `verify:ui`, `verify:full` green.
- [ ] Official CI green.

The task remains `in_progress / verified:false` until the unchecked evidence exists.
