-- Stage 13 / Phases 1-3 (practice-10): spaced review schedule, REVIEW attempts and due reviews.
-- Plain psql, transactional: everything rolls back. Allow AND deny cases per rule.
--   Users (prefix e2000000): 01 STUDENT S1 (K1) | 02 STUDENT S2 (K1) | 03 TEACHER T1 (K1) | 04 STUDENT S4 (K1, no paid access)
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('e2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if not coalesce(value, false) then raise exception 'practice_review_schedule: %', message; end if; end $$;
create function pg_temp.login(n integer, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.u(n)::text, true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
-- SQLSTATE:message|hint
create function pg_temp.attempt(q text) returns text language plpgsql as $$
declare h text;
begin execute q; return 'OK';
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  return sqlstate || ':' || sqlerrm || '|' || coalesce(h, '');
end $$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k = $1 $$;
-- Expected due date: local (America/Recife) midnight of today plus n days.
create function pg_temp.day(n integer) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'America/Recife') + make_interval(days => n)) at time zone 'America/Recife';
$$;

insert into auth.users(id, email) select pg_temp.u(n), 'prs-' || n || '@example.test' from generate_series(1, 4) n;
insert into public.user_roles(user_id, role) select pg_temp.u(n), case when n = 3 then 'TEACHER' else 'STUDENT' end from generate_series(1, 4) n;
insert into public.profiles(user_id, display_name) select pg_temp.u(n), 'PRS User ' || n from generate_series(1, 4) n
  on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.teachers(id, user_id) values ('e2100000-0000-4000-8000-000000000003', pg_temp.u(3));
insert into public.courses(id, slug, title, active, publication_status, published_at)
  values ('e2200000-0000-4000-8000-000000000001', 'prs-course', 'PRS Course', true, 'PUBLISHED', now());
insert into public.cohorts(id, course_id, name, code, status, starts_at)
  values ('e2400000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001', 'PRS K1', 'prs-k1', 'ACTIVE', now() - interval '1 day');
insert into public.cohort_teachers(cohort_id, teacher_id) values ('e2400000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000003');
insert into public.enrollments(id, user_id, course_id, status) values
  ('e2300000-0000-4000-8000-000000000001', pg_temp.u(1), 'e2200000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('e2300000-0000-4000-8000-000000000002', pg_temp.u(2), 'e2200000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('e2300000-0000-4000-8000-000000000004', pg_temp.u(4), 'e2200000-0000-4000-8000-000000000001', 'ACTIVE');
insert into public.cohort_memberships(cohort_id, user_id, enrollment_id) values
  ('e2400000-0000-4000-8000-000000000001', pg_temp.u(1), 'e2300000-0000-4000-8000-000000000001'),
  ('e2400000-0000-4000-8000-000000000001', pg_temp.u(2), 'e2300000-0000-4000-8000-000000000002'),
  ('e2400000-0000-4000-8000-000000000001', pg_temp.u(4), 'e2300000-0000-4000-8000-000000000004');
insert into public.complimentary_access_grants(user_id, reason, note) select pg_temp.u(n), 'ADMIN_GRANT', 'fixture' from generate_series(1, 2) n;

create function pg_temp.q(n text) returns text language sql immutable as $$
  select case n
    when 'q1' then '{"id":"q1","prompt":"Pick the greeting","stimulus":{"type":"NONE"},"response":{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"Nice to meet you"},{"id":"b","label":"Nice to meeting you"}]}}'
    when 'q2' then '{"id":"q2","prompt":"Pick all verbs","stimulus":{"type":"NONE"},"response":{"type":"CHOICE_MULTI","options":[{"id":"a","label":"run"},{"id":"b","label":"table"},{"id":"c","label":"eat"}]}}'
    when 'q3' then '{"id":"q3","prompt":"True or false","stimulus":{"type":"NONE"},"response":{"type":"TRUE_FALSE","statement":"She works here."}}'
    when 'q4' then '{"id":"q4","prompt":"Complete","stimulus":{"type":"NONE"},"response":{"type":"CLOZE","text":"I {{1}} a student."}}'
    when 'q5' then '{"id":"q5","prompt":"Order the words","stimulus":{"type":"NONE"},"response":{"type":"ORDERING","items":[{"id":"w1","label":"I"},{"id":"w2","label":"am"},{"id":"w3","label":"here"}]}}'
    when 'w1' then '{"id":"w1","prompt":"Write two sentences","stimulus":{"type":"NONE"},"response":{"type":"WRITTEN"}}'
  end;
$$;
create function pg_temp.keys() returns jsonb language sql as $$
  select '{"q1":{"answerKey":{"optionId":"a"}},"q2":{"answerKey":{"optionIds":["a","c"]}},"q3":{"answerKey":{"value":true}},
           "q4":{"answerKey":{"blanks":[{"id":"1","accepted":["am"]}]}},"q5":{"answerKey":{"order":["w1","w2","w3"]}},"w1":{}}'::jsonb;
