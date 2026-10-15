-- Stage 12 / Block B (database): Admin authoring of the entry (placement) assessment (ADR 0021).
-- Plain psql, transactional: everything rolls back. Allow AND deny cases per chokepoint.
--   Users (prefix b3000000): 01 ADMIN | 02 TEACHER | 03 STUDENT S1 | 04 STUDENT S2
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'assessment_authoring: %', message; end if; end $$;
create function pg_temp.login(u uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
-- SQLSTATE raised by the statement, or 'OK'.
create function pg_temp.state_of(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
-- SQLSTATE:message raised by the statement, or 'OK'.
create function pg_temp.attempt(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('b3000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid;
$$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k = $1 $$;

-- Content builders ----------------------------------------------------------------------------------------------
create function pg_temp.two() returns jsonb language sql as $$ select '[{"id":"a","label":"A"},{"id":"b","label":"B"}]'::jsonb $$;
create function pg_temp.mc(prompt text, opts jsonb, key text default null, skill text default 'GRAMMAR') returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('skill', skill, 'item_type', 'MULTIPLE_CHOICE', 'cefr_target', 'A1',
    'prompt', jsonb_build_object('prompt', prompt, 'options', opts),
    'answer_key', case when key is null then null else jsonb_build_object('optionId', key) end));
$$;
create function pg_temp.manual(prompt text, skill text default 'SPEAKING') returns jsonb language sql as $$
  select jsonb_build_object('skill', skill, 'item_type', 'MANUAL_TEXT',
    'prompt', jsonb_build_object('prompt', prompt, 'instructions', 'Write a short answer'),
    'rubric', jsonb_build_object('instructions', 'Review by a Teacher; no automated CEFR'));
$$;
create function pg_temp.good() returns jsonb language sql as $$
  select jsonb_build_array(pg_temp.mc('Choose the correct sentence.', pg_temp.two(), 'a'), pg_temp.manual('Describe your day.'));
$$;
-- Creates a draft (as the current Admin) and records ids k_a / k_v.
create function pg_temp.draft(k text, items jsonb, title text default 'AA fixture') returns void language plpgsql as $$
declare r jsonb;
begin
  r := public.admin_assessment_save_draft(null, null, jsonb_build_object('title', title, 'purpose', 'Synthetic; no CEFR', 'items', items));
  insert into ids values (k || '_a', (r->>'assessmentId')::uuid), (k || '_v', (r->>'versionId')::uuid);
end $$;
-- The six RPCs, each must be denied (42501) to the current identity.
create function pg_temp.deny_all(label text) returns void language plpgsql as $$
declare q text;
begin
  foreach q in array array[
    'select public.admin_assessment_list()',
    'select public.admin_assessment_get(gen_random_uuid())',
    'select public.admin_assessment_save_draft(null, null, ''{"title":"x","purpose":"y"}''::jsonb)',
    'select public.admin_assessment_publish(gen_random_uuid())',
    'select public.admin_assessment_new_version(gen_random_uuid())',
    'select public.admin_assessment_retire(gen_random_uuid())'] loop
    if pg_temp.state_of(q) <> '42501' then raise exception 'assessment_authoring: % must be denied: %', label, q; end if;
  end loop;
end $$;

-- Fixtures ------------------------------------------------------------------------------------------------------
insert into auth.users(id,email) select pg_temp.u(n), 'aa-' || n || '@example.test' from generate_series(1, 4) n;
insert into public.user_roles(user_id,role)
select pg_temp.u(n), case when n = 1 then 'ADMIN' when n = 2 then 'TEACHER' else 'STUDENT' end from generate_series(1, 4) n;
insert into public.teachers(id,user_id) values ('b3100000-0000-4000-8000-000000000002', pg_temp.u(2));
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status)
select pg_temp.u(n), '10000000-0000-0000-0000-000000000001', 'test', 'aa-sub-' || n, 'ACTIVE' from generate_series(3, 4) n;
-- Isolate from whatever the database already holds: no entry assessment flagged at the start.
update public.assessments set is_placement = false where is_placement;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Authorization matrix (deny): anon, Admin AAL1, Teacher, Student
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.logout();
set local role anon;
select pg_temp.deny_all('anon');
reset role;
select pg_temp.login(pg_temp.u(1), 'aal1');
set local role authenticated;
select pg_temp.deny_all('Admin at aal1');
reset role;
select pg_temp.login(pg_temp.u(2), 'aal2');
set local role authenticated;
select pg_temp.deny_all('Teacher at aal2');
reset role;
select pg_temp.login(pg_temp.u(3), 'aal2');
set local role authenticated;
select pg_temp.deny_all('Student at aal2');
select pg_temp.assert_true(pg_temp.state_of('insert into public.assessments(slug,title,purpose) values (''x'',''x'',''x'')')='42501','Student cannot insert assessments directly');
select pg_temp.assert_true(pg_temp.state_of('update public.assessments set is_placement = true')='42501','Student cannot flag the entry assessment directly');
reset role;
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of('update public.assessments set is_placement = true')='42501','Admin cannot flag the entry assessment with direct DML either');
select pg_temp.assert_true(pg_temp.state_of('insert into public.assessment_items(assessment_version_id,position,skill,item_type,prompt) values (gen_random_uuid(),1,''GRAMMAR'',''MANUAL_TEXT'',''{}''::jsonb)')='42501','Admin has no direct DML on items');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Admin AAL2: create, read (with answer key and rubric), shape hygiene
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.draft('a1', pg_temp.good(), 'Entry test A');
select pg_temp.assert_true((select r->>'status' = 'DRAFT' from (select public.admin_assessment_get(pg_temp.id('a1_a'))->'version' r) x),'new assessment starts with a DRAFT version');
select pg_temp.assert_true(exists(select 1 from public.admin_assessment_list() r where (r->>'id')::uuid = pg_temp.id('a1_a') and r->>'isPlacement' = 'false' and r->>'active' = 'true' and jsonb_array_length(r->'versions') = 1),'list shows the new assessment, not flagged as entry');
select pg_temp.assert_true((select jsonb_array_length(v->'items') = 2
  and v->'items'->0->'answerKey'->>'optionId' = 'a'
  and v->'items'->1->'rubric'->>'instructions' is not null
  and (v->'items'->0->>'position')::int = 1 and (v->'items'->1->>'position')::int = 2
  from (select public.admin_assessment_get(pg_temp.id('a1_a'))->'version' v) x),'get returns items with answer key and rubric, in array order');
-- Hygiene (deny): shape errors are 23514, payload errors 22023.
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), '{"nope":1}'))='22023','unknown payload field rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), '{"items":"x"}'))='23514','items must be an array');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(jsonb_build_object('skill','GRAMMAR','item_type','ORDERING','prompt','{"prompt":"x"}'::jsonb)))))='23514','unsupported item type rejected at save');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(pg_temp.manual('x') || '{"position":1}'))))='23514','client position rejected (order is array order)');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(jsonb_set(pg_temp.manual('x'), '{prompt,options}', pg_temp.two())))))='23514','manual item cannot carry options');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(jsonb_set(pg_temp.manual('x'), '{answer_key}', '{"optionId":"a"}')))))='23514','manual item cannot carry an answer key');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(jsonb_set(pg_temp.mc('x', pg_temp.two(), 'a'), '{answer_key}', '{"optionId":"a","leak":true}')))))='23514','answer key with extra keys rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(jsonb_set(pg_temp.mc('x', pg_temp.two(), 'a'), '{prompt,answerKey}', '"a"')))))='23514','prompt cannot smuggle an answer key');
select pg_temp.assert_true(pg_temp.state_of('select public.admin_assessment_save_draft(null, null, ''{"title":"x"}''::jsonb)')='23514','purpose required on create');
select pg_temp.assert_true(pg_temp.state_of('select public.admin_assessment_save_draft(null, null, ''{"title":"x","purpose":"y","slug":"Bad Slug!"}''::jsonb)')='23514','invalid slug rejected');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), '{"slug":"another-slug"}'))='23514','slug is immutable');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, %L, %L::jsonb)', pg_temp.id('a1_a'), gen_random_uuid(), '{"title":"x"}'))='42501','foreign version id rejected');
-- Save replaces the items atomically; a rejected save leaves them intact.
select public.admin_assessment_save_draft(pg_temp.id('a1_a'), null,
  jsonb_build_object('title','Entry test A (edited)','items', pg_temp.good() || jsonb_build_array(pg_temp.mc('Third', pg_temp.two(), 'b'))));
