# P21 — Home definitiva / Student Home Projection V1 evidence

Status: done / verified  
Branch: `feat/p21-home-projection-v1`  
Implementation head: `0b80af3945c21ebcbc6f208c6625fae97e3df9ff`  
Pull request: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/25

## Result

- `/home` is a read-only transversal Student projection over Learning,
  Practice and Schedule, with curricular Progress derived from the same
  Learning facts.
- Student layout and Home share one request-scoped authenticated Supabase
  context.
- Independent domain reads begin concurrently.
- Home owns composition/priority only; Learning, Practice, Schedule and
  Progress remain the authoritative domain boundaries.
- Primary priority is singular and deterministic:
  current own BOOKED/SCHEDULED session → Learning resume/next lesson → existing
  Practice recommendation → future own booking.
- Multiple courses are never collapsed into a global average.
- Practice recommendation reuses `recommendPractice` with a narrow read model
  that excludes full activity content.
- Schedule's Home read is bounded to the authenticated Student, BOOKED booking,
  SCHEDULED referenced session, `ends_at > now`, referenced `starts_at`
  order and `limit(1)`.
- BOOKED rows linked to CANCELLED/COMPLETED sessions are explicitly covered by
  the canonical fixture and do not surface in Home.
- No Home write path, migration, RLS change, runtime service-role path, CEFR
  inference, streak, goal, commercial rule or parallel recommendation engine
  was added.

## Implementation verification

Official CI #422:
https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36956118087

Exact implementation head:
`0b80af3945c21ebcbc6f208c6625fae97e3df9ff`

Observed green jobs:

- Supply Chain: PASS.
- Quality: PASS — format, lint, typecheck, unit, integration, Harness,
  security and production build.
- Database: PASS — migration policy and two clean migration replays.
- Guardrail Simulations: PASS.
- Preview: PASS — real DB integration/concurrency, RLS, observability,
  canonical fixture, Critical E2E, persistence/analytics, accessibility,
  Storybook, design-system visual checks and product golden visual checks.
- CI Gate: PASS.

Preview artifact:
https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36956118087/artifacts/11206068526

Artifact digest:
`sha256:097dd0ba65389ddb757c76acec318985e529b2d0ddf51b8ee42cf8208fd2ac81`

## Mandatory command verification

Run:
https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36956848003

Each job explicitly checked out `0b80af3945c21ebcbc6f208c6625fae97e3df9ff` in an isolated
workspace before running the command.

- `npm run verify:agent`: PASS.
- `npm run verify:security`: PASS.
- `npm run verify:ui`: PASS.
- `npm run verify:full`: PASS.
- `npm run verify:db`: not required by P21 because the final diff contains no
  DB/SQL/migration change; the Official CI Database job still passed.

The mandatory individual test layers were also observed green through Official
CI and the aggregate commands: unit, integration, E2E, a11y and product golden.

## Visual inspection

The final Preview artifact was downloaded and inspected manually.

- Desktop: dominant next action, progress/Agenda summaries and lower
  Learning/Practice cards are readable with no visible clipping or overflow.
- Tablet: single-column hierarchy remains clear and the primary action stays
  first.
- Mobile: CTA remains dominant and full-width; cards stack without horizontal
  overflow or truncated controls.
- No unsupported CEFR, streak, meeting-entry or other invented Home fact is
  present.
- Product golden checks passed for desktop/tablet/mobile without loosening
  tolerance.

## Recovery history

The earlier P21 closure was reopened because its Harness state referenced an
older SHA while the branch had moved and temporary CI edits had polluted scope.
Those historical runs remain historical evidence only.

The recovery then:

1. restored Official CI exactly to `main`;
2. returned registry/evidence to `in_progress / verified:false`;
3. fixed the Schedule status/time/bounded-read gap;
4. added regression fixtures/assertions for CANCELLED and COMPLETED booked
   sessions;
5. obtained a clean green implementation run and literal mandatory-command
   evidence;
6. re-audited final scope before closure.

## Scope audit

At implementation verification:

- no `.github/workflows/**` diff;
- no `supabase/migrations/**` diff;
- no new Home write path;
- no runtime service-role access;
- no booking/capacity mutation change;
- no Assessment/Teacher/Admin expansion;
- no CEFR/streak/goal/commercial policy.

PR #25 remains open and intentionally unmerged.
