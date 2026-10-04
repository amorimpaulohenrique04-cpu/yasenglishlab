begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%', message; end if; end; $$;
create function pg_temp.denied(command text, expected text default '42501') returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then if sqlstate = expected then return; else raise; end if;
  end;
  raise exception 'Expected denial: %', command;
end; $$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('9d000000-0000-4000-8000-000000000001','cohort-v2-admin@example.test','{"display_name":"Cohort V2 Admin"}'),
 ('9d000000-0000-4000-8000-000000000002','cohort-v2-teacher@example.test','{"display_name":"Cohort V2 Teacher"}'),
 ('9d000000-0000-4000-8000-000000000003','cohort-v2-student@example.test','{"display_name":"Cohort V2 Student"}'),
 ('9d000000-0000-4000-8000-000000000004','cohort-v2-support@example.test','{"display_name":"Cohort V2 Support"}'),
 ('9d000000-0000-4000-8000-000000000005','cohort-v2-teacher-two@example.test','{"display_name":"Cohort V2 Teacher Two"}');
insert into public.user_roles(user_id,role) values
 ('9d000000-0000-4000-8000-000000000001','ADMIN'),
 ('9d000000-0000-4000-8000-000000000002','TEACHER'),
 ('9d000000-0000-4000-8000-000000000003','STUDENT'),
 ('9d000000-0000-4000-8000-000000000004','SUPPORT'),
 ('9d000000-0000-4000-8000-000000000005','TEACHER');
insert into public.teachers(id,user_id) values
 ('9d100000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000002'),
 ('9d100000-0000-4000-8000-000000000002','9d000000-0000-4000-8000-000000000005');
insert into public.profiles(user_id,display_name) values
 ('9d000000-0000-4000-8000-000000000001','Cohort V2 Admin'),
 ('9d000000-0000-4000-8000-000000000002','Cohort V2 Teacher'),
 ('9d000000-0000-4000-8000-000000000003','Cohort V2 Student'),
 ('9d000000-0000-4000-8000-000000000005','Cohort V2 Teacher Two')
