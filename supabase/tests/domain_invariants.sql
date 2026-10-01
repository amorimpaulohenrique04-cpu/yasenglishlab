-- Plain PostgreSQL assertions for critical domain invariants.
-- Run after migrations + supabase/seed.sql in an isolated database.

insert into auth.users (id) values
  ('90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.profiles (user_id, display_name)
values
  ('90000000-0000-0000-0000-000000000001', 'Student One'),
  ('90000000-0000-0000-0000-000000000002', 'Student Two'),
  ('90000000-0000-0000-0000-000000000003', 'Teacher One')
on conflict (user_id) do nothing;

insert into public.teachers (id, user_id)
values ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.subscriptions (
  id, user_id, plan_id, provider, provider_subscription_id, status,
  current_period_start, current_period_end
)
values
  (
    '92000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'test',
    'sub_one',
    'ACTIVE',
    now() - interval '1 day',
    now() + interval '30 days'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'test',
    'sub_two',
    'ACTIVE',
    now() - interval '1 day',
    now() + interval '30 days'
  )
on conflict (id) do nothing;

insert into public.live_sessions (
  id, teacher_id, session_type, title, starts_at, ends_at, capacity, required_entitlement_key
)
values (
  '93000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'PRIVATE_SESSION',
  'Capacity invariant',
  now() - interval '2 hours',
  now() - interval '75 minutes',
  1,
  'monthly_private_sessions'
)
on conflict (id) do nothing;

insert into public.session_bookings (id, live_session_id, user_id, booked_at)
values (
  '94000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  now()
)
on conflict (id) do nothing;

do $$
begin
  begin
    insert into public.session_bookings (id, live_session_id, user_id, booked_at)
    values (
      '94000000-0000-0000-0000-000000000002',
      '93000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002',
      now()
    );
    raise exception 'expected capacity guard to reject overbooking';
  exception
    when check_violation then null;
  end;
end;
$$;

insert into public.billing_events (
  id, provider, event_id, event_type, payload, occurred_at
)
values (
  '95000000-0000-0000-0000-000000000001',
  'test',
  'evt_idempotent',
  'subscription.updated',
  '{}'::jsonb,
  '2026-09-29T03:51:00Z'
)
on conflict (provider, event_id) do nothing;

do $$
begin
  begin
    insert into public.billing_events (
      id, provider, event_id, event_type, payload, occurred_at
    )
    values (
      '95000000-0000-0000-0000-000000000002',
      'test',
      'evt_idempotent',
      'subscription.updated',
      '{}'::jsonb,
      '2026-09-29T03:51:00Z'
    );
    raise exception 'expected duplicate provider/event_id to be rejected';
  exception
    when unique_violation then null;
  end;
end;
$$;

insert into public.assessments (id, slug, title, purpose)
values (
  '96000000-0000-0000-0000-000000000001',
  'domain-invariant-test',
  'Domain invariant test',
  'CI only'
)
on conflict (id) do nothing;

insert into public.assessment_versions (
  id, assessment_id, version_number, status, specification, scoring_config, published_at
)
values (
  '96100000-0000-0000-0000-000000000001',
  '96000000-0000-0000-0000-000000000001',
  1,
  'DRAFT',
  '{}'::jsonb,
  '{}'::jsonb,
  null
)
on conflict (id) do nothing;

insert into public.assessment_items (
  id, assessment_version_id, position, skill, item_type, prompt
)
values (
  '96200000-0000-0000-0000-000000000001',
  '96100000-0000-0000-0000-000000000001',
  1,
  'READING',
  'MULTIPLE_CHOICE',
  '{"question":"test"}'::jsonb
)
on conflict (id) do nothing;

update public.assessment_versions
set status = 'PUBLISHED', published_at = '2026-09-29T03:51:00Z'
where id = '96100000-0000-0000-0000-000000000001';

do $$
begin
  begin
    update public.assessment_items
    set prompt = '{"question":"mutated"}'::jsonb
    where id = '96200000-0000-0000-0000-000000000001';
    raise exception 'expected published assessment item to be immutable';
  exception
    when sqlstate '55000' then null;
  end;
end;
$$;
