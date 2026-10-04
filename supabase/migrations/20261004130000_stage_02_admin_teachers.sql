create table public.teacher_courses (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (teacher_id, course_id)
);

alter table public.teacher_courses enable row level security;
revoke all on public.teacher_courses from public, anon, authenticated;

create function public.admin_teacher_directory(
  p_query text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns setof jsonb
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
  if p_query is null or char_length(p_query) > 120
     or p_limit is null or p_limit not between 1 and 50
     or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'invalid paging or search input' using errcode = '22023';
  end if;

  return query
  with identities as (
    select user_id from public.user_roles where role = 'TEACHER'
    union
    select user_id from public.teachers
  ), rows as (
    select i.user_id,
      t.id as teacher_id,
      t.bio,
      t.active,
      p.display_name,
      u.email,
      coalesce(cohort_data.items, '[]'::jsonb) as cohorts,
      coalesce(availability_data.items, '[]'::jsonb) as availability,
      coalesce(course_data.items, '[]'::jsonb) as courses,
      coalesce(session_data.items, '[]'::jsonb) as next_sessions,
      coalesce(cohort_data.total, 0)::integer as cohorts_count,
      coalesce(student_data.total, 0)::integer as student_scope_count,
      coalesce(session_data.total, 0)::integer as next_sessions_count,
      coalesce(review_data.total, 0)::integer as pending_reviews_count
    from identities i
    left join public.teachers t on t.user_id = i.user_id
    left join public.profiles p on p.user_id = i.user_id
    join auth.users u on u.id = i.user_id
    left join lateral (
      select count(*)::integer as total,
        (select jsonb_agg(jsonb_build_object(
          'cohort_id', selected.id, 'name', selected.name, 'is_primary', selected.is_primary
        ) order by selected.name, selected.id)
         from (select c.id, c.name, ct.is_primary
           from public.cohort_teachers ct
           join public.cohorts c on c.id = ct.cohort_id
           where ct.teacher_id = t.id and ct.starts_at <= now() and ct.ends_at is null
             and c.status = 'ACTIVE' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
           order by c.name, c.id limit 10) selected) as items
      from public.cohort_teachers ct
      join public.cohorts c on c.id = ct.cohort_id
      where ct.teacher_id = t.id and ct.starts_at <= now() and ct.ends_at is null
        and c.status = 'ACTIVE' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
    ) cohort_data on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', selected.id, 'starts_at', selected.starts_at, 'ends_at', selected.ends_at,
        'timezone', selected.timezone
      ) order by selected.starts_at, selected.id) as items
      from (select id, starts_at, ends_at, timezone from public.teacher_availability
        where teacher_id = t.id and ends_at > now()
        order by starts_at, id limit 5) selected
    ) availability_data on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('course_id', selected.id, 'title', selected.title, 'slug', selected.slug)
        order by selected.title, selected.id) as items
      from (select c.id, c.title, c.slug from public.teacher_courses tc
        join public.courses c on c.id = tc.course_id
        where tc.teacher_id = t.id and c.active and c.publication_status = 'PUBLISHED'
        order by c.title, c.id limit 50) selected
    ) course_data on true
    left join lateral (
      select count(*)::integer as total,
        (select jsonb_agg(jsonb_build_object(
          'id', selected.id, 'title', selected.title, 'starts_at', selected.starts_at,
          'ends_at', selected.ends_at, 'session_type', selected.session_type
        ) order by selected.starts_at, selected.id)
         from (select id, title, starts_at, ends_at, session_type
           from public.live_sessions where teacher_id = t.id and status = 'SCHEDULED'
             and starts_at > now()
           order by starts_at, id limit 5) selected) as items
      from public.live_sessions
      where teacher_id = t.id and status = 'SCHEDULED' and starts_at > now()
    ) session_data on true
    left join lateral (
      select count(distinct scope.student_user_id)::integer as total
      from (
        select a.student_user_id from public.teacher_student_assignments a
        where a.teacher_id = t.id and a.starts_at <= now() and a.ends_at is null
        union
        select m.user_id from public.cohort_teachers ct
        join public.cohorts c on c.id = ct.cohort_id
        join public.cohort_memberships m on m.cohort_id = c.id
        where ct.teacher_id = t.id and ct.starts_at <= now() and ct.ends_at is null
          and c.status = 'ACTIVE' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
          and m.status = 'ACTIVE' and m.starts_at <= now() and (m.ends_at is null or m.ends_at > now())
      ) scope
    ) student_data on true
    left join lateral (
      select count(*)::integer as total from (
        select 'placement'::text as source, pc.id
        from public.teacher_student_assignments a
        join public.placement_cases pc on pc.user_id = a.student_user_id and pc.state = 'REVIEW_PENDING'
        where a.teacher_id = t.id and a.starts_at <= now() and a.ends_at is null
        union
        select 'practice'::text as source, pa.id
        from public.teacher_student_assignments a
        join public.practice_attempts pa on pa.user_id = a.student_user_id
        join public.practice_results pr on pr.practice_attempt_id = pa.id
        where a.teacher_id = t.id and a.starts_at <= now() and a.ends_at is null
          and pr.evaluation_status = 'PENDING_MANUAL'
      ) pending
    ) review_data on true
    where (coalesce(p_query, '') = ''
      or p.display_name ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!'
      or u.email ilike '%' || replace(replace(replace(p_query, '!', '!!'), '%', '!%'), '_', '!_') || '%' escape '!')
  )
  select jsonb_build_object(
    'user_id', r.user_id,
    'teacher_id', r.teacher_id,
    'display_name', coalesce(r.display_name, 'Professor sem perfil'),
    'email', r.email,
    'bio', r.bio,
    'active', r.active,
    'cohorts_count', r.cohorts_count,
    'student_scope_count', r.student_scope_count,
    'next_sessions_count', r.next_sessions_count,
    'pending_reviews_count', r.pending_reviews_count,
    'cohorts', r.cohorts,
    'availability', r.availability,
    'courses', r.courses,
    'next_sessions', r.next_sessions,
    'alerts', to_jsonb(array_remove(array[
      case when r.teacher_id is null then 'A role TEACHER existe sem registro operacional.' end,
      case when r.active is false and r.next_sessions_count > 0 then 'Professor inativo com sessões futuras.' end,
      case when r.pending_reviews_count > 0 then 'Há revisões pendentes no escopo atribuído.' end
    ], null))
  )
  from rows r
  order by lower(r.display_name), r.user_id
  limit p_limit offset p_offset;
