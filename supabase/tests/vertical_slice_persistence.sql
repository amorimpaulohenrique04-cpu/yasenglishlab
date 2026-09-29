-- PROMPT 07 — Integration evidence for canonical lesson persistence.
-- Uses the same authenticated RPC exposed to the application.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('83000000-0000-0000-0000-000000000001', 'slice-a@example.test', '{"display_name":"Slice Student A"}'),
  ('83000000-0000-0000-0000-000000000002', 'slice-b@example.test', '{"display_name":"Slice Student B"}')
on conflict (id) do nothing;

insert into public.user_roles (id, user_id, role)
values
  ('83100000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'STUDENT'),
  ('83100000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', 'STUDENT')
on conflict (id) do nothing;

insert into public.enrollments (id, user_id, course_id, status)
values
  (
    '83200000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'ACTIVE'
  ),
  (
    '83200000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    'ACTIVE'
  )
on conflict (id) do nothing;

set role authenticated;

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000001","aal":"aal1"}',
  false
);

do $$
declare
  saved public.lesson_progress;
begin
  saved := public.record_lesson_progress(
    '42000000-0000-4000-8000-000000000001',
    25,
    150
  );

  if saved.user_id <> '83000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'RPC must derive Student A user_id from auth.uid()';
  end if;

  if saved.completion_percent <> 25 or saved.last_position_seconds <> 150 then
    raise exception 'First progress checkpoint was not persisted';
  end if;

  saved := public.record_lesson_progress(
    '42000000-0000-4000-8000-000000000001',
    50,
    300
  );

  if saved.completion_percent <> 50 or saved.last_position_seconds <> 300 then
    raise exception 'Progress did not resume from persisted state';
  end if;

  perform public.track_product_event(
    'lesson_started',
    '42000000-0000-4000-8000-000000000001',
    '{}'::jsonb
  );
  perform public.track_product_event(
    'lesson_progressed',
    '42000000-0000-4000-8000-000000000001',
    '{"completion_percent":50}'::jsonb
  );
end;
$$;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.lesson_progress
  where user_id = '83000000-0000-0000-0000-000000000002';

  if visible_count <> 0 then
    raise exception 'Student A must not read Student B progress';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000002', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"83000000-0000-0000-0000-000000000002","aal":"aal1"}',
  false
);

do $$
declare
  saved public.lesson_progress;
  visible_count integer;
begin
  saved := public.record_lesson_progress(
    '42000000-0000-4000-8000-000000000001',
    20,
    120
  );

  if saved.user_id <> '83000000-0000-0000-0000-000000000002'::uuid then
    raise exception 'RPC must derive Student B user_id from auth.uid()';
  end if;

  select count(*) into visible_count
  from public.lesson_progress
  where user_id = '83000000-0000-0000-0000-000000000001';

  if visible_count <> 0 then
    raise exception 'Student B must not read Student A progress';
  end if;
end;
$$;

reset role;

do $$
declare
  persisted_percent numeric;
  persisted_position integer;
  analytics_count integer;
begin
  select completion_percent, last_position_seconds
  into persisted_percent, persisted_position
  from public.lesson_progress
  where user_id = '83000000-0000-0000-0000-000000000001'
    and lesson_id = '42000000-0000-4000-8000-000000000001';

  if persisted_percent <> 50 or persisted_position <> 300 then
    raise exception 'Canonical persisted checkpoint must survive session changes';
  end if;

  select count(*) into analytics_count
  from public.product_analytics_events
  where user_id = '83000000-0000-0000-0000-000000000001'
    and event_name in ('lesson_started', 'lesson_progressed');

  if analytics_count <> 2 then
    raise exception 'Canonical analytics events were not persisted';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.record_lesson_progress(uuid,numeric,integer)',
    'EXECUTE'
  ) is not true then
    raise exception 'Authenticated student must be able to call progress RPC';
  end if;

  if has_table_privilege('authenticated', 'public.lesson_progress', 'UPDATE') then
    raise exception 'Direct lesson_progress UPDATE must remain denied';
  end if;
end;
$$;
