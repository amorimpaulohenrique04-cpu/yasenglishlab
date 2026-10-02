# ADR 0008 — Transactional live booking usage

## Status

accepted — 2026-10-02

## Date

2026-10-02

## Context

The main booking trigger checked positive entitlement and session capacity without consuming recurring allowance across distinct sessions.

## Decision

Derive commercial usage from booking facts and immutable snapshots. Recurring windows use the session start in America/Recife: Monday week or calendar month, inclusive start and exclusive end. Resolve the current temporal entitlement at command time; snapshot its key, configuration, cadence, limit and window. NONE authorizes access without a recurring cap.

Lock session, then a transaction advisory lock for the Student, then booking. Teacher cancellation locks the session and all affected Students in UUID order. Capacity and quota are checked in the same database transaction. Two different sessions cannot spend one Student's last credit concurrently. Do not maintain a separate mutable counter.

BOOKED consumes one unit. Student cancellation before the snapshot session start releases it; late cancellation retains it. ATTENDED and NO_SHOW do not alter usage. Teacher cancellation releases it. Retry preserves the active booking UUID even when quota is exhausted; rebooking reuses the cancelled row and rechecks state, entitlement, membership, capacity and quota.

The application uses `book_live_session_result(uuid)` so a quota denial can roll back the inner mutation, persist minimal denial audit and return QUOTA_EXCEEDED. The original `book_live_session(uuid) -> uuid` remains compatible; its raised denial rolls back that outer transaction and audit. All security definers have explicit empty search paths and explicit grants. Authenticated direct DML remains denied.

## Upgrade and privacy

Backfill historical key and session time from existing facts; resolve configuration at booked_at only when recoverable. Mark unresolved legacy provenance without inventing a historical limit. Ambiguous legacy cancellations without a timestamp block migration for reconciliation. Snapshot fields are excluded from authenticated Data API grants; Agenda exposes total/used/remaining and eligibility only.

## Alternatives

A separate mutable balance duplicates booking truth and requires reconciliation. Session-only locking cannot serialize distinct sessions. Booking-time windows allocate a future session to the wrong commercial period. All were rejected.

## Consequences and validation

Changing a reserved session's start, entitlement, Teacher or cohort is prohibited. Historical corrections require an explicit privileged operational procedure using the same lock protocol. SQL persistence and barrier-based real PostgreSQL races protect capacity, quota and retry semantics.
