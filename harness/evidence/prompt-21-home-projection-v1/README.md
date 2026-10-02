# P21 — Home definitiva / Student Home Projection V1 evidence

Status: done / verified  
Branch: `feat/p21-home-projection-v1`  
Baseline: `main@556bf0f21566e6af47b03b2026b5cfbbba4e0d59`  
Verified implementation head: `a4def7c55943961face164cf411247f11f4dca1a`  
Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/25

## Architecture and behavior

- `/home` is a read-only Student projection over Learning, Practice and
  Schedule, with curricular Progress derived from the same Learning facts.
- One request-scoped authenticated context shares the verified Student auth
  state and one normal Supabase server client between the Student layout and
  Home.
- Independent Learning, Practice and Schedule reads start concurrently.
- Home owns only composition/priority. Learning keeps lesson/progress truth;
  Practice keeps `recommendPractice`; Schedule owns booked-session reads;
  Progress keeps curricular completion semantics.
- The deterministic primary-action priority is:
  1. own BOOKED session happening now;
  2. most recently accessed incomplete lesson;
  3. canonical first incomplete lesson;
  4. existing Practice recommendation;
  5. own future BOOKED session.
- Multiple courses never become a global average. The focus course follows the
  selected Learning action or the latest real curricular activity.
- Practice Home reads exclude full activity content/answer payloads and reuse
  the existing recommendation policy with a narrow candidate projection.
- Schedule Home reads return only the authenticated Student's own BOOKED
  session facts required by the projection.
- Empty, partial, error and unauthorized states remain distinct; a failed
  domain is never converted into an empty domain.
- Home introduces no write command, migration, RLS relaxation, service-role
  runtime path, CEFR inference, streak, goal, commercial rule or parallel
  recommendation engine.

## Verification

Verified implementation head
`a4def7c55943961face164cf411247f11f4dca1a` passed Official CI #394:

- Official CI:
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36952067156
- Preview artifact:
  https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36952067156/artifacts/11204268174
- Artifact digest:
  `sha256:8f39c44f6ad471cbab4a3300cf073532254188001d5725d9963d64a0f9839b59`

Observed green jobs:

- Supply Chain: PASS.
- Quality: PASS, including format, lint, typecheck, unit tests, integration
  tests, Harness invariants, security invariants and production build.
- Database: PASS, including migration policy and two clean migration replays.
- Guardrail Simulations: PASS.
- Preview: PASS, including real DB integration/concurrency, RLS,
  observability, canonical fixture, Critical E2E, persistence/analytics,
  accessibility, Storybook, design-system visuals and product golden visuals.
- CI Gate: PASS.

The aggregate verification aliases were also run green during final validation.
Official CI #394 independently exercises their constituent core/security/UI/DB
gates on the verified implementation head.

## Visual evidence

- The first stable P21 golden run correctly failed because the approved Home
  redesign no longer matched the prior short Learning-only Home baselines.
- Actual desktop/tablet/mobile screenshots from Preview were downloaded and
  manually inspected before promotion.
- The inspected Home preserves the approved hierarchy: dominant next action,
  compact curricular progress, Agenda context, Learning continuation and
  Practice recommendation.
- No visible clipping, horizontal overflow, broken responsive grid or fake
  unsupported CEFR/streak/meeting affordance was observed.
- Only the three Home Linux goldens were promoted:
  - `tests/visual/goldens/desktop/home-linux.png`
  - `tests/visual/goldens/tablet/home-linux.png`
  - `tests/visual/goldens/mobile/home-linux.png`
- Golden tolerance was not loosened.

## Failure/correction history

- Initial Official CI stopped at Prettier formatting. Canonical formatting was
  corrected without behavior changes.
- Architecture review found duplicate request auth/client creation; Home and
  Student layout now share a cached request-scoped server context.
- The Agenda RPC excludes sessions that already started, so Schedule gained a
  narrow own-booking read boundary instead of Home querying Schedule tables
  directly.
- Practice initially loaded full activity content and duplicated catalog reads;
  the recommendation input projection was moved into Practice and stripped to
  the fields required by the existing ranking policy.
- Home initially recomputed curricular summary locally; it now reuses the P20
  `buildCurriculumView` projection over the already-loaded Learning facts.
- Stateful canonical E2E initially retried against mutated Practice/booking
  data. The journey was made retry-safe and assertions were scoped to the
  intended session.
- After completing Vocabulary, the correct deterministic next recommendation
  is `Present simple em contexto`; the Home E2E now asserts that real policy
  output rather than a stale pre-completion recommendation.
- Product golden failure was accepted as expected evidence, actual images were
  inspected, and only then were Home baselines updated.

## Scope audit

- Final `main...feat/p21-home-projection-v1` contains no new or edited
  database migration.
- No Home write path, service-role runtime client, entitlement mutation,
  booking mutation, assessment authoring, Teacher/Admin feature, CEFR policy,
  streak/goal or billing behavior was added.
- Practice and Schedule changes are narrow read-boundary extractions required
  to prevent Home from duplicating those domains.
- PR #25 targets `main`, remains open and is intentionally unmerged.
