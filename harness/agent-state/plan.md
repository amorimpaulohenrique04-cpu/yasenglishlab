# Agent Plan

## Active task

**prompt-12-engineering-system-1-0**

State: remediation in progress; independent audit findings are being converted into permanent guards before final verification.

Goal: make the Yas Engineering System 1.0 internally consistent and fail-closed for continuous Codex/GPT development without adding product features.

### Findings being corrected

1. The root README and module/style maps still described pre-system foundation states.
2. Persistent Harness state still claimed PROMPT 11 was awaiting merge after it was already on `main`.
3. The feature registry omitted implemented engineering milestones that later entries depended on.
4. The official local `verify:ui` command did not execute critical-flow accessibility or product golden regression tests.
5. These failure classes lacked a single executable audit contract preventing recurrence.

### Remediation

1. Update stale documentation maps without changing product behavior.
2. Reconcile the feature registry with the implementation that exists and has current green CI evidence.
3. Make `verify:ui` execute Storybook build, E2E, a11y, design-system visual and product golden checks.
4. Add `verify:system` and wire it into Harness verification.
5. Register repeatable audit failures in the Ratchet with controlled red→green proof.
6. Run Official CI, inspect evidence, then close PROMPT 12 only from verified state.

### Scope boundary

Allowed: documentation maps, Harness state/evidence/failure records, verification scripts and package scripts.

Forbidden: product feature behavior, UI redesign, database schema changes, RLS changes, provider selection and production feature implementation.
