# Focused database evidence

Local disposable PostgreSQL/Supabase on 127.0.0.1:55722; no production data. Migration replay and seed succeeded.

- node scripts/run-sql-tests.mjs cohort-path-admin: exit 0. Shared lesson positions 3/1, releases October 25/22, exclusion from Advanced, no conflicting membership, Basic/Intermediate ACTIVE, Advanced COMPLETED only after requirements; progress retained.
- node scripts/run-sql-tests.mjs practice-authoring: exit 0 before the added two-cohort scheduling case; complete integration/full verification is still pending for the final extension. Future practice activity/asset/RPC/recommendation denied, explicit lesson gating enforced, legacy early execution preserved.
- psql -v ON_ERROR_STOP=1 -f supabase/tests/placement.sql: exit 0. Level recommendation/filtering, wrong-level confirmation denied, justified Admin promotion preserves recommendation and assessment history, old-level meeting denied.
- node scripts/test-placement-concurrency.mjs: exit 0. Existing concurrent confirmations/retries passed; competing formal memberships and conflicting transfer retries left exactly one active membership.

Raw local logs are retained locally and excluded from Git to avoid fixture credential output and noisy transcripts. Official final results are recorded separately.
