# Failure — pre-existing rate-window collision blocks billing PR

Classification: architecture
Status: open
Repeatable: yes
Date: 2026-10-17
PR/commit related: https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/pull/83

## Symptom

Official CI Database failed in its second clean replay at `supabase/tests/rate_limit.sql:92`; Preview and CI Gate consequently failed. No merge is permitted.

## Evidence

Run https://github.com/amorimpaulohenrique04-cpu/yasenglishlab/actions/runs/39081037545 for head d2fd068ef3188d314150969b2349afa4685db2ad. At 2026-10-18 00:00:09 UTC, the 3600-second call returned hits=6 instead of 1 after five 60-second calls with the same bucket/key. Client date is 2026-10-17 (America/Sao_Paulo).

Local rollback-only reproduction against the isolated 56322 database selected two distinct valid durations with equal date_bin starts: 10s and 3370s. The second call returned hits=2 instead of 1. The transaction rolled back; no schema or persistent data changed.

## Root cause

The existing `rate_limit_counters` primary key is `(bucket,key_hash,window_start)` and `consume_rate_limit` conflicts on that key, omitting window duration. Different durations can yield identical window_start values, including 60/3600 seconds during an hour's first minute. Both the migration and SQL test are unchanged from the green baseline 8ef0965436e98ab7bb8c2473f63d04d0345282f8.

## Responsible layer

Existing migration `20261014100000_stage_07b_rate_limit.sql` and the counter identity contract; outside this PR's reconciliation scope. This is separate from the explicitly excluded fail-open policy decision.

## Immediate fix

Keep PR #83 in draft, report failed CI and preserve all gates. No retry to hide the time-dependent failure; no published migration, rate limiter, SQL test or workflow edited.

## Permanent protection

Unresolved. A dedicated design must preserve live legacy counters while separating window identities; a new migration and deterministic temporal regression proof are needed. Do not infer legacy durations or silently reset counters in this billing patch.

## Test/eval created

No production/test change for this out-of-scope issue. The existing `supabase/tests/rate_limit.sql` detected the failure. The rollback-only diagnostic dynamically groups durations by date_bin start, chooses a pair and invokes the existing RPC twice to reproduce the collision.

## Reproduction

In a transaction, group generate_series(10,86400) by date_bin(make_interval(secs => duration),now(),'2000-01-01 00:00:00+00'). Choose a group with two durations, consume once for each using one synthetic bucket/key, observe hits=2, then rollback. The existing 60/3600 test also reproduces during the first minute of an hour.

## Before/after proof

Before: Official CI failed with hits=6; local deterministic collision returned hits=2.

After: Not fixed; remains OPEN/BLOCKED to preserve PR 1 scope and avoid unsafe migration assumptions.

## Update 2026-10-18 — fix

PR #83 was merged without touching the limiter (its CI passed in a window where the collision did not occur). Fix: additive migration `20261018140000_rate_limit_window_identity.sql` adds `window_seconds` to the primary key; `supabase/tests/rate_limit.sql` now asserts the identity deterministically and reproduces an equal-`date_bin` pair dynamically. Legacy rows (`window_seconds = 0`) are inert and cleaned by the existing cleanup; counters in flight restart once. Local before/after: old schema windows 84031 and 85527 gave hits=2; new schema gives hits=1.
