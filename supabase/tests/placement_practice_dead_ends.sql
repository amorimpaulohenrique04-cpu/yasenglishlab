-- Audit 2026-10-18: placement/practice dead ends. Transactional fixtures only.
-- 1. An admin enrollment with an active cohort membership supersedes an open placement journey.
-- 2. Admin+AAL2 reassigns the placement reviewer while REVIEW_PENDING, with an audited reason.
-- 3. Manual practice answers without any eligible reviewer raise PRACTICE_NO_REVIEWER.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('fd180000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'placement_practice_dead_ends: %',message;end if;end$$;
create function pg_temp.login(n integer,aal text default 'aal2') returns void language sql as $$select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',json_build_object('sub',pg_temp.id(n),'aal',aal)::text,true)$$;
create function pg_temp.state(q text) returns text language plpgsql as $$begin execute q;return 'OK';exception when others then return sqlstate;end$$;
create function pg_temp.item(doc jsonb,kind text,id uuid) returns jsonb language sql as $$select i from jsonb_array_elements(doc->'alerts') a cross join lateral jsonb_array_elements(a->'items') i where a->>'kind'=kind and i->>'id'=id::text$$;

-- 1-4 Students, 20 Admin, 21/22/23 Teachers (23 inactive).
insert into auth.users(id,email) select pg_temp.id(n),'dead-ends-'||n||'@example.test' from generate_series(1,23)n where n<=4 or n>=20;
insert into public.user_roles(user_id,role) select pg_temp.id(n),case when n=20 then 'ADMIN' when n>20 then 'TEACHER' else 'STUDENT' end
 from generate_series(1,23)n where n<=4 or n>=20;
insert into public.profiles(user_id,display_name) select pg_temp.id(n),'Dead ends '||n from generate_series(1,4)n
 on conflict (user_id) do update set display_name=excluded.display_name;
insert into public.teachers(id,user_id,active) values(pg_temp.id(121),pg_temp.id(21),true),(pg_temp.id(122),pg_temp.id(22),true),(pg_temp.id(123),pg_temp.id(23),false);
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status)
 select pg_temp.id(n),'10000000-0000-0000-0000-000000000001','test','dead-ends-'||n,'ACTIVE' from generate_series(1,2)n;
insert into public.courses(id,slug,title,active,publication_status,published_at) values(pg_temp.id(100),'dead-ends-track','Dead ends track',true,'PUBLISHED',now());
insert into public.cohorts(id,course_id,name,code,status,starts_at) values(pg_temp.id(300),pg_temp.id(100),'Dead ends cohort','dead-ends-cohort','ACTIVE',now()-interval '1 day');
-- The cohort meets on Mondays; the Students are only available on Wednesdays, so there is no candidate.
insert into public.cohort_placement_settings(cohort_id,capacity,schedule) values(pg_temp.id(300),6,'[{"weekday":1,"startMinute":540,"endMinute":600}]');
update public.assessments set is_placement=false where is_placement;
insert into public.assessments(id,slug,title,purpose,is_placement) values(pg_temp.id(200),'dead-ends-entry','Dead ends entry','Synthetic dead-end test',true);
insert into public.assessment_versions(id,assessment_id,version_number,status,specification,scoring_config) values(pg_temp.id(201),pg_temp.id(200),1,'DRAFT','{}','{}');
insert into public.assessment_items(id,assessment_version_id,position,skill,item_type,prompt,answer_key) values(pg_temp.id(202),pg_temp.id(201),1,'GRAMMAR','MULTIPLE_CHOICE','{"prompt":"Choose","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}','{"optionId":"a"}');
update public.assessment_versions set status='PUBLISHED',published_at=now() where id=pg_temp.id(201);
-- Student 1 already has a reviewer (Teacher 21) assigned yesterday.
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) values(pg_temp.id(121),pg_temp.id(1),now()-interval '1 day');
create temp table cases(n integer primary key,id uuid);
grant select on cases to authenticated;
do $$declare n integer;c uuid;a uuid;begin
  for n in 1..2 loop
    perform pg_temp.login(n,'aal1');
    c:=public.begin_placement();insert into cases values(n,c);
    perform public.save_placement_preferences('America/Recife',3,480,660);
    a:=public.start_placement_assessment();
    perform public.record_assessment_response(a,pg_temp.id(202),'{"optionId":"a"}');
    perform public.complete_assessment_attempt(a);
  end loop;
