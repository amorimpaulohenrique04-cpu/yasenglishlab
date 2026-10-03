-- Real initial journey, RLS allow/deny, immutable recommendation, retries and Admin exception.
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
insert into auth.users(id,email) values
 ('99000000-0000-4000-8000-000000000001','placement-a@example.test'),('99000000-0000-4000-8000-000000000002','placement-b@example.test'),
 ('99000000-0000-4000-8000-000000000003','placement-teacher@example.test'),('99000000-0000-4000-8000-000000000004','placement-other-teacher@example.test'),('99000000-0000-4000-8000-000000000005','placement-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('99000000-0000-4000-8000-000000000001','STUDENT'),('99000000-0000-4000-8000-000000000002','STUDENT'),('99000000-0000-4000-8000-000000000003','TEACHER'),('99000000-0000-4000-8000-000000000004','TEACHER'),('99000000-0000-4000-8000-000000000005','ADMIN') on conflict do nothing;
insert into public.teachers(id,user_id) values('99010000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000003'),('99010000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000004');
insert into public.teacher_student_assignments(teacher_id,student_user_id) values('99010000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001');
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values('99000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','test','placement-test-a','ACTIVE');
insert into public.assessments(id,slug,title,purpose) values('99020000-0000-4000-8000-000000000001','placement-fixture','Placement fixture','Synthetic evidence; no CEFR');
insert into public.assessment_versions(id,assessment_id,version_number,status,specification,scoring_config) values('99030000-0000-4000-8000-000000000001','99020000-0000-4000-8000-000000000001',1,'DRAFT','{}','{"private":true}');
insert into public.assessment_items(id,assessment_version_id,position,skill,item_type,prompt,answer_key,rubric) values
 ('99040000-0000-4000-8000-000000000001','99030000-0000-4000-8000-000000000001',1,'GRAMMAR','MULTIPLE_CHOICE','{"prompt":"Choose","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}','{"optionId":"a"}','{}'),
 ('99040000-0000-4000-8000-000000000002','99030000-0000-4000-8000-000000000001',2,'SPEAKING','MANUAL_TEXT','{"prompt":"Explain a routine"}',null,'{"instructions":"Review evidence, no automated CEFR"}');
update public.assessment_versions set status='PUBLISHED',published_at=now()+interval '1 hour' where id='99030000-0000-4000-8000-000000000001';
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('99050000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Placement Monday','placement-monday','ACTIVE',now()-interval '1 day'),
 ('99050000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Placement Tuesday','placement-tuesday','ACTIVE',now()-interval '1 day'),
 ('99050000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','Placement Transfer','placement-transfer','ACTIVE',now()-interval '1 day');
insert into public.cohort_placement_settings values
 ('99050000-0000-4000-8000-000000000001',1,'[{"weekday":1,"startMinute":1140,"endMinute":1200}]',now()),
 ('99050000-0000-4000-8000-000000000002',6,'[{"weekday":2,"startMinute":1140,"endMinute":1200}]',now()),
 ('99050000-0000-4000-8000-000000000003',6,'[{"weekday":1,"startMinute":1140,"endMinute":1200}]',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.begin_placement();
select pg_temp.assert_true(public.begin_placement()=(select id from public.placement_cases),'begin retry same case');
select pg_temp.denied('select public.start_placement_assessment()','23514');
select public.save_placement_preferences('America/Recife',1,1080,1260);
select public.save_placement_preferences('America/Recife',1,1080,1260);
select set_config('placement.test.case',(select id::text from public.placement_cases),true);
reset role;
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where entity_id=current_setting('placement.test.case')::uuid and action='placement_preferences_saved'),'identical preference retry preserves audit');
set local role authenticated;
select public.start_placement_assessment();
select pg_temp.assert_true(public.start_placement_assessment()=(select assessment_attempt_id from public.placement_cases),'start retry same attempt');
select pg_temp.denied('select answer_key from public.assessment_items');
select pg_temp.denied('select rubric from public.assessment_items');
select pg_temp.denied('select scoring_config from public.assessment_versions');
select pg_temp.denied('update public.placement_cases set state=''ENROLLED''');
select pg_temp.denied('insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(gen_random_uuid(),auth.uid(),gen_random_uuid())');
select pg_temp.denied('insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,provenance) values(gen_random_uuid(),gen_random_uuid(),auth.uid(),''x'',''HIGH'',''{}'')');
select pg_temp.denied('select public.get_placement_queue(null)');
select pg_temp.denied('select public.open_placement_decision()','23514');
select pg_temp.denied('select public.complete_assessment_attempt((select assessment_attempt_id from public.placement_cases))','P0001');
select public.record_assessment_response((select assessment_attempt_id from public.placement_cases),'99040000-0000-4000-8000-000000000001','{"optionId":"a"}');
select public.record_assessment_response((select assessment_attempt_id from public.placement_cases),'99040000-0000-4000-8000-000000000002','{"text":"I study every evening."}');
select public.complete_assessment_attempt((select assessment_attempt_id from public.placement_cases));
select public.complete_assessment_attempt((select assessment_attempt_id from public.placement_cases));
select pg_temp.assert_true((select state='REVIEW_PENDING' from public.placement_cases),'completion enters review');
select pg_temp.assert_true((select result_cefr is null from public.assessment_attempts where id=(select assessment_attempt_id from public.placement_cases)),'no CEFR inference');
select pg_temp.denied('select public.finalize_placement_review((select id from public.placement_cases),''40000000-0000-4000-8000-000000000001'',''Feedback'',''HIGH'')');
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=0 from public.placement_cases),'Student B cannot read A');
select pg_temp.denied('select public.begin_placement()');
reset role;
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values('99000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','test','placement-test-b','ACTIVE');
set local role authenticated;
select public.start_assessment_attempt('99030000-0000-4000-8000-000000000001','99060000-0000-4000-8000-000000000002');
select public.record_assessment_response((select id from public.assessment_attempts where user_id=auth.uid()),'99040000-0000-4000-8000-000000000001','{"optionId":"a"}');
select public.record_assessment_response((select id from public.assessment_attempts where user_id=auth.uid()),'99040000-0000-4000-8000-000000000002','{"text":"Prior initial assessment evidence."}');
select public.complete_assessment_attempt((select id from public.assessment_attempts where user_id=auth.uid()));
select public.begin_placement();
select public.save_placement_preferences('America/Recife',1,1080,1260);
select public.start_placement_assessment();
select pg_temp.assert_true((select count(*)=1 from public.assessment_attempts where user_id=auth.uid()),'existing initial attempt reused without retake');
select pg_temp.assert_true((select state='REVIEW_PENDING' from public.placement_cases),'prior completion routes directly to review');
reset role;
select set_config('placement.test.case',(select id::text from public.placement_cases where user_id='99000000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=0 from public.placement_cases),'Teacher AAL1 denied');
select pg_temp.denied('select public.finalize_placement_review(current_setting(''placement.test.case'')::uuid,''40000000-0000-4000-8000-000000000001'',''Feedback'',''HIGH'')');
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=1 from public.placement_cases),'Assigned Teacher AAL2 reads');
select pg_temp.denied('select subscription_id from public.placement_cases');
select pg_temp.assert_true((select count(*)=1 from public.get_placement_queue(null,'TEACHER')),'assigned Teacher scoped queue');
select pg_temp.assert_true((select count(*)=0 from public.subscriptions),'Teacher receives no billing');
select pg_temp.assert_true(public.get_placement_review_evidence(current_setting('placement.test.case')::uuid)->'responses' is not null,'scoped private rubric read');
select public.finalize_placement_review(current_setting('placement.test.case')::uuid,'40000000-0000-4000-8000-000000000001','Feedback','HIGH');
select public.finalize_placement_review(current_setting('placement.test.case')::uuid,'40000000-0000-4000-8000-000000000001','Feedback','HIGH');
select pg_temp.denied('select public.finalize_placement_review(current_setting(''placement.test.case'')::uuid,''40000000-0000-4000-8000-000000000001'',''Different'',''HIGH'')','23514');
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=0 from public.placement_cases),'unassigned Teacher cannot read');
select pg_temp.denied('select public.get_placement_review_evidence(current_setting(''placement.test.case'')::uuid)');
select pg_temp.denied('select public.get_placement_projection(current_setting(''placement.test.case'')::uuid)');
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select public.open_placement_decision();
select pg_temp.assert_true((select count(*)=2 from public.get_placement_candidates(current_setting('placement.test.case')::uuid) candidate where candidate->>'id' in ('99050000-0000-4000-8000-000000000001','99050000-0000-4000-8000-000000000002','99050000-0000-4000-8000-000000000003')),'fixture candidates retain both compatible cohorts');
select pg_temp.assert_true(not exists(select 1 from public.get_placement_candidates(current_setting('placement.test.case')::uuid) candidate where candidate->>'id'='99050000-0000-4000-8000-000000000002'),'incompatible Tuesday filtered');
select pg_temp.denied('select public.get_placement_review_evidence(current_setting(''placement.test.case'')::uuid)');
select pg_temp.denied('select public.confirm_placement_choice(''99050000-0000-4000-8000-000000000002'')','23514');
reset role;
update public.subscriptions set current_period_start=now()+interval '1 hour' where provider_subscription_id='placement-test-a';
set local role authenticated;
select pg_temp.denied('select public.confirm_placement_choice(''99050000-0000-4000-8000-000000000001'')');
reset role;
update public.subscriptions set current_period_start=null where provider_subscription_id='placement-test-a';
set local role authenticated;
select public.confirm_placement_choice('99050000-0000-4000-8000-000000000001');
select public.confirm_placement_choice('99050000-0000-4000-8000-000000000001');
select pg_temp.denied('select public.confirm_placement_choice(null)','23514');
select pg_temp.assert_true((select count(*)=1 from public.cohort_memberships where user_id=auth.uid()),'no duplicate membership');
select pg_temp.denied('select public.confirm_placement_choice(''99050000-0000-4000-8000-000000000003'')','23514');
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000005',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000005","aal":"aal1"}',true);
select pg_temp.denied('select public.get_placement_queue(null)');
select pg_temp.denied('select public.transfer_placement_cohort(current_setting(''placement.test.case'')::uuid,''99050000-0000-4000-8000-000000000003'',''99060000-0000-4000-8000-000000000001'',''Schedule adjustment'')');
select set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000005","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=1 from public.get_placement_queue(null) row where row->'case'->>'id'=current_setting('placement.test.case')),'Admin AAL2 queue');
select public.transfer_placement_cohort(current_setting('placement.test.case')::uuid,'99050000-0000-4000-8000-000000000003','99060000-0000-4000-8000-000000000001','Schedule adjustment');
select public.transfer_placement_cohort(current_setting('placement.test.case')::uuid,'99050000-0000-4000-8000-000000000003','99060000-0000-4000-8000-000000000001','Schedule adjustment');
select pg_temp.denied('select public.transfer_placement_cohort(current_setting(''placement.test.case'')::uuid,''99050000-0000-4000-8000-000000000003'',''99060000-0000-4000-8000-000000000001'',''Different'')','23514');
select pg_temp.assert_true((select chosen_cohort_id='99050000-0000-4000-8000-000000000001' from public.placement_decisions where placement_case_id=current_setting('placement.test.case')::uuid),'initial choice preserved after transfer');
select pg_temp.assert_true((select recommended_course_id='40000000-0000-4000-8000-000000000001' from public.placement_reviews where placement_case_id=current_setting('placement.test.case')::uuid),'recommendation preserved');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='placement_cohort_transferred' and entity_id=current_setting('placement.test.case')::uuid),'transfer audit exactly once');
select pg_temp.denied('select public.configure_cohort_placement(''99050000-0000-4000-8000-000000000003'',6,''[{"weekday":2,"startMinute":1140,"endMinute":1200}]'')','23514');
reset role;
insert into public.user_roles(user_id,role) values('99000000-0000-4000-8000-000000000004','ADMIN');
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"99000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=0 from public.get_placement_queue(null,'TEACHER')),'mixed role Teacher workspace still scoped');
select pg_temp.assert_true((select count(*)=1 from public.get_placement_queue(null,'ADMIN') row where row->'case'->>'id'=current_setting('placement.test.case')),'mixed role explicitly authorized Admin workspace');
reset role;
select pg_temp.denied('update public.placement_cases set state=''PAYMENT_CONFIRMED'' where id=current_setting(''placement.test.case'')::uuid','23514');
select pg_temp.denied('update public.placement_reviews set feedback=''Overwrite''','55000');
set local role anon;
select pg_temp.denied('select * from public.placement_cases');
select pg_temp.denied('select public.begin_placement()');
rollback;
