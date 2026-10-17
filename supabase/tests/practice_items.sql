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

-- Content builders --------------------------------------------------------------------------------------------
create function pg_temp.payload(content jsonb, skill text default 'GRAMMAR', course uuid default 'e1200000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select jsonb_build_object('title', 'PI practice', 'skill', skill, 'estimated_minutes', 5, 'course_id', course, 'content', content);
$$;
create function pg_temp.items(variadic parts text[]) returns jsonb language sql as $$
  select jsonb_build_object('version', 3, 'objective', 'Praticar o present simple', 'askConfidence', true, 'items',
    (select jsonb_agg(p::jsonb) from unnest(parts) p));
$$;
create function pg_temp.q(n text) returns text language sql immutable as $$
  select case n
    when 'q1' then '{"id":"q1","prompt":"Pick the greeting","stimulus":{"type":"NONE"},"response":{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"Nice to meet you"},{"id":"b","label":"Nice to meeting you"}]}}'
    when 'q2' then '{"id":"q2","prompt":"Pick all verbs","stimulus":{"type":"NONE"},"response":{"type":"CHOICE_MULTI","options":[{"id":"a","label":"run"},{"id":"b","label":"table"},{"id":"c","label":"eat"}]}}'
    when 'q3' then '{"id":"q3","prompt":"True or false","stimulus":{"type":"NONE"},"response":{"type":"TRUE_FALSE","statement":"She works here."}}'
    when 'q4' then '{"id":"q4","prompt":"Complete","stimulus":{"type":"NONE"},"response":{"type":"CLOZE","text":"I {{1}} a student."}}'
    when 'q5' then '{"id":"q5","prompt":"Order the words","stimulus":{"type":"NONE"},"response":{"type":"ORDERING","items":[{"id":"w1","label":"I"},{"id":"w2","label":"am"},{"id":"w3","label":"here"}]}}'
    when 'w1' then '{"id":"w1","prompt":"Write two sentences","stimulus":{"type":"TEXT","text":"Describe your day."},"response":{"type":"WRITTEN"},"planningSeconds":30}'
    when 's1' then '{"id":"s1","prompt":"Say it aloud","stimulus":{"type":"NONE"},"response":{"type":"SPOKEN"}}'
  end;
$$;
create function pg_temp.keys() returns jsonb language sql as $$
  select '{"q1":{"answerKey":{"optionId":"a"},"feedback":{"correct":"Isso!","incorrect":"Revise o verbo.","options":{"a":"Correto: meet.","b":"Depois de to usamos o verbo base."}}},
           "q2":{"answerKey":{"optionIds":["a","c"]},"feedback":{"options":{"a":"run é verbo.","b":"table é substantivo.","c":"eat é verbo."}}},
           "q3":{"answerKey":{"value":true},"feedback":{"correct":"Sim."}},
           "q4":{"answerKey":{"blanks":[{"id":"1","accepted":["am"]}]}},
           "q5":{"answerKey":{"order":["w1","w2","w3"]}},
           "w1":{},"s1":{}}'::jsonb;
$$;
-- Keys restricted to the items present in the content (unknown-item keys are refused by design).
create function pg_temp.fit(content jsonb, keys jsonb) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) from jsonb_each(keys) e
  where e.key in (select i ->> 'id' from jsonb_array_elements(content -> 'items') i);
$$;
-- Authors as the current Teacher: save v3, publish, assign to K1.
create function pg_temp.mk(k text, content jsonb, keys jsonb default null, skill text default 'GRAMMAR') returns void language plpgsql as $$
declare pid uuid;
begin
  pid := public.teacher_practice_save_v3(null, pg_temp.payload(content, skill), coalesce(keys, pg_temp.fit(content, pg_temp.keys())));
  insert into ids values (k, pid);
  perform public.teacher_practice_publish(pid);
  perform public.teacher_practice_assign(pid, array['e1400000-0000-4000-8000-000000000001']::uuid[]);
end $$;
create function pg_temp.sub(att text, item text, rnd integer, resp text, conf text default null) returns jsonb language sql as $$
  select public.submit_practice_item(pg_temp.id(att), item, rnd::smallint, resp::jsonb, conf);
$$;

-- 1. v3 validation at save: allow and deny -------------------------------------------------------------------
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.mk('obj', pg_temp.items(pg_temp.q('q1'), pg_temp.q('q2'), pg_temp.q('q3'), pg_temp.q('q4'), pg_temp.q('q5')));
select pg_temp.mk('mixed', pg_temp.items(pg_temp.q('q1'), pg_temp.q('w1'), pg_temp.q('s1')));
select pg_temp.ok((select r -> 'content' ->> 'evaluationMode' = 'DETERMINISTIC' and r -> 'content' -> 'version' = '3'::jsonb
  from (select public.teacher_practice_get(pg_temp.id('obj')) r) x), 'objective-only content derives DETERMINISTIC');
