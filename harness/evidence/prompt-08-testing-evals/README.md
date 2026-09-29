# PROMPT 08 — Testing & evals evidence

Status: verified.

## Green verification

- Final pre-completion infrastructure run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36600933280
- Recovery run after removing the deliberate regression: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36599878827
- `verify`, `database-contracts`, `canonical-slice-e2e` and `full-verification` all concluded `success`.
- Full verification result: core + DB integration + RLS + E2E + a11y + visual all passed.

Observed full-gate counts:

- unit: 16 passed;
- application/server-action integration: 6 passed;
- integration SQL: 2 files passed;
- RLS authorization SQL: 1 file passed;
- canonical E2E: 2 passed;
- critical-flow a11y: 4 passed;
- Storybook visual/a11y: 6 passed;
- product golden projects: 3 passed.

## Deliberate red → green proof

- Intentional regression run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36599772400
- Red head: `f4d459e4ecdcff13d8ce7fabbf6c9523068cd85a`.
- A temporary unit test intentionally asserted `"regression-detected" === "regression-allowed"`.
- The workflow concluded `failure`; both `verify` and `full-verification` failed.
- The artificial test was then deleted; recovery run https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36599878827 concluded `success` in all four jobs.

## A11y and visual evidence

Full-verification artifact:

- name: `prompt-08-full-verification`
- artifact id: `11049114031`
- source run: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36600933280
- persisted reports: `artifacts/a11y/results.json` and `artifacts/golden/results.json`.

Report stats inspected:

- a11y: expected 4, unexpected 0, skipped 0, flaky 0;
- golden: expected 3, unexpected 0, skipped 0, flaky 0.

All nine committed golden PNGs were downloaded from the CI artifact and visually inspected:

- desktop: Login, Home, Aulas;
- tablet: Login, Home, Aulas;
- mobile: Login, Home, Aulas.

No clipping, overlap or obvious responsive regression was observed in the approved baselines.

## Scope audit

The final branch diff against `main` contains only CI, docs, harness, scripts, Playwright configs and tests. No `src/**` product behavior/UI file was modified.

Post-merge `main` CI is verified after merge and reported with the final delivery.
