-- Stage 13 / Phases 1-3 (practice-10): content v3, per-item responses, finalize, per-item manual review.
-- Plain psql, transactional: everything rolls back. Allow AND deny cases per rule.
--   Users (prefix e1000000): 01 STUDENT S1 (K1) | 02 STUDENT S2 (K1) | 03 STUDENT S3 (no enrollment)
--   | 04 TEACHER T1 (cohort K1, course C1) | 05 TEACHER T2 (cohort K2, course C2) | 06 STUDENT S4 (K1, no paid access)
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if not coalesce(value, false) then raise exception 'practice_items: %', message; end if; end $$;
create function pg_temp.login(n integer, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.u(n)::text, true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
create function pg_temp.msg(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k = $1 $$;

-- Fixtures ----------------------------------------------------------------------------------------------------
insert into auth.users(id, email) select pg_temp.u(n), 'pi-' || n || '@example.test' from generate_series(1, 6) n;
insert into public.user_roles(user_id, role)
select pg_temp.u(n), case when n in (4, 5) then 'TEACHER' else 'STUDENT' end from generate_series(1, 6) n;
insert into public.profiles(user_id, display_name) select pg_temp.u(n), 'PI User ' || n from generate_series(1, 6) n
  on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.teachers(id, user_id) values
  ('e1100000-0000-4000-8000-000000000004', pg_temp.u(4)), ('e1100000-0000-4000-8000-000000000005', pg_temp.u(5));
insert into public.courses(id, slug, title, active, publication_status, published_at) values
  ('e1200000-0000-4000-8000-000000000001', 'pi-course-1', 'PI Course 1', true, 'PUBLISHED', now()),
  ('e1200000-0000-4000-8000-000000000002', 'pi-course-2', 'PI Course 2', true, 'PUBLISHED', now());
insert into public.cohorts(id, course_id, name, code, status, starts_at) values
  ('e1400000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000001', 'PI K1', 'pi-k1', 'ACTIVE', now() - interval '1 day'),
  ('e1400000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000002', 'PI K2', 'pi-k2', 'ACTIVE', now() - interval '1 day');
insert into public.cohort_teachers(cohort_id, teacher_id) values
  ('e1400000-0000-4000-8000-000000000001', 'e1100000-0000-4000-8000-000000000004'),
  ('e1400000-0000-4000-8000-000000000002', 'e1100000-0000-4000-8000-000000000005');
insert into public.enrollments(id, user_id, course_id, status) values
  ('e1300000-0000-4000-8000-000000000001', pg_temp.u(1), 'e1200000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('e1300000-0000-4000-8000-000000000002', pg_temp.u(2), 'e1200000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('e1300000-0000-4000-8000-000000000006', pg_temp.u(6), 'e1200000-0000-4000-8000-000000000001', 'ACTIVE');
insert into public.cohort_memberships(cohort_id, user_id, enrollment_id) values
  ('e1400000-0000-4000-8000-000000000001', pg_temp.u(1), 'e1300000-0000-4000-8000-000000000001'),
  ('e1400000-0000-4000-8000-000000000001', pg_temp.u(2), 'e1300000-0000-4000-8000-000000000002'),
  ('e1400000-0000-4000-8000-000000000001', pg_temp.u(6), 'e1300000-0000-4000-8000-000000000006');
insert into public.complimentary_access_grants(user_id, reason, note)
  select pg_temp.u(n), 'ADMIN_GRANT', 'fixture' from generate_series(1, 3) n;


insert into public.modules(id,course_id,position,title,publication_status,published_at) values('e1210000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001',1,'Practice module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,title,slug,publication_status,published_at) values
 ('e1220000-0000-4000-8000-000000000001','e1210000-0000-4000-8000-000000000001',1,'Practice lesson','redesign-lesson','DRAFT',null),
 ('e1220000-0000-4000-8000-000000000002','e1210000-0000-4000-8000-000000000001',2,'Future lesson','redesign-future','DRAFT',null);
insert into public.lesson_assets(lesson_id,asset_type,position,content,publication_status,published_at) select id,'TEXT',1,'{"title":"Lesson","body":"Read this lesson"}'::jsonb,'PUBLISHED',now() from public.lessons where module_id='e1210000-0000-4000-8000-000000000001';
update public.lessons set publication_status='PUBLISHED',published_at=now() where module_id='e1210000-0000-4000-8000-000000000001';
insert into public.cohort_paths(cohort_id,mode,sequential) values('e1400000-0000-4000-8000-000000000001','DEFAULT',true);
create temp table saved(value jsonb); grant all on saved to authenticated;
create function pg_temp.payload() returns jsonb language sql as $$ select '{"title":"Lesson practice","skill":"GRAMMAR","estimated_minutes":5,"course_id":"e1200000-0000-4000-8000-000000000001","related_module_id":"e1210000-0000-4000-8000-000000000001","related_lesson_id":"e1220000-0000-4000-8000-000000000001","content":{"version":3,"objective":"Use past simple","askConfidence":true,"items":[{"id":"q1","prompt":"Pick","weight":4,"shuffleOptions":true,"stimulus":{"type":"NONE"},"response":{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"went"},{"id":"b","label":"go"}]}},{"id":"q2","prompt":"Pick again","weight":2,"showExplanation":false,"stimulus":{"type":"NONE"},"response":{"type":"TRUE_FALSE","statement":"She went."}}]}}'::jsonb $$;
create function pg_temp.keys() returns jsonb language sql as $$ select '{"q1":{"answerKey":{"optionId":"a"},"feedback":{"correct":"Well done","incorrect":"Past tense","options":{"a":"Past tense of go"}}},"q2":{"answerKey":{"value":true},"feedback":{"correct":"Correct"}}}'::jsonb $$;
select pg_temp.login(4,'aal2'); set local role authenticated;
insert into saved select public.teacher_practice_autosave(null,pg_temp.payload(),pg_temp.keys(),'e1230000-0000-4000-8000-000000000001',null);
insert into ids select 'practice',(value->>'id')::uuid from saved;
select pg_temp.ok((select value->>'status'='saved' from saved),'first autosave creates draft');
select pg_temp.ok((public.teacher_practice_autosave(pg_temp.id('practice'),pg_temp.payload(),pg_temp.keys(),'e1230000-0000-4000-8000-000000000001','2000-01-01') ->> 'status')='conflict','stale revision conflicts');
select public.teacher_practice_publish(pg_temp.id('practice'));
select pg_temp.ok((public.teacher_practice_get(pg_temp.id('practice'))#>>'{content,items,0,weight}')='4','question settings survive save');
-- A future lesson is never bypassed by a Teacher cohort assignment.
insert into ids values('future',public.teacher_practice_save_v3(null,jsonb_set(pg_temp.payload(),'{related_lesson_id}','"e1220000-0000-4000-8000-000000000002"'),pg_temp.keys()));
select public.teacher_practice_publish(pg_temp.id('future'));
select public.teacher_practice_assign(pg_temp.id('future'),array['e1400000-0000-4000-8000-000000000001']::uuid[]);
select pg_temp.login(5,'aal2');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_get(%L)',pg_temp.id('practice')))='42501','other Teacher cannot edit owner content');
select pg_temp.login(1);
select pg_temp.ok(private.can_view_practice_activity(pg_temp.id('practice')),'lesson-authorized Student sees unassigned practice');
select pg_temp.ok(not private.can_view_practice_activity(pg_temp.id('future')),'assigned future lesson remains blocked');
insert into ids select 'attempt',(public.start_practice_attempt(pg_temp.id('practice'),'e1240000-0000-4000-8000-000000000001')).id;
select pg_temp.ok((public.practice_answers_get(pg_temp.id('attempt'))->'answers')='{}','draft starts without answers');
select pg_temp.ok(public.practice_answers_get(pg_temp.id('attempt'))->'optionOrders'=public.practice_answers_get(pg_temp.id('attempt'))->'optionOrders','option order is stable');
select public.practice_answers_save(pg_temp.id('attempt'),'{"q1":{"response":{"optionId":"b"},"confidence":"HIGH"}}');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('attempt')),'provisional answers disclose no correction');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L,%L,1::smallint,%L::jsonb)',pg_temp.id('attempt'),'q1','{"optionId":"a"}'))='23514','old item endpoint cannot reveal correction');
select pg_temp.ok(pg_temp.state(format('select public.practice_submit_final(%L)',pg_temp.id('attempt')))='23514','incomplete final submission rejected');
select public.practice_answers_save(pg_temp.id('attempt'),'{"q1":{"response":{"optionId":"a"},"confidence":"HIGH"},"q2":{"response":{"value":false},"confidence":null}}');
update saved set value=public.practice_submit_final(pg_temp.id('attempt'));
select pg_temp.ok((select value->>'score'='4' and value->>'maxScore'='6' and value#>>'{metrics,firstTryCorrect}'='1' from saved),'weighted score is separate from correct count');
select pg_temp.ok((select value#>>'{results,0,canRetry}'='false' from saved),'no retries');
select pg_temp.ok((select exists(select 1 from jsonb_array_elements(value->'results') r where r->>'itemId'='q1' and r#>>'{correctAnswer,optionId}'='a') from saved),'key disclosed only after final');
select pg_temp.ok((select exists(select 1 from jsonb_array_elements(value->'results') r where r->>'itemId'='q2' and r->'feedback'='null'::jsonb) from saved),'explanation setting respected');
select pg_temp.ok(public.practice_submit_final(pg_temp.id('attempt'))=(select value from saved),'final submission idempotent');
select pg_temp.ok((public.start_practice_attempt(pg_temp.id('practice'),'e1240000-0000-4000-8000-000000000002')).id=pg_temp.id('attempt'),'new start opens existing result');
select pg_temp.ok(pg_temp.state(format('select public.practice_answers_save(%L,%L::jsonb)',pg_temp.id('attempt'),'{}'))='23514','completed answers cannot be changed');
select pg_temp.ok((select count(*)=0 from public.student_due_reviews()),'no spaced reviews');
select pg_temp.login(2);
select pg_temp.ok(pg_temp.state(format('select public.practice_answers_get(%L)',pg_temp.id('attempt')))='42501','another student cannot read provisional answers');
select pg_temp.login(3);
select pg_temp.ok(not private.can_view_practice_activity(pg_temp.id('practice')),'Student without lesson access denied');
reset role;
select pg_temp.ok((select count(*)=1 from public.practice_attempts where id=pg_temp.id('attempt')),'history retained');
rollback;
