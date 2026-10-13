-- Stage 06b: live booking and attendance integrity (ADR 0008, transactional live usage).
--
-- Additive; no data is mutated at upgrade time. Existing rows are never rewritten or deleted.
--   * cancel_teacher_live_session: only a SCHEDULED session can be cancelled and only BOOKED reservations become
--     TEACHER_CANCELLED. A CANCELLED reservation (including a late Student cancellation that consumes quota) is
--     never rewritten, and COMPLETED sessions can no longer release quota of ATTENDED/NO_SHOW Students. Re-cancelling
--     an already CANCELLED session stays an idempotent no-op. Lock order (session, then Students by UUID) is kept.
--   * cancel_live_booking: a Student cannot cancel once the session started or attendance exists for the
--     reservation, so NO_SHOW/ATTENDED facts cannot be erased from progress. Early cancellation still releases quota.
--     Cancelling an already non-BOOKED reservation stays idempotent.
--   * attendance_revisions: append-only history of attendance corrections (previous/new status, reason, actor, time).
--     It deliberately has no FKs: the ledger must survive parent/user deletion (audit_logs pattern) and
--     private.prevent_mutation forbids the UPDATE/DELETE that ON DELETE SET NULL/CASCADE would require.
--   * mark_teacher_attendance_v2(booking, status, reason): marking is only allowed from session start; the first
--     marking needs no reason; changing an existing status (rectification) needs a 3..500 char reason and writes
--     a revision. Re-sending the same status is an idempotent no-op. mark_teacher_attendance(uuid,text) keeps its
--     signature/grants and delegates with a null reason, so a rectification through it fails explicitly.

