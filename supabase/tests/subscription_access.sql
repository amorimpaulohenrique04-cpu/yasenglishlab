-- Stage 04a (ADR 0016): paid-access gate derived from subscriptions.status.
-- Allow/deny per chokepoint; suspension never mutates enrollments/progress; payment restores access.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
-- true when the statement is denied with insufficient_privilege (42501); any other error propagates.
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when insufficient_privilege then return true; end $$;

-- S1 ACTIVE, S2 PAST_DUE, S3 EXPIRED, S4 CANCELLED, S5 never had a subscription (legacy), S6 other ACTIVE student.
insert into auth.users(id,email) values
 ('9d000000-0000-4000-8000-000000000001','gate-s1@example.test'),
 ('9d000000-0000-4000-8000-000000000002','gate-s2@example.test'),
 ('9d000000-0000-4000-8000-000000000003','gate-s3@example.test'),
 ('9d000000-0000-4000-8000-000000000004','gate-s4@example.test'),
 ('9d000000-0000-4000-8000-000000000005','gate-s5@example.test'),
 ('9d000000-0000-4000-8000-000000000006','gate-s6@example.test'),
 ('9d000000-0000-4000-8000-000000000007','gate-teacher@example.test'),
 ('9d000000-0000-4000-8000-000000000008','gate-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('9d000000-0000-4000-8000-000000000001','STUDENT'),('9d000000-0000-4000-8000-000000000002','STUDENT'),
 ('9d000000-0000-4000-8000-000000000003','STUDENT'),('9d000000-0000-4000-8000-000000000004','STUDENT'),
 ('9d000000-0000-4000-8000-000000000005','STUDENT'),('9d000000-0000-4000-8000-000000000006','STUDENT'),
 ('9d000000-0000-4000-8000-000000000007','TEACHER'),('9d000000-0000-4000-8000-000000000008','ADMIN');
insert into public.teachers(id,user_id) values('9d100000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000007');
insert into public.enrollments(id,user_id,course_id,status)
select ('9d200000-0000-4000-8000-00000000000'||n)::uuid, ('9d000000-0000-4000-8000-00000000000'||n)::uuid,
  '40000000-0000-4000-8000-000000000001','ACTIVE' from generate_series(1,6) n;
-- Stage 06a: Students record progress only with an ACTIVE cohort membership.
insert into public.cohorts(id,course_id,name,code,status,starts_at)
 values('9d700000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Gate cohort','gate-cohort','ACTIVE',now()-interval '1 day');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id)
select '9d700000-0000-4000-8000-000000000001', ('9d000000-0000-4000-8000-00000000000'||n)::uuid, ('9d200000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,6) n;
insert into public.subscriptions(id,user_id,plan_id,provider,status) values
 ('9d300000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000003','test','ACTIVE'),
 ('9d300000-0000-4000-8000-000000000002','9d000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000003','test','PAST_DUE'),
 ('9d300000-0000-4000-8000-000000000003','9d000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000003','test','EXPIRED'),
 ('9d300000-0000-4000-8000-000000000004','9d000000-0000-4000-8000-000000000004','10000000-0000-0000-0000-000000000003','test','CANCELLED'),
 ('9d300000-0000-4000-8000-000000000006','9d000000-0000-4000-8000-000000000006','10000000-0000-0000-0000-000000000003','test','ACTIVE'),
 -- Staff with an unpaid subscription row must stay exempt.
 ('9d300000-0000-4000-8000-000000000007','9d000000-0000-4000-8000-000000000007','10000000-0000-0000-0000-000000000003','test','PAST_DUE'),
 ('9d300000-0000-4000-8000-000000000008','9d000000-0000-4000-8000-000000000008','10000000-0000-0000-0000-000000000003','test','EXPIRED');
-- Joinable session (starts inside the join window) and a future one for booking; both without entitlement key.
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status,meeting_provider,meeting_ref) values
 ('9d4f0000-0000-4000-8000-000000000001','9d100000-0000-4000-8000-000000000001','WORKSHOP','Gate join',now()+interval '5 minutes',now()+interval '65 minutes',6,null,'SCHEDULED','MANUAL_EXTERNAL','https://meet.example.test/gate'),
 ('9d4f0000-0000-4000-8000-000000000002','9d100000-0000-4000-8000-000000000001','WORKSHOP','Gate booking',now()+interval '2 days',now()+interval '2 days 1 hour',6,null,'SCHEDULED','MANUAL_EXTERNAL','https://meet.example.test/gate2');
insert into public.session_bookings(live_session_id,user_id) values
 ('9d4f0000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000001'),
 ('9d4f0000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000002');
insert into public.live_session_recordings(id,live_session_id,storage_path) values
 ('9d500000-0000-4000-8000-000000000001','9d4f0000-0000-4000-8000-000000000001','gate/recording.mp4');
