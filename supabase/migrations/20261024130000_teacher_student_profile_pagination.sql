-- Student profile: events and sessions paginate independently and never duplicate.
-- events exclude kind 'session' (shown by sessions); sessions use p_sessions_page (null falls back to p_page).
-- eventsTotal / sessionsTotal are separate. Security unchanged: AAL2 via current_teacher_id, assignment scope.
drop function public.teacher_student_workspace(uuid,text,integer,text);

create function public.teacher_student_workspace(p_student uuid,p_kind text default 'all',p_page integer default 1,p_tab text default 'summary',p_sessions_page integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); result jsonb; student jsonb;
begin
 if p_kind not in ('all','lesson','practice','assessment','session') or p_page<1 or p_page>100000
  or p_tab not in ('summary','activities','assessments','notes')
  or (p_sessions_page is not null and (p_sessions_page<1 or p_sessions_page>100000)) then raise exception 'Invalid detail query' using errcode='22023'; end if;
 if not private.is_teacher_assigned(p_student) then return null; end if;
 select to_jsonb(b) into student from private.teacher_students_base(p_student) b;
 -- Session bookings/attendance are listed once, in the independently paged sessions section.
 with events as materialized (select * from private.teacher_student_events(p_student) where kind<>'session' and (p_kind='all' or kind=p_kind)),
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
  'placement',(select jsonb_build_object('state',c.state,'id',c.id,'recommended_course',co.title,'confidence',r.confidence,'feedback',r.feedback,'finalized_at',r.finalized_at,'chosen_cohort',ch.name)
   from public.placement_cases c left join public.placement_reviews r on r.placement_case_id=c.id
   left join public.courses co on co.id=r.recommended_course_id left join public.placement_decisions d on d.placement_case_id=c.id
   left join public.cohorts ch on ch.id=d.chosen_cohort_id where c.user_id=p_student order by c.created_at desc limit 1)
 ) into result;
 return result;
end $$;

revoke all on function public.teacher_student_workspace(uuid,text,integer,text,integer) from public,anon,authenticated;
grant execute on function public.teacher_student_workspace(uuid,text,integer,text,integer) to authenticated;
