-- ADR 0023: a single bounded read model; eligibility reuses the placement predicate.
create function public.admin_operational_alerts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    from waiting w where not exists(select 1 from candidates x where x.id=w.id and x.compatible and x.occupancy<x.capacity)
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
end $$;
revoke all on function public.admin_operational_alerts() from public,anon,authenticated;
grant execute on function public.admin_operational_alerts() to authenticated;
notify pgrst,'reload schema';
