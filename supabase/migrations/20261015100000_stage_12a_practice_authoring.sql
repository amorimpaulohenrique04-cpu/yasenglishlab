-- Stage 12 / Block A (database): Teacher practice authoring, per-cohort assignment and v2 deterministic grading.
--
-- Additive only. Decisions (harness/agent-state/decisions.md, 2026-10-15; ADR 0010 keeps manual practice
-- unscored and without CEFR):
--  * Practice content v2 = {version:2, stimulus, prompt, instructions?, response, evaluationMode}. Legacy kinds
--    (MULTIPLE_CHOICE, MANUAL_TEXT, MANUAL_AUDIO) are untouched: every wrapper below delegates to the previous
--    implementation (renamed) when content.version is not 2.
--  * Teachers author ONLY through security definer RPCs (no DML grant). Scope: course of an ACTIVE cohort the
--    Teacher currently teaches, TEACHER + AAL2. A practice with attempts is immutable (edit = duplicate).
--  * audience='ASSIGNED' practices are visible to a Student only through an explicit cohort assignment plus an
--    active membership and a course enrollment. audience='COURSE' keeps the Stage 11 rule.
--  * answer_key/feedback live only in private.practice_answer_keys (no client grant, as before).
--  * ORDERING: items are stored in an order that is never the key order (random permutation chosen when the
--    stored order would equal the key, kept stable afterwards); publication re-validates this.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Model
-- ---------------------------------------------------------------------------------------------------------
alter table public.practice_activities drop constraint practice_activities_skill_check;
alter table public.practice_activities add constraint practice_activities_skill_check
  check (skill in ('SPEAKING','LISTENING','PRONUNCIATION','VOCABULARY','GRAMMAR','WRITING'));

alter table public.practice_activities
  add column created_by_teacher_id uuid references public.teachers(id),
  add column course_id uuid references public.courses(id),
  add column audience text not null default 'COURSE' check (audience in ('COURSE','ASSIGNED'));
alter table public.practice_activities add constraint practice_activities_assigned_scope
  check (audience = 'COURSE' or (created_by_teacher_id is not null and course_id is not null));
create index practice_activities_teacher_idx on public.practice_activities(created_by_teacher_id) where created_by_teacher_id is not null;

create table public.cohort_practice_assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  practice_activity_id uuid not null references public.practice_activities(id) on delete restrict,
  assigned_by_teacher_id uuid not null references public.teachers(id),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cohort_id, practice_activity_id)
);
create index cohort_practice_assignments_activity_idx on public.cohort_practice_assignments(practice_activity_id);

