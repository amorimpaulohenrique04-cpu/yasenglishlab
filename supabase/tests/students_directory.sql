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

insert into auth.users(id, email) values
  ('99100000-0000-4000-8000-000000000001', 'directory-admin@example.test'),
  ('99100000-0000-4000-8000-000000000002', 'directory-teacher@example.test'),
  ('99100000-0000-4000-8000-000000000003', 'directory-student@example.test'),
  ('99100000-0000-4000-8000-000000000011', 'directory-ana-percent@example.test'),
  ('99100000-0000-4000-8000-000000000012', 'directory-ana@example.test'),
  ('99100000-0000-4000-8000-000000000013', 'directory-bruno@example.test');
insert into public.user_roles(user_id, role) values
  ('99100000-0000-4000-8000-000000000001', 'ADMIN'),
  ('99100000-0000-4000-8000-000000000002', 'TEACHER'),
  ('99100000-0000-4000-8000-000000000003', 'STUDENT'),
  ('99100000-0000-4000-8000-000000000011', 'STUDENT'),
  ('99100000-0000-4000-8000-000000000012', 'STUDENT'),
  ('99100000-0000-4000-8000-000000000013', 'STUDENT');
insert into public.profiles(user_id, display_name) values
  ('99100000-0000-4000-8000-000000000001', 'Directory Admin'),
  ('99100000-0000-4000-8000-000000000002', 'Directory Teacher'),
  ('99100000-0000-4000-8000-000000000003', 'Directory Student'),
  ('99100000-0000-4000-8000-000000000011', 'Directory Ana 100%'),
  ('99100000-0000-4000-8000-000000000012', 'Directory Ana Silva'),
  ('99100000-0000-4000-8000-000000000013', 'Bruno Lima')
on conflict (user_id) do update set display_name = excluded.display_name;
insert into public.enrollments(id, user_id, course_id, status) values
  ('99110000-0000-4000-8000-000000000011',
   '99100000-0000-4000-8000-000000000011',
   '40000000-0000-4000-8000-000000000001',
   'ACTIVE');
insert into public.cohorts(id, course_id, name, code, status, starts_at) values
  ('99120000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000001', 'Directory Cohort', 'directory-cohort', 'ACTIVE', now() - interval '1 day');
insert into public.cohort_memberships(cohort_id, user_id, enrollment_id) values
  ('99120000-0000-4000-8000-000000000011', '99100000-0000-4000-8000-000000000011', '99110000-0000-4000-8000-000000000011');

set local role authenticated;
select set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000001', true),
       set_config('request.jwt.claims', '{"sub":"99100000-0000-4000-8000-000000000001","aal":"aal2"}', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.admin_student_directory('Directory Ana', 50, 0)),
  'Admin AAL2 receives matching Student rows');
select pg_temp.assert_true(
  (select count(*) = 1 from public.admin_student_directory('Directory Ana', 1, 0))
  and (select count(*) = 1 from public.admin_student_directory('Directory Ana', 1, 1))
  and (select user_id <> (select user_id from public.admin_student_directory('Directory Ana', 1, 0))
       from public.admin_student_directory('Directory Ana', 1, 1)),
  'limit and offset paginate matching name results without overlap');
select pg_temp.assert_true(
  (select count(*) = 1 from public.admin_student_directory('100%', 50, 0)
   where display_name = 'Directory Ana 100%'),
  'LIKE wildcard is treated as a literal search character');
select pg_temp.assert_true(
  (select count(*) = 1 from public.admin_student_directory('Directory', 50, 0)
   where user_id = '99100000-0000-4000-8000-000000000003'),
  'non-Student profiles are omitted');
select pg_temp.assert_true(
  (select count(*) = 1
     and max(lessons_total) > 0
     and max(completion_percent) = 0
   from public.admin_student_curriculum_summary('99100000-0000-4000-8000-000000000011')),
  'Admin AAL2 gets an active-course curriculum summary with canonical completion semantics');