select pg_temp.ok((select r -> 'content' ->> 'evaluationMode' = 'MANUAL_PENDING' from (select public.teacher_practice_get(pg_temp.id('mixed')) r) x),
  'a WRITTEN/SPOKEN item derives MANUAL_PENDING');
select pg_temp.ok((select (select array_agg(i ->> 'id') from jsonb_array_elements(r #> '{content,items,4,response,items}') i) is distinct from array['w1','w2','w3']
  from (select public.teacher_practice_get(pg_temp.id('obj')) r) x), 'ORDERING stored order differs from the key order');
select pg_temp.ok((select r -> 'itemKeys' -> 'q1' -> 'feedback' -> 'options' ->> 'b' = 'Depois de to usamos o verbo base.' and r -> 'itemKeys' -> 'q5' -> 'answerKey' ->> 'order' is not null
  from (select public.teacher_practice_get(pg_temp.id('obj')) r) x), 'owner reads item keys through the RPC');
select pg_temp.ok((select (r ->> 'itemCount')::int = 5 and r -> 'version' = '3'::jsonb from public.teacher_practice_list() r where r ->> 'id' = pg_temp.id('obj')::text), 'list exposes version and item count');
-- A payload evaluationMode / version cannot override the derived ones.
insert into ids values ('modetest', public.teacher_practice_save_v3(null, pg_temp.payload(pg_temp.items(pg_temp.q('q1'), pg_temp.q('w1')) || '{"evaluationMode":"DETERMINISTIC","version":2}'),
  pg_temp.fit(pg_temp.items(pg_temp.q('q1'), pg_temp.q('w1')), pg_temp.keys())));
select pg_temp.ok((select r -> 'content' ->> 'evaluationMode' = 'MANUAL_PENDING' and r -> 'content' -> 'version' = '3'::jsonb from (select public.teacher_practice_get(pg_temp.id('modetest')) r) x), 'payload evaluationMode and version are ignored');
-- Deny matrix on the content.
create function pg_temp.sv(content jsonb, keys jsonb default null, skill text default 'GRAMMAR') returns text language sql as $$
  select pg_temp.state(format('select public.teacher_practice_save_v3(null, %L::jsonb, %L::jsonb)', pg_temp.payload(content, skill), coalesce(keys, pg_temp.fit(content, pg_temp.keys()))));
$$;
-- An incomplete draft (empty objective) saves; publishing it is refused.
create function pg_temp.draft_no_objective() returns jsonb language sql as $$
  select jsonb_set(pg_temp.items(pg_temp.q('q1')), '{objective}', '""'::jsonb);
$$;
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_save_v3(null, %L::jsonb, %L::jsonb)', pg_temp.payload(pg_temp.draft_no_objective()), pg_temp.fit(pg_temp.draft_no_objective(), pg_temp.keys()))) = 'OK', 'draft without objective saves');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_publish(public.teacher_practice_save_v3(null, %L::jsonb, %L::jsonb))', pg_temp.payload(pg_temp.draft_no_objective()), pg_temp.fit(pg_temp.draft_no_objective(), pg_temp.keys()))) = '23514', 'publishing a practice without objective is refused');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'))) = 'OK', 'single-item v3 accepted');
select pg_temp.ok(pg_temp.sv(replace(pg_temp.items(pg_temp.q('q1'))::text, '"id": "q1"', '"id": "Bad_ID"')::jsonb) = '23514', 'uppercase/underscore id rejected');
select pg_temp.ok(pg_temp.sv(replace(pg_temp.items(pg_temp.q('q1'))::text, '"id": "q1"', '"id": ""')::jsonb) = '23514', 'empty id rejected');
select pg_temp.ok(pg_temp.sv(replace(pg_temp.items(pg_temp.q('q1'))::text, '"id": "q1"', '"id": "' || repeat('a', 41) || '"')::jsonb) = '23514', '41-char id rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'), pg_temp.q('q1'))) = '23514', 'duplicate item id rejected');
select pg_temp.ok(pg_temp.sv(jsonb_set(pg_temp.items(pg_temp.q('q1')), '{items}', '[]')) = '23514', 'zero items rejected');
select pg_temp.ok(pg_temp.sv((select jsonb_set(pg_temp.items(pg_temp.q('q1')), '{items}', jsonb_agg(replace(pg_temp.q('q3'), '"q3"', '"t' || n || '"')::jsonb))
  from generate_series(1, 21) n), (select jsonb_object_agg('t' || n, '{"answerKey":{"value":true}}'::jsonb) from generate_series(1, 21) n)) = '23514', '21 items rejected');
