---
name: yas-fix
description: Implement a specifically authorized Yas English Lab fix with scoped delegation, Harness discipline and targeted verification.
argument-hint: "[bug confirmado + critério de aceite]"
disable-model-invocation: true
---

Implement ONLY the authorized fix: $ARGUMENTS

1. Verify scope and working tree, then follow `harness/GOAL.template.md` / `AGENTS.md`; reuse existing architecture and tests.
2. If root cause is uncertain, first diagnose read-only. Select ONE writing specialist by domain: `yas-frontend`, `yas-backend`, `yas-database` or `yas-billing`. Do not run concurrent overlapping editors.
3. Require minimal patch, necessary regression/negative tests and a concise handoff with file:line.
4. Have the main session integrate, review diff and verify incrementally; use `yas-qa` for independent focused read-only review when risk warrants it.
5. Run every **mandatory** gate for this authorized scope. If blocked by environment, report explicitly; never bypass RLS/MFA, weaken tests, skip, update goldens without approval or mark done without evidence.
6. Do not push, merge or deploy unless explicitly requested. Output changed files, proof and remaining blockers.
