-- PROMPT 05 — Yas English Lab domain contracts
-- PostgreSQL/Supabase is the durable source of truth for domain invariants.
-- Authorization policies are intentionally deferred; RLS is enabled on public tables.

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  avatar_url text,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Recife',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('STUDENT', 'TEACHER', 'SUPPORT', 'ADMIN')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text,
  currency char(3) not null default 'BRL',
  amount_cents integer not null check (amount_cents >= 0),
  billing_interval text not null check (billing_interval in ('MONTH')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  description text not null,
  unit text not null check (unit in ('COUNT', 'BOOLEAN')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete restrict,
  entitlement_id uuid not null references public.entitlements(id) on delete restrict,
  limit_value numeric(10,2) not null check (limit_value >= 0),
  cadence text not null check (cadence in ('WEEK', 'MONTH', 'NONE')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  unique (plan_id, entitlement_id, effective_from)
);

create unique index plan_entitlements_one_open_version
  on public.plan_entitlements(plan_id, entitlement_id)
  where effective_to is null;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider text not null check (char_length(trim(provider)) between 1 and 40),
  provider_customer_id text,
  provider_subscription_id text,
  status text not null check (status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  check (ended_at is null or ended_at >= started_at),
  unique (provider, provider_subscription_id)
);

create unique index subscriptions_one_current_per_user
  on public.subscriptions(user_id)
  where status in ('TRIALING', 'ACTIVE', 'PAST_DUE');

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  position integer not null check (position > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position),
  unique (module_id, slug)
);

create table public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  asset_type text not null check (asset_type in ('VIDEO', 'AUDIO', 'TEXT', 'PDF', 'EXERCISE', 'LINK')),
  position integer not null default 1 check (position > 0),
  source_url text,
  storage_path text,
  content jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(source_url, storage_path, content) >= 1),
  unique (lesson_id, position)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  status text not null check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'COMPLETED' and completed_at is not null) or status <> 'COMPLETED'),
  unique (user_id, course_id)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  status text not null check (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'COMPLETED' or progress_percent = 100),
  check (status <> 'COMPLETED' or completed_at is not null),
  unique (enrollment_id, lesson_id)
);

create table public.practice_activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  skill text not null check (skill in ('SPEAKING', 'LISTENING', 'PRONUNCIATION', 'VOCABULARY', 'GRAMMAR')),
  cefr_target text check (cefr_target is null or cefr_target in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  difficulty text,
  estimated_minutes integer not null check (estimated_minutes > 0),
  related_module_id uuid references public.modules(id) on delete set null,
  related_lesson_id uuid references public.lessons(id) on delete set null,
  content jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  practice_activity_id uuid not null references public.practice_activities(id) on delete restrict,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'SUBMITTED', 'ABANDONED')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  check ((status = 'SUBMITTED' and submitted_at is not null) or status <> 'SUBMITTED')
);

create table public.practice_results (
  id uuid primary key default gen_random_uuid(),
  practice_attempt_id uuid not null unique references public.practice_attempts(id) on delete cascade,
  score numeric,
  max_score numeric,
  feedback text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (score is null or max_score is null or (max_score >= 0 and score between 0 and max_score))
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  material_type text not null check (material_type in ('PDF', 'SUMMARY', 'VOCABULARY', 'GRAMMAR', 'AUDIO', 'WORKSHEET', 'ANSWER_KEY')),
  module_id uuid references public.modules(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  storage_path text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(storage_path, external_url) >= 1)
);

create table public.material_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, material_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  purpose text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  specification jsonb not null default '{}'::jsonb,
  scoring_config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'DRAFT' or published_at is not null),
  unique (assessment_id, version_number)
);

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_version_id uuid not null references public.assessment_versions(id) on delete restrict,
  position integer not null check (position > 0),
  skill text not null check (skill in ('READING', 'LISTENING', 'SPEAKING', 'VOCABULARY', 'GRAMMAR', 'PRONUNCIATION')),
  cefr_target text check (cefr_target is null or cefr_target in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  item_type text not null,
  prompt jsonb not null,
  answer_key jsonb,
  rubric jsonb,
  created_at timestamptz not null default now(),
  unique (assessment_version_id, position)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  assessment_version_id uuid not null references public.assessment_versions(id) on delete restrict,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'SUBMITTED', 'SCORED', 'INVALIDATED')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  scored_at timestamptz,
  raw_score numeric,
  result_cefr text check (result_cefr is null or result_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  result_metadata jsonb not null default '{}'::jsonb,
  check ((status = 'IN_PROGRESS' and submitted_at is null) or status <> 'IN_PROGRESS'),
  check ((status in ('SUBMITTED', 'SCORED', 'INVALIDATED') and submitted_at is not null) or status = 'IN_PROGRESS')
);

create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items(id) on delete restrict,
  response jsonb not null,
  score numeric,
  feedback text,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_attempt_id, assessment_item_id)
);