create table public.practice_activity_assets (
  id uuid primary key default gen_random_uuid(),
  practice_activity_id uuid not null references public.practice_activities(id) on delete restrict,
  asset_type text not null check (asset_type in ('IMAGE','AUDIO','VIDEO')),
  storage_path text not null check (char_length(storage_path) between 1 and 300),
  provider text check (provider is null or char_length(provider) between 1 and 40),
  provider_ref text check (provider_ref is null or char_length(provider_ref) between 1 and 200),
  upload_status text not null default 'PENDING' check (upload_status in ('PENDING','READY','FAILED')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  -- A duplicated practice shares the (never deleted) storage object of its source.
  unique (practice_activity_id, storage_path)
);
create index practice_activity_assets_activity_idx on public.practice_activity_assets(practice_activity_id);

alter table public.cohort_practice_assignments enable row level security;
alter table public.practice_activity_assets enable row level security;
revoke all on public.cohort_practice_assignments, public.practice_activity_assets from public, anon, authenticated;
grant select on public.cohort_practice_assignments to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('yas-practice-assets','yas-practice-assets',false,26214400,
  array['image/png','image/jpeg','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','video/mp4','video/webm'])
on conflict(id) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Scope helpers
-- ---------------------------------------------------------------------------------------------------------
create function private.is_teacher_for_course(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_course is not null and auth.uid() is not null and private.has_role('TEACHER', true) and exists (
    select 1
    from public.cohort_teachers ct
    join public.teachers t on t.id = ct.teacher_id
    join public.cohorts c on c.id = ct.cohort_id
    where t.user_id = auth.uid() and t.active and ct.ends_at is null
      and c.status = 'ACTIVE' and c.course_id = p_course);
$$;

create function private.practice_has_attempts(p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.practice_attempts a where a.practice_activity_id = p_activity);
$$;

-- RLS helper (policies run with the caller's privileges, so this wrapper is the granted entry point).
create function private.can_read_cohort_practice_assignment(p_cohort uuid, p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('ADMIN', true)
    or private.is_cohort_teacher(p_cohort)
    or (private.has_role('STUDENT', false)
        and private.has_cohort_membership(p_cohort, auth.uid())
        and private.can_view_practice_activity(p_activity));
$$;

create function private.practice_audit(p_action text, p_id uuid, p_data jsonb, p_context jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,data,request_id,environment,version)
  values (auth.uid(), p_action, 'practice_activities', p_id, coalesce(p_data, '{}'::jsonb),
    coalesce((p_context->>'request_id')::uuid, gen_random_uuid()),
    left(coalesce(nullif(p_context->>'environment',''), 'unknown'), 40),
    left(coalesce(nullif(p_context->>'version',''), 'unknown'), 120));
end $$;

create function private.practice_norm(p_text text, p_case_sensitive boolean)
returns text language sql immutable set search_path = '' as $$
  select case when p_case_sensitive then btrim(regexp_replace(coalesce(p_text,''), '\s+', ' ', 'g'))
              else lower(btrim(regexp_replace(coalesce(p_text,''), '\s+', ' ', 'g'))) end;
$$;

-- ORDERING: the stored (student-visible) order must never equal the key order.
create function private.practice_normalize_content(p_content jsonb, p_key jsonb, p_id uuid)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare items jsonb; shuffled jsonb; key_order jsonb := p_key->'order'; tries integer := 0;
begin
  if jsonb_typeof(p_content) is distinct from 'object'
     or p_content #>> '{response,type}' is distinct from 'ORDERING'
     or jsonb_typeof(p_content #> '{response,items}') is distinct from 'array'
     or jsonb_typeof(key_order) is distinct from 'array'
     or jsonb_array_length(p_content #> '{response,items}') < 2 then
    return p_content;
  end if;
  items := p_content #> '{response,items}';
  if (select jsonb_agg(i->'id') from jsonb_array_elements(items) i) is distinct from key_order then
    return p_content;
  end if;
  loop
    select jsonb_agg(i order by random()) into shuffled from jsonb_array_elements(items) i;
    tries := tries + 1;
    exit when (select jsonb_agg(i->'id') from jsonb_array_elements(shuffled) i) is distinct from key_order;
    if tries >= 10 then
      shuffled := (items - 0) || jsonb_build_array(items->0);
      exit;
    end if;
  end loop;
  return jsonb_set(p_content, '{response,items}', shuffled);
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Content v2 validation (publication)
-- ---------------------------------------------------------------------------------------------------------
create function private.validate_practice_v2(p_content jsonb, p_answer_key jsonb, p_skill text, p_activity uuid default null)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  stim jsonb; resp jsonb; stype text; rtype text; mode text; opts jsonb; ids text[]; n integer;
  marker_ids text[]; blank_ids text[]; key_seq text[]; stored_seq text[];
begin
  if p_skill is null or p_skill not in ('SPEAKING','LISTENING','PRONUNCIATION','VOCABULARY','GRAMMAR','WRITING') then
    raise exception 'Unsupported practice skill' using errcode = '23514';
  end if;
  if jsonb_typeof(p_content) is distinct from 'object' or p_content->'version' is distinct from '2'::jsonb then
    raise exception 'Practice content v2 required' using errcode = '23514';
  end if;
  if (p_content - array['version','stimulus','prompt','instructions','response','evaluationMode']) <> '{}'::jsonb then
    raise exception 'Unsupported practice content field' using errcode = '23514';
  end if;
  if jsonb_typeof(p_content->'prompt') is distinct from 'string' or char_length(p_content->>'prompt') not between 1 and 600 then
    raise exception 'Practice prompt required' using errcode = '23514';
  end if;
  if p_content ? 'instructions' and (jsonb_typeof(p_content->'instructions') is distinct from 'string'
     or char_length(p_content->>'instructions') > 600) then
    raise exception 'Invalid practice instructions' using errcode = '23514';
  end if;

  -- Stimulus.
  stim := p_content->'stimulus';
  if jsonb_typeof(stim) is distinct from 'object' or jsonb_typeof(stim->'type') is distinct from 'string' then
    raise exception 'Practice stimulus required' using errcode = '23514';
  end if;
  stype := stim->>'type';
  if stype not in ('NONE','TEXT','IMAGE','AUDIO','VIDEO') then
    raise exception 'Unsupported stimulus type' using errcode = '23514';
  end if;
  if stype = 'NONE' and (stim - 'type') <> '{}'::jsonb then
    raise exception 'Invalid stimulus' using errcode = '23514';
  elsif stype = 'TEXT' then
    if (stim - array['type','text']) <> '{}'::jsonb or jsonb_typeof(stim->'text') is distinct from 'string'
       or char_length(btrim(stim->>'text')) not between 1 and 2000 then
      raise exception 'Invalid text stimulus' using errcode = '23514';
    end if;
  elsif stype in ('IMAGE','AUDIO','VIDEO') then
    if (stim - array['type','assetId','transcript','alt']) <> '{}'::jsonb
       or jsonb_typeof(stim->'assetId') is distinct from 'string'
       or stim->>'assetId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid media stimulus' using errcode = '23514';
    end if;
    if stype = 'IMAGE' then
      if stim ? 'transcript' or jsonb_typeof(stim->'alt') is distinct from 'string' or char_length(btrim(stim->>'alt')) not between 1 and 300 then
        raise exception 'Image stimulus requires alt text' using errcode = '23514';
      end if;
    else
      if stim ? 'alt' or (stim ? 'transcript' and (jsonb_typeof(stim->'transcript') is distinct from 'string' or char_length(stim->>'transcript') > 4000)) then
        raise exception 'Invalid media transcript' using errcode = '23514';
      end if;
    end if;
    if p_activity is not null and not exists (
      select 1 from public.practice_activity_assets a
      where a.id = (stim->>'assetId')::uuid and a.practice_activity_id = p_activity
        and a.asset_type = stype and a.upload_status = 'READY') then
      raise exception 'READY stimulus asset of this practice required' using errcode = '23514';
    end if;
  end if;

  -- Response.
  resp := p_content->'response';
  if jsonb_typeof(resp) is distinct from 'object' or jsonb_typeof(resp->'type') is distinct from 'string' then
    raise exception 'Practice response required' using errcode = '23514';
  end if;
  rtype := resp->>'type';
  mode := p_content->>'evaluationMode';
  if rtype in ('CHOICE_SINGLE','CHOICE_MULTI','TRUE_FALSE','CLOZE','ORDERING') then
    if mode is distinct from 'DETERMINISTIC' then raise exception 'Deterministic evaluation mode required' using errcode = '23514'; end if;
  elsif rtype in ('WRITTEN','SPOKEN') then
    if mode is distinct from 'MANUAL_PENDING' then raise exception 'Manual evaluation mode required' using errcode = '23514'; end if;
  else
    raise exception 'Unsupported response type' using errcode = '23514';
  end if;

  if rtype in ('CHOICE_SINGLE','CHOICE_MULTI','ORDERING') then
    if (resp - array['type', case rtype when 'ORDERING' then 'items' else 'options' end]) <> '{}'::jsonb then
      raise exception 'Unsupported response field' using errcode = '23514';
    end if;
    opts := case rtype when 'ORDERING' then resp->'items' else resp->'options' end;
    if jsonb_typeof(opts) is distinct from 'array'
       or jsonb_array_length(opts) not between 2 and (case rtype when 'ORDERING' then 10 else 6 end) then
      raise exception 'Invalid response options' using errcode = '23514';
    end if;
    if exists (select 1 from jsonb_array_elements(opts) o
        where jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string'
          or jsonb_typeof(o->'label') is distinct from 'string' or (o - array['id','label']) <> '{}'::jsonb
          or char_length(o->>'id') not between 1 and 80 or char_length(btrim(o->>'label')) not between 1 and 240) then
      raise exception 'Invalid response option' using errcode = '23514';
    end if;
    select array_agg(o->>'id') into ids from jsonb_array_elements(opts) o;
    n := cardinality(ids);
    if (select count(distinct x) from unnest(ids) x) <> n then
      raise exception 'Duplicate response option id' using errcode = '23514';
    end if;
  end if;

  if rtype = 'CHOICE_SINGLE' then
    if jsonb_typeof(p_answer_key) is distinct from 'object' or (p_answer_key - 'optionId') <> '{}'::jsonb
       or jsonb_typeof(p_answer_key->'optionId') is distinct from 'string' or (p_answer_key->>'optionId') <> all (ids) then
      raise exception 'Matching private answer key required' using errcode = '23514';
    end if;
  elsif rtype = 'CHOICE_MULTI' then
    if jsonb_typeof(p_answer_key) is distinct from 'object' or (p_answer_key - 'optionIds') <> '{}'::jsonb
       or jsonb_typeof(p_answer_key->'optionIds') is distinct from 'array'
       or jsonb_array_length(p_answer_key->'optionIds') not between 1 and n
       or exists (select 1 from jsonb_array_elements(p_answer_key->'optionIds') e
                  where jsonb_typeof(e) is distinct from 'string' or (e #>> '{}') <> all (ids))
       or (select count(distinct e #>> '{}') from jsonb_array_elements(p_answer_key->'optionIds') e) <> jsonb_array_length(p_answer_key->'optionIds') then
      raise exception 'Matching private answer key required' using errcode = '23514';
    end if;
  elsif rtype = 'ORDERING' then
    if jsonb_typeof(p_answer_key) is distinct from 'object' or (p_answer_key - 'order') <> '{}'::jsonb
       or jsonb_typeof(p_answer_key->'order') is distinct from 'array'
       or jsonb_array_length(p_answer_key->'order') <> n
       or exists (select 1 from jsonb_array_elements(p_answer_key->'order') e
                  where jsonb_typeof(e) is distinct from 'string' or (e #>> '{}') <> all (ids))
       or (select count(distinct e #>> '{}') from jsonb_array_elements(p_answer_key->'order') e) <> n then
      raise exception 'Matching private answer key required' using errcode = '23514';
    end if;
    select array_agg(e #>> '{}' order by ord) into key_seq from jsonb_array_elements(p_answer_key->'order') with ordinality t(e, ord);
    stored_seq := ids;
    if stored_seq = key_seq then
      raise exception 'Stored item order must differ from the answer order' using errcode = '23514';
    end if;
  elsif rtype = 'TRUE_FALSE' then
    if (resp - array['type','statement']) <> '{}'::jsonb or jsonb_typeof(resp->'statement') is distinct from 'string'
       or char_length(btrim(resp->>'statement')) not between 1 and 600 then
      raise exception 'Invalid true/false statement' using errcode = '23514';
    end if;
    if jsonb_typeof(p_answer_key) is distinct from 'object' or (p_answer_key - 'value') <> '{}'::jsonb
       or jsonb_typeof(p_answer_key->'value') is distinct from 'boolean' then
      raise exception 'Matching private answer key required' using errcode = '23514';
    end if;
  elsif rtype = 'CLOZE' then
    if (resp - array['type','text']) <> '{}'::jsonb or jsonb_typeof(resp->'text') is distinct from 'string'
       or char_length(btrim(resp->>'text')) not between 1 and 1000 then
      raise exception 'Invalid cloze text' using errcode = '23514';
    end if;
    select array_agg(distinct m[1] order by m[1]) into marker_ids from regexp_matches(resp->>'text', '\{\{([0-9]{1,2})\}\}', 'g') m;
    if marker_ids is null or cardinality(marker_ids) > 10 then
      raise exception 'Cloze requires 1 to 10 blank markers' using errcode = '23514';
    end if;
    if jsonb_typeof(p_answer_key) is distinct from 'object' or (p_answer_key - 'blanks') <> '{}'::jsonb
       or jsonb_typeof(p_answer_key->'blanks') is distinct from 'array'
       or jsonb_array_length(p_answer_key->'blanks') <> cardinality(marker_ids)
       or exists (select 1 from jsonb_array_elements(p_answer_key->'blanks') b
          where jsonb_typeof(b) is distinct from 'object' or (b - array['id','accepted','caseSensitive']) <> '{}'::jsonb
            or jsonb_typeof(b->'id') is distinct from 'string'
            or jsonb_typeof(b->'accepted') is distinct from 'array' or jsonb_array_length(b->'accepted') not between 1 and 10
            or (b ? 'caseSensitive' and jsonb_typeof(b->'caseSensitive') is distinct from 'boolean')
            or exists (select 1 from jsonb_array_elements(b->'accepted') a
                       where jsonb_typeof(a) is distinct from 'string' or char_length(btrim(a #>> '{}')) not between 1 and 100)) then
      raise exception 'Matching private answer key required' using errcode = '23514';
    end if;
    select array_agg(b->>'id' order by b->>'id') into blank_ids from jsonb_array_elements(p_answer_key->'blanks') b;
    if blank_ids is distinct from marker_ids then
      raise exception 'Every cloze marker needs exactly one answer' using errcode = '23514';
    end if;
  else -- WRITTEN / SPOKEN
    if (resp - 'type') <> '{}'::jsonb then raise exception 'Unsupported response field' using errcode = '23514'; end if;
    if p_answer_key is not null and p_answer_key <> '{}'::jsonb then
      raise exception 'Manual responses have no answer key' using errcode = '23514';
    end if;
  end if;
end $$;

-- Chain the existing publication validator; v2 shares title/slug/duration/module/lesson checks by delegating a
-- legacy-shaped row (never persisted).
alter function private.validate_content(text,jsonb) rename to validate_content_pre_authoring;
create function private.validate_content(p_kind text, p_row jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare ak jsonb; module_course uuid; lesson_course uuid;
begin
  if p_kind = 'practice_activities' and p_row->'content'->'version' = '2'::jsonb then
    select k.answer_key into ak from private.practice_answer_keys k where k.practice_activity_id = (p_row->>'id')::uuid;
    perform private.validate_practice_v2(p_row->'content', ak, p_row->>'skill', (p_row->>'id')::uuid);
    if p_row->>'audience' = 'ASSIGNED' then
      if nullif(p_row->>'created_by_teacher_id','') is null or nullif(p_row->>'course_id','') is null then
        raise exception 'Assigned practice requires an owner Teacher and a course' using errcode = '23514';
      end if;
      select m.course_id into module_course from public.modules m where m.id = nullif(p_row->>'related_module_id','')::uuid;
      select m.course_id into lesson_course from public.lessons l join public.modules m on m.id = l.module_id
        where l.id = nullif(p_row->>'related_lesson_id','')::uuid;
      if (p_row->>'related_module_id' is not null and module_course is distinct from (p_row->>'course_id')::uuid)
         or (p_row->>'related_lesson_id' is not null and lesson_course is distinct from (p_row->>'course_id')::uuid) then
        raise exception 'Related module or lesson must belong to the practice course' using errcode = '23514';
      end if;
    end if;
    p_row := jsonb_set(jsonb_set(p_row, '{skill}', '"GRAMMAR"'), '{content}',
      jsonb_build_object('kind','MANUAL_TEXT','evaluationMode','MANUAL_PENDING','prompt',p_row->'content'->'prompt','instructions','v2'));
  end if;
  perform private.validate_content_pre_authoring(p_kind, p_row);
end $$;
revoke all on function private.validate_content_pre_authoring(text,jsonb), private.validate_content(text,jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Immutability once attempts exist (teacher-authored and v2 practices)
-- ---------------------------------------------------------------------------------------------------------
create function private.guard_practice_with_attempts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare act_id uuid;
begin
  if tg_table_name = 'practice_activities' then
    if tg_op = 'UPDATE'
       and (old.created_by_teacher_id is not null or old.content->'version' = '2'::jsonb)
       and row(new.skill,new.content,new.course_id,new.audience,new.related_module_id,new.related_lesson_id,new.created_by_teacher_id)
           is distinct from row(old.skill,old.content,old.course_id,old.audience,old.related_module_id,old.related_lesson_id,old.created_by_teacher_id)
       and exists (select 1 from public.practice_attempts a where a.practice_activity_id = old.id) then
      raise exception 'Practice has attempts: duplicate it to edit' using errcode = '23514';
    end if;
    return new;
  end if;
  act_id := coalesce(old.practice_activity_id, new.practice_activity_id);
  if tg_op = 'UPDATE' and new.answer_key = old.answer_key and new.feedback = old.feedback then return new; end if;
  if exists (select 1 from public.practice_activities p
             where p.id = act_id and (p.created_by_teacher_id is not null or p.content->'version' = '2'::jsonb)
               and exists (select 1 from public.practice_attempts a where a.practice_activity_id = p.id)) then
    raise exception 'Practice has attempts: duplicate it to edit' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger practice_activities_attempts_guard before update on public.practice_activities
  for each row execute function private.guard_practice_with_attempts();
create trigger practice_answer_keys_attempts_guard before insert or update or delete on private.practice_answer_keys
  for each row execute function private.guard_practice_with_attempts();

-- ---------------------------------------------------------------------------------------------------------
-- 5. Student visibility
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.can_view_practice_activity(p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('ADMIN', true)
    or (
      private.content_visible('practice_activities', p_activity)
      and exists (
        select 1 from public.practice_activities a
        where a.id = p_activity
          and auth.uid() is not null
          and case when a.audience = 'ASSIGNED' then
            -- Teachers: only the author and Teachers of an assigned cohort. Students: assigned cohort + membership + enrollment.
            (private.has_role('TEACHER', true) and (
               exists (select 1 from public.teachers t where t.id = a.created_by_teacher_id and t.user_id = auth.uid())
               or exists (select 1 from public.cohort_practice_assignments pa
                          where pa.practice_activity_id = a.id and private.is_cohort_teacher(pa.cohort_id))))
            or (a.course_id is not null and private.has_course_enrollment(auth.uid(), a.course_id)
                and exists (select 1 from public.cohort_practice_assignments pa
                            where pa.practice_activity_id = a.id and private.has_cohort_membership(pa.cohort_id, auth.uid())))
          else
            -- Stage 11 rule, unchanged.
            private.has_role('TEACHER', true)
            or (a.related_module_id is null and a.related_lesson_id is null
                and exists (select 1 from public.enrollments e
                  where e.user_id = auth.uid() and e.status in ('ACTIVE', 'COMPLETED')))
            or ((a.related_module_id is not null or a.related_lesson_id is not null)
                and (a.related_module_id is null or exists (
                  select 1 from public.modules m
                  where m.id = a.related_module_id and private.has_course_enrollment(auth.uid(), m.course_id)))
                and (a.related_lesson_id is null or exists (
                  select 1 from public.lessons l join public.modules m on m.id = l.module_id
                  where l.id = a.related_lesson_id and private.has_course_enrollment(auth.uid(), m.course_id))))
          end
      )
    );
$$;

create policy cohort_practice_assignments_scope on public.cohort_practice_assignments
  for select to authenticated using (private.can_read_cohort_practice_assignment(cohort_id, practice_activity_id));

-- ---------------------------------------------------------------------------------------------------------
-- 6. Grading: submit_practice_attempt (v2 branch; everything else delegates)
-- ---------------------------------------------------------------------------------------------------------
alter function public.submit_practice_attempt(uuid,jsonb) rename to submit_practice_attempt_pre_authoring;
revoke all on function public.submit_practice_attempt_pre_authoring(uuid,jsonb) from public, anon, authenticated;

create function public.submit_practice_attempt(p_practice_attempt_id uuid, p_response jsonb)
returns public.practice_results language plpgsql security definer set search_path = '' as $$
declare
  attempt public.practice_attempts; activity public.practice_activities; key_row private.practice_answer_keys;
  result public.practice_results; media public.practice_response_media;
  rtype text; mode text; stored jsonb; correct boolean; feedback_text text; txt text;
  ids text[]; given text[]; expected text[];
begin
  select * into attempt from public.practice_attempts where id = p_practice_attempt_id and user_id = auth.uid() for update;
  if attempt.id is null or not private.has_role('STUDENT', false) then
    raise exception 'Own Student attempt required' using errcode = '42501';
  end if;
  select * into activity from public.practice_activities where id = attempt.practice_activity_id;
  if activity.content->'version' is distinct from '2'::jsonb then
    return public.submit_practice_attempt_pre_authoring(p_practice_attempt_id, p_response);
  end if;
  if attempt.status = 'SUBMITTED' then
    select * into result from public.practice_results where practice_attempt_id = attempt.id;
    return result;
  end if;
  if attempt.status <> 'IN_PROGRESS' then
    raise exception 'Practice attempt cannot be submitted' using errcode = '23514';
  end if;
  if not activity.active or not private.content_visible('practice_activities', activity.id)
     or (activity.audience = 'ASSIGNED' and not private.can_view_practice_activity(activity.id)) then
    raise exception 'Practice activity is unavailable' using errcode = '42501';
  end if;
  if jsonb_typeof(p_response) is distinct from 'object' then
    raise exception 'Practice response must be an object' using errcode = '23514';
  end if;
  rtype := activity.content #>> '{response,type}';
  mode := activity.content->>'evaluationMode';

  if mode = 'DETERMINISTIC' then
    select * into key_row from private.practice_answer_keys where practice_activity_id = activity.id;
    if key_row.practice_activity_id is null then
      raise exception 'Deterministic activity has no answer key' using errcode = '23514';
    end if;
    if rtype = 'CHOICE_SINGLE' then
      if (p_response - 'optionId') <> '{}'::jsonb or jsonb_typeof(p_response->'optionId') is distinct from 'string'
         or not exists (select 1 from jsonb_array_elements(activity.content #> '{response,options}') o where o->>'id' = p_response->>'optionId') then
        raise exception 'A valid practice option is required' using errcode = '23514';
      end if;
      correct := (p_response->>'optionId') = (key_row.answer_key->>'optionId');
      stored := jsonb_build_object('optionId', p_response->>'optionId');
    elsif rtype = 'CHOICE_MULTI' then
      if (p_response - 'optionIds') <> '{}'::jsonb or jsonb_typeof(p_response->'optionIds') is distinct from 'array'
         or jsonb_array_length(p_response->'optionIds') not between 1 and 6
         or exists (select 1 from jsonb_array_elements(p_response->'optionIds') e
              where jsonb_typeof(e) is distinct from 'string'
                 or not exists (select 1 from jsonb_array_elements(activity.content #> '{response,options}') o where o->>'id' = e #>> '{}'))
         or (select count(distinct e #>> '{}') from jsonb_array_elements(p_response->'optionIds') e) <> jsonb_array_length(p_response->'optionIds') then
        raise exception 'Valid practice options are required' using errcode = '23514';
      end if;
      select array_agg(e #>> '{}' order by e #>> '{}') into given from jsonb_array_elements(p_response->'optionIds') e;
      select array_agg(e #>> '{}' order by e #>> '{}') into expected from jsonb_array_elements(key_row.answer_key->'optionIds') e;
      correct := given = expected;
      stored := jsonb_build_object('optionIds', to_jsonb(given));
    elsif rtype = 'TRUE_FALSE' then
      if (p_response - 'value') <> '{}'::jsonb or jsonb_typeof(p_response->'value') is distinct from 'boolean' then
        raise exception 'A true/false value is required' using errcode = '23514';
      end if;
      correct := (p_response->'value') = (key_row.answer_key->'value');
      stored := jsonb_build_object('value', p_response->'value');
    elsif rtype = 'CLOZE' then
      if (p_response - 'blanks') <> '{}'::jsonb or jsonb_typeof(p_response->'blanks') is distinct from 'object' then
        raise exception 'Cloze blanks are required' using errcode = '23514';
      end if;
      select array_agg(k order by k) into given from jsonb_object_keys(p_response->'blanks') k;
      select array_agg(b->>'id' order by b->>'id') into expected from jsonb_array_elements(key_row.answer_key->'blanks') b;
      if given is distinct from expected
         or exists (select 1 from jsonb_each(p_response->'blanks') e
                    where jsonb_typeof(e.value) is distinct from 'string' or char_length(e.value #>> '{}') > 200) then
        raise exception 'Every cloze blank needs a text answer' using errcode = '23514';
      end if;
      correct := not exists (
        select 1 from jsonb_array_elements(key_row.answer_key->'blanks') b
        where not exists (
          select 1 from jsonb_array_elements_text(b->'accepted') a
          where private.practice_norm(a, coalesce((b->>'caseSensitive')::boolean, false))
              = private.practice_norm(p_response->'blanks'->>(b->>'id'), coalesce((b->>'caseSensitive')::boolean, false))));
      stored := jsonb_build_object('blanks', p_response->'blanks');
    elsif rtype = 'ORDERING' then
      if (p_response - 'order') <> '{}'::jsonb or jsonb_typeof(p_response->'order') is distinct from 'array' then
        raise exception 'An item order is required' using errcode = '23514';
      end if;
      select array_agg(i->>'id') into ids from jsonb_array_elements(activity.content #> '{response,items}') i;
      select array_agg(e #>> '{}' order by ord) into given
        from jsonb_array_elements(p_response->'order') with ordinality t(e, ord)
        where jsonb_typeof(e) = 'string';
      if given is null or cardinality(given) <> jsonb_array_length(p_response->'order')
         or cardinality(given) <> cardinality(ids)
         or exists (select 1 from unnest(given) x where x <> all (ids))
         or (select count(distinct x) from unnest(given) x) <> cardinality(given) then
        raise exception 'The order must contain every item exactly once' using errcode = '23514';
      end if;
      select array_agg(e #>> '{}' order by ord) into expected from jsonb_array_elements(key_row.answer_key->'order') with ordinality t(e, ord);
      correct := given = expected;
      stored := jsonb_build_object('order', to_jsonb(given));
    else
      raise exception 'Practice response type is unsupported' using errcode = '23514';
    end if;
    feedback_text := case when correct
      then coalesce(key_row.feedback->>'correct', 'Resposta correta.')
      else coalesce(key_row.feedback->>'incorrect', 'Resposta incorreta. Revise a explicação e tente outra atividade.') end;
    insert into public.practice_responses(practice_attempt_id, response) values (attempt.id, stored);
    insert into public.practice_results(practice_attempt_id, score, max_score, feedback, metrics, evaluation_status)
    values (attempt.id, case when correct then 1 else 0 end, 1, feedback_text,
      jsonb_build_object('evaluation_mode', 'DETERMINISTIC', 'response_type', rtype, 'correct', correct),
      case when correct then 'CORRECT' else 'INCORRECT' end)
    returning * into result;
  elsif mode = 'MANUAL_PENDING' and rtype = 'WRITTEN' then
    txt := nullif(btrim(p_response->>'text'), '');
    if (p_response - 'text') <> '{}'::jsonb or jsonb_typeof(p_response->'text') is distinct from 'string'
       or txt is null or char_length(txt) > 2000 then
      raise exception 'Written response must contain 1 to 2000 characters' using errcode = '23514';
    end if;
    insert into public.practice_responses(practice_attempt_id, response) values (attempt.id, jsonb_build_object('text', txt));
    insert into public.practice_results(practice_attempt_id, score, max_score, feedback, metrics, evaluation_status)
    values (attempt.id, null, null, 'Aguardando revisão do professor.',
      jsonb_build_object('evaluation_mode', 'MANUAL_PENDING', 'response_type', 'WRITTEN'), 'PENDING_MANUAL')
    returning * into result;
  elsif mode = 'MANUAL_PENDING' and rtype = 'SPOKEN' then
    if (p_response - 'mediaId') <> '{}'::jsonb or jsonb_typeof(p_response->'mediaId') is distinct from 'string'
       or p_response->>'mediaId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid audio response' using errcode = '23514';
    end if;
    select * into media from public.practice_response_media
      where id = (p_response->>'mediaId')::uuid and practice_attempt_id = attempt.id for update;
    if media.id is null or media.upload_status <> 'READY' then
      raise exception 'Validated media required' using errcode = '23514';
    end if;
    insert into public.practice_responses(practice_attempt_id, response) values (attempt.id, jsonb_build_object('mediaId', media.id));
    insert into public.practice_results(practice_attempt_id, score, max_score, feedback, metrics, evaluation_status)
    values (attempt.id, null, null, 'Aguardando revisão do professor.',
      jsonb_build_object('evaluation_mode', 'MANUAL_PENDING', 'response_type', 'SPOKEN'), 'PENDING_MANUAL')
    returning * into result;
    update public.practice_response_media set upload_status = 'SUBMITTED', updated_at = now() where id = media.id;
  else
    raise exception 'Practice activity evaluation mode is unsupported' using errcode = '23514';
  end if;
  update public.practice_attempts set status = 'SUBMITTED', submitted_at = now() where id = attempt.id;
  return result;
end $$;

-- SPOKEN reuses the private audio upload: legacy audio practice OR a v2 SPOKEN practice (any skill).
create or replace function public.reserve_practice_audio(p_attempt uuid, p_mime text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid := gen_random_uuid(); activity public.practice_activities;
begin
  if not private.has_role('STUDENT', false) then raise exception 'Student required' using errcode = '42501'; end if;
  select p.* into activity from public.practice_attempts a join public.practice_activities p on p.id = a.practice_activity_id
    where a.id = p_attempt and a.user_id = auth.uid() and a.status = 'IN_PROGRESS' for update of a;
  if activity.id is null
     or not ((activity.skill in ('SPEAKING','PRONUNCIATION') and activity.content->>'kind' = 'MANUAL_AUDIO')
             or (activity.content->'version' = '2'::jsonb and activity.content #>> '{response,type}' = 'SPOKEN')) then
    raise exception 'Own audio attempt required' using errcode = '42501';
  end if;
  insert into public.practice_response_media(id, practice_attempt_id, storage_path, mime_type) values (target, p_attempt, p_attempt || '/' || target, p_mime);
  return target;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Review queue: WRITTEN/SPOKEN (any skill) joins SPEAKING/PRONUNCIATION; rubric v1 categorical levels kept.
--    Dimensions: WRITTEN -> task_completion, comprehensibility, language_accuracy, vocabulary_use;
--    PRONUNCIATION -> unchanged 4; every other reviewable practice (SPEAKING or v2 SPOKEN) -> unchanged 6.
-- ---------------------------------------------------------------------------------------------------------
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
end $$;

create or replace function public.finalize_practice_review(p_attempt uuid, p_ratings jsonb, p_feedback text, p_rubric_version text default 'v1')
returns uuid language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); attempt public.practice_attempts; activity public.practice_activities;
  existing public.practice_manual_reviews; target uuid; dimensions text[]; reviewable boolean; rtype text;
begin
  select * into attempt from public.practice_attempts where id = p_attempt for update;
  if attempt.id is null or not private.is_teacher_assigned(attempt.user_id) or attempt.status <> 'SUBMITTED' then
    raise exception 'Review unavailable' using errcode = '42501';
  end if;
  select * into existing from public.practice_manual_reviews where practice_attempt_id = p_attempt;
  if existing.id is not null then
    if existing.teacher_id = teacher and existing.ratings = p_ratings and existing.feedback = trim(p_feedback) and existing.rubric_version = p_rubric_version then return existing.id; end if;
    raise exception 'Review already finalized' using errcode = '23505';
  end if;
  select * into activity from public.practice_activities where id = attempt.practice_activity_id;
  rtype := case when activity.content->'version' = '2'::jsonb then activity.content #>> '{response,type}' end;
  reviewable := activity.skill in ('SPEAKING','PRONUNCIATION') or rtype in ('WRITTEN','SPOKEN');
  if not reviewable or not exists (select 1 from public.practice_results where practice_attempt_id = p_attempt and evaluation_status = 'PENDING_MANUAL') then
    raise exception 'Pending manual review required' using errcode = '23514';
  end if;
  dimensions := case
    when rtype = 'WRITTEN' then array['task_completion','comprehensibility','language_accuracy','vocabulary_use']
    when activity.skill = 'PRONUNCIATION' then array['intelligibility','target_sounds','word_stress','sentence_stress_rhythm']
    else array['task_completion','comprehensibility','fluency','language_accuracy','vocabulary_use','pronunciation_intelligibility'] end;
  if p_rubric_version is distinct from 'v1' or jsonb_typeof(p_ratings) is distinct from 'object' or (p_ratings - dimensions) <> '{}'::jsonb
     or exists (select 1 from unnest(dimensions) d where not p_ratings ? d or coalesce(p_ratings->>d,'') not in ('NEEDS_WORK','DEVELOPING','SOLID','STRONG')) then
    raise exception 'Invalid rubric' using errcode = '23514';
  end if;
  insert into public.practice_manual_reviews(practice_attempt_id, teacher_id, rubric_version, ratings, feedback)
    values (p_attempt, teacher, 'v1', p_ratings, trim(p_feedback)) returning id into target;
  update public.practice_results set evaluation_status = 'MANUAL_REVIEWED', feedback = trim(p_feedback), score = null, max_score = null where practice_attempt_id = p_attempt;
  insert into public.notifications(user_id, notification_type, title, body, data, event_key)
    values (attempt.user_id, 'PRACTICE_FEEDBACK_READY', 'Feedback disponível', 'Confira sua prática.',
      jsonb_build_object('practice_attempt_id', p_attempt), p_attempt || ':PRACTICE_FEEDBACK_READY') on conflict do nothing;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, data)
    values (auth.uid(), 'PRACTICE_MANUAL_REVIEW', 'practice_manual_reviews', target, jsonb_build_object('practice_attempt_id', p_attempt, 'rubric_version', 'v1'));
  return target;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 8. Student read: assignments of the caller (no answer key, no content)
-- ---------------------------------------------------------------------------------------------------------
create function public.student_assigned_practices()
returns table (
  practice_activity_id uuid, cohort_id uuid, cohort_name text, title text, skill text, estimated_minutes integer,
  response_type text, assigned_at timestamptz, due_at timestamptz, status text, attempt_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_role('STUDENT', false) then
    raise exception 'Student required' using errcode = '42501';
  end if;
  return query
  select pa.practice_activity_id, pa.cohort_id, c.name, act.title, act.skill, act.estimated_minutes,
    act.content #>> '{response,type}', pa.created_at, pa.due_at,
    case when s.submitted then 'DONE'
         when pa.due_at is not null and pa.due_at < now() then 'OVERDUE'
         when s.attempts > 0 then 'IN_PROGRESS' else 'NEW' end,
    s.latest_attempt
  from public.cohort_practice_assignments pa
  join public.practice_activities act on act.id = pa.practice_activity_id
  join public.cohorts c on c.id = pa.cohort_id
  cross join lateral (
    select coalesce(bool_or(t.status = 'SUBMITTED'), false) as submitted,
           count(*) filter (where t.status = 'IN_PROGRESS') as attempts,
           (array_agg(t.id order by t.started_at desc, t.id))[1] as latest_attempt
    from public.practice_attempts t
    where t.user_id = auth.uid() and t.practice_activity_id = pa.practice_activity_id) s
  where private.has_cohort_membership(pa.cohort_id, auth.uid())
    and private.can_view_practice_activity(pa.practice_activity_id)
  order by pa.due_at nulls last, pa.created_at desc, pa.id
  limit 200;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- 9. Teacher commands
-- ---------------------------------------------------------------------------------------------------------
create function public.teacher_practice_list()
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id();
begin
  return query
  select jsonb_build_object('id', a.id, 'title', a.title, 'skill', a.skill, 'estimatedMinutes', a.estimated_minutes,
    'cefrTarget', a.cefr_target, 'courseId', a.course_id, 'courseTitle', c.title,
    'publicationStatus', a.publication_status, 'publishedAt', a.published_at,
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

create function public.teacher_practice_get(p_id uuid)
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

create function public.teacher_practice_save(p_id uuid, p_payload jsonb, p_answer_key jsonb default null,
  p_feedback jsonb default null, p_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  teacher uuid := private.current_teacher_id();
  row_id uuid := coalesce(p_id, gen_random_uuid());
  allowed text[] := array['title','skill','cefr_target','difficulty','estimated_minutes','course_id','related_module_id','related_lesson_id','content'];
  act public.practice_activities; eff jsonb; k text; stored_key private.practice_answer_keys;
  v_title text; v_skill text; v_minutes integer; v_course uuid; v_module uuid; v_lesson uuid; v_content jsonb; v_cefr text; v_diff text;
  rtype text; v_key jsonb; v_fb jsonb; manual boolean;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Object required' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_payload) loop
    if not (k = any (allowed)) then raise exception 'Unsupported practice field' using errcode = '22023'; end if;
  end loop;
  if length(p_payload::text) > 60000 or length(coalesce(p_answer_key::text,'')) > 20000 or length(coalesce(p_feedback::text,'')) > 4000 then
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

  v_title := btrim(eff->>'title');
  if jsonb_typeof(eff->'title') is distinct from 'string' or char_length(v_title) not between 1 and 160 then
    raise exception 'Title required' using errcode = '23514';
  end if;
  v_skill := eff->>'skill';
  if v_skill is null or v_skill not in ('SPEAKING','LISTENING','PRONUNCIATION','VOCABULARY','GRAMMAR','WRITING') then
    raise exception 'Unsupported practice skill' using errcode = '23514';
  end if;
  if jsonb_typeof(eff->'estimated_minutes') is distinct from 'number' or (eff->>'estimated_minutes') !~ '^[0-9]{1,3}$'
     or (eff->>'estimated_minutes')::integer not between 1 and 240 then
    raise exception 'Estimated minutes must be between 1 and 240' using errcode = '23514';
  end if;
  v_minutes := (eff->>'estimated_minutes')::integer;
  v_cefr := nullif(eff->>'cefr_target', '');
  if v_cefr is not null and v_cefr not in ('A1','A2','B1','B2','C1','C2') then raise exception 'Invalid CEFR target' using errcode = '23514'; end if;
  v_diff := nullif(eff->>'difficulty', '');
  if v_diff is not null and char_length(v_diff) > 40 then raise exception 'Invalid difficulty' using errcode = '23514'; end if;

  if jsonb_typeof(eff->'course_id') is distinct from 'string' then raise exception 'Course required' using errcode = '23514'; end if;
  v_course := (eff->>'course_id')::uuid;
  if not private.is_teacher_for_course(v_course) then raise exception 'Course scope required' using errcode = '42501'; end if;
  if p_id is not null and v_course is distinct from act.course_id
     and exists (select 1 from public.cohort_practice_assignments pa where pa.practice_activity_id = act.id) then
    raise exception 'Cannot change the course of an assigned practice' using errcode = '23514';
  end if;
  v_module := nullif(eff->>'related_module_id', '')::uuid;
  v_lesson := nullif(eff->>'related_lesson_id', '')::uuid;
  if v_module is not null and not exists (select 1 from public.modules m where m.id = v_module and m.course_id = v_course) then
    raise exception 'Related module must belong to the practice course' using errcode = '23514';
  end if;
  if v_lesson is not null and not exists (select 1 from public.lessons l join public.modules m on m.id = l.module_id
      where l.id = v_lesson and m.course_id = v_course and (v_module is null or m.id = v_module)) then
    raise exception 'Related lesson must belong to the practice course' using errcode = '23514';
  end if;

  v_content := eff->'content';
  if jsonb_typeof(v_content) is distinct from 'object' or jsonb_typeof(v_content #> '{response}') is distinct from 'object' then
    raise exception 'Practice content with a response is required' using errcode = '23514';
  end if;
  rtype := v_content #>> '{response,type}';
  if rtype in ('CHOICE_SINGLE','CHOICE_MULTI','TRUE_FALSE','CLOZE','ORDERING') then
    v_content := jsonb_set(v_content - 'evaluationMode', '{evaluationMode}', '"DETERMINISTIC"');
    manual := false;
  elsif rtype in ('WRITTEN','SPOKEN') then
    v_content := jsonb_set(v_content - 'evaluationMode', '{evaluationMode}', '"MANUAL_PENDING"');
    manual := true;
  else
    raise exception 'Unsupported response type' using errcode = '23514';
  end if;
  v_content := jsonb_set(v_content, '{version}', '2'::jsonb);

  -- Answer key / feedback: shape-checked here, cross-validated against the content at publication.
  if p_answer_key is not null and (jsonb_typeof(p_answer_key) is distinct from 'object'
     or (p_answer_key - array['optionId','optionIds','value','blanks','order']) <> '{}'::jsonb) then
    raise exception 'Invalid answer key' using errcode = '23514';
  end if;
  if p_feedback is not null and (jsonb_typeof(p_feedback) is distinct from 'object'
     or (p_feedback - array['correct','incorrect']) <> '{}'::jsonb
     or exists (select 1 from jsonb_each(p_feedback) f where jsonb_typeof(f.value) is distinct from 'string' or char_length(f.value #>> '{}') not between 1 and 600)) then
    raise exception 'Invalid feedback' using errcode = '23514';
  end if;
  select * into stored_key from private.practice_answer_keys where practice_activity_id = row_id;
  v_key := case when manual then coalesce(p_answer_key, '{}'::jsonb) else coalesce(p_answer_key, stored_key.answer_key, '{}'::jsonb) end;
  v_fb := coalesce(p_feedback, stored_key.feedback, '{}'::jsonb);
  v_content := private.practice_normalize_content(v_content, v_key, row_id);

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
  end if;
  insert into private.practice_answer_keys(practice_activity_id, answer_key, feedback) values (row_id, v_key, v_fb)
    on conflict (practice_activity_id) do update set answer_key = excluded.answer_key, feedback = excluded.feedback;
  perform private.practice_audit(case when p_id is null then 'teacher_practice_created' else 'teacher_practice_updated' end,
    row_id, jsonb_build_object('response_type', rtype, 'course_id', v_course, 'skill', v_skill), p_context);
  return row_id;
end $$;

create function public.teacher_practice_publish(p_id uuid, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; v_key jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  if act.publication_status <> 'DRAFT' then raise exception 'Invalid publication transition' using errcode = '23514'; end if;
  if not private.is_teacher_for_course(act.course_id) then raise exception 'Course scope required' using errcode = '42501'; end if;
  select answer_key into v_key from private.practice_answer_keys where practice_activity_id = act.id;
  -- content_publication_guard validates v2 (content, key, assets) and raises 23514 when incomplete.
  update public.practice_activities
    set content = private.practice_normalize_content(act.content, v_key, act.id),
        publication_status = 'PUBLISHED', published_at = now(), updated_at = now()
    where id = act.id;
  perform private.practice_audit('teacher_practice_published', act.id, jsonb_build_object('previous_status', 'DRAFT'), p_context);
end $$;

create function public.teacher_practice_unpublish(p_id uuid, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  if act.publication_status <> 'PUBLISHED' then raise exception 'Invalid publication transition' using errcode = '23514'; end if;
  update public.practice_activities set publication_status = 'DRAFT', published_at = null, updated_at = now() where id = act.id;
  perform private.practice_audit('teacher_practice_unpublished', act.id, jsonb_build_object('previous_status', 'PUBLISHED'), p_context);
end $$;

create function public.teacher_practice_duplicate(p_id uuid, p_context jsonb default '{}'::jsonb)
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
    if act.content #>> '{stimulus,assetId}' = asset.id::text then
      new_content := jsonb_set(new_content, '{stimulus,assetId}', to_jsonb(new_asset::text));
    end if;
  end loop;
  if new_content is distinct from act.content then
    update public.practice_activities set content = new_content where id = new_id;
  end if;
  select * into k from private.practice_answer_keys where practice_activity_id = act.id;
  insert into private.practice_answer_keys(practice_activity_id, answer_key, feedback)
    values (new_id, coalesce(k.answer_key, '{}'::jsonb), coalesce(k.feedback, '{}'::jsonb));
  perform private.practice_audit('teacher_practice_duplicated', new_id, jsonb_build_object('source_id', act.id), p_context);
  return new_id;
end $$;

create function public.teacher_practice_assign(p_id uuid, p_cohort_ids uuid[], p_due_at timestamptz default null,
  p_context jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; cohort_ids uuid[]; c uuid; assigned integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  if act.publication_status <> 'PUBLISHED' or not act.active or not private.content_visible('practice_activities', act.id) then
    raise exception 'Only a published practice can be assigned' using errcode = '23514';
  end if;
  if p_cohort_ids is null or cardinality(p_cohort_ids) not between 1 and 20 or exists (select 1 from unnest(p_cohort_ids) x where x is null) then
    raise exception 'Between 1 and 20 cohorts are required' using errcode = '23514';
  end if;
  if p_due_at is not null and p_due_at <= now() then
    raise exception 'Due date must be in the future' using errcode = '23514';
  end if;
  select array_agg(distinct x order by x) into cohort_ids from unnest(p_cohort_ids) x;
  foreach c in array cohort_ids loop
    if not private.is_cohort_teacher(c) then raise exception 'Cohort scope required' using errcode = '42501'; end if;
    if not exists (select 1 from public.cohorts co where co.id = c and co.course_id = act.course_id) then
      raise exception 'Cohort course does not match the practice course' using errcode = '23514';
    end if;
  end loop;
  foreach c in array cohort_ids loop
    insert into public.cohort_practice_assignments(cohort_id, practice_activity_id, assigned_by_teacher_id, due_at)
      values (c, act.id, teacher, p_due_at)
      on conflict (cohort_id, practice_activity_id) do update set due_at = excluded.due_at, assigned_by_teacher_id = excluded.assigned_by_teacher_id;
    assigned := assigned + 1;
  end loop;
  perform private.practice_audit('teacher_practice_assigned', act.id,
    jsonb_build_object('cohort_ids', to_jsonb(cohort_ids), 'due_at', p_due_at), p_context);
  return assigned;
end $$;

create function public.teacher_practice_unassign(p_id uuid, p_cohort_id uuid, p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; removed integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null or not private.is_cohort_teacher(p_cohort_id) then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  delete from public.cohort_practice_assignments where practice_activity_id = act.id and cohort_id = p_cohort_id;
  get diagnostics removed = row_count;
  if removed = 0 then raise exception 'Assignment unavailable' using errcode = '42501'; end if;
  perform private.practice_audit('teacher_practice_unassigned', act.id, jsonb_build_object('cohort_id', p_cohort_id), p_context);
end $$;

-- Stimulus media. Types/limits stay coherent with practice_response_media (25 MiB, same audio MIME types).
create function public.teacher_practice_reserve_asset(p_id uuid, p_asset_type text, p_mime text, p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); act public.practice_activities; target uuid := gen_random_uuid(); path text;
begin
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || coalesce(p_id::text, ''), 0));
  select * into act from public.practice_activities where id = p_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Practice unavailable' using errcode = '42501'; end if;
  if act.publication_status <> 'DRAFT' then raise exception 'Unpublish before editing content' using errcode = '23514'; end if;
  if private.practice_has_attempts(act.id) then raise exception 'Practice has attempts: duplicate it to edit' using errcode = '23514'; end if;
  if p_asset_type is null or not (
       (p_asset_type = 'IMAGE' and p_mime in ('image/png','image/jpeg','image/webp'))
    or (p_asset_type = 'AUDIO' and p_mime in ('audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav'))
    or (p_asset_type = 'VIDEO' and p_mime in ('video/mp4','video/webm'))) then
    raise exception 'Unsupported asset type or MIME type' using errcode = '23514';
  end if;
  if (select count(*) from public.practice_activity_assets s where s.practice_activity_id = act.id and s.upload_status <> 'FAILED') >= 10 then
    raise exception 'Asset limit reached' using errcode = '23514';
  end if;
  path := act.id || '/' || target;
  insert into public.practice_activity_assets(id, practice_activity_id, asset_type, storage_path, metadata)
    values (target, act.id, p_asset_type, path, jsonb_build_object('mime_type', p_mime));
  perform private.practice_audit('teacher_practice_asset_reserved', act.id, jsonb_build_object('asset_id', target, 'asset_type', p_asset_type), p_context);
  return jsonb_build_object('assetId', target, 'bucket', 'yas-practice-assets', 'storagePath', path, 'maxBytes', 26214400);
end $$;

create function public.teacher_practice_complete_asset(p_asset uuid, p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare teacher uuid := private.current_teacher_id(); asset public.practice_activity_assets; act public.practice_activities; obj jsonb;
begin
  select s.* into asset from public.practice_activity_assets s where s.id = p_asset;
  if asset.id is null then raise exception 'Asset unavailable' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('teacher-practice:' || asset.practice_activity_id::text, 0));
  select * into act from public.practice_activities where id = asset.practice_activity_id and created_by_teacher_id = teacher and audience = 'ASSIGNED' for update;
  if act.id is null then raise exception 'Asset unavailable' using errcode = '42501'; end if;
  select * into asset from public.practice_activity_assets where id = p_asset for update;
  if asset.upload_status = 'READY' then
    return jsonb_build_object('assetId', asset.id, 'uploadStatus', 'READY');
  end if;
  if act.publication_status <> 'DRAFT' or private.practice_has_attempts(act.id) then
    raise exception 'Practice is not editable' using errcode = '23514';
  end if;
  select o.metadata into obj from storage.objects o where o.bucket_id = 'yas-practice-assets' and o.name = asset.storage_path;
  if obj is null or obj->>'mimetype' is distinct from asset.metadata->>'mime_type'
     or coalesce((obj->>'size')::bigint, 0) not between 1 and 26214400 then
    raise exception 'Valid uploaded asset required' using errcode = '23514';
  end if;
  update public.practice_activity_assets set upload_status = 'READY',
    metadata = asset.metadata || jsonb_build_object('size_bytes', (obj->>'size')::bigint) where id = p_asset;
  perform private.practice_audit('teacher_practice_asset_ready', act.id, jsonb_build_object('asset_id', p_asset), p_context);
  return jsonb_build_object('assetId', p_asset, 'uploadStatus', 'READY');
end $$;

-- Boolean authorization for the server-side signed URL (same pattern as authorize_practice_media).
create function public.authorize_practice_asset(p_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.practice_activity_assets s
    join public.practice_activities a on a.id = s.practice_activity_id
    where s.id = p_asset and s.upload_status = 'READY'
      and (
        (private.has_role('TEACHER', true) and a.created_by_teacher_id in (select t.id from public.teachers t where t.user_id = auth.uid() and t.active))
        or (a.publication_status = 'PUBLISHED' and a.content #>> '{stimulus,assetId}' = s.id::text
            and (private.has_role('ADMIN', true) or (private.has_role('STUDENT', false) and private.can_view_practice_activity(a.id))))));
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 10. Privileges: every new function is closed to PUBLIC/anon and opened explicitly.
-- ---------------------------------------------------------------------------------------------------------
revoke all on function
  private.is_teacher_for_course(uuid), private.practice_has_attempts(uuid),
  private.can_read_cohort_practice_assignment(uuid, uuid), private.practice_audit(text, uuid, jsonb, jsonb),
  private.practice_norm(text, boolean), private.practice_normalize_content(jsonb, jsonb, uuid),
  private.validate_practice_v2(jsonb, jsonb, text, uuid), private.guard_practice_with_attempts(),
  public.submit_practice_attempt(uuid, jsonb), public.reserve_practice_audio(uuid, text),
  public.get_teacher_reviews(uuid), public.finalize_practice_review(uuid, jsonb, text, text),
  public.student_assigned_practices(), public.teacher_practice_list(), public.teacher_practice_get(uuid),
  public.teacher_practice_save(uuid, jsonb, jsonb, jsonb, jsonb), public.teacher_practice_publish(uuid, jsonb),
  public.teacher_practice_unpublish(uuid, jsonb), public.teacher_practice_duplicate(uuid, jsonb),
  public.teacher_practice_assign(uuid, uuid[], timestamptz, jsonb), public.teacher_practice_unassign(uuid, uuid, jsonb),
  public.teacher_practice_reserve_asset(uuid, text, text, jsonb), public.teacher_practice_complete_asset(uuid, jsonb),
  public.authorize_practice_asset(uuid)
  from public, anon, authenticated;
-- Policy helper must be callable by the caller's role; the rest of private.* stays internal.
grant execute on function private.can_read_cohort_practice_assignment(uuid, uuid) to authenticated;
grant execute on function
  public.submit_practice_attempt(uuid, jsonb), public.reserve_practice_audio(uuid, text),
  public.get_teacher_reviews(uuid), public.finalize_practice_review(uuid, jsonb, text, text),
  public.student_assigned_practices(), public.teacher_practice_list(), public.teacher_practice_get(uuid),
  public.teacher_practice_save(uuid, jsonb, jsonb, jsonb, jsonb), public.teacher_practice_publish(uuid, jsonb),
  public.teacher_practice_unpublish(uuid, jsonb), public.teacher_practice_duplicate(uuid, jsonb),
  public.teacher_practice_assign(uuid, uuid[], timestamptz, jsonb), public.teacher_practice_unassign(uuid, uuid, jsonb),
  public.teacher_practice_reserve_asset(uuid, text, text, jsonb), public.teacher_practice_complete_asset(uuid, jsonb),
  public.authorize_practice_asset(uuid)
  to authenticated;