select pg_temp.ok(pg_temp.sv((select jsonb_set(pg_temp.items(pg_temp.q('q1')), '{items}', jsonb_agg(replace(pg_temp.q('q3'), '"q3"', '"t' || n || '"')::jsonb))
  from generate_series(1, 20) n), (select jsonb_object_agg('t' || n, '{"answerKey":{"value":true}}'::jsonb) from generate_series(1, 20) n)) = 'OK', '20 items accepted');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')) || '{"objective":5}') = '23514', 'non-string objective rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')) || jsonb_build_object('objective', repeat('x', 201))) = '23514', 'objective over 200 chars rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')) - 'askConfidence') = '23514', 'askConfidence required');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')) || '{"extra":1}') = '23514', 'unknown content field rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), '{}') = '23514', 'objective item without a key rejected (key coverage)');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), pg_temp.fit(pg_temp.items(pg_temp.q('q1')), pg_temp.keys()) || '{"zz":{}}') = '23514', 'key for an unknown item rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'), pg_temp.q('w1')), pg_temp.fit(pg_temp.items(pg_temp.q('q1'), pg_temp.q('w1')), pg_temp.keys()) || '{"w1":{"answerKey":{"optionId":"a"}}}') = '23514', 'answer key on a WRITTEN item rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), '{"q1":{"answerKey":{"optionId":"zz"}}}') = '23514', 'answer key outside the options rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), '{"q1":{"answerKey":{"optionId":"a"},"feedback":{"options":{"zz":"x"}}}}') = '23514', 'option feedback for an unknown option rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q3')), '{"q3":{"answerKey":{"value":true},"feedback":{"options":{"a":"x"}}}}') = '23514', 'option feedback only for choice items');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), '{"q1":{"answerKey":{"optionId":"a"},"feedback":{"correct":""}}}') = '23514', 'empty feedback text rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), jsonb_build_object('q1', jsonb_build_object('answerKey', '{"optionId":"a"}'::jsonb, 'feedback', jsonb_build_object('correct', repeat('x', 601))))) = '23514', 'feedback over 600 chars rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), '{"q1":{"answerKey":{"optionId":"a"},"other":1}}') = '23514', 'unknown key field rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(replace(pg_temp.q('w1'), '30', '45'))) = '23514', 'planningSeconds 45 rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(replace(pg_temp.q('q1'), '"stimulus"', '"planningSeconds":30,"stimulus"'))) = '23514', 'planningSeconds on an objective item rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('w1'), pg_temp.q('s1')), '{}') = 'OK', 'manual items need no key');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_save_v3(null, %L::jsonb, null)', pg_temp.payload(pg_temp.items(pg_temp.q('q1'))))) = '23514', 'new practice without item keys rejected');
-- Pronunciation template: AUDIO model + SPOKEN on every item.
create function pg_temp.pron(stim text, resp text) returns jsonb language sql as $$
  select pg_temp.items(format('{"id":"p1","prompt":"Repeat","stimulus":%s,"response":%s}', stim, resp));
$$;
select pg_temp.ok(pg_temp.sv(pg_temp.pron('{"type":"AUDIO","assetId":"e1500000-0000-4000-8000-000000000001","transcript":"Nice to meet you"}', '{"type":"SPOKEN"}'), '{}', 'PRONUNCIATION') = 'OK', 'pronunciation: AUDIO + SPOKEN accepted');
select pg_temp.ok(pg_temp.sv(pg_temp.pron('{"type":"TEXT","text":"Nice to meet you"}', '{"type":"SPOKEN"}'), '{}', 'PRONUNCIATION') = '23514', 'pronunciation: TEXT stimulus rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.pron('{"type":"AUDIO","assetId":"e1500000-0000-4000-8000-000000000001"}', '{"type":"WRITTEN"}'), '{}', 'PRONUNCIATION') = '23514', 'pronunciation: WRITTEN response rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), null, 'PRONUNCIATION') = '23514', 'pronunciation: objective item rejected');
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1')), null, 'MATH') = '23514', 'unsupported skill rejected');
-- Publication re-validates (missing READY asset keeps the draft).
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_publish(public.teacher_practice_save_v3(null, %L::jsonb, ''{}''::jsonb))',
  pg_temp.payload(pg_temp.pron('{"type":"AUDIO","assetId":"e1500000-0000-4000-8000-000000000001"}', '{"type":"SPOKEN"}'), 'PRONUNCIATION'))) = '23514', 'publish without a READY audio asset rejected');
reset role;

