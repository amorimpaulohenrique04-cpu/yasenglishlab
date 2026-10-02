# GOAL — p21-p1-core-experience: Live, pedagogy and recorded learning

Status: in_progress
Owner: agent/human
Created: 2026-10-02
Updated: 2026-10-02

## Objective

Implement the approved P21.4–P21.6 plan additively. Branch: `feat/p21-p1-core-experience`. Exact main base: `78c4c689b6fbabde56083b417e7bbbfc9e302ccb`; ancestry check passed before branch creation.

## Visible result

Teacher operates sessions and reviews; Student books/cancels/rebooks/joins, submits private audio and receives feedback; Admin uploads Mux video and Student resumes using LessonProgress.

## Relevant context

`docs/TESTING.md`, `docs/DEFINITION_OF_DONE.md`, `docs/UI_CONTRACT.md`, `docs/DESIGN_SYSTEM.md`, `docs/ACCESSIBILITY.md`, `docs/SECURITY.md`, `docs/AUTH_RBAC_RLS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/LIVE_CLASSES.md`, `docs/PRACTICE_ENGINE.md`, `docs/ADMIN_CONTENT.md`, `docs/P21_FOUNDATION.md`, ADRs 0007–0009 and installed Next.js App Router guides.

## Acceptance criteria

- [ ] P21.4 sessions/availability/Join/Agenda/notifications complete.
- [ ] P21.5 audio/reviews/notes/resources/homework complete.
- [ ] P21.6 Mux ingest/webhooks/playback/captions/progress complete.
- [ ] P13–P21.3 preserved; clean replay, upgrade, concurrency and Official CI green.

## Allowed files / domains

- `src/modules/**` matching Teacher, Schedule, Practice, Learning, Admin Content and domain contracts.
- `src/server/**` matching domains, media, assets, audit/analytics/observability.
- `src/app/**` corresponding protected routes and Mux webhook.
- `supabase/**` new migrations, tests and fixtures.
- `tests/**`, `scripts/**` task verification and fixtures.
- `playwright.config.ts` test-server wiring for the P21 critical E2E provider boundary.
- `.github/workflows/foundation-verify.yml` only to execute the mandatory base-to-head upgrade gate.
- `docs/**`, `harness/**`, `.env.example`, `package.json`, `package-lock.json`.

The ignored `.env.local` had a BOM preventing Supabase CLI parsing; only UTF-8 encoding was normalized, with values preserved.

## Forbidden areas

Historical migrations; weaker authorization; duplicate progress/booking/UI; P21.7, billing, public site, notification delivery, automated meeting providers, live recordings.

## Mandatory tests

Focused unit/integration/SQL/RLS/concurrency/E2E/a11y/visual; two clean replays and upgrade; `npm run verify:agent`, `npm run verify:security`, `npm run verify:db`, `npm run verify:ui`, `npm run verify:full`; Official CI.

## Required evidence

Observed results in `harness/evidence/p21-p1-core-experience/`; no unobserved PASS or real Mux smoke claim.

## Definition of done

All loops and gates verified; PR attached, CI green, no merge. Otherwise in_progress and verified:false.
