-- PROMPT 06 — Auth, RBAC, RLS and security boundaries.
-- Authorization is enforced at the database boundary as well as on the server.
-- Staff access to privileged records requires an aal2 JWT.

alter table public.materials
  add column required_entitlement_key text
    references public.entitlements(key) on update cascade on delete restrict;

alter table public.materials
  add constraint protected_material_requires_private_storage
  check (
    required_entitlement_key is null
    or (storage_path is not null and external_url is null)
  );

alter table public.lesson_assets
  add column required_entitlement_key text
    references public.entitlements(key) on update cascade on delete restrict;

alter table public.lesson_assets
  add constraint protected_lesson_asset_requires_private_storage
  check (
    required_entitlement_key is null
    or (storage_path is not null and source_url is null)
  );

create table public.teacher_student_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create unique index teacher_student_assignments_one_open_assignment
  on public.teacher_student_assignments(teacher_id, student_user_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where ends_at is null;

create index teacher_student_assignments_student_idx
  on public.teacher_student_assignments(student_user_id, starts_at);

create table public.live_session_recordings (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete restrict,
  storage_path text not null,
  required_entitlement_key text
    references public.entitlements(key) on update cascade on delete restrict,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (live_session_id, storage_path)
);

create index live_session_recordings_session_idx
  on public.live_session_recordings(live_session_id, available_at desc);

alter table public.teacher_student_assignments enable row level security;
alter table public.live_session_recordings enable row level security;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_display_name text;
begin
  safe_display_name := coalesce(
    nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 120), ''),
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 120), ''),
    'Yas Student'
  );

  insert into public.profiles (user_id, display_name)
  values (new.id, safe_display_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (user_id, display_name)
select
  u.id,
  coalesce(
    nullif(left(trim(u.raw_user_meta_data ->> 'display_name'), 120), ''),
    nullif(left(split_part(coalesce(u.email, ''), '@', 1), 120), ''),
    'Yas Student'
  )
from auth.users u
on conflict (user_id) do nothing;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'yas-protected-assets',
  'yas-protected-assets',
  false,
  524288000,
  array[
    'application/pdf',
    'audio/mpeg',
    'audio/mp4',
    'video/mp4',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.has_role(
  p_role text,
  p_require_aal2 boolean default true
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (not p_require_aal2 or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2')
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = p_role
    );
$$;

create or replace function private.current_user_has_entitlement(p_entitlement_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce(
      private.entitlement_limit(
        (select auth.uid()),
        p_entitlement_key,
        now()
      ),
      0
    ) > 0;
$$;

create or replace function private.is_teacher_assigned(p_student_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_role('TEACHER', true)
    and exists (
      select 1
      from public.teachers t
      join public.teacher_student_assignments a on a.teacher_id = t.id
      where t.user_id = (select auth.uid())
        and t.active
        and a.student_user_id = p_student_user_id
        and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
    );
$$;

create or replace function private.can_view_student(p_student_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_student_user_id = (select auth.uid())
    or private.is_teacher_assigned(p_student_user_id)
    or private.has_role('SUPPORT', true)
    or private.has_role('ADMIN', true);
$$;

create or replace function private.is_teacher_for_session(p_live_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_role('TEACHER', true)
    and exists (
      select 1
      from public.live_sessions s
      join public.teachers t on t.id = s.teacher_id
      where s.id = p_live_session_id
        and t.user_id = (select auth.uid())
        and t.active
    );
$$;

create or replace function private.can_read_material(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.materials m
    where m.id = p_material_id
      and (
        private.has_role('ADMIN', true)
        or private.has_role('TEACHER', true)
        or (
          m.active
          and (
            m.required_entitlement_key is null
            or private.current_user_has_entitlement(m.required_entitlement_key)
          )
          and (
            (m.module_id is null and m.lesson_id is null)
            or exists (
              select 1
              from public.enrollments e
              join public.modules mo on mo.course_id = e.course_id
              where e.user_id = (select auth.uid())
                and e.status = 'ACTIVE'
                and mo.id = m.module_id
            )
            or exists (
              select 1
              from public.enrollments e
              join public.modules mo on mo.course_id = e.course_id
              join public.lessons l on l.module_id = mo.id
              where e.user_id = (select auth.uid())
                and e.status = 'ACTIVE'
                and l.id = m.lesson_id
            )
          )
        )
      )
  );
$$;

create or replace function private.can_read_lesson_asset(p_lesson_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lesson_assets a
    join public.lessons l on l.id = a.lesson_id
    join public.modules m on m.id = l.module_id
    where a.id = p_lesson_asset_id
      and (
        private.has_role('ADMIN', true)
        or private.has_role('TEACHER', true)
        or (
          (
            a.required_entitlement_key is null
            or private.current_user_has_entitlement(a.required_entitlement_key)
          )
          and exists (
            select 1
            from public.enrollments e
            where e.user_id = (select auth.uid())
              and e.course_id = m.course_id
              and e.status = 'ACTIVE'
          )
        )
      )
  );
$$;

create or replace function private.can_read_live_recording(p_recording_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.live_session_recordings r
    where r.id = p_recording_id
      and (
        private.has_role('ADMIN', true)
        or private.is_teacher_for_session(r.live_session_id)
        or (
          (
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

create or replace function private.audit_security_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_id uuid;
  details jsonb;
begin
  entity_id := case when tg_op = 'DELETE' then old.id else new.id end;

  if tg_table_name = 'user_roles' then
    details := jsonb_build_object(
      'operation', tg_op,
      'target_user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'role', case when tg_op = 'DELETE' then old.role else new.role end
    );
  elsif tg_table_name = 'plan_entitlements' then
    details := jsonb_build_object(
      'operation', tg_op,
      'plan_id', case when tg_op = 'DELETE' then old.plan_id else new.plan_id end,
      'entitlement_id', case when tg_op = 'DELETE' then old.entitlement_id else new.entitlement_id end,
      'limit_value', case when tg_op = 'DELETE' then old.limit_value else new.limit_value end,
      'cadence', case when tg_op = 'DELETE' then old.cadence else new.cadence end
    );
  elsif tg_table_name = 'subscriptions' then
    details := jsonb_build_object(
      'operation', tg_op,
      'target_user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'plan_id', case when tg_op = 'DELETE' then old.plan_id else new.plan_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end,
      'cancel_at_period_end',
        case when tg_op = 'DELETE' then old.cancel_at_period_end else new.cancel_at_period_end end
    );
  elsif tg_table_name = 'session_bookings' then
    details := jsonb_build_object(
      'operation', tg_op,
      'target_user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'live_session_id',
        case when tg_op = 'DELETE' then old.live_session_id else new.live_session_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end
    );
  elsif tg_table_name = 'lesson_progress' then
    details := jsonb_build_object(
      'operation', tg_op,
      'enrollment_id',
        case when tg_op = 'DELETE' then old.enrollment_id else new.enrollment_id end,
      'lesson_id', case when tg_op = 'DELETE' then old.lesson_id else new.lesson_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end,
      'progress_percent',
        case when tg_op = 'DELETE' then old.progress_percent else new.progress_percent end
    );
  else
    details := jsonb_build_object('operation', tg_op);
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    data
  )
  values (
    (select auth.uid()),
    'SECURITY_' || upper(tg_table_name) || '_' || tg_op,
    tg_table_name,
    entity_id,
    details
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger user_roles_audit
after insert or update or delete on public.user_roles
for each row execute function private.audit_security_change();

create trigger plan_entitlements_audit
after insert or update or delete on public.plan_entitlements
for each row execute function private.audit_security_change();

create trigger subscriptions_audit
after insert or update or delete on public.subscriptions
for each row execute function private.audit_security_change();

create trigger session_bookings_audit
after insert or update or delete on public.session_bookings
for each row execute function private.audit_security_change();

create trigger lesson_progress_audit
after insert or update or delete on public.lesson_progress
for each row execute function private.audit_security_change();

revoke all on all tables in schema public from anon, authenticated;

grant select on public.plans to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.plan_entitlements to authenticated;
grant select on public.courses to authenticated;
grant select on public.modules to authenticated;
grant select on public.lessons to authenticated;
grant select on public.lesson_assets to authenticated;
grant select on public.enrollments to authenticated;
grant select on public.lesson_progress to authenticated;
grant select on public.practice_activities to authenticated;
grant select on public.practice_attempts to authenticated;
grant select on public.practice_results to authenticated;
grant select on public.materials to authenticated;
grant select, insert, delete on public.material_favorites to authenticated;
grant select on public.assessments to authenticated;
grant select on public.assessment_versions to authenticated;
grant select on public.assessment_items to authenticated;
grant select on public.assessment_attempts to authenticated;
grant select on public.assessment_responses to authenticated;
grant select on public.skill_scores to authenticated;
grant select on public.teachers to authenticated;
grant select on public.teacher_availability to authenticated;
grant select on public.teacher_student_assignments to authenticated;
grant select on public.live_session_recordings to authenticated;
grant select on public.session_bookings to authenticated;
grant select on public.attendance to authenticated;
grant select on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;

grant select (
  id,
  user_id,
  display_name,
  avatar_url,
  locale,
  timezone,
  created_at,
  updated_at
) on public.profiles to authenticated;

grant update (
  display_name,
  locale,
  timezone
) on public.profiles to authenticated;

grant select (
  id,
  user_id,
  role,
  created_at
) on public.user_roles to authenticated;

grant select (
  id,
  user_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  started_at,
  ended_at,
  created_at,
  updated_at
) on public.subscriptions to authenticated;

grant select (
  id,
  teacher_id,
  session_type,
  title,
  starts_at,
  ends_at,
  capacity,
  required_entitlement_key,
  status,
  created_at,
  updated_at
) on public.live_sessions to authenticated;

grant select (
  id,
  provider,
  event_id,
  event_type,
  subscription_id,
  occurred_at,
  received_at,
  processed_at,
  processing_error
) on public.billing_events to authenticated;

create policy profiles_own_select
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_staff_select
on public.profiles for select
to authenticated
using (
  private.is_teacher_assigned(user_id)
  or private.has_role('SUPPORT', true)
  or private.has_role('ADMIN', true)
);

create policy profiles_own_update
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_roles_own_select
on public.user_roles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy user_roles_admin_select
on public.user_roles for select
to authenticated
using (private.has_role('ADMIN', true));

create policy plans_authenticated_select
on public.plans for select
to authenticated
using (active or private.has_role('ADMIN', true));

create policy entitlements_authenticated_select
on public.entitlements for select
to authenticated
using (active or private.has_role('ADMIN', true));

create policy plan_entitlements_authenticated_select
on public.plan_entitlements for select
to authenticated
using (
  effective_from <= now()
  and (effective_to is null or effective_to > now())
  or private.has_role('ADMIN', true)
);

create policy subscriptions_owner_or_staff_select
on public.subscriptions for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_role('SUPPORT', true)
  or private.has_role('ADMIN', true)
);

create policy courses_authenticated_select
on public.courses for select
to authenticated
using (
  active
  or private.has_role('TEACHER', true)
  or private.has_role('ADMIN', true)
);

create policy modules_authenticated_select
on public.modules for select
to authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = modules.course_id
      and c.active
  )
  or private.has_role('TEACHER', true)
  or private.has_role('ADMIN', true)
);

create policy lessons_authenticated_select
on public.lessons for select
to authenticated
using (
  exists (
    select 1
    from public.modules m
    join public.courses c on c.id = m.course_id
    where m.id = lessons.module_id
      and c.active
  )
  or private.has_role('TEACHER', true)
  or private.has_role('ADMIN', true)
);

create policy lesson_assets_authorized_select
on public.lesson_assets for select
to authenticated
using (private.can_read_lesson_asset(id));

create policy enrollments_authorized_select
on public.enrollments for select
to authenticated
using (private.can_view_student(user_id));

create policy lesson_progress_authorized_select
on public.lesson_progress for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    where e.id = lesson_progress.enrollment_id
      and private.can_view_student(e.user_id)
  )
);

create policy practice_activities_authenticated_select
on public.practice_activities for select
to authenticated
using (
  active
  or private.has_role('TEACHER', true)
  or private.has_role('ADMIN', true)
);

create policy practice_attempts_authorized_select
on public.practice_attempts for select
to authenticated
using (private.can_view_student(user_id));

create policy practice_results_authorized_select
on public.practice_results for select
to authenticated
using (
  exists (
    select 1
    from public.practice_attempts a
    where a.id = practice_results.practice_attempt_id
      and private.can_view_student(a.user_id)
  )
);

create policy materials_authorized_select
on public.materials for select
to authenticated
using (private.can_read_material(id));

create policy material_favorites_own_select
on public.material_favorites for select
to authenticated
using ((select auth.uid()) = user_id);

create policy material_favorites_own_insert
on public.material_favorites for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.materials m
    where m.id = material_id
  )
);

create policy material_favorites_own_delete
on public.material_favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy assessments_authenticated_select
on public.assessments for select
to authenticated
using (
  active
  or private.has_role('TEACHER', true)
  or private.has_role('ADMIN', true)
);

create policy assessment_versions_published_select
on public.assessment_versions for select
to authenticated
using (
  status = 'PUBLISHED'
  or private.has_role('ADMIN', true)
);

create policy assessment_items_published_select
on public.assessment_items for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_versions v
    where v.id = assessment_items.assessment_version_id
      and v.status = 'PUBLISHED'
  )
  or private.has_role('ADMIN', true)
);

create policy assessment_attempts_authorized_select
on public.assessment_attempts for select
to authenticated
using (private.can_view_student(user_id));

create policy assessment_responses_authorized_select
on public.assessment_responses for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_attempts a
    where a.id = assessment_responses.assessment_attempt_id
      and private.can_view_student(a.user_id)
  )
);

