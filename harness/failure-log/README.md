# Failure Log

Record unresolved failures/blockers that affect a task's conclusion.

Create one file per durable blocker:

```text
YYYY-MM-DD-<task-id>-<short-name>.md
```

Include:
- observed failure;
- reproduction command;
- impact;
- evidence/log link;
- attempted fixes;
- next action/owner;
- whether the task is blocked.

Resolved failures remain in history when they teach a reusable engineering constraint; otherwise summarize the resolution in `agent-state/progress.md`.