select pg_temp.assert_true((select jsonb_array_length(v->'items') = 3 and (select title from public.assessments where id = pg_temp.id('a1_a')) = 'Entry test A (edited)' from (select public.admin_assessment_get(pg_temp.id('a1_a'))->'version' v) x),'draft edit replaces items and updates metadata');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), jsonb_build_object('items', jsonb_build_array(pg_temp.manual('ok'), '{"skill":"BAD"}'::jsonb))))='23514','invalid second item rejects the whole save');
select pg_temp.assert_true((select jsonb_array_length(v->'items') = 3 from (select public.admin_assessment_get(pg_temp.id('a1_a'))->'version' v) x),'rejected save left the previous items intact');
select public.admin_assessment_save_draft(pg_temp.id('a1_a'), null, jsonb_build_object('items', pg_temp.good()));
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Publication contract: every rule of start_assessment_attempt fails closed at publish
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.draft('bad_none', '[]'::jsonb);
select pg_temp.draft('bad_one_option', jsonb_build_array(pg_temp.mc('Q', '[{"id":"a","label":"A"}]', 'a')));
select pg_temp.draft('bad_no_label', jsonb_build_array(pg_temp.mc('Q', '[{"id":"a","label":"A"},{"id":"b"}]', 'a')));
select pg_temp.draft('bad_blank_label', jsonb_build_array(pg_temp.mc('Q', '[{"id":"a","label":"A"},{"id":"b","label":"  "}]', 'a')));
select pg_temp.draft('bad_no_id', jsonb_build_array(pg_temp.mc('Q', '[{"id":"a","label":"A"},{"label":"B"}]', 'a')));
select pg_temp.draft('bad_dup_ids', jsonb_build_array(pg_temp.mc('Q', '[{"id":"a","label":"A"},{"id":"a","label":"B"}]', 'a')));
select pg_temp.draft('bad_no_key', jsonb_build_array(pg_temp.mc('Q', pg_temp.two())));
select pg_temp.draft('bad_key_missing', jsonb_build_array(pg_temp.mc('Q', pg_temp.two(), 'zzz')));
select pg_temp.draft('bad_speaking_mc', jsonb_build_array(pg_temp.mc('Q', pg_temp.two(), 'a', 'SPEAKING')));
select pg_temp.draft('bad_pron_mc', jsonb_build_array(pg_temp.mc('Q', pg_temp.two(), 'a', 'PRONUNCIATION')));
select pg_temp.draft('bad_blank_prompt', jsonb_build_array(pg_temp.manual('   ')));
select pg_temp.draft('bad_mc_blank_prompt', jsonb_build_array(pg_temp.mc('  ', pg_temp.two(), 'a')));
select pg_temp.draft('bad_mc_no_options', jsonb_build_array(jsonb_build_object('skill','GRAMMAR','item_type','MULTIPLE_CHOICE','prompt','{"prompt":"Q"}'::jsonb,'answer_key','{"optionId":"a"}'::jsonb)));
do $$
declare r record; res text;
begin
  for r in select * from (values
    ('bad_none', 'no executable items'),
    ('bad_one_option', 'at least two options'),
    ('bad_no_label', 'every option needs an id and a label'),
    ('bad_blank_label', 'every option needs an id and a label'),
    ('bad_no_id', 'every option needs an id and a label'),
    ('bad_dup_ids', 'option ids must be unique'),
    ('bad_no_key', 'answer key must reference an existing option'),
    ('bad_key_missing', 'answer key must reference an existing option'),
    ('bad_speaking_mc', 'Speaking and Pronunciation must be manual text'),
    ('bad_pron_mc', 'Speaking and Pronunciation must be manual text'),
    ('bad_blank_prompt', 'prompt text is required'),
    ('bad_mc_blank_prompt', 'prompt text is required'),
    ('bad_mc_no_options', 'at least two options')) t(k, expected) loop
    res := pg_temp.attempt(format('select public.admin_assessment_publish(%L)', (select id from ids where k = r.k || '_v')));
    if res not like '23514:%' or res not like '%' || r.expected || '%' then
      raise exception 'assessment_authoring: publish of % must fail with "%", got %', r.k, r.expected, res;
    end if;
    if (select status from public.assessment_versions where id = (select id from ids where k = r.k || '_v')) <> 'DRAFT' then
      raise exception 'assessment_authoring: % left the DRAFT state', r.k;
    end if;
  end loop;
