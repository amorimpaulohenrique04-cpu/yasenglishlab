-- Stage 12 / Block B (database): Admin authoring of the entry (placement) assessment.
--
-- Additive only (ADR 0021). Decisions (harness/agent-state/decisions.md, 2026-10-15):
--  * Only ADMIN + AAL2 (private.assert_content_admin) authors and publishes assessments (ADR 0006).
--  * The entry assessment is explicit: assessments.is_placement, at most ONE active assessment carries it
--    (partial unique index). start_placement_assessment uses only that assessment, so publishing any other
--    assessment can no longer change the onboarding test silently. The backfill marks the assessment the OLD
--    rule of start_placement_assessment (stage_01_enrollment_core) already selected, preserving behaviour.
--  * Authoring happens only through security definer RPCs (no DML grant). answer_key / rubric are never exposed
--    to students (column grants of assessment_engine_v1 are untouched) and are returned only to ADMIN.
--  * Publication repeats the contract of start_assessment_attempt (assessment_engine_v1), so a version that a
--    Student could not start is never published. Post-publication immutability stays with the existing
--    protect_assessment_version / protect_assessment_item triggers (edit = new DRAFT version).
--  * is_placement is changed only together with a successful publication (never by saving a draft), so the
--    onboarding test never points at an assessment without a published version.
--  * The only published version of the active entry assessment cannot be retired.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Model
-- ---------------------------------------------------------------------------------------------------------
alter table public.assessments add column is_placement boolean not null default false;

-- Deterministic backfill: the assessment of the version the previous start_placement_assessment selected
-- (published + active assessment + at least one item, newest published_at, then id).
update public.assessments a
set is_placement = true
where a.id = (
  select av.assessment_id
  from public.assessment_versions av
  join public.assessments assessment on assessment.id = av.assessment_id
  where av.status = 'PUBLISHED'
    and assessment.active
    and exists (select 1 from public.assessment_items i where i.assessment_version_id = av.id)
  order by av.published_at desc, av.id
  limit 1);

create unique index assessments_one_active_placement on public.assessments (is_placement) where is_placement and active;

-- ---------------------------------------------------------------------------------------------------------
-- 2. start_placement_assessment: only the explicit entry assessment (everything else unchanged)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.start_placement_assessment() returns uuid language plpgsql security definer set search_path='' as $$
declare c public.placement_cases; v uuid; a public.assessment_attempts;
begin
 if auth.uid() is null or not private.has_role('STUDENT',false) then raise exception 'Student required' using errcode='42501'; end if;
 select * into c from public.placement_cases where user_id=auth.uid() for update;
 if c.id is null then raise exception 'placement required' using errcode='23514'; end if;
 if c.assessment_attempt_id is not null then return c.assessment_attempt_id; end if;
 if c.state<>'ASSESSMENT_REQUIRED' then raise exception 'onboarding preferences required' using errcode='23514'; end if;
 select av.id into v from public.assessment_versions av join public.assessments assessment on assessment.id=av.assessment_id where av.status='PUBLISHED' and assessment.active and assessment.is_placement and exists(select 1 from public.assessment_items i where i.assessment_version_id=av.id) order by av.published_at desc,av.id limit 1;
 if v is null then raise exception 'published assessment unavailable' using errcode='23514'; end if;
 select * into a from public.assessment_attempts where user_id=c.user_id and status in ('IN_PROGRESS','SUBMITTED','SCORED') order by started_at desc,id limit 1;
 if a.id is null then a:=public.start_assessment_attempt(v,c.id); end if;
 update public.placement_cases set assessment_attempt_id=a.id,state='IN_PROGRESS' where id=c.id;
 if a.status in ('SUBMITTED','SCORED') then update public.placement_cases set state='REVIEW_PENDING' where id=c.id; end if;
 return a.id;
