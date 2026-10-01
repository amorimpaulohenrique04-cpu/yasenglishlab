-- P19 — Assessment Engine V1.
-- Reuses the existing versioned Assessment model while keeping CEFR interpretation deliberately absent.

alter table public.assessment_attempts
  add column idempotency_key uuid;

alter table public.assessment_attempts
  add constraint assessment_attempts_user_idempotency_unique
  unique (user_id, idempotency_key);

-- Historical grants exposed scoring_config/answer_key/rubric whenever row RLS allowed access.
-- Keep the rows discoverable through the existing RLS policies, but expose only the fields
-- required to execute an assessment. Scoring secrets remain server-side.
revoke select on public.assessment_versions from authenticated;
revoke select on public.assessment_items from authenticated;
revoke all on public.assessment_versions from anon;
revoke all on public.assessment_items from anon;

grant select (
  id,
  assessment_id,
  version_number,
  status,
  published_at,
  created_at
) on public.assessment_versions to authenticated;

grant select (
  id,
  assessment_version_id,
  position,
  skill,
  cefr_target,
  item_type,
  prompt,
  created_at
) on public.assessment_items to authenticated;

-- Assessment lifecycle writes stay behind authenticated RPCs.
revoke insert, update, delete on public.assessment_attempts from authenticated;
revoke insert, update, delete on public.assessment_responses from authenticated;
revoke insert, update, delete on public.skill_scores from authenticated;

create or replace function private.validate_assessment_attempt_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_status text;
begin
  if tg_op = 'UPDATE'
    and new.assessment_version_id is distinct from old.assessment_version_id then
    raise exception 'assessment attempt version is immutable' using errcode = '55000';
  end if;

  select v.status into version_status
  from public.assessment_versions v
  where v.id = new.assessment_version_id;

  if version_status is distinct from 'PUBLISHED' then
    raise exception 'assessment attempt must reference a published immutable version'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.start_assessment_attempt(
  p_assessment_version_id uuid,
  p_idempotency_key uuid
)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  version_status text;
  assessment_active boolean;
  item_count integer;
  result_row public.assessment_attempts;
