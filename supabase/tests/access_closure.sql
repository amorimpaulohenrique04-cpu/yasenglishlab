-- Stage 11 (ADR 0017-0019): fail-closed paid access, complimentary grants, COMPLETED enrollments,
-- lesson-bound practice access, placement confirmation with a paid CANCELLED period, no-cohort detection.
-- Plain psql, transactional: everything rolls back. Allow AND deny cases per chokepoint.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'access_closure: %', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
-- SQLSTATE raised by the statement, or 'OK' when it succeeds.
create function pg_temp.state_of(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
-- SQLSTATE:message raised by the statement, or 'OK'.
create function pg_temp.attempt(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;

-- Users (prefix ac000000):
--  01 no subscription, no grant | 02 active grant | 03 expired grant | 04 revoked grant
--  05 ACTIVE + cancel_at_period_end, end in the past | 06 ACTIVE + cancel_at_period_end, end in the future
--  07 CANCELLED, paid end in the future (placement) | 08 CANCELLED, paid end in the past (placement)
--  09 ADMIN | 0a TEACHER | 0b completion Student (ACTIVE) | 0c Student enrolled only in the AC course (outside course)
--  0d ACTIVE Student without cohort membership
--  backfill candidates: 0e no subscription + ACTIVE enrollment | 0f PAST_DUE + ACTIVE enrollment | 10 no enrollment
--  | 11 only a COMPLETED enrollment | 12 TEACHER with ACTIVE enrollment
insert into auth.users(id,email) select ('ac000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid, 'ac-' || n || '@example.test'
  from generate_series(1, 18) n;
insert into public.user_roles(user_id,role)
select ('ac000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  case n when 9 then 'ADMIN' when 10 then 'TEACHER' when 18 then 'TEACHER' else 'STUDENT' end
from generate_series(1, 18) n;
insert into public.profiles(user_id,display_name)
select ('ac000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid, 'AC User ' || n from generate_series(1, 18) n
-- private.handle_new_user already created the profile from the e-mail; set the fixture name explicitly.
on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.teachers(id,user_id) values('ac100000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-00000000000a');

-- Course AC: 2 published lessons + 1 DRAFT lesson (not counted for completion) and one published text asset.
insert into public.courses(id,slug,title,active,publication_status,published_at)
 values('ac200000-0000-4000-8000-000000000001','ac-course','AC Course',true,'PUBLISHED',now());
insert into public.modules(id,course_id,position,title,publication_status,published_at)
 values('ac210000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000001',1,'AC module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,slug,title,publication_status,published_at) values
 ('ac220000-0000-4000-8000-000000000001','ac210000-0000-4000-8000-000000000001',1,'ac-lesson-1','AC lesson 1','DRAFT',null),
 ('ac220000-0000-4000-8000-000000000002','ac210000-0000-4000-8000-000000000001',2,'ac-lesson-2','AC lesson 2','DRAFT',null),
 ('ac220000-0000-4000-8000-000000000003','ac210000-0000-4000-8000-000000000001',3,'ac-lesson-3-draft','AC lesson 3 draft','DRAFT',null);
-- A lesson can only be published with a published usable asset: asset first, then publish the lessons.
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at) values
 ('ac230000-0000-4000-8000-000000000001','ac220000-0000-4000-8000-000000000001','TEXT',1,'{"title":"AC","body":"AC body"}','PUBLISHED',now()),
 ('ac230000-0000-4000-8000-000000000002','ac220000-0000-4000-8000-000000000002','TEXT',1,'{"title":"AC2","body":"AC body 2"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED', published_at=now() where id in ('ac220000-0000-4000-8000-000000000001','ac220000-0000-4000-8000-000000000002');
-- An AC lesson-bound Practice activity; its access follows lesson 1 and the active/completed membership path.
-- Publication validates the private answer key: insert as DRAFT, copy the seed key, then publish.
insert into public.practice_activities(id,slug,title,skill,estimated_minutes,related_module_id,related_lesson_id,course_id,content,active,publication_status,published_at)
 select 'ac240000-0000-4000-8000-000000000001','ac-lesson-practice','AC lesson practice',skill,estimated_minutes,
   'ac210000-0000-4000-8000-000000000001','ac220000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000001',content,true,'DRAFT',null
 from public.practice_activities where id='83000000-0000-4000-8000-000000000001';
insert into private.practice_answer_keys(practice_activity_id,answer_key,feedback)
 select 'ac240000-0000-4000-8000-000000000001',answer_key,feedback
 from private.practice_answer_keys where practice_activity_id='83000000-0000-4000-8000-000000000001';
update public.practice_activities set publication_status='PUBLISHED', published_at=now()
 where id='ac240000-0000-4000-8000-000000000001';

-- Seed course 40000000-...-01 (seed Practice activities 83000000-...-01..04 belong to its module 41000000-...-01).
-- Enrollments: 01..06 and 0e/0f/12 and 11(COMPLETED) in the seed course; 0b, 0c, 0d in the AC course.
insert into public.enrollments(id,user_id,course_id,status,completed_at)
select ('ac300000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  ('ac000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  case when n in (11, 12, 13) then 'ac200000-0000-4000-8000-000000000001'::uuid else '40000000-0000-4000-8000-000000000001'::uuid end,
  case when n = 17 then 'COMPLETED' else 'ACTIVE' end,
  case when n = 17 then now() end
from generate_series(1, 6) n(n)
union all
select ('ac300000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  ('ac000000-0000-4000-8000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid,
  case when n in (11, 12, 13) then 'ac200000-0000-4000-8000-000000000001'::uuid else '40000000-0000-4000-8000-000000000001'::uuid end,
  case when n = 17 then 'COMPLETED' else 'ACTIVE' end,
  case when n = 17 then now() end
from (values (11),(12),(13),(14),(15),(17),(18)) v(n);

-- Cohorts (one per course) and memberships for the Students that write progress.
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('ac400000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','AC seed cohort','ac-seed','ACTIVE',now()-interval '1 day'),
 ('ac400000-0000-4000-8000-000000000002','ac200000-0000-4000-8000-000000000001','AC course cohort','ac-course','ACTIVE',now()-interval '1 day');
insert into public.cohort_placement_settings(cohort_id,capacity,schedule) values
 ('ac400000-0000-4000-8000-000000000001',6,'[{"weekday":1,"startMinute":1140,"endMinute":1200}]');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values
 ('ac400000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001'),
 ('ac400000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002','ac300000-0000-4000-8000-000000000002'),
 ('ac400000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000006','ac300000-0000-4000-8000-000000000006'),
 ('ac400000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-00000000000b','ac300000-0000-4000-8000-00000000000b'),
 ('ac400000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-00000000000c','ac300000-0000-4000-8000-00000000000c');

-- Grants: 02 active, 03 expired, 04 revoked.
insert into public.complimentary_access_grants(user_id,reason,note,granted_at,expires_at,revoked_at) values
 ('ac000000-0000-4000-8000-000000000002','ADMIN_GRANT','active',now()-interval '1 day',null,null),
 ('ac000000-0000-4000-8000-000000000003','ADMIN_GRANT','expired',now()-interval '3 days',now()-interval '1 day',null),
 ('ac000000-0000-4000-8000-000000000004','ADMIN_GRANT','revoked',now()-interval '3 days',null,now()-interval '1 day');
-- Subscriptions.
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status,current_period_end,cancel_at_period_end) values
 ('ac500000-0000-4000-8000-000000000005','ac000000-0000-4000-8000-000000000005','10000000-0000-0000-0000-000000000003','test','ac-s5','ACTIVE',now()-interval '1 day',true),
 ('ac500000-0000-4000-8000-000000000006','ac000000-0000-4000-8000-000000000006','10000000-0000-0000-0000-000000000003','test','ac-s6','ACTIVE',now()+interval '10 days',true),
 ('ac500000-0000-4000-8000-000000000007','ac000000-0000-4000-8000-000000000007','10000000-0000-0000-0000-000000000003','test','ac-s7','CANCELLED',now()+interval '10 days',false),
 ('ac500000-0000-4000-8000-000000000008','ac000000-0000-4000-8000-000000000008','10000000-0000-0000-0000-000000000003','test','ac-s8','CANCELLED',now()-interval '1 day',false),
 ('ac500000-0000-4000-8000-00000000000b','ac000000-0000-4000-8000-00000000000b','10000000-0000-0000-0000-000000000003','test','ac-sb','ACTIVE',null,false),
 ('ac500000-0000-4000-8000-00000000000c','ac000000-0000-4000-8000-00000000000c','10000000-0000-0000-0000-000000000003','test','ac-sc','ACTIVE',null,false),
 ('ac500000-0000-4000-8000-00000000000d','ac000000-0000-4000-8000-00000000000d','10000000-0000-0000-0000-000000000003','test','ac-sd','ACTIVE',null,false),
 ('ac500000-0000-4000-8000-00000000000f','ac000000-0000-4000-8000-00000000000f','10000000-0000-0000-0000-000000000003','test','ac-sf','PAST_DUE',null,false);
-- Live session for booking checks.
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status,meeting_provider,meeting_ref)
 values('ac600000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','WORKSHOP','AC booking',now()+interval '2 days',now()+interval '2 days 1 hour',6,null,'SCHEDULED','MANUAL_EXTERNAL','https://meet.example.test/ac');
-- Placement cases (replica mode: fixture only). 07 has a paid CANCELLED period, 08 an ended one.
set local session_replication_role = replica;
insert into public.assessment_attempts(id,user_id,assessment_version_id,status,submitted_at) values
 ('ac700000-0000-4000-8000-000000000007','ac000000-0000-4000-8000-000000000007',gen_random_uuid(),'SUBMITTED',now()),
 ('ac700000-0000-4000-8000-000000000008','ac000000-0000-4000-8000-000000000008',gen_random_uuid(),'SUBMITTED',now());
insert into public.placement_cases(id,user_id,subscription_id,assessment_attempt_id,membership_id,state) values
 ('ac710000-0000-4000-8000-000000000007','ac000000-0000-4000-8000-000000000007','ac500000-0000-4000-8000-000000000007','ac700000-0000-4000-8000-000000000007',null,'STUDENT_DECISION'),
 ('ac710000-0000-4000-8000-000000000008','ac000000-0000-4000-8000-000000000008','ac500000-0000-4000-8000-000000000008','ac700000-0000-4000-8000-000000000008',null,'STUDENT_DECISION');
insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,provenance) values
 ('ac710000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000009','fixture','HIGH','{}'),
 ('ac710000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000009','fixture','HIGH','{}');
insert into public.student_schedule_preferences(placement_case_id,timezone,weekday,start_minute,end_minute) values
 ('ac710000-0000-4000-8000-000000000007','America/Recife',1,1080,1260),
 ('ac710000-0000-4000-8000-000000000008','America/Recife',1,1080,1260);
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------------------------------------
-- 1. The rule (owner context).
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000001'),'signup without subscription or grant has no paid access');
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000002'),'active grant gives paid access');
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000003'),'expired grant gives no paid access');
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000004'),'revoked grant gives no paid access');
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000005'),'ACTIVE with scheduled cancellation already due gives no paid access');
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000006'),'ACTIVE with scheduled cancellation still in the future keeps paid access');
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000007'),'CANCELLED with a future paid end keeps paid access');
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000008'),'CANCELLED with a past paid end gives no paid access');
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-00000000000a'),'TEACHER is never gated');
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000009'),'ADMIN is never gated');
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-00000000000f'),'PAST_DUE gives no paid access');
select pg_temp.assert_true(not private.has_paid_access(null),'null user has no paid access');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.has_paid_access(uuid)','EXECUTE'),'has_paid_access stays closed to clients');
-- Expired/revoked grant edge: a grant that expires in the future is still active; the same user flips when it lapses.
update public.complimentary_access_grants set expires_at = now() + interval '1 hour' where user_id = 'ac000000-0000-4000-8000-000000000003';
update public.complimentary_access_grants set granted_at = now() - interval '2 days' where user_id = 'ac000000-0000-4000-8000-000000000003';
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000003'),'grant with a future expiry is active');
update public.complimentary_access_grants set expires_at = now() - interval '1 minute' where user_id = 'ac000000-0000-4000-8000-000000000003';
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000003'),'grant lapses when expires_at is reached');

-- ---------------------------------------------------------------------------------------------------------
-- 2. Chokepoints for a Student without subscription/grant (01): content, practice, booking, progress denied.
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login('ac000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(not private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'no-sub Student cannot read lesson asset');
select pg_temp.assert_true(not private.can_read_material('81710000-0000-4000-8000-000000000001'),'no-sub Student cannot read material');
select pg_temp.assert_true(not exists(select 1 from public.lesson_assets where id='43000000-0000-4000-8000-000000000001'),'no-sub Student sees no lesson asset row (RLS)');
select pg_temp.assert_true(pg_temp.state_of('select public.start_practice_attempt(''83000000-0000-4000-8000-000000000001'',gen_random_uuid())')='42501','no-sub Student cannot start practice');
select pg_temp.assert_true(pg_temp.state_of('select public.book_live_session(''ac600000-0000-4000-8000-000000000001'')')='42501','no-sub Student cannot book');
select pg_temp.assert_true(pg_temp.attempt('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',10,5)')='42501:active subscription required','no-sub Student cannot record progress');
select pg_temp.assert_true(not exists(select 1 from public.complimentary_access_grants),'Student without grant sees no grant row');
reset role;
select pg_temp.assert_true((select count(*)=0 from public.lesson_progress where user_id='ac000000-0000-4000-8000-000000000001'),'denied progress left no row');

-- Active grant (02): every chokepoint allows.
select pg_temp.login('ac000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'granted Student reads lesson asset');
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'granted Student reads material');
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',10,5);
-- Stage 13: the seed activity belongs to lesson 2, so the Student must have reached it (started it) first.
select public.record_lesson_progress('42000000-0000-4000-8000-000000000002',10,5);
select pg_temp.assert_true((public.start_practice_attempt('83000000-0000-4000-8000-000000000001',gen_random_uuid())).id is not null,'granted Student starts practice (enrolled in the activity course)');
select pg_temp.assert_true(public.book_live_session('ac600000-0000-4000-8000-000000000001') is not null,'granted Student books');
select pg_temp.assert_true((select count(*)=1 from public.complimentary_access_grants),'granted Student sees only the own grant row');
reset role;

-- Expired (03) and revoked (04) grants and the due cancellation (05) are denied; the future cancellation (06) is allowed.
do $$
declare u record;
begin
  for u in select n, ('ac000000-0000-4000-8000-0000000000' || n)::uuid id from (values ('03'),('04'),('05')) v(n) loop
    perform pg_temp.login(u.id);
    set local role authenticated;
    perform pg_temp.assert_true(not private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'), u.n || ' cannot read lesson asset');
    perform pg_temp.assert_true(pg_temp.state_of('select public.start_practice_attempt(''83000000-0000-4000-8000-000000000001'',gen_random_uuid())')='42501', u.n || ' cannot start practice');
    perform pg_temp.assert_true(pg_temp.state_of('select public.book_live_session(''ac600000-0000-4000-8000-000000000001'')')='42501', u.n || ' cannot book');
    reset role;
  end loop;
end $$;
select pg_temp.login('ac000000-0000-4000-8000-000000000006');
set local role authenticated;
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'ACTIVE with a future scheduled end reads lesson asset');
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',10,5);
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Backfill rule. The migration INSERT cannot be replayed here (it ran once, before the seed), so the exact same
--    predicate is executed over this fixture: only STUDENT + no subscription row + ACTIVE enrollment qualify.
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.assert_true((
  select array_agg(ur.user_id order by ur.user_id) = array[
    'ac000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000003','ac000000-0000-4000-8000-000000000004',
    'ac000000-0000-4000-8000-00000000000e']::uuid[]
  from public.user_roles ur
  where ur.role = 'STUDENT' and ur.user_id::text like 'ac000000%'
    and not exists (select 1 from public.subscriptions s where s.user_id = ur.user_id)
    and exists (select 1 from public.enrollments e where e.user_id = ur.user_id and e.status = 'ACTIVE')
), 'backfill predicate selects exactly STUDENT without subscription and with ACTIVE enrollment (not PAST_DUE, no enrollment, COMPLETED-only, teacher)');
select pg_temp.assert_true(not exists(select 1 from public.complimentary_access_grants where reason='LEGACY_BACKFILL' and user_id::text like 'ac000000%'),'no LEGACY_BACKFILL row exists before the predicate is applied');

-- ---------------------------------------------------------------------------------------------------------
-- 4. confirm_placement_choice follows the shared rule (CANCELLED with a future paid end passes; ended one is denied).
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login('ac000000-0000-4000-8000-000000000008');
set local role authenticated;
select pg_temp.assert_true(pg_temp.attempt('select public.confirm_placement_choice(''ac400000-0000-4000-8000-000000000001'')')='42501:confirmed commercial state required','CANCELLED with an ended paid period cannot confirm');
reset role;
select pg_temp.login('ac000000-0000-4000-8000-000000000007');
set local role authenticated;
select pg_temp.assert_true(public.confirm_placement_choice('ac400000-0000-4000-8000-000000000001') is not null,'CANCELLED with a future paid end confirms the placement choice');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.enrollments where user_id='ac000000-0000-4000-8000-000000000007' and status='ACTIVE'),'confirmation activated the enrollment');

-- ---------------------------------------------------------------------------------------------------------
-- 5. Practice access follows lesson enrollment and membership, never a global audience.
-- ---------------------------------------------------------------------------------------------------------
-- 0c (ACTIVE sub) is enrolled only in the AC course: the seed activity (seed course module) is out of scope.
select pg_temp.login('ac000000-0000-4000-8000-00000000000c');
set local role authenticated;
select pg_temp.assert_true(not exists(select 1 from public.practice_activities where id='83000000-0000-4000-8000-000000000001'),'outside-course Student does not see the activity (RLS)');
select pg_temp.assert_true(not private.can_view_practice_activity('83000000-0000-4000-8000-000000000001'),'helper denies the out-of-course activity');
select pg_temp.assert_true(pg_temp.attempt('select public.start_practice_attempt(''83000000-0000-4000-8000-000000000001'',gen_random_uuid())')='42501:Practice activity is unavailable','outside-course Student cannot start the activity');
select public.record_lesson_progress('ac220000-0000-4000-8000-000000000001',10,5);
select pg_temp.assert_true(exists(select 1 from public.practice_activities where id='ac240000-0000-4000-8000-000000000001'),'AC Student with lesson access sees the linked practice');
select pg_temp.assert_true((public.start_practice_attempt('ac240000-0000-4000-8000-000000000001',gen_random_uuid())).id is not null,'AC Student with lesson access starts the linked practice');
reset role;
-- 02 (grant, enrolled in the seed course) sees the in-course activity.
select pg_temp.login('ac000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(exists(select 1 from public.practice_activities where id='83000000-0000-4000-8000-000000000001'),'in-course Student sees the activity');
reset role;
-- A Student with no enrollment at all sees no activity.
select pg_temp.login('ac000000-0000-4000-8000-000000000010');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.practice_activities),'Student without enrollment sees no practice activity');
reset role;
-- Teacher (aal2) keeps visibility; Admin too.
select pg_temp.login('ac000000-0000-4000-8000-00000000000a','aal2');
set local role authenticated;
select pg_temp.assert_true(exists(select 1 from public.practice_activities where id='83000000-0000-4000-8000-000000000001'),'Teacher still sees the activity');
reset role;
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal2');
set local role authenticated;
select pg_temp.assert_true(exists(select 1 from public.practice_activities where id='83000000-0000-4000-8000-000000000001'),'Admin still sees the activity');
reset role;
select pg_temp.logout();

-- ---------------------------------------------------------------------------------------------------------
-- 6. Automatic course completion (0b: AC course, ACTIVE subscription, ACTIVE membership).
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login('ac000000-0000-4000-8000-00000000000b');
set local role authenticated;
select public.record_lesson_progress('ac220000-0000-4000-8000-000000000001',100,10);
reset role;
select pg_temp.assert_true((select status='ACTIVE' and completed_at is null from public.enrollments where id='ac300000-0000-4000-8000-00000000000b'),'one of two published lessons does not complete the course (DRAFT lesson is not counted)');
select pg_temp.login('ac000000-0000-4000-8000-00000000000b');
set local role authenticated;
select public.record_lesson_progress('ac220000-0000-4000-8000-000000000002',100,10);
reset role;
select pg_temp.assert_true((select status='COMPLETED' and completed_at is not null from public.enrollments where id='ac300000-0000-4000-8000-00000000000b'),'last published lesson completes the enrollment');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='enrollment_course_completed' and entity_id='ac300000-0000-4000-8000-00000000000b'),'completion is audited once');
create temp table ac_completed_at as select completed_at from public.enrollments where id='ac300000-0000-4000-8000-00000000000b';
-- Idempotent: replaying the final lesson and revisiting another one neither re-completes nor errors.
select pg_temp.login('ac000000-0000-4000-8000-00000000000b');
set local role authenticated;
select public.record_lesson_progress('ac220000-0000-4000-8000-000000000002',100,20);
select public.record_lesson_progress('ac220000-0000-4000-8000-000000000001',40,5);
-- COMPLETED keeps read access, progress access, cohort membership and practice.
select pg_temp.assert_true(private.can_read_lesson_asset('ac230000-0000-4000-8000-000000000001'),'COMPLETED enrollment keeps reading lesson assets');
select pg_temp.assert_true(exists(select 1 from public.lesson_assets where id='ac230000-0000-4000-8000-000000000001'),'COMPLETED enrollment keeps the lesson asset row (RLS)');
select pg_temp.assert_true((select count(*)=2 from public.lesson_progress),'progress of both lessons remains readable after completion');
select pg_temp.assert_true(private.can_view_practice_activity('ac240000-0000-4000-8000-000000000001'),'COMPLETED enrollment keeps practice access');
select pg_temp.assert_true((public.start_practice_attempt('ac240000-0000-4000-8000-000000000001',gen_random_uuid())).id is not null,'COMPLETED Student starts practice');
select pg_temp.assert_true(pg_temp.attempt('select public.track_product_event(''lesson_completed'',''ac220000-0000-4000-8000-000000000002'',''{}''::jsonb,''ac-lc-2'')')='OK','lesson_completed analytics works for the COMPLETED enrollment');
reset role;
select pg_temp.assert_true((select completed_at = (select completed_at from ac_completed_at) from public.enrollments where id='ac300000-0000-4000-8000-00000000000b'),'completed_at is written once');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='enrollment_course_completed' and entity_id='ac300000-0000-4000-8000-00000000000b'),'completion audit is not duplicated by replays');
select pg_temp.assert_true((select completion_percent=100 from public.lesson_progress where user_id='ac000000-0000-4000-8000-00000000000b' and lesson_id='ac220000-0000-4000-8000-000000000001'),'lower replay keeps the higher percent');
select pg_temp.assert_true(private.has_cohort_membership('ac400000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-00000000000b'),'cohort membership stays effective for a COMPLETED enrollment');
-- A lesson published later does not reopen the course.
insert into public.lessons(id,module_id,position,slug,title,publication_status,published_at)
 values('ac220000-0000-4000-8000-000000000004','ac210000-0000-4000-8000-000000000001',4,'ac-lesson-4','AC lesson 4','DRAFT',null);
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at)
 values('ac230000-0000-4000-8000-000000000004','ac220000-0000-4000-8000-000000000004','TEXT',1,'{"title":"AC4","body":"AC body 4"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED', published_at=now() where id='ac220000-0000-4000-8000-000000000004';
select pg_temp.login('ac000000-0000-4000-8000-00000000000b');
set local role authenticated;
select public.record_lesson_progress('ac220000-0000-4000-8000-000000000004',30,5);
reset role;
select pg_temp.assert_true((select status='COMPLETED' from public.enrollments where id='ac300000-0000-4000-8000-00000000000b'),'a later published lesson does not reopen a COMPLETED enrollment');
-- ACTIVE-only paths stay ACTIVE-only: a COMPLETED enrollment cannot get a NEW membership through the Admin queue.
select pg_temp.assert_true(pg_temp.state_of('insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values(''ac400000-0000-4000-8000-000000000002'',''ac000000-0000-4000-8000-000000000011'',''ac300000-0000-4000-8000-000000000011'')') is distinct from 'OK','new membership for a COMPLETED enrollment is rejected');
-- Enrollment 11 was COMPLETED by fixture (legacy): a 0-published-lesson or already COMPLETED row is never rewritten.
select pg_temp.assert_true((select status='COMPLETED' from public.enrollments where id='ac300000-0000-4000-8000-000000000011'),'fixture COMPLETED enrollment untouched');

-- ---------------------------------------------------------------------------------------------------------
-- 7. Admin RPCs: ADMIN + aal2 only; audit; Student target; reactivation.
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal1');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-000000000001'',''no aal2'')')='42501','ADMIN at aal1 cannot grant');
select pg_temp.assert_true(pg_temp.state_of('select public.revoke_complimentary_access(''ac000000-0000-4000-8000-000000000002'',''no aal2'')')='42501','ADMIN at aal1 cannot revoke');
select pg_temp.assert_true(pg_temp.state_of('select * from public.admin_enrollments_without_active_cohort()')='42501','ADMIN at aal1 cannot list enrollments without cohort');
reset role;
select pg_temp.login('ac000000-0000-4000-8000-000000000001','aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-000000000001'',''self grant'')')='42501','Student cannot self-grant');
select pg_temp.assert_true(pg_temp.state_of('select public.revoke_complimentary_access(''ac000000-0000-4000-8000-000000000002'',''x'')')='42501','Student cannot revoke');
select pg_temp.assert_true(pg_temp.state_of('select * from public.admin_enrollments_without_active_cohort()')='42501','Student cannot list enrollments without cohort');
reset role;
select pg_temp.login('ac000000-0000-4000-8000-00000000000a','aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-000000000001'',''teacher'')')='42501','Teacher cannot grant');
select pg_temp.assert_true(pg_temp.state_of('select * from public.admin_enrollments_without_active_cohort()')='42501','Teacher cannot list enrollments without cohort');
reset role;
select pg_temp.logout();
set local role anon;
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-000000000001'',''anon'')')='42501','anon cannot grant');
select pg_temp.assert_true(pg_temp.state_of('select * from public.admin_enrollments_without_active_cohort()')='42501','anon cannot list enrollments without cohort');
reset role;

