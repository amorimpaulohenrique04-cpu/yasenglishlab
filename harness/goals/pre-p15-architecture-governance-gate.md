# GOAL — pre-p15-architecture-governance-gate: Architectural & Governance Cleanup

Status: done  
Owner: agent  
Created: 2026-09-30  
Updated: 2026-09-30

## Objective

Close documentation and Harness inconsistencies before Prompt 15 and prove the repository governance state without implementing Practice, Agenda or any product feature.

## Visible result

The operational roadmap matches P00–P26, Harness state is internally coherent, the stale Windows tooling status is reconciled against later clean-room evidence, and the real GitHub protection state for `main` is recorded without pretending an administrative change happened.

## Relevant context

- `AGENTS.md`
- `docs/README.md`
- `docs/ROADMAP.md`
- `docs/CI_CD.md`
- `docs/ARCHITECTURE.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- `harness/README.md`
- `harness/ratchet.md`
- `harness/feature_list.json`
- `harness/agent-state/plan.md`
- `harness/agent-state/progress.md`
- `harness/evidence/windows-local-tooling/`
- `harness/evidence/pre-p13-environment-gate/`

## Acceptance criteria

- [x] `docs/ROADMAP.md` exposes the official P00–P26 sequence and makes the previous roadmap explicitly legacy/superseded.
- [x] `windows-local-tooling` is reconciled against the later PRE-P13 clean-room evidence without deleting historical failure evidence.
- [x] No completed Harness feature depends on an incomplete/blocked dependency after reconciliation.
- [x] P02–P14 remain coherent and P15 has not been created or started.
- [x] The real GitHub `main` protection/ruleset state is audited through all readable surfaces available to this integration.
- [x] `main` effectively requires PR + `CI Gate` + up-to-date branch + conversation resolution and blocks force-push/deletion.
- [x] Environment administration limitations are explicitly documented; no unverifiable environment-protection claim is used as PRE-P15 merge evidence.
- [x] Official CI passed on the gate evidence state; the final evidence-seal head is revalidated before the final report.

## Allowed files / domains

- `docs/ROADMAP.md`
- Harness goals/state/evidence/registry needed by this cleanup
- GitHub repository ruleset / branch protection / environment configuration if the integration exposes an administrative write action

## Forbidden areas

- `src/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `tests/**`
- package dependencies
- Design System or product UI
- Learning Core, Materiais, Auth/RLS, analytics, billing, Practice, Agenda, Teacher/Admin or any P15+ runtime feature
- silent weakening of CI or repository governance

## Mandatory tests

- `npm run format:check`
- `npm run verify:harness`
- `npm run verify:ratchet`
- `npm run verify:system`
- `npm run verify:agent`
- `git diff --check`
- Official CI on the PR head

## Required evidence

- Baseline SHA and final PR head.
- Before/after roadmap state.
- Branch protection and ruleset audit.
- Environment audit limitations and manual operator steps.
- Before/after `windows-local-tooling` state.
- Registry dependency audit.
- Exact changed-file list proving no product/runtime file changed.
- Mandatory gate results and Official CI result.

## Closure

Manual GitHub administration was completed by the repository operator and independently re-audited through the readable GitHub surfaces.

The active `Yas` ruleset (id `24223415`) now targets the default branch with no bypass actors and enforces deletion protection, non-fast-forward/force-push protection, pull-request merging, review-thread resolution, strict up-to-date status checks and the required `CI Gate` check. `GET /branches/main` now reports `protected: true`.

The classic branch-protection detail remains an admin-only surface for this integration, and environment administrative settings remain unreadable. Those connector limitations are recorded rather than treated as missing protection.

## Definition of done

Done. The roadmap/Harness cleanup is coherent, the required repository protection is independently observable, the gate registry is `done` / `verified: true`, and the closure head must pass Official CI before merge. P15 remains unstarted until explicitly requested.
