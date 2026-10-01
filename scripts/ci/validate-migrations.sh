#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${1:-yas_migration_validation}"
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

create function auth.uid()
returns uuid
language sql
stable
as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid;';

create function auth.jwt()
returns jsonb
language sql
stable
as 'select coalesce(nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb, ''{}''::jsonb);';

-- Mirror the Supabase Auth schema contract used by anon/authenticated.
grant usage on schema auth to anon, authenticated;

-- Fail fast if the synthetic CI bootstrap drifts from the auth contract
-- expected by RLS policies and database tests.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',
  true
);
do $
begin
  if auth.uid() is distinct from '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Synthetic Supabase auth.uid() contract is invalid';
  end if;

  if auth.jwt() ->> 'role' is distinct from 'authenticated' then
    raise exception 'Synthetic Supabase auth.jwt() contract is invalid';
  end if;
end
$;
rollback;
SQL

while IFS= read -r migration; do
  echo "▶ applying $migration"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$migration"
done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort)

echo "▶ applying seed twice"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/seed.sql

while IFS= read -r db_test; do
  echo "▶ running $db_test"
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$db_test"
done < <(find supabase/tests -maxdepth 1 -type f -name '*.sql' | sort)

echo "✓ clean database migration validation passed"
