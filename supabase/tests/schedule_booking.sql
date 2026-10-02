-- P16 integration/RLS evidence for Agenda V1 and authenticated booking.
-- All time-sensitive fixtures are relative to the test clock.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('85000000-0000-0000-0000-000000000001', 'schedule-a@example.test', '{"display_name":"Schedule A"}'),
  ('85000000-0000-0000-0000-000000000002', 'schedule-b@example.test', '{"display_name":"Schedule B"}'),
  ('85000000-0000-0000-0000-000000000003', 'schedule-c@example.test', '{"display_name":"Schedule C"}'),
  ('85000000-0000-0000-0000-000000000004', 'schedule-teacher@example.test', '{"display_name":"Schedule Teacher"}')
on conflict (id) do nothing;

insert into public.user_roles (id, user_id, role)
values
  ('85100000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'STUDENT'),
  ('85100000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000002', 'STUDENT'),
  ('85100000-0000-0000-0000-000000000003', '85000000-0000-0000-0000-000000000003', 'STUDENT'),
  ('85100000-0000-0000-0000-000000000004', '85000000-0000-0000-0000-000000000004', 'TEACHER')
on conflict (id) do nothing;

insert into public.teachers (id, user_id, active)
values ('85200000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000004', true)
on conflict (id) do update set active = true;

insert into public.subscriptions (
  id, user_id, plan_id, provider, provider_subscription_id, status,
  current_period_start, current_period_end
)
values
  (
    '85300000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'test',
    'schedule_a',
    'ACTIVE',
    now() - interval '1 day',
    now() + interval '30 days'
  ),
  (
    '85300000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'test',
    'schedule_b',
    'ACTIVE',
    now() - interval '1 day',
    now() + interval '30 days'
  ),
  (
    '85300000-0000-0000-0000-000000000003',
    '85000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'test',
    'schedule_c',
    'ACTIVE',
    now() - interval '1 day',
    now() + interval '30 days'
  )
on conflict (id) do update set
  status = excluded.status,
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end;

insert into public.live_sessions (
  id, teacher_id, session_type, title, starts_at, ends_at, capacity,
  required_entitlement_key, status
)
values
  (
    '85400000-0000-0000-0000-000000000001',
    '85200000-0000-0000-0000-000000000001',
    'CONVERSATION_LAB',
    'Agenda eligible lab',
    now() + interval '1 day',
    now() + interval '1 day 1 hour',
    2,
    'weekly_conversation_labs',
    'SCHEDULED'
  ),
  (
    '85400000-0000-0000-0000-000000000002',
    '85200000-0000-0000-0000-000000000001',
    'WORKSHOP',
    'Agenda capacity one',
    now() + interval '2 days',
    now() + interval '2 days 45 minutes',
    1,
    'monthly_private_sessions',
    'SCHEDULED'
  ),
  (
    '85400000-0000-0000-0000-000000000003',
    '85200000-0000-0000-0000-000000000001',
    'CORE_CLASS',
    'Agenda closed class',
    now() + interval '3 days',
    now() + interval '3 days 1 hour',
    2,
    'weekly_core_classes',
    'CANCELLED'
  )
on conflict (id) do update set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  capacity = excluded.capacity,
  required_entitlement_key = excluded.required_entitlement_key,
  status = excluded.status;

delete from public.session_bookings
where live_session_id in (
  '85400000-0000-0000-0000-000000000001',
  '85400000-0000-0000-0000-000000000002',
  '85400000-0000-0000-0000-000000000003'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '85000000-0000-0000-0000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000001","aal":"aal1"}',
  false
);

do $$
declare
  first_booking uuid;
  retry_booking uuid;
  visible_count integer;
  own_status text;
begin
  first_booking := public.book_live_session('85400000-0000-0000-0000-000000000001');
  retry_booking := public.book_live_session('85400000-0000-0000-0000-000000000001');

  if first_booking <> retry_booking then
    raise exception 'Duplicate booking retry must return the persisted booking';
  end if;

  select count(*), max(status)
    into visible_count, own_status
  from public.session_bookings
  where live_session_id = '85400000-0000-0000-0000-000000000001';

  if visible_count <> 1 or own_status <> 'BOOKED' then
    raise exception 'Eligible booking must persist exactly once for auth.uid()';
  end if;

  perform set_config('app.schedule_booking_a', first_booking::text, false);
end;
$$;

select set_config('request.jwt.claim.sub', '85000000-0000-0000-0000-000000000003', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000003","aal":"aal1"}',
  false
);

do $$
begin
  begin
    perform public.book_live_session('85400000-0000-0000-0000-000000000001');
    raise exception 'Missing entitlement must reject booking';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '85000000-0000-0000-0000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000001","aal":"aal1"}',
  false
);

