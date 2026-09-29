-- PROMPT 10 — observability, product analytics taxonomy and audit correlation.
-- Keeps product analytics, technical observability and privileged audit history separate.

alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_event_name_check;

alter table public.product_analytics_events
  add constraint product_analytics_events_event_name_check
  check (
    event_name in (
      'signup_completed',
      'login_completed',
      'subscription_started',
      'subscription_upgraded',
      'subscription_downgraded',
      'subscription_cancelled',
      'lesson_started',
      'lesson_progressed',
      'lesson_completed',
      'module_completed',
      'practice_started',
      'practice_completed',
      'material_opened',
      'material_favorited',
      'assessment_started',
      'assessment_completed',
      'live_session_booked',
      'live_session_cancelled',
      'live_session_attended'
    )
  );

create or replace function public.track_product_event(
  p_event_name text,
  p_lesson_id uuid default null,
  p_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_event_name not in (
    'signup_completed',
    'login_completed',
    'subscription_started',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'lesson_started',
    'lesson_progressed',
    'lesson_completed',
    'module_completed',
    'practice_started',
    'practice_completed',
    'material_opened',
    'material_favorited',
    'assessment_started',
    'assessment_completed',
    'live_session_booked',
    'live_session_cancelled',
    'live_session_attended'
  ) then
    raise exception 'Unsupported product analytics event';
  end if;

  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Analytics properties must be an object';
  end if;

  insert into public.product_analytics_events (
    user_id,
    event_name,
    lesson_id,
    properties
  )
  values (
    actor_user_id,
    p_event_name,
    p_lesson_id,
    coalesce(p_properties, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.track_product_event(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.track_product_event(text, uuid, jsonb)
  to authenticated;

alter table public.audit_logs
  add column request_id uuid,
  add column environment text not null default 'unknown'
    check (char_length(environment) between 1 and 40),
  add column version text not null default 'unknown'
    check (char_length(version) between 1 and 120);

create index audit_logs_request_idx
  on public.audit_logs(request_id, occurred_at desc)
  where request_id is not null;

create table public.observability_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null default 'technical_error'
    check (event_name in ('technical_error')),
  severity text not null
    check (severity in ('warning', 'error', 'critical')),
  error_code text not null
    check (
      error_code in (
        'booking_conflict',
        'video_access_failed',
        'assessment_submit_failed',
        'billing_webhook_failed',
        'database_error',
        'permission_denied'
      )
    ),
  request_id uuid not null,
  trace_id uuid not null,
  span_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  environment text not null check (char_length(environment) between 1 and 40),
  version text not null check (char_length(version) between 1 and 120),
  stage text not null check (char_length(stage) between 1 and 160),
  impact text not null
    check (impact in ('degraded', 'request_failed', 'user_blocked', 'data_integrity_risk')),
  message text not null check (char_length(message) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index observability_events_error_time_idx
  on public.observability_events(error_code, occurred_at desc);

create index observability_events_request_idx
  on public.observability_events(request_id, occurred_at asc);

create index observability_events_version_time_idx
  on public.observability_events(environment, version, occurred_at desc);

alter table public.observability_events enable row level security;

revoke all on public.observability_events from public, anon, authenticated;

create trigger observability_events_no_update
before update or delete on public.observability_events
for each row execute function private.prevent_mutation();

comment on table public.observability_events is
  'Technical error sink only. Not product analytics and not privileged audit history.';