select pg_temp.assert_true(
  (select count(*) = 1
     and bool_and(enrollment_status = 'ACTIVE')
     and bool_and(cohort_id = '99120000-0000-4000-8000-000000000011'::uuid)
     and bool_and(cohort_name = 'Directory Cohort')
     and bool_and(completion_percent = 0)
     and bool_and(course_title = (select title from public.courses where id = '40000000-0000-4000-8000-000000000001'))
   from public.admin_student_directory_v2('', 50, 0, '40000000-0000-4000-8000-000000000001', null, null, 'ACTIVE')
   where user_id = '99100000-0000-4000-8000-000000000011'),
  'bounded directory projection includes real course, cohort, enrollment, and curriculum state');
select pg_temp.assert_true(
  (select count(*) = 1 from public.admin_student_directory_v2('Directory Ana', 1, 0, null, null, null, null)
   where display_name = 'Directory Ana 100%')
  and (select count(*) = 1 from public.admin_student_directory_v2('Directory Ana', 1, 1, null, null, null, null)
   where display_name = 'Directory Ana Silva'),
  'new directory RPC searches names and returns bounded non-overlapping pages');
select pg_temp.assert_true(
  (select count(*) = 1 from public.admin_student_directory_v2('', 50, 0, null, '99120000-0000-4000-8000-000000000011', null, null)
   where user_id = '99100000-0000-4000-8000-000000000011'),
  'directory cohort filter returns the selected cohort');
select pg_temp.denied('select * from public.admin_student_directory('''', 51, 0)', '22023');
select pg_temp.denied('select * from public.admin_student_directory('''', 1, -1)', '22023');
select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass)
  and not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.profiles', 'DELETE')
  and not has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.user_roles', 'DELETE'),
  'source tables remain RLS-protected and not globally writable');
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.admin_student_directory(text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_student_directory(text,integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.admin_student_directory_v2(text,integer,integer,uuid,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_student_directory_v2(text,integer,integer,uuid,uuid,text,text)', 'EXECUTE'),
  'only authenticated callers receive the RPC grant; function enforces Admin AAL2');

select set_config('request.jwt.claims', '{"sub":"99100000-0000-4000-8000-000000000001","aal":"aal1"}', true);
select pg_temp.denied('select * from public.admin_student_directory('''', 25, 0)');
select pg_temp.denied('select * from public.admin_student_directory_v2(null, 25, 0, null, null, null, null)');
select pg_temp.denied('select * from public.admin_student_curriculum_summary(''99100000-0000-4000-8000-000000000011'')');

select set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000002', true),
       set_config('request.jwt.claims', '{"sub":"99100000-0000-4000-8000-000000000002","aal":"aal2"}', true);
select pg_temp.denied('select * from public.admin_student_directory_v2(null, 25, 0, null, null, null, null)');
select pg_temp.denied('select * from public.admin_student_directory('''', 25, 0)');
select pg_temp.denied('select * from public.admin_student_curriculum_summary(''99100000-0000-4000-8000-000000000011'')');
select pg_temp.assert_true(
  (select count(*) = 0 from public.profiles where user_id = '99100000-0000-4000-8000-000000000011'),
  'unassigned Teacher cannot read Student profiles through base table RLS');

select set_config('request.jwt.claim.sub', '99100000-0000-4000-8000-000000000003', true),
       set_config('request.jwt.claims', '{"sub":"99100000-0000-4000-8000-000000000003","aal":"aal2"}', true);
select pg_temp.denied('select * from public.admin_student_directory_v2(null, 25, 0, null, null, null, null)');
select pg_temp.denied('select * from public.admin_student_directory('''', 25, 0)');
select pg_temp.denied('select * from public.admin_student_curriculum_summary(''99100000-0000-4000-8000-000000000011'')');
select pg_temp.assert_true(
  (select count(*) = 0 from public.profiles where user_id = '99100000-0000-4000-8000-000000000011')
  and (select count(*) = 0 from public.user_roles where user_id = '99100000-0000-4000-8000-000000000011'),
  'Student cannot read another Student profile or role through base table RLS');

reset role;
set local role anon;
select pg_temp.denied('select * from public.admin_student_directory_v2(null, 25, 0, null, null, null, null)');
reset role;
select pg_temp.assert_true(
  (select prosecdef from pg_proc where oid = 'public.admin_student_directory(text,integer,integer)'::regprocedure)
  and not has_table_privilege('authenticated', 'public.courses', 'INSERT')
  and not has_table_privilege('authenticated', 'public.enrollments', 'INSERT'),
  'RPC is scoped and no source table has been opened for writes');
rollback;
