# Failure — Admin Teachers service-role retry fixture

Classification: test gap
Status: resolved
Repeatable: yes
Date: 2026-10-04
PR/commit related: PR #33, `feat/stage-02-operations`

## Symptom

Official CI Database failed in `supabase/tests/admin_teachers.sql` while the fixture was running as `service_role`. Its retry assertion selected `public.teachers`, a table that role is intentionally not granted permission to read.

## Evidence

PR #33 run `37213468368`, Database check `111469259654`, failed at the retry assertion with `permission denied for table teachers`. The locally corrected SQL suite passes against the migrated Supabase database.

## Root cause

The local suite had been run as the database owner, masking an invalid assumption in the role-scoped fixture. The product's service-only RPC permission boundary was correct; the test crossed that boundary with an unrelated direct table read.

## Responsible layer

The Admin Teachers SQL integration fixture.

## Immediate fix

Capture the UUID returned by the first reconciliation RPC call with `psql` `\\gset`, compare the service-role retry result to that captured value, then `RESET ROLE` before table-count and audit assertions. Re-enter `service_role` only for the expected missing-identity RPC denial.

## Permanent protection

The SQL test proves retry identity from the RPC result itself, then verifies table state only after `RESET ROLE`. No product grant, RLS policy, function privilege, or service-role boundary was broadened.

## Test/eval created

The existing registered `admin-teachers` SQL/RLS suite now verifies service-role retry idempotency while respecting its table privileges.

## Reproduction

Run PR #33 Database check `111469259654` from `37213468368`, or run the prior test revision against PostgreSQL as `service_role`; the direct table subquery fails. Run `DATABASE_URL=local:55322 node scripts/run-sql-tests.mjs admin-teachers` after this correction to verify the fix.

## Before/after proof

Before: Official CI failed on the direct `teachers` read as `service_role`.  
After: the focused SQL/RLS suite passes locally; the corrected Official CI run remains pending.