create table public.skill_scores (
  id uuid primary key default gen_random_uuid(),
  assessment_attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  skill text not null check (skill in ('READING', 'LISTENING', 'SPEAKING', 'VOCABULARY', 'GRAMMAR', 'PRONUNCIATION')),
  score numeric not null,
  max_score numeric,
  cefr_level text check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  provenance jsonb not null,
  created_at timestamptz not null default now(),
  check (max_score is null or (max_score >= 0 and score between 0 and max_score)),
  unique (assessment_attempt_id, skill)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Recife',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  session_type text not null check (session_type in ('CORE_CLASS', 'CONVERSATION_LAB', 'PRIVATE_SESSION', 'WORKSHOP')),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity smallint not null check (capacity between 1 and 6),
  required_entitlement_key text references public.entitlements(key) on update cascade on delete restrict,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CANCELLED', 'COMPLETED')),
  meeting_provider text,
  meeting_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (session_type <> 'PRIVATE_SESSION' or capacity = 1)
);

create table public.session_bookings (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'BOOKED' check (status in ('BOOKED', 'CANCELLED', 'TEACHER_CANCELLED')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'BOOKED' and cancelled_at is null) or status <> 'BOOKED'),
  unique (live_session_id, user_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_booking_id uuid not null unique references public.session_bookings(id) on delete cascade,
  status text not null check (status in ('ATTENDED', 'NO_SHOW')),
  marked_at timestamptz not null default now(),
  marked_by_user_id uuid references auth.users(id) on delete set null,
  notes text
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)
);

create index user_roles_user_id_idx on public.user_roles(user_id);
create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index modules_course_id_idx on public.modules(course_id);
create index lessons_module_id_idx on public.lessons(module_id);
create index lesson_progress_enrollment_id_idx on public.lesson_progress(enrollment_id);
create index practice_attempts_user_id_idx on public.practice_attempts(user_id);
create index material_favorites_user_id_idx on public.material_favorites(user_id);
create index assessment_attempts_user_id_idx on public.assessment_attempts(user_id);
create index assessment_attempts_version_idx on public.assessment_attempts(assessment_version_id);
create index teacher_availability_teacher_time_idx on public.teacher_availability(teacher_id, starts_at);
create index live_sessions_starts_at_idx on public.live_sessions(starts_at);
create index session_bookings_session_status_idx on public.session_bookings(live_session_id, status);
create index session_bookings_user_id_idx on public.session_bookings(user_id);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, occurred_at desc);
create index billing_events_subscription_idx on public.billing_events(subscription_id, occurred_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'historical record is immutable' using errcode = '55000';
end;
$$;

create or replace function private.protect_billing_event_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.provider, new.event_id, new.event_type, new.subscription_id, new.payload, new.occurred_at, new.received_at)
     is distinct from
     row(old.provider, old.event_id, old.event_type, old.subscription_id, old.payload, old.occurred_at, old.received_at) then
    raise exception 'billing event identity/payload is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function private.validate_lesson_progress_course()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  enrolled_course uuid;
  lesson_course uuid;
begin
  select e.course_id into enrolled_course
  from public.enrollments e
  where e.id = new.enrollment_id;

  select m.course_id into lesson_course
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = new.lesson_id;

  if enrolled_course is null or lesson_course is null or enrolled_course <> lesson_course then
    raise exception 'lesson progress must belong to the enrolled course' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.protect_assessment_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT'
      or exists (
        select 1 from public.assessment_attempts a
        where a.assessment_version_id = old.id
      ) then
      raise exception 'published/used assessment versions are immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status = 'DRAFT'
    and not exists (
      select 1 from public.assessment_attempts a
      where a.assessment_version_id = old.id
    ) then
    return new;
  end if;

  if old.status = 'PUBLISHED'
    and new.status = 'RETIRED'
    and row(new.assessment_id, new.version_number, new.specification, new.scoring_config, new.published_at)
        is not distinct from
        row(old.assessment_id, old.version_number, old.specification, old.scoring_config, old.published_at) then
    return new;
  end if;

  raise exception 'published/used assessment versions are immutable' using errcode = '55000';
end;
$$;

create or replace function private.protect_assessment_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_id uuid;
  version_status text;
begin
  version_id := case when tg_op = 'DELETE' then old.assessment_version_id else new.assessment_version_id end;

  select v.status into version_status
  from public.assessment_versions v
  where v.id = version_id;

  if version_status is distinct from 'DRAFT'
    or exists (
      select 1 from public.assessment_attempts a
      where a.assessment_version_id = version_id
    ) then
    raise exception 'items of published/used assessment versions are immutable' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.validate_assessment_attempt_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_status text;
begin
  select v.status into version_status
  from public.assessment_versions v
  where v.id = new.assessment_version_id;

  if version_status is distinct from 'PUBLISHED' then
    raise exception 'assessment attempt must reference a published immutable version' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_assessment_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  attempt_status text;
  attempt_version uuid;
  item_version uuid;
  attempt_id uuid;
  item_id uuid;
