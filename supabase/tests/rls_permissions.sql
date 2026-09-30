-- Automated RLS / authorization evidence for PROMPT 06.
-- Runs after migrations + deterministic product seed in an isolated database.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('81000000-0000-0000-0000-000000000001', 'student-a@example.test', '{"display_name":"Student A"}'),
  ('81000000-0000-0000-0000-000000000002', 'student-b@example.test', '{"display_name":"Student B"}'),
  ('81000000-0000-0000-0000-000000000003', 'teacher-x@example.test', '{"display_name":"Teacher X"}'),
  ('81000000-0000-0000-0000-000000000004', 'teacher-y@example.test', '{"display_name":"Teacher Y"}'),
  ('81000000-0000-0000-0000-000000000005', 'support@example.test', '{"display_name":"Support"}'),
  ('81000000-0000-0000-0000-000000000006', 'admin@example.test', '{"display_name":"Admin"}')
on conflict (id) do nothing;

insert into public.user_roles (id, user_id, role)
values
  ('81100000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'STUDENT'),
  ('81100000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'STUDENT'),
  ('81100000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000003', 'TEACHER'),
  ('81100000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000004', 'TEACHER'),
  ('81100000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000005', 'SUPPORT'),
  ('81100000-0000-0000-0000-000000000006', '81000000-0000-0000-0000-000000000006', 'ADMIN')
on conflict (id) do nothing;

insert into public.teachers (id, user_id, active)
values
  ('81200000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003', true),
  ('81200000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000004', true)
on conflict (id) do nothing;

insert into public.teacher_student_assignments (
  id,
  teacher_id,
  student_user_id,
  course_id,
  starts_at
)
values (
  '81300000-0000-0000-0000-000000000001',
  '81200000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z'
)
on conflict (id) do nothing;

insert into public.courses (id, slug, title, description, active)
values (
  '40000000-0000-4000-8000-000000000099',
  'draft-learning-course',
  'Draft learning course',
  'Must remain invisible to students.',
  false
)
on conflict (id) do nothing;

insert into public.modules (id, course_id, position, title, description)
values (
  '41000000-0000-4000-8000-000000000099',
  '40000000-0000-4000-8000-000000000099',
  1,
  'Draft module',
  null
)
on conflict (id) do nothing;

insert into public.lessons (id, module_id, position, slug, title, estimated_minutes)
values (
  '42000000-0000-4000-8000-000000000099',
  '41000000-0000-4000-8000-000000000099',
  1,
  'draft-lesson',
  'Draft lesson',
  10
)
on conflict (id) do nothing;

insert into public.enrollments (id, user_id, course_id, status)
values
  (
    '81400000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'ACTIVE'
  ),
  (
    '81400000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'ACTIVE'
  ),
  (
    '81400000-0000-0000-0000-000000000099',
    '81000000-0000-0000-0000-000000000001',
    '40000000-0000-4000-8000-000000000099',
    'ACTIVE'
  )
on conflict (id) do nothing;

insert into public.lesson_progress (
  id,
  enrollment_id,
  lesson_id,
  status,
  completion_percent,
  started_at
)
values
  (
    '81500000-0000-0000-0000-000000000001',
    '81400000-0000-0000-0000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    'IN_PROGRESS',
    50,
    '2026-09-01T00:00:00Z'
  ),
  (
    '81500000-0000-0000-0000-000000000002',
    '81400000-0000-0000-0000-000000000002',
    '42000000-0000-4000-8000-000000000001',
    'IN_PROGRESS',
    25,
    '2026-09-01T00:00:00Z'
  )
on conflict (id) do nothing;

insert into public.subscriptions (
  id,
  user_id,
  plan_id,
  provider,
  provider_subscription_id,
  status,
  current_period_start,
  current_period_end
)
values
  (
    '81600000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'test',
    'rls_student_a',
    'ACTIVE',
    '2026-09-01T00:00:00Z',
    '2026-10-31T00:00:00Z'
  ),
  (
    '81600000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'test',
    'rls_student_b',
    'ACTIVE',
    '2026-09-01T00:00:00Z',
    '2026-10-31T00:00:00Z'
  )
on conflict (id) do nothing;

insert into public.materials (
  id,
  title,
  material_type,
  lesson_id,
  storage_path,
  required_entitlement_key,
  active
)
values (
  '81700000-0000-0000-0000-000000000001',
  'Conversation Lab paid material',
  'PDF',
  '42000000-0000-4000-8000-000000000001',
  'materials/rls-paid.pdf',
  'weekly_conversation_labs',
  true
)
on conflict (id) do nothing;

insert into public.live_sessions (
  id,
  teacher_id,
  session_type,
  title,
  starts_at,
  ends_at,
  capacity,
  required_entitlement_key,
  status
)
values (
  '81800000-0000-0000-0000-000000000001',
  '81200000-0000-0000-0000-000000000001',
  'CONVERSATION_LAB',
  'RLS Lab',
  '2026-09-30T12:00:00Z',
  '2026-09-30T13:00:00Z',
  2,
  'weekly_conversation_labs',
  'SCHEDULED'
)
on conflict (id) do nothing;

insert into public.session_bookings (
  id,
  live_session_id,
  user_id,
  status,
  booked_at
)
values (
  '81900000-0000-0000-0000-000000000001',
  '81800000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'BOOKED',
  '2026-09-29T00:00:00Z'
)
on conflict (id) do nothing;

insert into public.live_session_recordings (
  id,
  live_session_id,
  storage_path,
  required_entitlement_key,
  available_at
)
values (
  '82000000-0000-0000-0000-000000000001',
  '81800000-0000-0000-0000-000000000001',
  'recordings/rls-lab.mp4',
  'weekly_conversation_labs',
  '2026-09-30T13:00:00Z'
)
on conflict (id) do nothing;

insert into public.billing_events (
  id,
  provider,
  event_id,
  event_type,
  payload,
  occurred_at
)
values (
  '82100000-0000-0000-0000-000000000001',
  'test',
  'evt_rls_secret',
  'subscription.updated',
  '{"provider_secret":"must-not-be-visible"}',
  '2026-09-29T00:00:00Z'
)
on conflict (provider, event_id) do nothing;

set role authenticated;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","aal":"aal1"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.lesson_progress
  where id = '81500000-0000-0000-0000-000000000001';

  if visible_count <> 1 then
    raise exception 'Student A must read own progress';
  end if;

  select count(*) into visible_count
  from public.lesson_progress
  where id = '81500000-0000-0000-0000-000000000002';

  if visible_count <> 0 then
    raise exception 'Student A must not read Student B progress';
  end if;

  select count(*) into visible_count
  from public.courses
  where id = '40000000-0000-4000-8000-000000000099';

  if visible_count <> 0 then
    raise exception 'Student A must not read an inactive draft course';
  end if;

  select count(*) into visible_count
  from public.modules
  where id = '41000000-0000-4000-8000-000000000099';

  if visible_count <> 0 then
    raise exception 'Student A must not read modules inherited from a draft course';
  end if;

  select count(*) into visible_count
  from public.lessons
  where id = '42000000-0000-4000-8000-000000000099';

  if visible_count <> 0 then
    raise exception 'Student A must not read lessons inherited from a draft course';
  end if;

  begin
    perform public.record_lesson_progress(
      '42000000-0000-4000-8000-000000000099',
      50,
      120
    );
    raise exception 'Student A must not write progress for a draft course';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.track_product_event(
      'lesson_started',
      '42000000-0000-4000-8000-000000000099',
      '{}'::jsonb,
      'lesson_started:42000000-0000-4000-8000-000000000099'
    );
    raise exception 'Student A must not track analytics for a draft lesson';
  exception
    when insufficient_privilege then
      null;
  end;

  select count(*) into visible_count
  from public.materials
  where id = '81700000-0000-0000-0000-000000000001';

  if visible_count <> 1 then
    raise exception 'Student A with Talk entitlement must read paid material';
  end if;

  select count(*) into visible_count
  from public.live_session_recordings
  where id = '82000000-0000-0000-0000-000000000001';

  if visible_count <> 1 then
    raise exception 'Booked Student A with entitlement must read recording metadata';
  end if;
end;
$$;

do $$
begin
  if has_table_privilege(current_user, 'public.user_roles', 'INSERT')
    or has_table_privilege(current_user, 'public.user_roles', 'UPDATE')
    or has_table_privilege(current_user, 'public.user_roles', 'DELETE') then
    raise exception 'Authenticated users must not mutate roles directly';
  end if;

  if has_table_privilege(current_user, 'public.plan_entitlements', 'INSERT')
    or has_table_privilege(current_user, 'public.plan_entitlements', 'UPDATE')
    or has_table_privilege(current_user, 'public.plan_entitlements', 'DELETE') then
    raise exception 'Authenticated users must not mutate entitlements directly';
  end if;

  if has_table_privilege(current_user, 'public.lesson_progress', 'UPDATE') then
    raise exception 'Authenticated users must not manipulate progress directly';
  end if;

  if has_table_privilege(current_user, 'public.session_bookings', 'INSERT') then
    raise exception 'Authenticated users must not bypass booking service';
  end if;

  if has_column_privilege(current_user, 'public.materials', 'storage_path', 'SELECT')
    or has_column_privilege(current_user, 'public.lesson_assets', 'storage_path', 'SELECT')
    or has_column_privilege(current_user, 'public.live_session_recordings', 'storage_path', 'SELECT') then
    raise exception 'Authenticated Data API must not expose protected storage paths';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000002', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000002","aal":"aal1"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.lesson_progress
  where id = '81500000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Student B must not read Student A progress';
  end if;

  select count(*) into visible_count
  from public.materials
  where id = '81700000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Start student must not read Talk-only paid material';
  end if;

  select count(*) into visible_count
  from public.live_session_recordings
  where id = '82000000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Unbooked student must not read recording metadata';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000003', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000003","aal":"aal1"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.profiles
  where user_id = '81000000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Teacher at aal1 must not access assigned student';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000003","aal":"aal2"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.profiles
  where user_id = '81000000-0000-0000-0000-000000000001';

  if visible_count <> 1 then
    raise exception 'Teacher X at aal2 must access assigned Student A';
  end if;

  select count(*) into visible_count
  from public.profiles
  where user_id = '81000000-0000-0000-0000-000000000002';

  if visible_count <> 0 then
    raise exception 'Teacher X must not access unrelated Student B';
  end if;

  select count(*) into visible_count
  from public.lesson_progress
  where id = '81500000-0000-0000-0000-000000000001';

  if visible_count <> 1 then
    raise exception 'Teacher X must read assigned Student A progress';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000004', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000004","aal":"aal2"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.profiles
  where user_id = '81000000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Unassigned Teacher Y must not access Student A';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000005', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000005","aal":"aal2"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.billing_events
  where id = '82100000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Support must not access privileged billing events';
  end if;

  select count(*) into visible_count
  from public.lesson_progress
  where id = '81500000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Support must not access student learning progress by default';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000006', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000006","aal":"aal1"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.billing_events
  where id = '82100000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Admin at aal1 must not access privileged billing records';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000006","aal":"aal2"}',
  false
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.billing_events
  where id = '82100000-0000-0000-0000-000000000001';

  if visible_count <> 1 then
    raise exception 'Admin at aal2 must access billing event metadata';
  end if;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'Anonymous role must not have protected profile SELECT privilege';
  end if;

  if has_table_privilege('anon', 'public.lesson_progress', 'SELECT') then
    raise exception 'Anonymous role must not have protected progress SELECT privilege';
  end if;

  if has_table_privilege('anon', 'public.billing_events', 'SELECT') then
    raise exception 'Anonymous role must not have billing SELECT privilege';
  end if;
end;
$$;
