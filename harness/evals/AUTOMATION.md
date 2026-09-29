# Coding-agent eval automation

## Executable command

`npm run eval:agent` reads the active task from `harness/agent-state/plan.md`, loads its GOAL, compares `origin/main...HEAD` by default, and exits non-zero when an automated rule fails.

CI supplies an explicit Git base/head through the checked-out history, so the result is reproducible.

## Automated

- required documentation is declared and exists;
- changed files fit declared scope;
- no newly skipped/fixme tests or generic failure suppression;
- product UI changes have visual test/evidence changes;
- schema-affecting database changes have a migration;
- RLS/policy changes update executable RLS tests;
- high-confidence secrets are absent from changed files;
- completion claims have passing verification evidence;
- feature-registry/evidence state is internally consistent.

## Partially automated / manual

Two judgments cannot be proven reliably from a diff alone:

1. whether the agent **actually understood** the documents it declared;
2. whether a newly introduced UI primitive is semantically duplicate despite a different name/shape.

The executable eval therefore refuses to call those cases automatically proven. New UI primitives require semantic review, and final completion still requires a human/agent comparison between the final report and real Git/CI state.

## Base/head override

```bash
npm run eval:agent -- --goal harness/goals/my-task.md --base origin/main --head HEAD
```

A JSON report can be persisted with `--report <path>`.
