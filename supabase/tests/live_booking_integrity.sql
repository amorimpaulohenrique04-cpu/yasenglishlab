-- Stage 06b: live booking and attendance integrity (ADR 0008).
-- Teacher cancellation only releases BOOKED reservations of SCHEDULED sessions; Students cannot cancel after session
-- start or after attendance; attendance is marked only from session start and rectifications are reasoned + append-only.
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
-- The statement must fail with exactly this SQLSTATE and message; anything else (including success) fails the test.
create function pg_temp.expect_fail(q text, code text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlstate = code and sqlerrm = msg then return; end if;
    raise exception 'unexpected failure for [%]: % (%)', q, sqlerrm, sqlstate;
  end;
  raise exception 'statement unexpectedly succeeded: %', q;
end $$;
-- security definer: resolves ids regardless of the caller's RLS visibility (other Teachers must hit the scope check).
create function pg_temp.booking_of(p_session uuid, p_user uuid) returns uuid language sql security definer as $$
  select id from public.session_bookings where live_session_id = p_session and user_id = p_user;
$$;

-- S1/S2 ACTIVE Students, T1 owns every session, T2 is another Teacher, A1 is an Admin.
insert into auth.users(id,email) values
 ('9e000000-0000-4000-8000-000000000001','lbi-s1@example.test'),
 ('9e000000-0000-4000-8000-000000000002','lbi-s2@example.test'),
 ('9e000000-0000-4000-8000-000000000003','lbi-t1@example.test'),
 ('9e000000-0000-4000-8000-000000000004','lbi-t2@example.test'),
 ('9e000000-0000-4000-8000-000000000005','lbi-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('9e000000-0000-4000-8000-000000000001','STUDENT'),('9e000000-0000-4000-8000-000000000002','STUDENT'),
 ('9e000000-0000-4000-8000-000000000003','TEACHER'),('9e000000-0000-4000-8000-000000000004','TEACHER'),
 ('9e000000-0000-4000-8000-000000000005','ADMIN');
insert into public.teachers(id,user_id) values
 ('9e100000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000003'),
 ('9e100000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000004');
insert into public.subscriptions(user_id,plan_id,provider,status) values
 ('9e000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000003','test','ACTIVE'),
 ('9e000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000003','test','ACTIVE');

-- Sessions live in different weeks so the weekly quota of one never interferes with another.
--   P1 started yesterday (weekly_core_classes), P2 started 15 days ago (later COMPLETED), P3 started 30 days ago,
--   F1 starts in 20 days (weekly_core_classes), F2 starts in 40 days.
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key) values
 ('9e400000-0000-4000-8000-000000000001','9e100000-0000-4000-8000-000000000001','CORE_CLASS','LBI P1 late cancellation',now()-interval '1 day',now()-interval '23 hours',6,'weekly_core_classes'),
 ('9e400000-0000-4000-8000-000000000002','9e100000-0000-4000-8000-000000000001','CORE_CLASS','LBI P2 completed',now()-interval '15 days',now()-interval '15 days'+interval '1 hour',6,null),
 ('9e400000-0000-4000-8000-000000000003','9e100000-0000-4000-8000-000000000001','CORE_CLASS','LBI P3 started',now()-interval '30 days',now()-interval '30 days'+interval '1 hour',6,null),
 ('9e400000-0000-4000-8000-000000000004','9e100000-0000-4000-8000-000000000001','CORE_CLASS','LBI F1 early cancellation',now()+interval '20 days',now()+interval '20 days 1 hour',6,'weekly_core_classes'),
 ('9e400000-0000-4000-8000-000000000005','9e100000-0000-4000-8000-000000000001','CORE_CLASS','LBI F2 future',now()+interval '40 days',now()+interval '40 days 1 hour',6,null);

-- Privileged history import (no authenticated user): already-started sessions cannot be booked through commands.
select pg_temp.logout();
insert into public.session_bookings(live_session_id,user_id) values
 ('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001'),
 ('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002'),
 ('9e400000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000001'),
 ('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001');
update public.live_sessions set status='COMPLETED' where id='9e400000-0000-4000-8000-000000000002';
-- S2 cancelled P1 after it started: a late cancellation that keeps consuming quota.
update public.session_bookings set status='CANCELLED'
 where live_session_id='9e400000-0000-4000-8000-000000000001' and user_id='9e000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select cancelled_at >= usage_session_starts_at from public.session_bookings
  where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002')),'fixture must be a late cancellation');
select pg_temp.assert_true(private.booking_quota('9e000000-0000-4000-8000-000000000002','weekly_core_classes',
  (select starts_at from public.live_sessions where id='9e400000-0000-4000-8000-000000000001'))->>'used'='1','late cancellation consumes quota before teacher action');
select pg_temp.assert_true(private.booking_quota('9e000000-0000-4000-8000-000000000001','weekly_core_classes',
  (select starts_at from public.live_sessions where id='9e400000-0000-4000-8000-000000000001'))->>'used'='1','BOOKED consumes quota before teacher action');

-- (a) Teacher cancellation.
create temp table lbi_before as
  select b.id, b.status, b.cancelled_at,
         (select count(*) from public.audit_logs l where l.entity_id = b.id) as audit_count
  from public.session_bookings b where b.live_session_id='9e400000-0000-4000-8000-000000000001';
select pg_temp.login('9e000000-0000-4000-8000-000000000004','aal2');
set local role authenticated;
select pg_temp.expect_fail($$select public.cancel_teacher_live_session('9e400000-0000-4000-8000-000000000001')$$,'42501','teacher session unavailable');
reset role;
select pg_temp.assert_true((select count(*) from public.session_bookings where live_session_id='9e400000-0000-4000-8000-000000000001' and status='BOOKED')=1,'another Teacher cannot cancel the session');
select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select public.cancel_teacher_live_session('9e400000-0000-4000-8000-000000000001');
reset role;
select pg_temp.assert_true((select status from public.session_bookings where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001'))='TEACHER_CANCELLED','BOOKED becomes TEACHER_CANCELLED');
select pg_temp.assert_true((select status='CANCELLED' and cancelled_at is not distinct from (select cancelled_at from lbi_before where id=b.id)
  from public.session_bookings b where b.id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002')),'late CANCELLED booking is not rewritten');
select pg_temp.assert_true((select count(*) from public.audit_logs l where l.entity_id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002'))
  =(select audit_count from lbi_before where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002')),'late CANCELLED booking gets no new audit trail');
select pg_temp.assert_true((select count(*) from public.audit_logs l where l.entity_id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001'))
  >(select audit_count from lbi_before where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001')),'released booking keeps its audit trail');
select pg_temp.assert_true((select status from public.live_sessions where id='9e400000-0000-4000-8000-000000000001')='CANCELLED','session becomes CANCELLED');
select pg_temp.assert_true(private.booking_quota('9e000000-0000-4000-8000-000000000002','weekly_core_classes',
  (select starts_at from public.live_sessions where id='9e400000-0000-4000-8000-000000000001'))->>'used'='1','late cancellation keeps consuming quota after teacher cancellation');
select pg_temp.assert_true(private.booking_quota('9e000000-0000-4000-8000-000000000001','weekly_core_classes',
  (select starts_at from public.live_sessions where id='9e400000-0000-4000-8000-000000000001'))->>'used'='0','teacher cancellation releases BOOKED quota');
-- 1E: only the affected reservation is notified, with the agreed copy; the cancellation is audited once.
select pg_temp.assert_true((select count(*)=1 from public.notifications where user_id='9e000000-0000-4000-8000-000000000001' and notification_type='LIVE_SESSION_CANCELLED' and body like 'Esta aula foi cancelada.%nova data.' and data->>'live_session_id'='9e400000-0000-4000-8000-000000000001'),'affected student gets the cancellation notice');
select pg_temp.assert_true((select count(*)=0 from public.notifications where user_id='9e000000-0000-4000-8000-000000000002' and notification_type='LIVE_SESSION_CANCELLED' and data->>'live_session_id'='9e400000-0000-4000-8000-000000000001'),'unaffected student is not notified');
select pg_temp.assert_true((select count(*)=1 and bool_and((data->>'affected_bookings')::int=1) from public.audit_logs where action='TEACHER_SESSION_CANCELLED' and entity_id='9e400000-0000-4000-8000-000000000001'),'cancellation is audited with the affected count');
-- Idempotent retry: no error and no change.
create temp table lbi_after as
  select b.id, b.status, b.cancelled_at, (select count(*) from public.audit_logs l where l.entity_id = b.id) as audit_count
  from public.session_bookings b where b.live_session_id='9e400000-0000-4000-8000-000000000001';
set local role authenticated;
select public.cancel_teacher_live_session('9e400000-0000-4000-8000-000000000001');
reset role;
select pg_temp.assert_true((select count(*) from lbi_after a join (
    select b.id, b.status, b.cancelled_at, (select count(*) from public.audit_logs l where l.entity_id = b.id) as audit_count
    from public.session_bookings b where b.live_session_id='9e400000-0000-4000-8000-000000000001') n
  on n.id=a.id and n.status=a.status and n.cancelled_at is not distinct from a.cancelled_at and n.audit_count=a.audit_count)=2,'teacher cancellation retry is an idempotent no-op');

-- Teacher cannot cancel a COMPLETED session, so ATTENDED/NO_SHOW Students never get quota back.
set local role authenticated;
select pg_temp.expect_fail($$select public.cancel_teacher_live_session('9e400000-0000-4000-8000-000000000002')$$,'23514','only scheduled sessions can be cancelled');
reset role;
select pg_temp.assert_true((select status from public.session_bookings where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000001'))='BOOKED','COMPLETED session booking stays BOOKED');
select pg_temp.assert_true((select status from public.live_sessions where id='9e400000-0000-4000-8000-000000000002')='COMPLETED','COMPLETED session stays COMPLETED');

-- (b) Student cancellation.
select pg_temp.login('9e000000-0000-4000-8000-000000000001','aal1');
set local role authenticated;
select pg_temp.expect_fail($$select public.cancel_live_booking('9e400000-0000-4000-8000-000000000003')$$,'23514','booking cannot be cancelled after session start');
reset role;
select pg_temp.assert_true((select status from public.session_bookings where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'))='BOOKED','cancellation after start leaves the booking BOOKED');
-- Future session with attendance (legacy/privileged fact): cancellation is still denied.
set local role authenticated;
select public.book_live_session('9e400000-0000-4000-8000-000000000005');
reset role;
select pg_temp.logout();
insert into public.attendance(session_booking_id,status,marked_by_user_id)
 values(pg_temp.booking_of('9e400000-0000-4000-8000-000000000005','9e000000-0000-4000-8000-000000000001'),'NO_SHOW','9e000000-0000-4000-8000-000000000003');
select pg_temp.login('9e000000-0000-4000-8000-000000000001','aal1');
set local role authenticated;
select pg_temp.expect_fail($$select public.cancel_live_booking('9e400000-0000-4000-8000-000000000005')$$,'23514','booking cannot be cancelled after session start');
reset role;
select pg_temp.assert_true((select status from public.session_bookings where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000005','9e000000-0000-4000-8000-000000000001'))='BOOKED','cancellation after attendance leaves the booking BOOKED');
-- Early cancellation releases quota and is idempotent.
select pg_temp.login('9e000000-0000-4000-8000-000000000002','aal1');
set local role authenticated;
select public.book_live_session('9e400000-0000-4000-8000-000000000004');
reset role;
select pg_temp.assert_true(private.booking_quota('9e000000-0000-4000-8000-000000000002','weekly_core_classes',
  (select starts_at from public.live_sessions where id='9e400000-0000-4000-8000-000000000004'))->>'used'='1','booking consumes quota');
set local role authenticated;
select public.cancel_live_booking('9e400000-0000-4000-8000-000000000004');
select pg_temp.assert_true(public.cancel_live_booking('9e400000-0000-4000-8000-000000000004')=
  (select id from public.session_bookings where live_session_id='9e400000-0000-4000-8000-000000000004' and user_id='9e000000-0000-4000-8000-000000000002'),'cancellation retry is idempotent');
reset role;
select pg_temp.assert_true((select status='CANCELLED' and cancelled_at < usage_session_starts_at from public.session_bookings
  where live_session_id='9e400000-0000-4000-8000-000000000004' and user_id='9e000000-0000-4000-8000-000000000002'),'early cancellation is recorded before start');
select pg_temp.assert_true(private.booking_quota('9e000000-0000-4000-8000-000000000002','weekly_core_classes',
  (select starts_at from public.live_sessions where id='9e400000-0000-4000-8000-000000000004'))->>'used'='0','early cancellation releases quota');

-- (c) Attendance. Students and anonymous callers are denied.
select pg_temp.assert_true(has_function_privilege('authenticated','public.mark_teacher_attendance_v2(uuid,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.mark_teacher_attendance_v2(uuid,text,text)','EXECUTE'),'v2 grants: authenticated only');
select pg_temp.assert_true(has_function_privilege('authenticated','public.mark_teacher_attendance(uuid,text)','EXECUTE')
  and not has_function_privilege('anon','public.mark_teacher_attendance(uuid,text)','EXECUTE'),'legacy grants are preserved');
select pg_temp.login('9e000000-0000-4000-8000-000000000001','aal2');
set local role authenticated;
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'ATTENDED',null)$$,'42501','teacher role with aal2 required');
reset role;
-- Another Teacher is outside scope; scope is checked before the time window.
select pg_temp.login('9e000000-0000-4000-8000-000000000004','aal2');
set local role authenticated;
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'ATTENDED',null)$$,'42501','booking is outside teacher scope');
reset role;

select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
-- Not before the session starts.
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000005','9e000000-0000-4000-8000-000000000001'),'ATTENDED',null)$$,'23514','attendance cannot be marked before session start');
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance(pg_temp.booking_of('9e400000-0000-4000-8000-000000000005','9e000000-0000-4000-8000-000000000001'),'ATTENDED')$$,'23514','attendance cannot be marked before session start');
-- First marking needs no reason (through v2 and through the legacy signature).
select set_config('lbi.first_attendance', attendance_id::text, true), set_config('lbi.first_status', attendance_status, true)
  from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'ATTENDED',null);
select * from public.mark_teacher_attendance(pg_temp.booking_of('9e400000-0000-4000-8000-000000000002','9e000000-0000-4000-8000-000000000001'),'NO_SHOW');
reset role;
select pg_temp.assert_true(current_setting('lbi.first_status')='ATTENDED','first marking succeeds without a reason');
select pg_temp.assert_true((select count(*) from public.attendance_revisions r join public.session_bookings b on b.id=r.session_booking_id join public.live_sessions s on s.id=b.live_session_id where s.title like 'LBI %')=0,'first marking writes no revision');
select pg_temp.assert_true((select count(*) from public.audit_logs where action='attendance_marked' and entity_id=current_setting('lbi.first_attendance')::uuid)=1,'first marking is audited');
-- A started COMPLETED session still accepts attendance, but the Student can no longer cancel it.
select pg_temp.login('9e000000-0000-4000-8000-000000000001','aal1');
set local role authenticated;
select pg_temp.expect_fail($$select public.cancel_live_booking('9e400000-0000-4000-8000-000000000003')$$,'23514','booking cannot be cancelled after session start');
reset role;

select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
-- Same status again is an idempotent no-op (no reason, no revision).
select pg_temp.assert_true((select attendance_id from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'ATTENDED',null))
  =current_setting('lbi.first_attendance')::uuid,'same status retry reuses the attendance row');
-- Rectification without a valid reason is rejected, via v2 and via the legacy signature.
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'NO_SHOW',null)$$,'23514','attendance correction requires a reason');
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'NO_SHOW','   ')$$,'23514','attendance correction requires a reason');
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'NO_SHOW')$$,'23514','attendance correction requires a reason');
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'NO_SHOW',' ab ')$$,'23514','attendance correction reason must have 3 to 500 characters');
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'NO_SHOW',repeat('x',501))$$,'23514','attendance correction reason must have 3 to 500 characters');
select pg_temp.expect_fail($$select * from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'LATE','valid reason')$$,'23514','unsupported attendance status');
reset role;
select pg_temp.assert_true((select status from public.attendance where id=current_setting('lbi.first_attendance')::uuid)='ATTENDED','rejected rectifications leave the attendance untouched');
select pg_temp.assert_true((select count(*) from public.attendance_revisions r join public.session_bookings b on b.id=r.session_booking_id join public.live_sessions s on s.id=b.live_session_id where s.title like 'LBI %')=0,'rejected rectifications write no revision');
-- Rectification with a reason writes a revision and keeps the audit trail.
select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select pg_temp.assert_true((select attendance_status from public.mark_teacher_attendance_v2(pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'),'NO_SHOW','  Roster review: Student never joined  '))='NO_SHOW','rectification with reason succeeds');
reset role;
select pg_temp.assert_true((select count(*) from public.attendance where session_booking_id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'))=1,'rectification keeps UNIQUE(session_booking_id)');
select pg_temp.assert_true((select count(*) from public.attendance_revisions where attendance_id=current_setting('lbi.first_attendance')::uuid
  and session_booking_id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001')
  and previous_status='ATTENDED' and new_status='NO_SHOW' and reason='Roster review: Student never joined'
  and changed_by='9e000000-0000-4000-8000-000000000003')=1,'rectification writes exactly one trimmed, attributed revision');
select pg_temp.assert_true((select count(*) from public.audit_logs where action='attendance_marked' and entity_id=current_setting('lbi.first_attendance')::uuid
  and data->>'previous_status'='ATTENDED' and data->>'new_status'='NO_SHOW')=1,'rectification keeps the attendance audit trail');
select pg_temp.assert_true((select count(*) from public.audit_logs where action='attendance_marked' and entity_id=current_setting('lbi.first_attendance')::uuid)=2,'audit has the first marking and the rectification');

-- Revisions are append-only and not writable by clients.
select pg_temp.logout();
select pg_temp.expect_fail($$update public.attendance_revisions set reason='tampered reason'$$,'55000','historical record is immutable');
select pg_temp.expect_fail($$delete from public.attendance_revisions$$,'55000','historical record is immutable');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.attendance_revisions','INSERT')
  and not has_table_privilege('authenticated','public.attendance_revisions','UPDATE')
  and not has_table_privilege('authenticated','public.attendance_revisions','DELETE')
  and has_table_privilege('authenticated','public.attendance_revisions','SELECT'),'authenticated can only SELECT revisions');
select pg_temp.assert_true(not has_table_privilege('anon','public.attendance_revisions','SELECT')
  and not has_table_privilege('anon','public.attendance_revisions','INSERT')
  and not has_table_privilege('anon','public.attendance_revisions','UPDATE')
  and not has_table_privilege('anon','public.attendance_revisions','DELETE'),'anon has no access to revisions');
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.attendance_revisions'::regclass),'attendance_revisions has RLS enabled');
select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select pg_temp.expect_fail($$insert into public.attendance_revisions(attendance_id,session_booking_id,previous_status,new_status,reason,changed_by) values(gen_random_uuid(),gen_random_uuid(),'ATTENDED','NO_SHOW','forged','9e000000-0000-4000-8000-000000000003')$$,'42501','permission denied for table attendance_revisions');
select pg_temp.expect_fail($$update public.attendance_revisions set reason='tampered reason'$$,'42501','permission denied for table attendance_revisions');
select pg_temp.expect_fail($$delete from public.attendance_revisions$$,'42501','permission denied for table attendance_revisions');
select pg_temp.assert_true((select count(*) from public.attendance_revisions)=1,'session Teacher at AAL2 reads the revision');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.attendance_revisions)=0,'session Teacher at AAL1 reads no revision');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000004','aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.attendance_revisions)=0,'another Teacher reads no revision');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000001','aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.attendance_revisions)=0,'Student reads no revision');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000005','aal1');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.attendance_revisions)=0,'Admin at AAL1 reads no revision');
reset role;
select pg_temp.login('9e000000-0000-4000-8000-000000000005','aal2');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.attendance_revisions r join public.session_bookings b on b.id=r.session_booking_id join public.live_sessions s on s.id=b.live_session_id where s.title like 'LBI %')=1,'Admin at AAL2 reads the revision');
reset role;
-- A started SCHEDULED session with recorded attendance cannot be cancelled by the Teacher (quota must not be handed back).
select pg_temp.login('9e000000-0000-4000-8000-000000000003','aal2');
set local role authenticated;
select pg_temp.expect_fail($$select public.cancel_teacher_live_session('9e400000-0000-4000-8000-000000000003')$$,'23514','session with recorded attendance cannot be cancelled');
reset role;
select pg_temp.assert_true((select status from public.live_sessions where id='9e400000-0000-4000-8000-000000000003')='SCHEDULED','session with attendance stays SCHEDULED');
select pg_temp.assert_true((select status from public.session_bookings where id=pg_temp.booking_of('9e400000-0000-4000-8000-000000000003','9e000000-0000-4000-8000-000000000001'))='BOOKED','booking with attendance stays BOOKED');
select pg_temp.logout();
rollback;
