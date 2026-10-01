# Failure — Admin Content generic trigger and empty search_path

Classification: architecture  
Status: resolved  
Repeatable: yes  
Date: 2026-10-01  
PR/commit related: current change — prompt-18-admin-content-v1

## Symptom

Initial local seed failed in the publication trigger; focused reorder failed resolving a constraint with empty search_path.

## Evidence

supabase db reset --local reported `record old has no field lesson_id`. The first real P18 SQL suite reported `constraint modules_course_id_position_key does not exist` within admin_content_reorder. Both failures were retained and corrected before claiming verification.

## Root cause

A generic row trigger referenced a table-specific field inside a shared boolean expression. SET CONSTRAINTS used unqualified names while the privileged function deliberately had an empty search_path.

## Responsible layer

Postgres publication trigger and transactional reorder boundary.

## Immediate fix

Use a nested lesson_assets branch before resolving OLD.lesson_id. Qualify public constraint names; retain search_path='', authorization and denied direct DML.

## Permanent protection

Migration/seed replay validates all six row types. Real SQL tests exercise modules, lessons and assets reorder with exact persisted positions, negative parent permutations, authorization and audit.

## Test/eval created

supabase/tests/admin_content.sql and official migration/seed verification; scripts/run-sql-tests.mjs includes P18 in integration and RLS suites.

## Reproduction

Run the full local migration/seed chain, then psql with ON_ERROR_STOP=1 against supabase/tests/admin_content.sql.

## Before/after proof

Before: errors quoted in Evidence.

After: corrected local reset passed, focused P18 SQL passed, and integration SQL (6 files plus Agenda concurrency) and RLS (3 files) passed. Final full verification remains required for task closure.
