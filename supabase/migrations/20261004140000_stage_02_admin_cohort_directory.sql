create or replace function public.admin_cohort_directory(
  p_limit integer default 25,
  p_offset integer default 0,
  p_query text default null
)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN with aal2 required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50
    or p_offset is null or p_offset not between 0 and 10000
    or char_length(coalesce(p_query, '')) > 120 then
    raise exception 'invalid cohort directory bounds' using errcode = '22023';
  end if;

  return query
  select jsonb_build_object(
    'id', c.id,
    'course_id', c.course_id,
    'course_title', course.title,
    'name', c.name,
    'code', c.code,
    'status', c.status,
    'timezone', c.timezone,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'capacity', settings.capacity,
    'schedule', settings.schedule,
    'occupancy', coalesce(members.occupancy, 0),
    'student_count', coalesce(members.student_count, 0),
    'students', coalesce(members.students, '[]'::jsonb),
    'teachers', coalesce(teachers.teachers, '[]'::jsonb),
    'next_sessions', coalesce(sessions.next_sessions, '[]'::jsonb)
  )
  from public.cohorts c
  join public.courses course on course.id = c.course_id
  left join public.cohort_placement_settings settings on settings.cohort_id = c.id
  left join lateral (
    select count(*) filter (where m.status = 'ACTIVE')::integer as occupancy,
      count(*)::integer as student_count,
      coalesce((
        select jsonb_agg(jsonb_build_object('user_id', roster.user_id, 'name', roster.display_name)
          order by roster.display_name, roster.user_id)
        from (
          select m2.user_id, p.display_name
          from public.cohort_memberships m2
          join public.profiles p on p.user_id = m2.user_id
          where m2.cohort_id = c.id and m2.status = 'ACTIVE'
          order by p.display_name, m2.user_id limit 20
        ) roster
      ), '[]'::jsonb) as students
    from public.cohort_memberships m
    where m.cohort_id = c.id and m.status = 'ACTIVE'
  ) members on true
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'teacher_id', bounded.teacher_id,
      'name', bounded.display_name,
      'is_primary', bounded.is_primary
    ) order by bounded.is_primary desc, bounded.display_name), '[]'::jsonb) as teachers
    from (
      select ct.teacher_id, p.display_name, ct.is_primary
      from public.cohort_teachers ct
      join public.teachers t on t.id = ct.teacher_id
      join public.profiles p on p.user_id = t.user_id
      where ct.cohort_id = c.id and ct.ends_at is null
      order by ct.is_primary desc, p.display_name limit 10
    ) bounded
  ) teachers on true
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', bounded.id, 'title', bounded.title,
      'starts_at', bounded.starts_at, 'ends_at', bounded.ends_at
    ) order by bounded.starts_at), '[]'::jsonb) as next_sessions
    from (
      select s.id, s.title, s.starts_at, s.ends_at
      from public.live_sessions s
      where s.cohort_id = c.id and s.starts_at >= now()
        and s.status = 'SCHEDULED'
      order by s.starts_at, s.id limit 3
    ) bounded
  ) sessions on true
  where p_query is null or c.name ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    or c.code ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
    or course.title ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
  order by c.starts_at desc, c.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_cohort_directory(integer, integer, text) from public, anon, authenticated;
grant execute on function public.admin_cohort_directory(integer, integer, text) to authenticated;

create or replace function public.set_primary_cohort_teacher(p_cohort_id uuid, p_teacher_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare assignment_id uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN with aal2 required' using errcode = '42501';
  end if;
  perform 1 from public.cohorts where id = p_cohort_id and status <> 'ARCHIVED' for update;
  if not found then raise exception 'cohort not found' using errcode = '23503'; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id and active) then
    raise exception 'active Teacher required' using errcode = '23514';
  end if;
  if exists (select 1 from public.cohort_teachers where cohort_id = p_cohort_id
    and teacher_id = p_teacher_id and is_primary and ends_at is null) then
    return p_cohort_id;
  end if;
  update public.cohort_teachers set is_primary = false
    where cohort_id = p_cohort_id and is_primary and ends_at is null;
  update public.cohort_teachers set is_primary = true
    where cohort_id = p_cohort_id and teacher_id = p_teacher_id and ends_at is null
    returning id into assignment_id;
  if assignment_id is null then
    insert into public.cohort_teachers(cohort_id, teacher_id, is_primary)
      values (p_cohort_id, p_teacher_id, true) returning id into assignment_id;
  end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'cohort_primary_teacher_changed', 'cohort', p_cohort_id,
      jsonb_build_object('teacher_id', p_teacher_id, 'assignment_id', assignment_id));
  return assignment_id;
