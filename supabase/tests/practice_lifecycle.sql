-- Stage 13 / Phase 0 (practice-10-phase-0): practice attempt lifecycle and lesson gating.
-- Plain psql, transactional: everything rolls back. Allow AND deny cases per rule.
--   Users (prefix d1000000): 01 STUDENT S1 (cohort K1) | 02 STUDENT S2 (cohort K2) | 03 STUDENT S3 (no enrollment)
--   | 04 STUDENT S4 (cohort K1, subscription) | 05 TEACHER (assigns practices)
--   Course C: module M1 (L1 L2 L3), module M2 (L4 L5), module M3 (no lessons).
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('d1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if not coalesce(value, false) then raise exception 'practice_lifecycle: %', message; end if; end $$;
create function pg_temp.login(n integer, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.id(n)::text, true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(n), 'aal', aal)::text, true);
$$;
-- SQLSTATE raised by the statement, or 'OK'.
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
-- SQLSTATE:message[|hint] raised by the statement, or 'OK'.
create function pg_temp.attempt(q text) returns text language plpgsql as $$
declare h text;
begin execute q; return 'OK';
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  return sqlstate || ':' || sqlerrm || '|' || coalesce(h, '');
end $$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;

-- Fixtures ----------------------------------------------------------------------------------------------------
insert into auth.users(id, email) select pg_temp.id(n), 'pl-' || n || '@example.test' from generate_series(1, 5) n;
insert into public.user_roles(user_id, role)
select pg_temp.id(n), case when n = 5 then 'TEACHER' else 'STUDENT' end from generate_series(1, 5) n;
insert into public.teachers(id, user_id) values (pg_temp.id(50), pg_temp.id(5));
insert into public.courses(id, slug, title, active, publication_status, published_at)
  values (pg_temp.id(100), 'pl-course', 'PL course', true, 'PUBLISHED', now());
insert into public.modules(id, course_id, position, title, publication_status, published_at) values
  (pg_temp.id(201), pg_temp.id(100), 1, 'PL module 1', 'PUBLISHED', now()),
  (pg_temp.id(202), pg_temp.id(100), 2, 'PL module 2', 'PUBLISHED', now()),
  (pg_temp.id(203), pg_temp.id(100), 3, 'PL module 3 (empty)', 'PUBLISHED', now());
-- L1..L3 in M1, L4..L5 in M2.
insert into public.lessons(id, module_id, position, slug, title)
select pg_temp.id(300 + n), pg_temp.id(case when n <= 3 then 201 else 202 end),
       case when n <= 3 then n else n - 3 end, 'pl-lesson-' || n, 'PL lesson ' || n
from generate_series(1, 5) n;
insert into public.lesson_assets(id, lesson_id, asset_type, position, content, publication_status, published_at)
select pg_temp.id(400 + n), pg_temp.id(300 + n), 'TEXT', 1, '{"title":"PL","body":"Practice this lesson"}', 'PUBLISHED', now()
from generate_series(1, 5) n;
update public.lessons set publication_status = 'PUBLISHED', published_at = now() where module_id in (pg_temp.id(201), pg_temp.id(202));
insert into public.cohorts(id, course_id, name, code, status, starts_at) values
  (pg_temp.id(601), pg_temp.id(100), 'PL K1', 'pl-k1', 'ACTIVE', now() - interval '1 day'),
  (pg_temp.id(602), pg_temp.id(100), 'PL K2', 'pl-k2', 'ACTIVE', now() - interval '1 day');
insert into public.cohort_teachers(cohort_id, teacher_id) values (pg_temp.id(601), pg_temp.id(50)), (pg_temp.id(602), pg_temp.id(50));
insert into public.enrollments(id, user_id, course_id, status) values
  (pg_temp.id(501), pg_temp.id(1), pg_temp.id(100), 'ACTIVE'),
  (pg_temp.id(502), pg_temp.id(2), pg_temp.id(100), 'ACTIVE'),
  (pg_temp.id(504), pg_temp.id(4), pg_temp.id(100), 'ACTIVE');