end $$;
revoke all on function public.start_placement_assessment() from public, anon, authenticated;
grant execute on function public.start_placement_assessment() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Internal helpers
-- ---------------------------------------------------------------------------------------------------------
create function private.assessment_audit(p_action text, p_entity text, p_id uuid, p_data jsonb, p_context jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
  values (auth.uid(), p_action, p_entity, p_id, coalesce(p_data, '{}'::jsonb),
    coalesce((p_context->>'request_id')::uuid, gen_random_uuid()),
    left(coalesce(nullif(p_context->>'environment',''), 'unknown'), 40),
    left(coalesce(nullif(p_context->>'version',''), 'unknown'), 120));
end $$;

-- Draft-level shape check of one item payload (completeness is enforced at publication).
create function private.assessment_item_shape(p_item jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare itype text; opts jsonb; ak jsonb; rb jsonb; pr jsonb;
begin
  if jsonb_typeof(p_item) is distinct from 'object' then
    raise exception 'Assessment item must be an object' using errcode = '23514';
  end if;
  if (p_item - array['skill','cefr_target','item_type','prompt','answer_key','rubric']) <> '{}'::jsonb then
    raise exception 'Unsupported assessment item field' using errcode = '23514';
  end if;
  if jsonb_typeof(p_item->'skill') is distinct from 'string'
     or (p_item->>'skill') not in ('READING','LISTENING','SPEAKING','VOCABULARY','GRAMMAR','PRONUNCIATION') then
    raise exception 'Unsupported assessment item skill' using errcode = '23514';
  end if;
  if jsonb_typeof(p_item->'item_type') is distinct from 'string'
     or (p_item->>'item_type') not in ('MULTIPLE_CHOICE','MANUAL_TEXT') then
    raise exception 'Unsupported assessment item type' using errcode = '23514';
  end if;
  itype := p_item->>'item_type';
  if p_item ? 'cefr_target' and jsonb_typeof(p_item->'cefr_target') <> 'null'
     and (jsonb_typeof(p_item->'cefr_target') is distinct from 'string'
          or (p_item->>'cefr_target') not in ('A1','A2','B1','B2','C1','C2')) then
    raise exception 'Invalid CEFR target' using errcode = '23514';
  end if;

  pr := p_item->'prompt';
  if jsonb_typeof(pr) is distinct from 'object' or (pr - array['prompt','options','instructions']) <> '{}'::jsonb then
    raise exception 'Invalid assessment item prompt' using errcode = '23514';
  end if;
  if pr ? 'prompt' and (jsonb_typeof(pr->'prompt') is distinct from 'string' or char_length(pr->>'prompt') > 2000) then
    raise exception 'Invalid assessment item prompt text' using errcode = '23514';
  end if;
  if pr ? 'instructions' and (jsonb_typeof(pr->'instructions') is distinct from 'string' or char_length(pr->>'instructions') > 1000) then
    raise exception 'Invalid assessment item instructions' using errcode = '23514';
  end if;
  opts := pr->'options';
  if pr ? 'options' then
    if itype <> 'MULTIPLE_CHOICE' then
      raise exception 'Only multiple-choice items have options' using errcode = '23514';
    end if;
    if jsonb_typeof(opts) is distinct from 'array' or jsonb_array_length(opts) > 8 then
      raise exception 'Invalid assessment options' using errcode = '23514';
    end if;
    if exists (select 1 from jsonb_array_elements(opts) o
        where jsonb_typeof(o) is distinct from 'object' or (o - array['id','label']) <> '{}'::jsonb
           or (o ? 'id' and (jsonb_typeof(o->'id') is distinct from 'string' or char_length(o->>'id') > 80))
           or (o ? 'label' and (jsonb_typeof(o->'label') is distinct from 'string' or char_length(o->>'label') > 240))) then
      raise exception 'Invalid assessment option' using errcode = '23514';
    end if;
  end if;

  ak := p_item->'answer_key';
  if p_item ? 'answer_key' and jsonb_typeof(ak) <> 'null' then
    if itype <> 'MULTIPLE_CHOICE' then
      raise exception 'Only multiple-choice items have an answer key' using errcode = '23514';
    end if;
    if jsonb_typeof(ak) is distinct from 'object' or (ak - 'optionId') <> '{}'::jsonb
       or (ak ? 'optionId' and (jsonb_typeof(ak->'optionId') is distinct from 'string' or char_length(ak->>'optionId') > 80)) then
      raise exception 'Invalid answer key' using errcode = '23514';
    end if;
  end if;

  rb := p_item->'rubric';
  if p_item ? 'rubric' and jsonb_typeof(rb) <> 'null'
     and (jsonb_typeof(rb) is distinct from 'object' or length(rb::text) > 4000) then
    raise exception 'Invalid rubric' using errcode = '23514';
  end if;
end $$;

-- Publication contract: a strict superset of what start_assessment_attempt requires.
create function private.validate_assessment_version(p_version uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare it public.assessment_items; n integer; opts jsonb; ids integer;
begin
  select count(*) into n from public.assessment_items where assessment_version_id = p_version;
  if n = 0 then
    raise exception 'Assessment version has no executable items' using errcode = '23514';
  end if;
  for it in select * from public.assessment_items where assessment_version_id = p_version order by position loop
    if it.item_type not in ('MULTIPLE_CHOICE','MANUAL_TEXT') then
      raise exception 'Item %: unsupported item type', it.position using errcode = '23514';
    end if;
    if it.skill in ('SPEAKING','PRONUNCIATION') and it.item_type <> 'MANUAL_TEXT' then
      raise exception 'Item %: Speaking and Pronunciation must be manual text', it.position using errcode = '23514';
    end if;
    if jsonb_typeof(it.prompt) is distinct from 'object'
       or jsonb_typeof(it.prompt->'prompt') is distinct from 'string'
       or nullif(btrim(it.prompt->>'prompt'), '') is null then
      raise exception 'Item %: prompt text is required', it.position using errcode = '23514';
    end if;
    if it.item_type = 'MULTIPLE_CHOICE' then
      opts := it.prompt->'options';
      if jsonb_typeof(opts) is distinct from 'array' or jsonb_array_length(opts) < 2 then
        raise exception 'Item %: at least two options are required', it.position using errcode = '23514';
      end if;
      if exists (select 1 from jsonb_array_elements(opts) o
          where jsonb_typeof(o) is distinct from 'object'
             or jsonb_typeof(o->'id') is distinct from 'string' or coalesce(btrim(o->>'id'), '') = ''
             or jsonb_typeof(o->'label') is distinct from 'string' or coalesce(btrim(o->>'label'), '') = '') then
        raise exception 'Item %: every option needs an id and a label', it.position using errcode = '23514';
      end if;
      select count(distinct o->>'id') into ids from jsonb_array_elements(opts) o;
      if ids <> jsonb_array_length(opts) then
        raise exception 'Item %: option ids must be unique', it.position using errcode = '23514';
      end if;
      if jsonb_typeof(it.answer_key) is distinct from 'object'
         or jsonb_typeof(it.answer_key->'optionId') is distinct from 'string'
         or nullif(btrim(it.answer_key->>'optionId'), '') is null
         or not exists (select 1 from jsonb_array_elements(opts) o where o->>'id' = it.answer_key->>'optionId') then
        raise exception 'Item %: the answer key must reference an existing option', it.position using errcode = '23514';
      end if;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Admin RPCs (ADMIN + AAL2)
-- ---------------------------------------------------------------------------------------------------------
create function public.admin_assessment_list()
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_content_admin();
  return query
  select jsonb_build_object('id', a.id, 'slug', a.slug, 'title', a.title, 'purpose', a.purpose, 'active', a.active,
    'isPlacement', a.is_placement, 'createdAt', a.created_at,
    'versions', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'versionNumber', v.version_number, 'status', v.status,
        'publishedAt', v.published_at,
        'itemCount', (select count(*) from public.assessment_items i where i.assessment_version_id = v.id),
        'hasAttempts', exists (select 1 from public.assessment_attempts t where t.assessment_version_id = v.id))
        order by v.version_number desc)
      from public.assessment_versions v where v.assessment_id = a.id), '[]'::jsonb))
  from public.assessments a
  order by a.is_placement desc, a.created_at desc, a.id
  limit 200;