create or replace function public.cancel_live_booking(p_live_session_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  booking_id uuid;
  booking_status text;
  session_starts_at timestamptz;
begin
  if actor is null or not private.has_role('STUDENT',false) then raise exception 'student role required' using errcode='42501'; end if;
  select starts_at into session_starts_at from public.live_sessions where id=p_live_session_id for update;
  perform private.lock_booking_user(actor);
  select id, status into booking_id, booking_status from public.session_bookings
    where live_session_id=p_live_session_id and user_id=actor for update;
  if booking_id is null then raise exception 'own booking not found' using errcode='42501'; end if;
  if booking_status <> 'BOOKED' then return booking_id; end if;
  if session_starts_at <= clock_timestamp()
    or exists(select 1 from public.attendance a where a.session_booking_id=booking_id) then
    raise exception 'booking cannot be cancelled after session start' using errcode='23514';
  end if;
  update public.session_bookings set status='CANCELLED' where id=booking_id and status='BOOKED';
  return booking_id;
end $$;

create or replace function public.cancel_teacher_live_session(p_live_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare student uuid; current_status text;
begin
  if auth.uid() is null or not private.is_teacher_for_session(p_live_session_id) then
    raise exception 'teacher session unavailable' using errcode='42501';
  end if;
  select status into current_status from public.live_sessions where id=p_live_session_id for update;
  if current_status = 'CANCELLED' then return; end if;
  if current_status is distinct from 'SCHEDULED' then
    raise exception 'only scheduled sessions can be cancelled' using errcode='23514';
  end if;
  for student in select distinct user_id from public.session_bookings where live_session_id=p_live_session_id order by user_id loop
    perform private.lock_booking_user(student);
  end loop;
  -- Lock the reservations first: mark_teacher_attendance_v2 only locks the reservation, so a concurrent marking either
  -- commits before this check (and blocks the cancellation) or waits until the cancellation turns the reservation
  -- into TEACHER_CANCELLED (and is then refused because it is no longer BOOKED).
  perform 1 from public.session_bookings where live_session_id=p_live_session_id and status='BOOKED' order by id for update;
  if exists(select 1 from public.session_bookings b join public.attendance a on a.session_booking_id=b.id
    where b.live_session_id=p_live_session_id and b.status='BOOKED') then
    raise exception 'session with recorded attendance cannot be cancelled' using errcode='23514';
  end if;
  update public.session_bookings set status='TEACHER_CANCELLED' where live_session_id=p_live_session_id and status='BOOKED';
  update public.live_sessions set status='CANCELLED' where id=p_live_session_id and status='SCHEDULED';
end $$;

create table public.attendance_revisions (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null,
  session_booking_id uuid not null,
  previous_status text not null check (previous_status in ('ATTENDED','NO_SHOW')),
  new_status text not null check (new_status in ('ATTENDED','NO_SHOW')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  check (previous_status <> new_status)
);
create index attendance_revisions_attendance_idx on public.attendance_revisions(attendance_id, changed_at);
create index attendance_revisions_booking_idx on public.attendance_revisions(session_booking_id);
alter table public.attendance_revisions enable row level security;
revoke all on public.attendance_revisions from public, anon, authenticated;
grant select on public.attendance_revisions to authenticated;
create policy attendance_revisions_authorized_select
on public.attendance_revisions for select
to authenticated
using (
  private.has_role('ADMIN', true)
  or exists (
    select 1 from public.session_bookings b
    where b.id = attendance_revisions.session_booking_id
      and private.is_teacher_for_session(b.live_session_id)
  )
);
create trigger attendance_revisions_no_update
before update or delete on public.attendance_revisions
for each row execute function private.prevent_mutation();

create function public.mark_teacher_attendance_v2(
  p_session_booking_id uuid,
  p_status text,
  p_reason text default null
)
returns table (
  attendance_id uuid,
  attendance_status text,
  attendance_marked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_booking public.session_bookings%rowtype;
  target_teacher_id uuid;
  target_starts_at timestamptz;
  existing public.attendance%rowtype;
  persisted public.attendance%rowtype;
  clean_reason text := btrim(p_reason);
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not private.has_role('TEACHER', true) then
    raise exception 'teacher role with aal2 required' using errcode = '42501';
  end if;
  if p_status not in ('ATTENDED', 'NO_SHOW') then
    raise exception 'unsupported attendance status' using errcode = '23514';
  end if;

  select b.* into target_booking from public.session_bookings b where b.id = p_session_booking_id for update;
  if not found or target_booking.status <> 'BOOKED' then
    raise exception 'attendance requires an active booked participant' using errcode = '23514';
  end if;

  select t.id, s.starts_at into target_teacher_id, target_starts_at
  from public.live_sessions s
  join public.teachers t on t.id = s.teacher_id
  where s.id = target_booking.live_session_id and t.user_id = current_user_id and t.active
  limit 1;
  if target_teacher_id is null then
    raise exception 'booking is outside teacher scope' using errcode = '42501';
  end if;
  if target_starts_at > clock_timestamp() then
    raise exception 'attendance cannot be marked before session start' using errcode = '23514';
  end if;

  select a.* into existing from public.attendance a where a.session_booking_id = p_session_booking_id for update;
  if not found then
    insert into public.attendance (session_booking_id, status, marked_at, marked_by_user_id)
    values (p_session_booking_id, p_status, now(), current_user_id)
    returning * into persisted;
  elsif existing.status = p_status then
    persisted := existing;
  else
    if clean_reason is null or clean_reason = '' then
      raise exception 'attendance correction requires a reason' using errcode = '23514';
    end if;
    if char_length(clean_reason) not between 3 and 500 then
      raise exception 'attendance correction reason must have 3 to 500 characters' using errcode = '23514';
    end if;
    insert into public.attendance_revisions (
      attendance_id, session_booking_id, previous_status, new_status, reason, changed_by
    ) values (
      existing.id, p_session_booking_id, existing.status, p_status, clean_reason, current_user_id
    );
    update public.attendance
       set status = p_status, marked_at = now(), marked_by_user_id = current_user_id
     where id = existing.id
    returning * into persisted;
  end if;

  return query select persisted.id, persisted.status, persisted.marked_at;
end;
$$;

create or replace function public.mark_teacher_attendance(
  p_session_booking_id uuid,
  p_status text
)
returns table (
  attendance_id uuid,
  attendance_status text,
  attendance_marked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select v.attendance_id, v.attendance_status, v.attendance_marked_at
  from public.mark_teacher_attendance_v2(p_session_booking_id, p_status, null) v;
end;
$$;

revoke all on function public.mark_teacher_attendance_v2(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mark_teacher_attendance_v2(uuid, text, text) to authenticated;