$$;
create function pg_temp.mk(k text, variadic parts text[]) returns void language plpgsql as $$
declare pid uuid; content jsonb; keys jsonb;
begin
  content := jsonb_build_object('version', 3, 'objective', 'Revisar', 'askConfidence', true, 'items', (select jsonb_agg(p::jsonb) from unnest(parts) p));
  keys := (select jsonb_object_agg(e.key, e.value) from jsonb_each(pg_temp.keys()) e where e.key in (select i ->> 'id' from jsonb_array_elements(content -> 'items') i));
  pid := public.teacher_practice_save_v3(null, jsonb_build_object('title', 'PRS ' || k, 'skill', 'GRAMMAR', 'estimated_minutes', 5,
    'course_id', 'e2200000-0000-4000-8000-000000000001', 'content', content), keys);
  insert into ids values (k, pid);
  perform public.teacher_practice_publish(pid);
  perform public.teacher_practice_assign(pid, array['e2400000-0000-4000-8000-000000000001']::uuid[]);
end $$;
-- Start a FULL attempt, answer one single-item practice in round 1 and finalize.
create function pg_temp.cycle(act text, item text, resp text, conf text default null) returns jsonb language plpgsql as $$
declare att uuid := (public.start_practice_attempt(pg_temp.id(act), gen_random_uuid())).id;
begin
  perform public.submit_practice_item(att, item, 1::smallint, resp::jsonb, conf);
  return public.finalize_practice_attempt(att);
end $$;
create function pg_temp.sched(act text, item text) returns public.practice_item_schedules language sql as $$
  select s from public.practice_item_schedules s where s.user_id = pg_temp.u(1) and s.practice_activity_id = pg_temp.id(act) and s.item_id = item;
$$;
grant execute on function pg_temp.sched(text, text) to authenticated;

select pg_temp.login(3, 'aal2');
set local role authenticated;
select pg_temp.mk('one', pg_temp.q('q3'));
select pg_temp.mk('obj', pg_temp.q('q1'), pg_temp.q('q2'), pg_temp.q('q3'), pg_temp.q('q4'), pg_temp.q('q5'));
select pg_temp.mk('mixed', pg_temp.q('q3'), pg_temp.q('w1'));
select pg_temp.mk('gone', pg_temp.q('q3'));
select pg_temp.mk('hidden', pg_temp.q('q3'));
reset role;

-- 1. Box progression to graduation (first-try correct) ---------------------------------------------------------
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select count(*) = 0 from public.practice_item_schedules), 'no schedule before the first finalize');
select pg_temp.ok((pg_temp.cycle('one', 'q3', '{"value":true}') ->> 'evaluationStatus') = 'CORRECT', 'cycle 1 correct');
select pg_temp.ok((select box = 2 and due_at = pg_temp.day(3) and last_result = 'CORRECT' and not high_confidence_error from (select pg_temp.sched('one', 'q3') s) x, lateral (select (s).*) t),
  'first correct (no history): box 2, due in 3 days at local midnight');