end$$;
-- Student 2 is reviewed by Teacher 22 and opens the decision with no compatible cohort.
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) values(pg_temp.id(122),pg_temp.id(2),now()-interval '1 day');
select pg_temp.login(22);
select public.finalize_placement_review((select id from cases where n=2),pg_temp.id(100),'Human recommendation for dead-end fixture','HIGH');
select pg_temp.login(2,'aal1');select public.open_placement_decision();
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
update public.placement_cases set state_changed_at=now()-interval '30 days' where id=(select id from cases where n=2);

-- Students 3 and 4 have a submitted manual practice waiting for review; only Student 4 has a Teacher.
insert into public.practice_activities(id,slug,title,skill,estimated_minutes,content,active,publication_status,published_at)
values(pg_temp.id(400),'dead-ends-manual','Dead ends manual','SPEAKING',5,
 '{"kind":"MANUAL_AUDIO","evaluationMode":"MANUAL_PENDING","prompt":"Describe your day","instructions":"Record a short response"}',true,'PUBLISHED',now());
insert into public.practice_attempts(id,user_id,practice_activity_id,status,submitted_at) values
 (pg_temp.id(403),pg_temp.id(3),pg_temp.id(400),'SUBMITTED',now()-interval '2 days'),
 (pg_temp.id(404),pg_temp.id(4),pg_temp.id(400),'SUBMITTED',now()-interval '2 days');
insert into public.practice_results(practice_attempt_id,evaluation_status) values(pg_temp.id(403),'PENDING_MANUAL'),(pg_temp.id(404),'PENDING_MANUAL')
 on conflict (practice_attempt_id) do update set evaluation_status='PENDING_MANUAL';
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) values(pg_temp.id(122),pg_temp.id(4),now()-interval '1 day');
-- An inactive Teacher does not count as a reviewer for Student 3.
insert into public.teacher_student_assignments(teacher_id,student_user_id,starts_at) values(pg_temp.id(123),pg_temp.id(3),now()-interval '1 day');

set local role authenticated;
-- Before the admin enrollment the stuck decision is visible and the journey is open.
select pg_temp.login(20);
create temp table before_view as select public.admin_operational_alerts() doc;
select pg_temp.ok(jsonb_array_length(doc->'alerts')=7,'seven operational categories') from before_view;
select pg_temp.ok(pg_temp.item(doc,'STALE_DECISION',(select id from cases where n=2)) is not null,'stale decision before enrollment') from before_view;
select pg_temp.ok(pg_temp.item(doc,'PLACEMENT_NO_COHORT',(select id from cases where n=2))->>'reason'='NO_COMPATIBILITY','no compatible cohort before enrollment') from before_view;
select pg_temp.ok(pg_temp.item(doc,'PRACTICE_NO_REVIEWER',pg_temp.id(3))->>'reason'='NO_REVIEWER','manual practice without reviewer is alerted') from before_view;
select pg_temp.ok(pg_temp.item(doc,'PRACTICE_NO_REVIEWER',pg_temp.id(4)) is null,'assigned Teacher suppresses the reviewer alert') from before_view;
select pg_temp.login(2,'aal1');
select pg_temp.ok(public.student_has_active_cohort_enrollment() is false,'no active cohort enrollment yet');
select pg_temp.login(20);
select pg_temp.ok(pg_temp.state('select public.student_has_active_cohort_enrollment()')='42501','predicate RPC is Student-only');
reset role;set local role anon;
select pg_temp.ok(pg_temp.state('select public.student_has_active_cohort_enrollment()')='42501','anonymous predicate denied');
select pg_temp.ok(pg_temp.state(format('select public.reassign_placement_teacher(%L,%L,%L)',pg_temp.id(1),pg_temp.id(122),'x'))='42501','anonymous reassignment denied');
reset role;set local role authenticated;

