-- Stage 06a: enrollment integrity. Cross-course transfer closes the previous enrollment atomically,
-- reactivation is audited, and a Student without ACTIVE cohort membership cannot record lesson progress.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
-- Returns 'ok' or '<sqlstate>:<message>' so allow/deny and the stable message can both be asserted.
create function pg_temp.attempt(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlstate || ':' || sqlerrm; end $$;

-- Users: S cross-course Student, G legacy Student (enrollment, no membership), R reactivation Student,
-- N Student without enrollment, T Teacher, X Admin, Y staff with enrollment and no membership.
insert into auth.users(id,email) values
 ('9e000000-0000-4000-8000-000000000001','ei-s@example.test'),
 ('9e000000-0000-4000-8000-000000000002','ei-g@example.test'),
 ('9e000000-0000-4000-8000-000000000003','ei-r@example.test'),
 ('9e000000-0000-4000-8000-000000000004','ei-n@example.test'),
 ('9e000000-0000-4000-8000-000000000005','ei-t@example.test'),
 ('9e000000-0000-4000-8000-000000000006','ei-x@example.test');
insert into public.user_roles(user_id,role) values
 ('9e000000-0000-4000-8000-000000000001','STUDENT'),('9e000000-0000-4000-8000-000000000002','STUDENT'),
 ('9e000000-0000-4000-8000-000000000003','STUDENT'),('9e000000-0000-4000-8000-000000000004','STUDENT'),
 ('9e000000-0000-4000-8000-000000000005','TEACHER'),('9e000000-0000-4000-8000-000000000006','ADMIN');
insert into public.courses(id,slug,title,active,publication_status,published_at)
 values('9e100000-0000-4000-8000-000000000002','ei-course-b','EI Course B',true,'PUBLISHED',now());
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('9e200000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','EI A1','ei-a1','ACTIVE',now()-interval '1 day'),
 ('9e200000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','EI A2','ei-a2','ACTIVE',now()-interval '1 day'),
 ('9e200000-0000-4000-8000-000000000003','9e100000-0000-4000-8000-000000000002','EI B1','ei-b1','ACTIVE',now()-interval '1 day');
insert into public.cohort_placement_settings(cohort_id,capacity,schedule) values
 ('9e200000-0000-4000-8000-000000000001',6,'[{"weekday":1,"startMinute":1140,"endMinute":1200}]'),
 ('9e200000-0000-4000-8000-000000000002',6,'[{"weekday":1,"startMinute":1140,"endMinute":1200}]'),
 ('9e200000-0000-4000-8000-000000000003',6,'[{"weekday":1,"startMinute":1140,"endMinute":1200}]');
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status) values
 ('9e300000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','test','ei-s','ACTIVE'),
 ('9e300000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','test','ei-r','ACTIVE');
insert into public.enrollments(id,user_id,course_id,status) values
 ('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','ACTIVE'),
 ('9e400000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','ACTIVE'),
 ('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','CANCELLED'),
 ('9e400000-0000-4000-8000-000000000006','9e000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.cohort_memberships(id,cohort_id,user_id,enrollment_id) values
 ('9e500000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001','9e400000-0000-4000-8000-000000000001');

-- Placement cases are built in replica mode (fixture only): S is ENROLLED, R is in STUDENT_DECISION.
set local session_replication_role = replica;
insert into public.assessment_attempts(id,user_id,assessment_version_id,status,submitted_at) values
 ('9e600000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001',gen_random_uuid(),'SUBMITTED',now()),
 ('9e600000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000003',gen_random_uuid(),'SUBMITTED',now());
insert into public.placement_cases(id,user_id,subscription_id,assessment_attempt_id,membership_id,state) values
 ('9e700000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001','9e300000-0000-4000-8000-000000000001','9e600000-0000-4000-8000-000000000001','9e500000-0000-4000-8000-000000000001','ENROLLED'),
 ('9e700000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000003','9e300000-0000-4000-8000-000000000003','9e600000-0000-4000-8000-000000000003',null,'STUDENT_DECISION');
insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,provenance) values
 ('9e700000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000006','fixture','HIGH','{}'),
 ('9e700000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000006','fixture','HIGH','{}');
insert into public.student_schedule_preferences(placement_case_id,timezone,weekday,start_minute,end_minute) values
 ('9e700000-0000-4000-8000-000000000001','America/Recife',1,1080,1260),
 ('9e700000-0000-4000-8000-000000000003','America/Recife',1,1080,1260);
set local session_replication_role = origin;

