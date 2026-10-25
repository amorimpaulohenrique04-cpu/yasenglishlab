-- Teacher students refinement (additive; 20261023211118 and 20261024130000 stay untouched).
--  1. teacher_students_workspace: `actions` (max 8) + `actionsTotal` over the WHOLE portfolio (independent of page/tab/filters),
--     tab 'pending' + counts.pending, `placement_state` per row, feed restricted to relevant events.
--  2. private.teacher_student_events: new `relevant` flag; placement assessments get detail 'Teste de entrada'.
--  3. teacher_student_workspace (profile): `engagement` and `placement_state`.
-- Security unchanged: SECURITY DEFINER, empty search_path, AAL2 via private.current_teacher_id(), assignment scope, same grants.
-- The entry-review SLA reuses the convention of teacher_entry_queue: placement_cases.state_changed_at, overdue at 24h.

-- Return type changes (new column), so the private helper is replaced. SQL-bodied callers keep no catalog dependency.
drop function private.teacher_student_events(uuid);
create function private.teacher_student_events(p_student uuid default null)
returns table(id text,student_id uuid,kind text,title text,detail text,occurred_at timestamptz,
 learning boolean,session_id uuid,relevant boolean)
language sql stable set search_path='' as $$
 with scoped as materialized (
  select p.user_id from public.profiles p
  where (p_student is null or p.user_id=p_student) and private.is_teacher_assigned(p.user_id)
 ), facts as (
  select 'lesson:'||lp.id as id, e.user_id as student_id,'lesson'::text as kind,
   case when lp.completed_at is not null and lp.completed_at>=lp.last_accessed_at
    then 'Aula concluída' else 'Aula acessada' end::text as title,l.title as detail,
   greatest(lp.last_accessed_at,lp.completed_at) as occurred_at,true as learning,null::uuid as session_id,
   (lp.completed_at is not null and lp.completed_at>=lp.last_accessed_at) as relevant
  from public.lesson_progress lp join public.enrollments e on e.id=lp.enrollment_id
  join scoped u on u.user_id=e.user_id join public.lessons l on l.id=lp.lesson_id
  union all
  select 'practice-start:'||a.id,a.user_id,'practice','Prática iniciada',act.title,a.started_at,true,null::uuid,false
  from public.practice_attempts a join scoped u on u.user_id=a.user_id
  join public.practice_activities act on act.id=a.practice_activity_id
  union all
  select 'practice-submit:'||a.id,a.user_id,'practice','Prática enviada',act.title,a.submitted_at,true,null::uuid,true
  from public.practice_attempts a join scoped u on u.user_id=a.user_id
  join public.practice_activities act on act.id=a.practice_activity_id
  where a.status='SUBMITTED'
  union all
  select 'assessment-start:'||a.id,a.user_id,'assessment','Avaliação iniciada',
   case when ass.is_placement then 'Teste de entrada' else ass.title end,a.started_at,true,null::uuid,false
  from public.assessment_attempts a join scoped u on u.user_id=a.user_id
  join public.assessment_versions v on v.id=a.assessment_version_id join public.assessments ass on ass.id=v.assessment_id
  where a.status<>'INVALIDATED'
  union all
  select 'assessment-submit:'||a.id,a.user_id,'assessment','Avaliação enviada',
   case when ass.is_placement then 'Teste de entrada' else ass.title end,a.submitted_at,true,null::uuid,true
  from public.assessment_attempts a join scoped u on u.user_id=a.user_id
  join public.assessment_versions v on v.id=a.assessment_version_id join public.assessments ass on ass.id=v.assessment_id
  where a.status in ('SUBMITTED','SCORED')
  union all
  select 'booking:'||b.id,b.user_id,'session','Sessão reservada',s.title,b.booked_at,false,s.id,false
  from public.session_bookings b join scoped u on u.user_id=b.user_id
  join public.live_sessions s on s.id=b.live_session_id and s.teacher_id=private.current_teacher_id()
  where b.status='BOOKED'
  union all
  select 'attendance:'||a.id,b.user_id,'session',
   case when a.status='ATTENDED' then 'Participou da sessão' else 'Falta registrada' end,s.title,
   case when a.status='ATTENDED' then s.starts_at else a.marked_at end,a.status='ATTENDED',s.id,true
  from public.attendance a join public.session_bookings b on b.id=a.session_booking_id
  join scoped u on u.user_id=b.user_id
  join public.live_sessions s on s.id=b.live_session_id and s.teacher_id=private.current_teacher_id()
 ) select * from facts where occurred_at is not null and occurred_at<=now();
