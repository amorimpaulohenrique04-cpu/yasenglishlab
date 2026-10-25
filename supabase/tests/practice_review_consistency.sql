-- Practice v3 review consistency (R01-R05): Student feed PENDING -> PARTIAL -> REVIEWED with one row per attempt,
-- full read-only question context for the Teacher, mixed-kind filters and a queue paginated by attempt.
-- Transactional fixture through the real authoring/submission RPCs; no mocked authorization.
begin;
create function pg_temp.u(n integer) returns uuid language sql immutable as $$
  select ('e2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.ok(value boolean, message text) returns void language plpgsql as $$
begin if not coalesce(value, false) then raise exception 'practice_review_consistency: %', message; end if; end $$;
create function pg_temp.login(n integer, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.u(n)::text, true),
         set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'aal', aal)::text, true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end $$;
create temp table ids(k text primary key, id uuid);
grant all on ids to authenticated, anon;
create function pg_temp.id(k text) returns uuid language sql as $$ select id from ids where k = $1 $$;

-- Students 1-3 and 100-200 share one cohort taught by Teacher 4; Teacher 5 has no assignment.
insert into auth.users(id,email) select pg_temp.u(n),'prc-'||n||'@example.test' from (select generate_series(1,5) union all select generate_series(100,200)) s(n);
insert into public.user_roles(user_id,role) select pg_temp.u(n),case when n in (4,5) then 'TEACHER' else 'STUDENT' end
  from (select generate_series(1,5) union all select generate_series(100,200)) s(n);
insert into public.profiles(user_id,display_name) select pg_temp.u(n),case when n=1 then 'Ána Beatriz' else 'PRC User '||n end
  from (select generate_series(1,5) union all select generate_series(100,200)) s(n)
  on conflict(user_id) do update set display_name=excluded.display_name;
insert into public.teachers(id,user_id) values
 ('e2100000-0000-4000-8000-000000000004',pg_temp.u(4)),('e2100000-0000-4000-8000-000000000005',pg_temp.u(5));
insert into public.courses(id,slug,title,active,publication_status,published_at) values
 ('e2200000-0000-4000-8000-000000000001','prc-course','PRC Course',true,'PUBLISHED',now());
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
 ('e2400000-0000-4000-8000-000000000001','e2200000-0000-4000-8000-000000000001','PRC K1','prc-k1','ACTIVE',now()-interval '10 days');