insert into public.cohort_memberships(cohort_id, user_id, enrollment_id) values
  (pg_temp.id(601), pg_temp.id(1), pg_temp.id(501)),
  (pg_temp.id(602), pg_temp.id(2), pg_temp.id(502)),
  (pg_temp.id(601), pg_temp.id(4), pg_temp.id(504));
-- Paid access is fail-closed: grants for S1..S3, a real subscription for S4 (suspended later).
insert into public.complimentary_access_grants(user_id, reason, note)
  select pg_temp.id(n), 'ADMIN_GRANT', 'fixture' from generate_series(1, 3) n;
insert into public.subscriptions(user_id, plan_id, provider, provider_subscription_id, status)
  values (pg_temp.id(4), '10000000-0000-0000-0000-000000000003', 'test', 'pl-sub-4', 'ACTIVE');

-- Practice builder: copies a seeded deterministic activity (content + answer key) and publishes it.
create function pg_temp.mk(n integer, lesson uuid, module uuid, aud text default 'COURSE') returns void language plpgsql as $$
begin
  insert into public.practice_activities(id, slug, title, skill, estimated_minutes, content, active,
    related_lesson_id, related_module_id, course_id, audience, created_by_teacher_id)
  select pg_temp.id(n), 'pl-practice-' || n, 'PL practice ' || n, skill, estimated_minutes, content, true,
         lesson, module, case when aud = 'ASSIGNED' then pg_temp.id(100) end, aud,
         case when aud = 'ASSIGNED' then pg_temp.id(50) end
  from public.practice_activities where id = '83000000-0000-4000-8000-000000000001';
  insert into private.practice_answer_keys(practice_activity_id, answer_key, feedback)
  select pg_temp.id(n), answer_key, feedback from private.practice_answer_keys
  where practice_activity_id = '83000000-0000-4000-8000-000000000001';
  update public.practice_activities set publication_status = 'PUBLISHED', published_at = now() where id = pg_temp.id(n);
end $$;
select pg_temp.mk(901, null, null);                                   -- unlinked
select pg_temp.mk(911, pg_temp.id(301), null);                        -- lesson L1
select pg_temp.mk(912, pg_temp.id(302), null);                        -- lesson L2
select pg_temp.mk(913, pg_temp.id(303), null);                        -- lesson L3
select pg_temp.mk(914, pg_temp.id(304), null);                        -- lesson L4 (next module)
select pg_temp.mk(921, null, pg_temp.id(201));                        -- module-only M1
select pg_temp.mk(922, null, pg_temp.id(202));                        -- module-only M2
select pg_temp.mk(923, null, pg_temp.id(203));                        -- module-only M3 (no lessons)
select pg_temp.mk(931, pg_temp.id(305), null, 'ASSIGNED');            -- teacher-assigned, lesson L5 not reached
select pg_temp.mk(932, pg_temp.id(305), null);                        -- same lesson, not assigned
insert into public.cohort_practice_assignments(cohort_id, practice_activity_id, assigned_by_teacher_id)
  values (pg_temp.id(602), pg_temp.id(931), pg_temp.id(50));
-- Cohort K1 also receives an assigned practice that S2 (K2) must not see.
create function pg_temp.reached(u integer, p integer) returns boolean language sql security definer as $$
  select private.practice_lesson_reached(pg_temp.id(u), pg_temp.id(p));
$$;

-- 0. Schema contract -------------------------------------------------------------------------------------------
select pg_temp.ok((select is_nullable = 'NO' and column_default like '%FULL%' from information_schema.columns
  where table_schema = 'public' and table_name = 'practice_attempts' and column_name = 'attempt_kind'), 'attempt_kind not null default FULL');
