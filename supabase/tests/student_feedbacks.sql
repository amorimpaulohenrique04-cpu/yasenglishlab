-- PR1 / 1D: Feedbacks read model: own rows only, ordered, paginated, pending vs reviewed.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9c000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',format('{"sub":"%s","aal":"aal1"}',pg_temp.id(n)),true)$$;
insert into auth.users(id,email) select pg_temp.id(n),'fb-'||n||'@example.test' from generate_series(1,3) n;
insert into public.user_roles(user_id,role) values(pg_temp.id(1),'STUDENT'),(pg_temp.id(2),'STUDENT'),(pg_temp.id(3),'TEACHER');
insert into public.teachers(id,user_id) values(pg_temp.id(30),pg_temp.id(3));
insert into public.practice_activities(id,slug,title,skill,estimated_minutes,content)
 values(pg_temp.id(100),'fb-speaking','Speaking about routines','SPEAKING',5,'{}');
-- Student 1: one reviewed attempt and one still waiting. Student 2: one reviewed attempt (must stay private).
insert into public.practice_attempts(id,user_id,practice_activity_id,status,submitted_at) values
 (pg_temp.id(201),pg_temp.id(1),pg_temp.id(100),'SUBMITTED',now()-interval '2 days'),
 (pg_temp.id(202),pg_temp.id(1),pg_temp.id(100),'SUBMITTED',now()-interval '1 hour'),
 (pg_temp.id(203),pg_temp.id(2),pg_temp.id(100),'SUBMITTED',now()-interval '3 days');
insert into public.practice_results(practice_attempt_id,evaluation_status) values
 (pg_temp.id(201),'MANUAL_REVIEWED'),(pg_temp.id(202),'PENDING_MANUAL'),(pg_temp.id(203),'MANUAL_REVIEWED');
insert into public.practice_manual_reviews(practice_attempt_id,teacher_id,rubric_version,ratings,feedback,reviewed_at) values
 (pg_temp.id(201),pg_temp.id(30),'v1','{"fluency":"SOLID"}','Great pacing.',now()-interval '1 day'),
 (pg_temp.id(203),pg_temp.id(30),'v1','{"fluency":"STRONG"}','Other student secret.',now()-interval '2 days');

set local role authenticated;
select pg_temp.as_user(1);
select pg_temp.assert_true((select count(*)=2 and max(total)=2 from public.list_student_feedbacks(20,0)),'only own feedback, with total');
select pg_temp.assert_true((select source='PRACTICE' and status='PENDING' and entity_id=pg_temp.id(202) from public.list_student_feedbacks(20,0) limit 1),'newest first; waiting item is pending');
select pg_temp.assert_true((select notes='Great pacing.' and details->>'fluency'='SOLID' from public.list_student_feedbacks(20,0) where status='REVIEWED'),'reviewed item carries teacher notes');
select pg_temp.assert_true(not exists(select 1 from public.list_student_feedbacks(20,0) where notes like '%secret%'),'no cross-student leak');
select pg_temp.assert_true((select count(*)=1 from public.list_student_feedbacks(1,1)),'offset paginates');
select pg_temp.denied('select * from public.list_student_feedbacks(0,0)','22023');
select pg_temp.denied('select * from public.list_student_feedbacks(10,-1)','22023');
select pg_temp.as_user(3);
select pg_temp.denied('select * from public.list_student_feedbacks(10,0)');
reset role;
rollback;
