# Five a11y failures — 2026-10-03

## Triage

Exactly one joint Laya decide call used 15 flat enum fields (failure_origin, likely_layer, next_investigation for each failure). It returned fixture_environment / teacher_loading_component / inspect_loading_role_and_axe_node for all five. Next-investigation confidence was 0.0006–0.0131. These inconsistent hypotheses were rejected using direct evidence; Laya was not called again.

## Proven causes

| Failure         | failure_origin           | likely_layer                                                  | next_investigation / evidence                                                                                                                                            |
| --------------- | ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Teacher P21 Axe | implementation_semantics | TeacherLoading in src/app/(protected)/(teacher)/loading.tsx:6 | Original Axe node matches the component exactly. axe-before.json reproduces the prohibited attribute on that markup in Chromium.                                         |
| Student desktop | test_synchronization     | streamed Suspense content before reveal                       | dom-before.json first probe showed inactive focus on the connected select. dom-slow-frame.json proves hidden S:0 ancestor and focus remaining on BODY.                   |
| Student mobile  | test_synchronization     | streamed Suspense content before reveal                       | Natural attempt 3 and controlled slow-frame probe show hidden S:0, inactive select and same connected node after reveal.                                                 |
| Teacher desktop | test_synchronization     | streamed Suspense content before reveal                       | Controlled slow-frame probe shows hidden S:0 textarea, atomic native focus false; Tab reaches Teacher brand instead of confidence. Once visible, Tab reaches confidence. |
| Admin mobile    | test_synchronization     | streamed Suspense content before reveal                       | Natural attempt 1 and controlled probe show hidden S:0 select, failed focus; Tab reaches admin menu instead of filter. Once visible, Tab reaches filter.                 |

No disabled/inert controls, target-route redirects or pageerror/hydration errors occurred. Handles remained connected; IDs remained unchanged. Visibility, not node replacement, is causal. Expected native Tab order is present in the page source and settled browser observations. Teacher controls are adjacent textarea/select; Admin controls adjacent select/button. Assessment has no autofocus effect.

React's node_modules/react-dom/cjs/react-dom-server.node.development.js completeBoundaryScript queues S:0 through $RC/$RB and reveals it through $RV on a frame/timer; the server-stream node is discoverable while hidden. Next's bundled loading.md documents automatic Suspense wrapping. Playwright focus invokes focusNode without a visibility actionability check. Presence/load completion is insufficient for this operation.

dom-before.json contains natural observations. dom-slow-frame.json widens the existing reveal window by delaying animation-frame callbacks in a diagnostic browser only. Its fixed observation sleeps are not test synchronization and are absent from the corrected tests. probe.mjs preserves this controlled reproduction. original/ preserves all five original error-context files (error-context.md is an extra copied snapshot).

## Minimal correction

Add role=status to TeacherLoading while preserving aria-busy and its accessible name (WAI-ARIA status permits naming from author). Add toBeVisible before the three initial focus operations in placement.spec.ts; preserve all existing focus, Tab and Axe assertions and their timeouts. Native controls and design remain unchanged.

## Validation

Exactly npm run test:a11y executed once after corrections: exit 0; 28 passed, 0 skipped, 0 failed (4.0m). All 14 desktop and 14 mobile scenarios passed, including all five originally failing scenarios. No verify:full, commit, push, registry verified changes, dependencies, workflows, migration or RLS edits.

git-diff-stat.txt contains the complete working-tree stat, including changes already present at entry. Correction-only stat: src/app/(protected)/(teacher)/loading.tsx 7 ++++++-; tests/a11y/placement.spec.ts 3 +++; 2 files changed, 9 insertions, 1 deletion. Harness records and diagnostic scripts are evidence, separate from this product/test correction. All tracked screenshot changes and supabase/tests/placement.sql were already present at entry and were preserved. test:a11y generated ignored test-results output; its .last-run.json reports passed and failedTests: []. No screenshot baseline was updated by this task.
