begin;
create function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception '%', message; end if;
end;
$$;
create function pg_temp.denied(command text, expected text default '42501')
returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate = expected then return; else raise; end if;
  end;
  raise exception 'Expected denial: %', command;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
  ('99300000-0000-4000-8000-000000000001', 'teachers-admin@example.test', '{"display_name":"Teacher Admin"}'),
  ('99300000-0000-4000-8000-000000000002', 'teacher-ops@example.test', '{"display_name":"Teacher Ops 100%"}'),
  ('99300000-0000-4000-8000-000000000003', 'teacher-ops-student@example.test', '{"display_name":"Teacher Ops Student"}'),
  ('99300000-0000-4000-8000-000000000004', 'teachers-support@example.test', '{"display_name":"Teacher Support"}'),
  ('99300000-0000-4000-8000-000000000005', 'teacher-reconcile@example.test', '{"display_name":"Teacher Reconcile"}')
on conflict (id) do nothing;
insert into public.user_roles(user_id, role) values
  ('99300000-0000-4000-8000-000000000001', 'ADMIN'),
  ('99300000-0000-4000-8000-000000000002', 'TEACHER'),
  ('99300000-0000-4000-8000-000000000003', 'STUDENT'),
  ('99300000-0000-4000-8000-000000000004', 'SUPPORT')
on conflict (user_id, role) do nothing;
insert into public.profiles(user_id, display_name) values
  ('99300000-0000-4000-8000-000000000001', 'Teacher Admin'),
  ('99300000-0000-4000-8000-000000000002', 'Teacher Ops 100%'),
  ('99300000-0000-4000-8000-000000000003', 'Teacher Ops Student'),
  ('99300000-0000-4000-8000-000000000004', 'Teacher Support'),
  ('99300000-0000-4000-8000-000000000005', 'Teacher Reconcile')
on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.teachers(id, user_id, active) values
  ('99310000-0000-4000-8000-000000000001', '99300000-0000-4000-8000-000000000002', true)
on conflict (id) do update set active = true;
insert into public.teacher_student_assignments(id, teacher_id, student_user_id, course_id, starts_at)
values ('99320000-0000-4000-8000-000000000001', '99310000-0000-4000-8000-000000000001',
  '99300000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', now() - interval '1 day')
on conflict (id) do nothing;
insert into public.practice_activities(id, slug, title, skill, estimated_minutes, content, active, publication_status, published_at)
values ('99330000-0000-4000-8000-000000000001', 'teacher-ops-pending-review', 'Teacher Ops pending review',
  'SPEAKING', 5, '{"kind":"MANUAL_AUDIO","evaluationMode":"MANUAL_PENDING","prompt":"Describe your day","instructions":"Record a short response"}',
  true, 'PUBLISHED', now())
on conflict (id) do nothing;
insert into public.practice_attempts(id, user_id, practice_activity_id, status, submitted_at)
values ('99340000-0000-4000-8000-000000000001', '99300000-0000-4000-8000-000000000003',
  '99330000-0000-4000-8000-000000000001', 'SUBMITTED', now())
on conflict (id) do nothing;
insert into public.practice_results(practice_attempt_id, evaluation_status)
values ('99340000-0000-4000-8000-000000000001', 'PENDING_MANUAL')
on conflict (practice_attempt_id) do update set evaluation_status = 'PENDING_MANUAL';
insert into public.courses(id, slug, title, active, publication_status, published_at)
values ('99350000-0000-4000-8000-000000000001', 'teacher-ops-track', 'Teacher Ops Track', true, 'PUBLISHED', now())
on conflict (id) do nothing;
insert into public.cohorts(id, course_id, name, code, status, timezone, starts_at)
values ('99360000-0000-4000-8000-000000000001', '99350000-0000-4000-8000-000000000001',
  'Teacher Ops Cohort', 'teacher-ops-cohort', 'ACTIVE', 'America/Recife', now() - interval '1 day')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '99300000-0000-4000-8000-000000000001', true),
       set_config('request.jwt.claims', '{"sub":"99300000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(teacher->>'email' = 'teacher-ops@example.test')
   from public.admin_teacher_directory('Teacher Ops', 25, 0) as teacher),
  'Admin AAL2 receives a bounded Teacher projection with safe email');
select pg_temp.assert_true(
  (select count(*) = 1 and bool_and(teacher->>'display_name' = 'Teacher Ops 100%')
   from public.admin_teacher_directory('100%', 25, 0) as teacher),
  'Teacher name search treats wildcard characters literally');