end $$;
select pg_temp.assert_true(not exists(select 1 from public.assessments a join ids on ids.id = a.id where ids.k like 'bad\_%' and a.is_placement),'a rejected publication never flags the entry assessment');
-- Unknown version.
select pg_temp.assert_true(pg_temp.state_of('select public.admin_assessment_publish(gen_random_uuid())')='42501','unknown version cannot be published');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Valid publication, audit, parity with start_assessment_attempt, immutability afterwards
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select public.admin_assessment_publish(pg_temp.id('a1_v'), false, '{"request_id":"b3900000-0000-4000-8000-000000000001","environment":"test","version":"aa-1"}');
select pg_temp.assert_true((select status = 'PUBLISHED' and published_at is not null from public.assessment_versions where id = pg_temp.id('a1_v')),'valid version published');
select pg_temp.assert_true(not (select is_placement from public.assessments where id = pg_temp.id('a1_a')),'publishing without the flag does not make the entry assessment');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_publish(%L)', pg_temp.id('a1_v')))='23514','republishing is an invalid transition');
reset role;
-- Parity: a Student can actually start what was published.
select pg_temp.login(pg_temp.u(4), 'aal1');
set local role authenticated;
select pg_temp.assert_true((public.start_assessment_attempt(pg_temp.id('a1_v'), gen_random_uuid())).id is not null,'Student can start an attempt on a published version');
select pg_temp.assert_true(pg_temp.state_of('select answer_key from public.assessment_items')='42501','Student cannot read answer keys');
select pg_temp.assert_true(pg_temp.state_of('select rubric from public.assessment_items')='42501','Student cannot read rubrics');
select pg_temp.assert_true((select count(*) = 2 from public.assessment_items where assessment_version_id = pg_temp.id('a1_v')),'Student sees the published items (no keys)');
select pg_temp.assert_true((select count(*) = 0 from public.assessment_items where assessment_version_id = pg_temp.id('bad_one_option_v')),'Student never sees draft items');
reset role;
select pg_temp.assert_true(exists(select 1 from public.audit_logs where action = 'assessment_publication' and entity_type = 'assessment_versions' and entity_id = pg_temp.id('a1_v') and actor_user_id = pg_temp.u(1) and request_id = 'b3900000-0000-4000-8000-000000000001' and environment = 'test' and version = 'aa-1'),'publication is audited with actor and technical correlation');