end;
$$;

create function public.admin_find_teacher_identity(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare normalized_email text := lower(btrim(p_email));
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if normalized_email is null or length(normalized_email) not between 3 and 254 then
    raise exception 'valid email required' using errcode = '22023';
  end if;
  return (select id from auth.users where lower(email) = normalized_email limit 1);
end;
$$;

create function public.admin_reconcile_teacher(p_email text, p_actor_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_email text := lower(btrim(p_email)); target_user uuid; target_teacher uuid;
  role_rows integer := 0; teacher_rows integer := 0;
begin
  if p_actor_user_id is null or not exists (
    select 1 from public.user_roles where user_id = p_actor_user_id and role = 'ADMIN'
  ) then
    raise exception 'Admin actor required' using errcode = '42501';
  end if;
  if normalized_email is null or length(normalized_email) not between 3 and 254 then
    raise exception 'valid email required' using errcode = '22023';
  end if;
  select id into target_user from auth.users where lower(email) = normalized_email for update;
  if target_user is null then raise exception 'Auth identity not found' using errcode = 'P0002'; end if;

  insert into public.user_roles(user_id, role) values (target_user, 'TEACHER')
    on conflict (user_id, role) do nothing;
  get diagnostics role_rows = row_count;
  insert into public.teachers(user_id, active) values (target_user, true)
    on conflict (user_id) do nothing;
  get diagnostics teacher_rows = row_count;
  select id into target_teacher from public.teachers where user_id = target_user;
  if role_rows > 0 or teacher_rows > 0 then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
      values (p_actor_user_id, 'teacher_provisioned', 'teachers', target_teacher,
        jsonb_build_object('user_id', target_user, 'role_created', role_rows > 0, 'teacher_created', teacher_rows > 0));
  end if;
  return target_teacher;
end;
$$;

create function public.admin_set_teacher_active(p_teacher_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target public.teachers; future_sessions integer; primary_cohorts integer; pending_reviews integer;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  select * into target from public.teachers where id = p_teacher_id for update;
  if target.id is null then raise exception 'Teacher not found' using errcode = 'P0002'; end if;
  if p_active is false and target.active then
    select count(*) into future_sessions from public.live_sessions
      where teacher_id = target.id and status = 'SCHEDULED' and ends_at > now();
    select count(*) into primary_cohorts from public.cohort_teachers ct
      join public.cohorts c on c.id = ct.cohort_id
      where ct.teacher_id = target.id and ct.is_primary and ct.ends_at is null
        and c.status in ('PLANNED', 'ACTIVE') and (c.ends_at is null or c.ends_at > now());
    select count(*) into pending_reviews from (
      select 'placement'::text as source, pc.id
      from public.teacher_student_assignments a
      join public.placement_cases pc on pc.user_id = a.student_user_id and pc.state = 'REVIEW_PENDING'
      where a.teacher_id = target.id and a.starts_at <= now() and a.ends_at is null
      union
      select 'practice'::text as source, pa.id
      from public.teacher_student_assignments a
      join public.practice_attempts pa on pa.user_id = a.student_user_id
      join public.practice_results pr on pr.practice_attempt_id = pa.id
      where a.teacher_id = target.id and a.starts_at <= now() and a.ends_at is null
        and pr.evaluation_status = 'PENDING_MANUAL'
    ) pending;
    if future_sessions > 0 or primary_cohorts > 0 or pending_reviews > 0 then
      raise exception 'Teacher has unresolved operational dependencies (sessions %, primary cohorts %, reviews %)',
        future_sessions, primary_cohorts, pending_reviews using errcode = '23514';
    end if;
  end if;
  if target.active is distinct from p_active then
    update public.teachers set active = p_active where id = target.id;
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
      values (auth.uid(), case when p_active then 'teacher_activated' else 'teacher_deactivated' end,
        'teachers', target.id, jsonb_build_object('previous_active', target.active, 'active', p_active));
  end if;
end;
$$;

create function public.admin_set_teacher_course(p_teacher_id uuid, p_course_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare changed_rows integer := 0;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true)
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id)
     or not exists (select 1 from public.courses where id = p_course_id and active and publication_status = 'PUBLISHED') then
    raise exception 'active Teacher and published Course required' using errcode = '23514';
  end if;
  if p_enabled then
    insert into public.teacher_courses(teacher_id, course_id, created_by_user_id)
      values (p_teacher_id, p_course_id, auth.uid()) on conflict do nothing;
    get diagnostics changed_rows = row_count;
  else
    delete from public.teacher_courses where teacher_id = p_teacher_id and course_id = p_course_id;
    get diagnostics changed_rows = row_count;
  end if;
  if changed_rows > 0 then
    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
      values (auth.uid(), 'teacher_course_capability_changed', 'teacher_courses', p_teacher_id,
        jsonb_build_object('course_id', p_course_id, 'enabled', p_enabled));
  end if;
end;
$$;

revoke all on function public.admin_teacher_directory(text, integer, integer),
  public.admin_find_teacher_identity(text), public.admin_reconcile_teacher(text, uuid),
  public.admin_set_teacher_active(uuid, boolean), public.admin_set_teacher_course(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_teacher_directory(text, integer, integer),
  public.admin_find_teacher_identity(text),
  public.admin_set_teacher_active(uuid, boolean), public.admin_set_teacher_course(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.admin_reconcile_teacher(text, uuid) to service_role;
