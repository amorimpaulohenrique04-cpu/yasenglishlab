-- P15 — deterministic Practice V1.
-- Practice results are independent from lesson progress and CEFR assessment.

alter table public.practice_attempts
  add column idempotency_key uuid;

alter table public.practice_attempts
  add constraint practice_attempts_user_idempotency_unique
  unique (user_id, idempotency_key);

alter table public.practice_results
  add column evaluation_status text not null default 'NOT_SCORED'
  check (evaluation_status in ('CORRECT', 'INCORRECT', 'PENDING_MANUAL', 'NOT_SCORED'));

create table public.practice_responses (
  id uuid primary key default gen_random_uuid(),
  practice_attempt_id uuid not null unique
    references public.practice_attempts(id) on delete cascade,
  response jsonb not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(response) = 'object')
);

create table private.practice_answer_keys (
  practice_activity_id uuid primary key
    references public.practice_activities(id) on delete cascade,
  answer_key jsonb not null,
  feedback jsonb not null default '{}'::jsonb,
  check (jsonb_typeof(answer_key) = 'object'),
  check (jsonb_typeof(feedback) = 'object')
);

alter table public.practice_responses enable row level security;

revoke all on public.practice_attempts from public, anon, authenticated;
revoke all on public.practice_results from public, anon, authenticated;
revoke all on public.practice_responses from public, anon, authenticated;
revoke all on private.practice_answer_keys from public, anon, authenticated;

grant select on public.practice_attempts to authenticated;
grant select on public.practice_results to authenticated;
grant select on public.practice_responses to authenticated;

create policy practice_responses_authorized_select
on public.practice_responses for select
to authenticated
using (
  exists (
    select 1
    from public.practice_attempts attempt
    where attempt.id = practice_responses.practice_attempt_id
      and private.can_view_student(attempt.user_id)
  )
);

create or replace function public.start_practice_attempt(
  p_practice_activity_id uuid,
  p_idempotency_key uuid
)
returns public.practice_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  activity_mode text;
  result_row public.practice_attempts;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'Practice idempotency key is required';
  end if;

  select activity.content ->> 'evaluationMode'
  into activity_mode
  from public.practice_activities activity
  where activity.id = p_practice_activity_id
    and activity.active;

  if activity_mode is null or activity_mode not in ('DETERMINISTIC', 'MANUAL_PENDING') then
    raise exception 'Practice activity is unsupported';
  end if;

  insert into public.practice_attempts (
    user_id,
    practice_activity_id,
    idempotency_key,
    context
  )
  values (
    actor_user_id,
    p_practice_activity_id,
    p_idempotency_key,
    jsonb_build_object('evaluation_mode', activity_mode)
  )
  on conflict (user_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into result_row;

  if result_row.practice_activity_id <> p_practice_activity_id then
    raise exception 'Idempotency key already belongs to another activity';
  end if;

  return result_row;
end;
$$;

revoke all on function public.start_practice_attempt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.start_practice_attempt(uuid, uuid)
  to authenticated;

create or replace function public.submit_practice_attempt(
  p_practice_attempt_id uuid,
  p_response jsonb
)
returns public.practice_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  attempt_row public.practice_attempts;
  activity_row public.practice_activities;
  answer_row private.practice_answer_keys;
  result_row public.practice_results;
  evaluation_mode text;
  submitted_option_id text;
  expected_option_id text;
  response_text text;
  is_correct boolean;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_response, 'null'::jsonb)) <> 'object' then
    raise exception 'Practice response must be an object';
  end if;

  select *
  into attempt_row
  from public.practice_attempts attempt
  where attempt.id = p_practice_attempt_id
    and attempt.user_id = actor_user_id
  for update;

  if attempt_row.id is null then
    raise exception 'Practice attempt not found' using errcode = '42501';
  end if;

  if attempt_row.status = 'SUBMITTED' then
    select * into result_row
    from public.practice_results result
    where result.practice_attempt_id = attempt_row.id;

    if result_row.id is null then
      raise exception 'Submitted practice attempt has no result';
    end if;

    return result_row;
  end if;

  if attempt_row.status <> 'IN_PROGRESS' then
    raise exception 'Practice attempt cannot be submitted';
  end if;

  select *
  into activity_row
  from public.practice_activities activity
  where activity.id = attempt_row.practice_activity_id
    and activity.active;

  if activity_row.id is null then
    raise exception 'Practice activity is unavailable';
  end if;

  evaluation_mode := activity_row.content ->> 'evaluationMode';

  if evaluation_mode = 'DETERMINISTIC' then
    submitted_option_id := nullif(btrim(p_response ->> 'optionId'), '');

    if submitted_option_id is null or not exists (
      select 1
      from jsonb_array_elements(activity_row.content -> 'options') option
      where option ->> 'id' = submitted_option_id
    ) then
      raise exception 'A valid practice option is required';
    end if;

    select *
    into answer_row
    from private.practice_answer_keys answer_key
    where answer_key.practice_activity_id = activity_row.id;

    expected_option_id := answer_row.answer_key ->> 'optionId';
    if expected_option_id is null then
      raise exception 'Deterministic activity has no answer key';
    end if;

    is_correct := submitted_option_id = expected_option_id;

    insert into public.practice_responses (practice_attempt_id, response)
    values (attempt_row.id, jsonb_build_object('optionId', submitted_option_id));

    insert into public.practice_results (
      practice_attempt_id,
      score,
      max_score,
      feedback,
      metrics,
      evaluation_status
    )
    values (
      attempt_row.id,
      case when is_correct then 1 else 0 end,
      1,
      case
        when is_correct then coalesce(
          answer_row.feedback ->> 'correct',
          'Resposta correta.'
        )
        else coalesce(
          answer_row.feedback ->> 'incorrect',
          'Resposta incorreta. Revise a explicação e tente outra atividade.'
        )
      end,
      jsonb_build_object(
        'evaluation_mode', 'DETERMINISTIC',
        'correct', is_correct
      ),
      case when is_correct then 'CORRECT' else 'INCORRECT' end
    )
    returning * into result_row;
  elsif evaluation_mode = 'MANUAL_PENDING' then
    response_text := nullif(btrim(p_response ->> 'text'), '');

    if response_text is null or char_length(response_text) > 2000 then
      raise exception 'Manual response must contain 1 to 2000 characters';
    end if;

    insert into public.practice_responses (practice_attempt_id, response)
    values (attempt_row.id, jsonb_build_object('text', response_text));

    insert into public.practice_results (
      practice_attempt_id,
      score,
      max_score,
      feedback,
      metrics,
      evaluation_status
    )
    values (
      attempt_row.id,
      null,
      null,
      'Resposta registrada. A política de avaliação permanece pendente; nenhum score foi inferido.',
      jsonb_build_object('evaluation_mode', 'MANUAL_PENDING'),
      'PENDING_MANUAL'
    )
    returning * into result_row;
  else
    raise exception 'Practice activity evaluation mode is unsupported';
  end if;

  update public.practice_attempts
  set status = 'SUBMITTED', submitted_at = now()
  where id = attempt_row.id;

  return result_row;
end;
$$;

revoke all on function public.submit_practice_attempt(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_practice_attempt(uuid, jsonb)
  to authenticated;