select pg_temp.ok((select data_type = 'ARRAY' and is_nullable = 'YES' from information_schema.columns
  where table_schema = 'public' and table_name = 'practice_attempts' and column_name = 'item_ids'), 'item_ids text[] nullable');
select pg_temp.ok((select is_nullable = 'NO' and column_default like 'now()%' from information_schema.columns
  where table_schema = 'public' and table_name = 'practice_attempts' and column_name = 'last_activity_at'), 'last_activity_at not null default now()');
select pg_temp.ok(pg_temp.state($q$insert into public.practice_attempts(user_id, practice_activity_id, status, attempt_kind)
  values (pg_temp.id(3), pg_temp.id(901), 'ABANDONED', 'BOGUS')$q$) = '23514', 'attempt_kind check rejects unknown kinds');
select pg_temp.ok((select i.indisunique and pg_get_expr(i.indpred, i.indrelid) like '%IN_PROGRESS%'
  from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'practice_attempts_one_open_per_kind'), 'partial unique index exists');

-- 1. Reach matrix for S1 (no lesson progress yet: L1 is the current lesson) ----------------------------------
select pg_temp.ok(pg_temp.reached(1, 901), 'unlinked activity is reached');
select pg_temp.ok(pg_temp.reached(1, 911), 'current lesson L1 is reached');
select pg_temp.ok(not pg_temp.reached(1, 912), 'later lesson L2 is not reached');
select pg_temp.ok(not pg_temp.reached(1, 913), 'later lesson L3 is not reached');
select pg_temp.ok(not pg_temp.reached(1, 914), 'lesson of the next module is not reached');
select pg_temp.ok(pg_temp.reached(1, 921), 'module-only link reached when the current lesson is in the module');
select pg_temp.ok(not pg_temp.reached(1, 922), 'module-only link not reached for a later module');
select pg_temp.ok(pg_temp.reached(1, 923), 'module without lessons is never blocked');
select pg_temp.ok(not pg_temp.reached(1, 931), 'assigned practice does not bypass for a Student outside the assigned cohort');
select pg_temp.ok(not pg_temp.reached(1, 932), 'unassigned practice of the same lesson is not reached');
select pg_temp.ok(not private.practice_lesson_reached(null, pg_temp.id(901)), 'null user never reaches');
select pg_temp.ok(not private.practice_lesson_reached(pg_temp.id(1), gen_random_uuid()), 'unknown activity never reached');
select pg_temp.ok(private.student_current_lesson(pg_temp.id(1), pg_temp.id(100)) = pg_temp.id(301), 'current lesson is L1');
select pg_temp.ok(private.student_current_lesson(pg_temp.id(3), pg_temp.id(100)) is null, 'no enrollment => no current lesson');

-- Assignment bypass (decision A): S2 belongs to the assigned cohort K2.
select pg_temp.ok(pg_temp.reached(2, 931), 'assigned practice on an unreached lesson is reached through the cohort assignment');
select pg_temp.ok(not pg_temp.reached(2, 932), 'bypass is per activity, not per lesson');

-- 2. Start: allow / deny -------------------------------------------------------------------------------------
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(912)))
  = 'YP001:Practice lesson not reached|PRACTICE_LESSON_NOT_REACHED', 'unreached lesson raises the stable error (YP001 / hint)');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(914))) = 'YP001', 'next-module lesson refused');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(922))) = 'YP001', 'later module-only link refused');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(932))) = 'YP001', 'unassigned practice of an unreached lesson refused');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(931))) = '42501', 'assigned practice stays invisible to a Student outside the cohort (42501)');
select pg_temp.ok(not exists (select 1 from public.practice_attempts where user_id = pg_temp.id(1)), 'refused starts leave no attempt');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, %L)', pg_temp.id(901), pg_temp.id(7001))) = 'OK', 'unlinked activity starts');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(911))) = 'OK', 'current lesson practice starts');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(921))) = 'OK', 'module-only practice of the current module starts');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(923))) = 'OK', 'practice of an empty module starts');
select pg_temp.ok(pg_temp.state('select public.start_practice_attempt(null, gen_random_uuid())') <> 'OK', 'null activity refused');
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_attempt(%L, null)', pg_temp.id(901))) like 'P0001:Practice idempotency key is required%', 'idempotency key required');
select pg_temp.ok((select count(*) = 4 from public.practice_attempts where user_id = pg_temp.id(1)), 'one open attempt per started practice');

