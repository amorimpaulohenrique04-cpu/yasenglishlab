-- Lesson practices have one final submission. Retired review schedules remain historical data only.
-- Transactional fixture; all rows roll back.
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
 select ('e2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$
begin if not coalesce(value,false) then raise exception 'practice_review_schedule: %',message; end if; end $$;
create function pg_temp.login(n integer,aal text default 'aal1') returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.u(n)::text,true),
        set_config('request.jwt.claims',json_build_object('sub',pg_temp.u(n),'aal',aal)::text,true);
$$;
create function pg_temp.logout() returns void language sql as $$
 select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
create temp table ids(k text primary key,id uuid);
grant all on ids to authenticated,anon;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k=$1 $$;

insert into auth.users(id,email) select pg_temp.u(n),'prs-'||n||'@example.test' from generate_series(1,3) n;
insert into public.user_roles(user_id,role) select pg_temp.u(n),case when n=3 then 'TEACHER' else 'STUDENT' end from generate_series(1,3) n;
insert into public.profiles(user_id,display_name) select pg_temp.u(n),'PRS User '||n from generate_series(1,3) n on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.teachers(id,user_id) values('e2100000-0000-4000-8000-000000000003',pg_temp.u(3));
insert into public.courses(id,slug,title,active,publication_status,published_at) values
 ('e2200000-0000-4000-8000-000000000001','prs-course','PRS Course',true,'PUBLISHED',now());
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('e2400000-0000-4000-8000-000000000001','e2200000-0000-4000-8000-000000000001','PRS K1','prs-k1','ACTIVE',now()-interval '1 day');
insert into public.cohort_teachers(cohort_id,teacher_id) values('e2400000-0000-4000-8000-000000000001','e2100000-0000-4000-8000-000000000003');
insert into public.enrollments(id,user_id,course_id,status) values
 ('e2300000-0000-4000-8000-000000000001',pg_temp.u(1),'e2200000-0000-4000-8000-000000000001','ACTIVE'),
 ('e2300000-0000-4000-8000-000000000002',pg_temp.u(2),'e2200000-0000-4000-8000-000000000001','ACTIVE');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values
 ('e2400000-0000-4000-8000-000000000001',pg_temp.u(1),'e2300000-0000-4000-8000-000000000001'),
 ('e2400000-0000-4000-8000-000000000001',pg_temp.u(2),'e2300000-0000-4000-8000-000000000002');
insert into public.complimentary_access_grants(user_id,reason,note) select pg_temp.u(n),'ADMIN_GRANT','fixture' from generate_series(1,2) n;
insert into public.modules(id,course_id,position,title,publication_status,published_at) values
 ('e2210000-0000-4000-8000-000000000001','e2200000-0000-4000-8000-000000000001',1,'PRS Module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,title,slug,publication_status,published_at) values
 ('e2220000-0000-4000-8000-000000000001','e2210000-0000-4000-8000-000000000001',1,'PRS Lesson','prs-lesson','DRAFT',null);
insert into public.lesson_assets(lesson_id,asset_type,position,content,publication_status,published_at) values
 ('e2220000-0000-4000-8000-000000000001','TEXT',1,'{"title":"Lesson","body":"Read"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id='e2220000-0000-4000-8000-000000000001';
insert into public.cohort_paths(cohort_id,mode,sequential) values('e2400000-0000-4000-8000-000000000001','DEFAULT',true);

select pg_temp.login(3,'aal2'); set local role authenticated;
insert into ids select 'practice',public.teacher_practice_save_v3(null,
 '{"title":"PRS practice","skill":"GRAMMAR","estimated_minutes":5,"course_id":"e2200000-0000-4000-8000-000000000001","related_module_id":"e2210000-0000-4000-8000-000000000001","related_lesson_id":"e2220000-0000-4000-8000-000000000001","content":{"version":3,"objective":"Practice","askConfidence":true,"items":[{"id":"q1","prompt":"True?","stimulus":{"type":"NONE"},"response":{"type":"TRUE_FALSE","statement":"Yes?"}}]}}'::jsonb,
 '{"q1":{"answerKey":{"value":true}}}'::jsonb);
select public.teacher_practice_publish(pg_temp.id('practice'));
reset role;

-- Existing due data survives the redesign but is never offered as an actionable review.
insert into public.practice_item_schedules(user_id,practice_activity_id,item_id,box,due_at,last_result,high_confidence_error)
 values(pg_temp.u(1),pg_temp.id('practice'),'q1',1,now()-interval '1 day','INCORRECT',true);
select pg_temp.login(1); set local role authenticated;
select pg_temp.ok((select count(*)=1 and bool_and(box=1 and high_confidence_error) from public.practice_item_schedules where practice_activity_id=pg_temp.id('practice')),'Student can read own historical schedule');
select pg_temp.ok((select count(*)=0 from public.student_due_reviews()),'historical due item is not actionable');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L,gen_random_uuid())',pg_temp.id('practice')))='YP002','old review start denied with YP002');
insert into ids select 'attempt',(public.start_practice_attempt(pg_temp.id('practice'),gen_random_uuid())).id;
select public.practice_answers_save(pg_temp.id('attempt'),'{"q1":{"response":{"value":true},"confidence":null}}');
select pg_temp.ok((public.practice_submit_final(pg_temp.id('attempt'))->>'evaluationStatus')='CORRECT','single final submission succeeds');
select pg_temp.ok((select count(*)=0 from public.student_due_reviews()),'final result creates no due review');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L,gen_random_uuid())',pg_temp.id('practice')))='YP002','review remains denied after final');
select pg_temp.ok(pg_temp.state(format('insert into public.practice_item_schedules(user_id,practice_activity_id,item_id,box,last_result) values(auth.uid(),%L,''q1'',1,''CORRECT'')',pg_temp.id('practice')))='42501','Student cannot insert schedules');
select pg_temp.ok(pg_temp.state('update public.practice_item_schedules set box=2')='42501','Student cannot update historical schedules');
select pg_temp.ok(pg_temp.state('delete from public.practice_item_schedules')='42501','Student cannot delete historical schedules');
reset role;
select pg_temp.ok((select count(*)=1 and bool_and(box=1 and last_result='INCORRECT' and high_confidence_error) from public.practice_item_schedules where practice_activity_id=pg_temp.id('practice')),'final submission preserves historical schedule unchanged');
select pg_temp.login(2); set local role authenticated;
select pg_temp.ok((select count(*)=0 from public.practice_item_schedules),'other Student cannot read history');
select pg_temp.ok((select count(*)=0 from public.student_due_reviews()),'other Student has no reviews');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L,gen_random_uuid())',pg_temp.id('practice')))='YP002','other Student cannot start retired review');
reset role;
select pg_temp.login(3,'aal2'); set local role authenticated;
select pg_temp.ok((select count(*)=0 from public.practice_item_schedules),'Teacher cannot read Student schedule');
select pg_temp.ok((select count(*)=0 from public.student_due_reviews()),'Teacher has no actionable review schedule');
reset role;
select pg_temp.logout(); set local role anon;
select pg_temp.ok(pg_temp.state('select * from public.practice_item_schedules')='42501','anon cannot read historical schedule');
select pg_temp.ok(pg_temp.state('select * from public.student_due_reviews()')='42501','anon cannot query due reviews');
reset role;
rollback;
