# Supabase migrations

All schema changes are versioned in this directory using `YYYYMMDDHHMMSS_slug.sql`.

Current baseline:

- `20260929035100_create_domain_contracts.sql` — initial Yas domain model from PROMPT 05.

Rules:

- migrations must be replayable on an empty database;
- do not edit an already-deployed migration to change product behavior; add a new migration;
- preserve historical assessment/billing semantics;
- RLS must stay enabled on public tables;
- authorization policies are added in their dedicated task.