-- S2 (assigned cohort) starts the assigned practice although L5 is not reached.
select pg_temp.login(2);
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(931))) = 'OK', 'assignment bypass: assigned practice starts on an unreached lesson');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(932))) = 'YP001', 'bypass does not extend to other practices');

-- 3. Lesson progress moves the gate -------------------------------------------------------------------------
select pg_temp.login(1);
-- Started lesson: L3 at 30% (not the current lesson) is reached; L2 still is not.
select public.record_lesson_progress(pg_temp.id(303), 30, 0);
select pg_temp.ok(pg_temp.reached(1, 913), 'a started lesson is reached');
select pg_temp.ok(not pg_temp.reached(1, 912), 'L2 still not reached after L3 started');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(913))) = 'OK', 'practice of a started lesson starts');
-- Accessed lesson: a 0% row counts.
select public.record_lesson_progress(pg_temp.id(302), 0, 0);
select pg_temp.ok(pg_temp.reached(1, 912), 'an accessed lesson (progress row at 0%) is reached');
-- Completed lesson.
select public.record_lesson_progress(pg_temp.id(301), 100, 0);
select pg_temp.ok(pg_temp.reached(1, 911), 'a completed lesson is reached');
reset role;
select pg_temp.ok(private.student_current_lesson(pg_temp.id(1), pg_temp.id(100)) = pg_temp.id(302), 'current lesson advances to L2 (first not completed)');
select pg_temp.ok(not pg_temp.reached(1, 914), 'L4 still not reached');
select pg_temp.ok(not pg_temp.reached(1, 922), 'module M2 still not reached');
set local role authenticated;
select public.record_lesson_progress(pg_temp.id(302), 100, 0);
select public.record_lesson_progress(pg_temp.id(303), 100, 0);
reset role;
select pg_temp.ok(private.student_current_lesson(pg_temp.id(1), pg_temp.id(100)) = pg_temp.id(304), 'current lesson advances to L4 after M1 is completed');
select pg_temp.ok(pg_temp.reached(1, 914), 'L4 reached once it is the current lesson');
select pg_temp.ok(pg_temp.reached(1, 922), 'module-only link reached once its first lesson is current');
select pg_temp.ok(not pg_temp.reached(1, 932), 'L5 still not reached');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(914))) = 'OK', 'practice of the new current lesson starts');
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(932))) = 'YP001', 'later lesson still refused');
reset role;

-- 4. Resume / stale / idempotency ----------------------------------------------------------------------------
-- Activity 901 already has an open attempt for S1 (section 2). Resume with a different key returns the same row.
select pg_temp.login(1);
set local role authenticated;
insert into ids select 'open', id from public.practice_attempts where user_id = pg_temp.id(1) and practice_activity_id = pg_temp.id(901);
insert into ids select 'resume1', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7002))).id;
insert into ids select 'resume2', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7003))).id;
reset role;
select pg_temp.ok((select count(distinct id) = 1 from ids where k in ('open', 'resume1', 'resume2')), 'start within 24h resumes the same attempt (different idempotency keys)');
select pg_temp.ok((select count(*) = 1 from public.practice_attempts where user_id = pg_temp.id(1) and practice_activity_id = pg_temp.id(901) and status = 'IN_PROGRESS'), 'still exactly one open attempt');
-- Resume touches last_activity_at.
update public.practice_attempts set last_activity_at = now() - interval '23 hours' where id = (select id from ids where k = 'open');
set local role authenticated;
select public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7008));
reset role;
select pg_temp.ok((select last_activity_at > now() - interval '1 minute' from public.practice_attempts where id = (select id from ids where k = 'open')), 'resume at 23h touches last_activity_at');
select pg_temp.ok((select status = 'IN_PROGRESS' from public.practice_attempts where id = (select id from ids where k = 'open')), '23h-old attempt is still open');
-- Idempotent replay of an existing key.
set local role authenticated;
insert into ids select 'replay', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7001))).id;
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_attempt(%L, %L)', pg_temp.id(911), pg_temp.id(7001)))
  like 'P0001:Idempotency key already belongs to another activity%', 'key of another activity refused');
