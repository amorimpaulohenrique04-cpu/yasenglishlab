-- Stage 13 / Phases 1-3 (practice-10): Practice content v3 (multi-question), per-item feedback and spaced review.
-- Contract: docs/PRACTICE_V3.md sections 2-5 and 7.
--
-- Additive only. Decisions (harness/agent-state/decisions.md):
--  * B. Round 1 returns verdict + explanation and NEVER the answer key; the key is returned only after round 2 or a
--       skip (correct_answer is stored and returned only for round 2; a CHECK enforces it).
--  * D. WRITTEN/SPOKEN items are reviewed by a Teacher per item and are never scheduled for spaced review.
--  * Content v3 = {version:3, objective, askConfidence, instructions?, evaluationMode, items:[...]}; answer keys and
--    per-option explanations live only in private.practice_item_keys (no client grant). v2 is read as ONE item 'main'.
--  * Version 3 content is accepted only through private.validate_practice_v3 (publication guard, Teacher save).
--  * Practice v3 never writes lesson_progress, assessment_attempts or skill_scores (course progress is not CEFR).
--  * practice_results.metrics already exists (jsonb not null default '{}'); v3 stores its metrics there.
--  * Legacy entry points (submit_practice_attempt, 4-argument finalize_practice_review) refuse v3 activities.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Model
-- ---------------------------------------------------------------------------------------------------------
create table private.practice_item_keys (
  practice_activity_id uuid not null references public.practice_activities(id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{1,40}$'),
  answer_key jsonb check (answer_key is null or jsonb_typeof(answer_key) = 'object'),
  feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(feedback) = 'object'),
  primary key (practice_activity_id, item_id)
);
revoke all on private.practice_item_keys from public, anon, authenticated;