-- Immutability after publication (deny): the RPC path and the owner-level path (existing triggers).
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, %L, %L::jsonb)', pg_temp.id('a1_a'), pg_temp.id('a1_v'), '{"title":"x"}'))='23514','published version cannot be edited through save_draft');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_save_draft(%L, null, %L::jsonb)', pg_temp.id('a1_a'), '{"title":"x"}'))='23514','no draft left: editing requires a new version');
reset role;
select pg_temp.assert_true(pg_temp.state_of(format('update public.assessment_items set prompt = ''{"prompt":"tampered"}'' where assessment_version_id = %L', pg_temp.id('a1_v')))='55000','items of a published version are immutable (trigger)');
select pg_temp.assert_true(pg_temp.state_of(format('delete from public.assessment_items where assessment_version_id = %L', pg_temp.id('a1_v')))='55000','items of a published version cannot be deleted (trigger)');
select pg_temp.assert_true(pg_temp.state_of(format('update public.assessment_versions set specification = ''{"x":1}'' where id = %L', pg_temp.id('a1_v')))='55000','published version content is immutable (trigger)');

-- ---------------------------------------------------------------------------------------------------------
-- 5. New version: clone to DRAFT (idempotent), publishing retires the previous one
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
insert into ids values ('a1_v2', (public.admin_assessment_new_version(pg_temp.id('a1_a'), '{"request_id":"b3900000-0000-4000-8000-000000000002"}')->>'versionId')::uuid);
select pg_temp.assert_true((select status = 'DRAFT' and version_number = 2 from public.assessment_versions where id = pg_temp.id('a1_v2')),'new version is a DRAFT numbered 2');
select pg_temp.assert_true((select jsonb_array_length(v->'items') = 2 and v->'items'->0->'answerKey'->>'optionId' = 'a' and v->'items'->1->'rubric' is not null from (select public.admin_assessment_get(pg_temp.id('a1_a'), pg_temp.id('a1_v2'))->'version' v) x),'clone carries items, answer key and rubric');
select pg_temp.assert_true((select (r->>'created')::boolean = false and (r->>'versionId')::uuid = pg_temp.id('a1_v2') from (select public.admin_assessment_new_version(pg_temp.id('a1_a')) r) x),'new_version is idempotent while a DRAFT exists');
select pg_temp.assert_true((select count(*) = 2 from public.assessment_versions where assessment_id = pg_temp.id('a1_a')),'no duplicate draft created');
select public.admin_assessment_save_draft(pg_temp.id('a1_a'), null, jsonb_build_object('items', pg_temp.good() || jsonb_build_array(pg_temp.mc('Third', pg_temp.two(), 'b'))));
select public.admin_assessment_publish(pg_temp.id('a1_v2'));
select pg_temp.assert_true((select status = 'RETIRED' from public.assessment_versions where id = pg_temp.id('a1_v')),'publishing retires the previous published version');
select pg_temp.assert_true((select status = 'PUBLISHED' from public.assessment_versions where id = pg_temp.id('a1_v2')),'new version published');
select pg_temp.assert_true((select count(*) = 1 from public.assessment_versions where assessment_id = pg_temp.id('a1_a') and status = 'PUBLISHED'),'exactly one published version per assessment');
select pg_temp.assert_true(exists(select 1 from public.admin_assessment_list() r where (r->>'id')::uuid = pg_temp.id('a1_a') and (r->'versions'->1->>'hasAttempts')::boolean and r->'versions'->1->>'status' = 'RETIRED'),'list reports attempts on the retired version');
reset role;
-- A Student in the middle of an attempt on the retired version can still finish it.
insert into ids select 'a1_v_item1', id from public.assessment_items where assessment_version_id = pg_temp.id('a1_v') and position = 1;
select pg_temp.login(pg_temp.u(4), 'aal1');
set local role authenticated;
select pg_temp.assert_true((public.record_assessment_response((select id from public.assessment_attempts where user_id = auth.uid()), pg_temp.id('a1_v_item1'), '{"optionId":"a"}')).id is not null,'in-flight attempt on a retired version keeps working');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Entry assessment: explicit flag, one active, ignores other published assessments
-- ---------------------------------------------------------------------------------------------------------
-- Student S1 reaches the assessment step of the onboarding.
select pg_temp.login(pg_temp.u(3), 'aal1');
set local role authenticated;
select public.begin_placement();
select public.save_placement_preferences('America/Recife', 1, 1080, 1260);
-- No entry assessment flagged: the onboarding fails closed even though a1 is published.
select pg_temp.assert_true(pg_temp.attempt('select public.start_placement_assessment()') like '23514:%published assessment unavailable%','no flagged entry assessment: onboarding fails closed');
reset role;
-- A different published assessment (newer published_at: the OLD rule would pick it).
insert into public.assessments(id,slug,title,purpose) values ('b3200000-0000-4000-8000-000000000003','aa-newer-other','Newer other','Synthetic');
insert into public.assessment_versions(id,assessment_id,version_number,status) values ('b3300000-0000-4000-8000-000000000003','b3200000-0000-4000-8000-000000000003',1,'DRAFT');
insert into public.assessment_items(assessment_version_id,position,skill,item_type,prompt,answer_key) values
  ('b3300000-0000-4000-8000-000000000003',1,'GRAMMAR','MULTIPLE_CHOICE','{"prompt":"Other","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]}','{"optionId":"a"}');
