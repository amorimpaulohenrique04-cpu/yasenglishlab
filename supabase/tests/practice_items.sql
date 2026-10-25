-- Lesson-bound v3 practices: provisional answers, one atomic final submission, seven response types.
-- Transactional fixture; no permanent rows or mocked authorization.
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if not coalesce(value, false) then raise exception 'practice_items: %', message; end if; end $$;
create function pg_temp.login(n integer, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.u(n)::text, true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'aal', aal)::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k = $1 $$;

insert into auth.users(id,email) select pg_temp.u(n),'pi-'||n||'@example.test' from generate_series(1,5) n;
insert into public.user_roles(user_id,role) select pg_temp.u(n),case when n in (4,5) then 'TEACHER' else 'STUDENT' end from generate_series(1,5) n;
insert into public.profiles(user_id,display_name) select pg_temp.u(n),'PI User '||n from generate_series(1,5) n on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.teachers(id,user_id) values
 ('e1100000-0000-4000-8000-000000000004',pg_temp.u(4)),('e1100000-0000-4000-8000-000000000005',pg_temp.u(5));
insert into public.courses(id,slug,title,active,publication_status,published_at) values
 ('e1200000-0000-4000-8000-000000000001','pi-course-1','PI Course 1',true,'PUBLISHED',now()),
 ('e1200000-0000-4000-8000-000000000002','pi-course-2','PI Course 2',true,'PUBLISHED',now());
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('e1400000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','PI K1','pi-k1','ACTIVE',now()-interval '1 day');
insert into public.cohort_teachers(cohort_id,teacher_id) values ('e1400000-0000-4000-8000-000000000001','e1100000-0000-4000-8000-000000000004');
insert into public.enrollments(id,user_id,course_id,status) values
 ('e1300000-0000-4000-8000-000000000001',pg_temp.u(1),'e1200000-0000-4000-8000-000000000001','ACTIVE'),
 ('e1300000-0000-4000-8000-000000000002',pg_temp.u(2),'e1200000-0000-4000-8000-000000000001','ACTIVE');
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id) values
 ('e1400000-0000-4000-8000-000000000001',pg_temp.u(1),'e1300000-0000-4000-8000-000000000001'),
 ('e1400000-0000-4000-8000-000000000001',pg_temp.u(2),'e1300000-0000-4000-8000-000000000002');
