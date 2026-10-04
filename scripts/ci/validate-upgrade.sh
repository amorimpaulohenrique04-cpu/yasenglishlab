#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${1:-yas_upgrade_validation}"
BASE_SHA="${BASE_SHA:-}"

if [ -z "$BASE_SHA" ]; then
  echo "BASE_SHA is required for base-to-head upgrade validation." >&2
  exit 2
fi

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

cleanup() {
  dropdb --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup
createdb "$DB_NAME"

psql -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$$;
do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$$;
do $$
begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end
$$;
SQL

psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create schema storage;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  metadata jsonb,
  unique(bucket_id,name)
);

create function auth.uid()
returns uuid language sql stable
as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid;';

create function auth.jwt()
returns jsonb language sql stable
as 'select coalesce(nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb, ''{}''::jsonb);';

grant usage on schema auth to anon, authenticated;
SQL

mapfile -t BASE_MIGRATIONS < <(
  git ls-tree -r --name-only "$BASE_SHA" -- supabase/migrations |
    grep -E '^supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql$' |
    sort
)

if [ "${#BASE_MIGRATIONS[@]}" -eq 0 ]; then
  echo "No base migrations found at $BASE_SHA." >&2
  exit 1
fi

for migration in "${BASE_MIGRATIONS[@]}"; do
  echo "▶ base $migration"
  git show "$BASE_SHA:$migration" | psql -d "$DB_NAME" -v ON_ERROR_STOP=1
done

echo "▶ base seed"
git show "$BASE_SHA:supabase/seed.sql" | psql -d "$DB_NAME" -v ON_ERROR_STOP=1

echo "▶ legacy fixture"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email,raw_user_meta_data) values
 ('a9000000-0000-4000-8000-000000000001','upgrade.teacher@example.test','{"display_name":"Upgrade Teacher"}'),
 ('a9000000-0000-4000-8000-000000000002','upgrade.student-a@example.test','{"display_name":"Upgrade Student A"}'),
 ('a9000000-0000-4000-8000-000000000003','upgrade.student-b@example.test','{"display_name":"Upgrade Student B"}');

insert into public.user_roles(user_id,role) values
 ('a9000000-0000-4000-8000-000000000001','TEACHER'),
 ('a9000000-0000-4000-8000-000000000002','STUDENT'),
 ('a9000000-0000-4000-8000-000000000003','STUDENT');

insert into public.teachers(id,user_id,active)
values('a9100000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001',true);

insert into public.enrollments(id,user_id,course_id,status) values
 ('a9200000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','ACTIVE'),
 ('a9200000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','ACTIVE');

insert into public.teacher_student_assignments(
 id,teacher_id,student_user_id,course_id,starts_at
) values (
 'a9250000-0000-4000-8000-000000000001',
 'a9100000-0000-4000-8000-000000000001',
 'a9000000-0000-4000-8000-000000000002',
 '40000000-0000-4000-8000-000000000001',
 now()-interval '1 day'
);

insert into public.cohorts(id,course_id,name,code,status,starts_at)
values(
 'a9260000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 'Upgrade Cohort',
 'upgrade-cohort',
 'ACTIVE',
 now()-interval '1 day'
);
insert into public.cohort_memberships(id,cohort_id,user_id,enrollment_id)
values(
 'a9270000-0000-4000-8000-000000000001',
 'a9260000-0000-4000-8000-000000000001',
 'a9000000-0000-4000-8000-000000000002',
 'a9200000-0000-4000-8000-000000000001'
);
insert into public.cohort_teachers(id,cohort_id,teacher_id,is_primary)
values(
 'a9280000-0000-4000-8000-000000000001',
 'a9260000-0000-4000-8000-000000000001',
 'a9100000-0000-4000-8000-000000000001',
 true
);

insert into public.subscriptions(
 id,user_id,plan_id,provider,provider_subscription_id,status,current_period_start,current_period_end
)
select
 'a9290000-0000-4000-8000-000000000001',
 'a9000000-0000-4000-8000-000000000002',
 pe.plan_id,
 'test',
 'upgrade-student-a',
 'ACTIVE',
 now()-interval '1 day',
 now()+interval '90 days'
from public.plan_entitlements pe
join public.entitlements e on e.id=pe.entitlement_id
where e.key='monthly_private_sessions' and pe.limit_value>0
order by pe.limit_value desc
limit 1;

insert into public.subscriptions(
 id,user_id,plan_id,provider,provider_subscription_id,status,current_period_start,current_period_end
)
select
 'a9290000-0000-4000-8000-000000000002',
 'a9000000-0000-4000-8000-000000000003',
 pe.plan_id,
 'test',
 'upgrade-student-b',
 'ACTIVE',
 now()-interval '1 day',
 now()+interval '90 days'
