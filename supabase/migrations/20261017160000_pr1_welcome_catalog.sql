-- PR1 / Block 1C: initial "welcome" catalog for paying students who are still waiting for placement
-- review. Admin flags lessons and materials as `welcome`; a practice is welcome when its related lesson
-- is. Access is server-enforced (RLS + RPC), limited to the pre-enrollment placement states, still
-- requires paid access and the item's entitlement, and never opens other courses/cohorts.
alter table public.lessons add column welcome boolean not null default false;
alter table public.materials add column welcome boolean not null default false;

create or replace function private.content_fields(p_kind text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
 case p_kind
 when 'courses' then return array['slug','title','description','active'];
 when 'modules' then return array['course_id','position','title','description','audience'];
 when 'lessons' then return array['module_id','position','slug','title','estimated_minutes','audience','welcome'];
 when 'lesson_assets' then return array['lesson_id','asset_type','position','source_url','content','metadata','required_entitlement_key'];
 when 'materials' then return array['title','material_type','module_id','lesson_id','external_url','metadata','active','required_entitlement_key','audience','welcome'];
 when 'practice_activities' then return array['slug','title','skill','cefr_target','difficulty','estimated_minutes','related_module_id','related_lesson_id','content','active'];
 else raise exception 'Unsupported content entity' using errcode='22023';
 end case;
end $$;

-- Progress before enrollment cannot live in lesson_progress (enrollment_id is required there).
create table public.welcome_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  status text not null check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
  completion_percent numeric(5,2) not null default 0 check (completion_percent between 0 and 100),
  last_position_seconds integer check (last_position_seconds is null or last_position_seconds >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.welcome_lesson_progress enable row level security;
create policy welcome_progress_own_select on public.welcome_lesson_progress for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.welcome_lesson_progress from anon, authenticated;
grant select on public.welcome_lesson_progress to authenticated;

-- Pre-enrollment placement states in which the welcome catalog is open. From PLACEMENT_READY on, the
-- Student must confirm a cohort first; a paid student with no enrollment then sees no pedagogic content.
create function private.welcome_access(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and private.has_paid_access(p_user) and exists (
    select 1 from public.placement_cases c where c.user_id = p_user
      and c.state in ('PAYMENT_CONFIRMED','ASSESSMENT_REQUIRED','IN_PROGRESS','REVIEW_PENDING'));
$$;

create function private.welcome_can_read(p_kind text, p_id uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and private.welcome_access(p_user) and case p_kind
    when 'lessons' then exists (select 1 from public.lessons l where l.id = p_id and l.welcome
      and private.content_visible('lessons', l.id))
    when 'modules' then private.content_visible('modules', p_id) and exists (
      select 1 from public.lessons l where l.module_id = p_id and l.welcome and private.content_visible('lessons', l.id))
    when 'courses' then private.content_visible('courses', p_id) and exists (
      select 1 from public.lessons l join public.modules m on m.id = l.module_id
      where m.course_id = p_id and l.welcome and private.content_visible('lessons', l.id))
    when 'lesson_assets' then exists (select 1 from public.lesson_assets a join public.lessons l on l.id = a.lesson_id
      where a.id = p_id and l.welcome and private.content_visible('lesson_assets', a.id)
        and (a.required_entitlement_key is null or private.current_user_has_entitlement(a.required_entitlement_key)))
    when 'materials' then exists (select 1 from public.materials m where m.id = p_id and m.welcome
      and private.content_visible('materials', m.id)
      and (m.required_entitlement_key is null or private.current_user_has_entitlement(m.required_entitlement_key)))
    when 'practice_activities' then exists (select 1 from public.practice_activities a join public.lessons l on l.id = a.related_lesson_id
      where a.id = p_id and a.audience = 'COURSE' and l.welcome and private.content_visible('practice_activities', a.id))
    else false end;
$$;
revoke all on function private.welcome_access(uuid), private.welcome_can_read(text, uuid, uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.can_read_material_base(p_material_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists (select 1 from public.materials m where m.id=p_material_id and (
  private.has_role('ADMIN',true) or (private.content_visible('materials',m.id) and (
    private.has_role('TEACHER',true) or (
      private.student_path_available('materials',m.id,auth.uid()) and private.has_paid_access(auth.uid()) and
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
$function$;

CREATE OR REPLACE FUNCTION private.can_read_lesson_asset_base(p_lesson_asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists (select 1 from public.lesson_assets a join public.lessons l on l.id=a.lesson_id join public.modules m on m.id=l.module_id
where a.id=p_lesson_asset_id and (private.has_role('ADMIN',true) or (
 private.content_visible('lesson_assets',a.id) and (private.has_role('TEACHER',true) or (
  private.student_path_available('lessons',l.id,auth.uid()) and private.has_paid_access(auth.uid()) and
  (a.required_entitlement_key is null or private.current_user_has_entitlement(a.required_entitlement_key)) and exists (
   select 1 from public.enrollments e where e.user_id=auth.uid() and e.course_id=m.course_id and e.status in ('ACTIVE','COMPLETED')
  )
 ))
)));
$function$;

CREATE OR REPLACE FUNCTION private.can_view_practice_activity_base(p_activity uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.has_role('ADMIN', true)
    or (
      private.content_visible('practice_activities', p_activity)
      and exists (
        select 1 from public.practice_activities a
        where a.id = p_activity
          and auth.uid() is not null
          and (private.has_role('TEACHER',true) or private.student_path_available('practice_activities',a.id,auth.uid()))
          and case when a.audience = 'ASSIGNED' then
            -- Teachers: only the author and Teachers of an assigned cohort. Students: assigned cohort + membership + enrollment.
            (private.has_role('TEACHER', true) and (
               exists (select 1 from public.teachers t where t.id = a.created_by_teacher_id and t.user_id = auth.uid())
               or exists (select 1 from public.cohort_practice_assignments pa
                          where pa.practice_activity_id = a.id and private.is_cohort_teacher(pa.cohort_id))))
            or (a.course_id is not null and private.has_course_enrollment(auth.uid(), a.course_id)
                and exists (select 1 from public.cohort_practice_assignments pa
                            where pa.practice_activity_id = a.id and private.has_cohort_membership(pa.cohort_id, auth.uid())))
          else
            -- Stage 11 rule, unchanged.
            private.has_role('TEACHER', true)
            or (a.related_module_id is null and a.related_lesson_id is null
                and exists (select 1 from public.enrollments e
                  where e.user_id = auth.uid() and e.status in ('ACTIVE', 'COMPLETED')))
            or ((a.related_module_id is not null or a.related_lesson_id is not null)
                and (a.related_module_id is null or exists (
                  select 1 from public.modules m
                  where m.id = a.related_module_id and private.has_course_enrollment(auth.uid(), m.course_id)))
                and (a.related_lesson_id is null or exists (
                  select 1 from public.lessons l join public.modules m on m.id = l.module_id
                  where l.id = a.related_lesson_id and private.has_course_enrollment(auth.uid(), m.course_id))))
          end
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_read_learning_metadata_base(p_kind text, p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.has_role('ADMIN',true) or (private.content_visible(p_kind,p_id) and (
    private.has_role('TEACHER',true) or
    case when p_kind='courses' then
      private.has_course_enrollment(auth.uid(),p_id) or exists(
        select 1 from public.placement_reviews r join public.placement_cases c on c.id=r.placement_case_id
        where c.user_id=auth.uid() and r.recommended_course_id=p_id)
    else private.student_path_includes(p_kind,p_id,auth.uid()) end
  ));
$function$;

CREATE OR REPLACE FUNCTION private.practice_lesson_reached_base(p_user uuid, p_activity uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  act public.practice_activities;
  v_course uuid;
  v_lesson_course uuid;
  v_current uuid;
begin
  if p_user is null then
    return false;
  end if;

  select * into act from public.practice_activities a where a.id = p_activity;
  if act.id is null then
    return false;
  end if;

  -- (a) Not linked to course content.
  if act.related_lesson_id is null and act.related_module_id is null then
    return true;
  end if;

  select m.course_id into v_lesson_course
  from public.lessons l join public.modules m on m.id = l.module_id
  where l.id = act.related_lesson_id;
  v_course := coalesce(
    v_lesson_course,
    (select m.course_id from public.modules m where m.id = act.related_module_id),
    act.course_id
  );

  -- (b) Teacher assignment to one of the Student's cohorts bypasses lesson gating (decision A).
  if v_course is not null and exists (
    select 1 from public.cohort_practice_assignments pa
    where pa.practice_activity_id = act.id
      and pa.cohort_id in (select private.student_course_cohorts(p_user, v_course))
  ) then
    return true;
  end if;

  if act.related_lesson_id is not null then
    -- (c) Lesson completed, started or accessed.
    if exists (
      select 1 from public.lesson_progress lp
      where lp.user_id = p_user and lp.lesson_id = act.related_lesson_id
    ) then
      return true;
    end if;
    -- (d) The Student's current lesson.
    v_current := private.student_current_lesson(p_user, v_course);
    return v_current is not null and v_current = act.related_lesson_id;
  end if;

  -- (e) Module-only link: any lesson of the module satisfies (c) or (d).
  -- A module without lessons has nothing to wait for and is never blocked.
  if not exists (select 1 from public.lessons l where l.module_id = act.related_module_id) then
    return true;
  end if;
  if exists (
    select 1 from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = p_user and l.module_id = act.related_module_id
  ) then
    return true;
  end if;
  v_current := private.student_current_lesson(p_user, v_course);
  return v_current is not null and exists (
    select 1 from public.lessons l where l.id = v_current and l.module_id = act.related_module_id
  );
end;
$function$;

revoke all on function private.can_read_material_base(uuid), private.can_read_lesson_asset_base(uuid),
  private.can_view_practice_activity_base(uuid), private.can_read_learning_metadata_base(text, uuid),
  private.practice_lesson_reached_base(uuid, uuid) from public, anon, authenticated;

-- Public entry points keep their identity (policies and callers bind to them) and add the welcome branch.
create or replace function private.can_read_material(p_material_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_read_material_base(p_material_id) or private.welcome_can_read('materials', p_material_id, auth.uid());
$$;
create or replace function private.can_read_lesson_asset(p_lesson_asset_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_read_lesson_asset_base(p_lesson_asset_id) or private.welcome_can_read('lesson_assets', p_lesson_asset_id, auth.uid());
$$;
create or replace function private.can_view_practice_activity(p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_view_practice_activity_base(p_activity) or private.welcome_can_read('practice_activities', p_activity, auth.uid());
$$;
create or replace function private.can_read_learning_metadata(p_kind text, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_read_learning_metadata_base(p_kind, p_id) or private.welcome_can_read(p_kind, p_id, auth.uid());
$$;
-- A welcome practice is reached once its welcome lesson has been opened (same rule as enrolled students).
create or replace function private.practice_lesson_reached(p_user uuid, p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.practice_lesson_reached_base(p_user, p_activity) or exists (
    select 1 from public.practice_activities a
    join public.welcome_lesson_progress w on w.lesson_id = a.related_lesson_id and w.user_id = p_user
    where a.id = p_activity and private.welcome_can_read('practice_activities', a.id, p_user));
$$;

create function public.record_welcome_lesson_progress(
  p_lesson_id uuid, p_completion_percent numeric, p_last_position_seconds integer default null
) returns public.welcome_lesson_progress language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.welcome_lesson_progress;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_completion_percent is null or p_completion_percent < 0 or p_completion_percent > 100 then
    raise exception 'completion_percent must be between 0 and 100' using errcode = '22023';
  end if;
  if p_last_position_seconds is not null and p_last_position_seconds < 0 then
    raise exception 'last_position_seconds must be non-negative' using errcode = '22023';
  end if;
  if not private.welcome_can_read('lessons', p_lesson_id, v_user) then
    raise exception 'Welcome lesson unavailable' using errcode = '42501';
  end if;
  insert into public.welcome_lesson_progress(user_id, lesson_id, status, completion_percent,
    last_position_seconds, started_at, completed_at)
  values (v_user, p_lesson_id,
    case when p_completion_percent >= 100 then 'COMPLETED' when p_completion_percent > 0 then 'IN_PROGRESS' else 'NOT_STARTED' end,
    p_completion_percent, p_last_position_seconds,
    case when p_completion_percent > 0 then now() end,
    case when p_completion_percent >= 100 then now() end)
  on conflict (user_id, lesson_id) do update set
    completion_percent = greatest(public.welcome_lesson_progress.completion_percent, excluded.completion_percent),
    status = case when greatest(public.welcome_lesson_progress.completion_percent, excluded.completion_percent) >= 100 then 'COMPLETED'
                  when greatest(public.welcome_lesson_progress.completion_percent, excluded.completion_percent) > 0 then 'IN_PROGRESS'
                  else 'NOT_STARTED' end,
    last_position_seconds = coalesce(excluded.last_position_seconds, public.welcome_lesson_progress.last_position_seconds),
    started_at = coalesce(public.welcome_lesson_progress.started_at, excluded.started_at),
    completed_at = case when greatest(public.welcome_lesson_progress.completion_percent, excluded.completion_percent) >= 100
                        then coalesce(public.welcome_lesson_progress.completed_at, now()) end,
    last_accessed_at = now(), updated_at = now()
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.record_welcome_lesson_progress(uuid, numeric, integer) from public, anon;
grant execute on function public.record_welcome_lesson_progress(uuid, numeric, integer) to authenticated;

-- Once the Student's cohort membership exists, welcome progress that belongs to the enrolled course is
-- carried into lesson_progress. Progress in other courses stays in the welcome table.
create function private.reconcile_welcome_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'ACTIVE' then
    insert into public.lesson_progress(enrollment_id, lesson_id, user_id, status, completion_percent,
      last_position_seconds, started_at, last_accessed_at, completed_at, updated_at)
    select e.id, w.lesson_id, w.user_id, w.status, w.completion_percent, w.last_position_seconds,
           w.started_at, w.last_accessed_at, w.completed_at, now()
    from public.enrollments e
    join public.welcome_lesson_progress w on w.user_id = e.user_id
    join public.lessons l on l.id = w.lesson_id
    join public.modules m on m.id = l.module_id and m.course_id = e.course_id
    where e.id = new.enrollment_id and w.status <> 'NOT_STARTED'
    on conflict (user_id, lesson_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.reconcile_welcome_progress() from public, anon, authenticated;
create trigger welcome_progress_reconcile after insert on public.cohort_memberships
  for each row execute function private.reconcile_welcome_progress();
