-- Stage 12 / Block A (database): Teacher practice authoring, cohort assignment, v2 grading, review queue.
-- Plain psql, transactional: everything rolls back. Allow AND deny cases per chokepoint.
--   Users (prefix b2000000): 01 ADMIN | 02 TEACHER T1 (owner, cohort K1/course C1) | 03 TEACHER T2 (cohort K2/course C1)
--   | 04 TEACHER T3 (cohort K3/course C2) | 08 TEACHER T4 (no cohort) | 05 STUDENT S1 (K1) | 06 STUDENT S2 (K2, same course)
--   | 07 STUDENT S3 (K3, other course) | 09 STUDENT S4 (K1 member, never attempts)
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'practice_authoring: %', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
-- SQLSTATE raised by the statement, or 'OK'.
create function pg_temp.state_of(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
create function pg_temp.attempt(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('b2000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid;
$$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;

-- Fixtures ----------------------------------------------------------------------------------------------------
insert into auth.users(id,email) select pg_temp.u(n), 'pa-' || n || '@example.test' from generate_series(1, 9) n;
insert into public.user_roles(user_id,role)
select pg_temp.u(n), case when n = 1 then 'ADMIN' when n in (2,3,4,8) then 'TEACHER' else 'STUDENT' end from generate_series(1, 9) n;
insert into public.profiles(user_id,display_name) select pg_temp.u(n), 'PA User ' || n from generate_series(1, 9) n
  on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.teachers(id,user_id) values
 ('b2100000-0000-4000-8000-000000000002', pg_temp.u(2)), ('b2100000-0000-4000-8000-000000000003', pg_temp.u(3)),
 ('b2100000-0000-4000-8000-000000000004', pg_temp.u(4)), ('b2100000-0000-4000-8000-000000000008', pg_temp.u(8));
insert into public.courses(id,slug,title,active,publication_status,published_at) values
 ('b2200000-0000-4000-8000-000000000001','pa-course-1','PA Course 1',true,'PUBLISHED',now()),
 ('b2200000-0000-4000-8000-000000000002','pa-course-2','PA Course 2',true,'PUBLISHED',now());
insert into public.modules(id,course_id,position,title,publication_status,published_at) values
 ('b2210000-0000-4000-8000-000000000001','b2200000-0000-4000-8000-000000000001',1,'PA module 1','PUBLISHED',now()),
 ('b2210000-0000-4000-8000-000000000002','b2200000-0000-4000-8000-000000000002',1,'PA module 2','PUBLISHED',now());
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('b2400000-0000-4000-8000-000000000001','b2200000-0000-4000-8000-000000000001','PA K1','pa-k1','ACTIVE',now()-interval '1 day'),
 ('b2400000-0000-4000-8000-000000000002','b2200000-0000-4000-8000-000000000001','PA K2','pa-k2','ACTIVE',now()-interval '1 day'),
 ('b2400000-0000-4000-8000-000000000003','b2200000-0000-4000-8000-000000000002','PA K3','pa-k3','ACTIVE',now()-interval '1 day');
insert into public.cohort_teachers(cohort_id,teacher_id) values
 ('b2400000-0000-4000-8000-000000000001','b2100000-0000-4000-8000-000000000002'),
 ('b2400000-0000-4000-8000-000000000002','b2100000-0000-4000-8000-000000000003'),
 ('b2400000-0000-4000-8000-000000000003','b2100000-0000-4000-8000-000000000004');
insert into public.enrollments(id,user_id,course_id,status) values
 ('b2300000-0000-4000-8000-000000000005', pg_temp.u(5), 'b2200000-0000-4000-8000-000000000001','ACTIVE'),
 ('b2300000-0000-4000-8000-000000000006', pg_temp.u(6), 'b2200000-0000-4000-8000-000000000001','ACTIVE'),
 ('b2300000-0000-4000-8000-000000000007', pg_temp.u(7), 'b2200000-0000-4000-8000-000000000002','ACTIVE'),
 ('b2300000-0000-4000-8000-000000000009', pg_temp.u(9), 'b2200000-0000-4000-8000-000000000001','ACTIVE');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values
 ('b2400000-0000-4000-8000-000000000001', pg_temp.u(5), 'b2300000-0000-4000-8000-000000000005'),
 ('b2400000-0000-4000-8000-000000000002', pg_temp.u(6), 'b2300000-0000-4000-8000-000000000006'),
 ('b2400000-0000-4000-8000-000000000003', pg_temp.u(7), 'b2300000-0000-4000-8000-000000000007'),
 ('b2400000-0000-4000-8000-000000000001', pg_temp.u(9), 'b2300000-0000-4000-8000-000000000009');
-- Paid access is fail-closed (Stage 11): explicit grants for the Students that write attempts.
insert into public.complimentary_access_grants(user_id,reason,note) select pg_temp.u(n),'ADMIN_GRANT','fixture' from generate_series(5,7) n;

-- Content builders --------------------------------------------------------------------------------------------
create function pg_temp.payload(content jsonb, skill text default 'GRAMMAR', course uuid default 'b2200000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select jsonb_build_object('title','PA practice','skill',skill,'estimated_minutes',5,'course_id',course,'content',content);
$$;
create function pg_temp.simple(prompt text default 'Pick one') returns jsonb language sql as $$
  select jsonb_build_object('version',2,'stimulus','{"type":"NONE"}'::jsonb,'prompt',prompt,
    'response','{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb);
$$;
-- Authors (as the current Teacher), publishes and assigns to K1 in one go.
create function pg_temp.mk(k text, content jsonb, answer jsonb, fb jsonb default null, skill text default 'GRAMMAR') returns void language plpgsql as $$
declare pid uuid;
begin
  pid := public.teacher_practice_save(null, pg_temp.payload(content, skill), answer, fb);
  insert into ids values (k, pid);
  perform public.teacher_practice_publish(pid);
  perform public.teacher_practice_assign(pid, array['b2400000-0000-4000-8000-000000000001']::uuid[], now() + interval '7 days');
end $$;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k = $1 $$;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Authoring authorization matrix (deny)
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.logout();
set local role anon;
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_list()')='42501','anon cannot list');
select pg_temp.assert_true(pg_temp.state_of('select public.student_assigned_practices()')='42501','anon cannot read assignments');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_save(null, ''{}''::jsonb)')='42501','anon cannot save');
reset role;

-- Teacher at aal1: every command is denied.
select pg_temp.login(pg_temp.u(2), 'aal1');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_list()')='42501','Teacher aal1 list');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple())))='42501','Teacher aal1 save');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_get(gen_random_uuid())')='42501','Teacher aal1 get');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_publish(gen_random_uuid())')='42501','Teacher aal1 publish');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_unpublish(gen_random_uuid())')='42501','Teacher aal1 unpublish');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_duplicate(gen_random_uuid())')='42501','Teacher aal1 duplicate');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_assign(gen_random_uuid(), array[gen_random_uuid()])')='42501','Teacher aal1 assign');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_unassign(gen_random_uuid(), gen_random_uuid())')='42501','Teacher aal1 unassign');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_reserve_asset(gen_random_uuid(), ''IMAGE'', ''image/png'')')='42501','Teacher aal1 reserve asset');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_complete_asset(gen_random_uuid())')='42501','Teacher aal1 complete asset');
reset role;

