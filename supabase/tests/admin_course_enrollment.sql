-- ADR 0023 / E. Independent, transactional fixtures; no committed student changes.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ef000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$
begin if not coalesce(value,false) then raise exception 'admin_course_enrollment: %',message; end if; end;
$$;
create function pg_temp.login(n integer,aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),
    set_config('request.jwt.claims',json_build_object('sub',pg_temp.id(n),'aal',aal)::text,true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end;
$$;
create function pg_temp.enroll(n integer,cohort integer,op integer,reason text default 'Proximo curso')
returns jsonb language sql as $$
  select public.admin_enroll_in_course(pg_temp.id(n),pg_temp.id(101),pg_temp.id(cohort),pg_temp.id(op),reason);
$$;
insert into auth.users(id,email) select pg_temp.id(n),'enroll-'||n||'@example.test' from generate_series(1,13)n;
insert into public.user_roles(user_id,role) select pg_temp.id(n),
  case when n in (1,2) then 'ADMIN' when n=3 then 'TEACHER' when n=4 then 'SUPPORT' else 'STUDENT' end
  from generate_series(1,13)n;
insert into public.courses(id,slug,title,active,publication_status,published_at) values
  (pg_temp.id(100),'enroll-old','Completed course',true,'PUBLISHED',now()),
  (pg_temp.id(101),'enroll-next','Next course',true,'PUBLISHED',now()),
  (pg_temp.id(102),'enroll-draft','Draft course',true,'DRAFT',null),
  (pg_temp.id(103),'enroll-inactive','Inactive course',false,'PUBLISHED',now()),
  (pg_temp.id(104),'enroll-other','Other active course',true,'PUBLISHED',now());
insert into public.modules(id,course_id,position,title,publication_status,published_at) values
  (pg_temp.id(200),pg_temp.id(100),1,'Old module','PUBLISHED',now()),
  (pg_temp.id(201),pg_temp.id(101),1,'Next module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,slug,title) values
  (pg_temp.id(300),pg_temp.id(200),1,'enroll-old-lesson','Old lesson'),
  (pg_temp.id(301),pg_temp.id(201),1,'enroll-next-lesson','Next lesson');
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at) values
  (pg_temp.id(400),pg_temp.id(300),'TEXT',1,'{"title":"Old","body":"Old course content"}','PUBLISHED',now()),
  (pg_temp.id(401),pg_temp.id(301),'TEXT',1,'{"title":"Next","body":"Next course content"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id in (pg_temp.id(300),pg_temp.id(301));
insert into public.cohorts(id,course_id,name,code,status,starts_at,ends_at)
select pg_temp.id(600+n),pg_temp.id(case n when 0 then 100 when 3 then 102 when 4 then 103 when 9 then 104 else 101 end),
  'Enrollment cohort '||n,'enroll-cohort-'||n,
  case n when 5 then 'PLANNED' when 6 then 'ARCHIVED' else 'ACTIVE' end,
  now()-interval '3 days',case when n=7 then now()-interval '1 day' end from generate_series(0,10)n;
insert into public.cohort_placement_settings(cohort_id,capacity,schedule)
select pg_temp.id(600+n),case when n=1 then 1 else 6 end,
  '[{"weekday":1,"startMinute":600,"endMinute":660}]'::jsonb
  from generate_series(0,10)n where n<>8;
insert into public.enrollments(id,user_id,course_id,status,completed_at) values
  (pg_temp.id(505),pg_temp.id(5),pg_temp.id(100),'ACTIVE',null),
  (pg_temp.id(508),pg_temp.id(8),pg_temp.id(101),'CANCELLED',null),
  (pg_temp.id(509),pg_temp.id(9),pg_temp.id(101),'COMPLETED',now()-interval '1 day'),
  (pg_temp.id(510),pg_temp.id(10),pg_temp.id(104),'ACTIVE',null),
  (pg_temp.id(512),pg_temp.id(12),pg_temp.id(101),'ACTIVE',null);
insert into public.cohort_memberships(id,cohort_id,user_id,enrollment_id,status,starts_at,ends_at) values
  (pg_temp.id(705),pg_temp.id(600),pg_temp.id(5),pg_temp.id(505),'ACTIVE',now()-interval '1 day',null),
  (pg_temp.id(708),pg_temp.id(610),pg_temp.id(8),pg_temp.id(508),'LEFT',now()-interval '2 days',now()-interval '1 day'),
  (pg_temp.id(710),pg_temp.id(609),pg_temp.id(10),pg_temp.id(510),'ACTIVE',now()-interval '1 day',null),
  (pg_temp.id(712),pg_temp.id(610),pg_temp.id(12),pg_temp.id(512),'ACTIVE',now()-interval '2 days',now()-interval '1 day');
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status)
  values(pg_temp.id(5),'10000000-0000-0000-0000-000000000003','test','enroll-paid-student','ACTIVE');
select pg_temp.login(5,'aal1');
set local role authenticated;
select public.record_lesson_progress(pg_temp.id(300),100,0);
reset role;
create temp table snapshots(k text primary key,v jsonb);
grant all on snapshots to authenticated;
insert into snapshots select 'completed',to_jsonb(e) from public.enrollments e where id=pg_temp.id(505);
insert into snapshots select 'progress',to_jsonb(lp) from public.lesson_progress lp where user_id=pg_temp.id(5);
select pg_temp.ok((select v->>'status'='COMPLETED' from snapshots where k='completed'),'fixture actually completed old course');

select pg_temp.login(1,'aal1');
set local role authenticated;
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,601,801)')='42501','Admin AAL1 denied');
reset role;
do $$ declare n integer; begin
  for n in 3..5 loop
    perform pg_temp.login(n);
    set local role authenticated;
    perform pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,601,801)')='42501','Teacher/Support/Student denied');
    reset role;
  end loop;
