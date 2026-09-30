# Yas Engineering Harness

The harness makes long-running coding-agent work explicit, inspectable and resumable without turning agent prompts into a second codebase.

> Model proposes. System executes. Evidence proves. Persistent state records.

## Official loop

Every non-trivial task follows this order:

1. **Read objective** — instantiate `GOAL.template.md`.
2. **Discover minimum context** — use `AGENTS.md` to open only relevant docs.
3. **Inspect existing implementation** — search before creating.
4. **Plan a small change** — update `agent-state/plan.md`.
5. **Implement** — stay inside allowed scope.
6. **Verify** — run mandatory task checks.
7. **Inspect evidence** — do not rely on command exit code alone when visual/security behavior matters.
8. **Correct if necessary** — failures are information, not success.
9. **Ratchet repeatable failures** — use `ratchet.md` to convert relevant recurring failure classes into permanent guards.
10. **Record decision** — only durable/non-obvious choices belong in decisions/ADR.
11. **Update progress** — feature registry + progress/failure log must match reality.
12. **Conclude only then** — run behavioral evals and report verified state.

## Starting a task

1. Copy the structure of `GOAL.template.md` into the task/issue/working note.
2. Give it a stable kebab-case ID.
3. Add/update the matching entry in `feature_list.json` as `planned` or `in_progress`.
4. Declare allowed/forbidden areas before editing.
5. Link the minimum relevant docs.
6. Put the immediate execution plan in `agent-state/plan.md`.

A coding agent should never begin by asking “what files should I create?” if the repository can answer that through existing implementation/docs.

## Finishing a task

A task may become `done` only when:

- acceptance criteria pass;
- mandatory checks pass;
- required evidence was inspected;
- applicable behavioral evals pass;
- decisions/progress are persisted;
- blockers/TODOs are registered;
- `feature_list.json` says `status: done`, `verified: true`, and includes evidence.

## Verification commands

```bash
npm run verify:agent
npm run verify:ratchet
npm run verify:security
npm run verify:db
npm run verify:ui
npm run verify:full
```

- `verify:agent`: foundation + harness + security + DB structural checks.
- `verify:ratchet`: repeatable-failure contract + controlled red→green proof.
- `verify:security`: server/client secret-boundary checks and high-confidence secret scan.
- `verify:db`: migration/seed discipline.
- `verify:ui`: approved-reference presence + Storybook build + Playwright E2E.
- `verify:full`: complete agent verification including UI.

Use `scripts/*.sh` on Bash systems or `scripts/*.ps1` on PowerShell.

## Example GOAL

A maintenance task could start as:

```md
# GOAL — update-storybook: Update Storybook patch version

## Objective

Upgrade Storybook within the current major without changing product behavior.

## Visible result

The repository uses the selected patch version and Storybook builds cleanly.

## Relevant context

- docs/adr/0001-foundation-stack.md
- package.json
- .storybook/

## Acceptance criteria

- Lockfile is deterministic.
- Storybook production build passes.
- Existing E2E remains green.

## Allowed files / domains

- package.json
- package-lock.json
- .storybook/**
- harness state/evidence

## Forbidden areas

- src/modules/**
- product UI behavior

## Mandatory tests

- npm run verify:agent
- npm run verify:ui

## Required evidence

- CI URL and version diff.

## Definition of done

Checks are green, evidence inspected, registry/progress updated.
```

The example is process guidance only; it does not schedule or implement that upgrade.