select pg_temp.cycle('one', 'q3', '{"value":true}');
select pg_temp.ok((select box = 3 and due_at = pg_temp.day(7) from (select (pg_temp.sched('one', 'q3')).*) t), 'second correct: box 3, +7 days');
select pg_temp.cycle('one', 'q3', '{"value":true}');
select pg_temp.ok((select box = 4 and due_at = pg_temp.day(14) from (select (pg_temp.sched('one', 'q3')).*) t), 'third correct: box 4, +14 days');
select pg_temp.cycle('one', 'q3', '{"value":true}');
select pg_temp.ok((select box = 5 and due_at = pg_temp.day(30) from (select (pg_temp.sched('one', 'q3')).*) t), 'fourth correct: box 5, +30 days');
select pg_temp.cycle('one', 'q3', '{"value":true}');
select pg_temp.ok((select box = 5 and due_at is null from (select (pg_temp.sched('one', 'q3')).*) t), 'fifth correct: graduated (due_at null, box 5)');
select pg_temp.cycle('one', 'q3', '{"value":true}');
select pg_temp.ok((select box = 5 and due_at is null from (select (pg_temp.sched('one', 'q3')).*) t), 'graduated stays graduated');
-- A wrong answer from the graduated state restarts at box 1; high confidence is flagged.
select pg_temp.ok((pg_temp.cycle('one', 'q3', '{"value":false}', 'HIGH') ->> 'evaluationStatus') = 'INCORRECT', 'wrong answer');
select pg_temp.ok((select box = 1 and due_at = pg_temp.day(1) and last_result = 'INCORRECT' and high_confidence_error from (select (pg_temp.sched('one', 'q3')).*) t),
  'wrong: box 1, next local day, high-confidence error flagged');
select pg_temp.cycle('one', 'q3', '{"value":false}', 'LOW');
select pg_temp.ok((select box = 1 and due_at = pg_temp.day(1) and not high_confidence_error from (select (pg_temp.sched('one', 'q3')).*) t), 'wrong with LOW confidence: not flagged');
select pg_temp.cycle('one', 'q3', '{"value":true}', 'HIGH');
select pg_temp.ok((select box = 2 and due_at = pg_temp.day(3) and not high_confidence_error from (select (pg_temp.sched('one', 'q3')).*) t), 'correct after a miss: box 2, flag cleared');

-- 2. Recovered items and manual items ----------------------------------------------------------------------------
-- Recovered in round 2 is still a miss for the schedule; manual items are never scheduled.
insert into ids select 'att_gone', (public.start_practice_attempt(pg_temp.id('gone'), gen_random_uuid())).id;
select public.submit_practice_item(pg_temp.id('att_gone'), 'q3', 1::smallint, '{"value":false}', 'HIGH');
select public.submit_practice_item(pg_temp.id('att_gone'), 'q3', 2::smallint, '{"value":true}');
select pg_temp.ok((select (r -> 'metrics' ->> 'recovered') = '1' from (select public.finalize_practice_attempt(pg_temp.id('att_gone')) r) x), 'recovered counted in metrics');
select pg_temp.ok((select box = 1 and due_at = pg_temp.day(1) and last_result = 'INCORRECT' and high_confidence_error from (select (pg_temp.sched('gone', 'q3')).*) t), 'recovered item is scheduled as a miss');
insert into ids select 'att_mixed', (public.start_practice_attempt(pg_temp.id('mixed'), gen_random_uuid())).id;
select public.submit_practice_item(pg_temp.id('att_mixed'), 'q3', 1::smallint, '{"value":true}');
select public.submit_practice_item(pg_temp.id('att_mixed'), 'w1', 1::smallint, '{"text":"I work every day."}');
select public.finalize_practice_attempt(pg_temp.id('att_mixed'));
select pg_temp.ok((select count(*) = 1 and bool_and(item_id = 'q3') from public.practice_item_schedules where practice_activity_id = pg_temp.id('mixed')), 'WRITTEN item is not scheduled');
reset role;

