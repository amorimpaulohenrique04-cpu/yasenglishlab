create or replace function public.get_teacher_operation_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  teacher uuid := private.current_teacher_id();
  result jsonb;
begin
  select jsonb_build_object(
    'cohorts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bounded.id, 'name', bounded.name, 'timezone', bounded.timezone,
        'capacity', bounded.capacity, 'occupancy', bounded.occupancy,
        'schedule', bounded.schedule, 'students', bounded.students,
        'next_sessions', bounded.next_sessions
      ) order by bounded.name, bounded.id)
      from (
        select c.id, c.name, c.timezone, settings.capacity,
          coalesce(members.occupancy, 0) as occupancy,
          coalesce(settings.schedule, '[]'::jsonb) as schedule,
          coalesce(members.students, '[]'::jsonb) as students,
          coalesce(sessions.next_sessions, '[]'::jsonb) as next_sessions
        from public.cohorts c
        join public.cohort_teachers ct on ct.cohort_id = c.id
          and ct.teacher_id = teacher and ct.ends_at is null
        left join public.cohort_placement_settings settings on settings.cohort_id = c.id
        left join lateral (
          select count(*)::integer as occupancy,
            (select coalesce(jsonb_agg(jsonb_build_object('id', roster.user_id, 'name', roster.display_name)
              order by roster.display_name, roster.user_id), '[]'::jsonb)
             from (select p.user_id, p.display_name
               from public.cohort_memberships m2 join public.profiles p on p.user_id=m2.user_id
               where m2.cohort_id=c.id and m2.status='ACTIVE'
               order by p.display_name, p.user_id limit 20) roster) as students
          from public.cohort_memberships m where m.cohort_id=c.id and m.status='ACTIVE'
        ) members on true
        left join lateral (
          select coalesce(jsonb_agg(jsonb_build_object('id', upcoming.id, 'title', upcoming.title,
            'starts_at', upcoming.starts_at, 'ends_at', upcoming.ends_at)
            order by upcoming.starts_at), '[]'::jsonb) as next_sessions
          from (select s.id,s.title,s.starts_at,s.ends_at from public.live_sessions s
            where s.cohort_id=c.id and s.status='SCHEDULED' and s.starts_at>=now()
            order by s.starts_at,s.id limit 3) upcoming
        ) sessions on true
        where c.status <> 'ARCHIVED'
        order by c.name,c.id limit 50
      ) bounded
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id', bounded.user_id, 'name', bounded.display_name)
        order by bounded.display_name, bounded.user_id)
      from (select p.user_id,p.display_name from public.profiles p
        where private.is_teacher_assigned(p.user_id)
        order by p.display_name,p.user_id limit 200) bounded
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(jsonb_build_object('id', bounded.id, 'starts_at', bounded.starts_at,
        'ends_at', bounded.ends_at) order by bounded.starts_at,bounded.id)
      from (select a.id,a.starts_at,a.ends_at from public.teacher_availability a
        where a.teacher_id=teacher order by a.starts_at,a.id limit 50) bounded
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', bounded.id, 'title', bounded.title,
        'session_type', bounded.session_type, 'starts_at', bounded.starts_at, 'ends_at', bounded.ends_at,
        'capacity', bounded.capacity, 'cohort_id', bounded.cohort_id,
        'target_student_user_id', bounded.target_student_user_id, 'has_bookings', bounded.has_bookings)
        order by bounded.starts_at,bounded.id)
      from (select s.id,s.title,s.session_type,s.starts_at,s.ends_at,s.capacity,s.cohort_id,
        s.target_student_user_id,exists(select 1 from public.session_bookings b where b.live_session_id=s.id) as has_bookings
        from public.live_sessions s where s.teacher_id=teacher
        order by s.starts_at desc,s.id limit 100) bounded
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_teacher_operation_context() from public, anon, authenticated;
grant execute on function public.get_teacher_operation_context() to authenticated;

create or replace function public.get_teacher_reviews(p_attempt uuid default null)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.current_teacher_id();
  return query
  select jsonb_build_object('id', a.id, 'studentId', a.user_id, 'studentName', p.display_name,
    'title', activity.title, 'skill', activity.skill, 'prompt', activity.content->>'prompt',
    'response', response.response, 'submittedAt', a.submitted_at,
    'status', result.evaluation_status)
  from public.practice_attempts a
  join public.practice_activities activity on activity.id=a.practice_activity_id
  join public.profiles p on p.user_id=a.user_id
  join public.practice_responses response on response.practice_attempt_id=a.id
  join public.practice_results result on result.practice_attempt_id=a.id
  where private.is_teacher_assigned(a.user_id)
    and activity.skill in ('SPEAKING','PRONUNCIATION')
    and (case when p_attempt is null then result.evaluation_status='PENDING_MANUAL'
      else a.id=p_attempt and result.evaluation_status in ('PENDING_MANUAL','MANUAL_REVIEWED') end)
  order by a.submitted_at,a.id
  limit case when p_attempt is null then 100 else 1 end;
end;
$$;
revoke all on function public.get_teacher_reviews(uuid) from public, anon, authenticated;
grant execute on function public.get_teacher_reviews(uuid) to authenticated;