begin
  if actor_user_id is null or not private.has_role('STUDENT', false) then
    raise exception 'Student authentication required' using errcode = '42501';
  end if;

  if p_assessment_version_id is null or p_idempotency_key is null then
    raise exception 'Assessment version and idempotency key are required';
  end if;

  select version.status, assessment.active
    into version_status, assessment_active
  from public.assessment_versions version
  join public.assessments assessment on assessment.id = version.assessment_id
  where version.id = p_assessment_version_id;

  if version_status is distinct from 'PUBLISHED' or assessment_active is distinct from true then
    raise exception 'Published active assessment version required' using errcode = '42501';
  end if;

  select count(*) into item_count
  from public.assessment_items item
  where item.assessment_version_id = p_assessment_version_id;

  if item_count = 0 then
    raise exception 'Assessment version has no executable items';
  end if;

  if exists (
    select 1
    from public.assessment_items item
    where item.assessment_version_id = p_assessment_version_id
      and item.item_type not in ('MULTIPLE_CHOICE', 'MANUAL_TEXT')
  ) then
    raise exception 'Assessment version contains an unsupported item type';
  end if;

  if exists (
    select 1
    from public.assessment_items item
    where item.assessment_version_id = p_assessment_version_id
      and item.skill in ('SPEAKING', 'PRONUNCIATION')
      and item.item_type <> 'MANUAL_TEXT'
  ) then
    raise exception 'Speaking and Pronunciation must remain manual/pending in Assessment V1';
  end if;

  if exists (
    select 1
    from public.assessment_items item
    where item.assessment_version_id = p_assessment_version_id
      and item.item_type = 'MULTIPLE_CHOICE'
      and (
        jsonb_typeof(item.prompt) is distinct from 'object'
        or jsonb_typeof(item.prompt -> 'prompt') is distinct from 'string'
        or nullif(btrim(item.prompt ->> 'prompt'), '') is null
        or jsonb_typeof(item.prompt -> 'options') is distinct from 'array'
        or jsonb_array_length(item.prompt -> 'options') < 2
        or jsonb_typeof(item.answer_key) is distinct from 'object'
        or jsonb_typeof(item.answer_key -> 'optionId') is distinct from 'string'
        or nullif(btrim(item.answer_key ->> 'optionId'), '') is null
        or not exists (
          select 1
          from jsonb_array_elements(item.prompt -> 'options') option
          where option ->> 'id' = item.answer_key ->> 'optionId'
        )
      )
  ) then
    raise exception 'Assessment multiple-choice contract is invalid';
  end if;

  if exists (
    select 1
    from public.assessment_items item
    where item.assessment_version_id = p_assessment_version_id
      and item.item_type = 'MANUAL_TEXT'
      and (
        jsonb_typeof(item.prompt) is distinct from 'object'
        or jsonb_typeof(item.prompt -> 'prompt') is distinct from 'string'
        or nullif(btrim(item.prompt ->> 'prompt'), '') is null
      )
  ) then
    raise exception 'Assessment manual-text contract is invalid';
  end if;

  insert into public.assessment_attempts (
    user_id,
    assessment_version_id,
    idempotency_key,
    result_cefr,
    result_metadata
  )
  values (
    actor_user_id,
    p_assessment_version_id,
    p_idempotency_key,
    null,
    jsonb_build_object(
      'engine', 'assessment-engine-v1',
      'assessment_version_id', p_assessment_version_id
    )
  )
  on conflict (user_id, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into result_row;

  if result_row.assessment_version_id <> p_assessment_version_id then
    raise exception 'Idempotency key already belongs to another assessment version';
  end if;

  return result_row;
end;
$$;

revoke all on function public.start_assessment_attempt(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.start_assessment_attempt(uuid, uuid)
  to authenticated;

create or replace function public.record_assessment_response(
  p_assessment_attempt_id uuid,
  p_assessment_item_id uuid,
  p_response jsonb
)
returns public.assessment_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  attempt_row public.assessment_attempts;
  item_row public.assessment_items;
  result_row public.assessment_responses;
  response_key_count integer;
  option_id text;
  response_text text;
begin
  if actor_user_id is null or not private.has_role('STUDENT', false) then
    raise exception 'Student authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_response, 'null'::jsonb)) <> 'object' then
    raise exception 'Assessment response must be an object';
  end if;

  select *
    into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_assessment_attempt_id
    and attempt.user_id = actor_user_id
  for update;

  if attempt_row.id is null then
    raise exception 'Assessment attempt not found' using errcode = '42501';
  end if;

  if attempt_row.status <> 'IN_PROGRESS' then
    raise exception 'Assessment attempt no longer accepts responses';
  end if;

  select *
    into item_row
  from public.assessment_items item
  where item.id = p_assessment_item_id;

  if item_row.id is null
    or item_row.assessment_version_id <> attempt_row.assessment_version_id then
    raise exception 'Assessment item must belong to the attempt version'
      using errcode = '23514';
  end if;

  select count(*) into response_key_count
  from jsonb_object_keys(p_response);

  if item_row.item_type = 'MULTIPLE_CHOICE'
    and item_row.skill not in ('SPEAKING', 'PRONUNCIATION') then
    option_id := nullif(btrim(p_response ->> 'optionId'), '');

    if response_key_count <> 1
      or option_id is null
      or not exists (
        select 1
        from jsonb_array_elements(item_row.prompt -> 'options') option
        where option ->> 'id' = option_id
      ) then
      raise exception 'A valid single assessment option is required';
    end if;

    p_response := jsonb_build_object('optionId', option_id);
  elsif item_row.item_type = 'MANUAL_TEXT' then
    response_text := nullif(btrim(p_response ->> 'text'), '');

    if response_key_count <> 1
      or response_text is null
      or char_length(response_text) > 4000 then
      raise exception 'Manual assessment response must contain 1 to 4000 characters';
    end if;

    p_response := jsonb_build_object('text', response_text);
  else
    raise exception 'Assessment item is unsupported by V1';
  end if;

  insert into public.assessment_responses (
    assessment_attempt_id,
    assessment_item_id,
    response,
    score,
    feedback,
    scored_at
  )
  values (
    attempt_row.id,
    item_row.id,
    p_response,
    null,
    null,
    null
  )
  on conflict (assessment_attempt_id, assessment_item_id)
  do update set
    response = excluded.response,
    score = null,
    feedback = null,
    scored_at = null
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.record_assessment_response(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_assessment_response(uuid, uuid, jsonb)
  to authenticated;

create or replace function public.complete_assessment_attempt(
  p_assessment_attempt_id uuid
)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  attempt_row public.assessment_attempts;
  result_row public.assessment_attempts;
  pending_count integer;
  objective_max integer;
  objective_score numeric;
begin
  if actor_user_id is null or not private.has_role('STUDENT', false) then
    raise exception 'Student authentication required' using errcode = '42501';
  end if;

  select *
    into attempt_row
  from public.assessment_attempts attempt
  where attempt.id = p_assessment_attempt_id
    and attempt.user_id = actor_user_id
  for update;

  if attempt_row.id is null then
    raise exception 'Assessment attempt not found' using errcode = '42501';
  end if;

  if attempt_row.status in ('SUBMITTED', 'SCORED') then
    return attempt_row;
  end if;

  if attempt_row.status <> 'IN_PROGRESS' then
    raise exception 'Assessment attempt cannot be completed';
  end if;

  if exists (
    select 1
    from public.assessment_items item
    left join public.assessment_responses response
      on response.assessment_attempt_id = attempt_row.id
      and response.assessment_item_id = item.id
    where item.assessment_version_id = attempt_row.assessment_version_id
      and response.id is null
  ) then
    raise exception 'Every assessment item requires a response before completion';
  end if;

  update public.assessment_responses response
  set
    score = case
      when response.response ->> 'optionId' = item.answer_key ->> 'optionId' then 1
      else 0
    end,
    feedback = null,
    scored_at = now()
  from public.assessment_items item
  where response.assessment_attempt_id = attempt_row.id
    and item.id = response.assessment_item_id
    and item.assessment_version_id = attempt_row.assessment_version_id
    and item.item_type = 'MULTIPLE_CHOICE'
    and item.skill not in ('SPEAKING', 'PRONUNCIATION');

  insert into public.skill_scores (
    assessment_attempt_id,
    skill,
    score,
    max_score,
    cefr_level,
    provenance
  )
  select
    attempt_row.id,
    item.skill,
    sum(response.score),
    count(*)::numeric,
    null,
    jsonb_build_object(
      'engine', 'assessment-engine-v1',
      'assessment_version_id', attempt_row.assessment_version_id,
      'formula', 'sum_binary_item_scores',
      'item_ids', jsonb_agg(item.id order by item.position)
    )
  from public.assessment_responses response
  join public.assessment_items item on item.id = response.assessment_item_id
  where response.assessment_attempt_id = attempt_row.id
    and response.score is not null
  group by item.skill;

  select
    count(*) filter (where response.score is null),
    count(*) filter (where response.score is not null),
    coalesce(sum(response.score) filter (where response.score is not null), 0)
  into pending_count, objective_max, objective_score
  from public.assessment_responses response
  where response.assessment_attempt_id = attempt_row.id;

  update public.assessment_attempts
  set
    status = case when pending_count = 0 then 'SCORED' else 'SUBMITTED' end,
    submitted_at = now(),
    scored_at = case when pending_count = 0 then now() else null end,
    raw_score = case when pending_count = 0 then objective_score else null end,
    result_cefr = null,
    result_metadata = jsonb_build_object(
      'engine', 'assessment-engine-v1',
      'assessment_version_id', attempt_row.assessment_version_id,
      'objective_score', objective_score,
      'objective_max_score', objective_max,
      'pending_item_count', pending_count,
      'cefr_interpretation', null
    )
  where id = attempt_row.id
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.complete_assessment_attempt(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_assessment_attempt(uuid)
  to authenticated;
