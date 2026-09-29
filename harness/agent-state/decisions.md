# Harness Decisions

## H-001 — AGENTS.md is a map, not a second manual

Detailed product/engineering rules remain in `docs/`; `AGENTS.md` only routes an agent to the correct source and commands.

## H-002 — Deterministic checks use Node

Bash and PowerShell files are thin wrappers. Cross-platform verification logic lives in Node scripts so Windows, macOS and Linux evaluate the same rules.

## H-003 — Persistent state must not overclaim

A task can be `done` only with `verified: true` and non-empty evidence in `harness/feature_list.json`. Product features that do not exist are not pre-populated as done.

## H-004 — Behavioral evals complement automated checks

Some questions (for example duplicate UI semantics or scope justification) require contextual review. Automated scripts validate structural/security/database invariants; the behavioral rubric validates agent conduct and evidence quality.
