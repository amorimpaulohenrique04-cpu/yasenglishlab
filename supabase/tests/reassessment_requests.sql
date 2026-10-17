-- PR1 / 1F: Teacher asks for a new test with a justification; history kept; no automatic effect.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9b100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
create function pg_temp.as_user(n integer,aal text default 'aal2') returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',format('{"sub":"%s","aal":"%s"}',pg_temp.id(n),aal),true)$$;
insert into auth.users(id,email) select pg_temp.id(n),'rr-'||n||'@example.test' from generate_series(1,5) n;
insert into public.user_roles(user_id,role) values(pg_temp.id(1),'STUDENT'),(pg_temp.id(2),'TEACHER'),(pg_temp.id(3),'TEACHER'),(pg_temp.id(4),'ADMIN'),(pg_temp.id(5),'STUDENT');
insert into public.teachers(id,user_id) values(pg_temp.id(20),pg_temp.id(2)),(pg_temp.id(30),pg_temp.id(3));
insert into public.teacher_student_assignments(teacher_id,student_user_id) values(pg_temp.id(20),pg_temp.id(1));
insert into public.enrollments(user_id,course_id,status) values(pg_temp.id(1),'40000000-0000-4000-8000-000000000001','ACTIVE');

set local role authenticated;
select pg_temp.as_user(2);
select set_config('rr.id',public.request_reassessment(pg_temp.id(1),'Student plateaued in speaking; needs a fresh baseline.')::text,true);
select pg_temp.assert_true(public.request_reassessment(pg_temp.id(1),'Another click, same justification text.')=current_setting('rr.id')::uuid,'second request returns the open one');
select pg_temp.denied(format('select public.request_reassessment(%L,%L)',pg_temp.id(1),'short'),'23514');
select pg_temp.assert_true((select count(*)=1 from public.reassessment_requests),'teacher sees the request');
select pg_temp.as_user(3);
select pg_temp.denied(format('select public.request_reassessment(%L,%L)',pg_temp.id(1),'Not my student, should be refused.'));
select pg_temp.assert_true((select count(*)=0 from public.reassessment_requests),'unassigned teacher sees nothing');
select pg_temp.as_user(2,'aal1');
select pg_temp.denied(format('select public.request_reassessment(%L,%L)',pg_temp.id(1),'No second factor, should be refused.'));
select pg_temp.as_user(1);
select pg_temp.assert_true((select count(*)=0 from public.reassessment_requests),'student cannot read requests');
select pg_temp.denied(format('select public.request_reassessment(%L,%L)',pg_temp.id(1),'Student asking for themselves.'));
select pg_temp.as_user(4);
select pg_temp.denied(format('select public.resolve_reassessment(%L,%L)',current_setting('rr.id'),''),'23514');
select public.resolve_reassessment(current_setting('rr.id')::uuid,'Scheduled with the teacher.');
select public.resolve_reassessment(current_setting('rr.id')::uuid,'Second click.');
select pg_temp.assert_true((select status='RESOLVED' and resolution_note='Scheduled with the teacher.' from public.reassessment_requests),'resolution is idempotent and keeps the first note');
select pg_temp.as_user(4,'aal1');
select pg_temp.denied(format('select public.resolve_reassessment(%L,%L)',current_setting('rr.id'),'No aal2.'));
reset role;
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='REASSESSMENT_REQUESTED' and entity_id=current_setting('rr.id')::uuid),'one request audit entry');
select pg_temp.assert_true((select count(*)=1 from public.enrollments where user_id=pg_temp.id(1)),'enrollment untouched by the request');
select pg_temp.assert_true((select count(*)=0 from public.assessment_attempts where user_id=pg_temp.id(1)),'no test is started automatically');
rollback;
