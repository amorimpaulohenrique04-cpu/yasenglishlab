-- PROMPT 10 — executable separation/privacy/auditability contracts.

insert into auth.users (id, email, raw_user_meta_data)
values (
  '91000000-0000-4000-8000-000000000001',
  'observability-contract@example.test',
  '{}'::jsonb
)
on conflict (id) do nothing;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  false
);

select public.track_product_event(
  'signup_completed',
  null,
  '{"source":"contract_test"}'::jsonb
);

reset role;

do $$
declare
  event_count integer;
begin
  select count(*) into event_count
  from public.product_analytics_events
  where user_id = '91000000-0000-4000-8000-000000000001'
    and event_name = 'signup_completed';

  if event_count <> 1 then
    raise exception 'Expanded product analytics taxonomy must persist signup_completed';
  end if;
end;
$$;

do $$
begin
  insert into public.product_analytics_events (
    user_id,
    event_name,
    properties
  )
  values (
    '91000000-0000-4000-8000-000000000001',
    'page_view',
    '{}'::jsonb
  );

  raise exception 'Unsupported product analytics event unexpectedly persisted';
exception
  when check_violation then
    null;
end;
$$;

insert into public.observability_events (
  id,
  severity,
  error_code,
  request_id,
  trace_id,
  span_id,
  user_id,
  environment,
  version,
  stage,
  impact,
  message,
  metadata
)
values (
  '92000000-0000-4000-8000-000000000001',
  'error',
  'database_error',
  '92000000-0000-4000-8000-000000000002',
  '92000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000004',
  null,
  'test',
  'contract',
  'database.contract_probe',
  'request_failed',
  'intentional contract probe',
  '{"intentional":true}'::jsonb
);

do $$
begin
  update public.observability_events
  set message = 'mutated'
  where id = '92000000-0000-4000-8000-000000000001';

  raise exception 'Observability events must be append-only';
exception
  when sqlstate '55000' then
    null;
end;
$$;

do $$
begin
  delete from public.observability_events
  where id = '92000000-0000-4000-8000-000000000001';

  raise exception 'Observability events must not be deletable in-place';
exception
  when sqlstate '55000' then
    null;
end;
$$;

do $$
begin
  if has_table_privilege('authenticated', 'public.observability_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.observability_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.observability_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.observability_events', 'DELETE') then
    raise exception 'Authenticated users must not access the technical observability sink directly';
  end if;
end;
$$;

do $$
declare
  request_column_count integer;
  environment_column_count integer;
  version_column_count integer;
begin
  select count(*) into request_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'audit_logs'
    and column_name = 'request_id';

  select count(*) into environment_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'audit_logs'
    and column_name = 'environment';

  select count(*) into version_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'audit_logs'
    and column_name = 'version';

  if request_column_count <> 1
    or environment_column_count <> 1
    or version_column_count <> 1 then
    raise exception 'Audit logs must expose request/environment/version correlation columns';
  end if;
end;
$$;
