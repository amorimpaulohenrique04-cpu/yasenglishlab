# Failure — legacy practice reach assignments

Classification: architecture

Status: open

Repeatable: yes

Date: 2026-10-21

PR/commit related: current change codex/level-based-cohorts

## Symptom

The first full gate passed core, SQL integration, RLS and concurrency but stopped in setup-canonical-e2e with SQLSTATE 23514: Assignment requires compatible course and lesson release rule.

## Evidence

harness/evidence/level-based-cohorts/verify-full.log captures the failure at scripts/setup-canonical-e2e.mjs.

## Root cause

The existing reach mechanism legitimately assigns a COURSE practice to a cohort to allow early execution. The new assignment integrity trigger incorrectly required ASSIGNED for every legacy writer.

## Responsible layer

PostgreSQL assignment integrity, shared with legacy reach and Teacher authorship.

## Immediate fix

Validate assignment course through existing path_content_info (explicit or inferred course). Preserve COURSE reach assignments without new scheduling flags; scheduling stays explicit on ASSIGNED activities.

## Permanent protection

Existing practice_authoring.sql now inserts a legacy COURSE reach assignment, verifies its compatible course and rejects unsupported scheduling semantics on it.

## Test/eval created

supabase/tests/practice_authoring.sql, plus unchanged canonical setup exercised by verify:full.

## Reproduction

Run npm run verify:full on a clean local stack; the fixture prepares a COURSE audio-practice assignment before E2E.

## Before/after proof

Before: verify-full.log failed at fixture setup after all SQL gates passed.
After: pending final full gate; record stays open until inspected.
