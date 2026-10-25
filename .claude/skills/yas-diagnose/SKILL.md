---
name: yas-diagnose
description: Diagnose a suspected Yas English Lab bug or workflow failure read-only, using the right specialized subagent and source-of-truth contracts.
argument-hint: "[problema ou fluxo]"
disable-model-invocation: true
---
Investigate: $ARGUMENTS

Treat this entire turn as read-only: no edits, DB reset, installs, snapshots, commits, deployment or remote mutations.
1. Check local git branch/status and inspect `AGENTS.md`, relevant code, docs and Harness state with minimal context.
2. Route to `yas-scout` only when useful; then to ONE appropriate domain subagent (or `yas-auditor` for cross-domain gaps).
3. Trace the observed symptom to the real source of truth and verify against implementation/tests; classify BUG CONFIRMADO / GAP / HIPÓTESE / DECISÃO EM ABERTO.
4. Supply exact file:line, reproduction strategy, affected flows and priority; separate evidence from guesswork.
5. Recommend a minimal fix and the tests that would prove it; do not implement it.
