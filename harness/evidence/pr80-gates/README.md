# PR #80 gate repair — 2026-10-17

Status: in progress; no release/merge approval.

Original head `0592091c47c343a0aedfbdfd8e7cf5e821a568ef`, branch `feat/practice-10-phase-0`, [PR #80](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/80), [CI #703](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/39004676948). Relevant original job excerpts: `ci-before.md`.

## Findings and corrections

1. Canonical E2E stopped after one item of seven. It now persists a partial attempt, leaves/reopens it, answers all items, deliberately misses/reinforces one, tests a failed and delayed finalize response, and confirms one result/event after completion and reload. The post-suite assertion verifies the attempt, eight item responses, score/metrics and attempt-scoped analytics key. `verify:ui` now runs the same post-check as CI/full.
2. Audio activity is tied to lesson two. The canonical cohort now receives an explicit teacher assignment (existing decision A), without modifying lesson progress or relaxing the start RPC. The a11y test follows the attempt route. A new negative E2E checks the other cohort through UI and authenticated RPC; existing SQL lifecycle negatives remain intact.
3. The player exposed completion before finalize resolved. Pending/error UI now retains saved responses and retry but withholds completion/result actions until persistence succeeds.
4. Visual compilation: all compared jobs use isolated Ubuntu runners, the same merge SHA, Node 24.21.0, lockfile and npm ci; no Next build cache is restored. A minimal Next 16.3.8 fixture with a Google CSS URL containing query parameters reproduces exactly `next/font/google queries have exactly one entry` (`font-repro-before.log`). This matches upstream [#99114](https://github.com/vercel/next.js/issues/99114) / [#100158](https://github.com/vercel/next.js/pull/100158). Vendor the exact successful build's font bytes, all subsets, existing CSS weights/ranges and fallback metrics; retain Latin preloads. SHA-256 manifest and unit regression protect those bytes. No bundler, dependency version, font design or golden tolerance changes.

## Environment and current validation

Windows, Node 24.19.0 (CI uses 24.21.0), Next 16.3.8, Supabase CLI 2.118.0. Dedicated disposable stack `yaspr80`, API 55721 / PostgreSQL 55722; existing development stacks are not reset. Runtime credentials exist only under the already ignored local artifacts directory. Full output is redacted in memory before being saved.

- Original application build: passed after using the installed npm outside sandbox restrictions (`build-before.log`). The font failure is response-dependent, not a deterministic failure of every build.
- Controlled font reproduction: failed with the same CI diagnostic (`font-repro-before.log`).
- Application build with vendored fonts: passed (`build-after.log`).
- Practice unit/application tests: 17 passed (`practice-tests.log`).
- Focused audio accessibility: 2/2 passed (`a11y-focused.log`).
- Initial canonical run: practice completion/persistence assertions passed; later lesson completion remained at 50% (`canonical-focused.log`). Investigate in an isolated sequential full run before any success claim.
- Initial SQL run after browser fixture preparation failed due to conflicting fixture IDs. Full verification runs SQL before canonical fixture preparation, against a reset disposable database. No database/test contract is weakened.
- An accidentally overlapping a11y launch was rejected by the occupied-port guard; suites thereafter run sequentially.
- Full/UI/agent gates, Linux goldens and final CI: pending.

## Scope and review

Existing Stage 12 screenshots and unrelated local files predate this task and are excluded. Browser suites can overwrite those evidence paths; their original bytes were copied to ignored local backup before the full run and must be restored afterward. No golden has been changed. Intentional Home differences still require review/approval with actual images, including Linux.

The source goal and registry remain `in_progress`, `verified: false` until required evidence exists. The default agent eval only compares commits; a final task-only Git snapshot is needed to evaluate the actual local diff instead of treating an empty HEAD-to-HEAD comparison as proof.