-- Authorization of the v3 save.
select pg_temp.login(4, 'aal1');
set local role authenticated;
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'))) = '42501', 'Teacher aal1 cannot save v3');
reset role;
select pg_temp.login(5, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'))) = '42501', 'Teacher of another course cannot author in C1');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_save_v3(%L, ''{"title":"hijack"}''::jsonb, null)', pg_temp.id('obj'))) = '42501', 'other Teacher cannot edit a v3 practice');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_get(%L)', pg_temp.id('obj'))) = '42501', 'other Teacher cannot read item keys');
reset role;
select pg_temp.login(1, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'))) = '42501', 'Student cannot save v3');
select pg_temp.ok(pg_temp.state('select * from private.practice_item_keys') = '42501', 'Student cannot read private item keys');
reset role;
select pg_temp.logout();
set local role anon;
select pg_temp.ok(pg_temp.sv(pg_temp.items(pg_temp.q('q1'))) = '42501', 'anon cannot save v3');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(gen_random_uuid(), ''q1'', 1::smallint, ''{}''::jsonb)')) = '42501', 'anon cannot submit items');
select pg_temp.ok(pg_temp.state('select public.finalize_practice_attempt(gen_random_uuid())') = '42501', 'anon cannot finalize');
select pg_temp.ok(pg_temp.state('select * from public.practice_item_responses') = '42501', 'anon cannot read item responses');
select pg_temp.ok(pg_temp.state('select * from public.practice_item_schedules') = '42501', 'anon cannot read schedules');
reset role;
-- Teacher cannot read private keys by SELECT either; direct v3 content published without keys is refused.
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state('select * from private.practice_item_keys') = '42501', 'Teacher cannot SELECT private item keys');
reset role;
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_activities(slug, title, skill, estimated_minutes, content, publication_status, published_at)
  values ('pi-direct', 'direct', 'GRAMMAR', 5, %L::jsonb, 'PUBLISHED', now())$q$, pg_temp.items(pg_temp.q('q1')))) = '23514', 'v3 content cannot be published without private item keys');

-- 2. Student flow: rounds, feedback, skip, finalize -------------------------------------------------------------
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select count(*) = 0 from public.practice_item_responses), 'no responses yet');
insert into ids select 'att', (public.start_practice_attempt(pg_temp.id('obj'), gen_random_uuid())).id;
select pg_temp.ok(not exists (select 1 from public.practice_activities a where a.id = pg_temp.id('obj') and a.content::text ~ '(optionIds|accepted|"value": true|answerKey|Depois de to)'),
  'student content has no key and no explanations');
select pg_temp.ok(pg_temp.msg(format('select public.submit_practice_item(%L, ''zz'', 1::smallint, ''{"optionId":"a"}'')', pg_temp.id('att'))) like '23514:%', 'unknown item rejected');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 3::smallint, ''{"optionId":"a"}'')', pg_temp.id('att'))) = '23514', 'round 3 rejected');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"optionId":"a"}'', ''MID'')', pg_temp.id('att'))) = '23514', 'invalid confidence rejected');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"optionId":"zz"}'')', pg_temp.id('att'))) = '23514', 'unknown option rejected');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"skip":true}'')', pg_temp.id('att'))) = '23514', 'skip is not allowed in round 1');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 2::smallint, ''{"optionId":"a"}'')', pg_temp.id('att'))) = '23514', 'round 2 before round 1 rejected');
-- q1 wrong with high confidence: verdict + explanations, never the key.
select pg_temp.ok((pg_temp.sub('att', 'q1', 1, '{"optionId":"b"}', 'HIGH') ->> 'evaluationStatus') = 'INCORRECT', 'q1 round 1 wrong -> INCORRECT');
select pg_temp.ok((select (r ->> 'correctAnswer') is null and r ->> 'feedback' = 'Revise o verbo.' and r ->> 'optionFeedback' = 'Depois de to usamos o verbo base.'
  and (r ->> 'canRetry')::boolean and (r ->> 'round')::int = 1 and r ->> 'itemId' = 'q1' from (select pg_temp.sub('att', 'q1', 1, '{"optionId":"a"}') r) x),
  'round 1: explanation, option feedback, canRetry; correctAnswer null; replay returns the stored row');
select pg_temp.ok((select count(*) = 1 and bool_and(correct_answer is null and confidence = 'HIGH' and response = '{"optionId":"b"}') from public.practice_item_responses where item_id = 'q1'),
  'round 1 stored once, no key stored, confidence kept');
select pg_temp.ok(not exists (select 1 from public.practice_item_responses where round = 1 and to_jsonb(practice_item_responses)::text ~ '"optionId": "a"' and item_id = 'q1' and response ->> 'optionId' = 'a'), 'replay did not overwrite');
-- Round 2: recovered; the key is returned now.
select pg_temp.ok((select r ->> 'evaluationStatus' = 'CORRECT' and r -> 'correctAnswer' = '{"optionId":"a"}'::jsonb and r ->> 'optionFeedback' = 'Correto: meet.' and not (r ->> 'canRetry')::boolean
  from (select pg_temp.sub('att', 'q1', 2, '{"optionId":"a"}') r) x), 'round 2 correct: recovered, key returned');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 2::smallint, ''{"skip":true}'')', pg_temp.id('att'))) = 'OK', 'round 2 replay (even with another body) is idempotent');
