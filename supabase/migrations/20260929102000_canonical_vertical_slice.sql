-- PROMPT 07 — Canonical vertical slice: lesson progress + analytics.
-- The browser never supplies user_id as authority. Progress writes derive auth.uid().

-- Remove the PROMPT 06 audit trigger before renaming progress_percent so historical
-- rows can be backfilled without invoking a trigger compiled against the old column.
drop trigger if exists lesson_progress_audit on public.lesson_progress;

alter table public.lesson_progress
  rename column progress_percent to completion_percent;

alter table public.lesson_progress
  add column user_id uuid references auth.users(id) on delete restrict,
  add column last_position_seconds integer check (
    last_position_seconds is null or last_position_seconds >= 0
  ),
  add column last_accessed_at timestamptz not null default now();

update public.lesson_progress lp
set user_id = e.user_id
from public.enrollments e
where e.id = lp.enrollment_id
  and lp.user_id is null;

alter table public.lesson_progress
  alter column user_id set not null;

alter table public.lesson_progress
  add constraint lesson_progress_user_lesson_unique unique (user_id, lesson_id);

create or replace function private.validate_lesson_progress_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_user_id uuid;
  enrollment_course_id uuid;
  lesson_course_id uuid;
begin
  select e.user_id, e.course_id
  into enrollment_user_id, enrollment_course_id
  from public.enrollments e
  where e.id = new.enrollment_id;

  if enrollment_user_id is null then
    raise exception 'Enrollment not found';
  end if;

  select m.course_id
  into lesson_course_id
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = new.lesson_id;

  if lesson_course_id is null or lesson_course_id <> enrollment_course_id then
    raise exception 'Lesson does not belong to enrollment course';
  end if;

  if new.user_id is null then
    new.user_id := enrollment_user_id;
  elsif new.user_id <> enrollment_user_id then
    raise exception 'Lesson progress user must match enrollment user';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.user_id <> old.user_id
      or new.enrollment_id <> old.enrollment_id
      or new.lesson_id <> old.lesson_id
    ) then
    raise exception 'Lesson progress identity fields are immutable';
  end if;

  return new;
end;
$$;

create trigger lesson_progress_identity_guard
before insert or update on public.lesson_progress
for each row execute function private.validate_lesson_progress_identity();

create or replace function private.audit_lesson_progress_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    data
  )
  values (
    (select auth.uid()),
    'SECURITY_LESSON_PROGRESS_' || tg_op,
    'lesson_progress',
    case when tg_op = 'DELETE' then old.id else new.id end,
    jsonb_build_object(
      'operation', tg_op,
      'user_id', case when tg_op = 'DELETE' then old.user_id else new.user_id end,
      'lesson_id', case when tg_op = 'DELETE' then old.lesson_id else new.lesson_id end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end,
      'completion_percent',
        case when tg_op = 'DELETE' then old.completion_percent else new.completion_percent end,
      'last_position_seconds',
        case when tg_op = 'DELETE'
          then old.last_position_seconds
          else new.last_position_seconds
        end
    )
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger lesson_progress_audit
after insert or update or delete on public.lesson_progress
for each row execute function private.audit_lesson_progress_change();

create table public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'login_completed',
      'lesson_started',
      'lesson_progressed',
      'lesson_completed'
    )
  ),
  lesson_id uuid references public.lessons(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index product_analytics_events_user_time_idx
  on public.product_analytics_events(user_id, occurred_at desc);

alter table public.product_analytics_events enable row level security;

revoke all on public.product_analytics_events from public, anon, authenticated;

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
    'login_completed',
    'lesson_started',
    'lesson_progressed',
    'lesson_completed'
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
  where e.user_id = actor_user_id
    and e.status = 'ACTIVE'
    and l.id = p_lesson_id
  order by e.enrolled_at desc
  limit 1;

  if enrollment_id is null then
    raise exception 'Active enrollment required' using errcode = '42501';
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
    last_position_seconds = coalesce(
      excluded.last_position_seconds,
      public.lesson_progress.last_position_seconds
    ),
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