insert into public.complimentary_access_grants(user_id,reason,note) select pg_temp.u(n),'ADMIN_GRANT','fixture' from generate_series(1,2) n;
insert into public.modules(id,course_id,position,title,publication_status,published_at) values
 ('e1210000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001',1,'PI Module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,title,slug,publication_status,published_at) values
 ('e1220000-0000-4000-8000-000000000001','e1210000-0000-4000-8000-000000000001',1,'PI Lesson','pi-lesson','DRAFT',null);
insert into public.lesson_assets(lesson_id,asset_type,position,content,publication_status,published_at) values
 ('e1220000-0000-4000-8000-000000000001','TEXT',1,'{"title":"Lesson","body":"Read"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id='e1220000-0000-4000-8000-000000000001';
insert into public.cohort_paths(cohort_id,mode,sequential) values('e1400000-0000-4000-8000-000000000001','DEFAULT',true);

create function pg_temp.q(n text) returns jsonb language sql immutable as $$
 select case n
  when 'q1' then '{"id":"q1","prompt":"Pick","weight":3,"stimulus":{"type":"NONE"},"response":{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"right"},{"id":"b","label":"wrong"}]}}'
  when 'q2' then '{"id":"q2","prompt":"Pick many","stimulus":{"type":"NONE"},"response":{"type":"CHOICE_MULTI","options":[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]}}'
  when 'q3' then '{"id":"q3","prompt":"True?","stimulus":{"type":"NONE"},"response":{"type":"TRUE_FALSE","statement":"True?"}}'
  when 'q4' then '{"id":"q4","prompt":"Complete","stimulus":{"type":"NONE"},"response":{"type":"CLOZE","text":"I {{1}} here."}}'
  when 'q5' then '{"id":"q5","prompt":"Order","stimulus":{"type":"NONE"},"response":{"type":"ORDERING","items":[{"id":"w1","label":"I"},{"id":"w2","label":"am"},{"id":"w3","label":"here"}]}}'
  when 'w1' then '{"id":"w1","prompt":"Write","stimulus":{"type":"NONE"},"response":{"type":"WRITTEN"}}'
  when 's1' then '{"id":"s1","prompt":"Speak","stimulus":{"type":"NONE"},"response":{"type":"SPOKEN"}}'
 end::jsonb;
$$;
create function pg_temp.content(variadic names text[]) returns jsonb language sql as $$
 select jsonb_build_object('version',3,'objective','Practice seven types','askConfidence',true,'items',(select jsonb_agg(pg_temp.q(n)) from unnest(names) n));
$$;
create function pg_temp.keys() returns jsonb language sql as $$
 select '{"q1":{"answerKey":{"optionId":"a"},"feedback":{"incorrect":"Try the base verb."}},"q2":{"answerKey":{"optionIds":["a","c"]}},"q3":{"answerKey":{"value":true}},"q4":{"answerKey":{"blanks":[{"id":"1","accepted":["am"]}]}},"q5":{"answerKey":{"order":["w1","w2","w3"]}},"w1":{},"s1":{}}'::jsonb;
$$;
create function pg_temp.payload(content jsonb) returns jsonb language sql as $$
 select jsonb_build_object('title','PI lesson practice','skill','GRAMMAR','estimated_minutes',5,
  'course_id','e1200000-0000-4000-8000-000000000001','related_module_id','e1210000-0000-4000-8000-000000000001',
  'related_lesson_id','e1220000-0000-4000-8000-000000000001','content',content);
$$;
create function pg_temp.fit(content jsonb) returns jsonb language sql as $$
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from jsonb_each(pg_temp.keys()) e
 where e.key in (select i->>'id' from jsonb_array_elements(content->'items') i);
$$;
create function pg_temp.make(k text,content jsonb) returns void language plpgsql as $$
declare p uuid;
begin
 p:=public.teacher_practice_save_v3(null,pg_temp.payload(content),pg_temp.fit(content));
 insert into ids values(k,p);
 perform public.teacher_practice_publish(p);
end $$;

-- Drafts are lenient; publication enforces a complete lesson-bound activity and answer keys.
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.make('obj',pg_temp.content('q1','q2','q3','q4','q5'));
select pg_temp.make('mixed',pg_temp.content('q1','w1','s1'));
select pg_temp.ok((public.teacher_practice_get(pg_temp.id('mixed'))#>>'{content,evaluationMode}')='MANUAL_PENDING','mixed evaluation mode');
insert into ids select 'incomplete',public.teacher_practice_save_v3(null,pg_temp.payload(jsonb_set(pg_temp.content('q1'),'{objective}','""')),pg_temp.fit(pg_temp.content('q1')));
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_publish(%L)',pg_temp.id('incomplete')))='23514','incomplete draft cannot publish');
insert into ids select 'no_key',public.teacher_practice_save_v3(null,pg_temp.payload(pg_temp.content('q1')),'{}'::jsonb);
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_publish(%L)',pg_temp.id('no_key')))='23514','objective key required at publication');
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_publish(public.teacher_practice_save_v3(null,%L::jsonb,%L::jsonb))',pg_temp.payload(pg_temp.content('q1'))-'related_lesson_id',pg_temp.fit(pg_temp.content('q1'))))='23514','publication requires lesson link');
reset role;
select pg_temp.login(5,'aal2'); set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.teacher_practice_get(%L)',pg_temp.id('obj')))='42501','other Teacher cannot read keys');
reset role;

-- All five objective types grade in one final transaction. Invalid saved drafts disclose nothing.
select pg_temp.login(1); set local role authenticated;
insert into ids select 'attempt',(public.start_practice_attempt(pg_temp.id('obj'),gen_random_uuid())).id;
select pg_temp.ok((public.practice_answers_get(pg_temp.id('attempt'))->'answers')='{}'::jsonb,'empty provisional draft');
select public.practice_answers_save(pg_temp.id('attempt'),'{"q1":{"response":{"optionId":"b"},"confidence":"HIGH"}}');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('attempt')),'saving one answer does not grade');
select pg_temp.ok(pg_temp.state(format('select public.practice_submit_final(%L)',pg_temp.id('attempt')))='23514','incomplete final rejected');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('attempt')),'failed final rolls back grading');
select pg_temp.ok(pg_temp.state(format('select public.submit_practice_item(%L,''q1'',1::smallint,''{"optionId":"a"}''::jsonb)',pg_temp.id('attempt')))='23514','old item endpoint cannot disclose feedback');
select public.practice_answers_save(pg_temp.id('attempt'),'{"q1":{"response":{"optionId":"a"},"confidence":"LOW"},"q2":{"response":{"optionIds":["a","c"]},"confidence":null},"q3":{"response":{"value":false},"confidence":"HIGH"},"q4":{"response":{"blanks":{"1":"am"}},"confidence":null},"q5":{"response":{"order":["w1","w2","w3"]},"confidence":null}}');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('attempt')),'complete draft remains ungraded');
select pg_temp.ok((select r->>'score'='6' and r->>'maxScore'='7' and r#>>'{metrics,firstTryCorrect}'='4' and r#>>'{metrics,recovered}'='0' and r#>>'{metrics,highConfidenceErrors}'='1' from (select public.practice_submit_final(pg_temp.id('attempt')) r) x),'weighted objective grade and question count');
select pg_temp.ok((select count(*)=5 and bool_and(round=1) from public.practice_item_responses where practice_attempt_id=pg_temp.id('attempt')),'all five response types have one final row');
select pg_temp.ok((select r->>'canRetry'='false' and r#>>'{correctAnswer,value}'='true' from jsonb_array_elements(public.practice_submit_final(pg_temp.id('attempt'))->'results') r where r->>'itemId'='q3'),'key appears only after final and no retry');
select pg_temp.ok((public.practice_submit_final(pg_temp.id('attempt'))->>'score')='6' and (select count(*)=5 from public.practice_item_responses where practice_attempt_id=pg_temp.id('attempt')),'repeated final request is idempotent');
select pg_temp.ok(pg_temp.state(format('select public.practice_answers_save(%L,%L::jsonb)',pg_temp.id('attempt'),'{}'))='23514','submitted draft immutable');
select pg_temp.ok(pg_temp.state('update public.practice_item_responses set evaluation_status=''CORRECT''')='42501','Student cannot rewrite graded rows');
select pg_temp.ok((public.start_practice_attempt(pg_temp.id('obj'),gen_random_uuid())).id=pg_temp.id('attempt'),'one final attempt per learner and practice');
reset role;
select pg_temp.login(2); set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.practice_answers_get(%L)',pg_temp.id('attempt')))='42501','other Student cannot read draft');
select pg_temp.ok(pg_temp.state(format('select public.practice_submit_final(%L)',pg_temp.id('attempt')))='42501','other Student cannot submit');
reset role;
select pg_temp.login(3); set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.start_practice_attempt(%L,gen_random_uuid())',pg_temp.id('obj')))<>'OK','Student without lesson access cannot start');
reset role;

-- Malformed answers are accepted as provisional data, but the final operation rejects them atomically.
select pg_temp.login(2); set local role authenticated;
insert into ids select 'bad',(public.start_practice_attempt(pg_temp.id('obj'),gen_random_uuid())).id;
select public.practice_answers_save(pg_temp.id('bad'),'{"q1":{"response":{"optionId":"unknown"},"confidence":null},"q2":{"response":{"optionIds":["a","c"]},"confidence":null},"q3":{"response":{"value":true},"confidence":null},"q4":{"response":{"blanks":{"1":"am"}},"confidence":null},"q5":{"response":{"order":["w1","w2","w3"]},"confidence":null}}');
select pg_temp.ok(pg_temp.state(format('select public.practice_submit_final(%L)',pg_temp.id('bad')))='23514','invalid choice rejected at final');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('bad')),'malformed final leaves no partial result');
select public.practice_answers_save(pg_temp.id('bad'),'{"q1":{"response":{"optionId":"a"},"confidence":null},"q2":{"response":{"optionIds":["a","c"]},"confidence":null},"q3":{"response":{"value":true},"confidence":null},"q4":{"response":{"blanks":{"1":5}},"confidence":null},"q5":{"response":{"order":["w1","w2","w3"]},"confidence":null}}');
select pg_temp.ok(pg_temp.state(format('select public.practice_submit_final(%L)',pg_temp.id('bad')))='23514','malformed cloze rejected at final');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('bad')),'second malformed final remains atomic');
reset role;