create table public.practice_item_responses (
  id uuid primary key default gen_random_uuid(),
  practice_attempt_id uuid not null references public.practice_attempts(id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{1,40}$'),
  round smallint not null check (round in (1, 2)),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  confidence text check (confidence in ('LOW', 'HIGH')),
  evaluation_status text not null check (evaluation_status in ('CORRECT', 'INCORRECT', 'PENDING_MANUAL', 'SKIPPED')),
  feedback text,
  option_feedback text,
  correct_answer jsonb,
  created_at timestamptz not null default now(),
  unique (practice_attempt_id, item_id, round),
  -- Decision B: the answer key is only ever stored (and therefore readable) for the reinforcement round.
  check (round = 2 or correct_answer is null),
  check (not (round = 1 and evaluation_status = 'SKIPPED')),
  check (not (round = 2 and evaluation_status = 'PENDING_MANUAL'))
);
alter table public.practice_item_responses enable row level security;
revoke all on public.practice_item_responses from public, anon, authenticated;
grant select on public.practice_item_responses to authenticated;
create policy practice_item_responses_authorized_select on public.practice_item_responses
  for select to authenticated
  using (exists (
    select 1 from public.practice_attempts attempt
    where attempt.id = practice_item_responses.practice_attempt_id
      and private.can_view_student(attempt.user_id)
  ));

create function private.protect_practice_item_response()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'historical record is immutable' using errcode = '55000';
end $$;
revoke all on function private.protect_practice_item_response() from public, anon, authenticated;
create trigger practice_item_responses_immutable before update or delete on public.practice_item_responses
  for each row execute function private.protect_practice_item_response();

create table public.practice_item_schedules (
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_activity_id uuid not null references public.practice_activities(id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{1,40}$'),
  box smallint not null check (box between 1 and 5),
  due_at timestamptz,
  last_result text not null check (last_result in ('CORRECT', 'INCORRECT')),
  high_confidence_error boolean not null default false,
  last_attempt_id uuid references public.practice_attempts(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, practice_activity_id, item_id)
);
create index practice_item_schedules_due_idx on public.practice_item_schedules (user_id, due_at) where due_at is not null;
alter table public.practice_item_schedules enable row level security;
revoke all on public.practice_item_schedules from public, anon, authenticated;
grant select on public.practice_item_schedules to authenticated;
create policy practice_item_schedules_own_select on public.practice_item_schedules
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.practice_response_media
  add column item_id text check (item_id is null or item_id ~ '^[a-z0-9-]{1,40}$');

-- One review per manual item: the attempt-level uniqueness becomes (attempt, item). Legacy rows have item_id null.
alter table public.practice_manual_reviews
  add column item_id text check (item_id is null or item_id ~ '^[a-z0-9-]{1,40}$');
alter table public.practice_manual_reviews drop constraint practice_manual_reviews_practice_attempt_id_key;
create unique index practice_manual_reviews_attempt_item_key
  on public.practice_manual_reviews (practice_attempt_id, coalesce(item_id, ''));

-- ---------------------------------------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------------------------------------
-- Items of an activity, normalized: v3 = content.items; v2 = one item 'main' (prompt/stimulus/response of the root,
-- key from private.practice_answer_keys); v1 legacy = none. Includes the private key: callable only from definer code.
create function private.practice_items(p_activity uuid)
returns table (item_id text, item_position integer, prompt text, stimulus jsonb, response jsonb, answer_key jsonb, feedback jsonb)
language sql stable security definer set search_path = '' as $$
  select t.i ->> 'id', t.ord::integer, t.i ->> 'prompt', t.i -> 'stimulus', t.i -> 'response',
         k.answer_key, coalesce(k.feedback, '{}'::jsonb)
  from public.practice_activities a
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(a.content -> 'items') = 'array' then a.content -> 'items' else '[]'::jsonb end
  ) with ordinality as t(i, ord)
  left join private.practice_item_keys k on k.practice_activity_id = a.id and k.item_id = t.i ->> 'id'
  where a.id = p_activity and a.content -> 'version' = '3'::jsonb
  union all
  select 'main', 1, a.content ->> 'prompt', a.content -> 'stimulus', a.content -> 'response',
         k.answer_key, coalesce(k.feedback, '{}'::jsonb)
  from public.practice_activities a
  left join private.practice_answer_keys k on k.practice_activity_id = a.id
  where a.id = p_activity and a.content -> 'version' = '2'::jsonb;
$$;
revoke all on function private.practice_items(uuid) from public, anon, authenticated;

-- Spaced-review due date: local (America/Recife) midnight of today plus the box interval {1:1d,2:3d,3:7d,4:14d,5:30d}.
create function private.practice_box_due(p_box integer)
returns timestamptz language sql stable set search_path = '' as $$
  select (date_trunc('day', now() at time zone 'America/Recife')
          + make_interval(days => (array[1, 3, 7, 14, 30])[p_box])) at time zone 'America/Recife';
$$;
revoke all on function private.practice_box_due(integer) from public, anon, authenticated;

-- Objective grading (same rules as submit_practice_attempt v2, factored out; the old function is untouched).
-- Returns {correct, stored}; raises 23514 for a malformed response.
create function private.practice_grade_response(response_def jsonb, answer_key jsonb, input jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  rtype text := response_def ->> 'type';
  v_correct boolean; v_stored jsonb; ids text[]; given text[]; expected text[];
begin
  if jsonb_typeof(input) is distinct from 'object' then
    raise exception 'Practice response must be an object' using errcode = '23514';
  end if;
  if jsonb_typeof(answer_key) is distinct from 'object' then
    raise exception 'Deterministic item has no answer key' using errcode = '23514';
  end if;
  if rtype = 'CHOICE_SINGLE' then
    if (input - 'optionId') <> '{}'::jsonb or jsonb_typeof(input -> 'optionId') is distinct from 'string'
       or not exists (select 1 from jsonb_array_elements(response_def -> 'options') o where o ->> 'id' = input ->> 'optionId') then
      raise exception 'A valid practice option is required' using errcode = '23514';
    end if;
    v_correct := (input ->> 'optionId') = (answer_key ->> 'optionId');
    v_stored := jsonb_build_object('optionId', input ->> 'optionId');
  elsif rtype = 'CHOICE_MULTI' then
    if (input - 'optionIds') <> '{}'::jsonb or jsonb_typeof(input -> 'optionIds') is distinct from 'array'
       or jsonb_array_length(input -> 'optionIds') not between 1 and 6
       or exists (select 1 from jsonb_array_elements(input -> 'optionIds') e
            where jsonb_typeof(e) is distinct from 'string'
               or not exists (select 1 from jsonb_array_elements(response_def -> 'options') o where o ->> 'id' = e #>> '{}'))
       or (select count(distinct e #>> '{}') from jsonb_array_elements(input -> 'optionIds') e) <> jsonb_array_length(input -> 'optionIds') then
      raise exception 'Valid practice options are required' using errcode = '23514';
    end if;
    select array_agg(e #>> '{}' order by e #>> '{}') into given from jsonb_array_elements(input -> 'optionIds') e;
    select array_agg(e #>> '{}' order by e #>> '{}') into expected from jsonb_array_elements(answer_key -> 'optionIds') e;
    v_correct := given = expected;
    v_stored := jsonb_build_object('optionIds', to_jsonb(given));
  elsif rtype = 'TRUE_FALSE' then
    if (input - 'value') <> '{}'::jsonb or jsonb_typeof(input -> 'value') is distinct from 'boolean' then
      raise exception 'A true/false value is required' using errcode = '23514';
    end if;
    v_correct := (input -> 'value') = (answer_key -> 'value');
    v_stored := jsonb_build_object('value', input -> 'value');
  elsif rtype = 'CLOZE' then
    if (input - 'blanks') <> '{}'::jsonb or jsonb_typeof(input -> 'blanks') is distinct from 'object' then
      raise exception 'Cloze blanks are required' using errcode = '23514';
    end if;
    select array_agg(k order by k) into given from jsonb_object_keys(input -> 'blanks') k;
    select array_agg(b ->> 'id' order by b ->> 'id') into expected from jsonb_array_elements(answer_key -> 'blanks') b;
    if given is distinct from expected
       or exists (select 1 from jsonb_each(input -> 'blanks') e
                  where jsonb_typeof(e.value) is distinct from 'string' or char_length(e.value #>> '{}') > 200) then
      raise exception 'Every cloze blank needs a text answer' using errcode = '23514';
    end if;
    v_correct := not exists (
      select 1 from jsonb_array_elements(answer_key -> 'blanks') b
      where not exists (
        select 1 from jsonb_array_elements_text(b -> 'accepted') a
        where private.practice_norm(a, coalesce((b ->> 'caseSensitive')::boolean, false))
            = private.practice_norm(input -> 'blanks' ->> (b ->> 'id'), coalesce((b ->> 'caseSensitive')::boolean, false))));
    v_stored := jsonb_build_object('blanks', input -> 'blanks');
  elsif rtype = 'ORDERING' then
    if (input - 'order') <> '{}'::jsonb or jsonb_typeof(input -> 'order') is distinct from 'array' then
      raise exception 'An item order is required' using errcode = '23514';
    end if;
    select array_agg(i ->> 'id') into ids from jsonb_array_elements(response_def -> 'items') i;
    select array_agg(e #>> '{}' order by ord) into given
      from jsonb_array_elements(input -> 'order') with ordinality t(e, ord)
      where jsonb_typeof(e) = 'string';
    if given is null or cardinality(given) <> jsonb_array_length(input -> 'order')
       or cardinality(given) <> cardinality(ids)
       or exists (select 1 from unnest(given) x where x <> all (ids))
       or (select count(distinct x) from unnest(given) x) <> cardinality(given) then
      raise exception 'The order must contain every item exactly once' using errcode = '23514';
    end if;
    select array_agg(e #>> '{}' order by ord) into expected from jsonb_array_elements(answer_key -> 'order') with ordinality t(e, ord);
    v_correct := given = expected;
    v_stored := jsonb_build_object('order', to_jsonb(given));
  else
    raise exception 'Practice response type is unsupported' using errcode = '23514';
  end if;
  return jsonb_build_object('correct', v_correct, 'stored', v_stored);
end $$;
revoke all on function private.practice_grade_response(jsonb, jsonb, jsonb) from public, anon, authenticated;

-- Wire format of a stored item response (never contains the key outside round 2).
create function private.practice_item_response_json(r public.practice_item_responses)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'itemId', r.item_id, 'round', r.round, 'evaluationStatus', r.evaluation_status,
    'feedback', r.feedback, 'optionFeedback', r.option_feedback, 'correctAnswer', r.correct_answer,
    'canRetry', r.round = 1 and r.evaluation_status = 'INCORRECT' and not exists (
      select 1 from public.practice_item_responses n
      where n.practice_attempt_id = r.practice_attempt_id and n.item_id = r.item_id and n.round = 2));
$$;
revoke all on function private.practice_item_response_json(public.practice_item_responses) from public, anon, authenticated;

create function private.practice_result_json(r public.practice_results)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('score', r.score, 'maxScore', r.max_score, 'evaluationStatus', r.evaluation_status, 'metrics', r.metrics);
$$;
revoke all on function private.practice_result_json(public.practice_results) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Content v3 validation
-- ---------------------------------------------------------------------------------------------------------
-- p_item_keys = { [itemId]: { answerKey, feedback } }. Every item is validated by validate_practice_v2 (stimulus,
-- response, key and ORDERING rules) on a v2-shaped projection, then the v3-only rules are applied.
create function private.validate_practice_v3(p_content jsonb, p_item_keys jsonb, p_skill text, p_activity uuid default null)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  item jsonb; ord integer; ids text[] := array[]::text[]; item_id text; rtype text; manual boolean; any_manual boolean := false;
  k jsonb; fb jsonb; ak jsonb; opt_ids text[];
begin
  if p_skill is null or p_skill not in ('SPEAKING','LISTENING','PRONUNCIATION','VOCABULARY','GRAMMAR','WRITING') then
    raise exception 'Unsupported practice skill' using errcode = '23514';
  end if;
  if jsonb_typeof(p_content) is distinct from 'object' or p_content -> 'version' is distinct from '3'::jsonb then
    raise exception 'Practice content v3 required' using errcode = '23514';
  end if;
  if (p_content - array['version','objective','askConfidence','instructions','evaluationMode','items']) <> '{}'::jsonb then
    raise exception 'Unsupported practice content field' using errcode = '23514';
  end if;
  if jsonb_typeof(p_content -> 'objective') is distinct from 'string' or char_length(btrim(p_content ->> 'objective')) not between 1 and 200 then
    raise exception 'Practice objective required' using errcode = '23514';
  end if;
  if jsonb_typeof(p_content -> 'askConfidence') is distinct from 'boolean' then
    raise exception 'askConfidence must be a boolean' using errcode = '23514';
  end if;
  if p_content ? 'instructions' and (jsonb_typeof(p_content -> 'instructions') is distinct from 'string'
     or char_length(p_content ->> 'instructions') > 600) then
    raise exception 'Invalid practice instructions' using errcode = '23514';
  end if;
  if jsonb_typeof(p_content -> 'items') is distinct from 'array' or jsonb_array_length(p_content -> 'items') not between 1 and 20 then
    raise exception 'A practice has between 1 and 20 items' using errcode = '23514';
  end if;
  if p_item_keys is not null and jsonb_typeof(p_item_keys) is distinct from 'object' then
    raise exception 'Item keys must be an object' using errcode = '23514';
  end if;

  for item, ord in select i, o::integer from jsonb_array_elements(p_content -> 'items') with ordinality as t(i, o) loop
    if jsonb_typeof(item) is distinct from 'object' or (item - array['id','prompt','stimulus','response','planningSeconds']) <> '{}'::jsonb then
      raise exception 'Invalid practice item' using errcode = '23514';
    end if;
    if jsonb_typeof(item -> 'id') is distinct from 'string' or (item ->> 'id') !~ '^[a-z0-9-]{1,40}$' then
      raise exception 'Invalid practice item id' using errcode = '23514';
    end if;
    item_id := item ->> 'id';
    if item_id = any (ids) then
      raise exception 'Duplicate practice item id' using errcode = '23514';
    end if;
    ids := ids || item_id;
    rtype := item #>> '{response,type}';
    manual := rtype in ('WRITTEN', 'SPOKEN');
    any_manual := any_manual or manual;

    if p_skill = 'PRONUNCIATION' and (item #>> '{stimulus,type}' is distinct from 'AUDIO' or rtype is distinct from 'SPOKEN') then
      raise exception 'Pronunciation items require an AUDIO model and a SPOKEN response' using errcode = '23514';
    end if;
    if item ? 'planningSeconds' and (not manual or jsonb_typeof(item -> 'planningSeconds') is distinct from 'number'
       or (item -> 'planningSeconds') <> all (array['0','30','60']::jsonb[])) then
      raise exception 'planningSeconds is 0, 30 or 60 and only for WRITTEN/SPOKEN items' using errcode = '23514';
    end if;

    k := p_item_keys -> item_id;
    if k is not null and k <> 'null'::jsonb and (jsonb_typeof(k) is distinct from 'object' or (k - array['answerKey','feedback']) <> '{}'::jsonb) then
      raise exception 'Invalid item key' using errcode = '23514';
    end if;
    ak := nullif(k -> 'answerKey', 'null'::jsonb);
    -- Stimulus / response / key rules of v2 on a projection (mode follows the response type).
    perform private.validate_practice_v2(
      jsonb_build_object('version', 2, 'stimulus', item -> 'stimulus', 'prompt', item -> 'prompt', 'response', item -> 'response',
        'evaluationMode', case when manual then 'MANUAL_PENDING' else 'DETERMINISTIC' end),
      case when manual then null else ak end, p_skill, p_activity);
    if manual and ak is not null then
      raise exception 'Manual responses have no answer key' using errcode = '23514';
    end if;

    fb := nullif(k -> 'feedback', 'null'::jsonb);
    if fb is not null then
      if jsonb_typeof(fb) is distinct from 'object' or (fb - array['correct','incorrect','options']) <> '{}'::jsonb then
        raise exception 'Invalid item feedback' using errcode = '23514';
      end if;
      if manual and fb <> '{}'::jsonb then
        raise exception 'Manual items have no automatic feedback' using errcode = '23514';
      end if;
      if exists (select 1 from jsonb_each(fb) f where f.key in ('correct','incorrect')
                 and (jsonb_typeof(f.value) is distinct from 'string' or char_length(f.value #>> '{}') not between 1 and 600)) then
        raise exception 'Invalid item feedback text' using errcode = '23514';
      end if;
      if fb ? 'options' then
        if rtype not in ('CHOICE_SINGLE','CHOICE_MULTI') or jsonb_typeof(fb -> 'options') is distinct from 'object' then
          raise exception 'Option feedback is only for choice items' using errcode = '23514';
        end if;
        select array_agg(o ->> 'id') into opt_ids from jsonb_array_elements(item #> '{response,options}') o;
        if exists (select 1 from jsonb_each(fb -> 'options') f
                   where f.key <> all (opt_ids) or jsonb_typeof(f.value) is distinct from 'string'
                      or char_length(f.value #>> '{}') not between 1 and 600) then
          raise exception 'Invalid option feedback' using errcode = '23514';
        end if;
      end if;
    end if;
  end loop;

  if p_item_keys is not null and exists (select 1 from jsonb_object_keys(p_item_keys) x where x <> all (ids)) then
    raise exception 'Item key for an unknown item' using errcode = '23514';
  end if;
  if p_content ->> 'evaluationMode' is distinct from (case when any_manual then 'MANUAL_PENDING' else 'DETERMINISTIC' end) then
    raise exception 'Evaluation mode must match the item types' using errcode = '23514';
  end if;
end $$;
revoke all on function private.validate_practice_v3(jsonb, jsonb, text, uuid) from public, anon, authenticated;

-- Chain the publication validator: v3 is validated here, then the shared title/slug/duration/module/lesson checks run
-- on a legacy-shaped projection (never persisted), exactly as the v2 branch does.
alter function private.validate_content(text, jsonb) rename to validate_content_pre_v3;
create function private.validate_content(p_kind text, p_row jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare keys jsonb; module_course uuid; lesson_course uuid;
begin
  if p_kind = 'practice_activities' and p_row -> 'content' -> 'version' = '3'::jsonb then
    select coalesce(jsonb_object_agg(k.item_id, jsonb_build_object('answerKey', k.answer_key, 'feedback', k.feedback)), '{}'::jsonb)
      into keys from private.practice_item_keys k where k.practice_activity_id = (p_row ->> 'id')::uuid;
    perform private.validate_practice_v3(p_row -> 'content', keys, p_row ->> 'skill', (p_row ->> 'id')::uuid);
    if p_row ->> 'audience' = 'ASSIGNED' then
      if nullif(p_row ->> 'created_by_teacher_id', '') is null or nullif(p_row ->> 'course_id', '') is null then
        raise exception 'Assigned practice requires an owner Teacher and a course' using errcode = '23514';
      end if;
      select m.course_id into module_course from public.modules m where m.id = nullif(p_row ->> 'related_module_id', '')::uuid;
      select m.course_id into lesson_course from public.lessons l join public.modules m on m.id = l.module_id
        where l.id = nullif(p_row ->> 'related_lesson_id', '')::uuid;
      if (p_row ->> 'related_module_id' is not null and module_course is distinct from (p_row ->> 'course_id')::uuid)
         or (p_row ->> 'related_lesson_id' is not null and lesson_course is distinct from (p_row ->> 'course_id')::uuid) then
        raise exception 'Related module or lesson must belong to the practice course' using errcode = '23514';
      end if;
    end if;
    p_row := jsonb_set(jsonb_set(p_row, '{skill}', '"GRAMMAR"'), '{content}',
      jsonb_build_object('kind', 'MANUAL_TEXT', 'evaluationMode', 'MANUAL_PENDING',
        'prompt', left(p_row -> 'content' ->> 'objective', 600), 'instructions', 'v3'));
    perform private.validate_content_pre_authoring(p_kind, p_row);
    return;
  end if;
  perform private.validate_content_pre_v3(p_kind, p_row);
end $$;
revoke all on function private.validate_content_pre_v3(text, jsonb), private.validate_content(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Immutability once attempts exist now covers v3 content and its item keys
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.guard_practice_with_attempts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare act_id uuid;
begin
  if tg_table_name = 'practice_activities' then
    if tg_op = 'UPDATE'
       and (old.created_by_teacher_id is not null or old.content -> 'version' in ('2'::jsonb, '3'::jsonb))
       and row(new.skill,new.content,new.course_id,new.audience,new.related_module_id,new.related_lesson_id,new.created_by_teacher_id)
           is distinct from row(old.skill,old.content,old.course_id,old.audience,old.related_module_id,old.related_lesson_id,old.created_by_teacher_id)
       and exists (select 1 from public.practice_attempts a where a.practice_activity_id = old.id) then
      raise exception 'Practice has attempts: duplicate it to edit' using errcode = '23514';
    end if;
    return new;
  end if;
  act_id := coalesce(old.practice_activity_id, new.practice_activity_id);
  if tg_op = 'UPDATE' and new.answer_key is not distinct from old.answer_key and new.feedback = old.feedback then return new; end if;
  if exists (select 1 from public.practice_activities p
             where p.id = act_id
               and (p.created_by_teacher_id is not null or p.content -> 'version' in ('2'::jsonb, '3'::jsonb))
               and exists (select 1 from public.practice_attempts a where a.practice_activity_id = p.id)) then
    raise exception 'Practice has attempts: duplicate it to edit' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger practice_item_keys_attempts_guard before insert or update or delete on private.practice_item_keys
  for each row execute function private.guard_practice_with_attempts();

-- Stimulus media of v3 items: the Student may sign the asset of a published practice they can view.
create or replace function public.authorize_practice_asset(p_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.practice_activity_assets s
    join public.practice_activities a on a.id = s.practice_activity_id
    where s.id = p_asset and s.upload_status = 'READY'
      and (
        (private.has_role('TEACHER', true) and a.created_by_teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid() and t.active))
        or (a.publication_status = 'PUBLISHED'
            and (a.content #>> '{stimulus,assetId}' = s.id::text
                 or (jsonb_typeof(a.content -> 'items') = 'array' and exists (
                       select 1 from jsonb_array_elements(a.content -> 'items') i where i #>> '{stimulus,assetId}' = s.id::text)))
            and (private.has_role('ADMIN', true) or (private.has_role('STUDENT', false) and private.can_view_practice_activity(a.id))))));
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Legacy entry points refuse v3 (they have no per-item model)
-- ---------------------------------------------------------------------------------------------------------
alter function public.submit_practice_attempt(uuid, jsonb) rename to submit_practice_attempt_pre_v3;
revoke all on function public.submit_practice_attempt_pre_v3(uuid, jsonb) from public, anon, authenticated;
create function public.submit_practice_attempt(p_practice_attempt_id uuid, p_response jsonb)
returns public.practice_results language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.practice_attempts a join public.practice_activities p on p.id = a.practice_activity_id
             where a.id = p_practice_attempt_id and a.user_id = auth.uid() and p.content -> 'version' = '3'::jsonb) then
    raise exception 'Practice v3 uses per-item submission' using errcode = '23514';
  end if;
  return public.submit_practice_attempt_pre_v3(p_practice_attempt_id, p_response);
end $$;

alter function public.finalize_practice_review(uuid, jsonb, text, text) rename to finalize_practice_review_pre_v3;
revoke all on function public.finalize_practice_review_pre_v3(uuid, jsonb, text, text) from public, anon, authenticated;
create function public.finalize_practice_review(p_attempt uuid, p_ratings jsonb, p_feedback text, p_rubric_version text default 'v1')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.practice_attempts a join public.practice_activities p on p.id = a.practice_activity_id
             where a.id = p_attempt and p.content -> 'version' = '3'::jsonb) then
    raise exception 'Practice v3 reviews are per item' using errcode = '23514';
  end if;
  return public.finalize_practice_review_pre_v3(p_attempt, p_ratings, p_feedback, p_rubric_version);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Student RPCs
-- ---------------------------------------------------------------------------------------------------------
create function public.submit_practice_item(p_attempt uuid, p_item_id text, p_round smallint, p_response jsonb,
  p_confidence text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.practice_attempts; v_activity public.practice_activities; v_item record;
  v_stored_row public.practice_item_responses; v_r1 public.practice_item_responses;
  v_rtype text; v_objective boolean; v_conf text; v_graded jsonb; v_correct boolean;
  v_status text; v_stored jsonb; v_feedback text; v_option text; v_answer jsonb; v_txt text; v_media public.practice_response_media;
begin
  if v_uid is null or not private.has_role('STUDENT', false) then
    raise exception 'Own Student attempt required' using errcode = '42501';
  end if;
  select * into v_attempt from public.practice_attempts where id = p_attempt and user_id = v_uid for update;
  if v_attempt.id is null then
    raise exception 'Own Student attempt required' using errcode = '42501';
  end if;
  if not private.has_paid_access(v_uid) then
    raise exception 'active subscription required' using errcode = '42501';
  end if;
  select * into v_activity from public.practice_activities where id = v_attempt.practice_activity_id;
  select pi.* into v_item from private.practice_items(v_activity.id) pi
    where pi.item_id = p_item_id and (v_attempt.item_ids is null or p_item_id = any (v_attempt.item_ids));
  if not found then
    raise exception 'Item does not belong to the attempt' using errcode = '23514';
  end if;
  if p_round is null or p_round not in (1, 2) then
    raise exception 'Round must be 1 or 2' using errcode = '23514';
  end if;
  if p_confidence is not null and p_confidence not in ('LOW', 'HIGH') then
    raise exception 'Confidence must be LOW or HIGH' using errcode = '23514';
  end if;

  -- Idempotent replay: the stored row wins.
  select * into v_stored_row from public.practice_item_responses
    where practice_attempt_id = v_attempt.id and item_id = p_item_id and round = p_round;
  if v_stored_row.id is not null then
    return private.practice_item_response_json(v_stored_row);
  end if;

  if v_attempt.status <> 'IN_PROGRESS' then
    raise exception 'Practice attempt is not in progress' using errcode = '23514';
  end if;
  if not v_activity.active or not private.content_visible('practice_activities', v_activity.id)
     or (v_activity.audience = 'ASSIGNED' and not private.can_view_practice_activity(v_activity.id)) then
    raise exception 'Practice activity is unavailable' using errcode = '42501';
  end if;
  if jsonb_typeof(p_response) is distinct from 'object' then
    raise exception 'Practice response must be an object' using errcode = '23514';
  end if;

  v_rtype := v_item.response ->> 'type';
  v_objective := v_rtype in ('CHOICE_SINGLE', 'CHOICE_MULTI', 'TRUE_FALSE', 'CLOZE', 'ORDERING');
  -- Confidence is only recorded for objective items of activities that ask for it, in the first round.
  v_conf := case when v_objective and p_round = 1 and coalesce((v_activity.content ->> 'askConfidence')::boolean, false)
                 then p_confidence end;

  if p_round = 2 then
    select * into v_r1 from public.practice_item_responses
      where practice_attempt_id = v_attempt.id and item_id = p_item_id and round = 1;
    if v_r1.id is null or v_r1.evaluation_status <> 'INCORRECT' or not v_objective then
      raise exception 'The reinforcement round needs a missed objective item' using errcode = '23514';
    end if;
  end if;

  if v_objective then
    if p_response ? 'skip' then
      if p_response <> '{"skip": true}'::jsonb or p_round <> 2 then
        raise exception 'Skipping is only available in the reinforcement round' using errcode = '23514';
      end if;
      v_status := 'SKIPPED';
      v_stored := p_response;
      v_feedback := coalesce(v_item.feedback ->> 'incorrect', 'Resposta não respondida.');
    else
      v_graded := private.practice_grade_response(v_item.response, v_item.answer_key, p_response);
      v_correct := (v_graded ->> 'correct')::boolean;
      v_stored := v_graded -> 'stored';
      v_status := case when v_correct then 'CORRECT' else 'INCORRECT' end;
      v_feedback := case when v_correct then coalesce(v_item.feedback ->> 'correct', 'Resposta correta.')
                         else coalesce(v_item.feedback ->> 'incorrect', 'Resposta incorreta.') end;
      if v_rtype = 'CHOICE_SINGLE' then
        v_option := v_item.feedback -> 'options' ->> (v_stored ->> 'optionId');
      elsif v_rtype = 'CHOICE_MULTI' then
        select nullif(string_agg(v_item.feedback -> 'options' ->> (o ->> 'id'), ' ' order by ord), '') into v_option
          from jsonb_array_elements(v_item.response -> 'options') with ordinality t(o, ord)
          where (v_stored -> 'optionIds') ? (o ->> 'id');
      end if;
    end if;
    v_answer := case when p_round = 2 then v_item.answer_key end;
  else
    if p_round <> 1 then
      raise exception 'Manual items have a single round' using errcode = '23514';
    end if;
    if v_rtype = 'WRITTEN' then
      v_txt := nullif(btrim(p_response ->> 'text'), '');
      if (p_response - 'text') <> '{}'::jsonb or jsonb_typeof(p_response -> 'text') is distinct from 'string'
         or v_txt is null or char_length(v_txt) > 2000 then
        raise exception 'Written response must contain 1 to 2000 characters' using errcode = '23514';
      end if;
      v_stored := jsonb_build_object('text', v_txt);
    elsif v_rtype = 'SPOKEN' then
      if (p_response - 'mediaId') <> '{}'::jsonb or jsonb_typeof(p_response -> 'mediaId') is distinct from 'string'
         or p_response ->> 'mediaId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid audio response' using errcode = '23514';
      end if;
      select * into v_media from public.practice_response_media
        where id = (p_response ->> 'mediaId')::uuid and practice_attempt_id = v_attempt.id for update;
      if v_media.id is null or v_media.upload_status <> 'READY' or v_media.item_id is distinct from p_item_id then
        raise exception 'Validated media required' using errcode = '23514';
      end if;
      v_stored := jsonb_build_object('mediaId', v_media.id);
      update public.practice_response_media set upload_status = 'SUBMITTED', updated_at = now() where id = v_media.id;
    else
      raise exception 'Practice response type is unsupported' using errcode = '23514';
    end if;
    v_status := 'PENDING_MANUAL';
    v_feedback := 'Aguardando revisão do professor.';
  end if;

  insert into public.practice_item_responses(practice_attempt_id, item_id, round, response, confidence, evaluation_status,
    feedback, option_feedback, correct_answer)
  values (v_attempt.id, p_item_id, p_round, v_stored, v_conf, v_status, v_feedback, v_option, v_answer)
  returning * into v_stored_row;
  update public.practice_attempts set last_activity_at = now() where id = v_attempt.id;
  return private.practice_item_response_json(v_stored_row);
end $$;

create function public.finalize_practice_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.practice_attempts; v_result public.practice_results;
  v_total integer; v_objective integer; v_first integer; v_recovered integer; v_missed integer; v_skipped integer;
  v_high integer; v_manual integer; v_missing integer; v_status text; v_score numeric; v_max numeric; v_metrics jsonb;
begin
  if v_uid is null or not private.has_role('STUDENT', false) then
    raise exception 'Own Student attempt required' using errcode = '42501';
  end if;
  select * into v_attempt from public.practice_attempts where id = p_attempt and user_id = v_uid for update;
  if v_attempt.id is null then
    raise exception 'Own Student attempt required' using errcode = '42501';
  end if;
  if not private.has_paid_access(v_uid) then
    raise exception 'active subscription required' using errcode = '42501';
  end if;
  if v_attempt.status = 'SUBMITTED' then
    select * into v_result from public.practice_results where practice_attempt_id = v_attempt.id;
    if v_result.id is null then
      raise exception 'Practice attempt has no result' using errcode = '23514';
    end if;
    return private.practice_result_json(v_result);
  end if;
  if v_attempt.status <> 'IN_PROGRESS' then
    raise exception 'Practice attempt cannot be finalized' using errcode = '23514';
  end if;

  select count(*),
         count(*) filter (where o),
         count(*) filter (where o and r1.evaluation_status = 'CORRECT'),
         count(*) filter (where o and r1.evaluation_status = 'INCORRECT' and r2.evaluation_status = 'CORRECT'),
         count(*) filter (where o and r1.evaluation_status = 'INCORRECT' and r2.evaluation_status = 'SKIPPED'),
         count(*) filter (where o and r1.evaluation_status = 'INCORRECT' and coalesce(r2.evaluation_status, 'INCORRECT') = 'INCORRECT'),
         count(*) filter (where o and r1.evaluation_status = 'INCORRECT' and r1.confidence = 'HIGH'),
         count(*) filter (where not o),
         count(*) filter (where r1.id is null)
    into v_total, v_objective, v_first, v_recovered, v_skipped, v_missed, v_high, v_manual, v_missing
  from (
    select pi.item_id, pi.response ->> 'type' in ('CHOICE_SINGLE', 'CHOICE_MULTI', 'TRUE_FALSE', 'CLOZE', 'ORDERING') as o
    from private.practice_items(v_attempt.practice_activity_id) pi
    where v_attempt.item_ids is null or pi.item_id = any (v_attempt.item_ids)
  ) it
  left join public.practice_item_responses r1
    on r1.practice_attempt_id = v_attempt.id and r1.item_id = it.item_id and r1.round = 1
  left join public.practice_item_responses r2
    on r2.practice_attempt_id = v_attempt.id and r2.item_id = it.item_id and r2.round = 2;

  if v_total = 0 then
    raise exception 'Practice attempt has no items' using errcode = '23514';
  end if;
  if v_missing > 0 then
    raise exception 'Every item needs a first answer' using errcode = '23514';
  end if;

  v_score := case when v_objective > 0 then v_first end;
  v_max := case when v_objective > 0 then v_objective end;
  v_status := case when v_manual > 0 then 'PENDING_MANUAL' when v_first = v_objective then 'CORRECT' else 'INCORRECT' end;
  v_metrics := jsonb_build_object('itemCount', v_total, 'firstTryCorrect', v_first, 'recovered', v_recovered, 'missed', v_missed,
    'skipped', v_skipped, 'highConfidenceErrors', v_high, 'pendingManual', v_manual);

  insert into public.practice_results(practice_attempt_id, score, max_score, feedback, metrics, evaluation_status)
  values (v_attempt.id, v_score, v_max,
    case when v_manual > 0 then 'Aguardando revisão do professor.'
         else v_first || ' de ' || v_objective || ' na 1ª tentativa.' end,
    v_metrics, v_status)
  returning * into v_result;

  update public.practice_attempts set status = 'SUBMITTED', submitted_at = now(), last_activity_at = now() where id = v_attempt.id;

  -- Spaced review (contract section 5): objective items only; a race with another attempt of the same Student is
  -- resolved on the schedule row itself (ON CONFLICT reads the stored box).
  insert into public.practice_item_schedules as s(user_id, practice_activity_id, item_id, box, due_at, last_result,
    high_confidence_error, last_attempt_id, updated_at)
  select v_attempt.user_id, v_attempt.practice_activity_id, r1.item_id,
         case when r1.evaluation_status = 'CORRECT' then 2 else 1 end,
         private.practice_box_due(case when r1.evaluation_status = 'CORRECT' then 2 else 1 end),
         r1.evaluation_status,
         coalesce(r1.evaluation_status = 'INCORRECT' and r1.confidence = 'HIGH', false),
         v_attempt.id, now()
  from public.practice_item_responses r1
  join private.practice_items(v_attempt.practice_activity_id) pi on pi.item_id = r1.item_id
  where r1.practice_attempt_id = v_attempt.id and r1.round = 1
    and r1.evaluation_status in ('CORRECT', 'INCORRECT')
    and pi.response ->> 'type' in ('CHOICE_SINGLE', 'CHOICE_MULTI', 'TRUE_FALSE', 'CLOZE', 'ORDERING')
  on conflict (user_id, practice_activity_id, item_id) do update set
    box = case when excluded.last_result = 'CORRECT' then least(s.box + 1, 5) else 1 end,
    due_at = case when excluded.last_result <> 'CORRECT' then private.practice_box_due(1)
                  when s.box = 5 then null
                  else private.practice_box_due(least(s.box + 1, 5)) end,
    last_result = excluded.last_result,
    high_confidence_error = excluded.high_confidence_error,
    last_attempt_id = excluded.last_attempt_id,
    updated_at = now();

  return private.practice_result_json(v_result);
end $$;

-- FULL start stays public.start_practice_attempt. REVIEW = the caller's due items of one activity.
create function public.start_practice_review(p_practice_activity_id uuid, p_idempotency_key uuid)
returns public.practice_attempts language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_mode text; v_row public.practice_attempts; v_open public.practice_attempts; v_blocking uuid; v_due text[];
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'Practice idempotency key is required';
  end if;

  select a.content ->> 'evaluationMode' into v_mode
  from public.practice_activities a
  where a.id = p_practice_activity_id and a.active and private.content_visible('practice_activities', a.id);
  if v_mode is null or v_mode not in ('DETERMINISTIC', 'MANUAL_PENDING') then
    raise exception 'Practice activity is unsupported';
  end if;
  if not private.can_view_practice_activity(p_practice_activity_id) then
    raise exception 'Practice activity is unavailable' using errcode = '42501';
  end if;
  if not private.has_paid_access(v_uid) then
    raise exception 'active subscription required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('practice-review:' || v_uid::text || ':' || p_practice_activity_id::text, 0));

  select * into v_row from public.practice_attempts a where a.user_id = v_uid and a.idempotency_key = p_idempotency_key;
  if v_row.id is not null then
    if v_row.practice_activity_id <> p_practice_activity_id or v_row.attempt_kind <> 'REVIEW' then
      raise exception 'Idempotency key already belongs to another attempt';
    end if;
    return v_row;
  end if;

  if not private.practice_lesson_reached(v_uid, p_practice_activity_id) then
    select a.related_lesson_id into v_blocking from public.practice_activities a where a.id = p_practice_activity_id;
    raise exception 'Practice lesson not reached'
      using errcode = 'YP001', hint = 'PRACTICE_LESSON_NOT_REACHED', detail = coalesce(v_blocking::text, '');
  end if;

  -- Resume rule C for the REVIEW kind.
  select * into v_open from public.practice_attempts a
  where a.user_id = v_uid and a.practice_activity_id = p_practice_activity_id
    and a.attempt_kind = 'REVIEW' and a.status = 'IN_PROGRESS'
  order by a.started_at desc, a.id desc limit 1 for update;
  if v_open.id is not null and v_open.last_activity_at >= now() - interval '24 hours' then
    update public.practice_attempts set last_activity_at = now() where id = v_open.id returning * into v_row;
    return v_row;
  end if;

  v_due := array(
    select s.item_id from public.practice_item_schedules s
    join private.practice_items(p_practice_activity_id) pi on pi.item_id = s.item_id
    where s.user_id = v_uid and s.practice_activity_id = p_practice_activity_id
      and s.due_at is not null and s.due_at <= now()
    order by s.high_confidence_error desc, s.due_at, s.item_id);
  if cardinality(v_due) = 0 then
    raise exception 'Nothing is due for review' using errcode = 'YP002', hint = 'PRACTICE_NOTHING_DUE';
  end if;

  update public.practice_attempts set status = 'ABANDONED'
  where user_id = v_uid and practice_activity_id = p_practice_activity_id
    and attempt_kind = 'REVIEW' and status = 'IN_PROGRESS';

  begin
    insert into public.practice_attempts(user_id, practice_activity_id, idempotency_key, context, last_activity_at, attempt_kind, item_ids)
    values (v_uid, p_practice_activity_id, p_idempotency_key,
      jsonb_build_object('evaluation_mode', v_mode, 'review', true), now(), 'REVIEW', v_due)
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.practice_attempts a where a.user_id = v_uid and a.idempotency_key = p_idempotency_key;
    if v_row.id is null then
      select * into v_row from public.practice_attempts a
      where a.user_id = v_uid and a.practice_activity_id = p_practice_activity_id
        and a.attempt_kind = 'REVIEW' and a.status = 'IN_PROGRESS'
      order by a.started_at desc, a.id desc limit 1;
    end if;
    if v_row.id is null then
      raise;
    end if;
    if v_row.practice_activity_id <> p_practice_activity_id or v_row.attempt_kind <> 'REVIEW' then
      raise exception 'Idempotency key already belongs to another attempt';
    end if;
  end;
  return v_row;
end $$;

create function public.student_due_reviews()
returns table (practice_activity_id uuid, due_count integer, high_confidence_errors integer, oldest_due_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  return query
  select s.practice_activity_id, count(*)::integer,
         (count(*) filter (where s.high_confidence_error))::integer, min(s.due_at)
  from public.practice_item_schedules s
  join public.practice_activities a on a.id = s.practice_activity_id and a.active
  where s.user_id = v_uid and s.due_at is not null and s.due_at <= now()
    and exists (select 1 from private.practice_items(a.id) pi where pi.item_id = s.item_id)
    and private.can_view_practice_activity(a.id)
    and private.practice_lesson_reached(v_uid, a.id)
  group by s.practice_activity_id
  order by (count(*) filter (where s.high_confidence_error)) desc, min(s.due_at), s.practice_activity_id;
end $$;

-- SPOKEN item audio: same private upload, media bound to the item.
create function public.reserve_practice_audio(p_attempt uuid, p_mime text, p_item_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_attempt public.practice_attempts; v_item record; v_target uuid := gen_random_uuid();
begin
  if v_uid is null or not private.has_role('STUDENT', false) then
    raise exception 'Student required' using errcode = '42501';
  end if;
  select * into v_attempt from public.practice_attempts
    where id = p_attempt and user_id = v_uid and status = 'IN_PROGRESS' for update;
  if v_attempt.id is null then
    raise exception 'Own audio attempt required' using errcode = '42501';
  end if;
  if not private.has_paid_access(v_uid) then
    raise exception 'active subscription required' using errcode = '42501';
  end if;
  select pi.* into v_item from private.practice_items(v_attempt.practice_activity_id) pi
    where pi.item_id = p_item_id and (v_attempt.item_ids is null or p_item_id = any (v_attempt.item_ids));
  if not found or v_item.response ->> 'type' is distinct from 'SPOKEN' then
    raise exception 'Own audio attempt required' using errcode = '42501';
  end if;
  insert into public.practice_response_media(id, practice_attempt_id, storage_path, mime_type, item_id)
  values (v_target, p_attempt, p_attempt || '/' || v_target, p_mime, p_item_id);
  return v_target;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Teacher RPCs
-- ---------------------------------------------------------------------------------------------------------
create function public.teacher_practice_save_v3(p_id uuid, p_payload jsonb, p_item_keys jsonb, p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  teacher uuid := private.current_teacher_id();
  row_id uuid := coalesce(p_id, gen_random_uuid());
  allowed text[] := array['title','skill','cefr_target','difficulty','estimated_minutes','course_id','related_module_id','related_lesson_id','content'];
  act public.practice_activities; eff jsonb; k text; v_keys jsonb; v_content jsonb; v_items jsonb; v_manual boolean;
  v_title text; v_skill text; v_minutes integer; v_course uuid; v_module uuid; v_lesson uuid; v_cefr text; v_diff text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Object required' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_payload) loop
    if not (k = any (allowed)) then raise exception 'Unsupported practice field' using errcode = '22023'; end if;
  end loop;
  if length(p_payload::text) > 120000 or length(coalesce(p_item_keys::text, '')) > 80000 then
    raise exception 'Payload too large' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || row_id::text, 0));
  if p_id is not null then
    select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
    if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
    if act.publication_status <> 'DRAFT' then raise exception 'Unpublish before editing content' using errcode = '23514'; end if;
    if private.practice_has_attempts(act.id) then raise exception 'Practice has attempts: duplicate it to edit' using errcode = '23514'; end if;
  end if;
  eff := (case when p_id is null then '{}'::jsonb else to_jsonb(act) end) || p_payload;

  v_title := btrim(eff ->> 'title');
  if jsonb_typeof(eff -> 'title') is distinct from 'string' or char_length(v_title) not between 1 and 160 then
    raise exception 'Title required' using errcode = '23514';
  end if;
  v_skill := eff ->> 'skill';
  if v_skill is null or v_skill not in ('SPEAKING','LISTENING','PRONUNCIATION','VOCABULARY','GRAMMAR','WRITING') then
    raise exception 'Unsupported practice skill' using errcode = '23514';
  end if;
  if jsonb_typeof(eff -> 'estimated_minutes') is distinct from 'number' or (eff ->> 'estimated_minutes') !~ '^[0-9]{1,3}$'
     or (eff ->> 'estimated_minutes')::integer not between 1 and 240 then
    raise exception 'Estimated minutes must be between 1 and 240' using errcode = '23514';
  end if;
  v_minutes := (eff ->> 'estimated_minutes')::integer;
  v_cefr := nullif(eff ->> 'cefr_target', '');
  if v_cefr is not null and v_cefr not in ('A1','A2','B1','B2','C1','C2') then raise exception 'Invalid CEFR target' using errcode = '23514'; end if;
  v_diff := nullif(eff ->> 'difficulty', '');
  if v_diff is not null and char_length(v_diff) > 40 then raise exception 'Invalid difficulty' using errcode = '23514'; end if;

  if jsonb_typeof(eff -> 'course_id') is distinct from 'string' then raise exception 'Course required' using errcode = '23514'; end if;
  v_course := (eff ->> 'course_id')::uuid;
  if not private.is_teacher_for_course(v_course) then raise exception 'Course scope required' using errcode = '42501'; end if;
  if p_id is not null and v_course is distinct from act.course_id
     and exists (select 1 from public.cohort_practice_assignments pa where pa.practice_activity_id = act.id) then
    raise exception 'Cannot change the course of an assigned practice' using errcode = '23514';
  end if;
  v_module := nullif(eff ->> 'related_module_id', '')::uuid;
  v_lesson := nullif(eff ->> 'related_lesson_id', '')::uuid;
  if v_module is not null and not exists (select 1 from public.modules m where m.id = v_module and m.course_id = v_course) then
    raise exception 'Related module must belong to the practice course' using errcode = '23514';
  end if;
  if v_lesson is not null and not exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id
      where l.id = v_lesson and m.course_id = v_course and (v_module is null or m.id = v_module)) then
    raise exception 'Related lesson must belong to the practice course' using errcode = '23514';
  end if;

  v_content := eff -> 'content';
  if jsonb_typeof(v_content) is distinct from 'object' or jsonb_typeof(v_content -> 'items') is distinct from 'array' then
    raise exception 'Practice content with items is required' using errcode = '23514';
  end if;
  -- Item keys: the stored ones are reused when the Teacher edits metadata only.
  v_keys := p_item_keys;
  if v_keys is null then
    select jsonb_object_agg(ik.item_id, jsonb_build_object('answerKey', ik.answer_key, 'feedback', ik.feedback)) into v_keys
      from private.practice_item_keys ik where ik.practice_activity_id = row_id;
  end if;
  if jsonb_typeof(v_keys) is distinct from 'object' then raise exception 'Item keys required' using errcode = '23514'; end if;

  v_manual := exists (select 1 from jsonb_array_elements(v_content -> 'items') i where i #>> '{response,type}' in ('WRITTEN','SPOKEN'));
  v_content := jsonb_set(jsonb_set(v_content - 'evaluationMode', '{evaluationMode}',
    case when v_manual then '"MANUAL_PENDING"'::jsonb else '"DETERMINISTIC"'::jsonb end), '{version}', '3'::jsonb);
  -- ORDERING: the stored order must never equal the key order.
  select jsonb_agg(
           case when i #>> '{response,type}' = 'ORDERING' and jsonb_typeof(v_keys -> (i ->> 'id') -> 'answerKey') = 'object'
                then jsonb_set(i, '{response}', private.practice_normalize_content(
                       jsonb_build_object('response', i -> 'response'), v_keys -> (i ->> 'id') -> 'answerKey', row_id) -> 'response')
                else i end order by ord)
    into v_items from jsonb_array_elements(v_content -> 'items') with ordinality t(i, ord);
  v_content := jsonb_set(v_content, '{items}', coalesce(v_items, '[]'::jsonb));

  -- Content, keys and feedback must be coherent now (assets are checked at publication). A draft may still
  -- lack its objective: it is required when the Teacher publishes (private.validate_content).
  perform private.validate_practice_v3(
    case when coalesce(btrim(v_content ->> 'objective'), '') = ''
         then jsonb_set(v_content, '{objective}', '"draft"'::jsonb) else v_content end,
    v_keys, v_skill, null);

  if p_id is null then
    insert into public.practice_activities(id, slug, title, skill, cefr_target, difficulty, estimated_minutes, related_module_id,
      related_lesson_id, content, active, created_by_teacher_id, course_id, audience)
    values (row_id, 't-' || replace(row_id::text, '-', ''), v_title, v_skill, v_cefr, v_diff, v_minutes, v_module,
      v_lesson, v_content, true, teacher, v_course, 'ASSIGNED');
  else
    update public.practice_activities set title = v_title, skill = v_skill, cefr_target = v_cefr, difficulty = v_diff,
      estimated_minutes = v_minutes, related_module_id = v_module, related_lesson_id = v_lesson, content = v_content,
      course_id = v_course, updated_at = now()
    where id = row_id;
    -- A v2 draft converted to v3 drops its single-question key.
    delete from private.practice_answer_keys where practice_activity_id = row_id;
  end if;

  delete from private.practice_item_keys ik
    where ik.practice_activity_id = row_id
      and ik.item_id <> all (array(select i ->> 'id' from jsonb_array_elements(v_content -> 'items') i));
  insert into private.practice_item_keys(practice_activity_id, item_id, answer_key, feedback)
  select row_id, i ->> 'id',
         case when i #>> '{response,type}' in ('WRITTEN','SPOKEN') then null else nullif(v_keys -> (i ->> 'id') -> 'answerKey', 'null'::jsonb) end,
         coalesce(nullif(v_keys -> (i ->> 'id') -> 'feedback', 'null'::jsonb), '{}'::jsonb)
  from jsonb_array_elements(v_content -> 'items') i
  on conflict (practice_activity_id, item_id) do update set answer_key = excluded.answer_key, feedback = excluded.feedback;

  perform private.practice_audit(case when p_id is null then 'teacher_practice_created' else 'teacher_practice_updated' end,
    row_id, jsonb_build_object('version', 3, 'item_count', jsonb_array_length(v_content -> 'items'), 'course_id', v_course, 'skill', v_skill),
    p_context);
  return row_id;
end $$;

-- One review per manual item (WRITTEN/SPOKEN). The result closes (MANUAL_REVIEWED) when its last pending item is reviewed;
-- the objective score is kept.
create function public.finalize_practice_review(p_attempt uuid, p_ratings jsonb, p_feedback text, p_rubric_version text, p_item_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  teacher uuid := private.current_teacher_id();
  v_attempt public.practice_attempts; v_activity public.practice_activities; v_existing public.practice_manual_reviews;
  v_item record; v_target uuid; v_dimensions text[];
begin
  if p_item_id is null then
    raise exception 'Item required' using errcode = '23514';
  end if;
  select * into v_attempt from public.practice_attempts where id = p_attempt for update;
  if v_attempt.id is null or not private.is_teacher_assigned(v_attempt.user_id) or v_attempt.status <> 'SUBMITTED' then
    raise exception 'Review unavailable' using errcode = '42501';
  end if;
  select * into v_existing from public.practice_manual_reviews where practice_attempt_id = p_attempt and item_id = p_item_id;
  if v_existing.id is not null then
    if v_existing.teacher_id = teacher and v_existing.ratings = p_ratings and v_existing.feedback = trim(p_feedback)
       and v_existing.rubric_version = p_rubric_version then
      return v_existing.id;
    end if;
    raise exception 'Review already finalized' using errcode = '23505';
  end if;
  select * into v_activity from public.practice_activities where id = v_attempt.practice_activity_id;
  select pi.* into v_item from private.practice_items(v_activity.id) pi
    where pi.item_id = p_item_id and (v_attempt.item_ids is null or p_item_id = any (v_attempt.item_ids));
  if not found or v_item.response ->> 'type' not in ('WRITTEN', 'SPOKEN') or not exists (
       select 1 from public.practice_item_responses ir
       where ir.practice_attempt_id = p_attempt and ir.item_id = p_item_id and ir.round = 1 and ir.evaluation_status = 'PENDING_MANUAL') then
    raise exception 'Pending manual review required' using errcode = '23514';
  end if;
  v_dimensions := case
    when v_item.response ->> 'type' = 'WRITTEN' then array['task_completion','comprehensibility','language_accuracy','vocabulary_use']
    when v_activity.skill = 'PRONUNCIATION' then array['intelligibility','target_sounds','word_stress','sentence_stress_rhythm']
    else array['task_completion','comprehensibility','fluency','language_accuracy','vocabulary_use','pronunciation_intelligibility'] end;
  if p_rubric_version is distinct from 'v1' or jsonb_typeof(p_ratings) is distinct from 'object' or (p_ratings - v_dimensions) <> '{}'::jsonb
     or exists (select 1 from unnest(v_dimensions) d where not p_ratings ? d or coalesce(p_ratings ->> d, '') not in ('NEEDS_WORK','DEVELOPING','SOLID','STRONG')) then
    raise exception 'Invalid rubric' using errcode = '23514';
  end if;
  insert into public.practice_manual_reviews(practice_attempt_id, teacher_id, rubric_version, ratings, feedback, item_id)
    values (p_attempt, teacher, 'v1', p_ratings, trim(p_feedback), p_item_id) returning id into v_target;
  if not exists (
       select 1 from public.practice_item_responses ir
       where ir.practice_attempt_id = p_attempt and ir.round = 1 and ir.evaluation_status = 'PENDING_MANUAL'
         and not exists (select 1 from public.practice_manual_reviews mr where mr.practice_attempt_id = p_attempt and mr.item_id = ir.item_id)) then
    update public.practice_results set evaluation_status = 'MANUAL_REVIEWED'
      where practice_attempt_id = p_attempt and evaluation_status = 'PENDING_MANUAL';
    insert into public.notifications(user_id, notification_type, title, body, data, event_key)
      values (v_attempt.user_id, 'PRACTICE_FEEDBACK_READY', 'Feedback disponível', 'Confira sua prática.',
        jsonb_build_object('practice_attempt_id', p_attempt), p_attempt || ':PRACTICE_FEEDBACK_READY') on conflict do nothing;
  end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'PRACTICE_MANUAL_REVIEW', 'practice_manual_reviews', v_target,
      jsonb_build_object('practice_attempt_id', p_attempt, 'item_id', p_item_id, 'rubric_version', 'v1'));
  return v_target;
end $$;

-- Review queue: legacy/v2 rows as before, plus one row per pending (or, for one attempt, any) v3 manual item.
create or replace function public.get_teacher_reviews(p_attempt uuid default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.current_teacher_id();
  return query
  select jsonb_build_object('id', a.id, 'studentId', a.user_id, 'studentName', p.display_name,
    'title', activity.title, 'skill', activity.skill, 'prompt', activity.content->>'prompt',
    'responseType', coalesce(activity.content #>> '{response,type}', activity.content->>'kind'),
    'response', response.response, 'submittedAt', a.submitted_at, 'status', result.evaluation_status)
  from public.practice_attempts a
  join public.practice_activities activity on activity.id = a.practice_activity_id
  join public.profiles p on p.user_id = a.user_id
  join public.practice_responses response on response.practice_attempt_id = a.id
  join public.practice_results result on result.practice_attempt_id = a.id
  where private.is_teacher_assigned(a.user_id)
    and (activity.skill in ('SPEAKING','PRONUNCIATION')
         or (activity.content->'version' = '2'::jsonb and activity.content #>> '{response,type}' in ('WRITTEN','SPOKEN')))
    and (case when p_attempt is null then result.evaluation_status = 'PENDING_MANUAL'
      else a.id = p_attempt and result.evaluation_status in ('PENDING_MANUAL','MANUAL_REVIEWED') end)
  order by a.submitted_at, a.id
  limit case when p_attempt is null then 100 else 1 end;

  return query
  select jsonb_build_object('id', a.id, 'itemId', ir.item_id, 'studentId', a.user_id, 'studentName', p.display_name,
    'title', activity.title, 'skill', activity.skill, 'prompt', it.prompt, 'responseType', it.response ->> 'type',
    'response', ir.response, 'submittedAt', a.submitted_at,
    'status', case when mr.id is null then 'PENDING_MANUAL' else 'MANUAL_REVIEWED' end)
  from public.practice_attempts a
  join public.practice_activities activity on activity.id = a.practice_activity_id and activity.content -> 'version' = '3'::jsonb
  join public.profiles p on p.user_id = a.user_id
  join public.practice_item_responses ir on ir.practice_attempt_id = a.id and ir.round = 1 and ir.evaluation_status = 'PENDING_MANUAL'
  cross join lateral (select x.prompt, x.response, x.item_position from private.practice_items(a.practice_activity_id) x
                      where x.item_id = ir.item_id) it
  left join public.practice_manual_reviews mr on mr.practice_attempt_id = a.id and mr.item_id = ir.item_id
  where a.status = 'SUBMITTED' and private.is_teacher_assigned(a.user_id)
    and (case when p_attempt is null then mr.id is null else a.id = p_attempt end)
  order by a.submitted_at, a.id, it.item_position
  limit case when p_attempt is null then 100 else 20 end;
end $$;

-- Authoring reads: v3 adds the item keys (answer key + feedback per item) and an item count; v2 output is unchanged.
create or replace function public.teacher_practice_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; k private.practice_answer_keys;
begin
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED';
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  select * into k from private.practice_answer_keys where practice_activity_id = act.id;
  return jsonb_build_object('id', act.id, 'title', act.title, 'skill', act.skill, 'cefrTarget', act.cefr_target,
    'difficulty', act.difficulty, 'estimatedMinutes', act.estimated_minutes, 'courseId', act.course_id,
    'relatedModuleId', act.related_module_id, 'relatedLessonId', act.related_lesson_id, 'content', act.content,
    'answerKey', coalesce(k.answer_key, '{}'::jsonb), 'feedback', coalesce(k.feedback, '{}'::jsonb),
    'itemKeys', coalesce((select jsonb_object_agg(ik.item_id, jsonb_build_object('answerKey', ik.answer_key, 'feedback', ik.feedback))
      from private.practice_item_keys ik where ik.practice_activity_id = act.id), '{}'::jsonb),
    'publicationStatus', act.publication_status, 'publishedAt', act.published_at,
    'hasAttempts', private.practice_has_attempts(act.id), 'updatedAt', act.updated_at,
    'assets', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'assetType', s.asset_type, 'uploadStatus', s.upload_status,
        'mimeType', s.metadata->>'mime_type', 'sizeBytes', s.metadata->'size_bytes', 'createdAt', s.created_at) order by s.created_at, s.id)
      from public.practice_activity_assets s where s.practice_activity_id = act.id), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('cohortId', pa.cohort_id, 'cohortName', co.name, 'dueAt', pa.due_at,
        'assignedAt', pa.created_at) order by pa.created_at, pa.id)
      from public.cohort_practice_assignments pa join public.cohorts co on co.id = pa.cohort_id
      where pa.practice_activity_id = act.id), '[]'::jsonb));
end $$;

create or replace function public.teacher_practice_list()
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id();
begin
  return query
  select jsonb_build_object('id', a.id, 'title', a.title, 'skill', a.skill, 'estimatedMinutes', a.estimated_minutes,
    'cefrTarget', a.cefr_target, 'courseId', a.course_id, 'courseTitle', c.title,
    'publicationStatus', a.publication_status, 'publishedAt', a.published_at,
    'version', a.content -> 'version',
    'itemCount', case when jsonb_typeof(a.content -> 'items') = 'array' then jsonb_array_length(a.content -> 'items') else 1 end,
    'responseType', a.content #>> '{response,type}', 'stimulusType', a.content #>> '{stimulus,type}',
    'hasAttempts', private.practice_has_attempts(a.id),
    'assignmentCount', (select count(*) from public.cohort_practice_assignments pa where pa.practice_activity_id = a.id),
    'updatedAt', a.updated_at)
  from public.practice_activities a
  left join public.courses c on c.id = a.course_id
  where a.created_by_teacher_id = teacher and a.audience = 'ASSIGNED'
  order by a.updated_at desc, a.id
  limit 200;
end $$;

-- Duplicate-to-edit for v3: copies the item keys and remaps every item stimulus asset to the copied asset.
create or replace function public.teacher_practice_duplicate(p_id uuid, p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; new_id uuid := gen_random_uuid();
  k private.practice_answer_keys; new_content jsonb; asset record; new_asset uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  if not private.is_teacher_for_course(act.course_id) then raise exception 'Course scope required' using errcode = '42501'; end if;
  new_content := act.content;
  insert into public.practice_activities(id, slug, title, skill, cefr_target, difficulty, estimated_minutes, related_module_id,
    related_lesson_id, content, active, created_by_teacher_id, course_id, audience)
  values (new_id, 't-' || replace(new_id::text, '-', ''), left(act.title, 150) || ' (cópia)', act.skill, act.cefr_target, act.difficulty,
    act.estimated_minutes, act.related_module_id, act.related_lesson_id, act.content, true, teacher, act.course_id, 'ASSIGNED');
  for asset in select * from public.practice_activity_assets where practice_activity_id = act.id and upload_status = 'READY' loop
    new_asset := gen_random_uuid();
    insert into public.practice_activity_assets(id, practice_activity_id, asset_type, storage_path, provider, provider_ref, upload_status, metadata)
      values (new_asset, new_id, asset.asset_type, asset.storage_path, asset.provider, asset.provider_ref, 'READY', asset.metadata);
    if act.content -> 'version' = '3'::jsonb then
      -- Asset ids are random UUIDs: a textual replace remaps every item stimulus that references this asset.
      new_content := replace(new_content::text, asset.id::text, new_asset::text)::jsonb;
    elsif act.content #>> '{stimulus,assetId}' = asset.id::text then
      new_content := jsonb_set(new_content, '{stimulus,assetId}', to_jsonb(new_asset::text));
    end if;
  end loop;
  if new_content is distinct from act.content then
    update public.practice_activities set content = new_content where id = new_id;
  end if;
  select * into k from private.practice_answer_keys where practice_activity_id = act.id;
  insert into private.practice_answer_keys(practice_activity_id, answer_key, feedback)
    values (new_id, coalesce(k.answer_key, '{}'::jsonb), coalesce(k.feedback, '{}'::jsonb));
  insert into private.practice_item_keys(practice_activity_id, item_id, answer_key, feedback)
    select new_id, ik.item_id, ik.answer_key, ik.feedback from private.practice_item_keys ik where ik.practice_activity_id = act.id;
  perform private.practice_audit('teacher_practice_duplicated', new_id, jsonb_build_object('source_id', act.id), p_context);
  return new_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 8. Privileges: every new function is closed to PUBLIC/anon and opened explicitly to authenticated.
-- ---------------------------------------------------------------------------------------------------------
revoke all on function
  public.submit_practice_attempt(uuid, jsonb), public.finalize_practice_review(uuid, jsonb, text, text),
  public.submit_practice_item(uuid, text, smallint, jsonb, text), public.finalize_practice_attempt(uuid),
  public.start_practice_review(uuid, uuid), public.student_due_reviews(),
  public.reserve_practice_audio(uuid, text, text), public.teacher_practice_save_v3(uuid, jsonb, jsonb, jsonb),
  public.finalize_practice_review(uuid, jsonb, text, text, text), public.get_teacher_reviews(uuid),
  public.teacher_practice_get(uuid), public.teacher_practice_list(), public.teacher_practice_duplicate(uuid, jsonb),
  public.authorize_practice_asset(uuid)
  from public, anon, authenticated;
revoke all on function private.guard_practice_with_attempts() from public, anon, authenticated;
grant execute on function
  public.submit_practice_attempt(uuid, jsonb), public.finalize_practice_review(uuid, jsonb, text, text),
  public.submit_practice_item(uuid, text, smallint, jsonb, text), public.finalize_practice_attempt(uuid),
  public.start_practice_review(uuid, uuid), public.student_due_reviews(),
  public.reserve_practice_audio(uuid, text, text), public.teacher_practice_save_v3(uuid, jsonb, jsonb, jsonb),
  public.finalize_practice_review(uuid, jsonb, text, text, text), public.get_teacher_reviews(uuid),
  public.teacher_practice_get(uuid), public.teacher_practice_list(), public.teacher_practice_duplicate(uuid, jsonb),
  public.authorize_practice_asset(uuid)
  to authenticated;