create policy skill_scores_authorized_select
on public.skill_scores for select
to authenticated
using (
  exists (
    select 1
    from public.assessment_attempts a
    where a.id = skill_scores.assessment_attempt_id
      and private.can_view_student(a.user_id)
  )
);

create policy teachers_authenticated_select
on public.teachers for select
to authenticated
using (active or user_id = (select auth.uid()) or private.has_role('ADMIN', true));

create policy teacher_availability_authenticated_select
on public.teacher_availability for select
to authenticated
using (
  exists (
    select 1
    from public.teachers t
    where t.id = teacher_availability.teacher_id
      and t.active
  )
  or private.has_role('ADMIN', true)
);

create policy teacher_assignments_teacher_or_admin_select
on public.teacher_student_assignments for select
to authenticated
using (
  private.has_role('ADMIN', true)
  or (
    private.has_role('TEACHER', true)
    and exists (
      select 1
      from public.teachers t
      where t.id = teacher_student_assignments.teacher_id
        and t.user_id = (select auth.uid())
    )
  )
);

create policy live_sessions_authenticated_select
on public.live_sessions for select
to authenticated
using (
  status in ('SCHEDULED', 'COMPLETED')
  or private.is_teacher_for_session(id)
  or private.has_role('SUPPORT', true)
  or private.has_role('ADMIN', true)
  or exists (
    select 1
    from public.session_bookings b
    where b.live_session_id = live_sessions.id
      and b.user_id = (select auth.uid())
  )
);

