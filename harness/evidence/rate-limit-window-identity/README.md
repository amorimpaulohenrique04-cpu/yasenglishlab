# Rate limiter window identity

Local, rollback-only against the isolated Supabase DB (schema left unchanged afterwards):

- Before (old schema): windows 84031s and 85527s share an equal `date_bin` start; second call returned hits=2.
- After (migration applied in the same transaction): same pair returns hits=1; full `supabase/tests/rate_limit.sql` passes (ends in ROLLBACK, no error).
- Test also asserts two distinct `window_seconds` rows per bucket/key (time independent) and the new column list.

Deploy note: legacy rows become `window_seconds = 0` and are ignored; in-flight counters restart once (at most one extra window of attempts per key).

Pending: `npm run verify:db`, official CI Database job.
