# Failure Log

Use this directory for relevant failures that teach a reusable engineering constraint, block a task, or expose a meaningful process/system gap.

Create one durable record per failure using this filename pattern:

YYYY-MM-DD-<task-id>-<short-name>.md

Start from TEMPLATE.md.

## Required fields

Every durable record captures:

- symptom;
- evidence;
- root cause;
- responsible layer;
- immediate fix;
- permanent protection;
- test/eval created;
- date;
- related PR/commit;
- deterministic reproduction and before/after proof.

Primary classification must be one of: context, tool, environment, state, architecture, security, ui contract, test gap, observability, permission, dependency, agent behavior.

## Resolution rule

A repeatable failure cannot be marked resolved without meaningful permanent protection, a test/eval and red-to-green proof. npm run verify:ratchet enforces this contract.

Non-repeatable external incidents may use None — <reason> for permanent protection/test, but the reason must be explicit. Unknown/unproven cases remain open or accepted-risk.

See ../ratchet.md for the full loop and harness-review process.