-- 3. REVIEW attempt ordering, resume, due list ---------------------------------------------------------------------
select pg_temp.login(1);
set local role authenticated;
insert into ids select 'att_obj', (public.start_practice_attempt(pg_temp.id('obj'), gen_random_uuid())).id;
select public.submit_practice_item(pg_temp.id('att_obj'), 'q1', 1::smallint, '{"optionId":"b"}', 'HIGH');
select public.submit_practice_item(pg_temp.id('att_obj'), 'q2', 1::smallint, '{"optionIds":["b"]}', 'LOW');
select public.submit_practice_item(pg_temp.id('att_obj'), 'q3', 1::smallint, '{"value":true}', 'HIGH');
select public.submit_practice_item(pg_temp.id('att_obj'), 'q4', 1::smallint, '{"blanks":{"1":"is"}}', 'HIGH');
select public.submit_practice_item(pg_temp.id('att_obj'), 'q5', 1::smallint, '{"order":["w1","w2","w3"]}');
select public.finalize_practice_attempt(pg_temp.id('att_obj'));
select pg_temp.ok((select count(*) = 5 from public.practice_item_schedules where practice_activity_id = pg_temp.id('obj')), 'five objective items scheduled');
select pg_temp.ok((select count(*) = 0 from public.student_due_reviews() where practice_activity_id = pg_temp.id('obj')), 'nothing due right after finalize (due dates are in the future)');
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('obj'))) = 'YP002:Nothing is due for review|PRACTICE_NOTHING_DUE', 'nothing due raises YP002 / PRACTICE_NOTHING_DUE');
select pg_temp.ok((select count(*) = 0 from public.practice_attempts where attempt_kind = 'REVIEW'), 'the refused start left no attempt');
reset role;
-- Make q1 (HIGH, 3 days late), q4 (HIGH, 2 days late) and q2 (LOW, 1 day late) due; q3 stays in the future; q5 graduates.
update public.practice_item_schedules set due_at = now() - interval '3 days' where practice_activity_id = pg_temp.id('obj') and item_id = 'q1' and user_id = pg_temp.u(1);
update public.practice_item_schedules set due_at = now() - interval '2 days' where practice_activity_id = pg_temp.id('obj') and item_id = 'q4' and user_id = pg_temp.u(1);
update public.practice_item_schedules set due_at = now() - interval '1 day' where practice_activity_id = pg_temp.id('obj') and item_id = 'q2' and user_id = pg_temp.u(1);
update public.practice_item_schedules set box = 5, due_at = null where practice_activity_id = pg_temp.id('obj') and item_id = 'q5' and user_id = pg_temp.u(1);
select pg_temp.ok((select high_confidence_error from public.practice_item_schedules where practice_activity_id = pg_temp.id('obj') and item_id = 'q4' and user_id = pg_temp.u(1))
  and not (select high_confidence_error from public.practice_item_schedules where practice_activity_id = pg_temp.id('obj') and item_id = 'q2' and user_id = pg_temp.u(1)), 'confidence flags as answered');

select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select due_count = 3 and high_confidence_errors = 2 and oldest_due_at < now() - interval '2 days 23 hours' from public.student_due_reviews() where practice_activity_id = pg_temp.id('obj')),
  'due reviews: 3 due, 2 high-confidence errors, oldest due reported');
select pg_temp.ok((select count(*) = 1 from public.student_due_reviews()), 'only activities with something due are listed');
insert into ids select 'rev', (public.start_practice_review(pg_temp.id('obj'), gen_random_uuid())).id;
select pg_temp.ok((select attempt_kind = 'REVIEW' and status = 'IN_PROGRESS' and item_ids = array['q1','q4','q2'] from public.practice_attempts where id = pg_temp.id('rev')),
  'REVIEW holds only the due items: high-confidence errors first, then oldest due');
