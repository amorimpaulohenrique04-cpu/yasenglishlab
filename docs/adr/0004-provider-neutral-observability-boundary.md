# ADR 0004 — Provider-neutral observability boundary

Status: accepted  
Date: 2026-09-29

## Context

Yas needs structured logs, request correlation, error reporting and traces before the definitive external observability provider is chosen. `docs/OPEN_QUESTIONS.md` explicitly leaves the exact error-reporting/tracing stack unresolved.

Coupling application services directly to Sentry/OpenTelemetry/a vendor at this stage would turn an open product/infrastructure decision into hidden architecture.

## Decision

Introduce a server-only observability boundary with:

- typed technical error taxonomy;
- request/trace/span context;
- privacy sanitizer;
- structured runtime logs;
- `ObservabilitySink` interface;
- Supabase-backed bootstrap sink for persisted technical errors;
- span helper for critical server operations.

The bootstrap sink is not the final vendor decision. External collectors must be added behind `ObservabilitySink`.

Product analytics stays behind `ProductAnalyticsPort`. Audit history stays in append-only `audit_logs`.

## Consequences

Positive:

- critical failures become inspectable now;
- provider lock-in is avoided;
- CI can prove end-to-end telemetry locally;
- product analytics/audit remain semantically separate.

Trade-off:

- when the primary database is fully unavailable, the Supabase sink may also be unavailable. Structured runtime logs therefore remain mandatory and an external collector should be selected before production scale requires independent failure storage.

## Rejected

- Use analytics events as error logs.
- Use audit logs as generic observability storage.
- Pick an external vendor without resolving the open question.
- Swallow sink failure silently.