reset role;
select pg_temp.ok((select id from ids where k = 'replay') = (select id from ids where k = 'open'), 'idempotent replay returns the original row');
-- The idempotent replay does not depend on the lesson gate (an attempt that exists is returned unchanged).
-- Stale (> 24h): the old attempt is ABANDONED and a new one starts.
update public.practice_attempts set last_activity_at = now() - interval '25 hours' where id = (select id from ids where k = 'open');
set local role authenticated;
insert into ids select 'fresh', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7004))).id;
reset role;
select pg_temp.ok((select id from ids where k = 'fresh') <> (select id from ids where k = 'open'), 'stale attempt is replaced by a new one');
select pg_temp.ok((select status = 'ABANDONED' from public.practice_attempts where id = (select id from ids where k = 'open')), 'stale attempt is ABANDONED');
select pg_temp.ok((select status = 'IN_PROGRESS' and last_activity_at > now() - interval '1 minute' and attempt_kind = 'FULL'
  from public.practice_attempts where id = (select id from ids where k = 'fresh')), 'new attempt is an open FULL attempt with fresh activity');
select pg_temp.ok((select count(*) = 1 from public.practice_attempts where user_id = pg_temp.id(1) and practice_activity_id = pg_temp.id(901) and status = 'IN_PROGRESS'), 'exactly one open attempt after expiry');
-- Replay of the abandoned attempt's key still returns that (now ABANDONED) row: unchanged idempotency semantics.
set local role authenticated;
insert into ids select 'replay_abandoned', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7001))).id;
reset role;
select pg_temp.ok((select id from ids where k = 'replay_abandoned') = (select id from ids where k = 'open'), 'replay of an old key returns its original row');

-- ABANDONED cannot be submitted; the open one can; submitting frees the slot for a new attempt.
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.attempt(format('select public.submit_practice_attempt(%L, %L::jsonb)', (select id from ids where k = 'open'), '{"optionId":"meet"}'))
  like '%cannot be submitted%', 'ABANDONED attempt cannot be submitted');
reset role;
select pg_temp.ok((select status = 'ABANDONED' and submitted_at is null from public.practice_attempts where id = (select id from ids where k = 'open')), 'abandoned attempt untouched by the refused submit');
set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_attempt(%L, %L::jsonb)', (select id from ids where k = 'fresh'), '{"optionId":"meet"}')) = 'OK', 'open attempt can be submitted');
insert into ids select 'after_submit', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7005))).id;
reset role;
select pg_temp.ok((select id from ids where k = 'after_submit') <> (select id from ids where k = 'fresh'), 'a SUBMITTED attempt is never resumed');
select pg_temp.ok((select status = 'SUBMITTED' from public.practice_attempts where id = (select id from ids where k = 'fresh')), 'submitted attempt keeps its status');
select pg_temp.ok((select count(*) = 1 from public.practice_attempts where user_id = pg_temp.id(1) and practice_activity_id = pg_temp.id(901) and status = 'IN_PROGRESS'), 'one open attempt after a new start');

-- Attempts of other users and other activities are independent.
select pg_temp.login(2);
set local role authenticated;
insert into ids select 's2_901', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7001))).id;
reset role;
select pg_temp.ok((select id from ids where k = 's2_901') <> (select id from ids where k = 'open'), 'idempotency keys are scoped per user');
select pg_temp.ok((select user_id = pg_temp.id(2) from public.practice_attempts where id = (select id from ids where k = 's2_901')), 'attempt belongs to the caller');