select pg_temp.ok((select evaluation_status = 'CORRECT' from public.practice_item_responses where item_id = 'q1' and round = 2), 'round 2 replay kept the stored row');
-- q2: multi wrong with LOW confidence, then skipped.
select pg_temp.ok((pg_temp.sub('att', 'q2', 1, '{"optionIds":["a"]}', 'LOW') ->> 'optionFeedback') = 'run é verbo.', 'CHOICE_MULTI option feedback of the selection');
select pg_temp.ok((select r ->> 'evaluationStatus' = 'SKIPPED' and r -> 'correctAnswer' = '{"optionIds":["a","c"]}'::jsonb from (select pg_temp.sub('att', 'q2', 2, '{"skip":true}') r) x), 'skip stores SKIPPED and returns the key');
-- q3 correct first try: no round 2, no key.
select pg_temp.ok((select r ->> 'evaluationStatus' = 'CORRECT' and r -> 'correctAnswer' = 'null'::jsonb and r ->> 'feedback' = 'Sim.' from (select pg_temp.sub('att', 'q3', 1, '{"value":true}', 'HIGH') r) x), 'q3 correct in round 1 hides the key');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q3'', 2::smallint, ''{"value":true}'')', pg_temp.id('att'))) = '23514', 'round 2 only after an INCORRECT round 1');
select pg_temp.ok((pg_temp.sub('att', 'q4', 1, '{"blanks":{"1":" AM "}}') ->> 'evaluationStatus') = 'CORRECT', 'q4 cloze correct (default feedback)');
-- finalize needs every first answer.
select pg_temp.ok(pg_temp.msg(format('select public.finalize_practice_attempt(%L)', pg_temp.id('att'))) like '23514:Every item needs a first answer%', 'finalize refused while q5 has no answer');
select pg_temp.ok((pg_temp.sub('att', 'q5', 1, '{"order":["w3","w2","w1"]}', 'HIGH') ->> 'evaluationStatus') = 'INCORRECT', 'q5 wrong order');
select pg_temp.ok((pg_temp.sub('att', 'q5', 2, '{"order":["w3","w2","w1"]}') ->> 'evaluationStatus') = 'INCORRECT', 'q5 still wrong in round 2 (missed)');
select pg_temp.ok((select correct_answer = '{"order":["w1","w2","w3"]}'::jsonb from public.practice_item_responses where item_id = 'q5' and round = 2), 'round 2 stores the key');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_attempt(%L, ''{"optionId":"a"}'')', pg_temp.id('att'))) = '23514', 'legacy submit refuses v3');
reset role;
create temp table inv as select
  (select count(*) from public.lesson_progress) lp, (select count(*) from public.assessment_attempts) aa, (select count(*) from public.skill_scores) ss;
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select r ->> 'score' = '2' and r ->> 'maxScore' = '5' and r ->> 'evaluationStatus' = 'INCORRECT'
  and r -> 'metrics' = '{"itemCount":5,"firstTryCorrect":2,"recovered":1,"missed":1,"skipped":1,"highConfidenceErrors":2,"pendingManual":0}'::jsonb
  from (select public.finalize_practice_attempt(pg_temp.id('att')) r) x), 'finalize: score, status and metrics');
select pg_temp.ok((select r ->> 'score' = '2' from (select public.finalize_practice_attempt(pg_temp.id('att')) r) x), 'finalize is idempotent');
select pg_temp.ok((select count(*) = 1 from public.practice_results where practice_attempt_id = pg_temp.id('att')), 'one result row');
select pg_temp.ok((select status = 'SUBMITTED' and submitted_at is not null from public.practice_attempts where id = pg_temp.id('att')), 'attempt SUBMITTED');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q3'', 1::smallint, ''{"value":false}'')', pg_temp.id('att'))) = 'OK', 'replay after finalize returns the stored row');
select pg_temp.ok((select response = '{"value":true}'::jsonb from public.practice_item_responses where item_id = 'q3'), 'stored row unchanged after finalize');
reset role;
select pg_temp.ok((select lp = (select count(*) from public.lesson_progress) and aa = (select count(*) from public.assessment_attempts)
  and ss = (select count(*) from public.skill_scores) from inv), 'v3 never writes lesson_progress, assessment_attempts or skill_scores');

