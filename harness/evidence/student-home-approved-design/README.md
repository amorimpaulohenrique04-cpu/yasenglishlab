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

## Official CI and local environment follow-up

- [Official CI 37260702056](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37260702056) passed all six jobs for `7ce961fadd444f14a28f597c439d287da7fea174`, including E2E, persistence/analytics, accessibility, design-system visual and all Linux product goldens.
- Final `verify:agent` passed after scope correction: 99 unit tests, 68 integration tests plus one preexisting skip, build, Harness, security and 10/10 eval rules.
- The first UI wrapper reused the screenshot-only server, which omits the official local Mux provider. It was interrupted and restarted with the official helper before the media test.
- The Turbopack UI attempt ran out of disk space while compacting its cache. A Teacher session redirect timed out; its isolated webpack reproduction passed session creation but timed out on cold Student login. No test or product code was changed. The identical focused test passed after warming the official helper routes.
- Webpack diagnosis used the installed Next bundler selector `IS_WEBPACK_TEST=1`, with the official provider helper and original assertions/timeouts. Disposable caches were removed only after their servers stopped.
- A later clean-fixture Admin Cohorts reproduction failed under webpack. The trace showed the main application JavaScript request pending after the GET search navigation, leaving the visible server-rendered drawer trigger unhydrated. This did not establish a product or test defect, so neither was changed.
- Generated `.next` output and process-local TEMP/TMP were relocated to task-specific directories on D: because C: had less than 200 MB free. NODE_PATH points to this repository's existing node_modules for relocated output resolution. The same clean-fixture Admin Cohorts test passed under the default Turbopack bundler afterward (1/1). Final UI/full wrappers now use the default bundler; verification remains pending until they finish.
- The next UI wrapper passed all 28 E2E tests, then encountered an inactive Teacher new-session title field in the desktop focus test. The unchanged isolated scenario passed desktop/mobile (2/2). Its final title interaction lacked the visibility barrier used by the adjacent availability controls and documented in the streamed-focus Ratchet. GOAL scope was extended before adding only `expect(title).toBeVisible()` ahead of the original native focus assertions. Focused validation then passed 2/2; no assertion, timeout, axe rule or product behavior was removed or relaxed.
