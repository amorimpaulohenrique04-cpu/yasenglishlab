# GOAL — stage-06b-reservas-presenca

Status: SQL part implemented, not executed (no Docker); TypeScript mapping pending
Owner: agent
Created: 2026-10-13

## Objective / visible result

Integrity of live bookings and attendance (ADR 0008): teacher cancellation never rewrites late Student cancellations nor releases COMPLETED sessions; Students cannot cancel after start or attendance; attendance only from session start and rectifications are reasoned and append-only.

## Relevant context

docs/adr/0008-transactional-live-usage.md; migrations 20261001030000 (attendance), 20261002042106 (booking commands); src/modules/progress/domain/projection.ts (only BOOKED counts for NO_SHOW rate).

## Acceptance criteria

- cancel_teacher_live_session: only SCHEDULED sessions (23514 'only scheduled sessions can be cancelled'), only BOOKED -> TEACHER_CANCELLED, retry no-op.
- cancel_live_booking: 23514 'booking cannot be cancelled after session start' after start or attendance; early cancel releases quota; retry idempotent.
- public.attendance_revisions append-only (RLS, SELECT for session Teacher AAL2 and Admin AAL2 only).
- public.mark_teacher_attendance_v2(booking, status, reason): first marking without reason; rectification needs 3..500 chars (23514); before start 23514 'attendance cannot be marked before session start'.

## Allowed files / domains

supabase/migrations/20261013180000_stage_06b_live_booking_attendance_integrity.sql; supabase/tests/live_booking_integrity.sql; run-sql-tests.mjs suites; adjusted booking_quota.sql, teacher_operations.sql, test-schedule-concurrency.mjs.

## Forbidden areas

reconcile_billing_event, private.has_paid_access, subscription/cohort gates, applied migrations, RLS weakening.

## Mandatory tests

CI Database job (`node scripts/run-sql-tests.mjs live-booking-integrity|integration|rls`) is the real verification. Local: verify-db, verify-security, check-migrations, prettier/node --check.

## Evidence / risks

SQL tests NOT RUN locally (no Docker/psql). Existing tests that needed the new window were adjusted (booking_quota, teacher_operations, concurrency race message). Late cancellation (cancelled_at >= start) is now reachable only by privileged history imports.
