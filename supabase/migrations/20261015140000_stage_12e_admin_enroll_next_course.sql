-- ADR 0023: explicit Admin enrollment in a course/cohort; never closes another enrollment.
create table public.admin_course_enrollment_operations (
  operation_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  membership_id uuid not null references public.cohort_memberships(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  result jsonb not null check (jsonb_typeof(result)='object'),
  created_at timestamptz not null default now()
);
create index admin_course_enrollment_operations_student_idx
  on public.admin_course_enrollment_operations(user_id,created_at desc);
alter table public.admin_course_enrollment_operations enable row level security;
revoke all on public.admin_course_enrollment_operations from public,anon,authenticated;

create function private.protect_admin_course_enrollment_operation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Administrative enrollment operation is immutable' using errcode='55000';
end;
$$;
revoke all on function private.protect_admin_course_enrollment_operation() from public,anon,authenticated;
create trigger admin_course_enrollment_operation_immutable
  before update or delete on public.admin_course_enrollment_operations
  for each row execute function private.protect_admin_course_enrollment_operation();

create function public.admin_enroll_in_course(p_user_id uuid,p_course_id uuid,p_cohort_id uuid,
  p_operation_id uuid,p_reason text,p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); reason text := btrim(p_reason);
  prior public.admin_course_enrollment_operations; cohort public.cohorts; course public.courses;
  target public.enrollments; membership public.cohort_memberships; capacity integer;
  enrollment_id uuid; membership_id uuid; reused_membership boolean := false; result jsonb;
begin
  perform private.assert_content_admin();
  if p_user_id is null or p_course_id is null or p_cohort_id is null or p_operation_id is null
    or reason is null or char_length(reason) not between 1 and 1000
    or jsonb_typeof(p_context) is distinct from 'object' then
    raise exception 'Student, course, cohort, operation id and reason required' using errcode='23514';
  end if;
  -- Serialize the operation id even when concurrent retries supply different target parameters.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'admin_enroll_in_course:' || p_operation_id::text,0));
  select * into prior from public.admin_course_enrollment_operations where operation_id=p_operation_id;
  if found then
    if row(prior.actor_user_id,prior.user_id,prior.course_id,prior.cohort_id,prior.reason)
      is distinct from row(actor,p_user_id,p_course_id,p_cohort_id,reason) then
      raise exception 'Conflicting enrollment retry' using errcode='23514';
    end if;
    return prior.result;
  end if;
  -- Shared with placement_capacity_guard and other cohort writers, including first membership.
  select * into cohort from public.cohorts where id=p_cohort_id for update;
  if not found or cohort.course_id<>p_course_id or cohort.status<>'ACTIVE'
    or (cohort.ends_at is not null and cohort.ends_at<=now()) then
    raise exception 'Active compatible cohort required' using errcode='23514';
  end if;
  select * into course from public.courses where id=p_course_id for share;
  if not found or not course.active or course.publication_status<>'PUBLISHED' then
    raise exception 'Published active course required' using errcode='23514';
  end if;
  select s.capacity into capacity from public.cohort_placement_settings s where s.cohort_id=p_cohort_id;
  if capacity is null then
    raise exception 'Configured cohort capacity required' using errcode='23514';
  end if;
  perform 1 from public.user_roles where user_id=p_user_id and role='STUDENT' for share;
  if not found then raise exception 'Student required' using errcode='23514'; end if;
  -- Reserve the unique student/course row without updating it. activate_enrollment's creation
  -- upsert would otherwise reopen a COMPLETED row created concurrently after an absent-row read.
  insert into public.enrollments(user_id,course_id,status) values(p_user_id,p_course_id,'ACTIVE')
    on conflict(user_id,course_id) do nothing;
  select * into target from public.enrollments where user_id=p_user_id and course_id=p_course_id for update;
  if target.status='COMPLETED' then
    -- A next-course command must not reopen a completed enrollment.
    raise exception 'Target course is already completed' using errcode='23514';
  end if;
  select * into membership from public.cohort_memberships
    where cohort_id=p_cohort_id and user_id=p_user_id and status='ACTIVE';
  if found then
    if membership.enrollment_id is distinct from target.id or target.status is distinct from 'ACTIVE'
      or membership.starts_at>now() or (membership.ends_at is not null and membership.ends_at<=now()) then
      raise exception 'Existing membership requires explicit reconciliation' using errcode='23514';
    end if;
    membership_id := membership.id;
    reused_membership := true;
  elsif (select count(*) from public.cohort_memberships where cohort_id=p_cohort_id and status='ACTIVE')>=capacity then
    raise exception 'cohort_capacity_exhausted' using errcode='23514';
  end if;
  enrollment_id := private.activate_enrollment(p_user_id,p_course_id,'admin_enroll_in_course');
  if not reused_membership then
    insert into public.cohort_memberships(cohort_id,user_id,enrollment_id)
      values(p_cohort_id,p_user_id,enrollment_id) returning id into membership_id;
  end if;
  select * into target from public.enrollments where id=enrollment_id;
  result := jsonb_build_object('operationId',p_operation_id,'userId',p_user_id,'courseId',p_course_id,
    'cohortId',p_cohort_id,'enrollmentId',enrollment_id,'membershipId',membership_id,
    'enrollmentStatus',target.status,'reusedMembership',reused_membership);
  insert into public.admin_course_enrollment_operations(operation_id,actor_user_id,user_id,course_id,
    cohort_id,enrollment_id,membership_id,reason,result)
    values(p_operation_id,actor,p_user_id,p_course_id,p_cohort_id,enrollment_id,membership_id,reason,result);
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
    values(actor,'admin_course_enrolled','enrollment',enrollment_id,
      result || jsonb_build_object('reason',reason),
      coalesce((p_context->>'request_id')::uuid,gen_random_uuid()),
      left(coalesce(nullif(p_context->>'environment',''),'unknown'),40),
      left(coalesce(nullif(p_context->>'version',''),'unknown'),120));
  return result;
end;
$$;
revoke all on function public.admin_enroll_in_course(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_enroll_in_course(uuid,uuid,uuid,uuid,text,jsonb) to authenticated;