-- Mixed objective, written and spoken answers remain pending human review; audio must be READY.
select pg_temp.login(1); set local role authenticated;
insert into ids select 'mixed_attempt',(public.start_practice_attempt(pg_temp.id('mixed'),gen_random_uuid())).id;
insert into ids select 'media',public.reserve_practice_audio(pg_temp.id('mixed_attempt'),'audio/webm','s1');
select public.practice_answers_save(pg_temp.id('mixed_attempt'),jsonb_build_object('q1',jsonb_build_object('response','{"optionId":"a"}'::jsonb,'confidence',null),'w1',jsonb_build_object('response','{"text":"Two good sentences."}'::jsonb,'confidence',null),'s1',jsonb_build_object('response',jsonb_build_object('mediaId',pg_temp.id('media')),'confidence',null)));
select pg_temp.ok(pg_temp.state(format('select public.practice_submit_final(%L)',pg_temp.id('mixed_attempt')))='23514','unvalidated audio rejected');
select pg_temp.ok((select count(*)=0 from public.practice_item_responses where practice_attempt_id=pg_temp.id('mixed_attempt')),'audio failure leaves no objective result');
reset role;
update public.practice_response_media set upload_status='READY' where id=pg_temp.id('media');
select pg_temp.login(1); set local role authenticated;
select pg_temp.ok((select r->>'evaluationStatus'='PENDING_MANUAL' and r->>'score'='3' and r#>>'{metrics,pendingManual}'='2' from (select public.practice_submit_final(pg_temp.id('mixed_attempt')) r) x),'mixed final retains objective points and manual queue');
reset role;
select pg_temp.ok((select upload_status='SUBMITTED' from public.practice_response_media where id=pg_temp.id('media')),'validated audio submitted atomically');
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.ok((select count(*)=2 from public.get_teacher_reviews() r where r->>'id'=pg_temp.id('mixed_attempt')::text and r->>'itemId' in ('w1','s1')),'both manual items appear in Teacher queue');
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_review(%L,%L::jsonb,%L,%L,%L)',pg_temp.id('mixed_attempt'),'{}','x','v1','q1'))='23514','objective item cannot receive manual review');
reset role;
select pg_temp.login(5,'aal2'); set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_review(%L,%L::jsonb,%L,%L,%L)',pg_temp.id('mixed_attempt'),'{}','x','v1','w1'))='42501','unrelated Teacher cannot review');
reset role;
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_review(%L,%L::jsonb,%L,%L,%L)',pg_temp.id('mixed_attempt'),'{"task_completion":"SOLID","comprehensibility":"STRONG","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID"}','Written feedback','v1','w1'))='OK','Teacher reviews written item');
select pg_temp.ok((select evaluation_status='PENDING_MANUAL' from public.practice_results where practice_attempt_id=pg_temp.id('mixed_attempt')),'one manual item still pending');
select pg_temp.ok(pg_temp.state(format('select public.finalize_practice_review(%L,%L::jsonb,%L,%L,%L)',pg_temp.id('mixed_attempt'),'{"task_completion":"SOLID","comprehensibility":"SOLID","fluency":"SOLID","language_accuracy":"SOLID","vocabulary_use":"SOLID","pronunciation_intelligibility":"SOLID"}','Spoken feedback','v1','s1'))='OK','Teacher reviews spoken item');
select pg_temp.ok((select evaluation_status='MANUAL_REVIEWED' and score=3 and max_score=3 from public.practice_results where practice_attempt_id=pg_temp.id('mixed_attempt')),'manual review preserves objective score');
reset role;
select pg_temp.ok((select count(*)=0 from public.practice_item_schedules where last_attempt_id in (pg_temp.id('attempt'),pg_temp.id('mixed_attempt'))),'final submission creates no spaced schedule');
rollback;
