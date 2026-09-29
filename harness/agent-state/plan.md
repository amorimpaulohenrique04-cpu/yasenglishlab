# Agent Plan

## Active task

**prompt-10-observability**

State: implementation complete on branch; verification pending.

Goal: make critical technical failures reconstructable without mixing product analytics, observability and privileged audit history.

### Execution plan

1. Expand the existing product analytics contract without replacing its port.
2. Add provider-neutral structured logging, request/trace/span correlation, privacy redaction and a durable error sink.
3. Add request/environment/version correlation to append-only audit logs and type privileged audit actions.
4. Instrument existing high-value server boundaries: authorization, booking, protected assets, role changes, analytics persistence and audit persistence.
5. Add migration + SQL/RLS/unit/integration evidence.
6. Run an intentional error against isolated Preview Supabase and query it back by request_id.
7. Keep the definitive analytics/error-reporting provider decisions open.
8. Only mark done after final green CI and inspected evidence.

### Scope boundary

Telemetry/server boundaries, migrations, tests, CI, docs and harness state only. No new product screen or domain feature.
