-- PR1 / Block 1B: cohorts (turmas) have no student limit. Live-session capacity (live_sessions /
-- session_bookings, up to 6 per group) is a different concept and is NOT touched here.
-- cohort_placement_settings.capacity becomes legacy/NULL; the schedule remains the only placement setting.
alter table public.cohort_placement_settings drop constraint if exists cohort_placement_settings_capacity_check;
alter table public.cohort_placement_settings alter column capacity drop not null;
update public.cohort_placement_settings set capacity = null where capacity is not null;

-- Keeps the cohort row lock shared by all membership writers; the occupancy ceiling is gone.
CREATE OR REPLACE FUNCTION private.placement_capacity_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

begin
 if new.status='ACTIVE' then
  perform 1 from public.cohorts where id=new.cohort_id for update;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.validate_placement_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w jsonb; occupied integer;
begin
 for w in select value from jsonb_array_elements(new.schedule) loop
  if jsonb_typeof(w)<>'object' or (w-'weekday'-'startMinute'-'endMinute')<>'{}'::jsonb or
   not (w ?& array['weekday','startMinute','endMinute']) or
   jsonb_typeof(w->'weekday') is distinct from 'number' or jsonb_typeof(w->'startMinute') is distinct from 'number' or jsonb_typeof(w->'endMinute') is distinct from 'number' or
   (w->>'weekday')::integer not between 0 and 6 or (w->>'startMinute')::integer not between 0 and 1439 or
   (w->>'endMinute')::integer not between 1 and 1440 or (w->>'endMinute')::integer<=(w->>'startMinute')::integer then raise exception 'invalid recurring schedule' using errcode='23514'; end if;
 end loop;
 perform 1 from public.cohorts where id=new.cohort_id for update;
 if tg_op='UPDATE' and new.schedule<>old.schedule and exists(select 1 from public.cohort_memberships where cohort_id=new.cohort_id) then raise exception 'occupied schedule immutable' using errcode='23514'; end if;
 new.updated_at:=clock_timestamp();return new;
end $function$;