select pg_temp.ok((select (public.start_practice_review(pg_temp.id('obj'), gen_random_uuid())).id = pg_temp.id('rev')), 'a second start within 24h resumes the same REVIEW attempt');
select pg_temp.ok((select count(*) = 1 from public.practice_attempts where attempt_kind = 'REVIEW' and status = 'IN_PROGRESS'), 'one open REVIEW attempt');
select pg_temp.ok((select count(*) = 1 from public.practice_attempts where attempt_kind = 'FULL' and practice_activity_id = pg_temp.id('obj') and status = 'SUBMITTED'), 'the FULL attempt is untouched');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q3'', 1::smallint, ''{"value":true}'')', pg_temp.id('rev'))) = '23514', 'a REVIEW attempt rejects items that are not due');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L, ''q5'', 1::smallint, ''{"order":["w1","w2","w3"]}'')', pg_temp.id('rev'))) = '23514', 'a graduated item is not part of the REVIEW');
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_attempt(%L)', pg_temp.id('rev'))) = '23514', 'REVIEW finalize needs every due item answered');
reset role;
-- Stale REVIEW (older than 24h) is abandoned and replaced.
update public.practice_attempts set last_activity_at = now() - interval '25 hours' where id = pg_temp.id('rev');
select pg_temp.login(1);
set local role authenticated;
insert into ids select 'rev2', (public.start_practice_review(pg_temp.id('obj'), gen_random_uuid())).id;
select pg_temp.ok(pg_temp.id('rev2') <> pg_temp.id('rev') and (select status = 'ABANDONED' from public.practice_attempts where id = pg_temp.id('rev')), 'stale REVIEW abandoned, a new one starts');
select pg_temp.ok((select item_ids = array['q1','q4','q2'] from public.practice_attempts where id = pg_temp.id('rev2')), 'new REVIEW has the same due items');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L, %L)', pg_temp.id('obj'), (select idempotency_key from public.practice_attempts where id = pg_temp.id('att_obj')))) <> 'OK',
  'an idempotency key of a FULL attempt cannot start a REVIEW');
select pg_temp.ok((select (public.start_practice_review(pg_temp.id('obj'), (select idempotency_key from public.practice_attempts where id = pg_temp.id('rev2')))).id = pg_temp.id('rev2')), 'idempotent replay of the REVIEW key');
-- Answer: q1 right, q4 wrong again (HIGH), q2 right.
select public.submit_practice_item(pg_temp.id('rev2'), 'q1', 1::smallint, '{"optionId":"a"}', 'LOW');
select public.submit_practice_item(pg_temp.id('rev2'), 'q4', 1::smallint, '{"blanks":{"1":"is"}}', 'HIGH');
select public.submit_practice_item(pg_temp.id('rev2'), 'q2', 1::smallint, '{"optionIds":["c","a"]}');
select pg_temp.ok((select r ->> 'score' = '2' and r ->> 'maxScore' = '3' and r ->> 'evaluationStatus' = 'INCORRECT' and (r -> 'metrics' ->> 'itemCount') = '3'
  and (r -> 'metrics' ->> 'highConfidenceErrors') = '1' from (select public.finalize_practice_attempt(pg_temp.id('rev2')) r) x), 'REVIEW finalize scores only its items');
