# Agent Plan

## Active task

**prompt-14-materials-v1**

State: in_progress.

### Immediate plan

1. Reuse existing Material/Favorite/RLS/signed-URL/analytics contracts without schema or policy changes unless a proven blocker appears.
2. Build a small Materials application/repository boundary for authorized deterministic listing, contextual search/filter and idempotent favorite state.
3. Add `/materiais` UI and shared navigation using existing primitives/tokens; intentionally omit Recents because no durable non-analytics access-history model exists.
4. Open protected assets through a server route that re-authorizes, creates the short signed URL and emits minimized analytics only after successful access.
5. Add deterministic seed/test storage fixtures and unit/integration/E2E/a11y/visual coverage.
6. Run official gates, inspect evidence, then close Harness state only if the complete system is green.

### Result

Implementation and verification pending.

### Scope boundary

No admin/CMS, provider selection, public-storage bypass, analytics-as-state, RLS weakening or unrelated product work is permitted.
