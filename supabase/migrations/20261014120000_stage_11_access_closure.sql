-- Stage 11 (ADR 0017-0019): close the commercial -> access -> learning flow gaps found by the 2026-10-13 audit.
--
-- Additive migration; the only data written is the deterministic LEGACY_BACKFILL below (no deletes, no updates).
--
--  1. Paid access becomes fail-closed. A signup with no subscription and no grant is NOT entitled to anything.
--     Explicit, auditable ADMIN grants live in public.complimentary_access_grants (base access only; no plan
--     entitlements). Staff roles stay exempt.
--  2. Deterministic backfill (LEGACY_BACKFILL) so the Students that had access only because they never had a
--     subscription row (legacy enrolled Students) do not lose it silently.
--  3. A scheduled cancellation whose current_period_end was reached stops granting access even if the provider
--     webhook never moved the row to CANCELLED (ACTIVE + cancel_at_period_end + current_period_end <= now()).
--  4. confirm_placement_choice uses private.has_paid_access (a CANCELLED subscription with a future paid end can
--     confirm; grants never reach placement because a placement case requires a subscription).
--  5. Course completion: an AFTER trigger on lesson_progress marks the enrollment COMPLETED exactly once when every
--     published lesson of the course is completed. COMPLETED keeps content/progress/cohort access (the functions
--     redefined below), ACTIVE stays the only state for new memberships, transfers and the admin queue.
--  6. Practice is scoped by enrollment (policy + start_practice_attempt).
--  7. public.admin_enrollments_without_active_cohort(): detection for the legacy Students blocked by 06a.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Explicit complimentary access
-- ---------------------------------------------------------------------------------------------------------
create table public.complimentary_access_grants (
  user_id uuid primary key references auth.users(id) on delete restrict,
  reason text not null check (reason in ('ADMIN_GRANT', 'LEGACY_BACKFILL')),
  note text check (note is null or char_length(note) <= 500),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  check (expires_at is null or expires_at > granted_at)
);

alter table public.complimentary_access_grants enable row level security;
revoke all on public.complimentary_access_grants from public, anon, authenticated;
-- The own-row loader and the Admin card only need these columns. note / granted_by / revoked_by stay server-side
-- (they are in audit_logs for ADMIN); no INSERT/UPDATE/DELETE exists for clients: writes go through the RPCs below.
grant select (user_id, reason, granted_at, expires_at, revoked_at) on public.complimentary_access_grants to authenticated;
create policy complimentary_grants_select on public.complimentary_access_grants for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('ADMIN', true));

create function public.grant_complimentary_access(p_user uuid, p_note text, p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_prior public.complimentary_access_grants;
  v_row public.complimentary_access_grants;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_user is null or v_note is null or char_length(v_note) > 500
     or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'invalid grant input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = 'STUDENT') then
    raise exception 'Student target required' using errcode = '23514';
  end if;

  select * into v_prior from public.complimentary_access_grants where user_id = p_user for update;

  insert into public.complimentary_access_grants as g (user_id, reason, note, granted_by, granted_at, expires_at)
  values (p_user, 'ADMIN_GRANT', v_note, auth.uid(), now(), p_expires_at)
  on conflict (user_id) do update
    set reason = 'ADMIN_GRANT', note = excluded.note, granted_by = excluded.granted_by,
        granted_at = excluded.granted_at, expires_at = excluded.expires_at,
        revoked_at = null, revoked_by = null
  returning * into v_row;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'complimentary_access_granted', 'complimentary_access_grant', p_user,
    jsonb_build_object('target_user_id', p_user, 'note', v_note, 'expires_at', p_expires_at,
      'reactivated', v_prior.user_id is not null,
      'previous_reason', v_prior.reason, 'previous_revoked_at', v_prior.revoked_at));

  return jsonb_build_object('user_id', v_row.user_id, 'reason', v_row.reason, 'granted_at', v_row.granted_at,
    'expires_at', v_row.expires_at, 'revoked_at', v_row.revoked_at);
