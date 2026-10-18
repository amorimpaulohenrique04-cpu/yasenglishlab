-- Placement/practice dead ends (audit 2026-10-18). Additive only: no applied migration is edited and
-- placement_cases keeps its transition guard. admin_enroll_in_course still never rewrites the case
-- (docs/PLACEMENT.md, Etapa 12E); the journey is instead considered superseded by an active
-- enrollment with an active cohort membership, using the same predicate as has_cohort_membership.

-- 1. A Student with an effective ACTIVE membership in an ACTIVE cohort backed by an ACTIVE enrollment.
create function private.has_active_cohort_enrollment(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cohort_memberships m
    join public.cohorts c on c.id = m.cohort_id
    join public.enrollments e on e.id = m.enrollment_id
    where m.user_id = p_user and m.status = 'ACTIVE' and c.status = 'ACTIVE'
      and m.starts_at <= now() and (m.ends_at is null or m.ends_at > now()) and e.status = 'ACTIVE'
  );
$$;
revoke all on function private.has_active_cohort_enrollment(uuid) from public, anon, authenticated;

create function public.student_has_active_cohort_enrollment()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('STUDENT', false) then
    raise exception 'Student required' using errcode = '42501';
  end if;
  return private.has_active_cohort_enrollment(auth.uid());
end $$;
revoke all on function public.student_has_active_cohort_enrollment() from public, anon;
grant execute on function public.student_has_active_cohort_enrollment() to authenticated;

-- 2. Admin+AAL2 replaces the placement reviewer while the case is REVIEW_PENDING. Only direct,
-- course-less assignments (the kind assign_placement_teacher creates) are ended; course-scoped
-- assignments and cohort teaching scope are left untouched.
create function public.reassign_placement_teacher(p_case_id uuid, p_teacher_id uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.placement_cases%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_existing uuid;
  v_previous uuid[];
  v_id uuid;
begin
  if auth.uid() is null or not private.has_role('ADMIN', true) then
    raise exception 'ADMIN aal2 required' using errcode = '42501';
  end if;
  if char_length(v_reason) not between 1 and 1000 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  -- Same case lock as assign_placement_teacher: confirmations and reassignments are serialised.
  select * into c from public.placement_cases where id = p_case_id for update;
  if not found then raise exception 'case not found' using errcode = '23503'; end if;
  if c.state <> 'REVIEW_PENDING' then
    raise exception 'review pending required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.teachers t
    where t.id = p_teacher_id and t.active
      and exists (select 1 from public.user_roles ur where ur.user_id = t.user_id and ur.role = 'TEACHER')
  ) then
    raise exception 'teacher not eligible' using errcode = '23514';
  end if;

  select coalesce(array_agg(a.teacher_id order by a.teacher_id), '{}') into v_previous
  from public.teacher_student_assignments a
  where a.student_user_id = c.user_id and a.course_id is null and a.teacher_id <> p_teacher_id
    and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now());

  select a.id into v_existing from public.teacher_student_assignments a
  where a.teacher_id = p_teacher_id and a.student_user_id = c.user_id and a.course_id is null
    and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now());
  -- Identical retry: the target already reviews alone, nothing changes and nothing is audited again.
  if v_existing is not null and cardinality(v_previous) = 0 then return v_existing; end if;

  update public.teacher_student_assignments a
  set ends_at = greatest(now(), a.starts_at + interval '1 microsecond')
  where a.student_user_id = c.user_id and a.course_id is null and a.teacher_id <> p_teacher_id
    and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now());

  if v_existing is null then
    insert into public.teacher_student_assignments(teacher_id, student_user_id, created_by_user_id)
    values (p_teacher_id, c.user_id, auth.uid())
    returning id into v_id;
  else
    v_id := v_existing;
  end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
  values (auth.uid(), 'placement_teacher_reassigned', 'placement_case', c.id,
          jsonb_build_object('teacher_id', p_teacher_id, 'assignment_id', v_id,
            'previous_teacher_ids', to_jsonb(v_previous), 'reason', v_reason));
  return v_id;
end $$;
revoke all on function public.reassign_placement_teacher(uuid, uuid, text) from public, anon;
grant execute on function public.reassign_placement_teacher(uuid, uuid, text) to authenticated;

-- 3. Operational alerts: cases superseded by an active cohort enrollment no longer count as waiting,
-- and manual practice answers without any eligible reviewer become visible (PRACTICE_NO_REVIEWER).
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
      and not private.has_active_cohort_enrollment(c.user_id)
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
  ), unreviewed as (
    -- Same scope as private.is_teacher_assigned, evaluated for "any eligible Teacher" instead of auth.uid().
    select a.user_id,min(a.submitted_at) since
    from public.practice_attempts a
    join public.practice_results res on res.practice_attempt_id=a.id and res.evaluation_status='PENDING_MANUAL'
    where a.status='SUBMITTED'
      and not exists(select 1 from public.teacher_student_assignments ta join public.teachers t on t.id=ta.teacher_id
        where ta.student_user_id=a.user_id and t.active and ta.starts_at<=now() and (ta.ends_at is null or ta.ends_at>now())
          and exists(select 1 from public.user_roles ur where ur.user_id=t.user_id and ur.role='TEACHER'))
      and not exists(select 1 from public.cohort_memberships m
        join public.cohort_teachers ct on ct.cohort_id=m.cohort_id
        join public.teachers t on t.id=ct.teacher_id
        where m.user_id=a.user_id and private.has_cohort_membership(m.cohort_id,a.user_id)
          and t.active and ct.starts_at<=now() and (ct.ends_at is null or ct.ends_at>now())
          and exists(select 1 from public.user_roles ur where ur.user_id=t.user_id and ur.role='TEACHER'))
    group by a.user_id
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
      and not private.has_active_cohort_enrollment(c.user_id)
    union all
    select 'PLACEMENT_UNPUBLISHED',null::uuid,'Teste de entrada','UNPUBLISHED',now()
    where not exists(select 1 from public.assessments a join public.assessment_versions v on v.assessment_id=a.id
      where a.is_placement and a.active and v.status='PUBLISHED')
    union all
    select 'COMPLETED_WITHOUT_NEXT',e.user_id,coalesce(p.display_name,'Aluno'),'NO_ACTIVE_NEXT_COURSE',e.completed_at
    from latest_completed e left join public.profiles p on p.user_id=e.user_id
    where not exists(select 1 from public.enrollments n where n.user_id=e.user_id and n.status='ACTIVE' and n.course_id<>e.course_id)
    union all
    select 'PRACTICE_NO_REVIEWER',u.user_id,coalesce(p.display_name,'Aluno'),'NO_REVIEWER',u.since
    from unreviewed u left join public.profiles p on p.user_id=u.user_id
  ), ranked as (
    select *,row_number() over(partition by kind order by since,id) position from facts
  ), kinds(kind,priority) as (values ('COHORT_CONFIGURATION',1),('PLACEMENT_NO_COHORT',2),('STALE_REVIEW',3),
    ('STALE_DECISION',4),('PLACEMENT_UNPUBLISHED',5),('COMPLETED_WITHOUT_NEXT',6),('PRACTICE_NO_REVIEWER',7))
  select jsonb_build_object('generatedAt',now(),'alerts',jsonb_agg(jsonb_build_object('kind',k.kind,
    'count',(select count(*) from ranked r where r.kind=k.kind),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'label',r.label,'reason',r.reason,'since',r.since) order by r.since,r.id)
      from ranked r where r.kind=k.kind and r.position<=10),'[]'::jsonb)) order by k.priority)) into result from kinds k;
  return result;
end $function$;
