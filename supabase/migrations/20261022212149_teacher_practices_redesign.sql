-- Approved lesson-bound practices: editable drafts, one atomic final submission.
-- Historical attempts/results are retained. No inferred links or destructive reset.

create table private.practice_answer_drafts (
  practice_attempt_id uuid primary key references public.practice_attempts(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  option_orders jsonb not null default '{}'::jsonb
);
create table private.practice_draft_creations (
  teacher_id uuid not null references public.teachers(id),
  creation_key uuid not null,
  practice_activity_id uuid not null references public.practice_activities(id) on delete cascade,
  primary key (teacher_id, creation_key)
);
revoke all on private.practice_answer_drafts, private.practice_draft_creations from public, anon, authenticated;

create function private.validate_practice_item_settings(p_item jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare b jsonb; c jsonb;
begin
  if p_item ? 'weight' and (jsonb_typeof(p_item->'weight') <> 'number' or (p_item->>'weight') !~ '^[0-9]+$'
    or (p_item->>'weight')::numeric not between 1 and 100) then raise exception 'Invalid question weight' using errcode='23514'; end if;
  if p_item ? 'difficulty' and (jsonb_typeof(p_item->'difficulty') <> 'string' or char_length(p_item->>'difficulty')>40) then raise exception 'Invalid question difficulty' using errcode='23514'; end if;
  if p_item ? 'estimatedSeconds' and (jsonb_typeof(p_item->'estimatedSeconds') <> 'number' or (p_item->>'estimatedSeconds') !~ '^[0-9]+$'
    or (p_item->>'estimatedSeconds')::numeric not between 1 and 14400) then raise exception 'Invalid estimated time' using errcode='23514'; end if;
  if (p_item ? 'shuffleOptions' and jsonb_typeof(p_item->'shuffleOptions')<>'boolean')
    or (p_item ? 'showExplanation' and jsonb_typeof(p_item->'showExplanation')<>'boolean') then raise exception 'Invalid question setting' using errcode='23514'; end if;
  if p_item ? 'promptDocument' then
    if jsonb_typeof(p_item->'promptDocument')<>'array' or jsonb_array_length(p_item->'promptDocument') not between 1 and 50 then raise exception 'Invalid prompt document' using errcode='23514'; end if;
    for b in select value from jsonb_array_elements(p_item->'promptDocument') loop
      if jsonb_typeof(b)<>'object' or b-array['type','children']<>'{}'::jsonb or coalesce(b->>'type','') not in ('paragraph','bullet','numbered')
        or jsonb_typeof(b->'children') is distinct from 'array' then raise exception 'Invalid prompt block' using errcode='23514'; end if;
      if jsonb_array_length(b->'children') not between 1 and 100 then raise exception 'Invalid prompt block' using errcode='23514'; end if;
      for c in select value from jsonb_array_elements(b->'children') loop
        if jsonb_typeof(c)<>'object' or c-array['text','bold','italic','underline']<>'{}'::jsonb
          or jsonb_typeof(c->'text') is distinct from 'string' or char_length(c->>'text')>600
          or (c ? 'bold' and jsonb_typeof(c->'bold')<>'boolean') or (c ? 'italic' and jsonb_typeof(c->'italic')<>'boolean')
          or (c ? 'underline' and jsonb_typeof(c->'underline')<>'boolean') then raise exception 'Invalid prompt text' using errcode='23514'; end if;
      end loop;
    end loop;
  end if;
end $$;
revoke all on function private.validate_practice_item_settings(jsonb) from public, anon, authenticated;

alter function private.validate_practice_v3(jsonb,jsonb,text,uuid) rename to validate_practice_v3_pre_redesign;
create function private.validate_practice_v3(p_content jsonb,p_item_keys jsonb,p_skill text,p_activity uuid default null)
returns void language plpgsql stable security definer set search_path='' as $$
declare it jsonb; stripped jsonb;
begin
  for it in select value from jsonb_array_elements(p_content->'items') loop
    perform private.validate_practice_item_settings(it);
    if it->'response'->>'type' in ('WRITTEN','SPOKEN') and it ? 'weight' then raise exception 'Manual items have no automatic weight' using errcode='23514'; end if;
  end loop;
  select jsonb_agg(value-array['weight','difficulty','estimatedSeconds','shuffleOptions','showExplanation','promptDocument'] order by ord)
    into stripped from jsonb_array_elements(p_content->'items') with ordinality t(value,ord);
  perform private.validate_practice_v3_pre_redesign(jsonb_set(p_content,'{items}',coalesce(stripped,'[]')),p_item_keys,p_skill,p_activity);
end $$;
revoke all on function private.validate_practice_v3_pre_redesign(jsonb,jsonb,text,uuid),private.validate_practice_v3(jsonb,jsonb,text,uuid) from public,anon,authenticated;

-- Lesson access is shared with the learning path; ASSIGNED remains an ownership marker only.
create function private.practice_lesson_available(p_activity uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.practice_activities a join public.lessons l on l.id=a.related_lesson_id
    where a.id=p_activity and private.content_visible('lessons',l.id)
      and (private.student_path_available('lessons',l.id,p_user) or private.welcome_can_read('lessons',l.id,p_user)));
$$;
revoke all on function private.practice_lesson_available(uuid,uuid) from public,anon,authenticated;

create or replace function private.can_view_practice_activity(p_activity uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role('ADMIN',true) or exists(select 1 from public.practice_activities a
  where a.id=p_activity and (
    (private.has_role('TEACHER',true) and private.content_visible('practice_activities',a.id) and (a.created_by_teacher_id=(select t.id from public.teachers t where t.user_id=auth.uid() and t.active)
      or (a.created_by_teacher_id is null and private.content_visible('practice_activities',a.id))))
    or (private.has_role('STUDENT',false) and a.active and a.publication_status='PUBLISHED'
      and private.practice_lesson_available(a.id,auth.uid()))));
$$;
create or replace function private.practice_lesson_reached(p_user uuid,p_activity uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.practice_lesson_available(p_activity,p_user);
$$;

create function private.require_practice_lesson() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.publication_status='PUBLISHED' and (tg_op='INSERT' or old.publication_status is distinct from new.publication_status) then
  if new.related_lesson_id is null or not exists(select 1 from public.lessons l join public.modules m on m.id=l.module_id
    where l.id=new.related_lesson_id and (new.course_id is null or m.course_id=new.course_id)
    and (new.related_module_id is null or l.module_id=new.related_module_id)) then
   raise exception 'A valid lesson is required to publish a practice' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.require_practice_lesson() from public,anon,authenticated;
create trigger practice_lesson_publication_guard before insert or update on public.practice_activities
 for each row execute function private.require_practice_lesson();

create function public.teacher_practice_autosave(p_id uuid,p_payload jsonb,p_item_keys jsonb,p_creation_key uuid,p_expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare teacher uuid:=private.current_teacher_id(); target uuid:=p_id; current_row public.practice_activities;
begin
 if p_creation_key is null then raise exception 'Creation key required' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('practice-create:'||teacher::text||p_creation_key::text,0));
 if target is null then
  select practice_activity_id into target from private.practice_draft_creations where teacher_id=teacher and creation_key=p_creation_key;
 end if;
 if target is not null then
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:'||target::text,0));
  select * into current_row from public.practice_activities where id=target and created_by_teacher_id=teacher for update;
  if current_row.id is null then raise exception 'Practice unavailable' using errcode='42501'; end if;
  if p_expected is null or current_row.updated_at is distinct from p_expected then
   return jsonb_build_object('status','conflict','id',target,'updatedAt',current_row.updated_at);
  end if;
 end if;
 if nullif(p_payload->>'related_module_id','') is null or nullif(p_payload->>'related_lesson_id','') is null then
  raise exception 'Course, module and lesson are required' using errcode='23514';
 end if;
 target:=public.teacher_practice_save_v3(target,p_payload,p_item_keys);
 insert into private.practice_draft_creations(teacher_id,creation_key,practice_activity_id) values(teacher,p_creation_key,target) on conflict do nothing;
 return jsonb_build_object('status','saved','id',target,'updatedAt',(select updated_at from public.practice_activities where id=target));
end $$;

create function public.practice_answers_get(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; orders jsonb;
begin
 if not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into a from public.practice_attempts where id=p_attempt and user_id=auth.uid() for update;
 if a.id is null then raise exception 'Own attempt required' using errcode='42501'; end if;
 if a.status<>'SUBMITTED' and (not private.can_view_practice_activity(a.practice_activity_id) or not private.has_paid_access(auth.uid())) then raise exception 'Practice unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_object_agg(it->>'id',vals),'{}') into orders from (
  select it, (select jsonb_agg(o->>'id' order by case when coalesce((it->>'shuffleOptions')::boolean,false) then md5(p_attempt::text||(it->>'id')||(o->>'id')) else lpad(ord::text,4,'0') end)
    from jsonb_array_elements(it->'response'->'options') with ordinality t(o,ord)) vals
  from public.practice_activities p cross join lateral jsonb_array_elements(p.content->'items') it
  where p.id=a.practice_activity_id and it->'response'->>'type' in ('CHOICE_SINGLE','CHOICE_MULTI')) q;
 insert into private.practice_answer_drafts(practice_attempt_id,option_orders) values(p_attempt,orders) on conflict do nothing;
 return (select jsonb_build_object('answers',answers,'optionOrders',option_orders) from private.practice_answer_drafts where practice_attempt_id=p_attempt);
end $$;

create function public.practice_answers_save(p_attempt uuid,p_answers jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; k text; v jsonb;
begin
 perform public.practice_answers_get(p_attempt);
 select * into a from public.practice_attempts where id=p_attempt and user_id=auth.uid() for update;
 if a.status<>'IN_PROGRESS' then raise exception 'Practice is already submitted' using errcode='23514'; end if;
 if jsonb_typeof(p_answers) is distinct from 'object' or length(p_answers::text)>120000 then raise exception 'Invalid provisional answers' using errcode='23514'; end if;
 for k,v in select * from jsonb_each(p_answers) loop
  if not exists(select 1 from private.practice_items(a.practice_activity_id) i where i.item_id=k)
    or jsonb_typeof(v) is distinct from 'object' or v-array['response','confidence']<>'{}'::jsonb
    or jsonb_typeof(v->'response') is distinct from 'object'
    or (v->>'confidence' is not null and v->>'confidence' not in ('LOW','HIGH')) then raise exception 'Invalid provisional answer' using errcode='23514'; end if;
 end loop;
 update private.practice_answer_drafts set answers=p_answers where practice_attempt_id=p_attempt;
 update public.practice_attempts set last_activity_at=now() where id=p_attempt;
 return public.practice_answers_get(p_attempt);
end $$;

-- Internal grading and finalization definitions are installed below; their EXECUTE is revoked.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.practice_item_responses'::regclass
   and contype='c' and pg_get_constraintdef(oid) like '%correct_answer IS NULL%' loop
  execute format('alter table public.practice_item_responses drop constraint %I',c.conname);
 end loop;
end $$;

create or replace function public.teacher_practice_save_v3(p_id uuid, p_payload jsonb, p_item_keys jsonb, p_context jsonb default '{}'::jsonb)
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
  if jsonb_array_length(v_content->'items') not between 1 and 20 or char_length(coalesce(v_content->>'objective',''))>200
    or jsonb_typeof(v_content->'askConfidence') is distinct from 'boolean' then raise exception 'Invalid practice draft' using errcode='23514'; end if;
  if (select count(distinct i->>'id') from jsonb_array_elements(v_content->'items') i)<>jsonb_array_length(v_content->'items') then raise exception 'Duplicate question id' using errcode='23514'; end if;
  for k in select i->>'id' from jsonb_array_elements(v_content->'items') i loop
    if k is null or k !~ '^[a-z0-9-]{1,40}$' then raise exception 'Invalid question id' using errcode='23514'; end if;
  end loop;
  perform private.validate_practice_item_settings(i) from jsonb_array_elements(v_content->'items') i;

  if p_id is null then
    insert into public.practice_activities(id, slug, title, skill, cefr_target, difficulty, estimated_minutes, related_module_id,
      related_lesson_id, content, active, created_by_teacher_id, course_id, audience)
    values (row_id, 't-' || replace(row_id::text, '-', ''), v_title, v_skill, v_cefr, v_diff, v_minutes, v_module,
      v_lesson, v_content, true, teacher, v_course, 'ASSIGNED');
  else
    update public.practice_activities set title = v_title, skill = v_skill, cefr_target = v_cefr, difficulty = v_diff,
      estimated_minutes = v_minutes, related_module_id = v_module, related_lesson_id = v_lesson, content = v_content,
      course_id = v_course, updated_at = clock_timestamp()
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

create function private.submit_practice_item_final_internal(p_attempt uuid, p_item_id text, p_round smallint, p_response jsonb,
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
    v_answer := v_item.answer_key;
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
      update public.practice_response_media set upload_status = 'SUBMITTED', updated_at = clock_timestamp() where id = v_media.id;
    else
      raise exception 'Practice response type is unsupported' using errcode = '23514';
    end if;
    v_status := 'PENDING_MANUAL';
    v_feedback := 'Aguardando revisão do professor.';
  end if;

  if exists(select 1 from public.practice_activities p cross join lateral jsonb_array_elements(p.content->'items') i where p.id=v_activity.id and i->>'id'=p_item_id and i->'showExplanation'='false'::jsonb) then v_feedback:=null; v_option:=null; end if;
  insert into public.practice_item_responses(practice_attempt_id, item_id, round, response, confidence, evaluation_status,
    feedback, option_feedback, correct_answer)
  values (v_attempt.id, p_item_id, p_round, v_stored, v_conf, v_status, v_feedback, v_option, v_answer)
  returning * into v_stored_row;
  update public.practice_attempts set last_activity_at = now() where id = v_attempt.id;
  return private.practice_item_response_json(v_stored_row);
end $$;

create function private.finalize_practice_final_internal(p_attempt uuid)
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

  select sum(case when r.evaluation_status='CORRECT' then coalesce((i->>'weight')::integer,1) else 0 end), sum(coalesce((i->>'weight')::integer,1)) into v_score,v_max
    from public.practice_activities p cross join lateral jsonb_array_elements(p.content->'items') i
    join public.practice_item_responses r on r.practice_attempt_id=v_attempt.id and r.item_id=i->>'id' and r.round=1
    where p.id=v_attempt.practice_activity_id and i->'response'->>'type' not in ('WRITTEN','SPOKEN');
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

  return private.practice_result_json(v_result);
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
    'updatedAt', a.updated_at, 'objective', coalesce(a.content->>'objective',''), 'difficulty',a.difficulty,
    'relatedLessonId',a.related_lesson_id,'lessonTitle',(select title from public.lessons where id=a.related_lesson_id),
    'moduleTitle',(select title from public.modules where id=a.related_module_id))
  from public.practice_activities a
  left join public.courses c on c.id = a.course_id
  where a.created_by_teacher_id = teacher and a.audience = 'ASSIGNED'
  order by a.updated_at desc, a.id
  limit 200;
end $$;

create or replace function public.start_practice_attempt(p_practice_activity_id uuid,p_idempotency_key uuid)
returns public.practice_attempts language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; activity public.practice_activities;
begin
 if not private.has_role('STUDENT',false) or p_idempotency_key is null then raise exception 'Student and idempotency key required' using errcode='42501'; end if;
 if not private.has_paid_access(auth.uid()) then raise exception 'active subscription required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('practice-start:'||auth.uid()::text||':'||p_practice_activity_id::text,0));
 select * into a from public.practice_attempts where user_id=auth.uid() and idempotency_key=p_idempotency_key;
 if a.id is not null and a.practice_activity_id<>p_practice_activity_id then raise exception 'Idempotency key belongs to another activity' using errcode='23514'; end if;
 select * into a from public.practice_attempts where user_id=auth.uid() and practice_activity_id=p_practice_activity_id and status='SUBMITTED' order by submitted_at desc,id limit 1;
 if a.id is not null then return a; end if;
 select * into activity from public.practice_activities where id=p_practice_activity_id;
 if activity.id is null or not activity.active or activity.publication_status<>'PUBLISHED' then raise exception 'Practice activity is unavailable' using errcode='42501'; end if;
 if activity.related_lesson_id is not null and not private.student_path_includes('lessons',activity.related_lesson_id,auth.uid()) and not private.welcome_can_read('lessons',activity.related_lesson_id,auth.uid()) then raise exception 'Practice activity is unavailable' using errcode='42501'; end if;
 if not private.practice_lesson_available(activity.id,auth.uid()) then
  raise exception 'Practice lesson not reached' using errcode='YP001',hint='PRACTICE_LESSON_NOT_REACHED';
 end if;
 select * into a from public.practice_attempts where user_id=auth.uid() and practice_activity_id=activity.id and status='IN_PROGRESS' and attempt_kind='FULL' for update;
 if a.id is not null then return a; end if;
 insert into public.practice_attempts(user_id,practice_activity_id,idempotency_key,context,last_activity_at)
  values(auth.uid(),activity.id,p_idempotency_key,jsonb_build_object('evaluation_mode',activity.content->>'evaluationMode'),now()) returning * into a;
 return a;
end $$;

create function private.guard_practice_single_submission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('practice-start:'||new.user_id::text||':'||new.practice_activity_id::text,0));
 if exists(select 1 from public.practice_attempts a where a.user_id=new.user_id and a.practice_activity_id=new.practice_activity_id and a.status='SUBMITTED' and a.id<>new.id) then
  raise exception 'Practice already submitted' using errcode='23514';
 end if;
 return new;
end $$;
create trigger practice_single_submission_guard before insert or update of status on public.practice_attempts for each row execute function private.guard_practice_single_submission();

alter function public.submit_practice_item(uuid,text,smallint,jsonb,text) rename to submit_practice_item_pre_redesign;
revoke all on function public.submit_practice_item_pre_redesign(uuid,text,smallint,jsonb,text) from public,anon,authenticated;
create function public.submit_practice_item(p_attempt uuid,p_item_id text,p_round smallint,p_response jsonb,p_confidence text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'Use provisional answers and final submission' using errcode='23514'; end $$;

alter function public.finalize_practice_attempt(uuid) rename to finalize_practice_attempt_pre_redesign;
revoke all on function public.finalize_practice_attempt_pre_redesign(uuid) from public,anon,authenticated;
create function public.finalize_practice_attempt(p_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'Use final submission' using errcode='23514'; end $$;

alter function public.start_practice_review(uuid,uuid) rename to start_practice_review_pre_redesign;
revoke all on function public.start_practice_review_pre_redesign(uuid,uuid) from public,anon,authenticated;
create function public.start_practice_review(p_practice_activity_id uuid,p_idempotency_key uuid) returns public.practice_attempts
language plpgsql security definer set search_path='' as $$
begin raise exception 'Practice has one final submission' using errcode='YP002',hint='PRACTICE_NOTHING_DUE'; end $$;

create or replace function public.student_due_reviews()
returns table(practice_activity_id uuid,due_count integer,high_confidence_errors integer,oldest_due_at timestamptz)
language sql stable security definer set search_path='' as $$
 select null::uuid,0,0,null::timestamptz where false;
$$;

create function public.practice_submit_final(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts; d jsonb; i record; final_result jsonb;
begin
 if not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into a from public.practice_attempts where id=p_attempt and user_id=auth.uid();
 if a.id is null then raise exception 'Own attempt required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('practice-start:'||auth.uid()::text||':'||a.practice_activity_id::text,0));
 select * into a from public.practice_attempts where id=p_attempt and user_id=auth.uid() for update;
 if a.status='SUBMITTED' then
  select private.practice_result_json(r) into final_result from public.practice_results r where practice_attempt_id=p_attempt;
 else
  if a.status<>'IN_PROGRESS' or a.attempt_kind<>'FULL' then raise exception 'Practice cannot be submitted' using errcode='23514'; end if;
  if not private.has_paid_access(auth.uid()) or not private.can_view_practice_activity(a.practice_activity_id) then raise exception 'Practice unavailable' using errcode='42501'; end if;
  select answers into d from private.practice_answer_drafts where practice_attempt_id=p_attempt;
  for i in select * from private.practice_items(a.practice_activity_id) order by item_position loop
   if not coalesce(d ? i.item_id,false) then raise exception 'Every question requires an answer' using errcode='23514'; end if;
   perform private.submit_practice_item_final_internal(p_attempt,i.item_id,1::smallint,d->i.item_id->'response',d->i.item_id->>'confidence');
  end loop;
  final_result:=private.finalize_practice_final_internal(p_attempt);
 end if;
 return final_result||jsonb_build_object('results',coalesce((select jsonb_agg(private.practice_item_response_json(r)||jsonb_build_object('canRetry',false) order by r.created_at,r.item_id)
  from public.practice_item_responses r where r.practice_attempt_id=p_attempt and r.round=1),'[]'::jsonb));
end $$;

drop policy practice_item_responses_authorized_select on public.practice_item_responses;
create policy practice_item_responses_authorized_select on public.practice_item_responses for select to authenticated
using(exists(select 1 from public.practice_attempts a where a.id=practice_attempt_id and a.status='SUBMITTED' and private.can_view_student(a.user_id)));

revoke all on function private.submit_practice_item_final_internal(uuid,text,smallint,jsonb,text),private.finalize_practice_final_internal(uuid),private.guard_practice_single_submission() from public,anon,authenticated;
revoke all on function public.teacher_practice_autosave(uuid,jsonb,jsonb,uuid,timestamptz),public.practice_answers_get(uuid),public.practice_answers_save(uuid,jsonb),public.practice_submit_final(uuid),public.submit_practice_item(uuid,text,smallint,jsonb,text),public.finalize_practice_attempt(uuid),public.start_practice_review(uuid,uuid) from public,anon,authenticated;
grant execute on function public.teacher_practice_autosave(uuid,jsonb,jsonb,uuid,timestamptz),public.practice_answers_get(uuid),public.practice_answers_save(uuid,jsonb),public.practice_submit_final(uuid),public.submit_practice_item(uuid,text,smallint,jsonb,text),public.finalize_practice_attempt(uuid),public.start_practice_review(uuid,uuid) to authenticated;

create or replace function public.student_assigned_practices()
returns table(practice_activity_id uuid,cohort_id uuid,cohort_name text,title text,skill text,estimated_minutes integer,response_type text,assigned_at timestamptz,due_at timestamptz,status text,attempt_id uuid)
language sql stable security definer set search_path='' as $$
 select null::uuid,null::uuid,null::text,null::text,null::text,0,null::text,null::timestamptz,null::timestamptz,null::text,null::uuid where false;
$$;

-- An attempted activity is immutable: retain its content for historical result reads.
drop policy practice_activities_authenticated_select on public.practice_activities;
create policy practice_activities_authenticated_select on public.practice_activities for select to authenticated using (
 private.can_view_practice_activity(id) or exists(select 1 from public.practice_attempts pa where pa.practice_activity_id=practice_activities.id and pa.user_id=(select auth.uid()))
);

-- Legacy one-question final submissions use the same lock order as starts.
alter function public.submit_practice_attempt(uuid,jsonb) rename to submit_practice_attempt_pre_final_lock;
revoke all on function public.submit_practice_attempt_pre_final_lock(uuid,jsonb) from public,anon,authenticated;
create function public.submit_practice_attempt(p_practice_attempt_id uuid,p_response jsonb) returns public.practice_results
language plpgsql security definer set search_path='' as $$
declare a public.practice_attempts;
begin
 select * into a from public.practice_attempts where id=p_practice_attempt_id and user_id=auth.uid();
 if a.id is null or not private.has_role('STUDENT',false) then raise exception 'Own Student attempt required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('practice-start:'||auth.uid()::text||':'||a.practice_activity_id::text,0));
 return public.submit_practice_attempt_pre_final_lock(p_practice_attempt_id,p_response);
end $$;
revoke all on function public.submit_practice_attempt(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_practice_attempt(uuid,jsonb) to authenticated;