end;
$$;
revoke all on function public.grant_complimentary_access(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_complimentary_access(uuid, text, timestamptz) to authenticated;

create function public.revoke_complimentary_access(p_user uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_row public.complimentary_access_grants;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_user is null or v_note is null or char_length(v_note) > 500 then
    raise exception 'invalid revoke input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id = p_user and ur.role = 'STUDENT') then
    raise exception 'Student target required' using errcode = '23514';
  end if;

  select * into v_row from public.complimentary_access_grants where user_id = p_user for update;
  if v_row.user_id is null then
    raise exception 'grant not found' using errcode = '23514';
  end if;
  -- Idempotent: an already revoked grant is returned untouched and is not audited twice.
  if v_row.revoked_at is null then
    update public.complimentary_access_grants set revoked_at = now(), revoked_by = auth.uid()
      where user_id = p_user returning * into v_row;
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'complimentary_access_revoked', 'complimentary_access_grant', p_user,
      jsonb_build_object('target_user_id', p_user, 'note', v_note, 'reason', v_row.reason));
  end if;

  return jsonb_build_object('user_id', v_row.user_id, 'reason', v_row.reason, 'granted_at', v_row.granted_at,
    'expires_at', v_row.expires_at, 'revoked_at', v_row.revoked_at);
end;
$$;
revoke all on function public.revoke_complimentary_access(uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_complimentary_access(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Deterministic backfill. Detection query (also the acceptance rule):
--      select ur.user_id from public.user_roles ur
--      where ur.role = 'STUDENT'
--        and not exists (select 1 from public.subscriptions s where s.user_id = ur.user_id)
--        and exists (select 1 from public.enrollments e where e.user_id = ur.user_id and e.status = 'ACTIVE');
--    Nothing is inferred beyond that: Students without an ACTIVE enrollment, or with any subscription row
--    (even PAST_DUE/EXPIRED), are NOT granted. The Admin may revoke any LEGACY_BACKFILL row afterwards.
-- ---------------------------------------------------------------------------------------------------------
insert into public.complimentary_access_grants (user_id, reason, note)
select ur.user_id, 'LEGACY_BACKFILL', 'Stage 11 backfill: ACTIVE enrollment without any subscription'
from public.user_roles ur
where ur.role = 'STUDENT'
  and not exists (select 1 from public.subscriptions s where s.user_id = ur.user_id)
  and exists (select 1 from public.enrollments e where e.user_id = ur.user_id and e.status = 'ACTIVE')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Fail-closed paid access (same signature/grants as 20261013170000).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.has_paid_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = p_user and ur.role in ('ADMIN', 'TEACHER', 'SUPPORT')
    )
    or exists (
      select 1 from public.complimentary_access_grants g
      where g.user_id = p_user
        and g.revoked_at is null
        and (g.expires_at is null or g.expires_at > now())
    )
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user
        and (
          (s.status in ('ACTIVE', 'TRIALING')
            and not (s.cancel_at_period_end and s.current_period_end is not null and s.current_period_end <= now()))
          or (s.status = 'CANCELLED' and s.current_period_end is not null and s.current_period_end > now())
        )
    )
  );