insert into public.live_session_resources(id,live_session_id,resource_type,title,upload_status) values
 ('9d600000-0000-4000-8000-000000000001','9d4f0000-0000-4000-8000-000000000001','HOMEWORK','Gate homework','READY');

-- 1. The rule itself (decision function, owner context).
select pg_temp.assert_true(private.has_paid_access('9d000000-0000-4000-8000-000000000001'),'ACTIVE has paid access');
select pg_temp.assert_true(not private.has_paid_access('9d000000-0000-4000-8000-000000000002'),'PAST_DUE has no paid access');
select pg_temp.assert_true(not private.has_paid_access('9d000000-0000-4000-8000-000000000003'),'EXPIRED has no paid access');
select pg_temp.assert_true(not private.has_paid_access('9d000000-0000-4000-8000-000000000004'),'CANCELLED has no paid access');
-- Stage 11 (ADR 0017): fail-closed. No subscription and no grant means no paid access.
select pg_temp.assert_true(not private.has_paid_access('9d000000-0000-4000-8000-000000000005'),'user that never had a subscription has NO paid access (fail-closed)');
select pg_temp.assert_true(private.has_paid_access('9d000000-0000-4000-8000-000000000007'),'TEACHER is never gated');
select pg_temp.assert_true(private.has_paid_access('9d000000-0000-4000-8000-000000000008'),'ADMIN is never gated');
select pg_temp.assert_true(not private.has_paid_access(null),'anonymous has no paid access');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.has_paid_access(uuid)','EXECUTE'),'clients cannot probe billing state');
select pg_temp.assert_true(not has_function_privilege('anon','private.has_paid_access(uuid)','EXECUTE'),'anon cannot execute has_paid_access');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.enforce_paid_access()','EXECUTE'),'trigger function is not callable by clients');

-- 2. ACTIVE student: every chokepoint allows.
select pg_temp.login('9d000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'ACTIVE reads material');
select pg_temp.assert_true(exists(select 1 from public.materials where id='81710000-0000-4000-8000-000000000001'),'ACTIVE sees material row (RLS)');
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'ACTIVE reads lesson asset');
select pg_temp.assert_true(exists(select 1 from public.lesson_assets where id='43000000-0000-4000-8000-000000000001'),'ACTIVE sees lesson asset row (RLS)');
select pg_temp.assert_true(private.can_read_live_recording('9d500000-0000-4000-8000-000000000001'),'ACTIVE booked reads recording');
select pg_temp.assert_true(private.can_read_session_resource('9d4f0000-0000-4000-8000-000000000001'),'ACTIVE booked reads session resource');
-- Stage 13: the seed practice belongs to lesson 2; the Student must have reached it (started it) to start the practice.
select public.record_lesson_progress('42000000-0000-4000-8000-000000000002',10,30);
select set_config('gate.attempt',(public.start_practice_attempt('83000000-0000-4000-8000-000000000001',gen_random_uuid())).id::text,true);
select pg_temp.assert_true(public.get_live_session_join_access('9d4f0000-0000-4000-8000-000000000001')->>'status'='AVAILABLE','ACTIVE booked joins the room');
select pg_temp.assert_true(public.book_live_session('9d4f0000-0000-4000-8000-000000000002') is not null,'ACTIVE books');
-- A student cannot read another student's billing or progress.
select pg_temp.assert_true((select count(*) from public.subscriptions)=1,'student sees only own subscription');
select pg_temp.assert_true(pg_temp.denied('select private.has_paid_access(''9d000000-0000-4000-8000-000000000002'')'),'student cannot call has_paid_access');
reset role;

