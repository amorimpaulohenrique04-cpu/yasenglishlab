# ADR 0009 — Cohorts V1 and compatible authorization

## Status

accepted — 2026-10-02

## Date

2026-10-02

## Context

Student enrollment, commercial entitlement, Teacher assignment and session ownership already have distinct contracts. Cohorts must extend operational grouping without replacing those authorities.

## Decision

Add course-scoped cohorts, temporal Student membership episodes and temporal Teacher links. A membership requires an existing ACTIVE enrollment for the same course and STUDENT role; it never creates enrollment or entitlement. Cohorts use PLANNED, ACTIVE and ARCHIVED states. `live_sessions.cohort_id` is nullable and legacy sessions remain compatible.

ADMIN+AAL2 manages cohorts through an authenticated command RPC with derived actor and transactional minimal audit. Authenticated direct DML remains denied. Student reads own membership and eligible sessions, never another cohort's roster. Removing a membership prevents new bookings immediately while retaining own booking history. Teacher scope is the union of existing temporal direct assignments and active shared cohorts, always TEACHER+AAL2. Session roster/attendance remains tied to `live_sessions.teacher_id`.

## Consequences

No automatic legacy session assignment or roster migration occurs. Archived cohorts block new eligibility. Cohort links cannot bypass subscription entitlements. Existing Practice, Assessment, progress and Home contracts retain their read boundaries. Structural cohort edits with dependent memberships/sessions are rejected. New session management and provider choices remain outside P21.1–P21.3.

## Alternatives

Replacing direct assignments would break legacy Teacher scope. Mandatory cohort backfill would invent historical grouping. Using cohort membership as enrollment/paid access would conflate separate authorities. All were rejected.

## Validation

`supabase/tests/cohorts.sql` exercises real RLS and command authorization, own history, foreign session isolation, revocation and direct-assignment compatibility. Canonical browser fixtures isolate cohorts from established visual references.
