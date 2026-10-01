# Evidence — prompt-16-agenda-v1

## Result

Agenda V1 is implemented and verified on PR #20 without merging to `main`.

- Branch: `feat/agenda-v1`
- Implementation head: `14b577729aeafcd7986d7da35903499e4ebb5adc`
- Official CI: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36802148610
- Run number: 253
- Conclusion: `success`
- Preview merge ref/version: `fb401e0a5743b944571714bfef2fbc83a2a5ab11`
- Evidence artifact: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36802148610/artifacts/11136452829
- Artifact SHA-256: `004fa095fb733331982783076932f2b5f3042bba4df3b8432343d2a2642fde4d`

## Architecture and security evidence

Agenda remains a projection of the existing Live domain. No parallel availability table or client-owned capacity rule was introduced.

The append-only P16 migration adds:
- `public.get_agenda_sessions()`: authenticated Student-only aggregate read model with session metadata, aggregate booked count, spots remaining, the current user's own booking only and entitlement boolean.
- `public.book_live_session(uuid)`: accepts only the Live session id, derives ownership from `auth.uid()`, requires the durable Student role and serializes retries/competing users on the session row before inserting.

The existing `private.validate_booking()` trigger remains authoritative for SCHEDULED state, entitlement and capacity. Direct authenticated INSERT into `session_bookings` remains denied. The pre-P16 service-role booking helper now delegates to the single authenticated Agenda boundary instead of keeping a second mutation path.

Executable SQL evidence proves:
- missing entitlement is rejected;
- non-scheduled booking is rejected;
- capacity is enforced;
- retry returns the same persisted booking without a second row;
- another student's booking id is not leaked by the aggregate read model;
- direct authenticated INSERT remains unavailable;
- the RPC has no user-id argument;
- ownership persists as the authenticated `auth.uid()`.

## Real concurrency

Preview ran the real PostgreSQL integration suite and then `scripts/test-schedule-concurrency.mjs`.

Observed log:

`✓ Agenda real concurrency passed: two concurrent users, exactly one BOOKED.`

The integration SQL suite passed 4 files and the RLS suite passed separately. Capacity=1 therefore has executable two-connection proof rather than a mock-only assertion.

## Product behavior and analytics

The canonical E2E passed 3/3 and exercises Agenda in the real app flow.

It proves:
- Student loads `/agenda`;
- only entitled scheduled session is reservable for the canonical START fixture;
- successful booking persists;
- UI becomes BOOKED/Reservado;
- page refresh keeps BOOKED;
- upcoming reservations show only the current student's booking.

The post-E2E assertion printed:

`Canonical E2E persistence and analytics evidence passed.`

It requires exactly one `live_session_booked` event for the canonical booking and verifies the idempotency key is `live_session_booked:<persisted_booking_id>`. Failed application booking tests emit no false success event.

## Automated verification

Official CI #253 completed every mandatory job successfully:

- Supply Chain — success
- Quality — success
- Database — success
- Guardrail Simulations — success
- Preview — success
- CI Gate — success

Quality passed canonical formatting, lint, typecheck, unit tests, integration tests, Harness invariants, security invariants and production build.

Agenda-specific application evidence includes 4 unit tests and 5 integration tests. Preview passed real DB integration/concurrency, RLS, Critical E2E, persistence/analytics, accessibility, Storybook visual checks and product golden checks.

Accessibility artifact result: 10 expected, 0 unexpected, 0 flaky.

Product golden artifact result: 3 expected, 0 unexpected, 0 flaky.

## Visual inspection

The approved reference at `docs/reference-ui/agenda/reference.webp` was inspected directly before implementation and again before closure. Its visual hierarchy was treated as reference, not as permission to invent unsupported calendar/practice/event features.

The final artifact screenshots were opened and inspected directly:

- `artifacts/canonical-slice/agenda-desktop.png`
- `artifacts/canonical-slice/agenda-tablet.png`
- `artifacts/canonical-slice/agenda-mobile.png`

Observed result:
- desktop keeps the approved purple/lilac/white visual language, Agenda heading, date navigation, primary schedule area and upcoming-reservations side rail;
- tablet collapses the side rail below the schedule without overlap or clipped cards;
- mobile becomes a single-column schedule with readable cards and a horizontal date strip; the scrollable strip is keyboard focusable and uses the Design System focus token;
- BOOKED, AVAILABLE and entitlement-blocked states remain visually distinguishable;
- no full calendar matrix, practice scheduler, event system, meeting URL/provider or unsupported quick-link behavior was invented.

## Failures found and corrected

The verification history was intentionally not hidden:

1. Official CI #225 / run `36799009100` failed canonical formatting only. Files were formatted without semantic changes.
2. Official CI #243 / run `36800056945` exposed a stale security invariant tied to the old service-role booking implementation. The verifier was updated to assert the stronger P16 contract: server Student auth + PostgreSQL `auth.uid()`, no client user id and no service-role booking path.
3. Official CI #245 / run `36800176546` found canonical E2E regressions from contaminating shared commercial fixture state while demonstrating Agenda entitlements. The fixture was isolated so existing Materials/Practice behavior stayed intact, while entitlement denial remains proven in Agenda-specific DB/unit coverage.
4. Official CI #251 / run `36801564871` found Axe `scrollable-region-focusable` on the mobile date strip. The actual scroll container was made keyboard-focusable with the existing Design System focus token.
5. Official CI #253 / run `36802148610` passed every mandatory job and produced the inspected final artifact.

## Scope audit

Final `main...feat/agenda-v1` diff was inspected. Runtime scope is limited to the Agenda/schedule vertical slice, the single booking/read-model migration, minimal canonical test/CI wiring, Student navigation, the compatibility booking wrapper and the security/DB verifiers required to make those contracts executable.

No Teacher/Admin portal, cancellation, rescheduling, no-show, attendance mutation, credit-window policy, meeting provider, CEFR logic or curricular-progress behavior was added.

PR #20 remains open and unmerged by design.
