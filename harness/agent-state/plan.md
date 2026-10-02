# Agent Plan

## Active task

**prompt-21-home-projection-v1**

State: done / verified:true.

Branch: `feat/p21-home-projection-v1`.

### Discovery findings

1. P20 is present in `main` as `done / verified:true`.
2. The former Home depended only on Learning and implicitly selected
   `courses[0]`.
3. Learning owns curricular ordering/completion and persisted
   `lastAccessedAt`.
4. Practice owns deterministic `recommendPractice`.
5. Schedule owns Student booking facts; Home must not reproduce booking or
   entitlement rules.
6. Progress owns the curricular projection; Home reuses it from already-loaded
   Learning facts instead of loading the full Progress page.
7. The approved Home screenshot is visual hierarchy only; unsupported CEFR,
   streak and meeting-entry affordances remain absent.

### Delivered architecture

1. Home has its own read-only application/domain projection with explicit
   success/empty/partial/error states and one deterministic `primaryAction`.
2. Student layout and Home share one cached request-scoped authenticated
   Supabase context.
3. Learning, Practice and Schedule reads begin concurrently.
4. Practice exposes a narrow recommendation input projection without full
   activity content; the existing `recommendPractice` policy remains
   authoritative.
5. Schedule exposes a narrow own-BOOKED-session read boundary, including
   sessions already in progress.
6. Home curricular summary reuses P20 `buildCurriculumView` over the same
   Learning facts.
7. Home has responsive server-rendered UI plus dedicated loading/error states.
8. Canonical unit/integration/E2E/a11y/golden coverage verifies priority,
   resume semantics, bounded reads, DTO minimization, responsive behavior and
   navigation to owning domains.

### Verification state

Verified implementation head:
`a4def7c55943961face164cf411247f11f4dca1a`.

Official CI #394 / run `36952067156` passed Supply Chain, Quality, Database,
Guardrail Simulations, Preview and CI Gate. Preview passed Critical E2E,
persistence/analytics, accessibility, Storybook/design-system visuals and
product golden visuals.

Durable evidence:
`harness/evidence/prompt-21-home-projection-v1/`.

PR #25 targets `main`, remains open and unmerged.
