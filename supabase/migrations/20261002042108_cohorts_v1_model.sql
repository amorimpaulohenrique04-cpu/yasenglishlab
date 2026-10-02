create table public.cohorts (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.courses(id) on delete restrict,
 name text not null check(char_length(trim(name)) between 1 and 120),
 code text not null unique check(code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 status text not null default 'PLANNED' check(status in ('PLANNED','ACTIVE','ARCHIVED')),
 timezone text not null default 'America/Recife',
 starts_at timestamptz not null, ends_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at is null or ends_at>starts_at)
);
create table public.cohort_memberships (
 id uuid primary key default gen_random_uuid(),
 cohort_id uuid not null references public.cohorts(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 enrollment_id uuid not null references public.enrollments(id) on delete restrict,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','LEFT','COMPLETED')),
 starts_at timestamptz not null default now(),ends_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at is null or ends_at>=starts_at)
);
create unique index cohort_membership_one_active on public.cohort_memberships(cohort_id,user_id) where status='ACTIVE';
create index cohort_membership_student_idx on public.cohort_memberships(user_id,cohort_id,status);
create table public.cohort_teachers (
 id uuid primary key default gen_random_uuid(),
 cohort_id uuid not null references public.cohorts(id) on delete restrict,
 teacher_id uuid not null references public.teachers(id) on delete restrict,
 is_primary boolean not null default false,
 starts_at timestamptz not null default now(),ends_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_at is null or ends_at>=starts_at)
);
create unique index cohort_teacher_one_active on public.cohort_teachers(cohort_id,teacher_id) where ends_at is null;
create unique index cohort_teacher_one_primary on public.cohort_teachers(cohort_id) where is_primary and ends_at is null;
create index cohort_teacher_scope_idx on public.cohort_teachers(teacher_id,cohort_id);
alter table public.live_sessions add column cohort_id uuid references public.cohorts(id) on delete restrict;
create index live_sessions_cohort_idx on public.live_sessions(cohort_id);
alter table public.cohorts enable row level security;
alter table public.cohort_memberships enable row level security;
alter table public.cohort_teachers enable row level security;
revoke all on public.cohorts,public.cohort_memberships,public.cohort_teachers from anon,authenticated;
create trigger cohorts_updated before update on public.cohorts for each row execute function private.set_updated_at();
create trigger memberships_updated before update on public.cohort_memberships for each row execute function private.set_updated_at();
create trigger cohort_teachers_updated before update on public.cohort_teachers for each row execute function private.set_updated_at();
