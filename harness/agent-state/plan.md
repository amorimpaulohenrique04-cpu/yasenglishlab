# Agent Plan

## Active task

**prompt-08-testing-evals**

Goal: build the regression-prevention infrastructure around the canonical vertical slice.

### Execution

1. Normalize commands for unit, integration, executable SQL/RLS, E2E, a11y and visual suites.
2. Add application/server-action integration coverage without mocking real authorization policies.
3. Add Login/Home/Aulas axe + semantic/keyboard/focus tests.
4. Add Playwright golden tests for desktop/tablet/mobile and generate baselines through CI.
5. Add executable coding-agent diff evals plus documented manual limits.
6. Prove fail-closed behavior with one deliberate failing test, then remove it.
7. Run full verification, inspect artifacts, persist evidence, then mark the feature done.

### Scope boundary

Testing/eval/docs/harness/CI only. No product behavior or UI changes.
