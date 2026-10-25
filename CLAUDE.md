# Yas English Lab — Claude Code Orchestrator v2

@AGENTS.md

## Scope and truth

- This file only routes work; **AGENTS.md**, `docs/README.md`, applicable domain contracts/ADRs, and `harness/` are authoritative. Do not duplicate them here.
- Inspect local `git status` and relevant implementation before planning changes. `docs/OPEN_QUESTIONS.md` is not permission to assume unapproved behavior.
- Read only docs relevant to the task; start from `docs/README.md`. Consult `harness/feature_list.json`, goals/evidence and open blockers to determine what is actually completed.
- The codebase uses Next.js 16, TypeScript, Supabase/RLS, Vitest and Playwright. Consult installed Next.js docs per `AGENTS.md` before modifying framework APIs.

## Routing contract (applies also to normal language requests)

1. Classify the request: QUESTION, DIAGNOSE, IMPLEMENT, REVIEW, or RELEASE; select the primary domain and identify cross-domain risks.
2. Never delegate a trivial one-file edit just for delegation. For large search/log volumes use `yas-scout` (Haiku, read-only); its reply must be short.
3. For substantial tasks select **one** primary specialist, based on where the root cause actually is, not where the symptom appears:
   - React, page layout, navigation, UI/a11y -> `yas-frontend`.
   - Server Actions, API/routes, learning/practice/placement/booking domain -> `yas-backend`.
   - migrations, RLS/RBAC, Postgres, policies, Supabase data -> `yas-database`.
   - Asaas, checkout, subscriptions, entitlements/financial webhook -> `yas-billing` (wins over generic backend).
   - global gap audit or cross-domain diagnosis -> `yas-auditor` (read-only).
   - focused execution/review of tests and failures -> `yas-qa` (read-only review).
   - architectural conflict, hard concurrency/security incident after concrete evidence -> `yas-architect` (Opus, read-only; rare).
4. Route when doing so materially reduces context or adds needed domain expertise. Do not spawn agents for their own sake. At most one **writing** specialist at a time; never allow concurrent edits of overlapping files. Up to two independent **read-only** specialists only if their investigations are genuinely separate. Do not start Agent Teams by default.
5. A delegation prompt must include GOAL/task ID if available, file/domain scope, exact question or acceptance criteria, constraints, and required output. Do not paste full docs, logs, source files or chat history.
6. Every specialist returns a concise handoff: confirmed findings with file:line, work performed, commands/results, unresolved uncertainties, and suggested next step. Recheck claims against code/evidence; do not accept confident guesses.
7. The main Claude remains accountable for integration, scope, evidence and sign-off. Subagent completion is NOT task completion.

## Safety and cost

- DIAGNOSE/AUDIT means **read-only**. Do not edit, reset DB, run snapshot-update, commit, push, merge or deploy unless explicitly authorized by task.
- Follow `harness/GOAL.template.md` and state tracking before nontrivial code changes. Do not modify previously applied migrations; use additive migration if approved. Protect secrets and AAL2/roles/RLS.
- Validate narrowly first: relevant unit/integration test -> necessary typecheck/lint -> domain gate(s). Preserve mandatory `verify:agent`, `verify:security`, `verify:db`, `verify:ui`, `verify:full` when applicable. Never dilute, skip, auto-update goldens or rewrite tests merely to turn them green.
- `verify:full` is the release-grade gate; do not run on every investigation, and do not mark a task/release fully verified when its mandatory gate has not passed.
- Work on Windows/PowerShell: inspect ports, Docker/Supabase status before local resets; historical port 3000 conflict should be checked rather than assumed.
- Prefer targeted `rg` / file sections over reading entire repository; return a summary, not raw log dumps. Avoid persistent background loops and unattended expensive runs.
- Never commit secrets or disclose provider/customer data in logs/evidence.

## Final response

Task | specialist(s) used (or why none) | files changed | checks PASS/FAIL/NOT RUN | real blockers/risks | smallest next action. No fabricated verification.
