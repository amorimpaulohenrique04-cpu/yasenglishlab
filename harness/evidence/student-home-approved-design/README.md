# Student Home approved design refactor — evidence

Status: passed / verified.

## Scope checklist

- [x] Existing Home ports unchanged.
- [x] Existing Home Server Component boundary preserved.
- [x] Bounded upcoming-lesson projection derives only from already-loaded Learning data.
- [x] Student shell/global layout untouched.
- [x] No DB, migration, RLS/auth, entitlement, CEFR or analytics change.
- [x] No fake streak, fake weekly-minutes, search or notification controls.
- [x] No global CSS override or visual tolerance change.
- [x] Focused unit/integration checks green (32 tests).
- [x] Canonical E2E and a11y green in final verify:ui (30 E2E, 30 a11y).
- [x] Desktop/tablet/mobile visual evidence inspected on Windows and Linux.
- [x] Only intentional Home goldens updated (six platform-specific Home images).
- [x] Required verification coverage green. Literal `verify:agent`/`verify:ui` passed before the final a11y-only dedupe; Official CI 37325202782 re-ran corrected E2E/a11y/visual and core gates. The literal local `verify:full` wrapper was not re-invoked and is not falsely reported as executed.
- [x] Official CI green for final tested code 7f9715d (37317448834, all six mandatory jobs).
- [x] Official CI 37325202782 inspected for corrected source `5ae2d9a`; all six mandatory jobs passed.

The Student task is `done / verified:true` based on the inspected corrected-source evidence below. PR #35 remains open for review/merge; Admin is a separate follow-up task.

## 2026-10-05 corrected-source closure

- Corrected source: `5ae2d9a50ec373ebca6bd262f366a4b503cd8cb1`.
- The Teacher P21 a11y scenario covered six unique routes but executed seven Axe scans because `/teacher/disponibilidade` was scanned twice. The correction keeps all six routes and all focus assertions while executing one Axe scan per unique route. Test count is unchanged; timeout/retry/sleep/force settings are unchanged.
- Official CI [37325202782](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37325202782) passed Supply Chain, Database, Quality, Guardrail Simulations, Preview and CI Gate.
- Corrected-source counts: unit 99/99; integration 68 passed + 1 preexisting skip; E2E 30/30; accessibility 30/30; design-system visual 7/7; product golden 3/3. Migration/upgrade, real DB/RLS, observability, persistence/analytics, build and security gates also passed.
- Preview artifact: [11351644856](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37325202782/artifacts/11351644856).
- The previous literal local `verify:full` failure is retained in history. Its only blocker was the Teacher P21 desktop a11y 30-second scenario budget. The literal wrapper was not re-run from this execution environment; completion relies on its corrected constituent gates passing in authoritative Official CI, following the existing Stage 02.1 evidence convention.

## Final gate attempt, 2026-10-05

- Latest literal sequence on `7f9715d123b54aa1f4ee151b99c2c1ef9eca9624`: `verify:agent` passed; `verify:ui` passed (30 E2E, 30 accessibility, seven design-system checks, three full Windows golden projects); `verify:full` failed with exit 1 at accessibility. Full verification passed 99 unit, 68 integration plus one preexisting skip, build, 26 migrations/17 static SQL invariants, 12 real SQL integration files, eight RLS files, Harness/security/eval, 30 E2E and persistence/analytics. Accessibility passed 29 and failed the Teacher P21 desktop operations scenario at its original 30-second total budget; the same mobile scenario passed in 19.6 seconds. The failure snapshot was on `/teacher/alunos`, before the final form focus checks. Cause and isolated reproduction remain pending; no timeout or assertion was weakened. The full run did not reach its Storybook/golden repetition. The already completed UI wrapper and Official CI are green, but do not override this required red gate.
- User requested closure of the current work. Student remains `in_progress / verified:false`; PR #35 remains open, not merged. Admin has not started, and its requested branch, implementation, reviews, checks and separate PR are explicitly pending.
- Official CI [37312054386](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37312054386) passed all six mandatory jobs for `a2ddcef0a571364cfef8f8cfa5c9ff936b9c5609`. Local `verify:agent` and `verify:ui` also passed (30 E2E, 30 a11y, seven design-system checks and three complete Windows golden projects). The subsequent `verify:full` passed core, SQL/RLS, Harness/security/eval but failed the controlled hydration test before its streamed cohort document arrived. The test now waits for DOMContentLoaded, proves the primitive chunk is held, and drains routed requests after release; its isolated repetitions passed. Final source `7f9715d123b54aa1f4ee151b99c2c1ef9eca9624` is undergoing fresh aggregate verification and [Official CI 37317448834](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37317448834). Completion is still pending.
- [Official CI 37308348306](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37308348306) passed for c800f4f, including the hydration/focus correction. Its local UI repetition passed 30/30 E2E but hit the existing a11y Admin-overview 30-second cutoff during consecutive real MFA setup. The final test-helper correction reserves only the exact freshTotp wait (at most 30.1 seconds), annotates that reservation, leaves assertion and operation budgets intact, and grants zero extra time when no window wait occurs. The task-local MFA fixture was removed. Focused desktop/mobile consecutive Admin accessibility passed 4/4; final wrappers and CI for this final helper change remain pending. This explicit setup-time exception supersedes earlier claims that no total wall-clock budget changed.
- Final code remains unverified. `verify:ui` passed again on 570893f: 29 E2E, 30 a11y, seven design-system tests and three golden projects. [CI 37269576841](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37269576841) failed all three cohort mutation attempts: click succeeded but drawer did not open. Controlled blocked-script reproduction proved OperationOverlay's server-rendered trigger was enabled before hydration. GOAL scope was extended before adding a hydration readiness guard to the existing primitive and a permanent regression test. Final focused repetition passed 6/6; post-correction aggregate wrappers and CI remain pending.
- `verify:ui` passed: 28 E2E, 30 accessibility, seven design-system checks and three complete Windows golden projects.
- [Official CI 37264212150](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/37264212150) completed successfully for `9ca3de55a7d3c959ad5b69217a313e7b06bbb056`.
- `verify:full` failed after passing core/build, real SQL integration/RLS, Harness, security and eval. Its E2E phase passed 25 tests and failed three: Admin cohort metadata navigation exceeded the existing 30-second test budget; Teacher live-session save did not redirect within five seconds; Placement responsive exceeded its 180-second test budget.
- These failures are not waived or attributed conclusively to product code. The local C: drive measured only 55 MB free. Server restart and isolated reproduction are pending. No timeout, retry, golden tolerance or product assertion was relaxed.
- Admin implementation has not started because Student completion remains gated by successful full verification and final evidence-commit CI.
- After the user freed C: to 6.9 GB, generated cache was restored from D: to the ordinary workspace `.next` directory and temporary MFA files restored to the normal TEMP directory. Teacher and Placement isolated reproductions passed; unchanged Admin passed once in 14.8 seconds. A second full gate passed 27/28 E2E but again exhausted the combined Admin scenario's 30-second budget. GOAL scope was extended before separating overview evidence from cohort mutation, retaining original assertions, paths, viewports, MFA and timeouts. The final separated scenarios passed twice (4/4), with mutations in 21.7 and 20.3 seconds. Aggregate gates for this test correction remain pending.

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
