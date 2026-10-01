-- P15 integration evidence for idempotent Practice attempts, responses and results.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('84000000-0000-0000-0000-000000000001', 'practice-a@example.test', '{"display_name":"Practice A"}'),
  ('84000000-0000-0000-0000-000000000002', 'practice-b@example.test', '{"display_name":"Practice B"}')
on conflict (id) do nothing;

insert into public.user_roles (id, user_id, role)
values
  ('84100000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'STUDENT'),
  ('84100000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000002', 'STUDENT')
on conflict (id) do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000001","aal":"aal1"}', false);

do $$
declare
  first_attempt public.practice_attempts;
  retried_attempt public.practice_attempts;
  first_result public.practice_results;
  retried_result public.practice_results;
  manual_attempt public.practice_attempts;
  manual_result public.practice_results;
  persisted_count integer;
begin
  first_attempt := public.start_practice_attempt(
    '83000000-0000-4000-8000-000000000001',
    '84200000-0000-0000-0000-000000000001'
  );
  retried_attempt := public.start_practice_attempt(
    '83000000-0000-4000-8000-000000000001',
    '84200000-0000-0000-0000-000000000001'
  );

  if first_attempt.id <> retried_attempt.id then
    raise exception 'Start retry must return the same Practice attempt';
  end if;

  select count(*) into persisted_count
  from public.practice_attempts
  where user_id = '84000000-0000-0000-0000-000000000001'
    and idempotency_key = '84200000-0000-0000-0000-000000000001';
  if persisted_count <> 1 then
    raise exception 'Start retry created duplicate Practice attempts';
  end if;

  first_result := public.submit_practice_attempt(first_attempt.id, '{"optionId":"meet"}'::jsonb);
  retried_result := public.submit_practice_attempt(first_attempt.id, '{"optionId":"meeting"}'::jsonb);

  if first_result.id <> retried_result.id then
    raise exception 'Submit retry must return the original Practice result';
  end if;
  if first_result.evaluation_status <> 'CORRECT' or first_result.score <> 1 then
    raise exception 'Deterministic Practice answer was not objectively evaluated';
  end if;

  select count(*) into persisted_count
  from public.practice_responses
  where practice_attempt_id = first_attempt.id;
  if persisted_count <> 1 then
    raise exception 'Submit retry created duplicate Practice responses';
  end if;

  manual_attempt := public.start_practice_attempt(
    '83000000-0000-4000-8000-000000000003',
    '84200000-0000-0000-0000-000000000003'
  );
  manual_result := public.submit_practice_attempt(
    manual_attempt.id,
    '{"text":"My name is Ana and I live in São Paulo."}'::jsonb
  );

  if manual_result.evaluation_status <> 'PENDING_MANUAL'
    or manual_result.score is not null
    or manual_result.max_score is not null then
    raise exception 'Speaking must remain pending/manual without an inferred score';
  end if;

  perform public.track_product_event(
    'practice_started', null,
    jsonb_build_object('practice_activity_id', first_attempt.practice_activity_id),
    'practice_started:' || first_attempt.id
  );
  perform public.track_product_event(
    'practice_started', null,
    jsonb_build_object('practice_activity_id', first_attempt.practice_activity_id),
    'practice_started:' || first_attempt.id
  );
  perform public.track_product_event(
    'practice_completed', null,
    jsonb_build_object('practice_activity_id', first_attempt.practice_activity_id),
    'practice_completed:' || first_attempt.id
  );
  perform public.track_product_event(
    'practice_completed', null,
    jsonb_build_object('practice_activity_id', first_attempt.practice_activity_id),
    'practice_completed:' || first_attempt.id
  );

  perform set_config('app.practice_attempt_id', first_attempt.id::text, false);
end;
$$;

select set_config('request.jwt.claim.sub', '84000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"84000000-0000-0000-0000-000000000002","aal":"aal1"}', false);

do $$
declare
  visible_count integer;
  foreign_attempt_id uuid;
begin
  select count(*) into visible_count
  from public.practice_attempts
  where user_id = '84000000-0000-0000-0000-000000000001';
  if visible_count <> 0 then
    raise exception 'Student B must not read Student A Practice attempts';
  end if;

  foreign_attempt_id := current_setting('app.practice_attempt_id')::uuid;

  begin
    perform public.submit_practice_attempt(foreign_attempt_id, '{"optionId":"meet"}'::jsonb);
    raise exception 'Student B must not submit Student A Practice attempt';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
declare
  analytics_count integer;
  first_attempt_id uuid := current_setting('app.practice_attempt_id')::uuid;
begin
  if has_table_privilege('authenticated', 'public.practice_attempts', 'INSERT')
    or has_table_privilege('authenticated', 'public.practice_attempts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.practice_responses', 'INSERT')
    or has_table_privilege('authenticated', 'public.practice_results', 'INSERT') then
    raise exception 'Practice writes must remain behind authenticated RPCs';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('practice_attempts', 'practice_responses', 'practice_results')
      and column_name in ('cefr_level', 'result_cefr', 'fluency_score', 'pronunciation_score')
  ) then
    raise exception 'Practice persistence must not invent CEFR, fluency or pronunciation scores';
  end if;

  select count(*) into analytics_count
  from public.product_analytics_events
  where user_id = '84000000-0000-0000-0000-000000000001'
    and idempotency_key in (
      'practice_started:' || first_attempt_id,
      'practice_completed:' || first_attempt_id
    );
  if analytics_count <> 2 then
    raise exception 'Practice analytics must remain idempotent';
  end if;
end;
$$;
