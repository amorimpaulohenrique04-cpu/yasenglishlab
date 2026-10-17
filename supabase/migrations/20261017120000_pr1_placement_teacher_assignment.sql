-- PR1 / Block 1A: Admin suggests and confirms the Teacher who reviews a new student's placement.
-- Additive only. The Teacher review scope (private.is_teacher_assigned) is unchanged: confirming a
-- suggestion creates a direct teacher_student_assignments row, never an implicit grant.

create function public.list_placement_teacher_candidates(p_case_id uuid)
returns table(
  teacher_id uuid,
  display_name text,
  open_cases integer,
  recent_assignments integer,
  assigned_students integer,
  suggested boolean,
  assigned boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_student uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  select c.user_id into v_student from public.placement_cases c where c.id = p_case_id;
  if not found then raise exception 'case not found' using errcode = '23503'; end if;

  return query
  with load as (
    select
      t.id as tid,
      t.user_id as tuser,
      (select count(*) from public.placement_cases pc
        where pc.state = 'REVIEW_PENDING'
          and exists (select 1 from public.teacher_student_assignments a
            where a.teacher_id = t.id and a.student_user_id = pc.user_id
              and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())))::integer as open_cases,
      (select count(*) from public.teacher_student_assignments a
        where a.teacher_id = t.id and a.created_at > now() - interval '30 days')::integer as recent,
      (select count(*) from public.teacher_student_assignments a
        where a.teacher_id = t.id and a.starts_at <= now()
          and (a.ends_at is null or a.ends_at > now()))::integer as students,
      exists (select 1 from public.teacher_student_assignments a
        where a.teacher_id = t.id and a.student_user_id = v_student
          and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())) as is_assigned
    from public.teachers t
    where t.active
      and exists (select 1 from public.user_roles ur where ur.user_id = t.user_id and ur.role = 'TEACHER')
  ), ranked as (
    select l.*, row_number() over (order by l.open_cases, l.recent, l.students, l.tid) as rn
    from load l
  )
  select r.tid, coalesce(p.display_name, 'Professor'), r.open_cases, r.recent, r.students,
         r.rn = 1, r.is_assigned
  from ranked r left join public.profiles p on p.user_id = r.tuser
  order by r.rn;
end $$;

create function public.assign_placement_teacher(p_case_id uuid, p_teacher_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.placement_cases%rowtype;
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  -- The case row lock serialises concurrent confirmations for the same student.
  select * into c from public.placement_cases where id = p_case_id for update;
  if not found then raise exception 'case not found' using errcode = '23503'; end if;
  if not exists (
    select 1 from public.teachers t
    where t.id = p_teacher_id and t.active
      and exists (select 1 from public.user_roles ur where ur.user_id = t.user_id and ur.role = 'TEACHER')
  ) then
    raise exception 'teacher not eligible' using errcode = '23514';
  end if;

  select a.id into v_existing from public.teacher_student_assignments a
  where a.teacher_id = p_teacher_id and a.student_user_id = c.user_id and a.course_id is null
    and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now());
  if found then return v_existing; end if;

  if c.state <> 'REVIEW_PENDING' then
    raise exception 'review pending required' using errcode = '23514';
  end if;
  -- Re-assignment between teachers is a separate, deferred workflow.
  if exists (
    select 1 from public.teacher_student_assignments a
    where a.student_user_id = c.user_id and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
  ) then
    raise exception 'student already assigned' using errcode = '23514';
  end if;

  insert into public.teacher_student_assignments(teacher_id, student_user_id, created_by_user_id)
  values (p_teacher_id, c.user_id, auth.uid())
  returning id into v_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'placement_teacher_assigned', 'placement_case', c.id,
          jsonb_build_object('teacher_id', p_teacher_id, 'assignment_id', v_id));
  return v_id;
end $$;

revoke all on function public.list_placement_teacher_candidates(uuid), public.assign_placement_teacher(uuid, uuid) from public, anon;
grant execute on function public.list_placement_teacher_candidates(uuid), public.assign_placement_teacher(uuid, uuid) to authenticated;