begin
  attempt_id := case when tg_op = 'DELETE' then old.assessment_attempt_id else new.assessment_attempt_id end;
  item_id := case when tg_op = 'DELETE' then old.assessment_item_id else new.assessment_item_id end;

  select a.status, a.assessment_version_id
    into attempt_status, attempt_version
  from public.assessment_attempts a
  where a.id = attempt_id;

  select i.assessment_version_id into item_version
  from public.assessment_items i
  where i.id = item_id;

  if attempt_version is null or item_version is null or attempt_version <> item_version then
    raise exception 'assessment response item must belong to the attempt version' using errcode = '23514';
  end if;

  if attempt_status <> 'IN_PROGRESS' then
    raise exception 'submitted assessment responses are immutable' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.entitlement_limit(
  p_user_id uuid,
  p_entitlement_key text,
  p_at timestamptz default now()
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select pe.limit_value
  from public.subscriptions s
  join public.plan_entitlements pe on pe.plan_id = s.plan_id
  join public.entitlements e on e.id = pe.entitlement_id
  where s.user_id = p_user_id
    and s.status in ('TRIALING', 'ACTIVE')
    and (s.current_period_start is null or s.current_period_start <= p_at)
    and (s.current_period_end is null or s.current_period_end > p_at)
    and e.key = p_entitlement_key
    and e.active
    and pe.effective_from <= p_at
    and (pe.effective_to is null or pe.effective_to > p_at)
  order by s.started_at desc, pe.effective_from desc
  limit 1;
$$;

create or replace function private.validate_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_capacity smallint;
  session_status text;
  entitlement_key text;
  active_bookings integer;
  entitlement_value numeric;
begin
  if new.status <> 'BOOKED' then
    return new;
  end if;

  select s.capacity, s.status, s.required_entitlement_key
    into session_capacity, session_status, entitlement_key
  from public.live_sessions s
  where s.id = new.live_session_id
  for update;

  if session_capacity is null then
    raise exception 'live session not found' using errcode = '23503';
  end if;

  if session_status <> 'SCHEDULED' then
    raise exception 'cannot book a non-scheduled session' using errcode = '23514';
  end if;

  if entitlement_key is not null then
    entitlement_value := private.entitlement_limit(new.user_id, entitlement_key, new.booked_at);
    if entitlement_value is null or entitlement_value <= 0 then
      raise exception 'required entitlement is not available' using errcode = '42501';
    end if;
  end if;

  select count(*) into active_bookings
  from public.session_bookings b
  where b.live_session_id = new.live_session_id
    and b.status = 'BOOKED'
    and (tg_op = 'INSERT' or b.id <> new.id);

  if active_bookings >= session_capacity then
    raise exception 'live session capacity exceeded' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function private.set_updated_at();
create trigger courses_set_updated_at before update on public.courses
for each row execute function private.set_updated_at();
create trigger modules_set_updated_at before update on public.modules
for each row execute function private.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons
for each row execute function private.set_updated_at();
create trigger enrollments_set_updated_at before update on public.enrollments
for each row execute function private.set_updated_at();
create trigger practice_activities_set_updated_at before update on public.practice_activities
for each row execute function private.set_updated_at();
create trigger materials_set_updated_at before update on public.materials
for each row execute function private.set_updated_at();
create trigger teachers_set_updated_at before update on public.teachers
for each row execute function private.set_updated_at();
create trigger live_sessions_set_updated_at before update on public.live_sessions
for each row execute function private.set_updated_at();
create trigger session_bookings_set_updated_at before update on public.session_bookings
for each row execute function private.set_updated_at();
create trigger assessment_responses_set_updated_at before update on public.assessment_responses
for each row execute function private.set_updated_at();

create trigger lesson_progress_course_guard
before insert or update of enrollment_id, lesson_id on public.lesson_progress
for each row execute function private.validate_lesson_progress_course();

create trigger assessment_versions_immutability
before update or delete on public.assessment_versions
for each row execute function private.protect_assessment_version();

create trigger assessment_items_immutability
before insert or update or delete on public.assessment_items
for each row execute function private.protect_assessment_item();

create trigger assessment_attempt_version_guard
before insert or update of assessment_version_id on public.assessment_attempts
for each row execute function private.validate_assessment_attempt_version();

create trigger assessment_response_guard
before insert or update or delete on public.assessment_responses
for each row execute function private.validate_assessment_response();

create trigger session_booking_guard
before insert or update of live_session_id, user_id, status on public.session_bookings
for each row execute function private.validate_booking();

create trigger audit_logs_no_update
before update or delete on public.audit_logs
for each row execute function private.prevent_mutation();

create trigger billing_events_protect_identity
before update on public.billing_events
for each row execute function private.protect_billing_event_identity();

create trigger billing_events_no_delete
before delete on public.billing_events
for each row execute function private.prevent_mutation();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_roles', 'plans', 'entitlements', 'plan_entitlements', 'subscriptions',
    'courses', 'modules', 'lessons', 'lesson_assets', 'enrollments', 'lesson_progress',
    'practice_activities', 'practice_attempts', 'practice_results',
    'materials', 'material_favorites',
    'assessments', 'assessment_versions', 'assessment_items', 'assessment_attempts',
    'assessment_responses', 'skill_scores',
    'teachers', 'teacher_availability', 'live_sessions', 'session_bookings', 'attendance',
    'notifications', 'audit_logs', 'billing_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon, authenticated;
