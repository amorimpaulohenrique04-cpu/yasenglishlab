# PRE-P15 architecture & governance gate evidence

## Baseline

- Repository: `amorimpaulohenrique04-cpu/yasenglishlab`
- Baseline branch: `main`
- Baseline SHA: `d57bf780f1b5d5eafd55700c58f4462c29277020`
- Baseline commit message: `chore: format prompt 14 closure evidence`
- Working branch: `chore/pre-p15-architecture-governance-gate`

## Roadmap audit

Before this gate, `docs/ROADMAP.md` still exposed the superseded P0–P19 sequence as active, including placements that contradicted the current operational Prompt 02–14 history.

After this gate, the active roadmap is the requested P00–P26 sequence, including the billing/site/hosting policy gates. The old sequence is retained only under `Legacy roadmap — superseded`. Existing principles were preserved: source-of-truth before projections, Home after its source domains, continuous security, evidence before the next phase and no invented answers for `OPEN_QUESTIONS.md`.

## Windows local tooling normalization

Before:

- `harness/feature_list.json`: `windows-local-tooling = in_progress`, `verified = false`.
- its original evidence correctly recorded that `verify:full` had not run because Supabase CLI, `psql`, Playwright Chromium and Docker-access prerequisites were incomplete.
- `progress.md` already claimed the task had moved to done, creating an internal contradiction.
- the dependent `pre-p13-environment-gate` was already `done` / `verified: true`.

Later proof:

- `harness/evidence/pre-p13-environment-gate/verification.json` validates Docker, Supabase CLI, `psql` and Chromium;
- migrations + seed, DB integration, RLS, E2E, accessibility, Storybook visual and golden visual all passed;
- clean-room `npm run verify:full` returned exit code 0.

After:

- `windows-local-tooling = done`;
- `verified = true`;
- its GOAL is closed;
- the registry references the PRE-P13 evidence that closes the original missing prerequisite;
- the original `windows-local-tooling/verification.json` and both historical failure logs remain unchanged.

## Harness coherence audit

Baseline programmatic audit found exactly one invalid completion dependency:

`pre-p13-environment-gate (done) -> windows-local-tooling (in_progress)`.

After normalization, no completed feature depends on an incomplete or blocked dependency. Every local evidence path referenced by the registry exists. P02 through P14 remain `done` / `verified: true`.

No `prompt-15-practice-engine` registry entry exists, no P15 GOAL exists, and the pre-task plan closed P14 with the explicit instruction not to start P15. This gate itself depends only on `prompt-14-materials-v1`.

## GitHub main-protection audit

Readable surfaces were checked independently rather than treating one missing endpoint as absence of protection:

1. `GET /branches/main` reports:
   - `protected: false`;
   - protection `enabled: false`;
   - required status-check enforcement `off`.

2. Classic branch-protection endpoint:
   - `GET /branches/main/protection` returns `403 Resource not accessible by integration`.
   - This integration therefore cannot use that admin-only surface as proof or as a write path.

3. Repository rulesets:
   - one ruleset found: `Yas`;
   - id: `24223415`;
   - target: `branch`;
   - enforcement: `disabled`;
   - rules: `deletion` and `non_fast_forward` only;
   - bypass actors: none.
   - It does **not** require a pull request, `CI Gate`, branch up-to-date or conversation resolution.

4. Required check existence:
   - the baseline SHA has a successful GitHub Actions check named exactly `CI Gate`;
   - because `main` is unprotected and the only ruleset is disabled, this proves the check exists but not that GitHub requires it before merge.

5. Environments:
   - the Release workflow defines `staging` and `production`;
   - the baseline Release run completed successful `Staging` and `Production` jobs targeting those environment names;
   - the connector rejects the repository environments settings endpoint, so required-reviewer and deployment-branch restrictions cannot be administratively proven from this integration.

## Protection state before / after

Before: non-compliant.

After this repository-only cleanup: unchanged / non-compliant.

No branch-protection/ruleset/environment mutation is claimed because the connected GitHub toolset contains only read access for those administration surfaces. There is no administrative write action to invoke.

## Manual GitHub administration required

Repository operator must configure GitHub before this gate can pass:

1. Open `https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/settings/rules`.
2. Edit/replace ruleset `Yas` (id `24223415`) for `main` and set enforcement to **Active**.
3. Require a pull request before merging.
4. Require status check **CI Gate**.
5. Require the branch to be up to date before merging.
6. Require conversation resolution.
7. Keep deletion blocked.
8. Keep non-fast-forward updates/force pushes blocked.
9. Do not add bypass actors. Add at least one approval only when a real second reviewer is available without deadlocking the current solo-maintainer flow; dismiss stale approvals when that review model is enabled.
10. Open `https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/settings/environments`.
11. Verify `staging` and `production` deployment branches are limited to `main`.
12. Configure `production` with required reviewer approval when an eligible reviewer exists and the repository plan/settings support it.
13. Re-read `/branches/main` and the active ruleset after saving; the gate may move to done only when effective protection is independently observable.

Existing ruleset page reported by GitHub: `https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/rules/24223415`.

## Product-architecture diff boundary

Expected changes are limited to documentation and Harness governance. No changes are permitted in `src/**`, `supabase/migrations/**`, `supabase/tests/**`, `tests/**`, package dependencies, Design System or feature runtime.

## Final-state note

A Git commit cannot contain its own SHA as file content without changing that SHA. The immutable final PR-head SHA is therefore recorded in the pull request/final operator report after the evidence commit is created. `verification.json` records the baseline, branch and all deterministic state needed to resolve that head.

## Current conclusion

`PRE-P15 GATE BLOCKED — MAIN PROTECTION REQUIRES MANUAL CONFIGURATION`

No P15 product implementation was started.
