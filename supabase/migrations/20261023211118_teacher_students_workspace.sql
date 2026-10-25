-- Read-only Teacher workspace. No writes during reads and no wider RLS grants.
create function private.teacher_student_curriculum(p_student uuid default null)
returns table(student_id uuid, id uuid, course_id uuid, title text, status text,
 enrolled_at timestamptz, completed_at timestamptz, completed bigint, total bigint,
 progress integer, cohorts jsonb)
language sql stable set search_path='' as $$
 select e.user_id,e.id,e.course_id,c.title,e.status,e.enrolled_at,e.completed_at,
  curriculum.completed,curriculum.total,
  case when e.status in ('ACTIVE','COMPLETED') and curriculum.total>0 then curriculum.progress end,
  coalesce((select jsonb_agg(jsonb_build_object('id',co.id,'name',co.name) order by co.name,co.id)
    from public.cohort_memberships m join public.cohorts co on co.id=m.cohort_id
    where m.enrollment_id=e.id and m.user_id=e.user_id and m.status='ACTIVE'
     and m.starts_at<=now() and (m.ends_at is null or m.ends_at>now()) and co.status='ACTIVE'
     and e.status in ('ACTIVE','COMPLETED')),'[]'::jsonb)
 from public.enrollments e join public.courses c on c.id=e.course_id
 cross join lateral (
  select count(*) as total,count(*) filter(where coalesce(lp.completion_percent,0)=100) as completed,
   round(avg(coalesce(lp.completion_percent,0)))::integer as progress
  from public.modules m join public.lessons l on l.module_id=m.id
  left join public.lesson_progress lp on lp.enrollment_id=e.id and lp.lesson_id=l.id
  where m.course_id=e.course_id and m.publication_status='PUBLISHED'
   and l.publication_status='PUBLISHED' and c.active and c.publication_status='PUBLISHED'
   and private.student_path_includes('lessons',l.id,e.user_id)
 ) curriculum
 where (p_student is null or e.user_id=p_student) and private.is_teacher_assigned(e.user_id);
$$;

create function private.teacher_student_events(p_student uuid default null)
returns table(id text,student_id uuid,kind text,title text,detail text,occurred_at timestamptz,
 learning boolean,session_id uuid)
language sql stable set search_path='' as $$
 with scoped as materialized (
  select p.user_id from public.profiles p
  where (p_student is null or p.user_id=p_student) and private.is_teacher_assigned(p.user_id)
 ), facts as (
  select 'lesson:'||lp.id as id, e.user_id as student_id,'lesson'::text as kind,
   case when lp.completed_at is not null and lp.completed_at>=lp.last_accessed_at
    then 'Aula concluída' else 'Aula acessada' end::text as title,l.title as detail,
   greatest(lp.last_accessed_at,lp.completed_at) as occurred_at,true as learning,null::uuid as session_id
  from public.lesson_progress lp join public.enrollments e on e.id=lp.enrollment_id
  join scoped u on u.user_id=e.user_id join public.lessons l on l.id=lp.lesson_id
  union all
  select 'practice-start:'||a.id,a.user_id,'practice','Prática iniciada',act.title,a.started_at,true,null::uuid
  from public.practice_attempts a join scoped u on u.user_id=a.user_id
  join public.practice_activities act on act.id=a.practice_activity_id
  union all
  select 'practice-submit:'||a.id,a.user_id,'practice','Prática enviada',act.title,a.submitted_at,true,null::uuid
  from public.practice_attempts a join scoped u on u.user_id=a.user_id
  join public.practice_activities act on act.id=a.practice_activity_id
  where a.status='SUBMITTED'
  union all
  select 'assessment-start:'||a.id,a.user_id,'assessment','Avaliação iniciada',ass.title,a.started_at,true,null::uuid
  from public.assessment_attempts a join scoped u on u.user_id=a.user_id
  join public.assessment_versions v on v.id=a.assessment_version_id join public.assessments ass on ass.id=v.assessment_id
  where a.status<>'INVALIDATED'
  union all
  select 'assessment-submit:'||a.id,a.user_id,'assessment','Avaliação enviada',ass.title,a.submitted_at,true,null::uuid
  from public.assessment_attempts a join scoped u on u.user_id=a.user_id
  join public.assessment_versions v on v.id=a.assessment_version_id join public.assessments ass on ass.id=v.assessment_id
  where a.status in ('SUBMITTED','SCORED')
  union all
  select 'booking:'||b.id,b.user_id,'session','Sessão reservada',s.title,b.booked_at,false,s.id
  from public.session_bookings b join scoped u on u.user_id=b.user_id
  join public.live_sessions s on s.id=b.live_session_id and s.teacher_id=private.current_teacher_id()
  where b.status='BOOKED'
  union all
  select 'attendance:'||a.id,b.user_id,'session',
   case when a.status='ATTENDED' then 'Participou da sessão' else 'Falta registrada' end,s.title,
   case when a.status='ATTENDED' then s.starts_at else a.marked_at end,a.status='ATTENDED',s.id
  from public.attendance a join public.session_bookings b on b.id=a.session_booking_id
  join scoped u on u.user_id=b.user_id
  join public.live_sessions s on s.id=b.live_session_id and s.teacher_id=private.current_teacher_id()
 ) select * from facts where occurred_at is not null and occurred_at<=now();