-- Student, Admin (aal2), Teacher without cohort and Teacher of another course cannot author in course C1.
select pg_temp.login(pg_temp.u(5), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple())))='42501','Student cannot author');
select pg_temp.assert_true(pg_temp.state_of('select public.teacher_practice_list()')='42501','Student cannot list authoring');
reset role;
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple())))='42501','Admin is not a Teacher author');
reset role;
select pg_temp.login(pg_temp.u(8), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple())))='42501','Teacher without an active cohort cannot author');
reset role;
select pg_temp.login(pg_temp.u(4), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple())))='42501','Teacher of course C2 cannot author in C1');
reset role;
-- ---------------------------------------------------------------------------------------------------------
-- 2. Owner Teacher authoring (allow) and payload hygiene (deny)
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
insert into ids values ('p1', public.teacher_practice_save(null, pg_temp.payload(pg_temp.simple('Which letter is first?')), '{"optionId":"a"}', '{"correct":"Well done!","incorrect":"Look again."}', '{"request_id":"b2900000-0000-4000-8000-000000000001","environment":"test","version":"pa-1"}'));
select pg_temp.assert_true((select publication_status='DRAFT' and audience='ASSIGNED' and created_by_teacher_id='b2100000-0000-4000-8000-000000000002' and course_id='b2200000-0000-4000-8000-000000000001' and content->>'evaluationMode'='DETERMINISTIC' and content->'version'='2'::jsonb from public.practice_activities where id=pg_temp.id('p1') ) is null,'Teacher has no direct select of its draft (RPC only)');
select pg_temp.assert_true((select count(*)=1 from public.teacher_practice_list() r where r->>'id'=pg_temp.id('p1')::text and r->>'publicationStatus'='DRAFT'),'owner lists its draft');
select pg_temp.assert_true((public.teacher_practice_get(pg_temp.id('p1'))->'answerKey')='{"optionId":"a"}'::jsonb,'owner reads its answer key via RPC');
select pg_temp.assert_true((public.teacher_practice_get(pg_temp.id('p1'))->'feedback'->>'correct')='Well done!','owner reads feedback via RPC');
-- Unknown/privileged fields are rejected.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple()) || '{"created_by_teacher_id":"b2100000-0000-4000-8000-000000000003"}'))='22023','cannot spoof the owner');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple()) || '{"audience":"COURSE"}'))='22023','cannot set audience');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple()) || '{"publication_status":"PUBLISHED"}'))='22023','cannot set publication status');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple()) || '{"slug":"x"}'))='22023','cannot set slug');
-- Related module of another course is rejected; same course is accepted.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple()) || '{"related_module_id":"b2210000-0000-4000-8000-000000000002"}'))='23514','module of another course rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple()) || '{"related_module_id":"b2210000-0000-4000-8000-000000000001"}'))='OK','module of the same course accepted');
-- Content without a response, unsupported response type, bad skill.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload('{"version":2,"prompt":"x"}')))='23514','content without response rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload('{"version":2,"prompt":"x","response":{"type":"AI"}}')))='23514','unsupported response type rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple(),'MATH')))='23514','unsupported skill rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple(),'WRITING')))='OK','WRITING skill accepted');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple(),'LISTENING')))='OK','LISTENING skill accepted');
-- Invalid answer key shape / unknown key / feedback shape.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb, ''{"x":1}''::jsonb)', pg_temp.payload(pg_temp.simple())))='23514','unknown answer key field rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb, ''{"optionId":"a"}''::jsonb, ''{"other":"x"}''::jsonb)', pg_temp.payload(pg_temp.simple())))='23514','unknown feedback field rejected');
reset role;

-- Other Teachers (same course, other cohort / other course) cannot read, edit, publish or assign p1.
select pg_temp.login(pg_temp.u(3), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_get(%L)', pg_temp.id('p1')))='42501','same-course Teacher cannot get');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, %L::jsonb)', pg_temp.id('p1'), '{"title":"hijack"}'))='42501','same-course Teacher cannot edit');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('p1')))='42501','same-course Teacher cannot publish');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_duplicate(%L)', pg_temp.id('p1')))='42501','same-course Teacher cannot duplicate');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_reserve_asset(%L,''IMAGE'',''image/png'')', pg_temp.id('p1')))='42501','same-course Teacher cannot reserve an asset');
select pg_temp.assert_true((select count(*)=0 from public.teacher_practice_list()),'same-course Teacher lists nothing of others');
reset role;
select pg_temp.login(pg_temp.u(4), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_get(%L)', pg_temp.id('p1')))='42501','other-course Teacher cannot get');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_unpublish(%L)', pg_temp.id('p1')))='42501','other-course Teacher cannot unpublish');
reset role;

-- A draft is never visible by SELECT to anyone but an Admin (Student, Teachers).
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('p1')),'Student cannot see the draft');
select pg_temp.assert_true(pg_temp.state_of(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id('p1')))<>'OK','Student cannot start a draft');
reset role;
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('p1')),'owner Teacher sees no draft through SELECT');
reset role;

