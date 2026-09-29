# Agent Plan

## Active task

**prompt-08-testing-evals**

State: completed and verified on the feature branch; ready to merge.

Goal: build the regression-prevention infrastructure around the canonical vertical slice.

### Completed execution

1. Normalized commands for unit, integration, executable SQL/RLS, E2E, a11y and visual suites.
2. Added application/server-action integration coverage without substituting mocks for real DB/RLS authorization tests.
3. Added Login/Home/Aulas axe + semantic/keyboard/focus tests.
4. Added Playwright golden tests for desktop/tablet/mobile and committed nine reviewed baselines.
5. Added executable coding-agent diff evals plus documented manual limits.
6. Proved fail-closed behavior with one deliberate failing test, then removed it and recovered to green.
7. Ran full verification, inspected artifacts, persisted evidence and marked the feature verified.

### Scope boundary

Testing/eval/docs/harness/CI only. No product behavior or UI changes.