end $$;

create function public.admin_assessment_get(p_assessment_id uuid, p_version_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a public.assessments; v public.assessment_versions;
begin
  perform private.assert_content_admin();
  select * into a from public.assessments where id = p_assessment_id;
  if a.id is null then raise exception 'Assessment unavailable' using errcode = '42501'; end if;
  if p_version_id is not null then
    select * into v from public.assessment_versions where id = p_version_id and assessment_id = a.id;
    if v.id is null then raise exception 'Assessment version unavailable' using errcode = '42501'; end if;
  else
    select * into v from public.assessment_versions where assessment_id = a.id
      order by (status = 'DRAFT') desc, version_number desc limit 1;
  end if;
  return jsonb_build_object('id', a.id, 'slug', a.slug, 'title', a.title, 'purpose', a.purpose, 'active', a.active,
    'isPlacement', a.is_placement, 'createdAt', a.created_at,
    'versions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'versionNumber', x.version_number, 'status', x.status,
        'publishedAt', x.published_at,
        'itemCount', (select count(*) from public.assessment_items i where i.assessment_version_id = x.id),
        'hasAttempts', exists (select 1 from public.assessment_attempts t where t.assessment_version_id = x.id))
        order by x.version_number desc)
      from public.assessment_versions x where x.assessment_id = a.id), '[]'::jsonb),
    'version', case when v.id is null then null else jsonb_build_object('id', v.id, 'versionNumber', v.version_number,
      'status', v.status, 'publishedAt', v.published_at, 'specification', v.specification,
      'hasAttempts', exists (select 1 from public.assessment_attempts t where t.assessment_version_id = v.id),
      'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'position', i.position, 'skill', i.skill,
          'cefrTarget', i.cefr_target, 'itemType', i.item_type, 'prompt', i.prompt,
          'answerKey', i.answer_key, 'rubric', i.rubric) order by i.position)
        from public.assessment_items i where i.assessment_version_id = v.id), '[]'::jsonb)) end);