select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-00000000000a'',''teacher target'')')='23514','grant target must be a Student');
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-000000000001'','''')')='22023','grant requires a note');
select pg_temp.assert_true(pg_temp.state_of('select public.grant_complimentary_access(''ac000000-0000-4000-8000-000000000001'',''past'',now()-interval ''1 day'')')='22023','grant rejects an expiry in the past');
select pg_temp.assert_true(pg_temp.state_of('select public.revoke_complimentary_access(''ac000000-0000-4000-8000-000000000001'',''none yet'')')='23514','revoke without a grant is rejected');
select pg_temp.assert_true((public.grant_complimentary_access('ac000000-0000-4000-8000-000000000001','support ticket 42', now()+interval '30 days')->>'revoked_at') is null,'ADMIN aal2 grants access');
reset role;
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000001'),'granted Student now has paid access');
select pg_temp.assert_true((select reason='ADMIN_GRANT' and granted_by='ac000000-0000-4000-8000-000000000009' and expires_at > now() from public.complimentary_access_grants where user_id='ac000000-0000-4000-8000-000000000001'),'grant row records actor, reason and expiry');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='complimentary_access_granted' and entity_id='ac000000-0000-4000-8000-000000000001' and actor_user_id='ac000000-0000-4000-8000-000000000009' and data->>'note'='support ticket 42'),'grant is audited');
-- The Student can now use the product (and reads only the own grant row through RLS).
select pg_temp.login('ac000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'granted Student reads lesson asset');
select pg_temp.assert_true((select count(*)=1 from public.complimentary_access_grants where user_id='ac000000-0000-4000-8000-000000000001'),'Student reads own grant row (expires_at/revoked_at columns)');
select pg_temp.assert_true((select expires_at is not null and revoked_at is null from public.complimentary_access_grants),'own-row loader columns are readable');
select pg_temp.assert_true(pg_temp.state_of('select note from public.complimentary_access_grants')='42501','internal note column is not readable by clients');
select pg_temp.assert_true(pg_temp.state_of('insert into public.complimentary_access_grants(user_id,reason) values(gen_random_uuid(),''ADMIN_GRANT'')')='42501','clients cannot insert grants');
select pg_temp.assert_true(pg_temp.state_of('update public.complimentary_access_grants set expires_at = null')='42501','clients cannot update grants');
select pg_temp.assert_true(pg_temp.state_of('delete from public.complimentary_access_grants')='42501','clients cannot delete grants');
reset role;
-- Another Student never sees that row; ADMIN aal2 sees all; ADMIN aal1 sees none.
select pg_temp.login('ac000000-0000-4000-8000-00000000000c');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.complimentary_access_grants),'other Student sees no grants');
reset role;
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*)>=4 from public.complimentary_access_grants),'ADMIN aal2 reads all grants');
reset role;
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.complimentary_access_grants),'ADMIN aal1 reads no grants');
reset role;
-- Revoke (idempotent, audited once), then re-grant reactivates the same row.
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal2');
set local role authenticated;
select pg_temp.assert_true((public.revoke_complimentary_access('ac000000-0000-4000-8000-000000000001','ticket closed')->>'revoked_at') is not null,'ADMIN aal2 revokes access');
select public.revoke_complimentary_access('ac000000-0000-4000-8000-000000000001','ticket closed again');
reset role;
select pg_temp.assert_true(not private.has_paid_access('ac000000-0000-4000-8000-000000000001'),'revoked Student loses paid access');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='complimentary_access_revoked' and entity_id='ac000000-0000-4000-8000-000000000001' and data->>'note'='ticket closed'),'revoke is audited once (idempotent repeat)');
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal2');
set local role authenticated;
select public.grant_complimentary_access('ac000000-0000-4000-8000-000000000001','reactivated');
reset role;
select pg_temp.assert_true(private.has_paid_access('ac000000-0000-4000-8000-000000000001'),'re-grant reactivates a revoked row');
select pg_temp.assert_true((select count(*)=1 and bool_and(revoked_at is null and revoked_by is null and expires_at is null) from public.complimentary_access_grants where user_id='ac000000-0000-4000-8000-000000000001'),'re-grant is an upsert on the same row');
select pg_temp.assert_true((select count(*)=2 and bool_or((data->>'reactivated')::boolean) from public.audit_logs where action='complimentary_access_granted' and entity_id='ac000000-0000-4000-8000-000000000001'),'re-grant is audited as a reactivation');
-- Grants carry no plan entitlements: base access only.
select pg_temp.assert_true((select count(*)=0 from public.subscriptions where user_id='ac000000-0000-4000-8000-000000000001'),'grant creates no subscription');

-- Enrollments without ACTIVE cohort membership: 0d (ACTIVE, no membership) is listed; members, COMPLETED and teachers are not.
select pg_temp.login('ac000000-0000-4000-8000-000000000009','aal2');
set local role authenticated;
select pg_temp.assert_true(exists(select 1 from public.admin_enrollments_without_active_cohort(200,0) r where r.user_id='ac000000-0000-4000-8000-00000000000d' and r.course_title='AC Course' and r.display_name='AC User 13'),'listed: ACTIVE enrollment without membership');
select pg_temp.assert_true(not exists(select 1 from public.admin_enrollments_without_active_cohort(200,0) r where r.user_id in ('ac000000-0000-4000-8000-00000000000b','ac000000-0000-4000-8000-000000000011','ac000000-0000-4000-8000-000000000002')),'not listed: Student with ACTIVE membership or COMPLETED enrollment');
select pg_temp.assert_true(pg_temp.state_of('select * from public.admin_enrollments_without_active_cohort(0,0)')='22023','invalid paging is rejected');
reset role;
select pg_temp.logout();

-- Practice history survives the end of an enrollment (transfer): the attempted activity stays readable,
-- but a new attempt needs an ACTIVE/COMPLETED enrollment again. User ac000000-...-13 (19) is dedicated.
insert into auth.users(id,email) values('ac000000-0000-4000-8000-000000000013','ac-19@example.test');
insert into public.user_roles(user_id,role) values('ac000000-0000-4000-8000-000000000013','STUDENT');
insert into public.complimentary_access_grants(user_id,reason,note) values('ac000000-0000-4000-8000-000000000013','ADMIN_GRANT','history');
insert into public.enrollments(id,user_id,course_id,status) values('ac300000-0000-4000-8000-000000000013','ac000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values('ac400000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000013','ac300000-0000-4000-8000-000000000013');
-- Stage 13: lesson 2 (the activity's lesson) must have been reached before the practice can start.
insert into public.lesson_progress(enrollment_id,lesson_id,user_id,status,completion_percent,started_at) values('ac300000-0000-4000-8000-000000000013','42000000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000013','IN_PROGRESS',10,now());
select pg_temp.login('ac000000-0000-4000-8000-000000000013');
set local role authenticated;
select pg_temp.assert_true((public.start_practice_attempt('83000000-0000-4000-8000-000000000002',gen_random_uuid())).id is not null,'enrolled Student starts practice before the transfer');
reset role;
update public.enrollments set status='CANCELLED' where id='ac300000-0000-4000-8000-000000000013';
set local role authenticated;
select pg_temp.assert_true(exists(select 1 from public.practice_activities where id='83000000-0000-4000-8000-000000000002'),'attempted activity stays readable after the enrollment ended');
select pg_temp.assert_true(not exists(select 1 from public.practice_activities where id='83000000-0000-4000-8000-000000000003'),'never-attempted activity of the ended course is hidden');
select pg_temp.assert_true(pg_temp.attempt('select public.start_practice_attempt(''83000000-0000-4000-8000-000000000002'',gen_random_uuid())')='42501:Practice activity is unavailable','no new attempt without an enrollment');
reset role;
select pg_temp.logout();

-- ---------------------------------------------------------------------------------------------------------
-- 8. Privilege surface (Stage 08).
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.assert_true(has_function_privilege('authenticated','public.grant_complimentary_access(uuid,text,timestamptz)','EXECUTE') and not has_function_privilege('anon','public.grant_complimentary_access(uuid,text,timestamptz)','EXECUTE'),'grant RPC: authenticated only');
select pg_temp.assert_true(has_function_privilege('authenticated','public.revoke_complimentary_access(uuid,text)','EXECUTE') and not has_function_privilege('anon','public.revoke_complimentary_access(uuid,text)','EXECUTE'),'revoke RPC: authenticated only');
select pg_temp.assert_true(has_function_privilege('authenticated','public.admin_enrollments_without_active_cohort(integer,integer)','EXECUTE') and not has_function_privilege('anon','public.admin_enrollments_without_active_cohort(integer,integer)','EXECUTE'),'no-cohort RPC: authenticated only');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.has_course_enrollment(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','private.has_course_enrollment(uuid,uuid)','EXECUTE'),'has_course_enrollment is not client callable');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.complete_enrollment_on_last_lesson()','EXECUTE') and not has_function_privilege('anon','private.complete_enrollment_on_last_lesson()','EXECUTE'),'completion trigger function is not client callable');
select pg_temp.assert_true(has_function_privilege('authenticated','private.can_view_practice_activity(uuid)','EXECUTE') and not has_function_privilege('anon','private.can_view_practice_activity(uuid)','EXECUTE'),'practice policy helper: authenticated only (policy evaluation)');
select pg_temp.assert_true(not has_table_privilege('anon','public.complimentary_access_grants','SELECT') and not has_any_column_privilege('anon','public.complimentary_access_grants','SELECT'),'anon has no access to grants');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.complimentary_access_grants'::regclass),'grants table has RLS enabled');
rollback;
