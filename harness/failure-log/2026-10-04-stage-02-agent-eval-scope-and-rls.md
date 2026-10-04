# Failure — Stage 02 agent eval scope and RLS recognition

Classification: agent behavior  
Status: resolved  
Repeatable: yes  
Date: 2026-10-04  
PR/commit related: current branch `feat/stage-02-operations`

## Symptom

The agent behavioral eval rejected the Stage 02 branch because its allowed-file section described domains only in prose and because its RLS rule recognized only edits to one central SQL file, despite executable per-domain authorization suites.

## Evidence

After core, Harness, and security checks passed, `npm run verify:agent` failed `changed files stay in declared scope` for the branch's 76 files and `RLS changes include executable authorization test`. The changed `admin_cohorts.sql`, `admin_crm.sql`, `admin_teachers.sql`, `p21_core_experience.sql`, and `students_directory.sql` suites are registered in `scripts/run-sql-tests.mjs` and contain explicit role/denial assertions.

## Root cause

The GOAL used prose-only scope declarations that the evaluator's backtick/glob parser cannot consume. The RLS heuristic hard-coded `supabase/tests/rls_permissions.sql` and ignored the repository's registered domain-specific SQL authorization suites.

## Responsible layer

Harness task-scope contract and agent behavioral evaluator.

## Immediate fix

Declared concrete, scoped path globs in the Stage 02 GOAL. Updated the RLS eval to accept changed SQL authorization suites only when they are registered in the SQL runner and include role switching plus denial assertions.

## Permanent protection

The evaluator now validates executable per-domain SQL authorization coverage without requiring duplicate edits to a monolithic RLS file. Concrete GOAL path patterns are parsed and checked against the complete branch diff.

## Test/eval created

`node scripts/eval-agent.mjs` exercises the actual branch diff; `npm run verify:harness` validates the Harness and Ratchet contracts. The corrected evaluator reported all 10 proxy rules passing.

## Reproduction

Run `npm run verify:agent` on `feat/stage-02-operations` before these changes. Observe the scope and RLS rules fail while the registered focused authorization suites exist. Then run `node scripts/eval-agent.mjs` after the fix.

## Before/after proof

Before: eval failed two rules: every changed path was reported out of scope and RLS was reported untested.  
After: eval passed all 10 rules, reporting 76 changed files covered and five registered role/denial SQL authorization suites.