select pg_temp.assert_true(
  public.admin_find_teacher_identity('TEACHER-RECONCILE@example.test') = '99300000-0000-4000-8000-000000000005',
  'Admin AAL2 resolves an existing identity by case-normalized exact email');
select pg_temp.denied(
  'select public.admin_reconcile_teacher(''teacher-reconcile@example.test'',''99300000-0000-4000-8000-000000000001'')');
select pg_temp.denied('select * from public.admin_teacher_directory('''', 51, 0)', '22023');
select pg_temp.denied('select * from public.admin_teacher_directory('''', 25, -1)', '22023');
reset role;
set local role service_role;
select public.admin_reconcile_teacher(
  'teacher-reconcile@example.test', '99300000-0000-4000-8000-000000000001') as reconciled_teacher_id \gset
select pg_temp.assert_true(
  public.admin_reconcile_teacher('TEACHER-RECONCILE@example.test', '99300000-0000-4000-8000-000000000001') =
    :'reconciled_teacher_id'::uuid,
  'Server retry reconciles to the same Teacher record');
reset role;
select pg_temp.assert_true(
  (select count(*) = 1 from public.user_roles where user_id = '99300000-0000-4000-8000-000000000005' and role = 'TEACHER')
  and (select count(*) = 1 from public.teachers where user_id = '99300000-0000-4000-8000-000000000005'),
  'Identity reconciliation creates exactly one TEACHER role and one Teacher row');
select pg_temp.assert_true(
  (select count(*) = 1 from public.audit_logs where action = 'teacher_provisioned'
       and entity_id = (select id from public.teachers where user_id = '99300000-0000-4000-8000-000000000005')),
  'Teacher reconciliation is audited once, without duplicate retry events');
set local role service_role;
select pg_temp.denied(
  'select public.admin_reconcile_teacher(''missing-teacher@example.test'',''99300000-0000-4000-8000-000000000001'')', 'P0002');
reset role;
set local role authenticated;

select public.admin_set_teacher_course('99310000-0000-4000-8000-000000000001',
  '99350000-0000-4000-8000-000000000001', true);
select public.admin_set_teacher_course('99310000-0000-4000-8000-000000000001',
  '99350000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  (select jsonb_array_length(teacher->'courses') = 1
   from public.admin_teacher_directory('teacher-ops@example.test', 25, 0) as teacher)
  and (select count(*) = 1 from public.audit_logs where action = 'teacher_course_capability_changed'
       and entity_id = '99310000-0000-4000-8000-000000000001'),
  'Course capability uses existing published Course and retry is idempotent');
select public.admin_set_teacher_course('99310000-0000-4000-8000-000000000001',
  '99350000-0000-4000-8000-000000000001', false);

select public.manage_cohort('ADD_TEACHER', '99360000-0000-4000-8000-000000000001',
  '{"teacher_id":"99310000-0000-4000-8000-000000000001","is_primary":true}'::jsonb);
select pg_temp.denied(
  'select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)', '23514');
reset role;
update public.practice_results set evaluation_status = 'MANUAL_REVIEWED'
where practice_attempt_id = '99340000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.denied(
  'select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)', '23514');
select public.manage_cohort('REMOVE_TEACHER', '99360000-0000-4000-8000-000000000001',
  '{"teacher_id":"99310000-0000-4000-8000-000000000001","is_primary":true}'::jsonb);
select pg_temp.assert_true(
  exists(select 1 from public.cohort_teachers where teacher_id = '99310000-0000-4000-8000-000000000001'
    and cohort_id = '99360000-0000-4000-8000-000000000001' and is_primary and ends_at is not null),
  'Removing a primary cohort assignment ends but preserves its historical is_primary relation');
select public.manage_cohort('ADD_TEACHER', '99360000-0000-4000-8000-000000000001',
  '{"teacher_id":"99310000-0000-4000-8000-000000000001","is_primary":false}'::jsonb);
reset role;
insert into public.live_sessions(id, teacher_id, cohort_id, session_type, title, starts_at, ends_at, capacity, status)
values ('99370000-0000-4000-8000-000000000001', '99310000-0000-4000-8000-000000000001',
  '99360000-0000-4000-8000-000000000001', 'CORE_CLASS', 'Teacher Ops future session',
  now() + interval '1 day', now() + interval '1 day 1 hour', 2, 'SCHEDULED');
