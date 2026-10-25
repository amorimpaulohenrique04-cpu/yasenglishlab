# PR #89 — CI recovery F01–F04

Reference HEAD: `02c06b1daea19970867ba4c0afd79f18c949f9d2`.
Runs: [pull request](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/40166442125),
[push](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/40166440160).
All four Preview artifacts from both runs were downloaded and their reports inspected.
Final official validation is pending; feature remains in_progress / verified:false.

## Failure matrix

| Failure                         | Evidence / cause                                                                                                                                                                                                                                                                                                                                    | Correction                                                                                                                                                                                 | Permanent proof                                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01: eval scope                 | Both Quality jobs name precisely mobile/tablet `home-linux.png`. Earlier promotion omitted those paths from the active goal.                                                                                                                                                                                                                        | Declare the two exact paths in the historical certification scope. No PNG bytes changed.                                                                                                   | `eval:agent`, harness/ratchet and official golden suite.                                                                                                                                                                                                                                       |
| F02: placement axe              | PR run: desktop, five nodes (avatar, Grammar, Speaking, red Pendente badge, secondary button). Push run: mobile. Colors are composited during the row entrance fade; `MotionConfig reducedMotion=user` disables transforms but preserves opacity animations. `settledPage` allows initial opacity zero, so hydration can begin the fade during axe. | Queue explicitly honors reduced motion for both initial opacity and transition duration. Final colors/tokens unchanged.                                                                    | Existing placement a11y test, both viewports.                                                                                                                                                                                                                                                  |
| F03: draft button axe           | Push E2E: enabled outline label measured #827999 over #faf8fe, after autosave cleared disabled. Generic disabled opacity .55 transitions back over 150ms. PR E2E passed 55/55; push 54/55. Difference is the scan's timing during an asynchronous autosave transition, not a different data result.                                                 | Shared outline disabled state retains opacity 1 and uses AA muted text/soft surface, so re-enabling never fades an enabled label.                                                          | Storybook exercises disabled → enabled first frame, hover and focus with full motion; existing Teacher compositions still scan all viewports.                                                                                                                                                  |
| F04: persisted proof            | Both browser journeys pass canonical final submission and seven persisted responses; post-assert still requires recovered=1 and eight rows. Accepted ADR 0025 explicitly removes new reinforcement rounds.                                                                                                                                          | User confirmed following ADR 0025 on 2026-10-25. Require 6/7, itemCount=7, firstTryCorrect=6, recovered=0, missed=1, pendingManual=0 and seven unique correct-identity round-one verdicts. | Shared assertion used after browser finalization and reload against PostgreSQL, plus final post-suite proof. Fourteen unit cases reject missing/duplicate/extra/wrong-verdict/round/metrics. Existing SQL tests cover authenticated idempotent final submission and denial to another Student. |
| F05/F06: full / aggregate gates | Full stopped at eval; aggregate gates correctly propagated failed suites.                                                                                                                                                                                                                                                                           | Gates unchanged.                                                                                                                                                                           | Official CI on corrected SHA.                                                                                                                                                                                                                                                                  |

Reference report inventory: PR E2E 55 passed, a11y 33 passed/1 failed; push E2E 54 passed/1 failed,
a11y 33 passed/1 failed. Both visual artifacts: 12 golden + 8 Storybook passed, zero skipped/flaky.
Full artifacts have no later browser results because eval stopped the suite.

## First corrected CI: 1a28d35

Runs [40197095102](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/40197095102)
and [40197091192](https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/40197091192).
Quality, database, guardrails, visual (12+9), a11y (34) and real DB/RLS passed in both.
Canonical E2E persistence and analytics passed in the PR run; Teacher practices also passed.

| Additional finding                        | Cause / evidence                                                                                                                                                                                                                                                                                     | Action                                                                                                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F07: admin-cohorts document-title, PR E2E | The test asserted the old row count immediately after clicking Save. That row and the old title satisfy `settledPage` before the Server Action starts its redirect. Axe then scans the new document while metadata is being replaced. Failure occurs within 2s, not after the helper's 10s fallback. | Await the actual POST, successful result URL, saved confirmation, closed drawer and destination title for both saves before further checks. Existing full axe audit retained. |
| F08: push E2E infrastructure              | Supabase local mail container could not bind host port 55324 (`address already in use`) in setup; no E2E test ran. Other runners initialized normally.                                                                                                                                               | Record separately from product failures. A new corrected SHA receives a fresh complete matrix. No test retries, skipped assertions or gate changes introduced.                |

## Visual baseline review

Compared existing expected/actual mobile Home and tablet diff in
`harness/evidence/ci-recovery-teacher-sessions/goldens/`.
The recommendation changes from Cumprimentos (8 min) to Vocabulário (5 min), as expected from
lesson-bound access and the existing tie-break under ADR 0025. Layout is preserved.
These are the exact PNGs previously reviewed/promoted in 02c06b1, and both reference visual jobs pass.
Retained deliberately; no baseline update/regeneration in this correction.

## Local evidence

- Before correction: extracted old persistence predicate fails the new seven-final-answer acceptance
  and accepts the obsolete 8-row proof (2 red / 12 green).
- After correction: 14/14 proof cases pass; canonical fixture isolation 2/2 passes.
- `eval:agent`: 10/10 passes with exact baseline paths declared.
- Harness, ratchet, security and DB structural verifiers pass.
- TypeScript, focused ESLint and format check pass. Storybook build passes; Chromium outline
  suite passes 9/9 with full-motion regression (first enabled frame, hover/focus and axe).
- Reviewed `outline-before.png` / `outline-after.png` show the real shared disabled styles.
  A separate browser reproduction loaded CSS directly from 02c06b1 and from this correction:
  the first sampled enabled frame had opacity 0.640016 before and 1 after
  (`outline-first-frame.json`). The old label faded exactly as reported in CI; the fixed label
  retains AA text color while transitioning from saving. Final CI pending.
- The bare `npm` shim points at a missing roaming npm-cli.js. Invoking the installed Node npm-cli.js
  directly works; no repository dependency/script change is needed.
- Storybook initially hit sandbox directory access; retry uses normal installed runtime with escalation.
