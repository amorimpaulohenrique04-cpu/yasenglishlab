-- Stage 08: finalized practice records are immutable by trigger.
-- The legitimate transitions (result PENDING_MANUAL -> MANUAL_REVIEWED, review INSERT) keep working.
-- Transactional: everything rolls back. Statements mirror public.finalize_practice_review (insert review, update result).
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%', message; end if; end $$;
-- Returns the SQLSTATE of the statement, or 'OK' when it ran. The exception block is a subtransaction, so a failed
-- statement does not abort the surrounding test transaction.
create function pg_temp.state_of(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;

insert into auth.users(id,email) values
 ('9e000000-0000-4000-8000-000000000001','imm-student@example.test'),
 ('9e000000-0000-4000-8000-000000000002','imm-teacher@example.test');
insert into public.user_roles(user_id,role) values
 ('9e000000-0000-4000-8000-000000000001','STUDENT'),
 ('9e000000-0000-4000-8000-000000000002','TEACHER');
insert into public.teachers(id,user_id) values('9e100000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002');
insert into public.practice_attempts(id,user_id,practice_activity_id,status,submitted_at) values
 ('9e200000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','SUBMITTED',now()),
 ('9e200000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','SUBMITTED',now());
insert into public.practice_results(id,practice_attempt_id,score,max_score,feedback,metrics,evaluation_status) values
 ('9e300000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000001',null,null,'Aguardando revisão do professor.','{"evaluation_mode":"MANUAL_PENDING"}','PENDING_MANUAL'),
 ('9e300000-0000-4000-8000-000000000002','9e200000-0000-4000-8000-000000000002',null,null,'Aguardando revisão do professor.','{"evaluation_mode":"MANUAL_PENDING"}','PENDING_MANUAL');

-- 1. A pending result cannot be rewritten into anything but the manual-review outcome, and cannot be deleted.
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set evaluation_status='CORRECT' where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','pending result cannot become CORRECT');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set feedback='tampered' where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','pending result feedback cannot be edited without the transition');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set evaluation_status='MANUAL_REVIEWED',metrics='{}' where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','transition cannot rewrite metrics');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set practice_attempt_id='9e200000-0000-4000-8000-000000000002' where id='9e300000-0000-4000-8000-000000000001'$q$) in ('55000','23505'),'result cannot be moved to another attempt');
select pg_temp.assert_true(pg_temp.state_of($q$delete from public.practice_results where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','direct DELETE of a result is rejected');

-- 2. Legitimate finalization: review INSERT then result PENDING_MANUAL -> MANUAL_REVIEWED.
select pg_temp.assert_true(pg_temp.state_of($q$insert into public.practice_manual_reviews(id,practice_attempt_id,teacher_id,rubric_version,ratings,feedback) values('9e400000-0000-4000-8000-000000000001','9e200000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000001','v1','{}','Good job')$q$)='OK','review INSERT (finalize) still works');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set evaluation_status='MANUAL_REVIEWED',feedback='Good job',score=null,max_score=null where practice_attempt_id='9e200000-0000-4000-8000-000000000001'$q$)='OK','PENDING_MANUAL -> MANUAL_REVIEWED still works');
select pg_temp.assert_true((select evaluation_status from public.practice_results where id='9e300000-0000-4000-8000-000000000001')='MANUAL_REVIEWED','result was finalized');

-- 3. Finalized records: no UPDATE, no DELETE.
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set feedback='rewritten' where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','finalized result cannot be updated');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_results set evaluation_status='PENDING_MANUAL' where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','finalized result cannot be reopened');
select pg_temp.assert_true(pg_temp.state_of($q$delete from public.practice_results where id='9e300000-0000-4000-8000-000000000001'$q$)='55000','finalized result cannot be deleted');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_manual_reviews set feedback='rewritten' where id='9e400000-0000-4000-8000-000000000001'$q$)='55000','finalized review cannot be updated');
select pg_temp.assert_true(pg_temp.state_of($q$update public.practice_manual_reviews set ratings='{"x":"y"}' where id='9e400000-0000-4000-8000-000000000001'$q$)='55000','finalized review ratings cannot be updated');
select pg_temp.assert_true(pg_temp.state_of($q$delete from public.practice_manual_reviews where id='9e400000-0000-4000-8000-000000000001'$q$)='55000','finalized review cannot be deleted');
select pg_temp.assert_true((select feedback from public.practice_manual_reviews where id='9e400000-0000-4000-8000-000000000001')='Good job','review content unchanged');
select pg_temp.assert_true((select feedback from public.practice_results where id='9e300000-0000-4000-8000-000000000001')='Good job','result content unchanged');

-- 4. Deleting the parent attempt still cascades (erasure path), because the child DELETE comes from the FK trigger.
insert into public.practice_manual_reviews(id,practice_attempt_id,teacher_id,rubric_version,ratings,feedback)
 values('9e400000-0000-4000-8000-000000000002','9e200000-0000-4000-8000-000000000002','9e100000-0000-4000-8000-000000000001','v1','{}','Cascade');
update public.practice_results set evaluation_status='MANUAL_REVIEWED' where id='9e300000-0000-4000-8000-000000000002';
select pg_temp.assert_true(pg_temp.state_of($q$delete from public.practice_attempts where id='9e200000-0000-4000-8000-000000000002'$q$)='OK','parent attempt delete cascades');
select pg_temp.assert_true(not exists(select 1 from public.practice_results where id='9e300000-0000-4000-8000-000000000002'),'cascade removed the result');
select pg_temp.assert_true(not exists(select 1 from public.practice_manual_reviews where id='9e400000-0000-4000-8000-000000000002'),'cascade removed the review');

-- 5. The trigger functions are not callable by clients.
select pg_temp.assert_true(not has_function_privilege('authenticated','private.protect_practice_result()','EXECUTE'),'authenticated cannot execute result guard');
select pg_temp.assert_true(not has_function_privilege('anon','private.protect_practice_manual_review()','EXECUTE'),'anon cannot execute review guard');
rollback;
