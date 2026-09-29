# GOAL — prompt-10-observability: Observability, analytics and auditability

Status: in_progress  
Owner: agent/human  
Created: 2026-09-29  
Updated: 2026-09-29

## Objective

Install an executable, privacy-aware telemetry boundary that keeps product analytics, technical observability and durable audit history separate while making critical server operations correlatable by request, trace, user reference, environment and version.

## Visible result

A developer can trigger an intentional technical error in Preview, locate the persisted event by request_id and recover error code, stage, impact, environment/version and trace/span without user testimony.

## Relevant context

- `docs/ANALYTICS.md`
- `docs/OBSERVABILITY.md`
- `docs/AUDIT_LOG.md`
- `docs/SECURITY.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/ARCHITECTURE.md`
- `src/server/analytics/supabase-product-analytics.ts`
- `src/server/audit/write.ts`
- `src/server/auth/guards.ts`
- `src/server/live/book-session.ts`
- `src/server/assets/signed-url.ts`

## Acceptance criteria

- [ ] Official product-event taxonomy is executable and documented.
- [ ] Structured logs include request/trace/span/environment/version context.
- [ ] Critical error codes are typed and persisted separately from analytics/audit.
- [ ] Privileged audit actions are typed, append-only and request-correlated.
- [ ] Passwords, tokens, payment credentials, private audio, assessment responses and secrets are redacted.
- [ ] Preview CI proves an intentional error reaches the real isolated observability sink.
- [ ] SQL/RLS/security/unit/integration/build gates remain green.
- [ ] No external analytics/observability provider is invented while OPEN_QUESTIONS remains unresolved.

## Allowed files / domains

- `src/server/observability/**`
- `src/server/analytics/**`
- `src/server/audit/**`
- existing server boundaries instrumented by this task
- request/proxy correlation
- `src/modules/domain/contracts.ts`
- `supabase/migrations/**`
- `supabase/tests/**`
- tests, verification scripts, CI, docs and harness evidence

## Forbidden areas

- New product pages or user-facing features.
- Selecting PostHog, Sentry or another definitive external provider.
- Logging sensitive payloads for debugging.
- Weakening RLS/auth to make telemetry work.

## Mandatory tests

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run verify:security`
- `npm run verify:db`
- clean migration replay + SQL/RLS in Official CI
- `OBSERVABILITY_LIVE_TEST=1 npm run test:observability:live`
- `npm run build`
- existing Preview E2E/a11y/visual gates

## Required evidence

- Green Official CI URL.
- `artifacts/observability/intentional-error.json` from Preview.
- SQL contract evidence for append-only/no authenticated access.
- PR/commit diff showing separated telemetry boundaries.

## Definition of done

Done only after the final branch head has green required CI, the intentional error evidence is inspected, no sensitive payload is exposed, provider decisions remain open, and the registry/progress/evidence files match reality.
