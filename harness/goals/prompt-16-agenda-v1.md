# GOAL — prompt-16-agenda-v1: Agenda V1 / Live Session Booking

Status: done  
Owner: agent  
Created: 2026-09-30  
Updated: 2026-09-30

## Objective

Deliver Agenda V1 for Student as a projection of the existing Live domain: list relevant scheduled sessions and the student's upcoming bookings, derive availability without exposing other students, and allow server-side booking whose identity comes from `auth.uid()` while preserving the existing `private.validate_booking()` lock, entitlement and capacity guard.

## Visible result

`/agenda` uses the approved Agenda visual language and existing Design System. A student can see upcoming sessions, availability and their own next bookings, reserve an eligible non-full scheduled session, receive a stable booked state after persistence, and refresh without losing that state. No cancellation, rescheduling, attendance mutation, meeting provider or Teacher Portal is introduced.

## Relevant context

- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/LIVE_CLASSES.md`
- `docs/BILLING.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/AUTH_RBAC_RLS.md`
- `docs/SECURITY.md`
- `docs/UI_CONTRACT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/ACCESSIBILITY.md`
- `docs/ANALYTICS.md`
- `docs/OBSERVABILITY.md`
- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/reference-ui/agenda/reference.webp`
- canonical learning and Practice vertical slices
- existing Live tables, entitlement helpers, booking trigger and RLS contracts

## Acceptance criteria

- [x] `/agenda` exists, uses the StudentShell and approved visual language, and handles loading/empty/error/success.
- [x] UI/application/domain/server adapter separation follows the canonical vertical slice.
- [x] Session availability is derived as CLOSED → BOOKED → FULL → AVAILABLE; eligibility is separate.
- [x] Availability aggregates never expose another student's booking identity.
- [x] Booking accepts only `live_session_id`; ownership is derived from `auth.uid()`.
- [x] Direct INSERT into `session_bookings` remains denied to authenticated users.
- [x] Existing `private.validate_booking()` remains authoritative for SCHEDULED, entitlement and capacity and still serializes via row lock.
- [x] Duplicate booking is retry-safe and never creates a second row.
- [x] Negative entitlement, non-scheduled session, full capacity and cross-user attempts are rejected.
- [x] Real PostgreSQL concurrency with capacity=1 yields exactly one BOOKED row.
- [x] Successful persisted booking emits `live_session_booked` once with a booking-scoped idempotency key; failed booking emits no false success.
- [x] Refresh preserves BOOKED.
- [x] No plan-name authorization, credit-window policy, cancellation/remarcar/no-show, meeting provider, Teacher/Admin portal or unrelated feature is added.
- [x] Unit, integration, DB/RLS, E2E, a11y and visual evidence pass; no required gate is weakened.

## Allowed files / domains

- `src/app/(protected)/(student)/agenda/**`
- `src/modules/schedule/**`
- `src/server/schedule/**`
- `src/server/live/book-session.ts` — compatibility wrapper only: the pre-existing service-role booking path must delegate to the single P16 schedule boundary so the repository does not keep two booking implementations or duplicate audit writes.
- `src/modules/learning/ui/student-shell.tsx` (Agenda navigation only)
- `src/modules/domain/contracts.ts` only if a typed existing contract requires synchronization
- one new `supabase/migrations/**` migration for the minimum Agenda RPC/read model
- `supabase/seed.sql` only for Agenda demo/test fixtures that preserve existing commercial contracts
- `supabase/tests/**` for Agenda/booking coverage
- `tests/unit/**`, `tests/integration/**`, `tests/e2e/**`, `tests/a11y/**`, `tests/visual/**`
- existing Playwright config/scripts only where Agenda must join the official verification system
- `docs/LIVE_CLASSES.md`, `docs/DATA_MODEL.md`, `docs/ANALYTICS.md` only if executable contracts require synchronization
- `harness/**` for goal/state/evidence/registry
- `.github/workflows/foundation-verify.yml` — Preview wiring: execute the already-defined real DB/RLS suites so P16 concurrency and authorization evidence are mandatory Official CI gates rather than unexecuted files. A temporary non-final formatter diagnostic step may be used to print the canonical Prettier patch after a format-only CI failure; it must be removed before final verification and is never accepted as a passing-format evidence source.
- `scripts/verify-security.mjs` — explicit P16 exception previously required by the security gate: verify the single booking boundary uses server-side Student auth plus PostgreSQL `auth.uid()`, with no client-supplied user id or service-role booking path.

## Forbidden areas

- Teacher Portal / Admin Portal
- cancellation, rescheduling, no-show, attendance mutation, credit consumption/refund/window policy
- Zoom, Meet, WebRTC, meeting URLs/tokens/providers
- plan-name authorization or hard-coded capacity 6
- weakened RLS or direct authenticated booking INSERT
- exposing service role or booking identities of other students
- editing historical migrations
- CEFR, Practice or curricular progress behavior

## Mandatory tests

- `npm run verify:agent`
- `npm run verify:security`
- `npm run verify:db`
- `npm run verify:ui`
- `npm run verify:full`
- Agenda-specific unit/integration/DB/RLS/E2E/a11y/visual coverage
- real two-user concurrent booking against PostgreSQL with capacity=1

## Required evidence

- Exact Official CI result and job conclusions.
- SQL evidence for auth.uid ownership, entitlement denial, direct INSERT denial, no leakage and real concurrency.
- E2E evidence for booking persistence after refresh.
- Desktop/tablet/mobile screenshots inspected against the approved Agenda reference.
- Durable records under `harness/evidence/prompt-16-agenda-v1/`.

## Definition of done

Done means every applicable acceptance criterion and mandatory gate is green, evidence is inspected, the final diff is in scope, the registry is updated to `done / verified:true`, and no open product/provider policy has been inferred.


## Closure evidence

- PR #20 remains open and unmerged.
- Official CI #253 / run `36802148610` passed Supply Chain, Quality, Database, Guardrail Simulations, Preview and CI Gate.
- Real PostgreSQL concurrency proved exactly one BOOKED row for two simultaneous users at capacity=1.
- Canonical E2E passed 3/3; persistence/analytics assertion passed; accessibility passed 10/10; product golden checks passed 3/3.
- Preview artifact `11136452829`, SHA-256 `004fa095fb733331982783076932f2b5f3042bba4df3b8432343d2a2642fde4d`, was downloaded and inspected.
- Desktop/tablet/mobile Agenda screenshots were inspected directly against the approved reference.
- Durable evidence: `harness/evidence/prompt-16-agenda-v1/README.md` and `verification.json`.
