-- Rate limiter: make the window length part of the counter identity.
-- Before: primary key (bucket, key_hash, window_start). Two different window lengths can yield the same
-- date_bin() start (e.g. 60s and 3600s during the first minute of an hour) and then shared one counter row.
-- After: primary key also includes window_seconds.
-- Legacy rows get window_seconds = 0 (their length is unknowable). consume_rate_limit never matches 0, so they
-- are inert and removed by the existing opportunistic cleanup. Effect at deploy: counters of windows in flight
-- restart once; at most one extra window of attempts per key, never more.
alter table public.rate_limit_counters
  add column window_seconds integer not null default 0 check (window_seconds between 0 and 86400);
alter table public.rate_limit_counters alter column window_seconds drop default;

alter table public.rate_limit_counters drop constraint rate_limit_counters_pkey;
alter table public.rate_limit_counters add primary key (bucket, key_hash, window_start, window_seconds);

create or replace function public.consume_rate_limit(p_bucket text, p_key_hash text, p_limit integer, p_window_seconds integer)
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

  insert into public.rate_limit_counters as c (bucket, key_hash, window_start, window_seconds, hits)
  values (p_bucket, p_key_hash, v_window, p_window_seconds, 1)
  on conflict (bucket, key_hash, window_start, window_seconds) do update set hits = least(c.hits, 1000000) + 1
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