CREATE OR REPLACE FUNCTION public.get_placement_candidates(p_case_id uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.placement_cases;
begin
 select * into c from public.placement_cases where id=p_case_id;
 if c.id is null or auth.uid() is null or not private.can_read_placement(c.user_id) then raise exception 'placement scope required' using errcode='42501'; end if;
 if c.state not in ('PLACEMENT_READY','STUDENT_DECISION','ENROLLED') then return; end if;
 return query select jsonb_build_object('id',co.id,'name',co.name,'courseId',co.course_id,'timezone',co.timezone,'schedule',settings.schedule,'occupancy',(select count(*) from public.cohort_memberships m where m.cohort_id=co.id and m.status='ACTIVE'),'startsAt',co.starts_at)
 from public.cohorts co join public.cohort_placement_settings settings on settings.cohort_id=co.id
 where private.placement_cohort_compatible(c.id,co.id,true) order by co.starts_at,co.id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_enroll_in_course(p_user_id uuid, p_course_id uuid, p_cohort_id uuid, p_operation_id uuid, p_reason text, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := auth.uid(); reason text := btrim(p_reason);
  prior public.admin_course_enrollment_operations; cohort public.cohorts; course public.courses;
  target public.enrollments; membership public.cohort_memberships;
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
  if not exists(select 1 from public.cohort_placement_settings s where s.cohort_id=p_cohort_id) then
    raise exception 'Configured cohort schedule required' using errcode='23514';
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_operational_alerts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  perform private.assert_content_admin();
  with
  waiting as materialized (
    select c.id,c.user_id,c.state_changed_at,r.recommended_course_id,
      coalesce(p.display_name,'Aluno') label,
      coalesce(course.active and course.publication_status='PUBLISHED',false) course_available,
      exists(select 1 from public.student_schedule_preferences pref where pref.placement_case_id=c.id) has_preferences
    from public.placement_cases c
    left join public.placement_reviews r on r.placement_case_id=c.id
    left join public.courses course on course.id=r.recommended_course_id
    left join public.profiles p on p.user_id=c.user_id
    where c.state in ('PLACEMENT_READY','STUDENT_DECISION')
  ), candidates as materialized (
    select w.id,co.id cohort_id,s.cohort_id configured_id,s.capacity,
      private.placement_cohort_compatible(w.id,co.id,true) compatible,
      (select count(*) from public.cohort_memberships m where m.cohort_id=co.id and m.status='ACTIVE') occupancy
    from waiting w join public.cohorts co on co.course_id=w.recommended_course_id
      and co.status='ACTIVE' and (co.ends_at is null or co.ends_at>now())
    left join public.cohort_placement_settings s on s.cohort_id=co.id
  ), blocked as (
    select w.*,case
      when w.recommended_course_id is null then 'MISSING_RECOMMENDATION'
      when not w.course_available then 'COURSE_UNAVAILABLE'
      when not exists(select 1 from candidates x where x.id=w.id) then 'NO_COHORT'
      when not exists(select 1 from candidates x where x.id=w.id and x.configured_id is not null) then 'NO_SCHEDULE'
      when not w.has_preferences then 'NO_AVAILABILITY'
      when not exists(select 1 from candidates x where x.id=w.id and x.compatible) then 'NO_COMPATIBILITY'
      else 'NO_CAPACITY' end reason
    from waiting w where not exists(select 1 from candidates x where x.id=w.id and x.compatible)
  ), latest_completed as (
    select distinct on(e.user_id) e.user_id,e.course_id,e.id,e.completed_at
    from public.enrollments e where e.status='COMPLETED'
    order by e.user_id,e.completed_at desc,e.id
  ), facts as (
    select 'COHORT_CONFIGURATION'::text kind,co.id,co.name label,'MISSING_SETTINGS'::text reason,co.created_at since
    from public.cohorts co where co.status='ACTIVE' and (co.ends_at is null or co.ends_at>now())
      and not exists(select 1 from public.cohort_placement_settings s where s.cohort_id=co.id)
    union all
    select 'PLACEMENT_NO_COHORT',b.id,b.label,b.reason,b.state_changed_at from blocked b
    union all
    select 'STALE_REVIEW',c.id,coalesce(p.display_name,'Aluno'),'REVIEW_OVER_3_DAYS',c.state_changed_at
    from public.placement_cases c left join public.profiles p on p.user_id=c.user_id
    where c.state='REVIEW_PENDING' and c.state_changed_at<now()-interval '3 days'
    union all
    select 'STALE_DECISION',c.id,coalesce(p.display_name,'Aluno'),'DECISION_OVER_7_DAYS',c.state_changed_at
    from public.placement_cases c left join public.profiles p on p.user_id=c.user_id
    where c.state in ('PLACEMENT_READY','STUDENT_DECISION') and c.state_changed_at<now()-interval '7 days'
    union all
    select 'PLACEMENT_UNPUBLISHED',null::uuid,'Teste de entrada','UNPUBLISHED',now()
    where not exists(select 1 from public.assessments a join public.assessment_versions v on v.assessment_id=a.id
      where a.is_placement and a.active and v.status='PUBLISHED')
    union all
    select 'COMPLETED_WITHOUT_NEXT',e.user_id,coalesce(p.display_name,'Aluno'),'NO_ACTIVE_NEXT_COURSE',e.completed_at
    from latest_completed e left join public.profiles p on p.user_id=e.user_id
    where not exists(select 1 from public.enrollments n where n.user_id=e.user_id and n.status='ACTIVE' and n.course_id<>e.course_id)
  ), ranked as (
    select *,row_number() over(partition by kind order by since,id) position from facts
  ), kinds(kind,priority) as (values ('COHORT_CONFIGURATION',1),('PLACEMENT_NO_COHORT',2),('STALE_REVIEW',3),
    ('STALE_DECISION',4),('PLACEMENT_UNPUBLISHED',5),('COMPLETED_WITHOUT_NEXT',6))
  select jsonb_build_object('generatedAt',now(),'alerts',jsonb_agg(jsonb_build_object('kind',k.kind,
    'count',(select count(*) from ranked r where r.kind=k.kind),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'label',r.label,'reason',r.reason,'since',r.since) order by r.since,r.id)
      from ranked r where r.kind=k.kind and r.position<=10),'[]'::jsonb)) order by k.priority)) into result from kinds k;
  return result;
end $function$;

drop function public.configure_cohort_placement(uuid, integer, jsonb);
create function public.configure_cohort_schedule(p_cohort_id uuid, p_schedule jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  perform 1 from public.cohorts where id = p_cohort_id for update;
  if not found then raise exception 'cohort not found' using errcode = '23503'; end if;
  if exists (select 1 from public.cohort_placement_settings where cohort_id = p_cohort_id and schedule = p_schedule) then
    return;
  end if;
  insert into public.cohort_placement_settings(cohort_id, schedule) values (p_cohort_id, p_schedule)
  on conflict (cohort_id) do update set schedule = excluded.schedule;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'cohort_schedule_configured', 'cohort', p_cohort_id, jsonb_build_object('schedule', p_schedule));
end $$;
revoke all on function public.configure_cohort_schedule(uuid, jsonb) from public, anon;
grant execute on function public.configure_cohort_schedule(uuid, jsonb) to authenticated;