-- 5. Unique index ---------------------------------------------------------------------------------------------
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_attempts(user_id, practice_activity_id, status)
  values (%L, %L, 'IN_PROGRESS')$q$, pg_temp.id(1), pg_temp.id(901))) = '23505', 'unique index rejects a second IN_PROGRESS FULL attempt');
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_attempts(user_id, practice_activity_id, status, attempt_kind, item_ids)
  values (%L, %L, 'IN_PROGRESS', 'REVIEW', array['a'])$q$, pg_temp.id(1), pg_temp.id(901))) = 'OK', 'a REVIEW attempt may coexist with the FULL one');
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_attempts(user_id, practice_activity_id, status, attempt_kind)
  values (%L, %L, 'IN_PROGRESS', 'REVIEW')$q$, pg_temp.id(1), pg_temp.id(901))) = '23505', 'but only one open REVIEW attempt');
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_attempts(user_id, practice_activity_id, status)
  values (%L, %L, 'ABANDONED')$q$, pg_temp.id(1), pg_temp.id(901))) = 'OK', 'closed attempts are not limited by the index');
select pg_temp.ok(pg_temp.state(format($q$insert into public.practice_attempts(user_id, practice_activity_id, status, submitted_at)
  values (%L, %L, 'SUBMITTED', now())$q$, pg_temp.id(1), pg_temp.id(901))) = 'OK', 'submitted attempts are not limited by the index');
select pg_temp.ok(pg_temp.state(format($q$update public.practice_attempts set status = 'IN_PROGRESS' where id = %L$q$, (select id from ids where k = 'open'))) = '23505',
  'reopening an abandoned attempt beside an open one is rejected');
-- The start RPC copes with a REVIEW attempt sitting next to the FULL one (independent kinds).
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7006))).attempt_kind = 'FULL', 'start returns the FULL attempt even with an open REVIEW attempt');
reset role;

-- 6. Duplicate cleanup (migration step 2) --------------------------------------------------------------------
-- The statement below is the data step of 20261016120000 (section 2) run against fabricated duplicates:
-- the unique index is dropped inside this transaction (rolled back with it) so duplicates can exist.
drop index public.practice_attempts_one_open_per_kind;
insert into public.practice_attempts(id, user_id, practice_activity_id, status, started_at, last_activity_at, submitted_at) values
  (pg_temp.id(8001), pg_temp.id(4), pg_temp.id(901), 'IN_PROGRESS', now() - interval '3 hours', now() - interval '3 hours', null),
  (pg_temp.id(8002), pg_temp.id(4), pg_temp.id(901), 'IN_PROGRESS', now() - interval '2 hours', now() - interval '2 hours', null),
  (pg_temp.id(8003), pg_temp.id(4), pg_temp.id(901), 'IN_PROGRESS', now() - interval '1 hours', now() - interval '1 hours', null),
  (pg_temp.id(8004), pg_temp.id(4), pg_temp.id(901), 'SUBMITTED', now() - interval '5 hours', now() - interval '5 hours', now()),
  (pg_temp.id(8005), pg_temp.id(4), pg_temp.id(911), 'IN_PROGRESS', now() - interval '1 hours', now() - interval '1 hours', null);