-- 3. Access: other users, anon, subscription ----------------------------------------------------------------
select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok((select count(*) = 0 from public.practice_item_responses), 'S2 cannot read S1 item responses');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"optionId":"a"}'')', pg_temp.id('att'))) = '42501', 'S2 cannot submit into S1 attempt');
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_attempt(%L)', pg_temp.id('att'))) = '42501', 'S2 cannot finalize S1 attempt');
select pg_temp.ok(pg_temp.state('insert into public.practice_item_responses(practice_attempt_id,item_id,round,response,evaluation_status) values (gen_random_uuid(),''q1'',1,''{}'',''CORRECT'')') = '42501', 'no direct INSERT');
select pg_temp.ok(pg_temp.state('update public.practice_item_responses set evaluation_status = ''CORRECT''') = '42501', 'no direct UPDATE');
select pg_temp.ok(pg_temp.state('delete from public.practice_item_responses') = '42501', 'no direct DELETE');
reset role;
select pg_temp.login(3);
set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"optionId":"a"}'')', pg_temp.id('att'))) = '42501', 'outsider cannot submit');
reset role;
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"optionId":"a"}'')', pg_temp.id('att'))) = '42501', 'Teacher cannot submit student items');
select pg_temp.ok((select count(*) = 8 from public.practice_item_responses), 'assigned Teacher reads the attempt item responses (rounds included)');
reset role;
-- Subscription gate: S4 has no paid access.
insert into public.practice_attempts(id, user_id, practice_activity_id) values ('e1900000-0000-4000-8000-000000000004', pg_temp.u(6), pg_temp.id('obj'));
select pg_temp.login(6);
set local role authenticated;
select pg_temp.ok(pg_temp.msg('select public.submit_practice_item(''e1900000-0000-4000-8000-000000000004'', ''q1'', 1::smallint, ''{"optionId":"a"}'')') = '42501:active subscription required', 'subscription gate on submit_practice_item');
select pg_temp.ok(pg_temp.msg('select public.finalize_practice_attempt(''e1900000-0000-4000-8000-000000000004'')') = '42501:active subscription required', 'subscription gate on finalize');
reset role;

-- 4. Mixed attempt: manual items, finalize, per-item review ---------------------------------------------------
select pg_temp.login(1);
set local role authenticated;
insert into ids select 'mix', (public.start_practice_attempt(pg_temp.id('mixed'), gen_random_uuid())).id;
select pg_temp.ok((pg_temp.sub('mix', 'q1', 1, '{"optionId":"a"}', 'LOW') ->> 'evaluationStatus') = 'CORRECT', 'mixed q1 correct');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''w1'', 1::smallint, ''{"text":""}'')', pg_temp.id('mix'))) = '23514', 'WRITTEN empty rejected');
select pg_temp.ok((select r ->> 'evaluationStatus' = 'PENDING_MANUAL' and r -> 'correctAnswer' = 'null'::jsonb and not (r ->> 'canRetry')::boolean
  from (select pg_temp.sub('mix', 'w1', 1, '{"text":"I wake up early and I work from home."}') r) x), 'WRITTEN -> PENDING_MANUAL');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''w1'', 2::smallint, ''{"text":"again"}'')', pg_temp.id('mix'))) = '23514', 'manual items have no round 2');
select pg_temp.ok(pg_temp.state(format('select public.reserve_practice_audio(%L, ''audio/webm'', ''q1'')', pg_temp.id('mix'))) = '42501', 'audio cannot be reserved for a non-SPOKEN item');
insert into ids select 'media', public.reserve_practice_audio(pg_temp.id('mix'), 'audio/webm', 's1');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''s1'', 1::smallint, %L::jsonb)', pg_temp.id('mix'), jsonb_build_object('mediaId', pg_temp.id('media')))) = '23514', 'SPOKEN needs a validated upload');
select pg_temp.ok(pg_temp.msg(format('select public.finalize_practice_attempt(%L)', pg_temp.id('mix'))) like '23514:Every item needs a first answer%', 'finalize needs the SPOKEN answer too');
reset role;
update public.practice_response_media set upload_status = 'READY' where id = pg_temp.id('media');
select pg_temp.ok((select item_id = 's1' from public.practice_response_media where id = pg_temp.id('media')), 'media row carries the item id');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((pg_temp.sub('mix', 's1', 1, format('{"mediaId":"%s"}', pg_temp.id('media'))) ->> 'evaluationStatus') = 'PENDING_MANUAL', 'SPOKEN -> PENDING_MANUAL');
select pg_temp.ok((select r ->> 'score' = '1' and r ->> 'maxScore' = '1' and r ->> 'evaluationStatus' = 'PENDING_MANUAL'
  and (r -> 'metrics' ->> 'pendingManual') = '2' and (r -> 'metrics' ->> 'itemCount') = '3' and (r -> 'metrics' ->> 'firstTryCorrect') = '1'
  from (select public.finalize_practice_attempt(pg_temp.id('mix')) r) x), 'mixed finalize: objective score kept, PENDING_MANUAL');
reset role;
select pg_temp.ok((select upload_status = 'SUBMITTED' from public.practice_response_media where id = pg_temp.id('media')), 'media SUBMITTED');
select pg_temp.ok((select count(*) = 1 and bool_and(item_id = 'q1') from public.practice_item_schedules where last_attempt_id = pg_temp.id('mix')), 'manual items are never scheduled');
-- Review queue and per-item reviews.
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.ok((select count(*) = 2 from public.get_teacher_reviews() r where r ->> 'id' = pg_temp.id('mix')::text and r ->> 'itemId' in ('w1', 's1')), 'queue lists one row per manual item');
select pg_temp.ok((select r ->> 'responseType' = 'WRITTEN' and r ->> 'prompt' = 'Write two sentences' from public.get_teacher_reviews() r where r ->> 'itemId' = 'w1'), 'queue row carries the item prompt/type');
create function pg_temp.rv(item text, ratings text, fb text default 'Bom trabalho') returns text language sql as $$
  select pg_temp.state(format('select public.finalize_practice_review(%L, %L::jsonb, %L, ''v1'', %L)', pg_temp.id('mix'), ratings, fb, item));