update public.assessment_versions set status = 'PUBLISHED', published_at = now() + interval '3 hours' where id = 'b3300000-0000-4000-8000-000000000003';
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.draft('b1', pg_temp.good(), 'Entry test B');
select public.admin_assessment_publish(pg_temp.id('b1_v'), true);
select pg_temp.assert_true((select is_placement from public.assessments where id = pg_temp.id('b1_a')),'publish with the flag makes B the entry assessment');
reset role;
select pg_temp.assert_true((select av.assessment_id = 'b3200000-0000-4000-8000-000000000003' from public.assessment_versions av join public.assessments x on x.id = av.assessment_id where av.status = 'PUBLISHED' and x.active and exists(select 1 from public.assessment_items i where i.assessment_version_id = av.id) order by av.published_at desc, av.id limit 1),'sanity: the old implicit rule would have picked the newer other assessment');
select pg_temp.login(pg_temp.u(3), 'aal1');
set local role authenticated;
insert into ids values ('s1_attempt', public.start_placement_assessment());
reset role;
select pg_temp.assert_true((select av.assessment_id = pg_temp.id('b1_a') from public.assessment_attempts t join public.assessment_versions av on av.id = t.assessment_version_id where t.id = pg_temp.id('s1_attempt')),'start_placement_assessment used the flagged assessment, not the newer published one');

