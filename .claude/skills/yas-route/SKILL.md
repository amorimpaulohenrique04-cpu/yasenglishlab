---
name: yas-route
description: Manually route a Yas English Lab task to the smallest appropriate specialist while respecting scope, risks and token budget.
argument-hint: "[descreva a tarefa]"
disable-model-invocation: true
---
Task: $ARGUMENTS

1. Read the routing contract in `CLAUDE.md` and the minimum needed from `AGENTS.md`.
2. State classification, affected domain, primary agent and whether code changes are authorized. For diagnosis, stay read-only.
3. If no agent is worthwhile, handle directly. Otherwise delegate only the narrowly scoped portion, naming the agent explicitly and passing required acceptance criteria and file scope. Use `yas-scout` first only if a search is needed.
4. Keep no more than one writing agent active. If a domain changes, return to the orchestrator before delegating to the next.
5. Validate evidence and integrate the result; report specialist, file:line, PASS/FAIL/NOT RUN and next action. Do not run `verify:full` for exploratory work.
