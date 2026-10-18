# GOAL — rate-limit-window-identity: Rate limiter counters keyed by window length

Status: in_progress
Owner: agent
Created: 2026-10-18
Updated: 2026-10-18

## Objective

Stop distinct window lengths from sharing one `rate_limit_counters` row when their `date_bin()` starts coincide, with an additive migration and a time-independent regression proof.

## Acceptance criteria

- [x] New migration only; no published migration edited.
- [x] Counter identity includes `window_seconds`; legacy rows stay inert, no inference of legacy durations.
- [x] `supabase/tests/rate_limit.sql` fails on the old schema behaviour and passes on the new (local rollback-only run).
- [ ] Official CI Database job green on the PR.

## Allowed files / domains

`supabase/migrations/20261018140000_rate_limit_window_identity.sql`, `supabase/tests/rate_limit.sql`, harness records.

## Forbidden areas

App code, fail-open policy, limits/buckets, other migrations.

## Mandatory tests

`npm run verify:db` plus the official CI Database job.