-- 3. Each suspended status denies every chokepoint.
do $$
declare u record;
begin
  for u in select n, id from (values (2,'9d000000-0000-4000-8000-000000000002'::uuid),(3,'9d000000-0000-4000-8000-000000000003'::uuid),(4,'9d000000-0000-4000-8000-000000000004'::uuid)) v(n,id) loop
    perform pg_temp.login(u.id);
    set local role authenticated;
    perform pg_temp.assert_true(not private.can_read_material('81710000-0000-4000-8000-000000000001'),'suspended '||u.n||' must not read material fn');
    perform pg_temp.assert_true(not exists(select 1 from public.materials where id='81710000-0000-4000-8000-000000000001'),'suspended '||u.n||' must not see material row');
    perform pg_temp.assert_true(not private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'suspended '||u.n||' must not read asset fn');
    perform pg_temp.assert_true(not exists(select 1 from public.lesson_assets where id='43000000-0000-4000-8000-000000000001'),'suspended '||u.n||' must not see asset row');
    perform pg_temp.assert_true(not private.can_read_live_recording('9d500000-0000-4000-8000-000000000001'),'suspended '||u.n||' must not read recording');
    perform pg_temp.assert_true(not private.can_read_session_resource('9d4f0000-0000-4000-8000-000000000001'),'suspended '||u.n||' must not read session resource');
    perform pg_temp.assert_true(pg_temp.denied('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',10,30)'),'suspended '||u.n||' must not record progress');
    perform pg_temp.assert_true(pg_temp.denied('select public.start_practice_attempt(''83000000-0000-4000-8000-000000000001'',gen_random_uuid())'),'suspended '||u.n||' must not start practice');
    perform pg_temp.assert_true(pg_temp.denied('select public.book_live_session(''9d4f0000-0000-4000-8000-000000000002'')'),'suspended '||u.n||' must not book');
    perform pg_temp.assert_true(public.get_live_session_join_access('9d4f0000-0000-4000-8000-000000000002')->>'status'='NOT_AUTHORIZED','suspended '||u.n||' without booking is not authorized');
    reset role;
  end loop;
end $$;
select pg_temp.logout();
select pg_temp.assert_true((select count(*)=0 from public.session_bookings where live_session_id='9d4f0000-0000-4000-8000-000000000002' and user_id in ('9d000000-0000-4000-8000-000000000002','9d000000-0000-4000-8000-000000000003','9d000000-0000-4000-8000-000000000004')),'denied bookings leave no row');
select pg_temp.assert_true((select count(*)=0 from public.lesson_progress where user_id in ('9d000000-0000-4000-8000-000000000002','9d000000-0000-4000-8000-000000000003','9d000000-0000-4000-8000-000000000004')),'denied progress leaves no row');
select pg_temp.assert_true((select count(*)=0 from public.practice_attempts where user_id in ('9d000000-0000-4000-8000-000000000002','9d000000-0000-4000-8000-000000000003','9d000000-0000-4000-8000-000000000004')),'denied practice leaves no attempt');

-- 4. PAST_DUE: booking is preserved but the room is closed; cancelling stays possible; rebooking is denied.
select pg_temp.assert_true((select status='BOOKED' from public.session_bookings where live_session_id='9d4f0000-0000-4000-8000-000000000001' and user_id='9d000000-0000-4000-8000-000000000002'),'PAST_DUE keeps the reservation');
select pg_temp.login('9d000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(public.get_live_session_join_access('9d4f0000-0000-4000-8000-000000000001')->>'status'='NOT_AUTHORIZED','PAST_DUE booked student cannot enter the room');
select pg_temp.assert_true(public.get_live_session_join_access('9d4f0000-0000-4000-8000-000000000001')->>'reason'='SUBSCRIPTION_SUSPENDED','join denial exposes the suspension reason');
-- Suspension is derived: enrollment stays ACTIVE and own history is still readable.
select pg_temp.assert_true((select count(*)=1 from public.enrollments where user_id='9d000000-0000-4000-8000-000000000002' and status='ACTIVE'),'suspension does not touch enrollment');
select pg_temp.assert_true(public.cancel_live_booking('9d4f0000-0000-4000-8000-000000000001') is not null,'suspended student can still cancel');
select pg_temp.assert_true(pg_temp.denied('select public.book_live_session(''9d4f0000-0000-4000-8000-000000000001'')'),'suspended student cannot rebook a cancelled booking');
reset role;
select pg_temp.assert_true((select status='CANCELLED' from public.session_bookings where live_session_id='9d4f0000-0000-4000-8000-000000000001' and user_id='9d000000-0000-4000-8000-000000000002'),'rebook denial keeps CANCELLED');

-- 5. Mid-flow suspension: an in-progress attempt cannot be submitted, then payment restores it.
select pg_temp.logout();
update public.subscriptions set status='PAST_DUE' where id='9d300000-0000-4000-8000-000000000001';
select pg_temp.login('9d000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(pg_temp.denied('select public.submit_practice_attempt('''||current_setting('gate.attempt')||'''::uuid,''{"optionId":"meet"}''::jsonb)'),'PAST_DUE cannot submit in-progress practice');
select pg_temp.assert_true(not private.can_read_material('81710000-0000-4000-8000-000000000001'),'S1 loses content when it turns PAST_DUE');
reset role;
select pg_temp.assert_true((select status='IN_PROGRESS' from public.practice_attempts where id=current_setting('gate.attempt')::uuid),'denied submit leaves attempt IN_PROGRESS');
select pg_temp.assert_true((select completion_percent=10 from public.lesson_progress where user_id='9d000000-0000-4000-8000-000000000001'),'suspension preserves progress');
-- Normalization (CONFIRMED -> ACTIVE) restores access with no other state change.
update public.subscriptions set status='ACTIVE' where id in ('9d300000-0000-4000-8000-000000000001','9d300000-0000-4000-8000-000000000002');
select pg_temp.login('9d000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'ACTIVE again restores material');
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'ACTIVE again restores asset');
select public.submit_practice_attempt(current_setting('gate.attempt')::uuid,'{"optionId":"meet"}'::jsonb);
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',20,40);
reset role;
select pg_temp.login('9d000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'S2 regains content after normalization');
select pg_temp.assert_true(private.can_read_session_resource('9d4f0000-0000-4000-8000-000000000001') = false,'cancelled booking still has no session resource access');
select pg_temp.assert_true(public.book_live_session('9d4f0000-0000-4000-8000-000000000001') is not null,'S2 can rebook after normalization');
select pg_temp.assert_true(public.get_live_session_join_access('9d4f0000-0000-4000-8000-000000000001')->>'status'='AVAILABLE','S2 joins after normalization');
reset role;

-- 6. Re-subscription: an old EXPIRED row plus a new ACTIVE/TRIALING one grants access; TRIALING counts as paid.
select pg_temp.logout();
insert into public.subscriptions(user_id,plan_id,provider,status) values('9d000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000003','test','TRIALING');
select pg_temp.assert_true(private.has_paid_access('9d000000-0000-4000-8000-000000000003'),'TRIALING plus old EXPIRED row has paid access');
select pg_temp.login('9d000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'TRIALING reads lesson asset');
reset role;

-- 7. Stage 11: a Student without subscription is denied everywhere until an explicit grant exists; staff stay exempt.
select pg_temp.login('9d000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.assert_true(not private.can_read_material('81710000-0000-4000-8000-000000000001'),'no-subscription student cannot read material');
select pg_temp.assert_true(not private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'no-subscription student cannot read asset');
select pg_temp.assert_true(pg_temp.denied('select public.record_lesson_progress(''42000000-0000-4000-8000-000000000001'',5,10)'),'no-subscription student cannot record progress');
select pg_temp.assert_true(pg_temp.denied('select public.start_practice_attempt(''83000000-0000-4000-8000-000000000001'',gen_random_uuid())'),'no-subscription student cannot start practice');
select pg_temp.assert_true(pg_temp.denied('select public.book_live_session(''9d4f0000-0000-4000-8000-000000000002'')'),'no-subscription student cannot book');
reset role;
-- The Admin grant (or the legacy backfill) restores base access.
insert into public.complimentary_access_grants(user_id,reason,note) values('9d000000-0000-4000-8000-000000000005','LEGACY_BACKFILL','fixture');
select pg_temp.login('9d000000-0000-4000-8000-000000000005');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'legacy student with grant reads material');
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'legacy student with grant reads asset');
select public.record_lesson_progress('42000000-0000-4000-8000-000000000001',5,10);
select pg_temp.assert_true(public.book_live_session('9d4f0000-0000-4000-8000-000000000002') is not null,'legacy student with grant books');
reset role;
select pg_temp.login('9d000000-0000-4000-8000-000000000007','aal2');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'TEACHER with PAST_DUE row still reads material');
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'TEACHER still reads asset');
select pg_temp.assert_true(private.can_read_live_recording('9d500000-0000-4000-8000-000000000001'),'TEACHER of session still reads recording');
select pg_temp.assert_true(private.can_read_session_resource('9d4f0000-0000-4000-8000-000000000001'),'TEACHER of session still reads resource');
select pg_temp.assert_true(public.get_live_session_join_access('9d4f0000-0000-4000-8000-000000000001')->>'status'='AVAILABLE','TEACHER of session still enters the room');
reset role;
select pg_temp.login('9d000000-0000-4000-8000-000000000008','aal2');
set local role authenticated;
select pg_temp.assert_true(private.can_read_material('81710000-0000-4000-8000-000000000001'),'ADMIN with EXPIRED row still reads material');
select pg_temp.assert_true(private.can_read_lesson_asset('43000000-0000-4000-8000-000000000001'),'ADMIN still reads asset');
reset role;

-- 8. Cross-student isolation: S6 (ACTIVE) sees neither S2's billing nor progress.
select pg_temp.login('9d000000-0000-4000-8000-000000000006');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.subscriptions where user_id<>'9d000000-0000-4000-8000-000000000006')=0,'student cannot read another subscription');
select pg_temp.assert_true((select count(*) from public.lesson_progress where user_id<>'9d000000-0000-4000-8000-000000000006')=0,'student cannot read another progress');
select pg_temp.assert_true((select count(*) from public.practice_attempts where user_id<>'9d000000-0000-4000-8000-000000000006')=0,'student cannot read another practice attempt');
reset role;
select pg_temp.logout();
rollback;
