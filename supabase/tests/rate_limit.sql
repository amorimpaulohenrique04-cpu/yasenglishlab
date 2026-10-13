-- Stage 07b-1: Postgres fixed-window rate limiter. Transactional (rolls back); now() is stable inside the transaction.
begin;

create function pg_temp.expect_invalid(p_bucket text, p_key text, p_limit integer, p_window integer, p_message text) returns void language plpgsql as $$
begin
  begin
    perform public.consume_rate_limit(p_bucket, p_key, p_limit, p_window);
  exception when invalid_parameter_value then
    if sqlerrm <> p_message then raise exception 'Unstable message for (%,%,%,%): %', p_bucket, p_key, p_limit, p_window, sqlerrm; end if;
    return;
  end;
  raise exception 'Invalid parameters accepted: (%,%,%,%)', p_bucket, p_key, p_limit, p_window;
end $$;

do $$
declare
  k1 constant text := repeat('a', 64);
  k2 constant text := repeat('b', 64);
  r jsonb; i integer;
begin
  -- within the limit: allowed, increasing hits
  for i in 1..3 loop
    r := public.consume_rate_limit('rltest_signup', k1, 3, 60);
    if not (r->>'allowed')::boolean or (r->>'hits')::int <> i or (r->>'limit')::int <> 3 then
      raise exception 'Hit % within limit wrong: %', i, r;
    end if;
  end loop;
  -- the (limit+1)-th is denied with a sane retry_after
  r := public.consume_rate_limit('rltest_signup', k1, 3, 60);
  if (r->>'allowed')::boolean or (r->>'hits')::int <> 4 then raise exception 'Over-limit allowed: %', r; end if;
  if (r->>'retry_after_seconds')::int not between 1 and 60 then raise exception 'retry_after out of range: %', r; end if;
  r := public.consume_rate_limit('rltest_signup', k1, 3, 60);
  if (r->>'allowed')::boolean or (r->>'hits')::int <> 5 then raise exception 'Still over limit expected: %', r; end if;

  -- independent keys and buckets
  r := public.consume_rate_limit('rltest_signup', k2, 3, 60);
  if not (r->>'allowed')::boolean or (r->>'hits')::int <> 1 then raise exception 'Keys not independent: %', r; end if;
  r := public.consume_rate_limit('rltest_forgot', k1, 3, 60);
  if not (r->>'allowed')::boolean or (r->>'hits')::int <> 1 then raise exception 'Buckets not independent: %', r; end if;

  -- limit 1 and the largest window keep retry_after within bounds
  perform public.consume_rate_limit('rltest_edge', k1, 1, 86400);
  r := public.consume_rate_limit('rltest_edge', k1, 1, 86400);
  if (r->>'allowed')::boolean or (r->>'retry_after_seconds')::int not between 1 and 86400 then raise exception 'Edge window wrong: %', r; end if;

  -- a different window length is a different counter row
  r := public.consume_rate_limit('rltest_signup', k1, 3, 3600);
  if (r->>'hits')::int <> 1 then raise exception 'Window length not part of the counter: %', r; end if;

  -- invalid parameters: SQLSTATE 22023 with stable messages
  perform pg_temp.expect_invalid('ab', k1, 3, 60, 'Invalid rate limit bucket');
  perform pg_temp.expect_invalid('Signup', k1, 3, 60, 'Invalid rate limit bucket');
  perform pg_temp.expect_invalid('rltest-signup', k1, 3, 60, 'Invalid rate limit bucket');
  perform pg_temp.expect_invalid(null, k1, 3, 60, 'Invalid rate limit bucket');
  perform pg_temp.expect_invalid('rltest_signup', 'person@example.test', 3, 60, 'Invalid rate limit key');
  perform pg_temp.expect_invalid('rltest_signup', repeat('A', 64), 3, 60, 'Invalid rate limit key');
  perform pg_temp.expect_invalid('rltest_signup', '203.0.113.9', 3, 60, 'Invalid rate limit key');
  perform pg_temp.expect_invalid('rltest_signup', null, 3, 60, 'Invalid rate limit key');
  perform pg_temp.expect_invalid('rltest_signup', k1, 0, 60, 'Invalid rate limit limit');
  perform pg_temp.expect_invalid('rltest_signup', k1, 10001, 60, 'Invalid rate limit limit');
  perform pg_temp.expect_invalid('rltest_signup', k1, null, 60, 'Invalid rate limit limit');
  perform pg_temp.expect_invalid('rltest_signup', k1, 3, 9, 'Invalid rate limit window');
  perform pg_temp.expect_invalid('rltest_signup', k1, 3, 86401, 'Invalid rate limit window');
  perform pg_temp.expect_invalid('rltest_signup', k1, 3, null, 'Invalid rate limit window');
  -- invalid calls must not have written rows
  if exists (select 1 from public.rate_limit_counters where key_hash !~ '^[0-9a-f]{64}$') then raise exception 'Non-hash key stored'; end if;

  -- table shape: no free-text column that could hold an IP or e-mail; non-hash keys rejected by the constraint
  if (select array_agg(column_name::text order by column_name::text) from information_schema.columns
      where table_schema = 'public' and table_name = 'rate_limit_counters') <> array['bucket','hits','key_hash','window_start'] then
    raise exception 'Unexpected rate_limit_counters columns';
  end if;
  begin
    insert into public.rate_limit_counters(bucket, key_hash, window_start, hits) values ('rltest_raw', 'person@example.test', now(), 1);
    raise exception 'Raw e-mail stored';
  exception when check_violation then null;
  end;
  begin
    insert into public.rate_limit_counters(bucket, key_hash, window_start, hits) values ('rltest_raw', repeat('c', 64), now(), 0);
    raise exception 'hits < 1 stored';
  exception when check_violation then null;
  end;

  -- opportunistic cleanup eventually removes expired rows (p = 0.02 per call; 1500 calls => miss chance ~ 1e-13)
  insert into public.rate_limit_counters(bucket, key_hash, window_start, hits) values ('rltest_old', repeat('d', 64), now() - interval '3 days', 1);
  for i in 1..1500 loop
    perform public.consume_rate_limit('rltest_clean', k1, 10000, 60);
    exit when not exists (select 1 from public.rate_limit_counters where bucket = 'rltest_old');
  end loop;
  if exists (select 1 from public.rate_limit_counters where bucket = 'rltest_old') then raise exception 'Expired rows never cleaned'; end if;
  if not exists (select 1 from public.rate_limit_counters where bucket = 'rltest_signup') then raise exception 'Cleanup removed current rows'; end if;
