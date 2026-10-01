-- P19 executable evidence for Assessment lifecycle, objective scoring and RLS/security boundaries.
-- The file is transactional because Preview executes it in both integration and RLS suites.
begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('86000000-0000-4000-8000-000000000001', 'assessment-a@example.test', '{"display_name":"Assessment A"}'),
  ('86000000-0000-4000-8000-000000000002', 'assessment-b@example.test', '{"display_name":"Assessment B"}')
on conflict (id) do nothing;

insert into public.user_roles (id, user_id, role)
values
  ('86001000-0000-4000-8000-000000000001', '86000000-0000-4000-8000-000000000001', 'STUDENT'),
  ('86001000-0000-4000-8000-000000000002', '86000000-0000-4000-8000-000000000002', 'STUDENT')
on conflict (id) do nothing;

insert into public.assessments (id, slug, title, purpose, active)
values (
  '86010000-0000-4000-8000-000000000001',
  'assessment-engine-v1-fixture',
  'Assessment Engine V1 Fixture',
  'Deterministic development evidence only; not a validated CEFR test.',
  true
)
on conflict (id) do nothing;

insert into public.assessment_versions (
  id,
  assessment_id,
  version_number,
  status,
  specification,
  scoring_config
)
values
  (
    '86020000-0000-4000-8000-000000000001',
    '86010000-0000-4000-8000-000000000001',
    1,
    'DRAFT',
    '{"fixture":"mixed-objective-manual"}'::jsonb,
    '{"internal":"must-not-be-readable-by-student"}'::jsonb
  ),
  (
    '86020000-0000-4000-8000-000000000002',
    '86010000-0000-4000-8000-000000000001',
    2,
    'DRAFT',
    '{"fixture":"different-version"}'::jsonb,
    '{"internal":"must-not-be-readable-by-student"}'::jsonb
  ),
  (
    '86020000-0000-4000-8000-000000000003',
    '86010000-0000-4000-8000-000000000001',
    3,
    'DRAFT',
    '{"fixture":"objective-only"}'::jsonb,
    '{"internal":"must-not-be-readable-by-student"}'::jsonb
  ),
  (
    '86020000-0000-4000-8000-000000000004',
    '86010000-0000-4000-8000-000000000001',
    4,
    'DRAFT',
    '{"fixture":"must-remain-draft"}'::jsonb,
    '{"internal":"must-not-be-readable-by-student"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.assessment_items (
  id,
  assessment_version_id,
  position,
  skill,
  cefr_target,
  item_type,
  prompt,
  answer_key,
  rubric
)
values
  (
    '86030000-0000-4000-8000-000000000001',
    '86020000-0000-4000-8000-000000000001',
    1,
    'GRAMMAR',
    'C2',
    'MULTIPLE_CHOICE',
    '{"prompt":"Choose the correct sentence.","options":[{"id":"work","label":"I work from home."},{"id":"works","label":"I works from home."}]}'::jsonb,
    '{"optionId":"work"}'::jsonb,
    null
  ),
  (
    '86030000-0000-4000-8000-000000000002',
    '86020000-0000-4000-8000-000000000001',
    2,
    'SPEAKING',
    'C2',
    'MANUAL_TEXT',
    '{"prompt":"Give a short spoken response.","instructions":"Stored as text fixture; no automatic score."}'::jsonb,
    null,
    '{"internal":"future-policy-placeholder"}'::jsonb
  ),
  (
    '86030000-0000-4000-8000-000000000003',
    '86020000-0000-4000-8000-000000000002',
    1,
    'GRAMMAR',
    'A1',
    'MULTIPLE_CHOICE',
    '{"prompt":"Choose one.","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb,
    '{"optionId":"a"}'::jsonb,
    null
  ),
  (
    '86030000-0000-4000-8000-000000000004',
    '86020000-0000-4000-8000-000000000003',
    1,
    'READING',
    'C2',
    'MULTIPLE_CHOICE',
    '{"prompt":"Choose the supported answer.","options":[{"id":"correct","label":"Correct"},{"id":"wrong","label":"Wrong"}]}'::jsonb,
    '{"optionId":"correct"}'::jsonb,
    null
  ),
  (
    '86030000-0000-4000-8000-000000000005',
    '86020000-0000-4000-8000-000000000004',
    1,
    'VOCABULARY',
    'A1',
    'MULTIPLE_CHOICE',
    '{"prompt":"Draft only.","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}'::jsonb,
    '{"optionId":"a"}'::jsonb,
    null
  )