-- Publication is validated against the private key: a practice without matching key stays DRAFT.
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
insert into ids values ('nokey', public.teacher_practice_save(null, pg_temp.payload(pg_temp.simple())));
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('nokey')))='23514','publish without answer key rejected');
select pg_temp.assert_true((select r->>'publicationStatus'='DRAFT' from public.teacher_practice_list() r where r->>'id'=pg_temp.id('nokey')::text),'invalid publish leaves DRAFT');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, ''{}''::jsonb, ''{"optionId":"zzz"}''::jsonb)', pg_temp.id('nokey')))='OK','draft accepts a not-yet-valid key');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('nokey')))='23514','publish with key outside the options rejected');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Publish, assign, visibility
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select public.teacher_practice_publish(pg_temp.id('p1'), '{"request_id":"b2900000-0000-4000-8000-000000000002","environment":"test","version":"pa-1"}');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('p1')))='23514','publishing twice is rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, ''{"title":"edit live"}''::jsonb)', pg_temp.id('p1')))='23514','published practice is not editable in place');
-- Assignment scope.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_assign(%L, array[%L]::uuid[])', pg_temp.id('p1'), 'b2400000-0000-4000-8000-000000000002'))='42501','cannot assign to a cohort of another Teacher (same course)');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_assign(%L, array[%L]::uuid[])', pg_temp.id('p1'), 'b2400000-0000-4000-8000-000000000003'))='42501','cannot assign to a cohort of another course');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_assign(%L, array[%L,%L]::uuid[])', pg_temp.id('p1'), 'b2400000-0000-4000-8000-000000000001','b2400000-0000-4000-8000-000000000002'))='42501','one out-of-scope cohort rejects the whole batch');
select pg_temp.assert_true((select count(*)=0 from public.cohort_practice_assignments),'rejected assignments leave nothing behind');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_assign(%L, array[%L]::uuid[], now() - interval ''1 day'')', pg_temp.id('p1'), 'b2400000-0000-4000-8000-000000000001'))='23514','past due date rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_assign(%L, ''{}''::uuid[])', pg_temp.id('p1')))='23514','empty cohort list rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_assign(%L, array[%L]::uuid[])', pg_temp.id('nokey'), 'b2400000-0000-4000-8000-000000000001'))='23514','draft cannot be assigned');
select pg_temp.assert_true(public.teacher_practice_assign(pg_temp.id('p1'), array['b2400000-0000-4000-8000-000000000001']::uuid[], now() + interval '7 days', '{"request_id":"b2900000-0000-4000-8000-000000000003","environment":"test","version":"pa-1"}')=1,'owner assigns to its own cohort');
select pg_temp.assert_true(public.teacher_practice_assign(pg_temp.id('p1'), array['b2400000-0000-4000-8000-000000000001','b2400000-0000-4000-8000-000000000001']::uuid[], now() + interval '9 days')=1,'duplicate cohort ids collapse and re-assignment updates the due date');
select pg_temp.assert_true((select count(*)=1 from public.cohort_practice_assignments where due_at > now() + interval '8 days'),'one assignment row, due date updated');
select pg_temp.assert_true((select count(*)=1 from public.practice_activities where id=pg_temp.id('p1')),'owner Teacher sees its published practice');
reset role;

-- Visibility matrix for the assigned practice.
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.practice_activities where id=pg_temp.id('p1')),'assigned Student sees the practice');
select pg_temp.assert_true((select count(*)=1 from public.cohort_practice_assignments),'assigned Student sees the assignment row');
select pg_temp.assert_true((select count(*)=1 and bool_and(status='NEW' and due_at is not null and practice_activity_id=pg_temp.id('p1')) from public.student_assigned_practices()),'assigned list: NEW');
select pg_temp.assert_true((select not (to_jsonb(r)::text ~* '(answer|optionId|correct)') from public.student_assigned_practices() r limit 1),'assigned list carries no answer data');
select pg_temp.assert_true(pg_temp.state_of('select * from private.practice_answer_keys')='42501','Student cannot read private answer keys');
select pg_temp.assert_true(pg_temp.state_of('select * from public.practice_activity_assets')='42501','Student cannot read asset rows');
select pg_temp.assert_true(pg_temp.state_of('insert into public.cohort_practice_assignments(cohort_id,practice_activity_id,assigned_by_teacher_id) values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid())')='42501','Student cannot insert assignments');
reset role;
select pg_temp.login(pg_temp.u(6), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('p1')),'same-course Student of another cohort cannot see it');
select pg_temp.assert_true((select count(*)=0 from public.cohort_practice_assignments),'other-cohort Student sees no assignment');
select pg_temp.assert_true((select count(*)=0 from public.student_assigned_practices()),'other-cohort Student has an empty list');
select pg_temp.assert_true(pg_temp.state_of(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id('p1')))='42501','other-cohort Student cannot start (42501)');
reset role;
select pg_temp.login(pg_temp.u(7), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('p1')),'other-course Student cannot see it');
select pg_temp.assert_true(pg_temp.state_of(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id('p1')))='42501','other-course Student cannot start');
reset role;
select pg_temp.login(pg_temp.u(3), 'aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('p1')),'other Teacher (same course) cannot SELECT an ASSIGNED practice');
select pg_temp.assert_true((select count(*)=0 from public.cohort_practice_assignments),'other Teacher sees no assignment');
reset role;
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.cohort_practice_assignments),'cohort Teacher sees the assignment');
select pg_temp.assert_true(pg_temp.state_of('select * from public.student_assigned_practices()')='42501','Teacher cannot call the Student read');
select pg_temp.assert_true(pg_temp.state_of('insert into public.cohort_practice_assignments(cohort_id,practice_activity_id,assigned_by_teacher_id) values (''b2400000-0000-4000-8000-000000000001'',gen_random_uuid(),''b2100000-0000-4000-8000-000000000002'')')='42501','Teacher has no direct DML on assignments');
select pg_temp.assert_true(pg_temp.state_of('update public.cohort_practice_assignments set due_at = now()')='42501','no direct UPDATE on assignments');
select pg_temp.assert_true(pg_temp.state_of('delete from public.cohort_practice_assignments')='42501','no direct DELETE on assignments');
select pg_temp.assert_true(pg_temp.state_of('update public.practice_activities set title = ''x''')='42501','no direct UPDATE on practices');
reset role;
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from public.cohort_practice_assignments),'Admin aal2 reads assignments');
select pg_temp.assert_true((select count(*)>=1 from public.admin_content_list('practice_activities') r where r->>'id'=pg_temp.id('p1')::text),'admin_content_list works with the new columns');
reset role;
select pg_temp.login(pg_temp.u(1), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.cohort_practice_assignments),'Admin aal1 reads no assignments');
reset role;
select pg_temp.logout();
set local role anon;
select pg_temp.assert_true(pg_temp.state_of('select * from public.cohort_practice_assignments')='42501','anon cannot read assignments');
select pg_temp.assert_true(pg_temp.state_of('select * from public.practice_activity_assets')='42501','anon cannot read assets');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Deterministic grading (allow + deny) and no leakage
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.mk('single', pg_temp.simple('Pick A'), '{"optionId":"a"}', '{"correct":"Great","incorrect":"Nope"}');
select pg_temp.mk('multi', '{"version":2,"stimulus":{"type":"TEXT","text":"Fruits are healthy."},"prompt":"Pick all fruits","response":{"type":"CHOICE_MULTI","options":[{"id":"a","label":"Apple"},{"id":"b","label":"Brick"},{"id":"c","label":"Cherry"},{"id":"d","label":"Door"}]}}', '{"optionIds":["a","c"]}');
select pg_temp.mk('tf', '{"version":2,"stimulus":{"type":"NONE"},"prompt":"True or false?","response":{"type":"TRUE_FALSE","statement":"The sun is a star."}}', '{"value":true}');
select pg_temp.mk('cloze', '{"version":2,"stimulus":{"type":"NONE"},"prompt":"Complete","response":{"type":"CLOZE","text":"I {{1}} to {{2}}."}}', '{"blanks":[{"id":"1","accepted":["go","went"],"caseSensitive":false},{"id":"2","accepted":["School"],"caseSensitive":true}]}');
select pg_temp.mk('order', '{"version":2,"stimulus":{"type":"NONE"},"prompt":"Order the words","response":{"type":"ORDERING","items":[{"id":"w1","label":"I"},{"id":"w2","label":"love"},{"id":"w3","label":"English"}]}}', '{"order":["w1","w2","w3"]}');
-- ORDERING: the stored order was normalized so it never equals the key (teacher entered the key order).
select pg_temp.assert_true((select (select array_agg(i->>'id') from jsonb_array_elements(r->'content'->'response'->'items') i) is distinct from array['w1','w2','w3'] from (select public.teacher_practice_get(pg_temp.id('order')) r) x),'ORDERING stored order differs from the answer order');
select pg_temp.assert_true((select (select array_agg(i->>'id' order by i->>'id') from jsonb_array_elements(r->'content'->'response'->'items') i) = array['w1','w2','w3'] from (select public.teacher_practice_get(pg_temp.id('order')) r) x),'ORDERING keeps every item');
select pg_temp.mk('written', '{"version":2,"stimulus":{"type":"TEXT","text":"Describe your weekend."},"prompt":"Write 3 sentences","response":{"type":"WRITTEN"}}', null, null, 'WRITING');
select pg_temp.mk('spoken', '{"version":2,"stimulus":{"type":"NONE"},"prompt":"Say it aloud","response":{"type":"SPOKEN"}}', null, null, 'GRAMMAR');
reset role;