end $$;

select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(999,601,801)')='23514','missing user denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(3,601,801)')='23514','nonstudent target denied');
select pg_temp.ok(pg_temp.state($q$select pg_temp.enroll(5,601,801,'  ')$q$)='23514','blank reason denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(101),pg_temp.id(601),null,'Next')$q$)='23514',
  'operation id required');
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(101),pg_temp.id(601),pg_temp.id(801),'Next','[]')$q$)='23514',
  'context must be object');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,999,801)')='23514','missing cohort denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,609,801)')='23514','wrong-course cohort denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,605,801)')='23514','planned cohort denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,606,801)')='23514','archived cohort denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,607,801)')='23514','ended cohort denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,608,801)')='23514','unconfigured capacity denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(102),pg_temp.id(603),pg_temp.id(801),'Next')$q$)='23514',
  'draft course denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(103),pg_temp.id(604),pg_temp.id(801),'Next')$q$)='23514',
  'inactive course denied');
insert into snapshots values('enrolled',public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(101),pg_temp.id(601),pg_temp.id(801),
  '  Proximo curso  ','{"request_id":"ef000000-0000-4000-8000-000000000901","environment":"test","version":"12e"}'));
select pg_temp.ok((select v->>'enrollmentStatus'='ACTIVE' and v->>'reusedMembership'='false' from snapshots where k='enrolled'),
  'new target enrollment and membership returned');
select pg_temp.ok(pg_temp.enroll(5,601,801)=(select v from snapshots where k='enrolled'),'identical trimmed retry returns exact saved result');
select pg_temp.ok(public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(101),pg_temp.id(601),pg_temp.id(801),'Proximo curso',
  '{"request_id":"ef000000-0000-4000-8000-000000000902"}')=(select v from snapshots where k='enrolled'),
  'technical context may differ on retry');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(6,601,801)')='23514','retry changed student denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,602,801)')='23514','retry changed cohort denied');
select pg_temp.ok(pg_temp.state($q$select pg_temp.enroll(5,601,801,'Different reason')$q$)='23514','retry changed reason denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(5),pg_temp.id(104),pg_temp.id(601),pg_temp.id(801),'Proximo curso')$q$)='23514',
  'retry changed course denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(7,601,802)')='23514','last vacancy consumed; another student denied');
select pg_temp.ok(pg_temp.enroll(5,601,803,'Confirmar matricula')->>'reusedMembership'='true','existing member may be reused in a full cohort');
reset role;
select pg_temp.ok((select to_jsonb(e)=(select v from snapshots where k='completed') from public.enrollments e where id=pg_temp.id(505)),
  'completed enrollment including completed_at preserved exactly');
select pg_temp.ok((select to_jsonb(lp)=(select v from snapshots where k='progress') from public.lesson_progress lp where user_id=pg_temp.id(5)),
  'old progress preserved exactly');
select pg_temp.ok((select status='ACTIVE' and ends_at is null from public.cohort_memberships where id=pg_temp.id(705)),
  'prior membership was not closed');
select pg_temp.ok((select count(*)=1 from public.enrollments where user_id=pg_temp.id(5) and course_id=pg_temp.id(101)),
  'only one target enrollment');
select pg_temp.ok((select count(*)=1 from public.cohort_memberships where user_id=pg_temp.id(5) and cohort_id=pg_temp.id(601)),
  'only one target membership');
select pg_temp.ok((select count(*)=2 from public.audit_logs where action='admin_course_enrolled' and data->>'userId'=pg_temp.id(5)::text),
  'one audit per new operation, none for retries');
select pg_temp.ok(exists(select 1 from public.audit_logs where action='admin_course_enrolled' and request_id=pg_temp.id(901)
  and actor_user_id=pg_temp.id(1) and environment='test' and version='12e' and data->>'reason'='Proximo curso'),
  'audit records authenticated actor, normalized reason and context');