end $$;

-- Creates an assessment (p_assessment_id null, with its version 1 DRAFT) or edits the DRAFT version of an existing one.
-- Items, when present in the payload, replace the draft's items atomically (position = array order).
create function public.admin_assessment_save_draft(p_assessment_id uuid, p_version_id uuid, p_payload jsonb,
  p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  allowed text[] := array['title','purpose','slug','specification','items'];
  k text; a public.assessments; v public.assessment_versions; a_id uuid; v_id uuid; v_no integer; drafts integer;
  v_title text; v_purpose text; v_slug text; v_spec jsonb; item jsonb; pos integer; n_items integer := 0; created boolean;
begin
  perform private.assert_content_admin();
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Object required' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_payload) loop
    if not (k = any (allowed)) then raise exception 'Unsupported assessment field' using errcode = '22023'; end if;
  end loop;
  if length(p_payload::text) > 400000 then raise exception 'Payload too large' using errcode = '22023'; end if;
  if p_payload ? 'items' and (jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') > 60) then
    raise exception 'Items must be an array of at most 60' using errcode = '23514';
  end if;
  if p_payload ? 'specification' and jsonb_typeof(p_payload->'specification') is distinct from 'object' then
    raise exception 'Specification must be an object' using errcode = '23514';
  end if;
  if p_payload ? 'title' then
    if jsonb_typeof(p_payload->'title') is distinct from 'string' or char_length(btrim(p_payload->>'title')) not between 1 and 160 then
      raise exception 'Title required' using errcode = '23514';
    end if;
    v_title := btrim(p_payload->>'title');
  end if;
  if p_payload ? 'purpose' then
    if jsonb_typeof(p_payload->'purpose') is distinct from 'string' or char_length(btrim(p_payload->>'purpose')) not between 1 and 400 then
      raise exception 'Purpose required' using errcode = '23514';
    end if;
    v_purpose := btrim(p_payload->>'purpose');
  end if;
  v_spec := p_payload->'specification';
  created := p_assessment_id is null;

  if created then
    a_id := gen_random_uuid();
    if v_title is null or v_purpose is null then raise exception 'Title and purpose required' using errcode = '23514'; end if;
    if p_payload ? 'slug' then
      if jsonb_typeof(p_payload->'slug') is distinct from 'string' then raise exception 'Valid slug required' using errcode = '23514'; end if;
      v_slug := lower(btrim(p_payload->>'slug'));
    else
      v_slug := 'a-' || replace(a_id::text, '-', '');
    end if;
    if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 100 then
      raise exception 'Valid slug required' using errcode = '23514';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('admin-assessment:' || a_id::text, 0));
    insert into public.assessments(id, slug, title, purpose, active, is_placement) values (a_id, v_slug, v_title, v_purpose, true, false);
    v_id := gen_random_uuid(); v_no := 1;
    insert into public.assessment_versions(id, assessment_id, version_number, status, specification)
      values (v_id, a_id, v_no, 'DRAFT', coalesce(v_spec, '{}'::jsonb));
  else
    perform pg_advisory_xact_lock(hashtextextended('admin-assessment:' || p_assessment_id::text, 0));
    select * into a from public.assessments where id = p_assessment_id for update;
    if a.id is null then raise exception 'Assessment unavailable' using errcode = '42501'; end if;
    a_id := a.id;
    if p_payload ? 'slug' and (jsonb_typeof(p_payload->'slug') is distinct from 'string' or lower(btrim(p_payload->>'slug')) <> a.slug) then
      raise exception 'The assessment slug is immutable' using errcode = '23514';
    end if;
    if p_version_id is null then
      select count(*) into drafts from public.assessment_versions where assessment_id = a.id and status = 'DRAFT';
      if drafts = 0 then raise exception 'No draft version: create a new version first' using errcode = '23514'; end if;
      if drafts > 1 then raise exception 'Several draft versions: pick one' using errcode = '23514'; end if;
      select * into v from public.assessment_versions where assessment_id = a.id and status = 'DRAFT' for update;
    else
      select * into v from public.assessment_versions where id = p_version_id and assessment_id = a.id for update;
      if v.id is null then raise exception 'Assessment version unavailable' using errcode = '42501'; end if;
    end if;
    if v.status <> 'DRAFT' then raise exception 'Only a draft version can be edited: create a new version' using errcode = '23514'; end if;
    if exists (select 1 from public.assessment_attempts t where t.assessment_version_id = v.id) then
      raise exception 'Assessment version has attempts' using errcode = '23514';
    end if;
    v_id := v.id; v_no := v.version_number;
    update public.assessments set title = coalesce(v_title, title), purpose = coalesce(v_purpose, purpose) where id = a.id;
    if v_spec is not null then
      update public.assessment_versions set specification = v_spec where id = v_id;
    end if;
  end if;

  if p_payload ? 'items' then
    for item in select e from jsonb_array_elements(p_payload->'items') e loop
      perform private.assessment_item_shape(item);
    end loop;
    delete from public.assessment_items where assessment_version_id = v_id;
    pos := 0;
    for item in select e from jsonb_array_elements(p_payload->'items') e loop
      pos := pos + 1;
      insert into public.assessment_items(assessment_version_id, position, skill, cefr_target, item_type, prompt, answer_key, rubric)
      values (v_id, pos, item->>'skill', nullif(item->>'cefr_target', ''), item->>'item_type', item->'prompt',
        case when jsonb_typeof(item->'answer_key') = 'object' then item->'answer_key' end,
        case when jsonb_typeof(item->'rubric') = 'object' then item->'rubric' end);
    end loop;
    n_items := pos;
  else
    select count(*) into n_items from public.assessment_items where assessment_version_id = v_id;
  end if;

  perform private.assessment_audit(case when created then 'assessment_created' else 'assessment_draft_saved' end,
    'assessment_versions', v_id, jsonb_build_object('assessment_id', a_id, 'version_number', v_no, 'item_count', n_items), p_context);
  return jsonb_build_object('assessmentId', a_id, 'versionId', v_id, 'versionNumber', v_no);
end $$;

create function public.admin_assessment_publish(p_version_id uuid, p_make_placement boolean default false,
  p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.assessment_versions; a public.assessments; retired integer; placement boolean;
begin
  perform private.assert_content_admin();
  select * into v from public.assessment_versions where id = p_version_id;
  if v.id is null then raise exception 'Assessment version unavailable' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-assessment:' || v.assessment_id::text, 0));
  select * into v from public.assessment_versions where id = p_version_id for update;
  select * into a from public.assessments where id = v.assessment_id for update;
  if v.status <> 'DRAFT' then raise exception 'Invalid publication transition' using errcode = '23514'; end if;
  if not a.active then raise exception 'Inactive assessments cannot be published' using errcode = '23514'; end if;
  perform private.validate_assessment_version(v.id);

  update public.assessment_versions set status = 'RETIRED'
    where assessment_id = a.id and status = 'PUBLISHED' and id <> v.id;
  get diagnostics retired = row_count;
  update public.assessment_versions set status = 'PUBLISHED', published_at = now() where id = v.id;

  placement := a.is_placement;
  if coalesce(p_make_placement, false) and not a.is_placement then
    -- Global lock last (always the second lock) so concurrent swaps serialize without deadlock.
    perform pg_advisory_xact_lock(hashtextextended('admin-assessment-placement', 0));
    update public.assessments set is_placement = false where is_placement and id <> a.id;
    update public.assessments set is_placement = true where id = a.id;
    placement := true;
  end if;

  perform private.assessment_audit('assessment_publication', 'assessment_versions', v.id,
    jsonb_build_object('assessment_id', a.id, 'version_number', v.version_number, 'retired_versions', retired,
      'is_placement', placement, 'previous_status', 'DRAFT'), p_context);
  return jsonb_build_object('assessmentId', a.id, 'versionId', v.id, 'versionNumber', v.version_number,
    'retiredVersions', retired, 'isPlacement', placement);
end $$;

-- Clones the latest version into a new DRAFT (idempotent: an existing DRAFT is returned instead).
create function public.admin_assessment_new_version(p_assessment_id uuid, p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.assessments; src public.assessment_versions; draft public.assessment_versions; new_id uuid := gen_random_uuid(); new_no integer;
begin
  perform private.assert_content_admin();
  perform pg_advisory_xact_lock(hashtextextended('admin-assessment:' || coalesce(p_assessment_id::text, ''), 0));
  select * into a from public.assessments where id = p_assessment_id for update;
  if a.id is null then raise exception 'Assessment unavailable' using errcode = '42501'; end if;
  select * into draft from public.assessment_versions where assessment_id = a.id and status = 'DRAFT'
    order by version_number desc limit 1;
  if draft.id is not null then
    return jsonb_build_object('assessmentId', a.id, 'versionId', draft.id, 'versionNumber', draft.version_number, 'created', false);
  end if;
  select * into src from public.assessment_versions where assessment_id = a.id order by version_number desc limit 1;
  if src.id is null then raise exception 'Assessment has no version to clone' using errcode = '23514'; end if;
  new_no := src.version_number + 1;
  insert into public.assessment_versions(id, assessment_id, version_number, status, specification, scoring_config)
    values (new_id, a.id, new_no, 'DRAFT', src.specification, src.scoring_config);
  insert into public.assessment_items(assessment_version_id, position, skill, cefr_target, item_type, prompt, answer_key, rubric)
    select new_id, i.position, i.skill, i.cefr_target, i.item_type, i.prompt, i.answer_key, i.rubric
    from public.assessment_items i where i.assessment_version_id = src.id order by i.position;
  perform private.assessment_audit('assessment_version_created', 'assessment_versions', new_id,
    jsonb_build_object('assessment_id', a.id, 'version_number', new_no, 'source_version_id', src.id), p_context);
  return jsonb_build_object('assessmentId', a.id, 'versionId', new_id, 'versionNumber', new_no, 'created', true);
end $$;

create function public.admin_assessment_retire(p_version_id uuid, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.assessment_versions; a public.assessments;
begin
  perform private.assert_content_admin();
  select * into v from public.assessment_versions where id = p_version_id;
  if v.id is null then raise exception 'Assessment version unavailable' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-assessment:' || v.assessment_id::text, 0));
  select * into v from public.assessment_versions where id = p_version_id for update;
  select * into a from public.assessments where id = v.assessment_id for update;
  if v.status <> 'PUBLISHED' then raise exception 'Invalid publication transition' using errcode = '23514'; end if;
  if a.is_placement and a.active and not exists (
       select 1 from public.assessment_versions o where o.assessment_id = a.id and o.status = 'PUBLISHED' and o.id <> v.id) then
    raise exception 'The only published version of the entry assessment cannot be retired' using errcode = '23514';
  end if;
  update public.assessment_versions set status = 'RETIRED' where id = v.id;
  perform private.assessment_audit('assessment_version_retired', 'assessment_versions', v.id,
    jsonb_build_object('assessment_id', a.id, 'version_number', v.version_number, 'previous_status', 'PUBLISHED'), p_context);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Privileges: nothing executable by PUBLIC/anon; RPCs explicitly granted to authenticated (role checked inside).
-- ---------------------------------------------------------------------------------------------------------
revoke all on function
  private.assessment_audit(text,text,uuid,jsonb,jsonb),
  private.assessment_item_shape(jsonb),
  private.validate_assessment_version(uuid),
  public.admin_assessment_list(),
  public.admin_assessment_get(uuid,uuid),
  public.admin_assessment_save_draft(uuid,uuid,jsonb,jsonb),
  public.admin_assessment_publish(uuid,boolean,jsonb),
  public.admin_assessment_new_version(uuid,jsonb),
  public.admin_assessment_retire(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function
  public.admin_assessment_list(),
  public.admin_assessment_get(uuid,uuid),
  public.admin_assessment_save_draft(uuid,uuid,jsonb,jsonb),
  public.admin_assessment_publish(uuid,boolean,jsonb),
  public.admin_assessment_new_version(uuid,jsonb),
  public.admin_assessment_retire(uuid,jsonb)
  to authenticated;