-- Admin enrolls Student 2 directly; the placement case is not rewritten, the journey is superseded.
select pg_temp.login(20);
select public.admin_enroll_in_course(pg_temp.id(2),pg_temp.id(100),pg_temp.id(300),pg_temp.id(900),'Matricula manual pela operacao');
select pg_temp.ok((select state='STUDENT_DECISION' from public.placement_cases where id=(select id from cases where n=2)),'admin enrollment keeps the placement case (PLACEMENT.md 12E)');
create temp table after_view as select public.admin_operational_alerts() doc;
select pg_temp.ok(pg_temp.item(doc,'STALE_DECISION',(select id from cases where n=2)) is null,'enrolled Student leaves stale decisions') from after_view;
select pg_temp.ok(pg_temp.item(doc,'PLACEMENT_NO_COHORT',(select id from cases where n=2)) is null,'enrolled Student leaves cases without cohort') from after_view;
select pg_temp.login(2,'aal1');
select pg_temp.ok(public.student_has_active_cohort_enrollment(),'active cohort enrollment supersedes the journey');

-- Reviewer reassignment: authorization, reason, state.
select pg_temp.login(20,'aal1');
select pg_temp.ok(pg_temp.state(format('select public.reassign_placement_teacher(%L,%L,%L)',(select id from cases where n=1),pg_temp.id(122),'Professor indisponivel'))='42501','Admin AAL1 denied');
select pg_temp.login(22);
select pg_temp.ok(pg_temp.state(format('select public.reassign_placement_teacher(%L,%L,%L)',(select id from cases where n=1),pg_temp.id(122),'Professor indisponivel'))='42501','Teacher denied');
select pg_temp.login(20);
select pg_temp.ok(pg_temp.state(format('select public.reassign_placement_teacher(%L,%L,%L)',(select id from cases where n=1),pg_temp.id(122),'   '))='22023','blank reason rejected');
select pg_temp.ok(pg_temp.state(format('select public.reassign_placement_teacher(%L,%L,%L)',(select id from cases where n=1),pg_temp.id(123),'Professor indisponivel'))='23514','inactive Teacher rejected');
select pg_temp.ok(pg_temp.state(format('select public.reassign_placement_teacher(%L,%L,%L)',(select id from cases where n=2),pg_temp.id(121),'Professor indisponivel'))='23514','only REVIEW_PENDING cases');
-- The original command still refuses to stack a second reviewer.
select pg_temp.ok(pg_temp.state(format('select public.assign_placement_teacher(%L,%L)',(select id from cases where n=1),pg_temp.id(122)))='23514','assign still refuses stacking');
create temp table reassigned as select public.reassign_placement_teacher((select id from cases where n=1),pg_temp.id(122),'  Professor indisponivel  ') id;
grant select on reassigned to authenticated;
select pg_temp.ok(public.reassign_placement_teacher((select id from cases where n=1),pg_temp.id(122),'Professor indisponivel')=(select id from reassigned),'identical retry returns the same assignment');
reset role;
select pg_temp.ok((select count(*)=1 from public.teacher_student_assignments where student_user_id=pg_temp.id(1) and (ends_at is null or ends_at>now())),'exactly one active reviewer');
select pg_temp.ok((select teacher_id=pg_temp.id(122) from public.teacher_student_assignments where id=(select id from reassigned)),'new reviewer assigned');
select pg_temp.ok((select ends_at is not null from public.teacher_student_assignments where teacher_id=pg_temp.id(121) and student_user_id=pg_temp.id(1)),'previous assignment ended, not deleted');
select pg_temp.ok((select count(*)=1 and bool_and(data->>'reason'='Professor indisponivel' and data->'previous_teacher_ids'=jsonb_build_array(pg_temp.id(121)) and actor_user_id=pg_temp.id(20))
 from public.audit_logs where action='placement_teacher_reassigned' and entity_id=(select id from cases where n=1)),'one audited reassignment with reason and previous reviewer');
set local role authenticated;
select pg_temp.login(21);
select pg_temp.ok(not private.is_teacher_assigned(pg_temp.id(1)),'previous reviewer out of scope');
select pg_temp.ok(pg_temp.state(format('select public.finalize_placement_review(%L,%L,%L,%L)',(select id from cases where n=1),pg_temp.id(100),'Previous reviewer attempt','HIGH'))<>'OK','previous reviewer cannot finalize');
select pg_temp.login(22);
select pg_temp.ok(private.is_teacher_assigned(pg_temp.id(1)),'new reviewer in scope');
select public.finalize_placement_review((select id from cases where n=1),pg_temp.id(100),'New reviewer recommendation','HIGH');
reset role;
select pg_temp.ok((select state='PLACEMENT_READY' from public.placement_cases where id=(select id from cases where n=1)),'new reviewer unblocks the case');
rollback;
