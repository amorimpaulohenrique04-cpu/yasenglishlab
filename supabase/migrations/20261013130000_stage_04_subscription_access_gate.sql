-- Stage 04a (ADR 0016): paid-access gate derived from subscriptions.status.
--
-- Additive only. enrollments, cohort_memberships, progress and bookings are never mutated by
-- suspension; access is recomputed from subscriptions on every decision, so a CONFIRMED payment
-- (PAST_DUE -> ACTIVE) restores access with no restoration job.
--
-- Rule for a Student that HAS a subscription row: content and live-class access require at least one
-- subscription in ACTIVE/TRIALING. Staff (ADMIN/TEACHER/SUPPORT) and users that never had any
-- subscription (seed/legacy) are not subject to the gate.
--
-- Chokepoints (everything else already delegates to these):
--   content reads   : private.can_read_material, private.can_read_lesson_asset (also feeds
--                     authorize_lesson_video_playback), private.can_read_live_recording,
--                     private.can_read_session_resource
--   student writes  : trigger private.enforce_paid_access on lesson_progress (record_lesson_progress),
--                     practice_attempts (start/submit_practice_attempt), session_bookings (book_live_session)
--   live room entry : public.get_live_session_join_reference (feeds get_live_session_join_access)

create function private.has_paid_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and (
    -- Staff is governed by role checks elsewhere, never by a Student subscription (AAL is not a billing concern).
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_user and ur.role in ('ADMIN', 'TEACHER', 'SUPPORT')
    )
    -- Seed/legacy users that never had a subscription keep today's behavior.
    or not exists (select 1 from public.subscriptions s where s.user_id = p_user)
    -- Paid access: at least one ACTIVE/TRIALING subscription.
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user and s.status in ('ACTIVE', 'TRIALING')
    )
  );
$$;
-- Decision helper only: not callable by clients (would disclose another user's billing state).
-- It is invoked exclusively from SECURITY DEFINER functions/triggers below.
revoke all on function private.has_paid_access(uuid) from public, anon, authenticated;

-- Student writes. Only the Student's own commands are gated: jobs (auth.uid() is null) and staff acting
-- on a Student's rows are not. Cancelling a booking, abandoning an attempt and reading remain allowed.
create function private.enforce_paid_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    return new;
  end if;
  if tg_table_name = 'session_bookings'
     and (new.status <> 'BOOKED' or (tg_op = 'UPDATE' and old.status = 'BOOKED')) then
    return new;
  end if;
  if tg_table_name = 'practice_attempts'
     and tg_op = 'UPDATE'
     and not (new.status = 'SUBMITTED' and old.status is distinct from 'SUBMITTED') then
    return new;
  end if;
  if not private.has_paid_access(new.user_id) then
    raise exception 'active subscription required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_paid_access() from public, anon, authenticated;

-- Trigger names sort before the existing guards so a suspended Student gets the access error first.
create trigger access_00_subscription_gate before insert or update on public.lesson_progress
  for each row execute function private.enforce_paid_access();
create trigger access_00_subscription_gate before insert or update on public.practice_attempts
  for each row execute function private.enforce_paid_access();
create trigger access_00_subscription_gate before insert or update on public.session_bookings
  for each row execute function private.enforce_paid_access();

-- Content reads: same bodies as P18 / P21, plus the paid-access predicate on the Student branch only.
create or replace function private.can_read_material(p_material_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
select exists (select 1 from public.materials m where m.id=p_material_id and (
  private.has_role('ADMIN',true) or (private.content_visible('materials',m.id) and (
    private.has_role('TEACHER',true) or (
      private.has_paid_access(auth.uid()) and
      (m.required_entitlement_key is null or private.current_user_has_entitlement(m.required_entitlement_key)) and (
        (m.module_id is null and m.lesson_id is null) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id
          where e.user_id=auth.uid() and e.status='ACTIVE' and mo.id=m.module_id
        ) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id join public.lessons l on l.module_id=mo.id
          where e.user_id=auth.uid() and e.status='ACTIVE' and l.id=m.lesson_id
        )
      )
    )
  ))
));
$$;

create or replace function private.can_read_lesson_asset(p_lesson_asset_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
select exists (select 1 from public.lesson_assets a join public.lessons l on l.id=a.lesson_id join public.modules m on m.id=l.module_id
where a.id=p_lesson_asset_id and (private.has_role('ADMIN',true) or (
 private.content_visible('lesson_assets',a.id) and (private.has_role('TEACHER',true) or (
  private.has_paid_access(auth.uid()) and
  (a.required_entitlement_key is null or private.current_user_has_entitlement(a.required_entitlement_key)) and exists (
   select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=m.course_id and e.status='ACTIVE'
  )
 ))
)));
$$;

create or replace function private.can_read_live_recording(p_recording_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.live_session_recordings r
    where r.id = p_recording_id
      and (
        private.has_role('ADMIN', true)
        or private.is_teacher_for_session(r.live_session_id)
        or (
          private.has_paid_access((select auth.uid()))
          and (
            r.required_entitlement_key is null
            or private.current_user_has_entitlement(r.required_entitlement_key)
          )
          and exists (
            select 1
            from public.session_bookings b
            where b.live_session_id = r.live_session_id
              and b.user_id = (select auth.uid())
              and b.status = 'BOOKED'
          )
        )
      )
  );
$$;

create or replace function private.can_read_session_resource(p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_teacher_for_session(p_session) or (private.has_role('STUDENT',false) and private.has_paid_access(auth.uid()) and exists(select 1 from public.session_bookings where live_session_id=p_session and user_id=auth.uid() and status='BOOKED'));
$$;

-- Live room entry. PAST_DUE keeps the booking row (ADR 0016 d.4) but the Student cannot enter the room.
-- The extra "reason" key is additive: the existing status contract (NOT_AUTHORIZED) is unchanged.
create or replace function public.get_live_session_join_reference(p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare session public.live_sessions; is_teacher boolean; has_booking boolean;
begin
 select * into session from public.live_sessions where id=p_session_id;
 is_teacher := private.is_teacher_for_session(p_session_id);
 has_booking := private.has_role('STUDENT',false) and exists(select 1 from public.session_bookings where live_session_id=p_session_id and user_id=auth.uid() and status='BOOKED');
 if session.id is null or not (is_teacher or has_booking) then
  return jsonb_build_object('status','NOT_AUTHORIZED');
 end if;
 if not is_teacher and not private.has_paid_access(auth.uid()) then
  return jsonb_build_object('status','NOT_AUTHORIZED','reason','SUBSCRIPTION_SUSPENDED');
 end if;
 return jsonb_build_object('status',session.status,'startsAt',session.starts_at,'endsAt',session.ends_at,'provider',session.meeting_provider,'reference',session.meeting_ref,'teacher',is_teacher);
end $$;