do $$
begin
  begin
    perform public.book_live_session('85400000-0000-0000-0000-000000000003');
    raise exception 'Non-scheduled session must reject booking';
  exception
    when check_violation then null;
  end;

  perform public.book_live_session('85400000-0000-0000-0000-000000000002');
end;
$$;

select set_config('request.jwt.claim.sub', '85000000-0000-0000-0000-000000000002', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"85000000-0000-0000-0000-000000000002","aal":"aal1"}',
  false
);

do $$
declare
  leaked_booking_id uuid;
  aggregate_booked_count bigint;
  aggregate_own_id uuid;
begin
  begin
    perform public.book_live_session('85400000-0000-0000-0000-000000000002');
    raise exception 'Capacity=1 session must reject the second booking';
  exception
    when check_violation then null;
  end;

  select id into leaked_booking_id
  from public.session_bookings
  where id = current_setting('app.schedule_booking_a')::uuid;

  if leaked_booking_id is not null then
    raise exception 'Student B must not read Student A booking';
  end if;

  select booked_count, own_booking_id
    into aggregate_booked_count, aggregate_own_id
  from public.get_agenda_sessions()
  where live_session_id = '85400000-0000-0000-0000-000000000001';

  if aggregate_booked_count <> 1 then
    raise exception 'Agenda aggregate must expose only the count needed for availability';
  end if;

  if aggregate_own_id is not null then
    raise exception 'Agenda aggregate must not expose another student booking id';
  end if;
end;
$$;

reset role;

do $$
declare
  persisted_owner uuid;
  persisted_count integer;
begin
  select user_id into persisted_owner
  from public.session_bookings
  where id = current_setting('app.schedule_booking_a')::uuid;

  if persisted_owner <> '85000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Booking owner must come from auth.uid()';
  end if;

  select count(*) into persisted_count
  from public.session_bookings
  where live_session_id = '85400000-0000-0000-0000-000000000002'
    and status = 'BOOKED';

  if persisted_count <> 1 then
    raise exception 'Capacity guard allowed overbooking';
  end if;

  if has_table_privilege('authenticated', 'public.session_bookings', 'INSERT') then
    raise exception 'Authenticated must not gain direct session_bookings INSERT';
  end if;

  if has_function_privilege('anon', 'public.book_live_session(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_agenda_sessions()', 'EXECUTE') then
    raise exception 'Anonymous must not execute protected Agenda RPCs';
  end if;

  if not has_function_privilege('authenticated', 'public.book_live_session(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_agenda_sessions()', 'EXECUTE') then
    raise exception 'Authenticated user must execute the protected Agenda RPCs';
  end if;

  if to_regprocedure('public.book_live_session(uuid,uuid)') is not null then
    raise exception 'Booking RPC must never accept a user_id argument';
  end if;

  if pg_get_function_result('public.get_agenda_sessions()'::regprocedure) ilike '%user_id%' then
    raise exception 'Agenda aggregate result must not expose user identities';
  end if;
end;
$$;
