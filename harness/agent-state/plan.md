# Agent Plan

## Active task

**prompt-03-harness-engineering**

Goal: install the official minimal, explicit and verifiable Harness Engineering layer without implementing product features.

### Scope

Allowed:

- `AGENTS.md`
- `harness/**`
- `scripts/**`
- `package.json`
- `.github/workflows/foundation-verify.yml`

Forbidden:

- Product screens/components beyond existing foundation placeholders.
- Product domain implementation.
- Database schema/business tables.
- Billing/auth feature implementation.

### Plan

1. Add short agent map.
2. Add goal/state/registry/evals/evidence/failure-log contracts.
3. Add cross-platform verification commands.
4. Integrate deterministic harness checks into CI.
5. Run clean verification.
6. Inspect evidence and record outcome.
7. Mark registry done only after verification.
