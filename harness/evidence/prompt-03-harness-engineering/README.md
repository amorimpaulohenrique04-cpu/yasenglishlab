# Evidence — prompt-03-harness-engineering

Verified on GitHub Actions:

- Normalized full run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36510847571
- Final read-only run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36511078068
- Clean dependency install: passed.
- Foundation verification: passed.
- Vitest foundation test: 1 passed.
- Next.js production build: passed.
- Harness contract: 18 required paths validated; registry contract validated.
- Security boundary: 8 source files checked; no high-confidence committed secret pattern found.
- DB structure: valid; no product migrations exist yet.
- Approved UI references: 8 present.
- Storybook production build: passed.
- Playwright Chromium E2E: 1 passed.

The first harness run failed at canonical formatting. That failure was corrected using the repository's pinned Prettier and is recorded in `harness/agent-state/progress.md`. No check was weakened to obtain a green result.

The final read-only run used `contents: read`, `npm ci`, no auto-format step and no repository mutation before verification.