end;
$$;
revoke all on function public.set_primary_cohort_teacher(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_primary_cohort_teacher(uuid, uuid) to authenticated;

create or replace function public.configure_cohort_placement(
  p_cohort_id uuid,
  p_capacity integer,
  p_schedule jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  perform 1 from public.cohorts where id = p_cohort_id for update;
  if not found then raise exception 'cohort not found' using errcode = '23503'; end if;
  if exists (select 1 from public.cohort_placement_settings
    where cohort_id = p_cohort_id and capacity = p_capacity and schedule = p_schedule) then
    return;
  end if;
  insert into public.cohort_placement_settings(cohort_id, capacity, schedule)
    values (p_cohort_id, p_capacity, p_schedule)
  on conflict (cohort_id) do update
    set capacity = excluded.capacity, schedule = excluded.schedule;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'cohort_placement_configured', 'cohort', p_cohort_id,
      jsonb_build_object('capacity', p_capacity, 'schedule', p_schedule));
end;
$$;
revoke all on function public.configure_cohort_placement(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.configure_cohort_placement(uuid, integer, jsonb) to authenticated;

create or replace function private.guard_cohort_relationship_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'cohort_memberships' then
    if old.status = 'ACTIVE' and new.status <> 'ACTIVE'
      and exists (select 1 from public.placement_cases c
        where c.state = 'ENROLLED' and c.membership_id = old.id) then
      raise exception 'use Enrollment Core cohort transfer for enrolled Students' using errcode = '23514';
    end if;
  elsif tg_table_name = 'cohort_teachers' then
    if old.ends_at is null and new.ends_at is not null then
      if exists (select 1 from public.live_sessions s where s.cohort_id = old.cohort_id
        and s.teacher_id = old.teacher_id and s.status = 'SCHEDULED' and s.starts_at >= now()) then
        raise exception 'resolve future sessions before ending this Teacher relationship' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cohort_membership_end_guard on public.cohort_memberships;
create trigger cohort_membership_end_guard before update on public.cohort_memberships
for each row execute function private.guard_cohort_relationship_end();
drop trigger if exists cohort_teacher_end_guard on public.cohort_teachers;
create trigger cohort_teacher_end_guard before update on public.cohort_teachers
for each row execute function private.guard_cohort_relationship_end();

create or replace function public.transfer_placement_cohort(
  p_case_id uuid,
  p_cohort_id uuid,
  p_operation_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  placement public.placement_cases;
  prior_membership public.cohort_memberships;
  target_cohort public.cohorts;
  prior_transfer public.placement_transfers;
  target_enrollment uuid;
  target_membership uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if p_operation_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'operation and reason required' using errcode = '23514';
  end if;
  select * into placement from public.placement_cases where id = p_case_id for update;
  if placement.id is null or placement.state <> 'ENROLLED' then
    raise exception 'enrolled placement required' using errcode = '23514';
  end if;
  select * into prior_transfer from public.placement_transfers where operation_id = p_operation_id;
  if prior_transfer.operation_id is not null then
    if row(prior_transfer.placement_case_id, prior_transfer.target_cohort_id,
      prior_transfer.actor_user_id, prior_transfer.reason)
      is distinct from row(placement.id, p_cohort_id, auth.uid(), btrim(p_reason)) then
      raise exception 'conflicting transfer retry' using errcode = '23514';
    end if;
    return prior_transfer.membership_id;
  end if;
  select * into prior_membership from public.cohort_memberships where id = placement.membership_id;
  perform 1 from public.cohorts where id in (prior_membership.cohort_id, p_cohort_id) order by id for update;
  select * into target_cohort from public.cohorts where id = p_cohort_id;
  if target_cohort.id = prior_membership.cohort_id
    or not private.placement_cohort_compatible(placement.id, p_cohort_id, false) then
    raise exception 'transfer cohort incompatible' using errcode = '23514';
  end if;
  select id into target_enrollment from public.enrollments
    where user_id = placement.user_id and course_id = target_cohort.course_id and status = 'ACTIVE'
    order by created_at desc limit 1;
  if target_enrollment is null then
    insert into public.enrollments(user_id, course_id, status)
      values (placement.user_id, target_cohort.course_id, 'ACTIVE')
      on conflict (user_id, course_id) do update set status = 'ACTIVE', completed_at = null
      returning id into target_enrollment;
  end if;

  insert into public.cohort_memberships(cohort_id, user_id, enrollment_id)
    values (target_cohort.id, placement.user_id, target_enrollment)
    returning id into target_membership;
  update public.placement_cases set membership_id = target_membership where id = placement.id;
  update public.cohort_memberships set status = 'LEFT', ends_at = clock_timestamp()
    where id = prior_membership.id;
  insert into public.placement_transfers(operation_id, placement_case_id, target_cohort_id,
    prior_membership_id, membership_id, actor_user_id, reason)
    values (p_operation_id, placement.id, target_cohort.id, prior_membership.id,
      target_membership, auth.uid(), btrim(p_reason));
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'placement_cohort_transferred', 'placement_case', placement.id,
      jsonb_build_object('operation_id', p_operation_id, 'membership_id', target_membership));
  return target_membership;
end;
$$;

revoke all on function private.guard_cohort_relationship_end() from public, anon, authenticated;
revoke all on function public.transfer_placement_cohort(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.transfer_placement_cohort(uuid, uuid, uuid, text) to authenticated;
