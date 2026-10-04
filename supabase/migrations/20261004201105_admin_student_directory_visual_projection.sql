create or replace function public.admin_student_directory_v2(
  p_query text default '',
  p_limit integer default 25,
  p_offset integer default 0,
  p_course_id uuid default null,
  p_cohort_id uuid default null,
  p_placement_state text default null,
  p_enrollment_status text default null
)
returns table (
  user_id uuid,
  display_name text,
  created_at timestamptz,
  course_id uuid,
  course_title text,
  cohort_id uuid,
  cohort_name text,
  enrollment_status text,
  placement_state text,
  completion_percent integer,
  next_session_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    where projection.enrollment_status = 'ACTIVE'
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
$$;

revoke all on function public.admin_student_directory_v2(text, integer, integer, uuid, uuid, text, text) from public, anon;
grant execute on function public.admin_student_directory_v2(text, integer, integer, uuid, uuid, text, text) to authenticated;
