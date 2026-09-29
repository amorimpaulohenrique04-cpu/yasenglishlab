# Agent Plan

## Active task

**prompt-09-cicd-environments**

State: in progress.

Goal: create the official safe CI/CD pipeline and environment contract for Yas English Lab.

### Execution

1. Harden supply-chain, secret and migration-discipline verification.
2. Replace the foundation workflow with the official PR/main CI.
3. Add isolated preview plus optional environment-scoped remote preview adapter.
4. Add staging and production release workflows with migration and release gates.
5. Document environment/secrets/branch-protection/rollback policy.
6. Simulate valid PR, failing test, invalid migration and detectable secret.
7. Verify final branch, open PR, merge only after green checks, and verify main.

### Scope boundary

CI/CD, operations, security, docs, scripts and harness only. No `src/**` product change.