select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,601,801)')='23514','retry under another admin denied');
reset role;
-- A retry is a receipt, even if the cohort is no longer eligible for new enrollment.
update public.cohorts set status='ARCHIVED' where id=pg_temp.id(601);
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.enroll(5,601,801)=(select v from snapshots where k='enrolled'),'retry does not revalidate mutable cohort state');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,601,804)')='23514','new operation on archived cohort denied');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(9,602,805)')='23514','completed target never reopens');
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(12,610,806)')='23514','expired ACTIVE membership needs explicit reconciliation');

-- Late failure must roll back new enrollment, membership, operation and audit together.
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(11),pg_temp.id(101),pg_temp.id(602),pg_temp.id(807),
  'Late failure','{"request_id":"invalid"}')$q$)='22P02','late audit error propagated');
select pg_temp.ok(pg_temp.state($q$select public.admin_enroll_in_course(pg_temp.id(8),pg_temp.id(101),pg_temp.id(610),pg_temp.id(808),
  'Late reactivation failure','{"request_id":"invalid"}')$q$)='22P02','reactivation audit error propagated');
reset role;
select pg_temp.ok(not exists(select 1 from public.enrollments where user_id=pg_temp.id(11)),'failed new enrollment absent');
select pg_temp.ok(not exists(select 1 from public.cohort_memberships where user_id=pg_temp.id(11)),'failed membership absent');
select pg_temp.ok(not exists(select 1 from public.admin_course_enrollment_operations where operation_id in (pg_temp.id(807),pg_temp.id(808))),
  'failed operations absent');
select pg_temp.ok((select status='CANCELLED' from public.enrollments where id=pg_temp.id(508)),'failed reactivation restores CANCELLED');
select pg_temp.ok(not exists(select 1 from public.audit_logs where entity_id=pg_temp.id(508) and action='enrollment_reactivated'),
  'failed reactivation audit absent');
select pg_temp.ok((select status='COMPLETED' and completed_at is not null from public.enrollments where id=pg_temp.id(509)),
  'rejected completed target preserved');
set local role authenticated;
select pg_temp.ok(pg_temp.enroll(8,610,808,'Valid reactivation')->>'enrollmentId'=pg_temp.id(508)::text,'CANCELLED target reuses activate_enrollment');
select pg_temp.ok(pg_temp.enroll(6,602,809)->>'enrollmentStatus'='ACTIVE','student without earlier course may be manually enrolled');
select pg_temp.ok(pg_temp.enroll(10,602,810)->>'enrollmentStatus'='ACTIVE','enrollment does not imply transfer from another active course');
select pg_temp.ok(pg_temp.enroll(13,602,811)->>'enrollmentStatus'='ACTIVE','administrative enrollment does not require paid subscription');
select pg_temp.ok(pg_temp.state('select * from public.admin_course_enrollment_operations')='42501','operation table is not exposed');
select pg_temp.ok(pg_temp.state('delete from public.admin_course_enrollment_operations')='42501','direct authenticated history mutation denied');
reset role;
select pg_temp.ok((select status='ACTIVE' from public.enrollments where id=pg_temp.id(510)), 'other ACTIVE enrollment preserved');
select pg_temp.ok((select status='ACTIVE' from public.cohort_memberships where id=pg_temp.id(710)), 'other course membership preserved');
select pg_temp.ok((select status='LEFT' from public.cohort_memberships where id=pg_temp.id(708)), 'old LEFT membership preserved');
select pg_temp.ok((select count(*)=1 from public.cohort_memberships where user_id=pg_temp.id(8) and status='ACTIVE'),
  'reactivation creates one new membership');
select pg_temp.ok(exists(select 1 from public.audit_logs where entity_id=pg_temp.id(508) and action='enrollment_reactivated'
  and data->>'source'='admin_enroll_in_course'),'reactivation retains existing audit contract');
select pg_temp.ok(pg_temp.state($q$update public.admin_course_enrollment_operations set reason='changed' where operation_id=pg_temp.id(801)$q$)='55000',
  'operation immutable even through privileged DML');
select pg_temp.ok(pg_temp.state('delete from public.admin_course_enrollment_operations where operation_id=pg_temp.id(801)')='55000',
  'operation receipt cannot be deleted');
select pg_temp.login(13,'aal1');
set local role authenticated;
select pg_temp.ok(not private.can_read_lesson_asset(pg_temp.id(401)),'new enrollment does not bypass paid content gate');
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,602,812)')='42501','missing actor denied');
reset role;
set local role anon;
select pg_temp.ok(pg_temp.state('select pg_temp.enroll(5,602,812)')='42501','anonymous RPC denied');
select pg_temp.ok(pg_temp.state('select * from public.admin_course_enrollment_operations')='42501','anonymous receipt read denied');
reset role;
rollback;