with ranked as (
  select a.id,
         row_number() over (
           partition by a.user_id, a.practice_activity_id, a.attempt_kind
           order by a.started_at desc, a.id desc
         ) as rn
  from public.practice_attempts a
  where a.status = 'IN_PROGRESS'
)
update public.practice_attempts a
set status = 'ABANDONED'
from ranked r
where a.id = r.id and r.rn > 1;
select pg_temp.ok((select count(*) = 1 from public.practice_attempts where user_id = pg_temp.id(4) and practice_activity_id = pg_temp.id(901) and status = 'IN_PROGRESS'), 'cleanup leaves exactly one open attempt per (user, activity)');
select pg_temp.ok((select id = pg_temp.id(8003) from public.practice_attempts where user_id = pg_temp.id(4) and practice_activity_id = pg_temp.id(901) and status = 'IN_PROGRESS'), 'the most recent open attempt is kept');
select pg_temp.ok((select count(*) = 2 from public.practice_attempts where user_id = pg_temp.id(4) and practice_activity_id = pg_temp.id(901) and status = 'ABANDONED'), 'older duplicates are ABANDONED, not deleted');
select pg_temp.ok((select status = 'SUBMITTED' from public.practice_attempts where id = pg_temp.id(8004)), 'submitted history untouched');
select pg_temp.ok((select status = 'IN_PROGRESS' from public.practice_attempts where id = pg_temp.id(8005)), 'a lone open attempt of another activity untouched');
create unique index practice_attempts_one_open_per_kind
  on public.practice_attempts (user_id, practice_activity_id, attempt_kind) where status = 'IN_PROGRESS';

-- 7. Subscription gate keeps applying to resumed and replayed attempts ---------------------------------------
select pg_temp.login(4);
set local role authenticated;
insert into ids select 's4_open', (public.start_practice_attempt(pg_temp.id(901), pg_temp.id(7101))).id;
reset role;
select pg_temp.ok((select id = pg_temp.id(8003) from ids where k = 's4_open'), 'S4 resumes the kept attempt');
update public.subscriptions set status = 'PAST_DUE' where user_id = pg_temp.id(4);
set local role authenticated;
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(901))) like '42501:active subscription required%', 'suspended Student cannot resume');
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_attempt(%L, %L)', pg_temp.id(901), pg_temp.id(7101))) like '42501:active subscription required%', 'suspended Student cannot replay a key');
select pg_temp.ok(pg_temp.attempt(format('select public.start_practice_attempt(%L, gen_random_uuid())', pg_temp.id(911))) like '42501:active subscription required%', 'suspended Student cannot start');
reset role;
update public.subscriptions set status = 'ACTIVE' where user_id = pg_temp.id(4);

