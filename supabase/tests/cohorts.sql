begin;
create function pg_temp.check_cohort(ok boolean,message text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception '%',message; end if; end $$;
insert into auth.users(id,email) values
 ('9c000000-0000-0000-0000-000000000001','cohort-a@example.test'),
 ('9c000000-0000-0000-0000-000000000002','cohort-b@example.test'),
 ('9c000000-0000-0000-0000-000000000003','cohort-teacher-a@example.test'),
 ('9c000000-0000-0000-0000-000000000004','cohort-teacher-b@example.test'),
 ('9c000000-0000-0000-0000-000000000005','cohort-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('9c000000-0000-0000-0000-000000000001','STUDENT'),('9c000000-0000-0000-0000-000000000002','STUDENT'),
 ('9c000000-0000-0000-0000-000000000003','TEACHER'),('9c000000-0000-0000-0000-000000000004','TEACHER'),('9c000000-0000-0000-0000-000000000005','ADMIN');
insert into public.teachers(id,user_id) values
 ('9c100000-0000-0000-0000-000000000001','9c000000-0000-0000-0000-000000000003'),
 ('9c100000-0000-0000-0000-000000000002','9c000000-0000-0000-0000-000000000004');
insert into public.enrollments(id,user_id,course_id,status) values
 ('9c300000-0000-0000-0000-000000000001','9c000000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000001','ACTIVE'),
 ('9c300000-0000-0000-0000-000000000002','9c000000-0000-0000-0000-000000000002','40000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.subscriptions(user_id,plan_id,provider,status) values
 ('9c000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test','ACTIVE');
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('9c200000-0000-0000-0000-000000000001','40000000-0000-4000-8000-000000000001','Basic A','test-basic-a','ACTIVE',now()-interval '1 day'),
 ('9c200000-0000-0000-0000-000000000002','40000000-0000-4000-8000-000000000001','Intermediate B','test-intermediate-b','ACTIVE',now()-interval '1 day');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values
 ('9c200000-0000-0000-0000-000000000001','9c000000-0000-0000-0000-000000000001','9c300000-0000-0000-0000-000000000001'),
 ('9c200000-0000-0000-0000-000000000002','9c000000-0000-0000-0000-000000000002','9c300000-0000-0000-0000-000000000002');
insert into public.cohort_teachers(cohort_id,teacher_id,is_primary) values
 ('9c200000-0000-0000-0000-000000000001','9c100000-0000-0000-0000-000000000001',true),
 ('9c200000-0000-0000-0000-000000000002','9c100000-0000-0000-0000-000000000002',true);
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,cohort_id)
select ('9c400000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 case when n=2 then '9c100000-0000-0000-0000-000000000002' else '9c100000-0000-0000-0000-000000000001' end::uuid,
 'CORE_CLASS','Cohort session '||n,now()+interval '14 days'+n*interval '2 hours',now()+interval '14 days 1 hour'+n*interval '2 hours',6,'weekly_core_classes',
 case when n=3 then null else ('9c200000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid end
 from generate_series(1,3) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000001","aal":"aal1"}',true);
select pg_temp.check_cohort((select count(*) from public.cohort_memberships)=1,'Student must only read own membership, not cohort roster');
select pg_temp.check_cohort(not exists(select 1 from public.live_sessions where id='9c400000-0000-0000-0000-000000000002'),'direct Data API SELECT must isolate foreign cohort');
select pg_temp.check_cohort(not exists(select 1 from public.get_agenda_sessions() where live_session_id='9c400000-0000-0000-0000-000000000002'),'Agenda definer must isolate foreign cohort');
select pg_temp.check_cohort(exists(select 1 from public.live_sessions where id='9c400000-0000-0000-0000-000000000003'),'legacy cohort-null session remains visible');
select public.book_live_session('9c400000-0000-0000-0000-000000000001');
do $$ begin
 begin perform public.book_live_session('9c400000-0000-0000-0000-000000000002'); raise exception 'foreign cohort booking allowed'; exception when insufficient_privilege then null; end;
 begin perform public.manage_cohort('STATUS','9c200000-0000-0000-0000-000000000001','{"status":"ARCHIVED"}'); raise exception 'Student admin command allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000002","aal":"aal1"}',true);
do $$ begin begin perform public.book_live_session('9c400000-0000-0000-0000-000000000002'); raise exception 'membership replaced entitlement'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000003","aal":"aal1"}',true);
select pg_temp.check_cohort((select count(*) from public.cohorts)=0,'Teacher AAL1 cohort access denied');
select pg_temp.check_cohort(not private.is_teacher_assigned('9c000000-0000-0000-0000-000000000001'),'Teacher AAL1 student scope denied');
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000003","aal":"aal2"}',true);
select pg_temp.check_cohort((select count(*) from public.cohorts)=1,'Teacher sees only assigned cohort');
select pg_temp.check_cohort(private.is_teacher_assigned('9c000000-0000-0000-0000-000000000001'),'Teacher scope includes cohort Student');
select pg_temp.check_cohort(not private.is_teacher_assigned('9c000000-0000-0000-0000-000000000002'),'Teacher cannot read unrelated Student');
select pg_temp.check_cohort((select count(*) from public.cohort_memberships)=1,'Teacher cohort roster is isolated');
do $$ begin begin perform public.get_teacher_session_roster('9c400000-0000-0000-0000-000000000002'); raise exception 'cohort expands Teacher session ownership'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000005","aal":"aal1"}',true);
do $$ begin begin perform public.manage_cohort('STATUS','9c200000-0000-0000-0000-000000000001','{"status":"ARCHIVED"}'); raise exception 'Admin AAL1 command allowed'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000005","aal":"aal2"}',true);
select public.manage_cohort('REMOVE_STUDENT','9c200000-0000-0000-0000-000000000001','{"user_id":"9c000000-0000-0000-0000-000000000001"}');
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000001","aal":"aal1"}',true);
select pg_temp.check_cohort(exists(select 1 from public.session_bookings b join public.live_sessions s on s.id=b.live_session_id where s.id='9c400000-0000-0000-0000-000000000001' and b.status='BOOKED'),'own Home booking join survives membership removal');
select public.cancel_live_booking('9c400000-0000-0000-0000-000000000001');
do $$ begin begin perform public.book_live_session('9c400000-0000-0000-0000-000000000001'); raise exception 'removed membership can rebook'; exception when insufficient_privilege then null; end; end $$;
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000003","aal":"aal2"}',true);
select pg_temp.check_cohort(not private.is_teacher_assigned('9c000000-0000-0000-0000-000000000001'),'membership removal revokes cohort-derived student scope');
reset role;
insert into public.teacher_student_assignments(teacher_id,student_user_id) values('9c100000-0000-0000-0000-000000000001','9c000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.check_cohort(private.is_teacher_assigned('9c000000-0000-0000-0000-000000000001'),'legacy assignment remains compatible');
reset role;
select pg_temp.check_cohort(not has_table_privilege('authenticated','public.cohorts','INSERT'),'cohort direct DML denied');
select pg_temp.check_cohort(not has_table_privilege('authenticated','public.cohort_memberships','UPDATE'),'membership direct DML denied');
select pg_temp.check_cohort(not has_table_privilege('authenticated','public.cohort_teachers','INSERT'),'Teacher assignment direct DML denied');
select pg_temp.check_cohort(not has_table_privilege('anon','public.cohorts','SELECT'),'anonymous cohort data denied');
select set_config('request.jwt.claim.sub','9c000000-0000-0000-0000-000000000005',true);
select set_config('request.jwt.claims','{"sub":"9c000000-0000-0000-0000-000000000005","aal":"aal2"}',true);
set local role authenticated;
select public.manage_cohort('ADD_STUDENT','9c200000-0000-0000-0000-000000000001','{"user_id":"9c000000-0000-0000-0000-000000000001"}');
select pg_temp.check_cohort((select count(*) from public.cohort_memberships where cohort_id='9c200000-0000-0000-0000-000000000001' and user_id='9c000000-0000-0000-0000-000000000001')=2,'reentry creates a new membership episode without deleting history');
do $$ begin
 begin perform public.manage_cohort('ADD_STUDENT','9c200000-0000-0000-0000-000000000001','{"user_id":"9c000000-0000-0000-0000-000000000003"}');
  raise exception 'missing enrollment accepted'; exception when check_violation then
  if sqlerrm<>'active compatible enrollment required' then raise; end if;
 end;
end $$;
select public.manage_cohort('CREATE',null,'{"course_id":"40000000-0000-4000-8000-000000000001","name":"Lifecycle","code":"test-cohort-lifecycle","timezone":"America/Recife","starts_at":"2026-01-01"}');
select public.manage_cohort('EDIT',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"name":"Lifecycle edited"}');
select public.manage_cohort('ADD_STUDENT',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"user_id":"9c000000-0000-0000-0000-000000000001"}');
select public.manage_cohort('ADD_STUDENT',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"user_id":"9c000000-0000-0000-0000-000000000001"}');
select pg_temp.check_cohort((select count(*) from public.cohort_memberships where cohort_id=(select id from public.cohorts where code='test-cohort-lifecycle'))=1,'repeated add must not duplicate active membership');
select public.manage_cohort('ADD_TEACHER',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"teacher_id":"9c100000-0000-0000-0000-000000000001","is_primary":true}');
select public.manage_cohort('STATUS',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"status":"ACTIVE"}');
select pg_temp.check_cohort((select name='Lifecycle edited' and status='ACTIVE' and starts_at='2026-01-01 03:00:00+00'::timestamptz from public.cohorts where code='test-cohort-lifecycle'),'admin lifecycle and local date timezone persist');
select public.manage_cohort('REMOVE_TEACHER',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"teacher_id":"9c100000-0000-0000-0000-000000000001"}');
select public.manage_cohort('STATUS',(select id from public.cohorts where code='test-cohort-lifecycle'),'{"status":"ARCHIVED"}');
reset role;
select pg_temp.check_cohort(not private.has_cohort_membership((select id from public.cohorts where code='test-cohort-lifecycle'),'9c000000-0000-0000-0000-000000000001'),'archive removes booking eligibility');
rollback;
