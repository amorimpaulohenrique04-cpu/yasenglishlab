-- PROMPT 13 — deterministic learning resume and retry-safe product analytics.

alter table public.product_analytics_events
  add column idempotency_key text
  check (
    idempotency_key is null
    or char_length(idempotency_key) between 1 and 160
  );

create unique index product_analytics_events_user_idempotency_key
  on public.product_analytics_events(user_id, idempotency_key)
  where idempotency_key is not null;

drop function public.track_product_event(text, uuid, jsonb);

create function public.track_product_event(
  p_event_name text,
  p_lesson_id uuid default null,
  p_properties jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  analytics_module_id uuid;
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

  if p_idempotency_key is not null
    and char_length(p_idempotency_key) not between 1 and 160 then
    raise exception 'Analytics idempotency key must contain 1 to 160 characters';
  end if;

  if p_event_name in ('lesson_started', 'lesson_completed', 'module_completed')
    and p_idempotency_key is null then
    raise exception 'Critical learning analytics require an idempotency key';
  end if;

  if p_event_name in ('lesson_started', 'lesson_progressed', 'lesson_completed') then
    if p_lesson_id is null or not exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      join public.modules m on m.course_id = c.id
      join public.lessons l on l.module_id = m.id
      where e.user_id = actor_user_id
        and e.status = 'ACTIVE'
        and c.active
        and l.id = p_lesson_id
    ) then
      raise exception 'Active enrollment in a published lesson required'
        using errcode = '42501';
    end if;
  end if;

  if p_event_name = 'lesson_completed' and not exists (
    select 1
    from public.lesson_progress lp
    where lp.user_id = actor_user_id
      and lp.lesson_id = p_lesson_id
      and lp.completion_percent = 100
  ) then
    raise exception 'Completed lesson progress required' using errcode = '42501';
  end if;

  if p_event_name = 'module_completed' then
    begin
      analytics_module_id := nullif(p_properties ->> 'module_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Valid module_id property required';
    end;

    if analytics_module_id is null or not exists (
      select 1
      from public.modules m
      join public.courses c on c.id = m.course_id
      join public.enrollments e on e.course_id = c.id
      where m.id = analytics_module_id
        and e.user_id = actor_user_id
        and e.status = 'ACTIVE'
        and c.active
        and exists (
          select 1
          from public.lessons l
          where l.module_id = m.id
        )
        and not exists (
          select 1
          from public.lessons l
          left join public.lesson_progress lp
            on lp.lesson_id = l.id
            and lp.user_id = actor_user_id
          where l.module_id = m.id
            and coalesce(lp.completion_percent, 0) < 100
        )
    ) then
      raise exception 'Completed enrolled module required' using errcode = '42501';
    end if;
  end if;

  insert into public.product_analytics_events (
    user_id,
    event_name,
    lesson_id,
    properties,
    idempotency_key
  )
  values (
    actor_user_id,
    p_event_name,
    p_lesson_id,
    coalesce(p_properties, '{}'::jsonb),
    p_idempotency_key
  )
  on conflict (user_id, idempotency_key)
    where idempotency_key is not null
    do nothing;
end;
$$;

revoke all on function public.track_product_event(text, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.track_product_event(text, uuid, jsonb, text)
  to authenticated;

create or replace function public.record_lesson_progress(
  p_lesson_id uuid,
  p_completion_percent numeric,
  p_last_position_seconds integer default null
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  enrollment_id uuid;
  result_row public.lesson_progress;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_completion_percent < 0 or p_completion_percent > 100 then
    raise exception 'completion_percent must be between 0 and 100';
  end if;

  if p_last_position_seconds is not null and p_last_position_seconds < 0 then
    raise exception 'last_position_seconds must be non-negative';
  end if;

  select e.id
  into enrollment_id
  from public.enrollments e
  join public.modules m on m.course_id = e.course_id
  join public.lessons l on l.module_id = m.id
  join public.courses c on c.id = e.course_id
  where e.user_id = actor_user_id
    and e.status = 'ACTIVE'
    and c.active
    and l.id = p_lesson_id
  order by e.enrolled_at desc, e.id
  limit 1;

  if enrollment_id is null then
    raise exception 'Active enrollment in a published course required' using errcode = '42501';
  end if;

  insert into public.lesson_progress (
    enrollment_id,
    lesson_id,
    user_id,
    status,
    completion_percent,
    last_position_seconds,
    started_at,
    last_accessed_at,
    completed_at,
    updated_at
  )
  values (
    enrollment_id,
    p_lesson_id,
    actor_user_id,
    case
      when p_completion_percent >= 100 then 'COMPLETED'
      when p_completion_percent > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end,
    p_completion_percent,
    p_last_position_seconds,
    case when p_completion_percent > 0 then now() else null end,
    now(),
    case when p_completion_percent >= 100 then now() else null end,
    now()
  )
  on conflict (user_id, lesson_id)
  do update set
    completion_percent = greatest(
      public.lesson_progress.completion_percent,
      excluded.completion_percent
    ),
    status = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) >= 100 then 'COMPLETED'
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) > 0 then 'IN_PROGRESS'
      else 'NOT_STARTED'
    end,
    last_position_seconds = case
      when excluded.last_position_seconds is null
        then public.lesson_progress.last_position_seconds
      when public.lesson_progress.last_position_seconds is null
        then excluded.last_position_seconds
      else greatest(
        public.lesson_progress.last_position_seconds,
        excluded.last_position_seconds
      )
    end,
    started_at = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) > 0
        then coalesce(public.lesson_progress.started_at, now())
      else public.lesson_progress.started_at
    end,
    last_accessed_at = now(),
    completed_at = case
      when greatest(
        public.lesson_progress.completion_percent,
        excluded.completion_percent
      ) >= 100
        then coalesce(public.lesson_progress.completed_at, now())
      else public.lesson_progress.completed_at
    end,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.record_lesson_progress(uuid, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.record_lesson_progress(uuid, numeric, integer)
  to authenticated;
