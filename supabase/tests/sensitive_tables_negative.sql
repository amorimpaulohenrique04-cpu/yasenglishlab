-- Stage 08: negative access tests for sensitive tables with little coverage elsewhere.
-- anon and a Student with no relation to any of the rows must neither read nor write them.
-- Real behaviors asserted (from the migrations):
--   fully revoked from anon/authenticated (any statement -> 42501): lesson_video_assets, media_provider_events,
--     teacher_courses, practice_response_media
--   authenticated has SELECT only + RLS (unrelated Student sees 0 rows; writes -> 42501): live_session_recordings
--     (column grants), teacher_student_notes, student_schedule_preferences, cohort_placement_settings,
--     placement_transfers (admin-only policies)
--   anon has no privilege at all on any of them (every statement -> 42501).
-- Transactional: everything rolls back.
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
-- The statement must fail with insufficient_privilege (42501); success or any other error fails the test.
create function pg_temp.expect_denied(label text, q text) returns void language plpgsql as $$
begin
  execute q;
  raise exception '% was allowed', label;
exception when insufficient_privilege then null;
end $$;
-- Reads the table as the current role, then attempts INSERT, UPDATE and DELETE.
-- expected_read is 'DENIED' (42501) or the row count the role must see.
create function pg_temp.check_table(who text, tbl text, col text, expected_read text) returns void language plpgsql as $$
declare n bigint; got text;
begin
  begin
    execute format('select count(*) from %s', tbl) into n;
    got := n::text;
  exception when insufficient_privilege then got := 'DENIED';
  end;
  if got <> expected_read then
    raise exception '% reading %: expected % got %', who, tbl, expected_read, got;
  end if;
  perform pg_temp.expect_denied(who || ' INSERT ' || tbl, format('insert into %s default values', tbl));
  perform pg_temp.expect_denied(who || ' UPDATE ' || tbl, format('update %s set %I = %I', tbl, col, col));
  perform pg_temp.expect_denied(who || ' DELETE ' || tbl, format('delete from %s', tbl));
end $$;

-- Users: S unrelated Student; O owns the data; T teacher; A admin.
insert into auth.users(id,email) values
 ('9f000000-0000-4000-8000-000000000001','neg-stranger@example.test'),
 ('9f000000-0000-4000-8000-000000000002','neg-owner@example.test'),
 ('9f000000-0000-4000-8000-000000000003','neg-teacher@example.test'),
 ('9f000000-0000-4000-8000-000000000004','neg-admin@example.test');
insert into public.user_roles(user_id,role) values
 ('9f000000-0000-4000-8000-000000000001','STUDENT'),
 ('9f000000-0000-4000-8000-000000000002','STUDENT'),
 ('9f000000-0000-4000-8000-000000000003','TEACHER'),
 ('9f000000-0000-4000-8000-000000000004','ADMIN');
insert into public.teachers(id,user_id) values('9f100000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000003');
insert into public.live_sessions(id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status,meeting_provider,meeting_ref) values
 ('9f400000-0000-4000-8000-000000000001','9f100000-0000-4000-8000-000000000001','WORKSHOP','Neg session',now()+interval '2 days',now()+interval '2 days 1 hour',6,null,'SCHEDULED','MANUAL_EXTERNAL','https://meet.example.test/neg');
insert into public.live_session_recordings(id,live_session_id,storage_path) values
 ('9f500000-0000-4000-8000-000000000001','9f400000-0000-4000-8000-000000000001','neg/recording.mp4');
