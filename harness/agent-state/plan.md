# Agent Plan

## Active task

**stage-01-enrollment-core**

Base `22b0562eaf308fabd363107feeecb639a126484e`; branch `feat/stage-01-enrollment-core`.

1. Reconcile P21 checks separately from real Mux smoke.
2. Add Placement domain/migration/RLS, schedule and capacity invariants.
3. Add application/adapters, onboarding/Assessment, Teacher review, choice, Admin and Home.
4. Prove tests/evidence, run gates, commit/push/PR and inspect CI.

# Agent Plan

## Active P21 P1 — 2026-10-02

Goal: `harness/goals/p21-p1-core-experience.md`. Base `78c4c689b6fbabde56083b417e7bbbfc9e302ccb` verified.
Implement operations/Agenda first, then private audio/human review/notes/resources, then Mux ingest/playback and LessonProgress. Verify replays/upgrade, DB/Auth/Storage, concurrency, E2E/a11y/visual and all gates; push/PR and inspect Official CI without merging.
Defaults: one video per Lesson; manual external meeting; human rubric v1; Mux recorded video; Join -15/+15 minutes; audio 25 MiB and 5-minute playback; checkpoints 15 seconds.

## Planejamento P21 P0 — 2026-10-02

Pedido atual limitado a plano, sem implementação. Base local/remota confirmada:
`94b574b40b8b05ed798f996294d2297ba92b5e31`.

GOAL: `harness/goals/p21-p0-foundation-closure-plan.md`.
Plano detalhado: `harness/plans/p21-p0-foundation-closure.md`.
P21.1/P21.2/P21.3 permanecem planned / verified:false; gates não executados.
O registro histórico de P21 abaixo foi preservado.

## Historical active task

**p21-p1-core-experience**

State: done / verified:true. Branch: `feat/p21-p0-foundation-closure`. All local gates passed; user waived waiting for final CI. PR #30, no merge.

1. P21.1 resolver, Student boundary and focused Auth tests.
2. P21.2 snapshots, transactional quota/cancellation/rebooking and focused real DB tests.
3. P21.3 cohorts, commands/RLS and focused tests.
4. Integration pass, docs/ADRs, final aliases, commit/push/PR and Official CI.

Approved plan: `harness/plans/p21-p0-foundation-closure.md`.

## Previous P21 closure

State: done / verified:true.

Branch: `feat/p21-home-projection-v1`.

### Delivered correction

1. Restored `.github/workflows/foundation-verify.yml` exactly to `main`;
   P21 has no workflow or migration diff.
2. Kept the request-scoped shared auth/client, deterministic Learning resume,
   existing Practice recommendation and P20 curricular projection.
3. Corrected Schedule's Home read to accept the same explicit clock used by
   Home and return only the authenticated Student's own BOOKED booking whose
   referenced live session is SCHEDULED and has not ended.
4. Bounded the Schedule read at PostgreSQL/Data API: referenced start ordering
   plus `limit(1)`, so Home reads only the current/next applicable booking.
5. Added canonical regression fixtures for BOOKED rows linked to CANCELLED and
   COMPLETED sessions and proved they never surface in Home while the valid
   SCHEDULED current session remains primary.
6. Preserved one `primaryAction`, partial/error semantics, minimal Practice
   inputs, no global course average and no Home writes.

### Verification

Implementation head:
`0b80af3945c21ebcbc6f208c6625fae97e3df9ff`.

Official CI #422 / run `36956118087` passed:

- Supply Chain;
- Quality: format, lint, typecheck, unit, integration, Harness, security, build;
- Database: migration policy + two clean replays;
- Guardrail Simulations;
- Preview: DB integration/concurrency, RLS, observability, canonical E2E,
  persistence/analytics, a11y, Storybook, design-system visuals and product
  goldens;
- CI Gate.

Mandatory aliases were then executed literally in isolated jobs that explicitly
checked out the same implementation SHA. Run `36956848003` passed
`verify:agent`, `verify:security`, `verify:ui` and `verify:full`.

Preview artifact `11206068526` was inspected. Home desktop/tablet/mobile
preserve the approved hierarchy without visible clipping/overflow; product
goldens passed unchanged on the corrected implementation.

Durable evidence:
`harness/evidence/prompt-21-home-projection-v1/`.

PR #25 remains open against `main`; no merge was performed.
