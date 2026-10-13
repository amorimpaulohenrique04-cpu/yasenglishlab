-- Stage 07b-1: fixed-window rate limiter in Postgres (service_role only).
-- Keys arrive already hashed (sha256 hex) by the app: no IP/e-mail is ever stored in clear.
-- Limits are decided by the app; this layer only counts atomically.
create table public.rate_limit_counters (
  bucket text not null check (bucket ~ '^[a-z][a-z0-9_]{2,40}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null check (hits >= 1),
  primary key (bucket, key_hash, window_start)
);
create index rate_limit_counters_window_start_idx on public.rate_limit_counters (window_start);

alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from public, anon, authenticated, service_role;

create function public.consume_rate_limit(p_bucket text, p_key_hash text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
  v_retry integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-z][a-z0-9_]{2,40}$' then
    raise exception 'Invalid rate limit bucket' using errcode = '22023';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit key' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate limit limit' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit window' using errcode = '22023';
  end if;

  v_window := date_bin(make_interval(secs => p_window_seconds), now(), timestamptz '2000-01-01 00:00:00+00');

  insert into public.rate_limit_counters as c (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, v_window, 1)
  on conflict (bucket, key_hash, window_start) do update set hits = least(c.hits, 1000000) + 1
  returning c.hits into v_hits;

  -- Cheap opportunistic cleanup: ~2% of calls remove at most 100 expired rows without waiting on locks.
  if random() < 0.02 then
    delete from public.rate_limit_counters d
    where d.ctid in (
      select s.ctid from public.rate_limit_counters s
      where s.window_start < now() - interval '2 days'
      limit 100
      for update skip locked
    );
  end if;

  v_retry := greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::integer);
  return jsonb_build_object('allowed', v_hits <= p_limit, 'hits', v_hits, 'limit', p_limit, 'retry_after_seconds', v_retry);
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