insert into public.cohort_teachers(cohort_id,teacher_id) values ('e2400000-0000-4000-8000-000000000001','e2100000-0000-4000-8000-000000000004');
insert into public.enrollments(id,user_id,course_id,status)
  select ('e2300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,pg_temp.u(n),'e2200000-0000-4000-8000-000000000001','ACTIVE'
  from (select generate_series(1,3) union all select generate_series(100,200)) s(n);
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id)
  select 'e2400000-0000-4000-8000-000000000001',pg_temp.u(n),('e2300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
  from (select generate_series(1,3) union all select generate_series(100,200)) s(n);
insert into public.complimentary_access_grants(user_id,reason,note)
  select pg_temp.u(n),'ADMIN_GRANT','fixture' from (select generate_series(1,3) union all select generate_series(100,200)) s(n);
insert into public.modules(id,course_id,position,title,publication_status,published_at) values
 ('e2210000-0000-4000-8000-000000000001','e2200000-0000-4000-8000-000000000001',1,'PRC Module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,title,slug,publication_status,published_at) values
 ('e2220000-0000-4000-8000-000000000001','e2210000-0000-4000-8000-000000000001',1,'PRC Lesson','prc-lesson','DRAFT',null);
insert into public.lesson_assets(lesson_id,asset_type,position,content,publication_status,published_at) values
 ('e2220000-0000-4000-8000-000000000001','TEXT',1,'{"title":"Lesson","body":"Read"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id='e2220000-0000-4000-8000-000000000001';
insert into public.cohort_paths(cohort_id,mode,sequential) values('e2400000-0000-4000-8000-000000000001','DEFAULT',true);

create function pg_temp.q(n text) returns jsonb language sql immutable as $$
 select case
  when n='q1' then '{"id":"q1","prompt":"Pick","stimulus":{"type":"NONE"},"response":{"type":"CHOICE_SINGLE","options":[{"id":"a","label":"right"},{"id":"b","label":"wrong"}]}}'
  when n='q3' then '{"id":"q3","prompt":"True?","stimulus":{"type":"NONE"},"response":{"type":"TRUE_FALSE","statement":"True?"}}'
  when n='s1' then '{"id":"s1","prompt":"Speak","stimulus":{"type":"NONE"},"response":{"type":"SPOKEN"}}'
  else jsonb_build_object('id',n,'prompt','Write '||n,'stimulus','{"type":"NONE"}'::jsonb,'response','{"type":"WRITTEN"}'::jsonb)
 end::jsonb;
$$;
create function pg_temp.make(k text, variadic names text[]) returns void language plpgsql as $$
declare p uuid; content jsonb; keys jsonb;
begin
 content:=jsonb_build_object('version',3,'objective','Review consistency','askConfidence',false,
   'items',(select jsonb_agg(pg_temp.q(n) order by o) from unnest(names) with ordinality t(n,o)));
 keys:=(select jsonb_object_agg(n,case n when 'q1' then '{"answerKey":{"optionId":"a"},"feedback":{"incorrect":"Secret explanation."}}'::jsonb
                                         when 'q3' then '{"answerKey":{"value":true}}'::jsonb else '{}'::jsonb end) from unnest(names) n);
 p:=public.teacher_practice_save_v3(null,jsonb_build_object('title','PRC '||k,'skill','GRAMMAR','estimated_minutes',5,
   'course_id','e2200000-0000-4000-8000-000000000001','related_module_id','e2210000-0000-4000-8000-000000000001',
   'related_lesson_id','e2220000-0000-4000-8000-000000000001','content',content),keys);
 insert into ids values(k,p);
 perform public.teacher_practice_publish(p);
end $$;
-- Student n answers every item of practice k (objective items correctly) and submits once.
create function pg_temp.complete(n integer, k text, attempt_key text) returns void language plpgsql as $$
declare a uuid; answers jsonb := '{}'::jsonb; it record; media uuid;
begin
 perform pg_temp.login(n);
 a:=(public.start_practice_attempt(pg_temp.id(k),gen_random_uuid())).id;
 insert into ids values(attempt_key,a);
 for it in select i->>'id' as id,i#>>'{response,type}' as t from public.practice_activities x,jsonb_array_elements(x.content->'items') i where x.id=pg_temp.id(k) loop
  if it.t='SPOKEN' then
   media:=public.reserve_practice_audio(a,'audio/webm',it.id);
   update public.practice_response_media set upload_status='READY',duration_seconds=12 where id=media;
   answers:=answers||jsonb_build_object(it.id,jsonb_build_object('response',jsonb_build_object('mediaId',media),'confidence',null));
  elsif it.t='WRITTEN' then
   answers:=answers||jsonb_build_object(it.id,jsonb_build_object('response',jsonb_build_object('text','Answer to '||it.id),'confidence',null));
  elsif it.id='q1' then answers:=answers||'{"q1":{"response":{"optionId":"a"},"confidence":null}}';
  else answers:=answers||'{"q3":{"response":{"value":true},"confidence":null}}';
  end if;
 end loop;
 perform public.practice_answers_save(a,answers);
 perform public.practice_submit_final(a);
end $$;
create function pg_temp.review(k text, item text, feedback text) returns text language sql as $$
 select pg_temp.state(format('select public.finalize_practice_review(%L,%L::jsonb,%L,%L,%L)',pg_temp.id(k),
   case when item like 's%' then '{"task_completion":"SOLID","comprehensibility":"SOLID","fluency":"SOLID","language_accuracy":"SOLID","vocabulary_use":"SOLID","pronunciation_intelligibility":"SOLID"}'
        else '{"task_completion":"SOLID","comprehensibility":"STRONG","language_accuracy":"DEVELOPING","vocabulary_use":"SOLID"}' end,
   feedback,'v1',item));
$$;
create function pg_temp.feed(k text) returns setof record language sql as $$
 select status,manual_total,manual_reviewed,manual_pending from public.list_student_feedbacks(50,0) where entity_id=pg_temp.id(k);
$$;
create function pg_temp.entry(page jsonb, k text) returns jsonb language sql as $$
 select e from jsonb_array_elements(page->'entries') e where e->>'id'=pg_temp.id(k)::text;
$$;
-- Walks every page of a filter; returns the ids seen, the page count and whether every entry carried all its items.
create function pg_temp.walk(filters jsonb) returns jsonb language plpgsql as $$
declare page jsonb; f jsonb := filters; seen jsonb := '[]'::jsonb; complete boolean := true; pages integer := 0;
begin
 loop
  page:=public.get_teacher_review_queue_page(f);
  seen:=seen||coalesce((select jsonb_agg(e->'id' order by o) from jsonb_array_elements(page->'entries') with ordinality t(e,o)),'[]'::jsonb);
  complete:=complete and not exists(select 1 from jsonb_array_elements(page->'entries') e
    where jsonb_array_length(e->'items')<>(e->>'pendingItems')::integer);
  pages:=pages+1;
  exit when not (page->>'hasMore')::boolean or pages>100;
  f:=f||jsonb_build_object('after',page->'nextCursor');
 end loop;
 return jsonb_build_object('ids',seen,'pages',pages,'complete',complete,'filteredTotal',page->'filteredTotal','total',page->'total');
end $$;

select pg_temp.login(4,'aal2');
select pg_temp.make('five','q1','w1','s1','q3','w2');
select pg_temp.make('spoken_first','s1','w1');
select pg_temp.make('obj','q1','q3');
select pg_temp.make('twenty',variadic (select array_agg('w'||lpad(n::text,2,'0') order by n) from generate_series(1,20) n));
select pg_temp.make('bulk','w1');

select pg_temp.complete(1,'five','a_five');
select pg_temp.complete(1,'obj','a_obj');
select pg_temp.complete(2,'spoken_first','a_sf');
select pg_temp.complete(3,'twenty','a_twenty');
select pg_temp.complete(n,'bulk','a_bulk_'||n) from generate_series(100,200) n;
-- Distinct submission times: bulk attempts spread over minutes; ten of them older than 24h.
update public.practice_attempts t set submitted_at=now()-make_interval(mins=>(300-s.n))
  from (select generate_series(111,200) n) s, ids where ids.k='a_bulk_'||s.n and ids.id=t.id;
update public.practice_attempts t set submitted_at=now()-interval '2 days'-make_interval(mins=>s.n)
  from (select generate_series(100,110) n) s, ids where ids.k='a_bulk_'||s.n and ids.id=t.id;
update public.practice_attempts set submitted_at=now()-interval '3 days' where id=pg_temp.id('a_five');

-- Submission keeps the objective score; manual answers wait. 100% objective never reaches the queue or the feed.
select pg_temp.ok((select evaluation_status='PENDING_MANUAL' and score=2 and max_score=2 from public.practice_results where practice_attempt_id=pg_temp.id('a_five')),'mixed attempt pending with objective points');
select pg_temp.ok((select count(*)=5 from public.practice_item_responses where practice_attempt_id=pg_temp.id('a_five') and round=1),'five answers persisted');
select pg_temp.ok((select evaluation_status<>'PENDING_MANUAL' from public.practice_results where practice_attempt_id=pg_temp.id('a_obj')),'objective attempt is graded automatically');

-- R01: feed starts PENDING 0/3, one row per attempt; the objective attempt is absent.
select pg_temp.login(1); set local role authenticated;
select pg_temp.ok((select status='PENDING' and manual_total=3 and manual_reviewed=0 and manual_pending=3 from pg_temp.feed('a_five') f(status text,manual_total integer,manual_reviewed integer,manual_pending integer)),'feed PENDING 0/3');
select pg_temp.ok((select count(*)=1 and max(total)=1 from public.list_student_feedbacks(50,0)),'one feed entity, total counts entities');
select pg_temp.ok(not exists(select 1 from public.list_student_feedbacks(50,0) where entity_id=pg_temp.id('a_obj')),'objective attempt has no feedback row');
reset role;

-- R03: the assigned Teacher sees all five questions in order, no private key; only WRITTEN/SPOKEN are manual.
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.ok((select string_agg(q->>'itemId',',' order by o)='q1,w1,s1,q3,w2' and string_agg(q->>'position',',' order by o)='1,2,3,4,5'
  from jsonb_array_elements(public.get_teacher_review_context(pg_temp.id('a_five'))->'questions') with ordinality t(q,o)),'five questions in original order');
select pg_temp.ok((select string_agg(q->>'itemId',',' order by q->>'itemId') from jsonb_array_elements(public.get_teacher_review_context(pg_temp.id('a_five'))->'questions') q where (q->>'manual')::boolean)='s1,w1,w2','only open answers are manual');
select pg_temp.ok((select q->>'evaluationStatus'='CORRECT' and q#>>'{response,optionId}'='a' and q#>>'{definition,options,0,label}'='right' from jsonb_array_elements(public.get_teacher_review_context(pg_temp.id('a_five'))->'questions') q where q->>'itemId'='q1'),'objective answer and persisted evaluation are read-only context');
select pg_temp.ok((select (q->>'mediaDurationSeconds')::integer=12 from jsonb_array_elements(public.get_teacher_review_context(pg_temp.id('a_five'))->'questions') q where q->>'itemId'='s1'),'per-question audio length');
select pg_temp.ok(public.get_teacher_review_context(pg_temp.id('a_five'))::text !~ 'answerKey|answer_key|correctAnswer|Secret explanation|storage_path|"score"','context exposes no key, explanation, storage path or score');
select pg_temp.ok(jsonb_array_length(public.get_teacher_review_context(pg_temp.id('a_twenty'))->'questions')=20,'twenty questions projected');

-- R04/R05: one queue entry for the mixed attempt, its three answers in order, in both the writing and speaking tabs.
select pg_temp.ok((select (e->>'pendingItems')::integer=3 and e->'kinds'='["speaking","writing"]'::jsonb
  and (select string_agg(i->>'itemId',',' order by o) from jsonb_array_elements(e->'items') with ordinality t(i,o))='w1,s1,w2'
  from pg_temp.entry(public.get_teacher_review_queue_page('{"limit":50}'),'a_five') e),'one entry with three pending answers');
select pg_temp.ok((select e->'kinds'='["speaking","writing"]'::jsonb from pg_temp.entry(public.get_teacher_review_queue_page('{"limit":50,"order":"newest"}'),'a_sf') e),'kinds do not depend on item order');
select pg_temp.ok(pg_temp.entry(public.get_teacher_review_queue_page('{"tab":"writing","limit":50}'),'a_five') is not null
  and pg_temp.entry(public.get_teacher_review_queue_page('{"tab":"speaking","limit":50}'),'a_five') is not null
  and pg_temp.entry(public.get_teacher_review_queue_page('{"tab":"speaking","limit":50}'),'a_sf') is not null
  and pg_temp.entry(public.get_teacher_review_queue_page('{"tab":"pronunciation","limit":50}'),'a_five') is null,'mixed attempt is in each matching tab');
select pg_temp.ok((select (p->>'total')::integer=104 and (p#>>'{counts,all}')::integer=104 and (p#>>'{counts,writing}')::integer=104
  and (p#>>'{counts,speaking}')::integer=2 and (p#>>'{counts,over24h}')::integer=12 and p->>'oldestSubmittedAt' is not null
  and p->'cohorts'='["PRC K1"]'::jsonb from public.get_teacher_review_queue_page('{}') p),'counts cover the whole scope; tabs may sum above total');
select pg_temp.ok((select (e->>'pendingItems')::integer=20 and jsonb_array_length(e->'items')=20 and e#>>'{items,0,itemId}'='w01' and e#>>'{items,19,itemId}'='w20'
  from pg_temp.entry(public.get_teacher_review_queue_page('{"limit":50,"order":"newest"}'),'a_twenty') e),'twenty-item attempt arrives whole');

-- Pagination by attempt: 104 attempts (and 126 open answers) reachable, none repeated, none split.
select pg_temp.ok((select count(*)=100 from public.get_teacher_reviews(null) r),'fixture exceeds the unpaginated 100-row read (126 open answers)');
select pg_temp.ok((select jsonb_array_length(w->'ids')=104 and (select count(distinct x) from jsonb_array_elements_text(w->'ids') x)=104
  and (w->>'complete')::boolean and (w->>'pages')::integer=6 from pg_temp.walk('{"limit":20}') w),'oldest-first pages reach every attempt once');
select pg_temp.ok((select jsonb_array_length(w->'ids')=104 and (w->>'complete')::boolean from pg_temp.walk('{"limit":7}') w),'small pages keep attempts whole');
select pg_temp.ok((select (select array_agg(x order by o) from jsonb_array_elements_text(a->'ids') with ordinality t(x,o))
  =(select array_agg(x order by o desc) from jsonb_array_elements_text(b->'ids') with ordinality t(x,o))
  from pg_temp.walk('{"limit":20}') a, pg_temp.walk('{"limit":20,"order":"newest"}') b),'newest is the exact reverse of oldest');
select pg_temp.ok((select bool_and(prev_at<=t.submitted_at) from (
  select a.submitted_at, lag(a.submitted_at,1,'-infinity') over (order by o) prev_at
  from jsonb_array_elements_text((pg_temp.walk('{"limit":20}'))->'ids') with ordinality x(id,o)
  join public.practice_attempts a on a.id=x.id::uuid) t),'oldest-first order follows submission time');
select pg_temp.ok((select jsonb_array_length(w->'ids')=12 and (w->>'filteredTotal')::integer=12 from pg_temp.walk('{"tab":"over24h","limit":5}') w),'tab filter is applied before pagination');
select pg_temp.ok((select jsonb_array_length(w->'ids')=2 from pg_temp.walk('{"tab":"speaking","limit":1}') w),'speaking tab pages mixed attempts');
select pg_temp.ok((select jsonb_array_length(w->'ids')=1 and w->'ids'->>0=pg_temp.id('a_five')::text from pg_temp.walk('{"q":"ANA beatriz"}') w),'search ignores case and accents');
select pg_temp.ok((select jsonb_array_length(w->'ids')=0 from pg_temp.walk('{"cohort":"Other cohort"}') w),'cohort filter applies in SQL');
select pg_temp.ok(pg_temp.state('select public.get_teacher_review_queue_page(''{"tab":"bogus"}'')')='22023','unknown tab rejected');
select pg_temp.ok(pg_temp.state('select public.get_teacher_review_queue_page(''{"limit":51}'')')='22023','page size capped at 50');
select pg_temp.ok(pg_temp.state('select public.get_teacher_review_queue_page(''{"limit":0}'')')='22023','page size at least 1');
select pg_temp.ok(pg_temp.state('select public.get_teacher_review_queue_page(''{"after":{"submittedAt":"x","id":"y"}}'')')='22023','malformed cursor rejected');
select pg_temp.ok((select (p->>'position')::integer=1 and (p->>'total')::integer=104 and p->>'prev' is null and p->>'next' is not null
  from public.get_teacher_review_queue_position(pg_temp.id('a_five')) p),'oldest attempt is first in queue position');
reset role;

-- An unassigned Teacher reads nothing: no queue, no context (objective or audio), no position.
select pg_temp.login(5,'aal2'); set local role authenticated;
select pg_temp.ok((select (p->>'total')::integer=0 and p->'entries'='[]'::jsonb from public.get_teacher_review_queue_page('{}') p),'unassigned Teacher queue is empty');
select pg_temp.ok(public.get_teacher_review_context(pg_temp.id('a_five')) is null,'unassigned Teacher gets no questions');
select pg_temp.ok((select (p->>'total')::integer=0 and p->>'next' is null from public.get_teacher_review_queue_position(pg_temp.id('a_five')) p),'unassigned Teacher has no position');
select pg_temp.ok(pg_temp.review('a_five','w1','Not mine')='42501','unassigned Teacher cannot review');
reset role;
select pg_temp.login(1,'aal1'); set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.get_teacher_review_queue_page(''{}'')')='42501','Student cannot read the queue');
select pg_temp.ok(pg_temp.state(format('select public.get_teacher_review_context(%L)',pg_temp.id('a_five')))='42501','Student cannot read the Teacher context');
reset role;
select pg_temp.login(4,'aal1'); set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.get_teacher_review_queue_page(''{}'')')='42501','Teacher without AAL2 cannot read the queue');
reset role;

-- First review: the attempt stays pending with two answers left; the Student sees PARTIAL 1/3 and one row.
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.ok(pg_temp.review('a_five','w1','First written feedback')='OK','first open answer reviewed');
select pg_temp.ok(pg_temp.review('a_five','w1','First written feedback')='OK','identical retry is idempotent');
select pg_temp.ok(pg_temp.review('a_five','w1','Overwrite attempt')='23505','second different review is rejected');
select pg_temp.ok(pg_temp.review('a_five','q1','Objective')='23514','objective answer cannot be reviewed');
select pg_temp.ok((select (e->>'pendingItems')::integer=2 and (select string_agg(i->>'itemId',',' order by o) from jsonb_array_elements(e->'items') with ordinality t(i,o))='s1,w2'
  from pg_temp.entry(public.get_teacher_review_queue_page('{"limit":50}'),'a_five') e),'queue keeps the attempt with the two open answers left');
select pg_temp.ok((select (q->>'reviewed')::boolean from jsonb_array_elements(public.get_teacher_review_context(pg_temp.id('a_five'))->'questions') q where q->>'itemId'='w1'),'context marks the reviewed question');
reset role;
select pg_temp.ok((select count(*)=1 and min(feedback)='First written feedback' from public.practice_manual_reviews where practice_attempt_id=pg_temp.id('a_five')),'one review row, never overwritten');
select pg_temp.ok((select evaluation_status='PENDING_MANUAL' from public.practice_results where practice_attempt_id=pg_temp.id('a_five')),'attempt still pending after the first review');
select pg_temp.ok((select count(*)=0 from public.notifications where user_id=pg_temp.u(1) and notification_type='PRACTICE_FEEDBACK_READY'),'no completion notification yet');
select pg_temp.login(1); set local role authenticated;
select pg_temp.ok((select status='PARTIAL' and manual_total=3 and manual_reviewed=1 and manual_pending=2 from pg_temp.feed('a_five') f(status text,manual_total integer,manual_reviewed integer,manual_pending integer)),'feed PARTIAL 1/3');
select pg_temp.ok((select count(*)=1 and max(total)=1 from public.list_student_feedbacks(50,0)),'still one feed entity');
select pg_temp.ok((select notes is null and details is null from public.list_student_feedbacks(50,0) where entity_id=pg_temp.id('a_five')),'v3 comments are not flattened into the feed row');
select pg_temp.ok((select count(*)=1 and min(item_id)='w1' from public.practice_manual_reviews where practice_attempt_id=pg_temp.id('a_five')),'Student reads the comment of the reviewed item only');
reset role;

-- Second and third reviews: PARTIAL 2/3, then REVIEWED 3/3 with one notification and the objective score intact.
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.ok(pg_temp.review('a_five','s1','Spoken feedback')='OK','spoken answer reviewed');
reset role;
select pg_temp.login(1); set local role authenticated;
select pg_temp.ok((select status='PARTIAL' and manual_reviewed=2 and manual_pending=1 from pg_temp.feed('a_five') f(status text,manual_total integer,manual_reviewed integer,manual_pending integer)),'feed PARTIAL 2/3');
reset role;
select pg_temp.login(4,'aal2'); set local role authenticated;
select pg_temp.ok(pg_temp.review('a_five','w2','Second written feedback')='OK','last open answer reviewed');
select pg_temp.ok(pg_temp.entry(public.get_teacher_review_queue_page('{"limit":50}'),'a_five') is null,'reviewed attempt leaves the queue');
select pg_temp.ok((select (p->>'total')::integer=103 from public.get_teacher_review_queue_page('{}') p),'queue total follows the review');
select pg_temp.ok((select p->>'position' is null and p->>'next' is not null and p->>'next'<>pg_temp.id('a_five')::text
  from public.get_teacher_review_queue_position(pg_temp.id('a_five')) p),'reviewed attempt points to the next pending attempt');
reset role;
select pg_temp.ok((select evaluation_status='MANUAL_REVIEWED' and score=2 and max_score=2 from public.practice_results where practice_attempt_id=pg_temp.id('a_five')),'closed with the objective score intact');
select pg_temp.ok((select count(*)=1 from public.notifications where user_id=pg_temp.u(1) and notification_type='PRACTICE_FEEDBACK_READY'),'exactly one completion notification');
select pg_temp.login(1); set local role authenticated;
select pg_temp.ok((select status='REVIEWED' and manual_total=3 and manual_reviewed=3 and manual_pending=0 from pg_temp.feed('a_five') f(status text,manual_total integer,manual_reviewed integer,manual_pending integer)),'feed REVIEWED 3/3');
select pg_temp.ok((select count(*)=1 and max(total)=1 from public.list_student_feedbacks(50,0)),'one feed row after three comments');
select pg_temp.ok((select string_agg(item_id,',' order by item_id)='s1,w1,w2' from public.practice_manual_reviews where practice_attempt_id=pg_temp.id('a_five')),'three comments, one per item');
reset role;
select pg_temp.login(2); set local role authenticated;
select pg_temp.ok(not exists(select 1 from public.list_student_feedbacks(50,0) where entity_id=pg_temp.id('a_five')),'other Student never sees the attempt');
select pg_temp.ok((select status='PENDING' and manual_total=2 from pg_temp.feed('a_sf') f(status text,manual_total integer,manual_reviewed integer,manual_pending integer)),'other Student sees only their own pending attempt');
reset role;

-- New read models are callable only by signed-in users; the helpers stay internal.
do $$
begin
  if has_function_privilege('anon','public.get_teacher_review_queue_page(jsonb)','EXECUTE')
     or has_function_privilege('anon','public.get_teacher_review_queue_position(uuid)','EXECUTE')
     or has_function_privilege('anon','public.list_student_feedbacks(integer,integer)','EXECUTE') then
    raise exception 'practice_review_consistency: anon can execute a review read model';
  end if;
  if not has_function_privilege('authenticated','public.get_teacher_review_queue_page(jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.list_student_feedbacks(integer,integer)','EXECUTE') then
    raise exception 'practice_review_consistency: authenticated cannot execute a review read model';
  end if;
  if has_function_privilege('authenticated','private.teacher_review_pending_items()','EXECUTE') then
    raise exception 'practice_review_consistency: pending items helper must stay internal';
  end if;
end $$;
rollback;