on conflict (id) do nothing;

update public.assessment_versions
set status = 'PUBLISHED', published_at = '2026-10-01T18:00:00Z'
where id in (
  '86020000-0000-4000-8000-000000000001',
  '86020000-0000-4000-8000-000000000002',
  '86020000-0000-4000-8000-000000000003'
)
  and status = 'DRAFT';

set role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-4000-8000-000000000001","aal":"aal1"}',
  false
);

do $$
declare
  first_attempt public.assessment_attempts;
  retried_attempt public.assessment_attempts;
  completed_attempt public.assessment_attempts;
  retried_completion public.assessment_attempts;
  objective_attempt public.assessment_attempts;
  objective_completion public.assessment_attempts;
  persisted_count integer;
  rejected boolean;
begin
  first_attempt := public.start_assessment_attempt(
    '86020000-0000-4000-8000-000000000001',
    '86040000-0000-4000-8000-000000000001'
  );
  retried_attempt := public.start_assessment_attempt(
    '86020000-0000-4000-8000-000000000001',
    '86040000-0000-4000-8000-000000000001'
  );

  if first_attempt.id <> retried_attempt.id then
    raise exception 'Assessment start retry must return the same attempt';
  end if;

  select count(*) into persisted_count
  from public.assessment_attempts
  where user_id = '86000000-0000-4000-8000-000000000001'
    and idempotency_key = '86040000-0000-4000-8000-000000000001';
  if persisted_count <> 1 then
    raise exception 'Assessment start retry created a duplicate attempt';
  end if;

  rejected := false;
  begin
    perform public.start_assessment_attempt(
      '86020000-0000-4000-8000-000000000002',
      '86040000-0000-4000-8000-000000000001'
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'One idempotency key must not migrate to another AssessmentVersion';
  end if;

  rejected := false;
  begin
    perform public.start_assessment_attempt(
      '86020000-0000-4000-8000-000000000004',
      '86040000-0000-4000-8000-000000000004'
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'A DRAFT AssessmentVersion must not start an attempt';
  end if;

  perform public.record_assessment_response(
    first_attempt.id,
    '86030000-0000-4000-8000-000000000001',
    '{"optionId":"work"}'::jsonb
  );
  perform public.record_assessment_response(
    first_attempt.id,
    '86030000-0000-4000-8000-000000000002',
    '{"text":"A response that remains pending manual evaluation."}'::jsonb
  );

  rejected := false;
  begin
    perform public.record_assessment_response(
      first_attempt.id,
      '86030000-0000-4000-8000-000000000003',
      '{"optionId":"a"}'::jsonb
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'An item from another AssessmentVersion must be rejected';
  end if;

  completed_attempt := public.complete_assessment_attempt(first_attempt.id);
  retried_completion := public.complete_assessment_attempt(first_attempt.id);

  if completed_attempt.id <> retried_completion.id
    or completed_attempt.submitted_at is distinct from retried_completion.submitted_at then
    raise exception 'Assessment completion retry must return persisted completion state';
  end if;

  if completed_attempt.status <> 'SUBMITTED'
    or completed_attempt.result_cefr is not null
    or completed_attempt.raw_score is not null then
    raise exception 'Pending manual evaluation must remain SUBMITTED without final raw/CEFR result';
  end if;

  select count(*) into persisted_count
  from public.skill_scores
  where assessment_attempt_id = first_attempt.id
    and skill = 'GRAMMAR'
    and score = 1
    and max_score = 1
    and cefr_level is null;
  if persisted_count <> 1 then
    raise exception 'Objective Grammar SkillScore must be persisted exactly once';
  end if;

  select count(*) into persisted_count
  from public.skill_scores
  where assessment_attempt_id = first_attempt.id
    and skill = 'SPEAKING';
  if persisted_count <> 0 then
    raise exception 'Pending Speaking must not create a fake SkillScore';
  end if;

  select count(*) into persisted_count
  from public.skill_scores
  where assessment_attempt_id = first_attempt.id;
  if persisted_count <> 1 then
    raise exception 'Completion retry must not duplicate SkillScores';
  end if;

  objective_attempt := public.start_assessment_attempt(
    '86020000-0000-4000-8000-000000000003',
    '86040000-0000-4000-8000-000000000003'
  );
  perform public.record_assessment_response(
    objective_attempt.id,
    '86030000-0000-4000-8000-000000000004',
    '{"optionId":"correct"}'::jsonb
  );
  objective_completion := public.complete_assessment_attempt(objective_attempt.id);

  if objective_completion.status <> 'SCORED'
    or objective_completion.raw_score <> 1
    or objective_completion.result_cefr is not null then
    raise exception 'Objective-only completion must be SCORED while CEFR remains NULL';
  end if;

  select count(*) into persisted_count
  from public.skill_scores
  where assessment_attempt_id = objective_attempt.id
    and score = 1
    and max_score = 1
    and cefr_level is null;
  if persisted_count <> 1 then
    raise exception 'Perfect objective score must still have NULL CEFR';
  end if;

  perform public.track_product_event(
    'assessment_started',
    null,
    jsonb_build_object('assessment_version_id', first_attempt.assessment_version_id),
    'assessment_started:' || first_attempt.id
  );
  perform public.track_product_event(
    'assessment_started',
    null,
    jsonb_build_object('assessment_version_id', first_attempt.assessment_version_id),
    'assessment_started:' || first_attempt.id
  );
  perform public.track_product_event(
    'assessment_completed',
    null,
    jsonb_build_object('assessment_version_id', first_attempt.assessment_version_id),
    'assessment_completed:' || first_attempt.id
  );
  perform public.track_product_event(
    'assessment_completed',
    null,
    jsonb_build_object('assessment_version_id', first_attempt.assessment_version_id),
    'assessment_completed:' || first_attempt.id
  );

  perform set_config('app.p19_attempt_id', first_attempt.id::text, false);
  perform set_config('app.p19_objective_attempt_id', objective_attempt.id::text, false);
end;
$$;

do $$
declare
  blocked boolean := false;
begin
  begin
    perform answer_key
    from public.assessment_items
    where id = '86030000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    blocked := true;
  end;

  if not blocked then
    raise exception 'Student authenticated access must not expose assessment_items.answer_key';
  end if;
end;
$$;

do $$
declare
  blocked boolean := false;
begin
  begin
    perform scoring_config
    from public.assessment_versions
    where id = '86020000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    blocked := true;
  end;

  if not blocked then
    raise exception 'Student authenticated access must not expose assessment_versions.scoring_config';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000002', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"86000000-0000-4000-8000-000000000002","aal":"aal1"}',
  false
);

do $$
declare
  visible_count integer;
  foreign_attempt_id uuid := current_setting('app.p19_attempt_id')::uuid;
  own_attempt public.assessment_attempts;
  rejected boolean;
begin
  select count(*) into visible_count
  from public.assessment_attempts
  where user_id = '86000000-0000-4000-8000-000000000001';
  if visible_count <> 0 then
    raise exception 'Student B must not read Student A Assessment attempts';
  end if;

  select count(*) into visible_count
  from public.assessment_responses
  where assessment_attempt_id = foreign_attempt_id;
  if visible_count <> 0 then
    raise exception 'Student B must not read Student A Assessment responses';
  end if;

  select count(*) into visible_count
  from public.skill_scores
  where assessment_attempt_id = foreign_attempt_id;
  if visible_count <> 0 then
    raise exception 'Student B must not read Student A SkillScores';
  end if;

  rejected := false;
  begin
    perform public.record_assessment_response(
      foreign_attempt_id,
      '86030000-0000-4000-8000-000000000001',
      '{"optionId":"work"}'::jsonb
    );
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Student B must not write Student A Assessment response';
  end if;

  rejected := false;
  begin
    perform public.complete_assessment_attempt(foreign_attempt_id);
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Student B must not complete Student A Assessment attempt';
  end if;

  own_attempt := public.start_assessment_attempt(
    '86020000-0000-4000-8000-000000000002',
    '86040000-0000-4000-8000-000000000102'
  );
  if own_attempt.user_id <> '86000000-0000-4000-8000-000000000002' then
    raise exception 'Assessment start must derive the authenticated user';
  end if;

  rejected := false;
  begin
    insert into public.assessment_attempts (
      user_id,
      assessment_version_id,
      idempotency_key
    )
    values (
      '86000000-0000-4000-8000-000000000001',
      '86020000-0000-4000-8000-000000000002',
      '86040000-0000-4000-8000-000000000199'
    );
  exception when insufficient_privilege then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Authenticated Student must not directly insert an attempt for another user';
  end if;
end;
$$;

reset role;

do $$
declare
  attempt_id uuid := current_setting('app.p19_attempt_id')::uuid;
  analytics_count integer;
  blocked boolean;
begin
  if has_column_privilege(
    'authenticated',
    'public.assessment_items',
    'answer_key',
    'SELECT'
  ) then
    raise exception 'authenticated must not have SELECT on assessment_items.answer_key';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.assessment_items',
    'rubric',
    'SELECT'
  ) then
    raise exception 'authenticated must not have SELECT on assessment_items.rubric';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.assessment_versions',
    'scoring_config',
    'SELECT'
  ) then
    raise exception 'authenticated must not have SELECT on assessment_versions.scoring_config';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.assessment_items',
    'prompt',
    'SELECT'
  ) then
    raise exception 'authenticated must retain safe Assessment prompt access';
  end if;

  if has_table_privilege('authenticated', 'public.assessment_attempts', 'INSERT')
    or has_table_privilege('authenticated', 'public.assessment_attempts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.assessment_responses', 'INSERT')
    or has_table_privilege('authenticated', 'public.assessment_responses', 'UPDATE')
    or has_table_privilege('authenticated', 'public.skill_scores', 'INSERT')
    or has_table_privilege('authenticated', 'public.skill_scores', 'UPDATE') then
    raise exception 'Assessment writes must stay behind authenticated RPCs';
  end if;

  blocked := false;
  begin
    update public.assessment_attempts
    set assessment_version_id = '86020000-0000-4000-8000-000000000002'
    where id = attempt_id;
  exception when object_not_in_prerequisite_state then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Assessment attempt version must remain frozen';
  end if;

  blocked := false;
  begin
    update public.assessment_versions
    set specification = '{"mutated":true}'::jsonb
    where id = '86020000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Published/used AssessmentVersion must remain immutable';
  end if;

  blocked := false;
  begin
    update public.assessment_items
    set prompt = '{"prompt":"mutated"}'::jsonb
    where id = '86030000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Published/used AssessmentItem must remain immutable';
  end if;

  blocked := false;
  begin
    update public.assessment_responses
    set response = '{"optionId":"works"}'::jsonb
    where assessment_attempt_id = attempt_id
      and assessment_item_id = '86030000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Submitted Assessment responses must remain immutable';
  end if;

  if exists (
    select 1
    from public.assessment_attempts
    where user_id in (
      '86000000-0000-4000-8000-000000000001',
      '86000000-0000-4000-8000-000000000002'
    )
      and result_cefr is not null
  ) then
    raise exception 'Assessment Engine V1 must not persist result_cefr';
  end if;

  if exists (
    select 1
    from public.skill_scores score
    join public.assessment_attempts attempt on attempt.id = score.assessment_attempt_id
    where attempt.user_id in (
      '86000000-0000-4000-8000-000000000001',
      '86000000-0000-4000-8000-000000000002'
    )
      and score.cefr_level is not null
  ) then
    raise exception 'Assessment Engine V1 must not persist SkillScore CEFR';
  end if;

  select count(*) into analytics_count
  from public.product_analytics_events
  where user_id = '86000000-0000-4000-8000-000000000001'
    and idempotency_key in (
      'assessment_started:' || attempt_id,
      'assessment_completed:' || attempt_id
    );
  if analytics_count <> 2 then
    raise exception 'Assessment started/completed analytics must be logically idempotent';
  end if;

  if has_function_privilege(
    'anon',
    'public.start_assessment_attempt(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.record_assessment_response(uuid,uuid,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.complete_assessment_attempt(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role must not execute Assessment lifecycle RPCs';
  end if;
end;
$$;

rollback;
