#!/usr/bin/env bash
set -euo pipefail

database="${1:-yas_ci}"
run_tests="${RUN_DB_TESTS:-1}"

dropdb --if-exists "$database" >/dev/null 2>&1 || true
createdb "$database"

psql -d "$database" -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  create role anon nologin;
exception when duplicate_object then
  null;
end
$$;

do $$
begin
  create role authenticated nologin;
exception when duplicate_object then
  null;
end
$$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create or replace function auth.uid()
returns uuid
language sql
stable
as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid;';

create or replace function auth.jwt()
returns jsonb
language sql
stable
as 'select coalesce(nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb, ''{}''::jsonb);';
SQL

for migration in supabase/migrations/*.sql; do
  psql -d "$database" -v ON_ERROR_STOP=1 -f "$migration"
done

psql -d "$database" -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql -d "$database" -v ON_ERROR_STOP=1 -f supabase/seed.sql

if [[ "$run_tests" == "1" ]]; then
  for db_test in supabase/tests/*.sql; do
    psql -d "$database" -v ON_ERROR_STOP=1 -f "$db_test"
  done
fi

echo "✓ Database replay passed: $database"