$$;
revoke all on function private.teacher_student_events(uuid) from public,anon,authenticated;

create or replace function public.teacher_students_workspace(p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 teacher uuid:=private.current_teacher_id(); result jsonb;
 q text:=btrim(coalesce(p_filters->>'q','')); tab text:=coalesce(p_filters->>'tab','all');
 course uuid:=nullif(p_filters->>'course','')::uuid; cohort uuid:=nullif(p_filters->>'cohort','')::uuid;
 situation text:=coalesce(p_filters->>'status','all'); ordering text:=coalesce(p_filters->>'order','name');
 page_number integer:=coalesce((p_filters->>'page')::integer,1);
begin
 if length(q)>120 or page_number<1 or page_number>100000 or tab not in ('all','attention','inactive','pending')
  or situation not in ('all','ACTIVE','COMPLETED','CANCELLED','NONE')
  or ordering not in ('name','progress','activity') then raise exception 'Invalid filters' using errcode='22023'; end if;
 with base as materialized (select * from private.teacher_students_base()),
 pend as materialized (select * from private.teacher_student_pending()),
 projected as materialized (
  select b.*,selected.enrollment as primary_enrollment,
   (select c.state from public.placement_cases c where c.user_id=b.id order by c.created_at desc limit 1) as placement_state
  from base b
  left join lateral (
   select e as enrollment from jsonb_array_elements(b.enrollments) e
   where (course is null or e->>'course_id'=course::text)
    and (cohort is null or exists(select 1 from jsonb_array_elements(e->'cohorts') c where c->>'id'=cohort::text))
    and (situation='all' and e->>'status' in ('ACTIVE','COMPLETED') or e->>'status'=situation)
   order by (e->>'status'='ACTIVE') desc,(e->>'status'='COMPLETED') desc,e->>'enrolled_at' desc,e->>'id' limit 1
  ) selected on true
 ), searched as materialized (
  select * from projected s where
   (q='' or strpos(lower(s.name),lower(q))>0 or exists(
     select 1 from jsonb_array_elements(s.enrollments) e cross join lateral jsonb_array_elements(e->'cohorts') c
     where strpos(lower(c->>'name'),lower(q))>0))
   and (course is null and cohort is null or primary_enrollment is not null)
   and (situation='all' or situation='NONE' and not exists(select 1 from jsonb_array_elements(s.enrollments) e where e->>'status' in ('ACTIVE','COMPLETED'))
    or situation<>'NONE' and primary_enrollment->>'status'=situation)
 ), filtered as materialized (
  select * from searched where tab='all' or tab='attention' and (inactive or reassessment_open) or tab='inactive' and inactive
   or tab='pending' and practice_pending+entry_pending>0
 ), bounds as (select least(page_number,greatest(1,ceil(count(*)/8.0)::integer)) as page from filtered),
 paged as (
  select * from filtered order by
   case when ordering='progress' then (primary_enrollment->>'progress')::integer end desc nulls last,
   case when ordering='activity' then last_activity->>'occurred_at' end desc nulls last,
   lower(name),id limit 8 offset ((select page from bounds)-1)*8
 ), main_courses as (
  select (select e from jsonb_array_elements(b.enrollments) e where e->>'status' in ('ACTIVE','COMPLETED')
   order by (e->>'status'='ACTIVE') desc,e->>'enrolled_at' desc,e->>'id' limit 1) e from base b
 ), action_rows as (
  -- Whole portfolio (base), never the page/tab/filter. grp: 0 overdue entry, 1 entry/practice, 2 reassessment, 3 inactive.
  select b.id as student_id,b.name,'entry_review'::text as kind,count(*) as cnt,min(c.state_changed_at) as waiting_since,
   min(c.state_changed_at)<=now()-interval '24 hours' as overdue,
   (array_agg(p.id order by c.state_changed_at,p.id))[1] as target_id,
   case when min(c.state_changed_at)<=now()-interval '24 hours' then 0 else 1 end as grp,0 as inactivity_days
  from base b join pend p on p.student_id=b.id and p.kind='entry' join public.placement_cases c on c.id=p.id
  group by b.id,b.name
  union all
  select b.id,b.name,'practice_review',count(*),min(coalesce(p.submitted_at,a.started_at)),false,
   (array_agg(p.id order by coalesce(p.submitted_at,a.started_at),p.id))[1],1,0
  from base b join pend p on p.student_id=b.id and p.kind='practice' join public.practice_attempts a on a.id=p.id
  group by b.id,b.name
  union all
  select b.id,b.name,'reassessment',1,r.created_at,false,null::uuid,2,0
  from base b join public.reassessment_requests r on r.student_user_id=b.id and r.status='OPEN'
  union all
  select b.id,b.name,'inactive',1,greatest(b.joined_at,(b.last_activity->>'occurred_at')::timestamptz),false,null::uuid,3,coalesce(b.inactivity_days,0)
  from base b where b.inactive
 ), ranked as (
  select *,row_number() over (order by grp,
   case when grp<3 then waiting_since end asc,case when grp=3 then inactivity_days end desc,lower(name),student_id,kind) as rn
  from action_rows
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),
  'page',(select page from bounds),'pageSize',8,'total',(select count(*) from filtered),
  'counts',(select jsonb_build_object('all',count(*),'attention',count(*) filter(where inactive or reassessment_open),'inactive',count(*) filter(where inactive),
    'pending',count(*) filter(where practice_pending+entry_pending>0)) from searched),
  'metrics',(select jsonb_build_object('students',count(*),'attention',count(*) filter(where inactive or reassessment_open),
   'practicePending',coalesce(sum(practice_pending),0),'entryPending',coalesce(sum(entry_pending),0),
   'averageProgress',(select round(avg((e->>'progress')::numeric)) from base b cross join lateral jsonb_array_elements(b.enrollments) e where e->>'status'='ACTIVE' and e->>'progress' is not null),
   'activeEnrollments',(select count(*) from base b cross join lateral jsonb_array_elements(b.enrollments) e where e->>'status'='ACTIVE' and e->>'progress' is not null)) from base),
  'actions',coalesce((select jsonb_agg(jsonb_build_object('studentId',r.student_id,'name',r.name,'kind',r.kind,'count',r.cnt,
    'waitingSince',r.waiting_since,'overdue',r.overdue,'targetId',r.target_id) order by r.rn) from ranked r where r.rn<=8),'[]'::jsonb),
  'actionsTotal',(select count(*) from ranked),
  'courses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id)
   from (select distinct e->>'course_id' as id,e->>'title' as name from base b cross join lateral jsonb_array_elements(b.enrollments) e) c),'[]'::jsonb),
  'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id)
   from (select distinct co->>'id' as id,co->>'name' as name from base b cross join lateral jsonb_array_elements(b.enrollments) e cross join lateral jsonb_array_elements(e->'cohorts') co) c),'[]'::jsonb),
  'distribution',coalesce((select jsonb_agg(to_jsonb(d) order by d.total desc,d.name) from (
   select e->>'course_id' as id,coalesce(e->>'title','Sem matrícula') as name,count(*) as total from main_courses group by e->>'course_id',e->>'title') d),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from (
   select ev.*,b.name as student_name from private.teacher_student_events() ev join base b on b.id=ev.student_id
   where ev.relevant order by ev.occurred_at desc,ev.id limit 5) e),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.teacher_student_workspace(p_student uuid,p_kind text default 'all',p_page integer default 1,p_tab text default 'summary',p_sessions_page integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb; student jsonb;
begin
 if p_kind not in ('all','lesson','practice','assessment','session') or p_page<1 or p_page>100000
  or p_tab not in ('summary','activities','assessments','notes')
  or (p_sessions_page is not null and (p_sessions_page<1 or p_sessions_page>100000)) then raise exception 'Invalid detail query' using errcode='22023'; end if;
 if not private.is_teacher_assigned(p_student) then return null; end if;
 select to_jsonb(b)||jsonb_build_object('placement_state',
   (select c.state from public.placement_cases c where c.user_id=b.id order by c.created_at desc limit 1))
  into student from private.teacher_students_base(p_student) b;
 -- Session bookings/attendance are listed once, in the independently paged sessions section.
 with all_events as materialized (select * from private.teacher_student_events(p_student)),
 events as materialized (select * from all_events where kind<>'session' and (p_kind='all' or kind=p_kind)),
 evaluations as materialized (
  select a.id,'assessment'::text as kind,ass.title,a.status,a.submitted_at as occurred_at,
   null::text as reason,null::text as resolution,a.result_cefr as result_cefr,
   coalesce((select jsonb_agg(jsonb_build_object('skill',s.skill,'score',s.score,'max_score',s.max_score)) from public.skill_scores s where s.assessment_attempt_id=a.id),'[]'::jsonb) as scores
  from public.assessment_attempts a join public.assessment_versions v on v.id=a.assessment_version_id
  join public.assessments ass on ass.id=v.assessment_id
  where a.user_id=p_student and a.status in ('SUBMITTED','SCORED')
  union all
  select r.id,'request','Pedido de novo teste',r.status,r.created_at,r.reason,r.resolution_note,null,'[]'::jsonb
  from public.reassessment_requests r where r.student_user_id=p_student
 ), notes as materialized (
  select n.id,n.body,n.created_at from public.teacher_student_notes n where n.student_user_id=p_student and n.teacher_id=teacher
 ), sessions as materialized (
  select s.id,s.title,s.starts_at,s.ends_at,s.status,b.status as booking_status,a.status as attendance_status,
   coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'instructions',r.instructions,'due_at',r.due_at) order by r.due_at nulls last,r.id)
    from public.live_session_resources r where r.live_session_id=s.id and r.resource_type='HOMEWORK' and b.status='BOOKED'),'[]'::jsonb) as homework
  from public.session_bookings b join public.live_sessions s on s.id=b.live_session_id and s.teacher_id=teacher
  left join public.attendance a on a.session_booking_id=b.id where b.user_id=p_student
 )
 select jsonb_build_object('student',student,
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from events order by occurred_at desc,id limit 10 offset (case when p_tab='activities' then p_page-1 else 0 end)*10) e),'[]'::jsonb),
  'eventsTotal',(select count(*) from events),
  'evaluations',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from evaluations order by occurred_at desc nulls last,id limit 10 offset (case when p_tab='assessments' then p_page-1 else 0 end)*10) e),'[]'::jsonb),
  'evaluationsTotal',(select count(*) from evaluations),
  'notes',coalesce((select jsonb_agg(to_jsonb(n)) from (select * from notes order by created_at desc,id limit 10 offset (case when p_tab='notes' then p_page-1 else 0 end)*10) n),'[]'::jsonb),
  'notesTotal',(select count(*) from notes),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from sessions order by starts_at desc,id limit 10 offset (case when p_tab='activities' then coalesce(p_sessions_page,p_page)-1 else 0 end)*10) s),'[]'::jsonb),
  'sessionsTotal',(select count(*) from sessions),
  'nextSession',(select to_jsonb(s) from sessions s where s.starts_at>=now() and s.status='SCHEDULED' and s.booking_status='BOOKED' order by s.starts_at,s.id limit 1),
  'pending',coalesce((select jsonb_agg(to_jsonb(p) order by p.submitted_at,p.id) from private.teacher_student_pending(p_student) p),'[]'::jsonb),
  'engagement',jsonb_build_object(
   'learningLast7',(select count(*) from all_events x where x.learning and x.occurred_at>=now()-interval '7 days' and x.occurred_at<now()),
   'learningPrev7',(select count(*) from all_events x where x.learning and x.occurred_at>=now()-interval '14 days' and x.occurred_at<now()-interval '7 days'),
   'lastRelevantEvent',(select jsonb_build_object('kind',x.kind,'title',x.title,'detail',x.detail,'occurred_at',x.occurred_at)
     from all_events x where x.relevant order by x.occurred_at desc,x.id limit 1)),
  'placement',(select jsonb_build_object('state',c.state,'id',c.id,'recommended_course',co.title,'confidence',r.confidence,'feedback',r.feedback,'finalized_at',r.finalized_at,'chosen_cohort',ch.name)
   from public.placement_cases c left join public.placement_reviews r on r.placement_case_id=c.id
   left join public.courses co on co.id=r.recommended_course_id left join public.placement_decisions d on d.placement_case_id=c.id
   left join public.cohorts ch on ch.id=d.chosen_cohort_id where c.user_id=p_student order by c.created_at desc limit 1)
 ) into result;
 return result;
end $$;

revoke all on function public.teacher_students_workspace(jsonb),public.teacher_student_workspace(uuid,text,integer,text,integer) from public,anon,authenticated;
grant execute on function public.teacher_students_workspace(jsonb),public.teacher_student_workspace(uuid,text,integer,text,integer) to authenticated;
