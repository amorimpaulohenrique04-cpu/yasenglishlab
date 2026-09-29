# Supabase migrations

All schema changes are versioned in this directory using `YYYYMMDDHHMMSS_slug.sql`.

Current baseline includes the domain, auth/RLS and canonical vertical-slice migrations.

Rules:

- every schema change requires a new migration;
- migrations already present on `main` are immutable; never rewrite history;
- a new migration timestamp must be newer than the committed history;
- migrations must replay successfully on an empty database;
- seed must remain reproducible/idempotent in CI;
- RLS changes require executable permission tests;
- staging and production run `supabase db push --dry-run` before applying migrations;
- production deployment never includes seed data;
- destructive changes should follow expand/contract;
- production rollback normally uses a forward-fix migration; backup/PITR is an incident procedure.

`npm run ci:migrations` enforces history discipline and `scripts/ci/replay-database.sh` validates clean replay.