-- 8. student_practice_reach ----------------------------------------------------------------------------------
select pg_temp.login(1);
set local role authenticated;
create temp table reach1 on commit drop as select * from public.student_practice_reach();
grant all on reach1 to authenticated, anon;
reset role;
select pg_temp.ok((select count(*) from reach1) = (select count(*) from reach1 r1 join public.practice_activities a on a.id = r1.practice_activity_id), 'reach rows reference existing activities');
select pg_temp.ok((select count(*) = count(distinct practice_activity_id) from reach1), 'one row per activity');
select pg_temp.ok((select reached and blocking_lesson_id is null from reach1 where practice_activity_id = pg_temp.id(901)), 'reach: unlinked reached, no blocker');
select pg_temp.ok((select reached and blocking_lesson_id is null from reach1 where practice_activity_id = pg_temp.id(914)), 'reach: current lesson reached');
select pg_temp.ok((select not reached and blocking_lesson_id = pg_temp.id(305) from reach1 where practice_activity_id = pg_temp.id(932)), 'reach: unreached lesson reports the blocking lesson');
select pg_temp.ok((select reached from reach1 where practice_activity_id = pg_temp.id(923)), 'reach: empty module reached');
select pg_temp.ok(not exists (select 1 from reach1 where practice_activity_id = pg_temp.id(931)), 'reach: assigned practice of another cohort is not listed');
select pg_temp.ok(not exists (select 1 from reach1 where practice_activity_id = '83000000-0000-4000-8000-000000000001'), 'reach: activities outside the Student scope are not listed');
select pg_temp.ok((select bool_and(reached = private.practice_lesson_reached(pg_temp.id(1), practice_activity_id)) from reach1), 'reach RPC agrees with the start gate for every listed activity');
select pg_temp.ok((select bool_and(reached = (blocking_lesson_id is null)) from reach1), 'blocking lesson is null exactly when reached');
-- module-only blocker: S3-like view of a fresh Student (S4 has no progress): M2 is blocked by the first lesson of M2.
select pg_temp.login(4);
set local role authenticated;
create temp table reach4 on commit drop as select * from public.student_practice_reach();
reset role;
select pg_temp.ok((select not reached and blocking_lesson_id = pg_temp.id(304) from reach4 where practice_activity_id = pg_temp.id(922)), 'module-only blocker is the first lesson of the module');
select pg_temp.ok((select reached from reach4 where practice_activity_id = pg_temp.id(921)), 'S4 reaches the first module');
-- S2: assigned practice is listed and reached via assignment.
select pg_temp.login(2);
set local role authenticated;
create temp table reach2 on commit drop as select * from public.student_practice_reach();
reset role;
select pg_temp.ok((select reached and blocking_lesson_id is null from reach2 where practice_activity_id = pg_temp.id(931)), 'S2 reaches the assigned practice');
select pg_temp.ok((select not reached from reach2 where practice_activity_id = pg_temp.id(932)), 'S2 does not reach the unassigned practice');
-- S3 has no enrollment: nothing from this course.
select pg_temp.login(3);
set local role authenticated;
select pg_temp.ok(not exists (select 1 from public.student_practice_reach() r where r.practice_activity_id between pg_temp.id(901) and pg_temp.id(932)), 'a Student without enrollment gets no rows for the course content');
reset role;
-- anon and unauthenticated callers.
set local role anon;
select pg_temp.ok(pg_temp.state('select * from public.student_practice_reach()') = '42501', 'anon cannot call student_practice_reach');
reset role;
select pg_temp.ok(pg_temp.state('select * from public.student_practice_reach()') = 'OK', 'postgres can call it (control)');
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select * from public.student_practice_reach()') = '42501', 'authenticated without a subject is refused');
reset role;

-- 9. Privileges ----------------------------------------------------------------------------------------------
select pg_temp.ok(has_function_privilege('authenticated', 'public.student_practice_reach()', 'EXECUTE'), 'authenticated may execute student_practice_reach');
select pg_temp.ok(not has_function_privilege('anon', 'public.student_practice_reach()', 'EXECUTE'), 'anon may not execute student_practice_reach');
select pg_temp.ok(has_function_privilege('authenticated', 'public.start_practice_attempt(uuid,uuid)', 'EXECUTE'), 'authenticated may execute start_practice_attempt');
select pg_temp.ok(not has_function_privilege('anon', 'public.start_practice_attempt(uuid,uuid)', 'EXECUTE'), 'anon may not execute start_practice_attempt');
select pg_temp.ok(not has_function_privilege('authenticated', 'private.practice_lesson_reached(uuid,uuid)', 'EXECUTE'), 'clients cannot probe another user''s reach');
select pg_temp.ok(not has_function_privilege('anon', 'private.practice_lesson_reached(uuid,uuid)', 'EXECUTE'), 'anon cannot execute practice_lesson_reached');
select pg_temp.ok(not has_function_privilege('authenticated', 'private.student_current_lesson(uuid,uuid)', 'EXECUTE'), 'clients cannot probe another user''s current lesson');
select pg_temp.ok((select p.prosecdef and p.proconfig[1] = 'search_path=""' from pg_proc p where p.oid = 'private.practice_lesson_reached(uuid,uuid)'::regprocedure), 'practice_lesson_reached is security definer with an empty search_path');
select pg_temp.ok((select p.prosecdef and p.proconfig[1] = 'search_path=""' from pg_proc p where p.oid = 'public.student_practice_reach()'::regprocedure), 'student_practice_reach is security definer with an empty search_path');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.practice_attempts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.practice_attempts', 'UPDATE'), 'attempts stay writable only through RPCs');

rollback;