-- Swap: making A the entry assessment unflags B atomically; the unique index backs the invariant.
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
insert into ids values ('a1_v3', (public.admin_assessment_new_version(pg_temp.id('a1_a'))->>'versionId')::uuid);
select public.admin_assessment_publish(pg_temp.id('a1_v3'), true);
reset role;
select pg_temp.assert_true((select count(*) = 1 from public.assessments where is_placement and active),'exactly one active entry assessment after the swap');
select pg_temp.assert_true((select is_placement from public.assessments where id = pg_temp.id('a1_a')) and not (select is_placement from public.assessments where id = pg_temp.id('b1_a')),'A is the entry assessment, B was unflagged');
select pg_temp.assert_true(pg_temp.state_of(format('update public.assessments set is_placement = true where id = %L', pg_temp.id('b1_a')))='23505','two active entry assessments are impossible (unique index)');
select pg_temp.assert_true(pg_temp.state_of(format('update public.assessments set is_placement = true, active = false where id = %L', pg_temp.id('b1_a')))='OK','an inactive assessment may keep the flag (index covers active only)');
update public.assessments set is_placement = false where id = pg_temp.id('b1_a');

-- ---------------------------------------------------------------------------------------------------------
-- 7. Retire: never the only published version of the entry assessment
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.login(pg_temp.u(1), 'aal2');
set local role authenticated;
select pg_temp.assert_true(pg_temp.attempt(format('select public.admin_assessment_retire(%L)', pg_temp.id('a1_v3'))) like '23514:%only published version of the entry assessment%','the only published version of the entry assessment cannot be retired');
select pg_temp.assert_true((select status = 'PUBLISHED' from public.assessment_versions where id = pg_temp.id('a1_v3')),'blocked retirement left the version published');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_retire(%L)', pg_temp.id('bad_none_v')))='23514','a DRAFT cannot be retired');
select pg_temp.assert_true(pg_temp.state_of(format('select public.admin_assessment_retire(%L)', pg_temp.id('a1_v')))='23514','an already retired version cannot be retired again');
select pg_temp.assert_true(pg_temp.state_of('select public.admin_assessment_retire(gen_random_uuid())')='42501','unknown version cannot be retired');
select public.admin_assessment_retire(pg_temp.id('b1_v'), '{"request_id":"b3900000-0000-4000-8000-000000000003"}');
select pg_temp.assert_true((select status = 'RETIRED' from public.assessment_versions where id = pg_temp.id('b1_v')),'a published version of a non-entry assessment can be retired');
reset role;
select pg_temp.assert_true(pg_temp.state_of(format('update public.assessment_versions set status = ''PUBLISHED'' where id = %L', pg_temp.id('a1_v')))='55000','a retired version cannot be republished (trigger)');

