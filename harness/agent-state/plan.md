# Agent Plan

## Active task

**prompt-21-home-projection-v1**

State: in_progress / verified:false.

Branch: `feat/p21-home-projection-v1`.

### Discovery findings

1. P20 is present in `main` as `done / verified:true`.
2. Current Home depends only on `loadLearningHome()` and implicitly selects `courses[0]`.
3. Learning already owns curricular ordering/completion and persisted `lastAccessedAt`.
4. Practice already owns deterministic `recommendPractice`.
5. Schedule already exposes own booking state; Home must not reproduce booking/entitlement rules.
6. Progress V1 is intentionally broader than the Home; Home can derive its short curricular summary from Learning facts without loading `/progresso`.
7. Approved Home screenshot supplies visual hierarchy only; unsupported CEFR, streak and meeting-entry affordances must not be implemented.

### Minimum implementation plan

1. Add a Home application/domain read model with explicit section states and deterministic primary-action policy.
2. Add one server-only Home boundary: authenticate once, create one Supabase client, adapt the existing Learning/Practice/Schedule sources, then compose reads concurrently with partial-failure semantics.
3. Refactor `/home` to render the projection as a Server Component and add Home-only responsive styles.
4. Add focused unit/integration coverage for selection, priority, partial/error, non-duplication, bounded reads and no page-loader dependency.
5. Extend canonical E2E/a11y/golden expectations for the new Home semantics; change fixture only if a missing fact is required.
6. Review full diff, confirm no migration/write/RLS/service-role/plan/CEFR additions, open PR, inspect CI and correct only observed root causes.

### Verification state

All gates are pending until observed. No success claim has been made.
