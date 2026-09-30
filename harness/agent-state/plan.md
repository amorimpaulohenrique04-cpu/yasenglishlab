# Agent Plan

## Active task

No active task.

## Last completed

**windows-local-tooling**

State: complete and verified locally; full verification prerequisites recorded as unavailable.

Result: Windows/Linux verification runners now use shell-free npm/native execution, Git enforces LF, and controlled regression evidence covers Windows paths containing spaces without changing product behavior.

### Verified protections

1. `.gitattributes` makes LF independent of local Git configuration.
2. npm runs through Node + `npm-cli.js`; native tools run directly without shell parsing.
3. `verify:platform` rejects the former Windows invocation and proves Windows/Linux specs plus a real path-with-spaces execution.
4. Ratchet records and durable verification evidence cover both reproduced failure classes.
5. Mandatory local gates, including `verify:agent`, passed without DEP0190.
6. `verify:full` prerequisites are explicitly recorded in task evidence.

### Scope boundary preserved

No product feature behavior, approved visual design, database schema, migration, RLS policy, auth/domain contract, provider decision or golden changed.
