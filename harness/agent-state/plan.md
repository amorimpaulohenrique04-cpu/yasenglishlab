# Agent Plan

## Active task

**prompt-21-home-projection-v1**

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