create policy session_bookings_authorized_select
on public.session_bookings for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_teacher_for_session(live_session_id)
  or private.has_role('SUPPORT', true)
  or private.has_role('ADMIN', true)
);

create policy attendance_authorized_select
on public.attendance for select
to authenticated
using (
  exists (
    select 1
    from public.session_bookings b
    where b.id = attendance.session_booking_id
      and (
        b.user_id = (select auth.uid())
        or private.is_teacher_for_session(b.live_session_id)
        or private.has_role('ADMIN', true)
      )
  )
);

create policy live_recordings_authorized_select
on public.live_session_recordings for select
to authenticated
using (private.can_read_live_recording(id));

create policy notifications_own_select
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));

create policy audit_logs_admin_select
on public.audit_logs for select
to authenticated
using (private.has_role('ADMIN', true));

create policy billing_events_admin_select
on public.billing_events for select
to authenticated
using (private.has_role('ADMIN', true));

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

grant execute on function private.has_role(text, boolean) to authenticated;
grant execute on function private.current_user_has_entitlement(text) to authenticated;
grant execute on function private.is_teacher_assigned(uuid) to authenticated;
grant execute on function private.can_view_student(uuid) to authenticated;
grant execute on function private.is_teacher_for_session(uuid) to authenticated;
grant execute on function private.can_read_material(uuid) to authenticated;
grant execute on function private.can_read_lesson_asset(uuid) to authenticated;
grant execute on function private.can_read_live_recording(uuid) to authenticated;