insert into public.lesson_video_assets(lesson_asset_id) values('43000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.media_provider_events(provider,event_id,event_type) values('MUX','neg-event-1','video.asset.ready');
insert into public.teacher_courses(teacher_id,course_id,created_by_user_id)
 values('9f100000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000004');
insert into public.teacher_student_notes(id,teacher_id,student_user_id,body)
 values('9f600000-0000-4000-8000-000000000001','9f100000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000002','Private note');
insert into public.practice_attempts(id,user_id,practice_activity_id)
 values('9f700000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000001');
insert into public.practice_response_media(practice_attempt_id,storage_path,mime_type)
 values('9f700000-0000-4000-8000-000000000001','neg/audio.webm','audio/webm');
insert into public.subscriptions(id,user_id,plan_id,provider,status)
 values('9f300000-0000-4000-8000-000000000002','9f000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000003','test','ACTIVE');
insert into public.placement_cases(id,user_id,subscription_id)
 values('9f800000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000002','9f300000-0000-4000-8000-000000000002');
insert into public.student_schedule_preferences(placement_case_id,timezone,weekday,start_minute,end_minute)
 values('9f800000-0000-4000-8000-000000000001','America/Sao_Paulo',1,540,600);

-- 0. The negative tests are not vacuous: the seeded tables hold rows when read with owner privileges.
select pg_temp.assert_true((select count(*) from public.live_session_recordings)>=1,'recordings seeded');
select pg_temp.assert_true((select count(*) from public.lesson_video_assets)>=1,'video assets seeded');
select pg_temp.assert_true((select count(*) from public.media_provider_events)>=1,'provider events seeded');
select pg_temp.assert_true((select count(*) from public.teacher_courses)>=1,'teacher courses seeded');
select pg_temp.assert_true((select count(*) from public.teacher_student_notes)>=1,'teacher notes seeded');
select pg_temp.assert_true((select count(*) from public.practice_response_media)>=1,'response media seeded');
select pg_temp.assert_true((select count(*) from public.student_schedule_preferences)>=1,'schedule preferences seeded');

-- 1. Catalog-level: no write privilege for clients and no privilege at all for anon.
do $$
declare t text; r text;
begin
  foreach t in array array['public.lesson_video_assets','public.media_provider_events','public.teacher_courses',
    'public.live_session_recordings','public.teacher_student_notes','public.practice_response_media',
    'public.student_schedule_preferences','public.cohort_placement_settings','public.placement_transfers'] loop
    foreach r in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
      if has_any_column_privilege('anon', t, r) then raise exception 'anon has % on %', r, t; end if;
    end loop;
    if has_table_privilege('anon', t, 'DELETE') then raise exception 'anon has DELETE on %', t; end if;
    foreach r in array array['INSERT','UPDATE'] loop
      if has_any_column_privilege('authenticated', t, r) then raise exception 'authenticated has % on %', r, t; end if;
    end loop;
    if has_table_privilege('authenticated', t, 'DELETE') then raise exception 'authenticated has DELETE on %', t; end if;
  end loop;
  foreach t in array array['public.lesson_video_assets','public.media_provider_events','public.teacher_courses','public.practice_response_media'] loop
    if has_any_column_privilege('authenticated', t, 'SELECT') then raise exception 'authenticated can read %', t; end if;
  end loop;
end $$;

-- 2. anon: every statement is denied on every table.
select pg_temp.logout();
set local role anon;
select pg_temp.check_table('anon','public.lesson_video_assets','provider','DENIED');
select pg_temp.check_table('anon','public.media_provider_events','event_type','DENIED');
select pg_temp.check_table('anon','public.teacher_courses','created_at','DENIED');
select pg_temp.check_table('anon','public.live_session_recordings','storage_path','DENIED');
select pg_temp.check_table('anon','public.teacher_student_notes','body','DENIED');
select pg_temp.check_table('anon','public.practice_response_media','storage_path','DENIED');
select pg_temp.check_table('anon','public.student_schedule_preferences','timezone','DENIED');
select pg_temp.check_table('anon','public.cohort_placement_settings','capacity','DENIED');
select pg_temp.check_table('anon','public.placement_transfers','reason','DENIED');
reset role;

-- 3. Unrelated Student: revoked tables deny everything; RLS-scoped tables return 0 rows and deny writes.
select pg_temp.login('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.check_table('student','public.lesson_video_assets','provider','DENIED');
select pg_temp.check_table('student','public.media_provider_events','event_type','DENIED');
select pg_temp.check_table('student','public.teacher_courses','created_at','DENIED');
select pg_temp.check_table('student','public.practice_response_media','storage_path','DENIED');
select pg_temp.check_table('student','public.live_session_recordings','storage_path','0');
select pg_temp.check_table('student','public.teacher_student_notes','body','0');
select pg_temp.check_table('student','public.student_schedule_preferences','timezone','0');
select pg_temp.check_table('student','public.cohort_placement_settings','capacity','0');
select pg_temp.check_table('student','public.placement_transfers','reason','0');
reset role;

-- 4. The owner of the placement data is the only Student who sees its schedule preference (RLS is not blanket-deny).
select pg_temp.login('9f000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.student_schedule_preferences)=1,'owner sees own schedule preference');
select pg_temp.assert_true((select count(*) from public.teacher_student_notes)=0,'owner Student does not see teacher notes about self');
reset role;
select pg_temp.logout();
rollback;