from public.plan_entitlements pe
join public.entitlements e on e.id=pe.entitlement_id
where e.key='monthly_private_sessions' and pe.limit_value>0
order by pe.limit_value desc
limit 1;

insert into public.live_sessions(
 id,teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status,cohort_id,target_student_user_id
) values (
 'a9300000-0000-4000-8000-000000000001',
 'a9100000-0000-4000-8000-000000000001',
 'PRIVATE_SESSION',
 'Existing private with target',
 date_trunc('day',now())+interval '60 days 12 hours',
 date_trunc('day',now())+interval '60 days 13 hours',
 1,
 'monthly_private_sessions',
 'SCHEDULED',
 null,
 'a9000000-0000-4000-8000-000000000002'
);

insert into public.session_bookings(
 id,live_session_id,user_id,status,booked_at
) values (
 'a9400000-0000-4000-8000-000000000001',
 'a9300000-0000-4000-8000-000000000001',
 'a9000000-0000-4000-8000-000000000002',
 'BOOKED',
 now()
);

insert into public.lesson_assets(
 id,lesson_id,asset_type,position,source_url
) values (
 'a9500000-0000-4000-8000-000000000001',
 '42000000-0000-4000-8000-000000000003',
 'VIDEO',
 77,
 'https://legacy.example.test/video.mp4'
);
SQL

mapfile -t HEAD_MIGRATIONS < <(
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | sort
)
mapfile -t NEW_MIGRATIONS < <(
  comm -13     <(printf '%s\n' "${BASE_MIGRATIONS[@]}" | sort)     <(printf '%s\n' "${HEAD_MIGRATIONS[@]}" | sort)
)

if [ "${#NEW_MIGRATIONS[@]}" -eq 0 ]; then
  echo "No head-only migrations found; upgrade fixture cannot exercise the candidate." >&2
  exit 1
fi

for migration in "${NEW_MIGRATIONS[@]}"; do
  echo "▶ upgrade $migration"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "▶ upgrade assertions"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists(
    select 1 from public.live_sessions
    where id='a9300000-0000-4000-8000-000000000001'
      and session_type='PRIVATE_SESSION'
      and target_student_user_id='a9000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Existing PRIVATE session target changed during upgrade';
  end if;

  if not exists(
    select 1 from public.session_bookings b
    join public.live_sessions s on s.id=b.live_session_id
    where b.id='a9400000-0000-4000-8000-000000000001'
      and b.status='BOOKED'
      and b.user_id='a9000000-0000-4000-8000-000000000002'
      and b.usage_session_starts_at=s.starts_at
      and b.entitlement_key_used='monthly_private_sessions'
  ) then
    raise exception 'Legacy booking identity/usage snapshot changed during upgrade';
  end if;

  if private.can_book_session(
    'a9300000-0000-4000-8000-000000000001',
    'a9000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Legacy PRIVATE session without target accepts a new Student';
  end if;

  if not exists(
    select 1
    from public.lesson_assets a
    join public.lesson_video_assets v on v.lesson_asset_id=a.id
    where a.id='a9500000-0000-4000-8000-000000000001'
      and a.asset_type='VIDEO'
      and a.source_url='https://legacy.example.test/video.mp4'
      and v.processing_status='AWAITING_UPLOAD'
  ) then
    raise exception 'Historical VIDEO asset was not safely backfilled';
  end if;

  if not exists(
    select 1 from public.teacher_student_assignments
    where id='a9250000-0000-4000-8000-000000000001'
      and ends_at is null
  ) then
    raise exception 'Existing Teacher assignment changed during upgrade';
  end if;

  if not exists(
    select 1
    from public.cohort_memberships m
    join public.cohort_teachers t on t.cohort_id=m.cohort_id
    where m.id='a9270000-0000-4000-8000-000000000001'
      and m.status='ACTIVE'
      and t.id='a9280000-0000-4000-8000-000000000001'
      and t.ends_at is null
  ) then
    raise exception 'Existing Cohort membership/Teacher scope changed during upgrade';
  end if;
end
$$;

-- New writes must obey the new target invariant; this is deliberately expected to fail.
do $$
begin
  begin
    insert into public.live_sessions(
      teacher_id,session_type,title,starts_at,ends_at,capacity,required_entitlement_key,status
    ) values (
      'a9100000-0000-4000-8000-000000000001',
      'PRIVATE_SESSION',
      'Invalid new private without target',
      date_trunc('day',now())+interval '61 days 12 hours',
      date_trunc('day',now())+interval '61 days 13 hours',
      1,
      'monthly_private_sessions',
      'SCHEDULED'
    );
    raise exception 'New PRIVATE session without target unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end
$$;
SQL

echo "✓ base-to-head upgrade validation passed ($BASE_SHA -> HEAD)"