$$;

-- Same eligibility as get_teacher_reviews, without its row limits and item duplicates.
create function private.teacher_student_pending(p_student uuid default null)
returns table(id uuid,student_id uuid,kind text,title text,submitted_at timestamptz)
language sql stable set search_path='' as $$
 select a.id,a.user_id,'practice'::text,act.title,a.submitted_at
 from public.practice_attempts a join public.practice_activities act on act.id=a.practice_activity_id
 where private.is_teacher_assigned(a.user_id) and (p_student is null or a.user_id=p_student)
 and (
  exists(select 1 from public.practice_results r join public.practice_responses pr on pr.practice_attempt_id=r.practice_attempt_id
   where r.practice_attempt_id=a.id and r.evaluation_status='PENDING_MANUAL'
   and (act.skill in ('SPEAKING','PRONUNCIATION') or
     (act.content->'version'='2'::jsonb and act.content#>>'{response,type}' in ('WRITTEN','SPOKEN'))))
  or (a.status='SUBMITTED' and act.content->'version'='3'::jsonb and exists(
   select 1 from public.practice_item_responses ir
   where ir.practice_attempt_id=a.id and ir.round=1 and ir.evaluation_status='PENDING_MANUAL'
    and not exists(select 1 from public.practice_manual_reviews mr where mr.practice_attempt_id=a.id and mr.item_id=ir.item_id)))
 )
 union all
 select c.id,c.user_id,'entry','Teste de entrada',a.submitted_at
 from public.placement_cases c join public.assessment_attempts a on a.id=c.assessment_attempt_id
 where c.state='REVIEW_PENDING' and private.is_teacher_assigned(c.user_id)
  and (p_student is null or c.user_id=p_student)
  and not exists(select 1 from public.placement_reviews r where r.placement_case_id=c.id);
$$;

create function private.teacher_students_base(p_student uuid default null)
returns table(id uuid,name text,joined_at timestamptz,enrollments jsonb,last_activity jsonb,
 inactivity_days integer,inactive boolean,reassessment_open boolean,practice_pending bigint,entry_pending bigint)
language sql stable set search_path='' as $$
 with curriculum as materialized (select * from private.teacher_student_curriculum(p_student)),
 events as materialized (select * from private.teacher_student_events(p_student) where learning),
 pending as materialized (select * from private.teacher_student_pending(p_student)),
 scoped as (
 select p.user_id,p.display_name,min(a.starts_at) as joined_at
 from public.profiles p join public.teacher_student_assignments a on a.student_user_id=p.user_id
 where a.teacher_id=private.current_teacher_id() and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now())
  and (p_student is null or p.user_id=p_student) group by p.user_id,p.display_name
 )
 select s.user_id,coalesce(s.display_name,'Aluno'),s.joined_at,
  coalesce((select jsonb_agg(to_jsonb(c)-'student_id' order by (c.status='ACTIVE') desc,(c.status='COMPLETED') desc,c.enrolled_at desc,c.id)
    from curriculum c where c.student_id=s.user_id),'[]'::jsonb),
  (select to_jsonb(e)-'student_id'-'learning' from events e where e.student_id=s.user_id order by e.occurred_at desc,e.id limit 1),
  case when exists(select 1 from curriculum c where c.student_id=s.user_id and c.status='ACTIVE')
   then greatest(0,floor(extract(epoch from (now()-greatest(s.joined_at,
     (select max(e.occurred_at) from events e where e.student_id=s.user_id))))/86400))::integer end,
  exists(select 1 from curriculum c where c.student_id=s.user_id and c.status='ACTIVE')
   and greatest(s.joined_at,(select max(e.occurred_at) from events e where e.student_id=s.user_id))<=now()-interval '7 days',
  exists(select 1 from public.reassessment_requests r where r.student_user_id=s.user_id and r.status='OPEN'),
  (select count(*) from pending p where p.student_id=s.user_id and p.kind='practice'),
  (select count(*) from pending p where p.student_id=s.user_id and p.kind='entry')
 from scoped s;
$$;

create function public.teacher_students_workspace(p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 teacher uuid:=private.current_teacher_id(); result jsonb;
 q text:=btrim(coalesce(p_filters->>'q','')); tab text:=coalesce(p_filters->>'tab','all');
 course uuid:=nullif(p_filters->>'course','')::uuid; cohort uuid:=nullif(p_filters->>'cohort','')::uuid;
 situation text:=coalesce(p_filters->>'status','all'); ordering text:=coalesce(p_filters->>'order','name');
 page_number integer:=coalesce((p_filters->>'page')::integer,1);
begin
 if length(q)>120 or page_number<1 or page_number>100000 or tab not in ('all','attention','inactive')
  or situation not in ('all','ACTIVE','COMPLETED','CANCELLED','NONE')
  or ordering not in ('name','progress','activity') then raise exception 'Invalid filters' using errcode='22023'; end if;
 with base as materialized (select * from private.teacher_students_base()),
 projected as materialized (
  select b.*,selected.enrollment as primary_enrollment from base b
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
 ), bounds as (select least(page_number,greatest(1,ceil(count(*)/8.0)::integer)) as page from filtered),
 paged as (
  select * from filtered order by
   case when ordering='progress' then (primary_enrollment->>'progress')::integer end desc nulls last,
   case when ordering='activity' then last_activity->>'occurred_at' end desc nulls last,
   lower(name),id limit 8 offset ((select page from bounds)-1)*8
 ), main_courses as (
  select (select e from jsonb_array_elements(b.enrollments) e where e->>'status' in ('ACTIVE','COMPLETED')
   order by (e->>'status'='ACTIVE') desc,e->>'enrolled_at' desc,e->>'id' limit 1) e from base b
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),
  'page',(select page from bounds),'pageSize',8,'total',(select count(*) from filtered),
  'counts',(select jsonb_build_object('all',count(*),'attention',count(*) filter(where inactive or reassessment_open),'inactive',count(*) filter(where inactive)) from searched),
  'metrics',(select jsonb_build_object('students',count(*),'attention',count(*) filter(where inactive or reassessment_open),
   'practicePending',coalesce(sum(practice_pending),0),'entryPending',coalesce(sum(entry_pending),0),
   'averageProgress',(select round(avg((e->>'progress')::numeric)) from base b cross join lateral jsonb_array_elements(b.enrollments) e where e->>'status'='ACTIVE' and e->>'progress' is not null),
   'activeEnrollments',(select count(*) from base b cross join lateral jsonb_array_elements(b.enrollments) e where e->>'status'='ACTIVE' and e->>'progress' is not null)) from base),
  'courses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id)
   from (select distinct e->>'course_id' as id,e->>'title' as name from base b cross join lateral jsonb_array_elements(b.enrollments) e) c),'[]'::jsonb),
  'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name,c.id)
   from (select distinct co->>'id' as id,co->>'name' as name from base b cross join lateral jsonb_array_elements(b.enrollments) e cross join lateral jsonb_array_elements(e->'cohorts') co) c),'[]'::jsonb),
  'distribution',coalesce((select jsonb_agg(to_jsonb(d) order by d.total desc,d.name) from (
   select e->>'course_id' as id,coalesce(e->>'title','Sem matrícula') as name,count(*) as total from main_courses group by e->>'course_id',e->>'title') d),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from (
   select ev.*,b.name as student_name from private.teacher_student_events() ev join base b on b.id=ev.student_id
   order by ev.occurred_at desc,ev.id limit 5) e),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create function public.teacher_students_events(p_kind text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb;
begin
 if p_kind not in ('all','lesson','practice','assessment','session') or p_page<1 or p_page>100000 then raise exception 'Invalid event query' using errcode='22023'; end if;
 with events as materialized (
  select e.*,coalesce(p.display_name,'Aluno') as student_name from private.teacher_student_events() e
  join public.profiles p on p.user_id=e.student_id where p_kind='all' or e.kind=p_kind
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(e)) from
  (select * from events order by occurred_at desc,id limit 10 offset (p_page-1)*10) e),'[]'::jsonb),
  'total',(select count(*) from events),'page',p_page,'pageSize',10) into result;
 return result;