select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
-- Student sees the content but never the key; the stored content has no answer data.
select pg_temp.assert_true((select count(*)=8 from public.practice_activities where audience='ASSIGNED'),'S1 sees exactly the 8 practices assigned to K1');
select pg_temp.assert_true(not exists(select 1 from public.practice_activities where audience='ASSIGNED' and to_jsonb(practice_activities)::text ~ '(answer_key|optionIds|"value": ?true|accepted|"order":\[)'),'practice rows leak no key');
select pg_temp.assert_true((select count(*)=0 from public.practice_results),'no result before submitting');
-- CHOICE_SINGLE
insert into ids select 'a_single', (public.start_practice_attempt(pg_temp.id('single'), gen_random_uuid())).id;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"optionId":"zz"}'')', pg_temp.id('a_single')))='23514','CHOICE_SINGLE unknown option rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"optionIds":["a"]}'')', pg_temp.id('a_single')))='23514','CHOICE_SINGLE wrong response shape rejected');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_single'), '{"optionId":"b"}')).evaluation_status='INCORRECT','CHOICE_SINGLE wrong -> INCORRECT');
select pg_temp.assert_true((select feedback='Nope' and score=0 from public.practice_results where practice_attempt_id=pg_temp.id('a_single')),'incorrect feedback comes from the private key');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_single'), '{"optionId":"a"}')).evaluation_status='INCORRECT','resubmitting a SUBMITTED attempt is idempotent (first result kept)');
insert into ids select 'a_single2', (public.start_practice_attempt(pg_temp.id('single'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_single2'), '{"optionId":"a"}')).evaluation_status='CORRECT','CHOICE_SINGLE right -> CORRECT');
select pg_temp.assert_true((select feedback='Great' and score=1 and max_score=1 from public.practice_results where practice_attempt_id=pg_temp.id('a_single2')),'correct feedback from the private key');
-- CHOICE_MULTI: exact set only.
insert into ids select 'a_multi1', (public.start_practice_attempt(pg_temp.id('multi'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_multi1'), '{"optionIds":["a"]}')).evaluation_status='INCORRECT','CHOICE_MULTI partial -> INCORRECT');
insert into ids select 'a_multi2', (public.start_practice_attempt(pg_temp.id('multi'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_multi2'), '{"optionIds":["a","c","b"]}')).evaluation_status='INCORRECT','CHOICE_MULTI superset -> INCORRECT');
insert into ids select 'a_multi3', (public.start_practice_attempt(pg_temp.id('multi'), gen_random_uuid())).id;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"optionIds":["a","a"]}'')', pg_temp.id('a_multi3')))='23514','CHOICE_MULTI duplicated option rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"optionIds":[]}'')', pg_temp.id('a_multi3')))='23514','CHOICE_MULTI empty selection rejected');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_multi3'), '{"optionIds":["c","a"]}')).evaluation_status='CORRECT','CHOICE_MULTI exact set (any order) -> CORRECT');
select pg_temp.assert_true((select response->'optionIds'='["a","c"]'::jsonb from public.practice_responses where practice_attempt_id=pg_temp.id('a_multi3')),'CHOICE_MULTI response stored normalized');
insert into ids select 'a_multi4', (public.start_practice_attempt(pg_temp.id('multi'), gen_random_uuid())).id;
-- TRUE_FALSE
insert into ids select 'a_tf1', (public.start_practice_attempt(pg_temp.id('tf'), gen_random_uuid())).id;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"value":"true"}'')', pg_temp.id('a_tf1')))='23514','TRUE_FALSE string value rejected');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_tf1'), '{"value":false}')).evaluation_status='INCORRECT','TRUE_FALSE wrong');
insert into ids select 'a_tf2', (public.start_practice_attempt(pg_temp.id('tf'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_tf2'), '{"value":true}')).evaluation_status='CORRECT','TRUE_FALSE right');
-- CLOZE: trim + case-insensitive by default, any accepted item, case-sensitive blank honoured.
insert into ids select 'a_cl1', (public.start_practice_attempt(pg_temp.id('cloze'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_cl1'), '{"blanks":{"1":"  GO ","2":"School"}}')).evaluation_status='CORRECT','CLOZE trim + case-insensitive -> CORRECT');
insert into ids select 'a_cl2', (public.start_practice_attempt(pg_temp.id('cloze'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_cl2'), '{"blanks":{"1":"Went","2":"School"}}')).evaluation_status='CORRECT','CLOZE any accepted item -> CORRECT');
insert into ids select 'a_cl3', (public.start_practice_attempt(pg_temp.id('cloze'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_cl3'), '{"blanks":{"1":"go","2":"school"}}')).evaluation_status='INCORRECT','CLOZE case-sensitive blank -> INCORRECT');
insert into ids select 'a_cl4', (public.start_practice_attempt(pg_temp.id('cloze'), gen_random_uuid())).id;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"blanks":{"1":"go"}}'')', pg_temp.id('a_cl4')))='23514','CLOZE missing blank rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"blanks":{"1":"go","2":"School","3":"x"}}'')', pg_temp.id('a_cl4')))='23514','CLOZE extra blank rejected');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_cl4'), '{"blanks":{"1":"walk","2":"School"}}')).evaluation_status='INCORRECT','CLOZE wrong word -> INCORRECT');
-- ORDERING: exact sequence only; the student-visible order is not the key.
select pg_temp.assert_true((select (select array_agg(i->>'id') from jsonb_array_elements(content->'response'->'items') i) is distinct from array['w1','w2','w3'] from public.practice_activities where id=pg_temp.id('order')),'Student sees items in a non-key order');
insert into ids select 'a_or1', (public.start_practice_attempt(pg_temp.id('order'), gen_random_uuid())).id;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"order":["w1","w2"]}'')', pg_temp.id('a_or1')))='23514','ORDERING missing item rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"order":["w1","w1","w2"]}'')', pg_temp.id('a_or1')))='23514','ORDERING duplicated item rejected');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_or1'), '{"order":["w3","w2","w1"]}')).evaluation_status='INCORRECT','ORDERING wrong sequence -> INCORRECT');
insert into ids select 'a_or2', (public.start_practice_attempt(pg_temp.id('order'), gen_random_uuid())).id;
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_or2'), '{"order":["w1","w2","w3"]}')).evaluation_status='CORRECT','ORDERING right sequence -> CORRECT');
insert into ids select 'a_or3', (public.start_practice_attempt(pg_temp.id('order'), gen_random_uuid())).id;
-- Result of a deterministic attempt reveals correctness only, never the key.
select pg_temp.assert_true(not exists(select 1 from public.practice_results where metrics::text ~ '(optionId|accepted|order|answer)'),'result metrics carry no key');
select pg_temp.assert_true((select status='DONE' from public.student_assigned_practices() where practice_activity_id=pg_temp.id('single')),'assigned list: DONE after submission');
select pg_temp.assert_true((select status='NEW' from public.student_assigned_practices() where practice_activity_id=pg_temp.id('written')),'assigned list: untouched practice stays NEW');
insert into ids select 'a_wr_open', (public.start_practice_attempt(pg_temp.id('written'), gen_random_uuid())).id;
select pg_temp.assert_true((select status='IN_PROGRESS' from public.student_assigned_practices() where practice_activity_id=pg_temp.id('written')),'assigned list: IN_PROGRESS');
reset role;
-- OVERDUE is derived from the due date when nothing was submitted.
update public.cohort_practice_assignments set due_at = now() - interval '1 hour' where practice_activity_id = pg_temp.id('written');
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select status='OVERDUE' from public.student_assigned_practices() where practice_activity_id=pg_temp.id('written')),'assigned list: OVERDUE');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 5. WRITTEN / SPOKEN -> manual review queue (no score, no CEFR)
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, %L)', pg_temp.id('a_wr_open'), '{"text":""}'))='23514','WRITTEN empty text rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, %L)', pg_temp.id('a_wr_open'), jsonb_build_object('text', repeat('x', 2001))))='23514','WRITTEN over 2000 chars rejected');
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_wr_open'), '{"text":"On Saturday I played football with friends."}')).evaluation_status='PENDING_MANUAL','WRITTEN -> PENDING_MANUAL');
select pg_temp.assert_true((select score is null and max_score is null and metrics->>'response_type'='WRITTEN' from public.practice_results where practice_attempt_id=pg_temp.id('a_wr_open')),'WRITTEN has no score');
select pg_temp.assert_true((select status='DONE' from public.student_assigned_practices() where practice_activity_id=pg_temp.id('written')),'submitted WRITTEN is DONE even when overdue');
-- SPOKEN reuses the private audio upload.
insert into ids select 'a_sp', (public.start_practice_attempt(pg_temp.id('spoken'), gen_random_uuid())).id;
insert into ids select 'a_sp_choice', (public.start_practice_attempt(pg_temp.id('single'), gen_random_uuid())).id;
select pg_temp.assert_true(pg_temp.state_of(format('select public.reserve_practice_audio(%L, ''audio/webm'')', pg_temp.id('a_sp_choice')))='42501','audio cannot be reserved for a CHOICE practice');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, %L)', pg_temp.id('a_sp'), '{"text":"typed"}'))='23514','SPOKEN rejects a typed response');
insert into ids select 'media', public.reserve_practice_audio(pg_temp.id('a_sp'), 'audio/webm');
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, %L)', pg_temp.id('a_sp'), jsonb_build_object('mediaId', pg_temp.id('media'))))='23514','SPOKEN requires a validated upload');
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'yas-practice-responses', storage_path, '{"mimetype":"audio/webm","size":2048}' from public.practice_response_media where id = pg_temp.id('media');
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select public.complete_practice_audio(pg_temp.id('media'));
select pg_temp.assert_true((public.submit_practice_attempt(pg_temp.id('a_sp'), jsonb_build_object('mediaId', pg_temp.id('media')))).evaluation_status='PENDING_MANUAL','SPOKEN -> PENDING_MANUAL');
reset role;

