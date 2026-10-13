-- Stage 08: defense in depth at the database layer (additive; no data is read, changed or deleted).
--
-- 1. Finalized pedagogical records are immutable by TRIGGER, not only by grants/RPCs.
--    - practice_manual_reviews: a row exists only once the review is finalized (public.finalize_practice_review
--      inserts it; there is no draft status), so any UPDATE/DELETE of an existing row is rejected.
--    - practice_results: the only legitimate UPDATE is the manual-review transition
--      PENDING_MANUAL -> MANUAL_REVIEWED performed by public.finalize_practice_review. Every other UPDATE and
--      every direct DELETE is rejected.
--    - Cascading deletes started from the parent practice_attempts row are still allowed (pg_trigger_depth() > 1
--      means the DELETE was issued by the referential-integrity trigger, never by a client statement), so
--      erasure of an attempt/user keeps working and nothing is silently overwritten.
--    Same message and errcode as private.prevent_mutation (55000 'historical record is immutable').
-- 2. Function privileges: trigger functions that were created without the standard revoke keep the default
--    PUBLIC EXECUTE. Trigger functions never need EXECUTE for the DML caller, so it is revoked.
--    supabase/tests/function_privileges.sql keeps every public/private function closed to anon and PUBLIC.

create function private.protect_practice_manual_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'historical record is immutable' using errcode = '55000';
end;
$$;

create function private.protect_practice_result()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
  elsif old.evaluation_status = 'PENDING_MANUAL'
    and new.evaluation_status = 'MANUAL_REVIEWED'
    and new.id = old.id
    and new.practice_attempt_id = old.practice_attempt_id
    and new.metrics = old.metrics
    and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'historical record is immutable' using errcode = '55000';
end;
$$;

revoke all on function private.protect_practice_manual_review() from public, anon, authenticated;
revoke all on function private.protect_practice_result() from public, anon, authenticated;

create trigger practice_manual_reviews_immutable
before update or delete on public.practice_manual_reviews
for each row execute function private.protect_practice_manual_review();

create trigger practice_results_immutable
before update or delete on public.practice_results
for each row execute function private.protect_practice_result();

-- Trigger-only functions created after the schema-wide revoke of 20260929043000 (found by static analysis).
revoke all on function private.validate_lesson_progress_identity() from public, anon, authenticated;
revoke all on function private.audit_lesson_progress_change() from public, anon, authenticated;