-- 1. S (membership A1) records progress.
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',40,60);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.lesson_progress where user_id='9e000000-0000-4000-8000-000000000001' and enrollment_id='9e400000-0000-4000-8000-000000000001'),'S progress recorded with membership');

-- 2. Same-course transfer (A1 -> A2) must NOT close the enrollment; retry is idempotent.
select pg_temp.login('9e000000-0000-4000-8000-000000000006','aal2');
set local role authenticated;
select set_config('ei.m2',public.transfer_placement_cohort('9e700000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002','9e800000-0000-4000-8000-000000000001','same course move')::text,true);
select pg_temp.assert_true(public.transfer_placement_cohort('9e700000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000002','9e800000-0000-4000-8000-000000000001','same course move')=current_setting('ei.m2')::uuid,'same-course retry returns same membership');
reset role;
select pg_temp.assert_true((select status='ACTIVE' from public.enrollments where id='9e400000-0000-4000-8000-000000000001'),'same-course transfer keeps enrollment ACTIVE');
select pg_temp.assert_true((select count(*)=1 from public.placement_transfers where operation_id='9e800000-0000-4000-8000-000000000001'),'same-course retry does not duplicate transfer');
select pg_temp.assert_true((select count(*)=0 from public.audit_logs where action='enrollment_closed_on_transfer' and entity_id='9e400000-0000-4000-8000-000000000001'),'same-course transfer writes no closure audit');
select pg_temp.assert_true((select count(*)=1 from public.cohort_memberships where user_id='9e000000-0000-4000-8000-000000000001' and status='ACTIVE' and cohort_id='9e200000-0000-4000-8000-000000000002'),'S has exactly one ACTIVE membership in A2');

-- 3. Cross-course transfer (A2 -> B1) closes the course A enrollment, keeps progress, atomically and idempotently.
select pg_temp.login('9e000000-0000-4000-8000-000000000006','aal2');
set local role authenticated;
select set_config('ei.m3',public.transfer_placement_cohort('9e700000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000003','9e800000-0000-4000-8000-000000000002','change course')::text,true);
select pg_temp.assert_true(public.transfer_placement_cohort('9e700000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000003','9e800000-0000-4000-8000-000000000002','change course')=current_setting('ei.m3')::uuid,'cross-course retry returns same membership');
reset role;
select pg_temp.assert_true((select status='CANCELLED' and completed_at is null from public.enrollments where id='9e400000-0000-4000-8000-000000000001'),'cross-course transfer closes previous enrollment as CANCELLED');
select pg_temp.assert_true((select count(*)=1 from public.enrollments where user_id='9e000000-0000-4000-8000-000000000001' and course_id='9e100000-0000-4000-8000-000000000002' and status='ACTIVE'),'target course enrollment ACTIVE');
select pg_temp.assert_true((select count(*)=1 from public.enrollments where user_id='9e000000-0000-4000-8000-000000000001' and status='ACTIVE'),'S has exactly one ACTIVE enrollment');
select pg_temp.assert_true((select count(*)=1 from public.cohort_memberships where user_id='9e000000-0000-4000-8000-000000000001' and status='ACTIVE'),'S has exactly one ACTIVE membership');
select pg_temp.assert_true((select completion_percent=40 from public.lesson_progress where enrollment_id='9e400000-0000-4000-8000-000000000001'),'progress of the closed enrollment is preserved');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='enrollment_closed_on_transfer' and entity_id='9e400000-0000-4000-8000-000000000001'),'closure audited once despite retry');
select pg_temp.assert_true((select count(*)=1 from public.placement_transfers where operation_id='9e800000-0000-4000-8000-000000000002'),'cross-course retry does not duplicate transfer');