end $$;

-- grants: no PUBLIC/anon/authenticated access; RLS on with no policies
do $$
begin
  if not has_function_privilege('service_role', 'public.consume_rate_limit(text,text,integer,integer)', 'EXECUTE') then raise exception 'service_role cannot execute'; end if;
  if has_function_privilege('anon', 'public.consume_rate_limit(text,text,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.consume_rate_limit(text,text,integer,integer)', 'EXECUTE') then
    raise exception 'client role can execute rate limiter';
  end if;
  if exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.consume_rate_limit(text,text,integer,integer)'::regprocedure and a.grantee = 0) then
    raise exception 'PUBLIC can execute rate limiter';
  end if;
  if exists (select 1 from pg_class c, aclexplode(c.relacl) a
             where c.oid = 'public.rate_limit_counters'::regclass
               and a.grantee in (0, 'anon'::regrole::oid, 'authenticated'::regrole::oid)) then
    raise exception 'client grants on rate_limit_counters';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.rate_limit_counters'::regclass) then raise exception 'RLS disabled'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rate_limit_counters') then raise exception 'Unexpected policy'; end if;
end $$;

set local role anon;
do $$ begin
  begin perform public.consume_rate_limit('rltest_signup', repeat('a', 64), 3, 60); raise exception 'anon executed RPC'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.rate_limit_counters; raise exception 'anon read table'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
do $$ begin
  begin perform public.consume_rate_limit('rltest_signup', repeat('a', 64), 3, 60); raise exception 'authenticated executed RPC'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.rate_limit_counters; raise exception 'authenticated read table'; exception when insufficient_privilege then null; end;
  begin insert into public.rate_limit_counters(bucket, key_hash, window_start, hits) values ('rltest_x', repeat('e', 64), now(), 1); raise exception 'authenticated wrote table'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare r jsonb;
begin
  r := public.consume_rate_limit('rltest_service', repeat('f', 64), 2, 60);
  if not (r->>'allowed')::boolean or (r->>'hits')::int <> 1 then raise exception 'service_role call failed: %', r; end if;
  begin perform 1 from public.rate_limit_counters; raise exception 'service_role reads table directly'; exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
