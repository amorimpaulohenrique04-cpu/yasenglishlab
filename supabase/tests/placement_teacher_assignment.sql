-- PR1 / 1A: Admin suggests and confirms the reviewing Teacher for a student without prior assignment.
begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
insert into auth.users(id,email) values
 ('99100000-0000-4000-8000-000000000001','pta-student@example.test'),('99100000-0000-4000-8000-000000000002','pta-busy-student@example.test'),
 ('99100000-0000-4000-8000-000000000003','pta-teacher-a@example.test'),('99100000-0000-4000-8000-000000000004','pta-teacher-b@example.test'),
 ('99100000-0000-4000-8000-000000000005','pta-admin@example.test'),('99100000-0000-4000-8000-000000000006','pta-inactive-teacher@example.test');
insert into public.user_roles(user_id,role) values
 ('99100000-0000-4000-8000-000000000001','STUDENT'),('99100000-0000-4000-8000-000000000002','STUDENT'),
 ('99100000-0000-4000-8000-000000000003','TEACHER'),('99100000-0000-4000-8000-000000000004','TEACHER'),
 ('99100000-0000-4000-8000-000000000005','ADMIN'),('99100000-0000-4000-8000-000000000006','TEACHER') on conflict do nothing;
insert into public.teachers(id,user_id,active) values
 ('99110000-0000-4000-8000-000000000001','99100000-0000-4000-8000-000000000003',true),
 ('99110000-0000-4000-8000-000000000002','99100000-0000-4000-8000-000000000004',true),
 ('99110000-0000-4000-8000-000000000003','99100000-0000-4000-8000-000000000006',false);
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values
 ('99100000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','test','pta-1','ACTIVE'),
 ('99100000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','test','pta-2','ACTIVE');
-- Fixture only: build REVIEW_PENDING cases without replaying the whole assessment flow.
set local session_replication_role = replica;
insert into public.placement_cases(user_id,subscription_id,state,state_changed_at)
 select s.user_id,s.id,'REVIEW_PENDING',now()-interval '25 hours' from public.subscriptions s where s.provider_subscription_id in ('pta-1','pta-2');
set local session_replication_role = origin;
-- Teacher A already carries one pending case, so Teacher B must be suggested for the new student.
insert into public.teacher_student_assignments(teacher_id,student_user_id)
 values('99110000-0000-4000-8000-000000000001','99100000-0000-4000-8000-000000000002');
select set_config('pta.case',(select id::text from public.placement_cases where user_id='99100000-0000-4000-8000-000000000001'),true);

set local role authenticated;
-- Admin without AAL2 and a Teacher are denied.
select set_config('request.jwt.claim.sub','99100000-0000-4000-8000-000000000005',true),set_config('request.jwt.claims','{"sub":"99100000-0000-4000-8000-000000000005","aal":"aal1"}',true);
select pg_temp.denied(format('select * from public.list_placement_teacher_candidates(%L)',current_setting('pta.case')));
select pg_temp.denied(format('select public.assign_placement_teacher(%L,%L)',current_setting('pta.case'),'99110000-0000-4000-8000-000000000002'));
select set_config('request.jwt.claim.sub','99100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"99100000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select pg_temp.denied(format('select public.assign_placement_teacher(%L,%L)',current_setting('pta.case'),'99110000-0000-4000-8000-000000000001'));

select set_config('request.jwt.claim.sub','99100000-0000-4000-8000-000000000005',true),set_config('request.jwt.claims','{"sub":"99100000-0000-4000-8000-000000000005","aal":"aal2"}',true);
select pg_temp.assert_true((select count(*)=2 from public.list_placement_teacher_candidates(current_setting('pta.case')::uuid)),'inactive teacher is not eligible');
select pg_temp.assert_true((select teacher_id='99110000-0000-4000-8000-000000000002' and suggested from public.list_placement_teacher_candidates(current_setting('pta.case')::uuid) where suggested),'lowest load suggested');
select pg_temp.denied(format('select public.assign_placement_teacher(%L,%L)',current_setting('pta.case'),'99110000-0000-4000-8000-000000000003'),'23514');
select public.assign_placement_teacher(current_setting('pta.case')::uuid,'99110000-0000-4000-8000-000000000002');
-- A repeated confirmation is idempotent: same assignment, one row, one audit entry.
select pg_temp.assert_true(public.assign_placement_teacher(current_setting('pta.case')::uuid,'99110000-0000-4000-8000-000000000002')=(select id from public.teacher_student_assignments where student_user_id='99100000-0000-4000-8000-000000000001'),'idempotent confirm');
-- A different teacher cannot be stacked on an already assigned student.
select pg_temp.denied(format('select public.assign_placement_teacher(%L,%L)',current_setting('pta.case'),'99110000-0000-4000-8000-000000000001'),'23514');

reset role;
select pg_temp.assert_true((select count(*)=1 from public.teacher_student_assignments where student_user_id='99100000-0000-4000-8000-000000000001'),'single assignment');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='placement_teacher_assigned' and entity_id=current_setting('pta.case')::uuid),'single audit entry');

-- The designated Teacher sees the case; the other Teacher does not.
set local role authenticated;
select set_config('request.jwt.claim.sub','99100000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"99100000-0000-4000-8000-000000000004","aal":"aal2"}',true);
select pg_temp.assert_true(private.is_teacher_assigned('99100000-0000-4000-8000-000000000001'),'designated teacher in scope');
select set_config('request.jwt.claim.sub','99100000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"99100000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select pg_temp.assert_true(not private.is_teacher_assigned('99100000-0000-4000-8000-000000000001'),'other teacher out of scope');
reset role;
rollback;