-- 4. S cannot record progress on the closed course.
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(pg_temp.attempt('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',50,70)')='42501:Active enrollment in a published course required','closed enrollment cannot receive progress');
reset role;
select pg_temp.assert_true((select completion_percent=40 from public.lesson_progress where enrollment_id='9e400000-0000-4000-8000-000000000001'),'denied write left progress untouched');

-- 5. Transfer back (B1 -> A1) reactivates the course A enrollment with audit and keeps old progress.
select pg_temp.login('9e000000-0000-4000-8000-000000000006','aal2');
set local role authenticated;
select public.transfer_placement_cohort('9e700000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000001','9e800000-0000-4000-8000-000000000003','back to course A');
reset role;
select pg_temp.assert_true((select status='ACTIVE' from public.enrollments where id='9e400000-0000-4000-8000-000000000001'),'transfer back reactivates enrollment');
select pg_temp.assert_true((select status='CANCELLED' from public.enrollments where user_id='9e000000-0000-4000-8000-000000000001' and course_id='9e100000-0000-4000-8000-000000000002'),'course B enrollment closed on transfer back');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='enrollment_reactivated' and entity_id='9e400000-0000-4000-8000-000000000001' and data->>'previous_status'='CANCELLED' and data->>'source'='transfer_placement_cohort'),'reactivation audited');
select pg_temp.assert_true((select count(*)=1 from public.enrollments where user_id='9e000000-0000-4000-8000-000000000001' and status='ACTIVE'),'S again has exactly one ACTIVE enrollment');
select pg_temp.login('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',60,80);
reset role;
select pg_temp.assert_true((select completion_percent=60 from public.lesson_progress where enrollment_id='9e400000-0000-4000-8000-000000000001'),'progress continues after returning to course A');

-- 6. confirm_placement_choice reopening a CANCELLED enrollment is audited.
select pg_temp.login('9e000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('ei.mr',public.confirm_placement_choice('9e200000-0000-4000-8000-000000000001')::text,true);
select pg_temp.assert_true(public.confirm_placement_choice('9e200000-0000-4000-8000-000000000001')=current_setting('ei.mr')::uuid,'confirm retry returns same membership');
reset role;
select pg_temp.assert_true((select status='ACTIVE' from public.enrollments where id='9e400000-0000-4000-8000-000000000003'),'confirm reopened the enrollment');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='enrollment_reactivated' and entity_id='9e400000-0000-4000-8000-000000000003' and data->>'previous_status'='CANCELLED' and data->>'source'='confirm_placement_choice'),'confirm reactivation audited once');
select pg_temp.assert_true((select count(*)=0 from public.audit_logs where action='enrollment_reactivated' and data::text ~* 'example\.test'),'reactivation audit carries no PII');

-- 7. Legacy Student with ACTIVE enrollment and no membership is blocked with a stable message; with membership it records.
select pg_temp.assert_true((select count(*)=1 from public.enrollments e where e.user_id='9e000000-0000-4000-8000-000000000002' and e.status='ACTIVE' and not exists(select 1 from public.cohort_memberships m where m.enrollment_id=e.id and m.status='ACTIVE')),'G is an orphan enrollment before placement');
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(pg_temp.attempt('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',10,5)')='42501:active cohort membership required','orphan Student denied with stable message');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.lesson_progress where user_id='9e000000-0000-4000-8000-000000000002'),'denied write leaves no progress');
select pg_temp.assert_true((select count(*)=1 from public.enrollments where id='9e400000-0000-4000-8000-000000000002' and status='ACTIVE'),'blocking progress does not touch the enrollment');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values('9e200000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002','9e400000-0000-4000-8000-000000000002');
select pg_temp.login('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',10,5);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.lesson_progress where user_id='9e000000-0000-4000-8000-000000000002'),'Student with ACTIVE membership records progress');

-- 8. Users without enrollment keep the previous error (not the membership gate); staff is not gated.
select pg_temp.login('9e000000-0000-4000-8000-000000000004');
set local role authenticated;
select pg_temp.assert_true(pg_temp.attempt('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',10,5)')='42501:Active enrollment in a published course required','no-enrollment user keeps previous behavior');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000006');
set local role authenticated;
select pg_temp.assert_true(pg_temp.attempt('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',10,5)')='ok','staff without membership is not gated');
reset role;

-- 9. Orphan query: canonical (seed/E2E) users never have ACTIVE enrollments without ACTIVE membership.
select pg_temp.assert_true((select count(*)=0 from public.enrollments e join auth.users u on u.id=e.user_id
  where u.email like 'canonical.%@example.test' and e.status='ACTIVE'
    and not exists(select 1 from public.cohort_memberships m where m.enrollment_id=e.id and m.status='ACTIVE')),'canonical users have no orphan ACTIVE enrollments');

-- 10. Privilege surface.
select pg_temp.assert_true(not has_function_privilege('authenticated','private.activate_enrollment(uuid,uuid,text)','EXECUTE'),'activate_enrollment is not client callable');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.enforce_active_cohort_membership()','EXECUTE'),'membership gate is not client callable');
select pg_temp.assert_true(has_function_privilege('authenticated','public.transfer_placement_cohort(uuid,uuid,uuid,text)','EXECUTE') and not has_function_privilege('anon','public.transfer_placement_cohort(uuid,uuid,uuid,text)','EXECUTE'),'transfer grants unchanged');
rollback;