$$;
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_review(%L, ''{}''::jsonb, ''x'')', pg_temp.id('mix'))) = '23514', 'legacy 4-arg review refuses v3');
select pg_temp.ok(pg_temp.rv('w1', '{"task_completion":"SOLID"}') = '23514', 'incomplete rubric rejected');
select pg_temp.ok(pg_temp.rv('q1', '{"task_completion":"SOLID","comprehensibility":"SOLID","language_accuracy":"SOLID","vocabulary_use":"SOLID"}') = '23514', 'objective item cannot be reviewed');
select pg_temp.ok(pg_temp.rv('nope', '{}') = '23514', 'unknown item cannot be reviewed');
select pg_temp.ok(pg_temp.rv('w1', '{"task_completion":"SOLID","comprehensibility":"STRONG","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID"}') = 'OK', 'WRITTEN item reviewed');
insert into ids select 'rv_w1', id from public.practice_manual_reviews where practice_attempt_id = pg_temp.id('mix') and item_id = 'w1';
select pg_temp.ok(public.finalize_practice_review(pg_temp.id('mix'), '{"task_completion":"SOLID","comprehensibility":"STRONG","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID"}', 'Bom trabalho', 'v1', 'w1') = pg_temp.id('rv_w1'), 'identical review replay is idempotent');
select pg_temp.ok(pg_temp.rv('w1', '{"task_completion":"SOLID","comprehensibility":"STRONG","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID"}', 'Outro') = '23505', 'a different second review of the item is refused');
reset role;
select pg_temp.ok((select evaluation_status = 'PENDING_MANUAL' from public.practice_results where practice_attempt_id = pg_temp.id('mix')), 'result stays PENDING_MANUAL until every manual item is reviewed');
select pg_temp.login(5, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.rv('s1', '{}') = '42501', 'unrelated Teacher cannot review');
reset role;
select pg_temp.login(4, 'aal1');
set local role authenticated;
select pg_temp.ok(pg_temp.rv('s1', '{}') = '42501', 'Teacher aal1 cannot review');
reset role;
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.rv('s1', '{"task_completion":"SOLID","comprehensibility":"SOLID","fluency":"SOLID","language_accuracy":"SOLID","vocabulary_use":"SOLID","pronunciation_intelligibility":"SOLID"}') = 'OK', 'SPOKEN item reviewed (speaking dimensions)');
select pg_temp.ok((select count(*) = 0 from public.get_teacher_reviews()), 'queue empty after every item review');
reset role;
select pg_temp.ok((select evaluation_status = 'MANUAL_REVIEWED' and score = 1 and max_score = 1 from public.practice_results where practice_attempt_id = pg_temp.id('mix')), 'result MANUAL_REVIEWED, objective score kept');
select pg_temp.ok((select count(*) = 1 from public.notifications where event_key = pg_temp.id('mix')::text || ':PRACTICE_FEEDBACK_READY'), 'one feedback notification');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select count(*) = 2 from public.practice_manual_reviews where practice_attempt_id = pg_temp.id('mix')), 'Student reads both item reviews');
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok((select count(*) = 0 from public.practice_manual_reviews), 'other Student reads no review');
reset role;

-- 5. v2 normalized as item 'main' ---------------------------------------------------------------------------
select pg_temp.login(4, 'aal2');
set local role authenticated;
insert into ids values ('v2', public.teacher_practice_save(null, pg_temp.payload('{"version":2,"stimulus":{"type":"NONE"},"prompt":"Pick A","response":{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}}'),
  '{"optionId":"a"}', '{"correct":"Great","incorrect":"Nope"}'));
select public.teacher_practice_publish(pg_temp.id('v2'));
select public.teacher_practice_assign(pg_temp.id('v2'), array['e1400000-0000-4000-8000-000000000001']::uuid[]);
reset role;
select pg_temp.login(1);
set local role authenticated;
insert into ids select 'att2', (public.start_practice_attempt(pg_temp.id('v2'), gen_random_uuid())).id;
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q1'', 1::smallint, ''{"optionId":"a"}'')', pg_temp.id('att2'))) = '23514', 'v2 has the single item main only');
select pg_temp.ok((select r ->> 'evaluationStatus' = 'INCORRECT' and r ->> 'feedback' = 'Nope' and r -> 'correctAnswer' = 'null'::jsonb
  from (select pg_temp.sub('att2', 'main', 1, '{"optionId":"b"}') r) x), 'v2 main: wrong with v2 feedback, key hidden');