select pg_temp.ok((select box = 2 and due_at = pg_temp.day(3) and not high_confidence_error from (select (pg_temp.sched('obj', 'q1')).*) t), 'review: correct item moves to box 2');
select pg_temp.ok((select box = 1 and due_at = pg_temp.day(1) and high_confidence_error from (select (pg_temp.sched('obj', 'q4')).*) t), 'review: missed item back to box 1, flagged');
select pg_temp.ok((select box = 2 and due_at = pg_temp.day(3) from (select (pg_temp.sched('obj', 'q2')).*) t), 'review: second correct item moves to box 2');
select pg_temp.ok((select box = 5 and due_at is null from (select (pg_temp.sched('obj', 'q5')).*) t), 'items outside the REVIEW are untouched');
select pg_temp.ok((select count(*) = 0 from public.student_due_reviews() where practice_activity_id = pg_temp.id('obj')), 'nothing due after the review');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('obj'))) = 'YP002', 'a finished review leaves nothing due (YP002)');
reset role;

-- 4. Scope: own rows, reachable activities, subscription ----------------------------------------------------------
update public.practice_item_schedules set due_at = now() - interval '1 hour' where practice_activity_id in (pg_temp.id('gone'), pg_temp.id('one')) and user_id = pg_temp.u(1);
insert into public.practice_item_schedules(user_id, practice_activity_id, item_id, box, due_at, last_result)
  values (pg_temp.u(1), pg_temp.id('hidden'), 'q3', 1, now() - interval '1 hour', 'INCORRECT');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select count(*) = 3 from public.student_due_reviews()), 'three activities due (one, gone, hidden)');
reset role;
delete from public.cohort_practice_assignments where practice_activity_id = pg_temp.id('gone');
update public.practice_activities set publication_status = 'DRAFT', published_at = null where id = pg_temp.id('hidden');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select count(*) = 1 and bool_and(practice_activity_id = pg_temp.id('one')) from public.student_due_reviews()), 'unassigned and unpublished activities are not listed');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('gone'))) = '42501', 'cannot review an activity that is no longer visible (assignment removed)');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('hidden'))) <> 'OK', 'cannot review an unpublished activity');
select pg_temp.ok((select count(*) >= 5 from public.practice_item_schedules), 'S1 reads its own schedule rows');
select pg_temp.ok(pg_temp.state('insert into public.practice_item_schedules(user_id,practice_activity_id,item_id,box,last_result) values (auth.uid(), gen_random_uuid(), ''q1'', 1, ''CORRECT'')') = '42501', 'no direct INSERT');
select pg_temp.ok(pg_temp.state('update public.practice_item_schedules set box = 5') = '42501', 'no direct UPDATE');
select pg_temp.ok(pg_temp.state('delete from public.practice_item_schedules') = '42501', 'no direct DELETE');
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok((select count(*) = 0 from public.practice_item_schedules), 'S2 reads none of S1 schedules');
select pg_temp.ok((select count(*) = 0 from public.student_due_reviews()), 'S2 has nothing due');
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('one'))) = 'YP002:Nothing is due for review|PRACTICE_NOTHING_DUE', 'S2 cannot start S1 review (nothing due for S2)');
reset role;
select pg_temp.login(3, 'aal2');
set local role authenticated;
select pg_temp.ok((select count(*) = 0 from public.practice_item_schedules), 'Teacher reads no student schedules');
reset role;
select pg_temp.login(4);
set local role authenticated;
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('one'))) = '42501:active subscription required|', 'subscription gate on start_practice_review');
reset role;
select pg_temp.logout();
set local role anon;
select pg_temp.ok(pg_temp.state('select * from public.practice_item_schedules') = '42501', 'anon cannot read schedules');
select pg_temp.ok(pg_temp.state('select * from public.student_due_reviews()') = '42501', 'anon cannot list due reviews');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_review(%L, gen_random_uuid())', pg_temp.id('one'))) = '42501', 'anon cannot start a review');
reset role;
select pg_temp.ok(not has_function_privilege('authenticated', 'private.practice_items(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.practice_grade_response(jsonb,jsonb,jsonb)', 'EXECUTE')
  and not has_table_privilege('authenticated', 'private.practice_item_keys', 'SELECT'), 'private helpers and keys are closed to clients');
rollback;
