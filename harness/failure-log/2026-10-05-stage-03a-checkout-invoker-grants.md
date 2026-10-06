# Stage 03A — invoker read grants

Classification: permission
Status: resolved
Repeatable: yes
Date: 2026-10-05
PR/commit related: current Stage 03A change

## Symptom

service_role reservation RPC failed on a required read.

## Evidence

Red evidence: real PostgreSQL SQL test under service_role failed `permission denied for table user_roles` inside reserve_billing_checkout. BYPASSRLS does not grant SELECT privileges.

## Root cause

BYPASSRLS does not grant table SELECT privileges.

## Responsible layer

Database grants for the server-only invoker RPC.

## Immediate fix

Explicit service_role SELECT(user_id,role) on user_roles and SELECT on plans; keep SECURITY INVOKER, client grants revoked and RLS enabled.

## Permanent protection

Permanent protection: supabase/tests/billing_checkout.sql executes the real reservation as service_role, verifies anon/authenticated RPC/table denial and snapshot/reuse semantics. Registered in both SQL suites and clean migration CI discovers it automatically.

## Test/eval created

supabase/tests/billing_checkout.sql asserts execution under service_role and denial under authenticated.

## Reproduction

Run the focused SQL against the migration without explicit service-role read grants.

## Before/after proof

Before: real SQL raised permission denied for table user_roles.
After: focused SQL rerun passed after exact grants. No RLS/security weakening.
