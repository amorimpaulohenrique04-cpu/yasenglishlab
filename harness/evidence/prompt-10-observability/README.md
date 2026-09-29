# PROMPT 10 — Observability evidence

Verified: 2026-09-29

## Final verification

- Official CI: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36640424406
- Branch head tested: `fcbfddc1864fa328b48334f0ba960d6a58934c32`
- Result: Supply Chain, Database, Guardrail Simulations, Quality, Preview and CI Gate = success.
- Preview artifact: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/36640424406/artifacts/11066198006
- Artifact ID: `11066198006`
- Artifact digest: `sha256:977c02f170ef79eeab4af0a8d87a2dfa1ac5881c7ef999468970d77750e82788`
- Artifact retention at creation: 14 days.

## Intentional technical-error proof

The downloaded Preview artifact was inspected directly. `artifacts/observability/intentional-error.json` contains:

```json
{
  "confirmed": true,
  "request_id": "f5d71b45-61d7-4df3-b2f9-59496c8df690",
  "trace_id": "f5d71b45-61d7-4df3-b2f9-59496c8df690",
  "span_id": "788aceaf-3166-4a4e-b55d-465af4fb4d15",
  "error_code": "database_error",
  "stage": "ci.intentional_error",
  "impact": "request_failed",
  "environment": "preview",
  "version": "d5e446c5fb29069f9101b83cf6298b1613060725"
}
```

The matching structured log was also inspected. It preserves the same correlation identifiers, error code, stage, impact and preview version. The ISO timestamp remains intact and an absent user ID is omitted instead of serialized as a fake value.

The `version` above is the exact ephemeral PR merge SHA executed by Preview; the workflow artifact metadata records branch head `fcbfddc1864fa328b48334f0ba960d6a58934c32`.

## Database/security evidence

The same final CI run proved:

- new migration policy passes;
- migrations apply on two independent clean PostgreSQL databases;
- `observability_contracts.sql` passes;
- `observability_events` is append-only;
- `anon`/`authenticated` have no direct access to the technical sink;
- product analytics taxonomy migration is valid;
- audit correlation columns exist;
- secret scan and security invariants pass.

## Privacy regression evidence

Unit/security checks cover:

- password/token/authorization/cookie/secret/payment/private audio/assessment responses redaction;
- email/phone masking;
- ISO timestamps are not mistaken for phone numbers;
- release/preview SHA identifiers are not modified by PII masking;
- absent optional identity context is not stringified as `"undefined"`.

## Decision boundary

No external analytics or observability vendor was selected. `docs/OPEN_QUESTIONS.md` remains authoritative for the future product-analytics and error-reporting/tracing provider decisions. ADR 0004 only establishes a provider-neutral boundary.