set local role authenticated;
select pg_temp.denied(
  'select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)', '23514');
reset role;
update public.live_sessions set status = 'CANCELLED' where id = '99370000-0000-4000-8000-000000000001';
set local role authenticated;
select public.manage_cohort('REMOVE_TEACHER', '99360000-0000-4000-8000-000000000001',
  '{"teacher_id":"99310000-0000-4000-8000-000000000001","is_primary":false}'::jsonb);
select public.admin_set_teacher_active('99310000-0000-4000-8000-000000000001', false);
select pg_temp.assert_true(
  (select not active from public.teachers where id = '99310000-0000-4000-8000-000000000001')
  and exists(select 1 from public.user_roles where user_id = '99300000-0000-4000-8000-000000000002' and role = 'TEACHER')
  and exists(select 1 from public.live_sessions where id = '99370000-0000-4000-8000-000000000001' and status = 'CANCELLED')
  and exists(select 1 from public.audit_logs where action = 'teacher_deactivated'
    and entity_id = '99310000-0000-4000-8000-000000000001'),
  'Deactivation is audited and preserves role, session, and history');
select public.admin_set_teacher_active('99310000-0000-4000-8000-000000000001', true);

select set_config('request.jwt.claim.sub', '99300000-0000-4000-8000-000000000001', true),
       set_config('request.jwt.claims', '{"sub":"99300000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select pg_temp.denied('select * from public.admin_teacher_directory('''', 25, 0)');
select pg_temp.denied('select public.admin_find_teacher_identity(''teacher-ops@example.test'')');
select pg_temp.denied('select public.admin_reconcile_teacher(''teacher-ops@example.test'',''99300000-0000-4000-8000-000000000002'')');
select pg_temp.denied('select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)');
select pg_temp.denied('select public.admin_set_teacher_course(''99310000-0000-4000-8000-000000000001'',''99350000-0000-4000-8000-000000000001'',true)');

select set_config('request.jwt.claim.sub', '99300000-0000-4000-8000-000000000002', true),
       set_config('request.jwt.claims', '{"sub":"99300000-0000-4000-8000-000000000002","aal":"aal2"}', true);
select pg_temp.denied('select * from public.admin_teacher_directory('''', 25, 0)');
select pg_temp.denied('select public.admin_reconcile_teacher(''teacher-ops@example.test'',''99300000-0000-4000-8000-000000000003'')');
select pg_temp.denied('select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)');
select pg_temp.denied('update public.teachers set active = false where user_id = auth.uid()');
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.user_roles', 'DELETE')
  and not has_table_privilege('authenticated', 'public.teachers', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.teacher_courses', 'INSERT')
  and not has_table_privilege('authenticated', 'public.teacher_courses', 'DELETE'),
  'Teacher cannot change own role or status and direct role/capability DML remains denied');

select set_config('request.jwt.claim.sub', '99300000-0000-4000-8000-000000000003', true),
       set_config('request.jwt.claims', '{"sub":"99300000-0000-4000-8000-000000000003","aal":"aal2"}', true);
select pg_temp.denied('select * from public.admin_teacher_directory('''', 25, 0)');
select pg_temp.denied('select public.admin_reconcile_teacher(''teacher-ops@example.test'',''99300000-0000-4000-8000-000000000003'')');
select pg_temp.denied('select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)');

select set_config('request.jwt.claim.sub', '99300000-0000-4000-8000-000000000004', true),
       set_config('request.jwt.claims', '{"sub":"99300000-0000-4000-8000-000000000004","aal":"aal2"}', true);
select pg_temp.denied('select * from public.admin_teacher_directory('''', 25, 0)');
select pg_temp.denied('select public.admin_reconcile_teacher(''teacher-ops@example.test'',''99300000-0000-4000-8000-000000000004'')');
select pg_temp.denied('select public.admin_set_teacher_active(''99310000-0000-4000-8000-000000000001'', false)');

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select pg_temp.denied('select * from public.admin_teacher_directory('''', 25, 0)');
reset role;
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.teacher_courses'::regclass)
  and not has_function_privilege('anon', 'public.admin_teacher_directory(text,integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_teacher_directory(text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.admin_reconcile_teacher(text,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.admin_reconcile_teacher(text,uuid)', 'EXECUTE')
  and not has_table_privilege('authenticated', 'public.teacher_courses', 'SELECT'),
  'Capability relation remains RLS protected and closed; Admin directory RPC is authenticated-only');
rollback;
