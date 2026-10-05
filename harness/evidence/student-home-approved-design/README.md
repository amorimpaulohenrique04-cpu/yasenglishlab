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
- [x] Focused unit/integration checks green (32 tests).
- [ ] Canonical E2E and a11y green.
- [x] Desktop/tablet/mobile visual evidence inspected on Windows and Linux.
- [x] Only intentional Home goldens updated (six platform-specific Home images).
- [ ] `verify:agent`, `verify:ui`, `verify:full` green.
- [ ] Official CI green.

The task remains `in_progress / verified:false` until the unchecked evidence exists.

## 2026-10-05 baseline review

Product source: `16b2a94b30e2d171c6604bb9a98dafca6ddc0348`.
Linux images were reviewed from Official CI run [37258157232](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37258157232), artifact `preview-evidence-bf0c09b78ba71d8a71a176c16274f82e09a074f3`. The artifact name is the PR merge SHA; the run head SHA is `16b2a94`.
Windows images were captured locally using the canonical fixture and reviewed before promotion. No product code changed during promotion.

- Desktop 1440x900: hero/progress/agenda above lessons/practice; no collisions or clipped text.
- Tablet 834x1112: vertical main flow, progress/agenda side by side; lesson rows readable.
- Mobile 390x844: vertical recomposition, full-width usable CTA; all sections readable.
- Browser checks: document scrollWidth equals viewport width at all three sizes; no framework error overlay; primary CTA receives keyboard focus.
- Full Windows golden spec: 3/3 passed, including unchanged Login/Aulas/Progresso. Tolerance remains `0.0015`.
- Initial `verify:agent`: core, Harness and security passed; eval rejected the existing upgrade-script change missing from GOAL scope. GOAL now explicitly declares the user-authorized correction; focused eval passed 10/10. Final wrapper rerun pending.
- Initial Turbopack dev-server attempt timed out before testing. Webpack local server completed the same golden checks; no product config or timeout was changed.