-- Review queue: only Teachers assigned to the Student's cohort see them; rubric dimensions follow the response type.
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)=2 from public.get_teacher_reviews() r where r->>'responseType' in ('WRITTEN','SPOKEN')),'cohort Teacher sees the WRITTEN and SPOKEN attempts');
select pg_temp.assert_true((select r->>'skill'='WRITING' and r->>'prompt'='Write 3 sentences' from public.get_teacher_reviews() r where r->>'responseType'='WRITTEN'),'WRITTEN of skill WRITING is reviewable');
select pg_temp.assert_true((select count(*)=0 from public.get_teacher_reviews() r where r->>'responseType' in ('CHOICE_SINGLE','CHOICE_MULTI','TRUE_FALSE','CLOZE','ORDERING')),'deterministic attempts never enter the queue');
select pg_temp.assert_true(pg_temp.state_of(format('select public.finalize_practice_review(%L, %L, ''feedback'')', pg_temp.id('a_wr_open'), '{"intelligibility":"SOLID","target_sounds":"SOLID","word_stress":"SOLID","sentence_stress_rhythm":"SOLID"}'))='23514','WRITTEN rejects pronunciation dimensions');
select pg_temp.assert_true(pg_temp.state_of(format('select public.finalize_practice_review(%L, %L, ''feedback'')', pg_temp.id('a_wr_open'), '{"task_completion":"SOLID","comprehensibility":"SOLID","language_accuracy":"SOLID"}'))='23514','WRITTEN rubric needs every dimension');
select pg_temp.assert_true(pg_temp.state_of(format('select public.finalize_practice_review(%L, %L, ''Nice work'')', pg_temp.id('a_wr_open'), '{"task_completion":"SOLID","comprehensibility":"STRONG","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID"}'))='OK','WRITTEN reviewed with the written dimensions');
select pg_temp.assert_true(pg_temp.state_of(format('select public.finalize_practice_review(%L, %L, ''Fine'')', pg_temp.id('a_sp'), '{"task_completion":"SOLID","comprehensibility":"SOLID","fluency":"SOLID","language_accuracy":"SOLID","vocabulary_use":"SOLID","pronunciation_intelligibility":"SOLID"}'))='OK','SPOKEN reviewed with the speaking dimensions');
select pg_temp.assert_true((select count(*)=0 from public.get_teacher_reviews()),'queue is empty after both reviews');
-- Read-only review insights: today's count, saved reviews and context stay inside the Teacher scope.
select pg_temp.assert_true((public.get_teacher_review_overview()->>'reviewedToday')::int=2,'overview counts the reviews sent today');
select pg_temp.assert_true((public.get_teacher_review_overview()->>'avgResponseMinutes7d') is not null,'overview has an average response time');
select pg_temp.assert_true(jsonb_array_length(public.get_teacher_review_context(pg_temp.id('a_wr_open'))->'reviews')=1,'context returns the saved review');
select pg_temp.assert_true((public.get_teacher_review_context(pg_temp.id('a_wr_open'))->'reviews'->0->>'feedback')='Nice work','saved feedback is readable by its Teacher');
select pg_temp.assert_true(public.get_teacher_review_context(pg_temp.id('a_wr_open'))::text !~ 'storage_path|score','context exposes no storage path or score');
reset role;
select pg_temp.assert_true((select evaluation_status='MANUAL_REVIEWED' and score is null and max_score is null from public.practice_results where practice_attempt_id=pg_temp.id('a_wr_open')),'review keeps score null (no aggregate, no CEFR)');
select pg_temp.login(pg_temp.u(3), 'aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.get_teacher_reviews(pg_temp.id('a_wr_open'))),'unrelated Teacher cannot read the attempt');
select pg_temp.assert_true(public.get_teacher_review_context(pg_temp.id('a_wr_open')) is null,'unrelated Teacher gets no review context');
select pg_temp.assert_true((public.get_teacher_review_overview()->>'reviewedToday')::int=0,'overview only counts the Teacher own reviews');
select pg_temp.assert_true(pg_temp.state_of(format('select public.finalize_practice_review(%L, %L, ''x'')', pg_temp.id('a_sp'), '{}'))='42501','unrelated Teacher cannot finalize');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Unpublish, immutability with attempts, duplicate, unassign, admin path
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
insert into ids select 'p1_att', (public.start_practice_attempt(pg_temp.id('p1'), gen_random_uuid())).id;
reset role;
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select public.teacher_practice_unpublish(pg_temp.id('p1'));
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_unpublish(%L)', pg_temp.id('p1')))='23514','unpublishing a draft is rejected');
reset role;
select pg_temp.login(pg_temp.u(9), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('p1')),'unpublished practice disappears for a Student without history');
select pg_temp.assert_true((select count(*)=0 from public.student_assigned_practices() where practice_activity_id=pg_temp.id('p1')),'unpublished practice disappears from the assigned list');
select pg_temp.assert_true(pg_temp.state_of(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id('p1')))<>'OK','cannot start an unpublished practice');
reset role;
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.submit_practice_attempt(%L, ''{"optionId":"a"}'')', pg_temp.id('p1_att')))='42501','in-progress attempt of an unpublished practice cannot be submitted');
select pg_temp.assert_true((select count(*)=0 from public.student_assigned_practices() where practice_activity_id=pg_temp.id('p1')),'unpublished practice is not in the S1 assigned list');
reset role;
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
-- Immutability: attempts exist -> no edit of content, key, assets; duplicate instead.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, ''{"title":"Retitled"}''::jsonb)', pg_temp.id('p1')))='23514','practice with attempts is immutable (title/content)');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, ''{}''::jsonb, ''{"optionId":"b"}''::jsonb)', pg_temp.id('p1')))='23514','practice with attempts is immutable (answer key)');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_reserve_asset(%L,''IMAGE'',''image/png'')', pg_temp.id('p1')))='23514','practice with attempts accepts no new assets');
insert into ids values ('p1_dup', public.teacher_practice_duplicate(pg_temp.id('p1'), '{"request_id":"b2900000-0000-4000-8000-000000000004","environment":"test","version":"pa-1"}'));
select pg_temp.assert_true((select r->>'publicationStatus'='DRAFT' and r->>'hasAttempts'='false' and (r->'answerKey')='{"optionId":"a"}'::jsonb and r->>'title' like '%(cópia)' and jsonb_array_length(r->'assignments')=0 from (select public.teacher_practice_get(pg_temp.id('p1_dup')) r) x),'duplicate is an editable DRAFT with the same key and no assignment');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, ''{"title":"Edited copy"}''::jsonb, ''{"optionId":"b"}''::jsonb)', pg_temp.id('p1_dup')))='OK','the duplicate can be edited');
-- Unassign: scoped to the cohort Teacher and an existing assignment; the practice stays untouched.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_unassign(%L, %L)', pg_temp.id('single'), 'b2400000-0000-4000-8000-000000000002'))='42501','cannot unassign a cohort that is not yours');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_unassign(%L, %L)', pg_temp.id('p1_dup'), 'b2400000-0000-4000-8000-000000000001'))='42501','cannot unassign something that was never assigned');
select public.teacher_practice_unassign(pg_temp.id('tf'), 'b2400000-0000-4000-8000-000000000001', '{"request_id":"b2900000-0000-4000-8000-000000000005","environment":"test","version":"pa-1"}');
reset role;
select pg_temp.login(pg_temp.u(9), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where id=pg_temp.id('tf')),'unassigned practice disappears for a Student without history');
select pg_temp.assert_true(pg_temp.state_of(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id('tf')))='42501','unassigned practice cannot be started');
reset role;
-- Membership ends: access disappears.
select pg_temp.login(pg_temp.u(9), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)>=1 from public.student_assigned_practices()),'S4 has assignments while member');
reset role;
update public.cohort_memberships set status='LEFT', ends_at=now() where user_id = pg_temp.u(9);
select pg_temp.login(pg_temp.u(9), 'aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.student_assigned_practices()),'a Student who left the cohort sees no assignments');
select pg_temp.assert_true((select count(*)=0 from public.practice_activities where audience='ASSIGNED'),'a Student who left the cohort sees no ASSIGNED practice');
reset role;
-- Admin keeps the transition path (content_change_guard does not block it) and cannot set audience.
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select public.admin_content_transition('practice_activities', pg_temp.id('single'), 'DRAFT');
select pg_temp.assert_true((select publication_status='DRAFT' from public.practice_activities where id=pg_temp.id('single')),'Admin can unpublish a Teacher practice');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_content_transition(''practice_activities'', %L, ''PUBLISHED'')', pg_temp.id('single')))='OK','Admin can republish a valid Teacher practice');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_content_save(''practice_activities'', %L, ''{"audience":"ASSIGNED"}'')', pg_temp.id('p1_dup')))='22023','Admin cannot set audience');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_content_save(''practice_activities'', %L, ''{"created_by_teacher_id":null}'')', pg_temp.id('p1_dup')))='22023','Admin cannot touch the owner');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Stimulus assets
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
insert into ids values ('pm', public.teacher_practice_save(null, pg_temp.payload(pg_temp.simple('Look at the picture')), '{"optionId":"a"}'));
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_reserve_asset(%L,''IMAGE'',''audio/webm'')', pg_temp.id('pm')))='23514','IMAGE with an audio MIME rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_reserve_asset(%L,''AUDIO'',''image/png'')', pg_temp.id('pm')))='23514','AUDIO with an image MIME rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_reserve_asset(%L,''VIDEO'',''video/x-msvideo'')', pg_temp.id('pm')))='23514','unsupported video MIME rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_reserve_asset(%L,''PDF'',''application/pdf'')', pg_temp.id('pm')))='23514','unsupported asset type rejected');
insert into ids select 'asset1', (public.teacher_practice_reserve_asset(pg_temp.id('pm'), 'IMAGE', 'image/png', '{"request_id":"b2900000-0000-4000-8000-000000000006","environment":"test","version":"pa-1"}')->>'assetId')::uuid;
select pg_temp.assert_true((select r->>'bucket'='yas-practice-assets' and (r->>'maxBytes')::bigint=26214400 and (r->>'storagePath') like pg_temp.id('pm')::text || '/%' from (select public.teacher_practice_reserve_asset(pg_temp.id('pm'), 'AUDIO', 'audio/mpeg') r) x),'reserve returns bucket, scoped path and size limit');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_complete_asset(%L)', pg_temp.id('asset1')))='23514','completing without an uploaded object is rejected');
reset role;
select pg_temp.login(pg_temp.u(3), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_complete_asset(%L)', pg_temp.id('asset1')))='42501','other Teacher cannot complete the asset');
reset role;
-- wrong MIME / oversize objects are refused; the right one is accepted.
insert into storage.objects(bucket_id,name,metadata) select 'yas-practice-assets', storage_path, '{"mimetype":"image/jpeg","size":1000}' from public.practice_activity_assets where id = pg_temp.id('asset1');
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_complete_asset(%L)', pg_temp.id('asset1')))='23514','object MIME differing from the reservation is rejected');
reset role;
update storage.objects set metadata = '{"mimetype":"image/png","size":30000000}' where bucket_id='yas-practice-assets' and name=(select storage_path from public.practice_activity_assets where id = pg_temp.id('asset1'));
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_complete_asset(%L)', pg_temp.id('asset1')))='23514','oversized object is rejected');
reset role;
update storage.objects set metadata = '{"mimetype":"image/png","size":2048}' where bucket_id='yas-practice-assets' and name=(select storage_path from public.practice_activity_assets where id = pg_temp.id('asset1'));
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.assert_true((public.teacher_practice_complete_asset(pg_temp.id('asset1'))->>'uploadStatus')='READY','valid object completes the asset');
select pg_temp.assert_true((public.teacher_practice_complete_asset(pg_temp.id('asset1'))->>'uploadStatus')='READY','completing twice is idempotent');
-- The stimulus must reference a READY asset of this very practice, with alt text for images.
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, %L::jsonb)', pg_temp.id('pm'), jsonb_build_object('content', jsonb_build_object('version',2,'stimulus',jsonb_build_object('type','IMAGE','assetId',gen_random_uuid()::text,'alt','A cat'),'prompt','Look','response','{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb))))='OK','draft accepts a stimulus reference');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('pm')))='23514','unknown asset id cannot be published');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, %L::jsonb)', pg_temp.id('pm'), jsonb_build_object('content', jsonb_build_object('version',2,'stimulus',jsonb_build_object('type','IMAGE','assetId',pg_temp.id('asset1')::text),'prompt','Look','response','{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb))))='OK','draft stimulus without alt saved');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('pm')))='23514','IMAGE stimulus without alt text cannot be published');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, %L::jsonb)', pg_temp.id('pm'), jsonb_build_object('content', jsonb_build_object('version',2,'stimulus',jsonb_build_object('type','AUDIO','assetId',pg_temp.id('asset1')::text),'prompt','Look','response','{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb))))='OK','draft stimulus with mismatching type saved');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_publish(%L)', pg_temp.id('pm')))='23514','stimulus type must match the asset type');
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(%L, %L::jsonb)', pg_temp.id('pm'), jsonb_build_object('content', jsonb_build_object('version',2,'stimulus',jsonb_build_object('type','IMAGE','assetId',pg_temp.id('asset1')::text,'alt','A cat on a mat'),'prompt','Look','response','{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb))))='OK','stimulus with alt text saved');
select public.teacher_practice_publish(pg_temp.id('pm'));
select pg_temp.assert_true(public.teacher_practice_assign(pg_temp.id('pm'), array['b2400000-0000-4000-8000-000000000001']::uuid[])=1,'media practice assigned');
select pg_temp.assert_true(public.authorize_practice_asset(pg_temp.id('asset1')),'owner Teacher authorized for its asset');
insert into ids values ('pm_dup', public.teacher_practice_duplicate(pg_temp.id('pm')));
select pg_temp.assert_true((select jsonb_array_length(r->'assets')=1 and (r->'assets'->0->>'uploadStatus')='READY' and (r->'content'->'stimulus'->>'assetId')=(r->'assets'->0->>'id') and (r->'assets'->0->>'id')<>pg_temp.id('asset1')::text from (select public.teacher_practice_get(pg_temp.id('pm_dup')) r) x),'duplicate clones READY assets and remaps the stimulus');
select public.teacher_practice_publish(pg_temp.id('pm_dup'));
reset role;
insert into ids select 'asset_dup', id from public.practice_activity_assets where practice_activity_id = pg_temp.id('pm_dup');
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
select pg_temp.assert_true(public.authorize_practice_asset(pg_temp.id('asset1')),'assigned Student authorized for the stimulus asset');
reset role;
select pg_temp.login(pg_temp.u(6), 'aal1');
set local role authenticated;
select pg_temp.assert_true(not public.authorize_practice_asset(pg_temp.id('asset1')),'other-cohort Student not authorized');
reset role;
select pg_temp.login(pg_temp.u(3), 'aal2');
set local role authenticated;
select pg_temp.assert_true(not public.authorize_practice_asset(pg_temp.id('asset1')),'other Teacher not authorized');
reset role;
select pg_temp.login(pg_temp.u(5), 'aal1');
set local role authenticated;
-- The duplicate was published but never assigned: the Student is not authorized for it.
select pg_temp.assert_true(not public.authorize_practice_asset(pg_temp.id('asset_dup')),'unassigned duplicate asset is not authorized');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 8. Audit, catalog and privileges
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.assert_true((select count(distinct action)>=7 from public.audit_logs where entity_type='practice_activities' and action like 'teacher_practice_%'),'teacher actions are audited');
select pg_temp.assert_true(exists(select 1 from public.audit_logs where action='teacher_practice_created' and request_id='b2900000-0000-4000-8000-000000000001' and environment='test' and version='pa-1' and actor_user_id=pg_temp.u(2)),'audit carries actor and technical correlation');
select pg_temp.assert_true(not exists(select 1 from public.audit_logs where entity_type='practice_activities' and action like 'teacher_practice_%' and data::text ~* '(optionId|accepted|Pick one|Which letter|Well done|storage_path)'),'audit data carries no content, key or storage path');
do $$
declare t text; r text; f text;
begin
  foreach t in array array['public.cohort_practice_assignments','public.practice_activity_assets'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'practice_authoring: RLS off on %', t; end if;
    foreach r in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
      if has_any_column_privilege('anon', t, r) then raise exception 'practice_authoring: anon has % on %', r, t; end if;
    end loop;
    foreach r in array array['INSERT','UPDATE'] loop
      if has_any_column_privilege('authenticated', t, r) then raise exception 'practice_authoring: authenticated has % on %', r, t; end if;
    end loop;
    if has_table_privilege('anon', t, 'DELETE') or has_table_privilege('authenticated', t, 'DELETE') then raise exception 'practice_authoring: DELETE granted on %', t; end if;
  end loop;
  if has_any_column_privilege('authenticated', 'public.practice_activity_assets', 'SELECT') then raise exception 'practice_authoring: authenticated can read assets'; end if;
  if has_any_column_privilege('authenticated', 'private.practice_answer_keys', 'SELECT') or has_any_column_privilege('anon', 'private.practice_answer_keys', 'SELECT') then raise exception 'practice_authoring: answer keys readable'; end if;
  foreach f in array array[
    'public.teacher_practice_list()','public.teacher_practice_get(uuid)','public.teacher_practice_save(uuid,jsonb,jsonb,jsonb,jsonb)',
    'public.teacher_practice_publish(uuid,jsonb)','public.teacher_practice_unpublish(uuid,jsonb)','public.teacher_practice_duplicate(uuid,jsonb)',
    'public.teacher_practice_assign(uuid,uuid[],timestamptz,jsonb)','public.teacher_practice_unassign(uuid,uuid,jsonb)',
    'public.teacher_practice_reserve_asset(uuid,text,text,jsonb)','public.teacher_practice_complete_asset(uuid,jsonb)',
    'public.authorize_practice_asset(uuid)','public.student_assigned_practices()','public.submit_practice_attempt(uuid,jsonb)',
    'public.get_teacher_reviews(uuid)','public.finalize_practice_review(uuid,jsonb,text,text)','public.reserve_practice_audio(uuid,text)',
    'public.get_teacher_review_overview()','public.get_teacher_review_context(uuid)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then raise exception 'practice_authoring: anon can execute %', f; end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then raise exception 'practice_authoring: authenticated cannot execute %', f; end if;
  end loop;
  foreach f in array array['public.submit_practice_attempt_pre_authoring(uuid,jsonb)','private.validate_content_pre_authoring(text,jsonb)',
    'private.validate_practice_v2(jsonb,jsonb,text,uuid)','private.is_teacher_for_course(uuid)','private.practice_normalize_content(jsonb,jsonb,uuid)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE') then raise exception 'practice_authoring: % must stay internal', f; end if;
  end loop;
end $$;
-- Immutability also holds against the owner-level path once attempts exist (answer key table trigger).
select pg_temp.assert_true(pg_temp.state_of(format('update private.practice_answer_keys set answer_key = ''{"optionId":"b"}'' where practice_activity_id = %L', pg_temp.id('p1')))='23514','answer key of an attempted teacher practice cannot be changed (table trigger)');
select pg_temp.assert_true(pg_temp.state_of(format('update public.practice_activities set content = jsonb_set(content, ''{prompt}'', ''"changed"'') where id = %L', pg_temp.id('p1')))='23514','content of an attempted teacher practice cannot be changed');
-- private.is_teacher_for_course follows the caller's scope.
select pg_temp.login(pg_temp.u(2), 'aal2');
select pg_temp.assert_true(private.is_teacher_for_course('b2200000-0000-4000-8000-000000000001'),'T1 teaches course C1');
select pg_temp.assert_true(not private.is_teacher_for_course('b2200000-0000-4000-8000-000000000002'),'T1 does not teach course C2');
select pg_temp.login(pg_temp.u(2), 'aal1');
select pg_temp.assert_true(not private.is_teacher_for_course('b2200000-0000-4000-8000-000000000001'),'AAL1 never has course scope');
select pg_temp.login(pg_temp.u(8), 'aal2');
select pg_temp.assert_true(not private.is_teacher_for_course('b2200000-0000-4000-8000-000000000001'),'Teacher without cohort has no course scope');
-- A Teacher whose cohort assignment ended loses authoring scope (ends_at set).
update public.cohort_teachers set ends_at = now() where cohort_id = 'b2400000-0000-4000-8000-000000000003';
select pg_temp.login(pg_temp.u(4), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.teacher_practice_save(null, %L::jsonb)', pg_temp.payload(pg_temp.simple(),'GRAMMAR','b2200000-0000-4000-8000-000000000002')))='42501','ended cohort assignment removes course scope');
reset role;

select pg_temp.logout();
rollback;