$$;
revoke all on function private.has_paid_access(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. confirm_placement_choice: the commercial check is the shared paid-access rule (body otherwise identical to
--    20261013160000; same error semantics: 42501 'confirmed commercial state required').
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.confirm_placement_choice(p_cohort_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; d public.placement_decisions; co public.cohorts; e uuid; m uuid;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null then raise exception 'placement required' using errcode='23514'; end if;
 select * into d from public.placement_decisions where placement_case_id=c.id;
 if d.id is not null then
  if d.chosen_cohort_id is distinct from p_cohort_id then raise exception 'conflicting placement choice' using errcode='23514'; end if;return d.membership_id;
 end if;
 if c.state<>'STUDENT_DECISION' then raise exception 'student decision required' using errcode='23514'; end if;
 select * into co from public.cohorts where id=p_cohort_id for update;
 if co.id is null or not private.placement_cohort_compatible(c.id,co.id,true) then raise exception 'cohort incompatible' using errcode='23514'; end if;
 if not private.has_paid_access(c.user_id) then raise exception 'confirmed commercial state required' using errcode='42501'; end if;
 e:=private.activate_enrollment(c.user_id,co.course_id,'confirm_placement_choice');
 insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(co.id,c.user_id,e) returning id into m;
 insert into public.placement_decisions(placement_case_id,chosen_cohort_id,chosen_course_id,membership_id) values(c.id,co.id,co.course_id,m);
 update public.placement_cases set state='ENROLLED',membership_id=m where id=c.id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data) values(auth.uid(),'placement_choice_confirmed','placement_case',c.id,jsonb_build_object('membership_id',m,'cohort_id',co.id));
 return m;
end $$;

revoke all on function public.confirm_placement_choice(uuid) from public, anon, authenticated;
grant execute on function public.confirm_placement_choice(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Course completion. COMPLETED keeps the Student's read/progress access.
--    Redefined below for ('ACTIVE','COMPLETED') (enumerated from the live catalog: every function/policy that
--    reads enrollments.status): can_read_material, can_read_lesson_asset, record_lesson_progress,
--    track_product_event_pre_video, has_cohort_membership (cohort sessions/booking/teacher assignment),
--    validate_cohort_relation (an existing ACTIVE membership may be updated once its enrollment is COMPLETED;
--    NEW memberships still need an ACTIVE enrollment), admin_student_curriculum_summary and
--    admin_student_directory_v2 (progress display).
--    Intentionally ACTIVE-only: private.activate_enrollment / transfer_placement_cohort (transfer logic),
--    manage_cohort ADD_STUDENT (admin queue), admin_enrollments_without_active_cohort, the LEGACY_BACKFILL.
--    can_read_session_resource / can_read_live_recording do not depend on enrollments (booking + paid access).
--    lesson_progress RLS and the 06a cohort-membership guard do not read enrollments.status.
--    CREATE OR REPLACE keeps owner and ACLs (the Stage 08 function_privileges test still holds).
-- ---------------------------------------------------------------------------------------------------------
create function private.has_course_enrollment(p_user uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = p_user and e.course_id = p_course and e.status in ('ACTIVE', 'COMPLETED')
  );
$$;
revoke all on function private.has_course_enrollment(uuid, uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.can_read_material(p_material_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists (select 1 from public.materials m where m.id=p_material_id and (
  private.has_role('ADMIN',true) or (private.content_visible('materials',m.id) and (
    private.has_role('TEACHER',true) or (
      private.has_paid_access(auth.uid()) and
      (m.required_entitlement_key is null or private.current_user_has_entitlement(m.required_entitlement_key)) and (
        (m.module_id is null and m.lesson_id is null) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id
          where e.user_id=auth.uid() and e.status in ('ACTIVE','COMPLETED') and mo.id=m.module_id
        ) or exists (
          select 1 from public.enrollments e join public.modules mo on mo.course_id=e.course_id join public.lessons l on l.module_id=mo.id
          where e.user_id=auth.uid() and e.status in ('ACTIVE','COMPLETED') and l.id=m.lesson_id
        )
      )
    )
  ))
));
$function$

;

CREATE OR REPLACE FUNCTION private.can_read_lesson_asset(p_lesson_asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists (select 1 from public.lesson_assets a join public.lessons l on l.id=a.lesson_id join public.modules m on m.id=l.module_id
where a.id=p_lesson_asset_id and (private.has_role('ADMIN',true) or (
 private.content_visible('lesson_assets',a.id) and (private.has_role('TEACHER',true) or (
  private.has_paid_access(auth.uid()) and
  (a.required_entitlement_key is null or private.current_user_has_entitlement(a.required_entitlement_key)) and exists (
   select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=m.course_id and e.status in ('ACTIVE','COMPLETED')
  )
 ))
)));
$function$

;

CREATE OR REPLACE FUNCTION public.record_lesson_progress(p_lesson_id uuid, p_completion_percent numeric, p_last_position_seconds integer DEFAULT NULL::integer)
 RETURNS lesson_progress
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_user_id uuid := (select auth.uid());
  enrollment_id uuid;
  result_row public.lesson_progress;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_completion_percent < 0 or p_completion_percent > 100 then
    raise exception 'completion_percent must be between 0 and 100';
  end if;

  if p_last_position_seconds is not null and p_last_position_seconds < 0 then
    raise exception 'last_position_seconds must be non-negative';
  end if;

  select e.id
  into enrollment_id
  from public.enrollments e
  join public.modules m on m.course_id = e.course_id
  join public.lessons l on l.module_id = m.id
  join public.courses c on c.id = e.course_id
  where e.user_id = actor_user_id
    and e.status in ('ACTIVE', 'COMPLETED')
    and c.active
        and private.content_visible('modules',m.id)
    and l.id = p_lesson_id
        and private.content_visible('lessons',l.id)
  order by e.enrolled_at desc, e.id
  limit 1;

  if enrollment_id is null then
    raise exception 'Active enrollment in a published course required' using errcode = '42501';
  end if;

  insert into public.lesson_progress (
    enrollment_id,
    lesson_id,
    user_id,
    status,
    completion_percent,
    last_position_seconds,
    started_at,
    last_accessed_at,
    completed_at,
    updated_at
  )
  values (
    enrollment_id,
    p_lesson_id,
    actor_user_id,
    case
      when p_completion_percent >= 100 then 'COMPLETED'
      when p_completion_percent > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end,
    p_completion_percent,
    p_last_position_seconds,
    case when p_completion_percent > 0 then now() else null end,
    now(),
    case when p_completion_percent >= 100 then now() else null end,
    now()
  )
  on conflict (user_id, lesson_id)
  do update set
    completion_percent = greatest(
      public.lesson_progress.completion_percent,
      excluded.completion_percent
    ),
    status = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) >= 100 then 'COMPLETED'
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end,
    last_position_seconds = case
      when excluded.last_position_seconds is null
        then public.lesson_progress.last_position_seconds
      when public.lesson_progress.last_position_seconds is null
        then excluded.last_position_seconds
      else greatest(
        public.lesson_progress.last_position_seconds,
        excluded.last_position_seconds
      )
    end,
    started_at = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) > 0
        then coalesce(public.lesson_progress.started_at, now())
      else public.lesson_progress.started_at
    end,
    last_accessed_at = now(),
    completed_at = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) >= 100
        then coalesce(public.lesson_progress.completed_at, now())
      else public.lesson_progress.completed_at
    end,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.track_product_event_pre_video(p_event_name text, p_lesson_id uuid DEFAULT NULL::uuid, p_properties jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_user_id uuid := (select auth.uid());
  analytics_module_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_event_name not in (
    'signup_completed',
    'login_completed',
    'subscription_started',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'lesson_started',
    'lesson_progressed',
    'lesson_completed',
    'module_completed',
    'practice_started',
    'practice_completed',
    'material_opened',
    'material_favorited',
    'assessment_started',
    'assessment_completed',
    'live_session_booked',
    'live_session_cancelled',
    'live_session_attended'
  ) then
    raise exception 'Unsupported product analytics event';
  end if;

  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Analytics properties must be an object';
  end if;

  if p_idempotency_key is not null
    and char_length(p_idempotency_key) not between 1 and 160 then
    raise exception 'Analytics idempotency key must contain 1 to 160 characters';
  end if;

  if p_event_name in ('lesson_started', 'lesson_completed', 'module_completed')
    and p_idempotency_key is null then
    raise exception 'Critical learning analytics require an idempotency key';
  end if;

  if p_event_name in ('lesson_started', 'lesson_progressed', 'lesson_completed') then
    if p_lesson_id is null or not exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      join public.modules m on m.course_id = c.id
      join public.lessons l on l.module_id = m.id
      where e.user_id = actor_user_id
        and e.status in ('ACTIVE', 'COMPLETED')
        and c.active
        and private.content_visible('modules',m.id)
        and l.id = p_lesson_id
        and private.content_visible('lessons',l.id)
    ) then
      raise exception 'Active enrollment in a published lesson required'
        using errcode = '42501';
    end if;
  end if;

  if p_event_name = 'lesson_completed' and not exists (
    select 1
    from public.lesson_progress lp
    where lp.user_id = actor_user_id
      and lp.lesson_id = p_lesson_id
      and lp.completion_percent = 100
  ) then
    raise exception 'Completed lesson progress required' using errcode = '42501';
  end if;

  if p_event_name = 'module_completed' then
    begin
      analytics_module_id := nullif(p_properties ->> 'module_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Valid module_id property required';
    end;

    if analytics_module_id is null or not exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where m.id = analytics_module_id
        and e.user_id = actor_user_id
        and e.status in ('ACTIVE', 'COMPLETED')
        and c.active
        and private.content_visible('modules',m.id)
        and exists (
          select 1
          from public.lessons l
          where l.module_id = m.id
            and private.content_visible('lessons',l.id)
        )
        and not exists (
          select 1
          from public.lessons l
          left join public.lesson_progress lp
            on lp.lesson_id = l.id
            and lp.user_id = actor_user_id
          where l.module_id = m.id
            and private.content_visible('lessons',l.id)
            and coalesce(lp.completion_percent, 0) < 100
        )
    ) then
      raise exception 'Completed enrolled module required' using errcode = '42501';
    end if;
  end if;

  insert into public.product_analytics_events (
    user_id,
    event_name,
    lesson_id,
    properties,
    idempotency_key
  )
  values (
    actor_user_id,
    p_event_name,
    p_lesson_id,
    coalesce(p_properties, '{}'::jsonb),
    p_idempotency_key
  )
  on conflict (user_id, idempotency_key)
    where idempotency_key is not null
    do nothing;
end;
$function$

;

CREATE OR REPLACE FUNCTION private.has_cohort_membership(p_cohort uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from public.cohort_memberships m join public.cohorts c on c.id=m.cohort_id
  join public.enrollments e on e.id=m.enrollment_id
  where m.cohort_id=p_cohort and m.user_id=p_user and m.status='ACTIVE' and c.status='ACTIVE'
   and m.starts_at<=now() and (m.ends_at is null or m.ends_at>now()) and e.status in ('ACTIVE','COMPLETED')
   and exists(select 1 from public.user_roles ur where ur.user_id=p_user and ur.role='STUDENT'));
$function$

;

CREATE OR REPLACE FUNCTION private.validate_cohort_relation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_table_name='cohorts' then
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
   raise exception 'invalid cohort timezone' using errcode='23514';
  end if;
  if tg_op='UPDATE' and row(new.course_id,new.timezone,new.starts_at,new.ends_at) is distinct from row(old.course_id,old.timezone,old.starts_at,old.ends_at)
   and (exists(select 1 from public.live_sessions where cohort_id=old.id) or exists(select 1 from public.cohort_memberships where cohort_id=old.id)) then
   raise exception 'cohort structural metadata has active dependencies' using errcode='23514';
  end if;
 elsif tg_table_name='cohort_memberships' then
  if tg_op='UPDATE' and row(new.cohort_id,new.user_id,new.enrollment_id,new.starts_at) is distinct from row(old.cohort_id,old.user_id,old.enrollment_id,old.starts_at) then
   raise exception 'membership identity is immutable' using errcode='23514';
  end if;
  if new.status='ACTIVE' and not exists(select 1 from public.enrollments e join public.cohorts c on c.course_id=e.course_id
    join public.user_roles ur on ur.user_id=e.user_id and ur.role='STUDENT'
    where c.id=new.cohort_id and c.status<>'ARCHIVED' and e.id=new.enrollment_id and e.user_id=new.user_id and (e.status='ACTIVE' or (tg_op='UPDATE' and old.status='ACTIVE' and e.status='COMPLETED'))) then
   raise exception 'active compatible enrollment and STUDENT role required' using errcode='23514';
  end if;
 elsif tg_table_name='cohort_teachers' then
  if not exists(select 1 from public.teachers t join public.user_roles ur on ur.user_id=t.user_id and ur.role='TEACHER' where t.id=new.teacher_id and t.active) then
   raise exception 'active Teacher required' using errcode='23514';
  end if;
 end if;
 return new;
end $function$

;

CREATE OR REPLACE FUNCTION public.admin_student_curriculum_summary(p_student_user_id uuid)
 RETURNS TABLE(enrollment_id uuid, course_id uuid, course_title text, lessons_completed bigint, lessons_total bigint, completion_percent integer, latest_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    e.id,
    c.id,
    c.title,
    count(distinct l.id) filter (where coalesce(lp.completion_percent, 0) = 100),
    count(distinct l.id),
    coalesce(round(avg(coalesce(lp.completion_percent, 0))), 0)::integer,
    max(lp.last_accessed_at)
  from public.enrollments as e
  join public.courses as c on c.id = e.course_id
  left join public.modules as m
    on m.course_id = c.id and m.publication_status = 'PUBLISHED'
  left join public.lessons as l
    on l.module_id = m.id and l.publication_status = 'PUBLISHED'
  left join public.lesson_progress as lp
    on lp.enrollment_id = e.id and lp.lesson_id = l.id
  where e.user_id = p_student_user_id
    and e.status in ('ACTIVE', 'COMPLETED')
    and c.active
    and c.publication_status = 'PUBLISHED'
  group by e.id, c.id, c.title, e.enrolled_at
  order by e.enrolled_at desc, e.id
  limit 20;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.admin_student_directory_v2(p_query text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_course_id uuid DEFAULT NULL::uuid, p_cohort_id uuid DEFAULT NULL::uuid, p_placement_state text DEFAULT NULL::text, p_enrollment_status text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, display_name text, created_at timestamp with time zone, course_id uuid, course_title text, cohort_id uuid, cohort_name text, enrollment_status text, placement_state text, completion_percent integer, next_session_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 50 or p_offset < 0
     or char_length(coalesce(p_query, '')) > 120
     or (p_placement_state is not null and p_placement_state not in (
       'PAYMENT_CONFIRMED', 'ASSESSMENT_REQUIRED', 'IN_PROGRESS', 'REVIEW_PENDING',
       'PLACEMENT_READY', 'STUDENT_DECISION', 'ENROLLED'
     ))
     or (p_enrollment_status is not null and p_enrollment_status not in ('ACTIVE', 'COMPLETED', 'CANCELLED')) then
    raise exception 'invalid directory query' using errcode = '22023';
  end if;

  return query
  with directory_profiles as (
    select profile.user_id, profile.display_name, profile.created_at
    from public.profiles as profile
    where exists (
      select 1 from public.user_roles as role
      where role.user_id = profile.user_id and role.role = 'STUDENT'
    )
      and (coalesce(p_query, '') = ''
        or profile.display_name ilike '%' || replace(replace(replace(p_query, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%')
  ),
  student_projection as (
    select
      profile.user_id,
      profile.display_name,
      profile.created_at,
      enrollment.id as enrollment_id,
      enrollment.course_id as enrollment_course_id,
      enrollment.status as enrollment_status,
      cohort.id as cohort_id,
      cohort.name as cohort_name,
      cohort.course_id as cohort_course_id,
      placement.state as placement_state
    from directory_profiles as profile
    left join lateral (
      select item.id, item.course_id, item.status
      from public.enrollments as item
      where item.user_id = profile.user_id
      order by (item.status = 'ACTIVE') desc, item.enrolled_at desc, item.id
      limit 1
    ) as enrollment on true
    left join lateral (
      select current_cohort.id, current_cohort.name, current_cohort.course_id
      from public.cohort_memberships as membership
      join public.cohorts as current_cohort on current_cohort.id = membership.cohort_id
      where membership.user_id = profile.user_id
        and membership.enrollment_id = enrollment.id
        and membership.status = 'ACTIVE'
        and membership.starts_at <= now()
        and (membership.ends_at is null or membership.ends_at > now())
        and current_cohort.status = 'ACTIVE'
      order by membership.starts_at desc, membership.id
      limit 1
    ) as cohort on true
    left join lateral (
      select item.state
      from public.placement_cases as item
      where item.user_id = profile.user_id
      order by item.created_at desc, item.id
      limit 1
    ) as placement on true
  )
  select
    projection.user_id,
    projection.display_name,
    projection.created_at,
    coalesce(projection.cohort_course_id, projection.enrollment_course_id),
    course.title,
    projection.cohort_id,
    projection.cohort_name,
    projection.enrollment_status,
    projection.placement_state,
    case when curriculum.lesson_count > 0 then curriculum.completion_percent else null end,
    next_session.starts_at
  from student_projection as projection
  left join public.courses as course
    on course.id = coalesce(projection.cohort_course_id, projection.enrollment_course_id)
  left join lateral (
    select
      count(distinct lesson.id) as lesson_count,
      coalesce(round(avg(coalesce(progress.completion_percent, 0))), 0)::integer as completion_percent
    from public.modules as module
    join public.lessons as lesson on lesson.module_id = module.id
    left join public.lesson_progress as progress
      on progress.enrollment_id = projection.enrollment_id
      and progress.lesson_id = lesson.id
    where projection.enrollment_status in ('ACTIVE', 'COMPLETED')
      and module.course_id = projection.enrollment_course_id
      and module.publication_status = 'PUBLISHED'
      and lesson.publication_status = 'PUBLISHED'
  ) as curriculum on true
  left join lateral (
    select session.starts_at
    from public.session_bookings as booking
    join public.live_sessions as session on session.id = booking.live_session_id
    where booking.user_id = projection.user_id
      and booking.status = 'BOOKED'
      and session.status = 'SCHEDULED'
      and session.starts_at > now()
    order by session.starts_at, session.id
    limit 1
  ) as next_session on true
  where (p_course_id is null or coalesce(projection.cohort_course_id, projection.enrollment_course_id) = p_course_id)
    and (p_cohort_id is null or projection.cohort_id = p_cohort_id)
    and (p_placement_state is null or projection.placement_state = p_placement_state)
    and (p_enrollment_status is null or projection.enrollment_status = p_enrollment_status)
  order by projection.display_name, projection.user_id
  limit p_limit offset p_offset;
end;
$function$

;


-- Completion trigger. Serialization: the matching enrollment row is locked FOR NO KEY UPDATE (not FOR UPDATE:
-- the lesson_progress insert already holds FOR KEY SHARE on that row through its foreign key, and two concurrent
-- final lessons would deadlock on FOR UPDATE). FOR NO KEY UPDATE conflicts with itself but not with KEY SHARE.
-- Under READ COMMITTED the count below is a NEW statement executed after the lock is granted, so it sees the
-- other transaction's committed final lesson: exactly one of two concurrent completions flips the enrollment.
-- Idempotent (only ACTIVE -> COMPLETED), no recursion (it never writes lesson_progress), and lessons published
-- later never reopen a COMPLETED enrollment (no trigger on lessons/modules).
create function private.complete_enrollment_on_last_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
  v_total integer;
  v_done integer;
begin
  if new.status <> 'COMPLETED' then
    return null;
  end if;
  select * into v_enrollment from public.enrollments where id = new.enrollment_id for no key update;
  if v_enrollment.id is null or v_enrollment.status <> 'ACTIVE' then
    return null;
  end if;

  select count(*), count(*) filter (where lp.status = 'COMPLETED')
    into v_total, v_done
  from public.modules m
  join public.lessons l on l.module_id = m.id
  left join public.lesson_progress lp on lp.enrollment_id = v_enrollment.id and lp.lesson_id = l.id
  where m.course_id = v_enrollment.course_id
    and private.content_visible('lessons', l.id);

  if v_total = 0 or v_done < v_total then
    return null;
  end if;

  update public.enrollments set status = 'COMPLETED', completed_at = now()
    where id = v_enrollment.id and status = 'ACTIVE';
  if found then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'enrollment_course_completed', 'enrollment', v_enrollment.id,
      jsonb_build_object('course_id', v_enrollment.course_id, 'lessons_total', v_total));
  end if;
  return null;
end;
$$;
revoke all on function private.complete_enrollment_on_last_lesson() from public, anon, authenticated;

create trigger lesson_progress_complete_enrollment
after insert or update on public.lesson_progress
for each row when (new.status = 'COMPLETED')
execute function private.complete_enrollment_on_last_lesson();

-- ---------------------------------------------------------------------------------------------------------
-- 6. Practice by enrollment. Visible published activities are readable/startable by: ADMIN; TEACHER; or a
--    Student enrolled (ACTIVE/COMPLETED) in the course of every relation the activity declares (module and/or
--    lesson); an activity without relations needs any ACTIVE/COMPLETED enrollment. SUPPORT is intentionally not
--    included (same as materials/lesson assets). The paid-access trigger on practice_attempts is unchanged.
--    submit_practice_attempt is attempt-owner bound and verified at start; it needs no change.
-- ---------------------------------------------------------------------------------------------------------
create function private.can_view_practice_activity(p_activity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('ADMIN', true)
    or (
      private.content_visible('practice_activities', p_activity)
      and (
        private.has_role('TEACHER', true)
        or exists (
          select 1 from public.practice_activities a
          where a.id = p_activity
            and (auth.uid() is not null)
            and (
              (a.related_module_id is null and a.related_lesson_id is null
                and exists (select 1 from public.enrollments e
                  where e.user_id = auth.uid() and e.status in ('ACTIVE', 'COMPLETED')))
              or ((a.related_module_id is not null or a.related_lesson_id is not null)
                and (a.related_module_id is null or exists (
                  select 1 from public.modules m
                  where m.id = a.related_module_id and private.has_course_enrollment(auth.uid(), m.course_id)))
                and (a.related_lesson_id is null or exists (
                  select 1 from public.lessons l join public.modules m on m.id = l.module_id
                  where l.id = a.related_lesson_id and private.has_course_enrollment(auth.uid(), m.course_id))))
            )
        )
      )
    );
$$;
revoke all on function private.can_view_practice_activity(uuid) from public, anon, authenticated;
grant execute on function private.can_view_practice_activity(uuid) to authenticated;

drop policy practice_activities_authenticated_select on public.practice_activities;
-- History stays readable (ADR 0016 §2): a published activity the Student already attempted remains visible
-- even after the enrollment ended (e.g. course transfer). Starting a new attempt still requires the helper.
create policy practice_activities_authenticated_select on public.practice_activities
  for select to authenticated using (
    private.can_view_practice_activity(id)
    or (
      private.content_visible('practice_activities', id)
      and exists (
        select 1 from public.practice_attempts pa
        where pa.practice_activity_id = practice_activities.id and pa.user_id = (select auth.uid())
      )
    )
  );

-- start_practice_attempt: body identical to 20261001155659 plus the enrollment scope check.
-- Out-of-scope activity: errcode 42501 'Practice activity is unavailable' (not the subscription gate message).
create or replace function public.start_practice_attempt(p_practice_activity_id uuid, p_idempotency_key uuid)
returns public.practice_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  activity_mode text;
  result_row public.practice_attempts;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'Practice idempotency key is required';
  end if;

  select activity.content ->> 'evaluationMode'
  into activity_mode
  from public.practice_activities activity
  where activity.id = p_practice_activity_id
    and activity.active
    and private.content_visible('practice_activities',activity.id);

  if activity_mode is null or activity_mode not in ('DETERMINISTIC', 'MANUAL_PENDING') then
    raise exception 'Practice activity is unsupported';
  end if;

  if not private.can_view_practice_activity(p_practice_activity_id) then
    raise exception 'Practice activity is unavailable' using errcode = '42501';
  end if;

  insert into public.practice_attempts (
    user_id,
    practice_activity_id,
    idempotency_key,
    context
  )
  values (
    actor_user_id,
    p_practice_activity_id,
    p_idempotency_key,
    jsonb_build_object('evaluation_mode', activity_mode)
  )
  on conflict (user_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into result_row;

  if result_row.practice_activity_id <> p_practice_activity_id then
    raise exception 'Idempotency key already belongs to another activity';
  end if;

  return result_row;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Detection of ACTIVE enrollments without an ACTIVE cohort membership (the legacy Students blocked from
--    recording progress by 06a). Read-only; ADMIN + aal2; names only (no e-mail).
-- ---------------------------------------------------------------------------------------------------------
create function public.admin_enrollments_without_active_cohort(p_limit integer default 100, p_offset integer default 0)
returns table (
  enrollment_id uuid,
  user_id uuid,
  course_id uuid,
  course_title text,
  display_name text,
  enrolled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 200
     or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'invalid paging input' using errcode = '22023';
  end if;

  return query
  select e.id, e.user_id, e.course_id, c.title, pr.display_name, e.enrolled_at
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  left join public.profiles pr on pr.user_id = e.user_id
  where e.status = 'ACTIVE'
    and not exists (
      select 1 from public.cohort_memberships m
      where m.enrollment_id = e.id and m.status = 'ACTIVE')
  order by e.enrolled_at, e.id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.admin_enrollments_without_active_cohort(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_enrollments_without_active_cohort(integer, integer) to authenticated;