end $$;

create function public.teacher_student_workspace(p_student uuid,p_kind text default 'all',p_page integer default 1,p_tab text default 'summary')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb; student jsonb;
begin
 if p_kind not in ('all','lesson','practice','assessment','session') or p_page<1 or p_page>100000
  or p_tab not in ('summary','activities','assessments','notes') then raise exception 'Invalid detail query' using errcode='22023'; end if;
 if not private.is_teacher_assigned(p_student) then return null; end if;
 select to_jsonb(b) into student from private.teacher_students_base(p_student) b;
 with events as materialized (select * from private.teacher_student_events(p_student) where p_kind='all' or kind=p_kind),
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
  'sessions',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from sessions order by starts_at desc,id limit 10 offset (case when p_tab='activities' and p_kind in ('all','session') then p_page-1 else 0 end)*10) s),'[]'::jsonb),
  'sessionsTotal',(select count(*) from sessions),
  'nextSession',(select to_jsonb(s) from sessions s where s.starts_at>=now() and s.status='SCHEDULED' and s.booking_status='BOOKED' order by s.starts_at,s.id limit 1),
  'pending',coalesce((select jsonb_agg(to_jsonb(p) order by p.submitted_at,p.id) from private.teacher_student_pending(p_student) p),'[]'::jsonb),
  'placement',(select jsonb_build_object('state',c.state,'id',c.id,'recommended_course',co.title,'confidence',r.confidence,'feedback',r.feedback,'finalized_at',r.finalized_at,'chosen_cohort',ch.name)
   from public.placement_cases c left join public.placement_reviews r on r.placement_case_id=c.id
   left join public.courses co on co.id=r.recommended_course_id left join public.placement_decisions d on d.placement_case_id=c.id
   left join public.cohorts ch on ch.id=d.chosen_cohort_id where c.user_id=p_student order by c.created_at desc limit 1)
 ) into result;
 return result;
end $$;

revoke all on function private.teacher_student_curriculum(uuid),private.teacher_student_events(uuid),private.teacher_student_pending(uuid),private.teacher_students_base(uuid) from public,anon,authenticated;
revoke all on function public.teacher_students_workspace(jsonb),public.teacher_students_events(text,integer),public.teacher_student_workspace(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.teacher_students_workspace(jsonb),public.teacher_students_events(text,integer),public.teacher_student_workspace(uuid,text,integer,text) to authenticated;
