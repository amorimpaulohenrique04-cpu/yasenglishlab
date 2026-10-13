-- Stage 06c: Placement reuses only the attempt linked to its own case (idempotency_key = case id).
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.login(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', 'aal1')::text, true);
$$;

insert into auth.users(id,email) values
 ('9f000000-0000-4000-8000-000000000001','pal-a@example.test'),
 ('9f000000-0000-4000-8000-000000000002','pal-b@example.test');
insert into public.user_roles(user_id,role) values
 ('9f000000-0000-4000-8000-000000000001','STUDENT'),('9f000000-0000-4000-8000-000000000002','STUDENT') on conflict do nothing;
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values
 ('9f000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','test','pal-a','ACTIVE'),
 ('9f000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','test','pal-b','ACTIVE');
insert into public.assessments(id,slug,title,purpose) values('9f020000-0000-4000-8000-000000000001','pal-fixture','PAL fixture','Synthetic evidence; no CEFR');
insert into public.assessment_versions(id,assessment_id,version_number,status,specification,scoring_config) values('9f030000-0000-4000-8000-000000000001','9f020000-0000-4000-8000-000000000001',1,'DRAFT','{}','{"private":true}');
insert into public.assessment_items(id,assessment_version_id,position,skill,item_type,prompt,answer_key,rubric) values
 ('9f040000-0000-4000-8000-000000000001','9f030000-0000-4000-8000-000000000001',1,'GRAMMAR','MULTIPLE_CHOICE','{"prompt":"Choose","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}','{"optionId":"a"}','{}');
-- Far-future publication so this version is the newest PUBLISHED one regardless of seeds.
update public.assessment_versions set status='PUBLISHED',published_at=now()+interval '1 year' where id='9f030000-0000-4000-8000-000000000001';

-- Fixture only: A holds an IN_PROGRESS attempt of foreign origin (random idempotency key).
insert into public.assessment_attempts(id,user_id,assessment_version_id,idempotency_key) values
 ('9f060000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000001','9f030000-0000-4000-8000-000000000001','9f0f0000-0000-4000-8000-000000000001');

-- (a) A reaches ASSESSMENT_REQUIRED through the real flow and starts the Placement assessment.
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.begin_placement();
select public.save_placement_preferences('America/Recife',1,1080,1260);
select set_config('pal.a.attempt',public.start_placement_assessment()::text,true);
reset role;
select pg_temp.assert_true(current_setting('pal.a.attempt')::uuid<>'9f060000-0000-4000-8000-000000000001','(a) foreign-origin attempt is not reused');
select pg_temp.assert_true((select a.idempotency_key=c.id and a.user_id=c.user_id and a.status='IN_PROGRESS' from public.assessment_attempts a join public.placement_cases c on c.assessment_attempt_id=a.id where c.user_id='9f000000-0000-4000-8000-000000000001'),'(a) new attempt is linked to the case');
select pg_temp.assert_true((select status='IN_PROGRESS' and idempotency_key='9f0f0000-0000-4000-8000-000000000001' from public.assessment_attempts where id='9f060000-0000-4000-8000-000000000001'),'(a) foreign attempt untouched');
select pg_temp.assert_true((select count(*)=2 from public.assessment_attempts where user_id='9f000000-0000-4000-8000-000000000001'),'(a) exactly one new attempt created');
select pg_temp.assert_true((select state='IN_PROGRESS' from public.placement_cases where user_id='9f000000-0000-4000-8000-000000000001'),'(a) case IN_PROGRESS');

-- (b) Idempotent: a retry returns the same attempt, and the case-linked lookup (case link cleared in fixture
-- mode, as if the attempt existed before the link) re-finds it without creating another one.
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(public.start_placement_assessment()=current_setting('pal.a.attempt')::uuid,'(b) retry returns the same attempt');
reset role;
set local session_replication_role = replica;
update public.placement_cases set assessment_attempt_id=null,state='ASSESSMENT_REQUIRED' where user_id='9f000000-0000-4000-8000-000000000001';
set local session_replication_role = origin;
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(public.start_placement_assessment()=current_setting('pal.a.attempt')::uuid,'(b) case-linked attempt is re-found');
reset role;
select pg_temp.assert_true((select count(*)=2 from public.assessment_attempts where user_id='9f000000-0000-4000-8000-000000000001'),'(b) no extra attempt created on retry');

-- (c) B starts, the case-linked attempt is SUBMITTED, and the case link is re-established: REVIEW_PENDING.
select pg_temp.login('9f000000-0000-4000-8000-000000000002');
set local role authenticated;
select public.begin_placement();
select public.save_placement_preferences('America/Recife',1,1080,1260);
select set_config('pal.b.attempt',public.start_placement_assessment()::text,true);
reset role;
set local session_replication_role = replica;
update public.assessment_attempts set status='SUBMITTED',submitted_at=now() where id=current_setting('pal.b.attempt')::uuid;
update public.placement_cases set assessment_attempt_id=null,state='ASSESSMENT_REQUIRED' where user_id='9f000000-0000-4000-8000-000000000002';
set local session_replication_role = origin;
select pg_temp.login('9f000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(public.start_placement_assessment()=current_setting('pal.b.attempt')::uuid,'(c) submitted case attempt is reused');
reset role;
select pg_temp.assert_true((select state='REVIEW_PENDING' and assessment_attempt_id=current_setting('pal.b.attempt')::uuid from public.placement_cases where user_id='9f000000-0000-4000-8000-000000000002'),'(c) case moves to REVIEW_PENDING');
select pg_temp.assert_true((select count(*)=1 from public.assessment_attempts where user_id='9f000000-0000-4000-8000-000000000002'),'(c) no extra attempt for B');

-- Privilege surface unchanged.
select pg_temp.assert_true(has_function_privilege('authenticated','public.start_placement_assessment()','EXECUTE') and not has_function_privilege('anon','public.start_placement_assessment()','EXECUTE'),'start_placement_assessment grants unchanged');
rollback;