on conflict (user_id) do update set display_name=excluded.display_name;
insert into public.enrollments(id,user_id,course_id,status) values
 ('9d200000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.cohorts(id,course_id,name,code,status,timezone,starts_at) values
 ('9d300000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Cohort V2 Test','cohort-v2-test','ACTIVE','America/Recife',now()-interval '1 day');
insert into public.cohort_placement_settings(cohort_id,capacity,schedule) values
 ('9d300000-0000-4000-8000-000000000001',3,'[{"weekday":2,"startMinute":600,"endMinute":660}]');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values
 ('9d300000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000003','9d200000-0000-4000-8000-000000000001');
insert into public.cohort_teachers(cohort_id,teacher_id,is_primary) values
 ('9d300000-0000-4000-8000-000000000001','9d100000-0000-4000-8000-000000000001',true);
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,status,cohort_id)
values ('9e400000-0000-4000-8000-000000000001','9d100000-0000-4000-8000-000000000001','CORE_CLASS','Future primary session',now()+interval '14 days',now()+interval '14 days 1 hour',6,'SCHEDULED','9d300000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','9d000000-0000-4000-8000-000000000001',true),
 set_config('request.jwt.claims','{"sub":"9d000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=1 from public.admin_cohort_directory(25,0,'Cohort V2')),'Admin AAL2 reads matching cohort projection');
select pg_temp.assert_true(((select row->>'occupancy' from public.admin_cohort_directory(25,0,'Cohort V2 Test') row))::integer=1,'directory derives active membership occupancy');
select pg_temp.assert_true(((select row->>'capacity' from public.admin_cohort_directory(25,0,'Cohort V2 Test') row))::integer=3,'directory uses authoritative placement capacity');
select pg_temp.assert_true((((select row->'schedule'->0->>'weekday' from public.admin_cohort_directory(25,0,'Cohort V2 Test') row))::integer)=2,'directory returns recurring schedule settings');
select pg_temp.assert_true((select count(*)=1 from public.admin_cohort_directory(1,0,'')),'bounded first page returned');
select public.configure_cohort_placement('9d300000-0000-4000-8000-000000000001',4,'[{"weekday":2,"startMinute":600,"endMinute":660}]');
select pg_temp.assert_true((select capacity=4 from public.cohort_placement_settings where cohort_id='9d300000-0000-4000-8000-000000000001'),'capacity update persists in authoritative setting');
select pg_temp.assert_true((select count(*)=1 and bool_and(data ? 'schedule') from public.audit_logs where action='cohort_placement_configured' and entity_id='9d300000-0000-4000-8000-000000000001'),'schedule and capacity mutation audited');
select pg_temp.denied('select public.configure_cohort_placement(''9d300000-0000-4000-8000-000000000001'',4,''[{"weekday":3,"startMinute":600,"endMinute":660}]'')','23514');
select pg_temp.denied('select * from public.admin_cohort_directory(51,0,null)','22023');
select pg_temp.denied('select * from public.admin_cohort_directory(25,-1,null)','22023');
select public.set_primary_cohort_teacher('9d300000-0000-4000-8000-000000000001','9d100000-0000-4000-8000-000000000002');
select pg_temp.assert_true((select count(*)=1 from public.cohort_teachers where cohort_id='9d300000-0000-4000-8000-000000000001' and ends_at is null and is_primary),'new primary teacher is sole active primary');
select pg_temp.assert_true((select count(*)=1 and bool_and(not is_primary and ends_at is null) from public.cohort_teachers where cohort_id='9d300000-0000-4000-8000-000000000001' and teacher_id='9d100000-0000-4000-8000-000000000001'),'prior teacher relationship remains active with its primary flag preserved as false');
select pg_temp.denied('select public.manage_cohort(''REMOVE_TEACHER'',''9d300000-0000-4000-8000-000000000001'',''{"teacher_id":"9d100000-0000-4000-8000-000000000001"}'')','23514');
select public.set_primary_cohort_teacher('9d300000-0000-4000-8000-000000000001','9d100000-0000-4000-8000-000000000002');
select pg_temp.assert_true((select count(*)=1 from public.cohort_teachers where cohort_id='9d300000-0000-4000-8000-000000000001' and teacher_id='9d100000-0000-4000-8000-000000000002' and ends_at is null),'setting same primary teacher is idempotent');
select pg_temp.denied('select public.set_primary_cohort_teacher(null,null)','23503');
select set_config('request.jwt.claims','{"sub":"9d000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.denied('select * from public.admin_cohort_directory(25,0,null)');
select pg_temp.denied('select public.set_primary_cohort_teacher(''9d300000-0000-4000-8000-000000000001'',''9d100000-0000-4000-8000-000000000001'')');
select set_config('request.jwt.claim.sub','9d000000-0000-4000-8000-000000000002',true),
 set_config('request.jwt.claims','{"sub":"9d000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
select pg_temp.denied('select * from public.admin_cohort_directory(25,0,null)');
select pg_temp.denied('select public.set_primary_cohort_teacher(''9d300000-0000-4000-8000-000000000001'',''9d100000-0000-4000-8000-000000000001'')');
select set_config('request.jwt.claim.sub','9d000000-0000-4000-8000-000000000003',true),
 set_config('request.jwt.claims','{"sub":"9d000000-0000-4000-8000-000000000003","aal":"aal1"}',true);
select pg_temp.denied('select * from public.admin_cohort_directory(25,0,null)');
select set_config('request.jwt.claim.sub','9d000000-0000-4000-8000-000000000004',true),
 set_config('request.jwt.claims','{"sub":"9d000000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select pg_temp.denied('select * from public.admin_cohort_directory(25,0,null)');
reset role;
set local role anon;
select pg_temp.denied('select * from public.admin_cohort_directory(25,0,null)');
reset role;
select set_config('request.jwt.claim.sub','9d000000-0000-4000-8000-000000000001',true),
 set_config('request.jwt.claims','{"sub":"9d000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
update public.live_sessions set status='CANCELLED' where id='9e400000-0000-4000-8000-000000000001';
set local role authenticated;
select public.manage_cohort('REMOVE_TEACHER','9d300000-0000-4000-8000-000000000001','{"teacher_id":"9d100000-0000-4000-8000-000000000001"}');
select pg_temp.assert_true((select count(*)=1 from public.cohort_teachers where cohort_id='9d300000-0000-4000-8000-000000000001' and teacher_id='9d100000-0000-4000-8000-000000000001' and ends_at is not null),'Teacher relationship can end after future sessions are explicitly resolved');
rollback;