-- ---------------------------------------------------------------------------------------------------------
-- 8. Audit, catalog and privileges
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.assert_true((select count(distinct action) >= 5 from public.audit_logs where entity_type = 'assessment_versions' and action in ('assessment_created','assessment_draft_saved','assessment_publication','assessment_version_created','assessment_version_retired')),'all authoring actions are audited');
select pg_temp.assert_true(exists(select 1 from public.audit_logs where action = 'assessment_version_retired' and request_id = 'b3900000-0000-4000-8000-000000000003' and actor_user_id = pg_temp.u(1)),'retirement is audited with actor');
select pg_temp.assert_true(not exists(select 1 from public.audit_logs where entity_type = 'assessment_versions' and action like 'assessment\_%' and data::text ~* '(optionId|Choose the correct|Describe your day|instructions|rubric)'),'audit data carries no content, key or rubric');
do $$
declare f text; col text;
begin
  foreach f in array array[
    'public.admin_assessment_list()','public.admin_assessment_get(uuid,uuid)','public.admin_assessment_save_draft(uuid,uuid,jsonb,jsonb)',
    'public.admin_assessment_publish(uuid,boolean,jsonb)','public.admin_assessment_new_version(uuid,jsonb)','public.admin_assessment_retire(uuid,jsonb)',
    'public.start_placement_assessment()'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then raise exception 'assessment_authoring: anon can execute %', f; end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then raise exception 'assessment_authoring: authenticated cannot execute %', f; end if;
    if exists (select 1 from pg_proc p where p.oid = f::regprocedure and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))) then
      raise exception 'assessment_authoring: PUBLIC can execute %', f;
    end if;
  end loop;
  foreach f in array array['private.assessment_audit(text,text,uuid,jsonb,jsonb)','private.assessment_item_shape(jsonb)','private.validate_assessment_version(uuid)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE') then raise exception 'assessment_authoring: % must stay internal', f; end if;
  end loop;
  foreach col in array array['INSERT','UPDATE','DELETE'] loop
    if has_table_privilege('authenticated', 'public.assessments', col) or has_table_privilege('anon', 'public.assessments', col) then raise exception 'assessment_authoring: % granted on assessments', col; end if;
    if has_table_privilege('authenticated', 'public.assessment_versions', col) or has_table_privilege('authenticated', 'public.assessment_items', col) then raise exception 'assessment_authoring: % granted on versions/items', col; end if;
  end loop;
  if has_column_privilege('authenticated', 'public.assessment_items', 'answer_key', 'SELECT') or has_column_privilege('authenticated', 'public.assessment_items', 'rubric', 'SELECT')
     or has_column_privilege('authenticated', 'public.assessment_versions', 'scoring_config', 'SELECT') then
    raise exception 'assessment_authoring: scoring secrets readable by authenticated';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.assessments'::regclass) then raise exception 'assessment_authoring: RLS off on assessments'; end if;
end $$;

select pg_temp.logout();
rollback;