select pg_temp.ok((pg_temp.sub('att2', 'main', 2, '{"optionId":"a"}') ->> 'evaluationStatus') = 'CORRECT', 'v2 main: recovered in round 2');
select pg_temp.ok((select r ->> 'score' = '0' and r ->> 'maxScore' = '1' and r -> 'metrics' ->> 'recovered' = '1' from (select public.finalize_practice_attempt(pg_temp.id('att2')) r) x), 'v2 finalize through the item pipeline');
reset role;
select pg_temp.ok((select box = 1 and last_result = 'INCORRECT' from public.practice_item_schedules where practice_activity_id = pg_temp.id('v2') and item_id = 'main'), 'v2 main scheduled');

-- 6. Immutability, duplicate, assets ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.state(format('update private.practice_item_keys set answer_key = ''{"optionId":"b"}'' where practice_activity_id = %L and item_id = ''q1''', pg_temp.id('obj'))) = '23514', 'item keys immutable once attempts exist');
select pg_temp.ok(pg_temp.state(format('delete from private.practice_item_keys where practice_activity_id = %L', pg_temp.id('obj'))) = '23514', 'item keys cannot be deleted once attempts exist');
select pg_temp.ok(pg_temp.state(format('update public.practice_activities set content = jsonb_set(content, ''{objective}'', ''"x"'') where id = %L', pg_temp.id('obj'))) = '23514', 'v3 content immutable once attempts exist');
select pg_temp.ok(pg_temp.state(format('update public.practice_item_responses set evaluation_status = ''CORRECT'' where practice_attempt_id = %L', pg_temp.id('att'))) = '55000', 'item responses are immutable');
select pg_temp.ok(pg_temp.state(format('delete from public.practice_item_responses where practice_attempt_id = %L', pg_temp.id('att'))) = '55000', 'item responses cannot be deleted');
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_item_responses(practice_attempt_id,item_id,round,response,evaluation_status,correct_answer)
  values (%L,'zz',1,'{}','CORRECT','{"a":1}')$q$, pg_temp.id('att'))) = '23514', 'a round 1 row can never store the key');
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_unpublish(%L)', pg_temp.id('obj'))) = 'OK', 'owner unpublishes');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_save_v3(%L, ''{"title":"Edit"}''::jsonb, null)', pg_temp.id('obj'))) = '23514', 'v3 practice with attempts is not editable');
insert into ids values ('dup', public.teacher_practice_duplicate(pg_temp.id('obj')));
reset role;
select pg_temp.ok((select count(*) = 5 from private.practice_item_keys where practice_activity_id = pg_temp.id('dup')), 'duplicate copies the item keys');
select pg_temp.login(4, 'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_save_v3(%L, jsonb_build_object(''title'', ''Copy edited''), null)', pg_temp.id('dup'))) = 'OK', 'the duplicate is editable (metadata only, stored keys reused)');
reset role;
-- Pronunciation practice with a READY audio asset: publish, student authorization, duplicate remaps the asset.
select pg_temp.login(4, 'aal2');
set local role authenticated;
insert into ids values ('pron', public.teacher_practice_save_v3(null, pg_temp.payload(
  pg_temp.pron('{"type":"AUDIO","assetId":"e1500000-0000-4000-8000-000000000001","transcript":"Nice to meet you"}', '{"type":"SPOKEN"}'), 'PRONUNCIATION'), '{}'));
reset role;
insert into public.practice_activity_assets(id, practice_activity_id, asset_type, storage_path, upload_status, metadata)
  values ('e1500000-0000-4000-8000-000000000001', pg_temp.id('pron'), 'AUDIO', 'seed/pi-model.mp3', 'READY', '{"mime_type":"audio/mpeg"}');
select pg_temp.login(4, 'aal2');
set local role authenticated;
select public.teacher_practice_publish(pg_temp.id('pron'));
select public.teacher_practice_assign(pg_temp.id('pron'), array['e1400000-0000-4000-8000-000000000001']::uuid[]);
insert into ids values ('pron_dup', public.teacher_practice_duplicate(pg_temp.id('pron')));
reset role;
select pg_temp.ok((select content #>> '{items,0,stimulus,assetId}' <> 'e1500000-0000-4000-8000-000000000001'
  and exists (select 1 from public.practice_activity_assets s where s.id::text = content #>> '{items,0,stimulus,assetId}' and s.practice_activity_id = pg_temp.id('pron_dup'))
  from public.practice_activities where id = pg_temp.id('pron_dup')), 'duplicate remaps the item stimulus asset');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(public.authorize_practice_asset('e1500000-0000-4000-8000-000000000001'), 'assigned Student may sign a v3 item stimulus asset');
reset role;
select pg_temp.login(3);
set local role authenticated;
select pg_temp.ok(not public.authorize_practice_asset('e1500000-0000-4000-8000-000000000001'), 'outsider may not sign it');
reset role;
select pg_temp.logout();
rollback;
