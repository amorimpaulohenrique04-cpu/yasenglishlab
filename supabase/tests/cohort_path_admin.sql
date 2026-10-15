-- C2 / ADR 0022: independent transactional fixtures and real RPC boundaries.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('ce000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.ok(value boolean,message text) returns void language plpgsql as $$
begin if not coalesce(value,false) then raise exception 'cohort_path: %',message; end if; end;
$$;
create function pg_temp.login(n integer,aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),
    set_config('request.jwt.claims',json_build_object('sub',pg_temp.id(n),'aal',aal)::text,true);
$$;
create function pg_temp.state(q text) returns text language plpgsql as $$
begin execute q; return 'OK'; exception when others then return sqlstate; end;
$$;

-- 1 custom, 2 default, 3 no membership, 4 outsider, 5 admin, 6 teacher.
insert into auth.users(id,email) select pg_temp.id(n),'cp-'||n||'@example.test' from generate_series(1,6)n;
insert into public.user_roles(user_id,role) select pg_temp.id(n),
  case n when 5 then 'ADMIN' when 6 then 'TEACHER' else 'STUDENT' end from generate_series(1,6)n;
insert into public.courses(id,slug,title,active,publication_status,published_at) values
  (pg_temp.id(100),'cp-course','Path course',true,'PUBLISHED',now()),
  (pg_temp.id(101),'cp-other-course','Other course',true,'PUBLISHED',now());
insert into public.modules(id,course_id,position,title,publication_status,published_at) values
  (pg_temp.id(200),pg_temp.id(100),1,'Path module','PUBLISHED',now()),
  (pg_temp.id(201),pg_temp.id(101),1,'Other module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,slug,title,audience)
select pg_temp.id(300+n),pg_temp.id(200),n,'cp-lesson-'||n,'Path lesson '||n,
  case when n=3 then 'COHORTS' else 'COURSE' end from generate_series(1,4)n;
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at)
select pg_temp.id(400+n),pg_temp.id(300+n),'TEXT',1,'{"title":"Path","body":"Practice this lesson"}',
  'PUBLISHED',now() from generate_series(1,4)n;
update public.lessons set publication_status='PUBLISHED',published_at=now() where module_id=pg_temp.id(200);
insert into public.materials(id,title,material_type,lesson_id,external_url,audience,publication_status,published_at)
  values(pg_temp.id(800),'Exclusive worksheet','WORKSHEET',pg_temp.id(303),
    'https://example.test/path.pdf','COHORTS','PUBLISHED',now());
insert into public.practice_activities(id,slug,title,skill,estimated_minutes,content,active,
  related_lesson_id,course_id,audience)
  select pg_temp.id(900),'cp-practice','Exclusive practice',skill,estimated_minutes,content,true,
    pg_temp.id(303),pg_temp.id(100),'COHORTS' from public.practice_activities
    where id='83000000-0000-4000-8000-000000000001';
insert into private.practice_answer_keys(practice_activity_id,answer_key,feedback)
  select pg_temp.id(900),answer_key,feedback from private.practice_answer_keys
    where practice_activity_id='83000000-0000-4000-8000-000000000001';
update public.practice_activities set publication_status='PUBLISHED',published_at=now() where id=pg_temp.id(900);
insert into public.enrollments(id,user_id,course_id,status)
select pg_temp.id(500+n),pg_temp.id(n),pg_temp.id(case when n=4 then 101 else 100 end),'ACTIVE'
  from generate_series(1,4)n;
insert into public.cohorts(id,course_id,name,code,status,starts_at) values
  (pg_temp.id(601),pg_temp.id(100),'Custom','cp-custom','ACTIVE',now()),
  (pg_temp.id(602),pg_temp.id(100),'Default','cp-default','ACTIVE',now());
insert into public.cohort_memberships(id,cohort_id,user_id,enrollment_id)
select pg_temp.id(700+n),pg_temp.id(600+n),pg_temp.id(n),pg_temp.id(500+n) from generate_series(1,2)n;
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status)
select pg_temp.id(n),'10000000-0000-0000-0000-000000000003','test','cp-sub-'||n,'ACTIVE'
  from generate_series(1,4)n;

insert into public.lessons(id,module_id,position,slug,title)
  values(pg_temp.id(305),pg_temp.id(200),5,'cp-draft','Unpublished lesson');
insert into public.cohorts(id,course_id,name,code,status,starts_at)
  values(pg_temp.id(603),pg_temp.id(100),'Archived cohort','cp-archived','ARCHIVED',now());
insert into public.modules(id,course_id,position,title,audience,publication_status,published_at)
  values(pg_temp.id(202),pg_temp.id(100),2,'Exclusive module','COHORTS','PUBLISHED',now());
insert into public.lessons(id,module_id,position,slug,title)
  values(pg_temp.id(306),pg_temp.id(202),1,'cp-exclusive-module-lesson','Course lesson in exclusive module');
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at)
  values(pg_temp.id(406),pg_temp.id(306),'TEXT',1,'{"title":"Path","body":"Parent inclusion"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id=pg_temp.id(306);
insert into public.entitlements(key,description,unit) values('c2_restricted_material','C2 restricted material','BOOLEAN');
insert into public.materials(id,title,material_type,lesson_id,storage_path,audience,
  required_entitlement_key,publication_status,published_at)
  values(pg_temp.id(801),'Restricted worksheet','WORKSHEET',pg_temp.id(303),'c2/restricted.pdf',
    'COHORTS','c2_restricted_material','PUBLISHED',now());
create function pg_temp.item(kind text,n integer,pos integer,release_at timestamptz default null)
returns jsonb language sql as $$
  select jsonb_build_object('contentKind',kind,'contentId',pg_temp.id(n),'position',pos,'availableFrom',release_at);
$$;
create function pg_temp.path(first_lesson integer,second_lesson integer default null,release_at timestamptz default null)
returns jsonb language sql as $$
  select jsonb_build_array(pg_temp.item('modules',200,0),pg_temp.item('lessons',first_lesson,1,release_at))
    || case when second_lesson is null then '[]'::jsonb
      else jsonb_build_array(pg_temp.item('lessons',second_lesson,2)) end;
$$;
create function pg_temp.item_state(n integer) returns text language sql as $$
  select i->>'state' from jsonb_array_elements(public.get_student_learning_path(pg_temp.id(100))->'items') i
    where i->>'contentId'=pg_temp.id(n)::text;
$$;
create temp table snapshots(k text primary key,v jsonb);
grant all on snapshots to authenticated;

select pg_temp.login(5,'aal1');
set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.admin_cohort_path_get(pg_temp.id(601))')='42501','admin AAL1 get denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false)$q$)='42501',
  'admin AAL1 save denied');
reset role;
select pg_temp.login(6,'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.admin_cohort_path_get(pg_temp.id(601))')='42501','teacher get denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false)$q$)='42501',
  'teacher save denied');
reset role;
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.admin_cohort_path_get(pg_temp.id(601))')='42501','student admin get denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false)$q$)='42501',
  'student admin save denied');
select pg_temp.ok((public.get_student_learning_path(pg_temp.id(100))->'paths'->0->>'mode')='DEFAULT',
  'no saved path returns default for own cohort');
select pg_temp.ok(jsonb_array_length(public.get_student_learning_path(pg_temp.id(100))->'items')=4,
  'default returns one module and three published COURSE lessons');
reset role;

select pg_temp.login(5,'aal2');
set local role authenticated;
select pg_temp.ok((public.admin_cohort_path_get(pg_temp.id(601))->>'mode')='DEFAULT','admin reads implicit default');
select pg_temp.ok(jsonb_array_length(public.admin_cohort_path_get(pg_temp.id(601))->'items')=0,'implicit default has no overrides');
select pg_temp.ok(exists(select 1 from jsonb_array_elements(public.admin_cohort_path_get(pg_temp.id(601))->'catalog') i
  where i->>'contentId'=pg_temp.id(305)::text and i->>'publicationStatus'='DRAFT'),'admin catalog includes drafts');
select pg_temp.ok(pg_temp.state('select public.admin_cohort_path_get(pg_temp.id(999))')='P0002','missing cohort denied');
select pg_temp.ok(public.admin_cohort_path_get(pg_temp.id(603))->>'mode'='DEFAULT','archived cohort can be inspected');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(603),'DEFAULT',false)$q$)='23514',
  'archived cohort cannot be changed');
select public.admin_cohort_path_save(pg_temp.id(602),'DEFAULT',false,
  jsonb_build_array(pg_temp.item('modules',202,0)));
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok(pg_temp.item_state(306)='AVAILABLE','default includes COURSE child of explicitly included exclusive module');
reset role;
select pg_temp.login(5,'aal2');
set local role authenticated;
insert into snapshots values('custom',public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',true,
  pg_temp.path(303,301,now()+interval '1 day') || jsonb_build_array(
    pg_temp.item('materials',800,3),pg_temp.item('practice_activities',900,4),pg_temp.item('materials',801,5)),false,
  '{"request_id":"ce000000-0000-4000-8000-000000000999","environment":"test","version":"c2"}'));
select pg_temp.ok((select v->>'mode'='CUSTOM' and (v->>'sequential')::boolean from snapshots where k='custom'),
  'save returns custom configuration');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'OTHER',false)$q$)='23514','bad mode denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',null)$q$)='23514','null sequential denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,'{}')$q$)='23514','nonarray denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  jsonb_build_array(pg_temp.item('modules',200,0)||'{"answerKey":"injected"}'))$q$)='23514','unknown fields denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  jsonb_build_array(pg_temp.item('lessons',301,0)))$q$)='23514','parent required before mutation');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  jsonb_build_array(pg_temp.item('modules',201,0)))$q$)='23514','other course denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  pg_temp.path(301)||jsonb_build_array(pg_temp.item('lessons',301,2)))$q$)='23514','duplicate item denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  pg_temp.path(301)||jsonb_build_array(pg_temp.item('lessons',302,1)))$q$)='23514','duplicate position denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  jsonb_build_array(pg_temp.item('modules',200,0)||'{"position":1.5}'))$q$)='23514','fractional position denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  jsonb_build_array(pg_temp.item('modules',200,0)||'{"availableFrom":"infinity"}'))$q$)='23514','infinite date denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false,'[]',true)$q$)='23514',
  'copy must explicitly create custom path');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false,'[]',false,
  '{"request_id":"invalid-uuid"}')$q$)='22P02','audit failure rolls back replacement');
select pg_temp.ok(public.admin_cohort_path_get(pg_temp.id(601))=(select v from snapshots where k='custom'),
  'failed saves preserve exact configuration and timestamp');
select public.admin_cohort_path_save(pg_temp.id(602),'DEFAULT',true);
reset role;
select pg_temp.ok((select count(*)=1 from public.audit_logs where entity_id=pg_temp.id(601) and action='cohort_path_saved'),
  'failed saves do not write audits');
select pg_temp.ok(exists(select 1 from public.audit_logs where request_id=pg_temp.id(999)
  and actor_user_id=pg_temp.id(5) and environment='test' and version='c2'),'save audit carries server actor and context');

select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.item_state(303)='LOCKED_DATE','first lesson date locked');
select pg_temp.ok(pg_temp.item_state(301)='LOCKED_SEQUENCE','second lesson sequence locked despite earlier course order');
select pg_temp.ok(pg_temp.item_state(800)='LOCKED_DATE','material inherits parent release');
select pg_temp.ok(pg_temp.item_state(900)='LOCKED_DATE','practice inherits parent release');
select pg_temp.ok(pg_temp.item_state(801) is null,'metadata RPC preserves material entitlement restriction');
select pg_temp.ok(pg_temp.item_state(302) is null and pg_temp.item_state(305) is null,'omitted and draft titles absent');
select pg_temp.ok((select array_agg(i->>'contentId' order by n)=array[pg_temp.id(303)::text,pg_temp.id(301)::text]
  from jsonb_array_elements(public.get_student_learning_path(pg_temp.id(100))->'items') with ordinality v(i,n)
  where i->>'contentKind'='lessons'),'custom order returned');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.get_student_learning_path(pg_temp.id(100))->'items') i
  where i ?| array['content','answerKey','answer_key','storagePath','externalUrl','sourceUrl']), 'student receives metadata only');
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok(pg_temp.item_state(303) is null and pg_temp.item_state(302)='LOCKED_SEQUENCE','default sequence uses course order');
select public.record_lesson_progress(pg_temp.id(301),100,0);
select pg_temp.ok(pg_temp.item_state(302)='AVAILABLE','default sequence unlocks after previous lesson');
reset role;

-- Save recalculates completion when a shorter custom path is already done.
select pg_temp.login(5,'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(602),'CUSTOM',false,
  pg_temp.path(301),false,'{"request_id":"invalid-uuid"}')$q$)='22P02','late audit failure also rolls back course completion');
reset role;
select pg_temp.ok((select status='ACTIVE' from public.enrollments where id=pg_temp.id(502)),
  'failed shortening preserves enrollment status');
select pg_temp.ok(not exists(select 1 from public.audit_logs where entity_id=pg_temp.id(502)
  and action='enrollment_course_completed'),'failed shortening leaves no completion audit');
set local role authenticated;
select public.admin_cohort_path_save(pg_temp.id(602),'CUSTOM',false,pg_temp.path(301));
select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',true,pg_temp.path(303,301));
reset role;
select pg_temp.ok((select status='COMPLETED' from public.enrollments where id=pg_temp.id(502)),'shortening completes enrolled student');
select pg_temp.ok((select count(*)=1 from public.audit_logs where entity_id=pg_temp.id(502)
  and action='enrollment_course_completed'),'completion audit once');
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.item_state(303)='AVAILABLE' and pg_temp.item_state(301)='LOCKED_SEQUENCE','release date removed but sequence preserved');
select public.record_lesson_progress(pg_temp.id(303),100,0);
select pg_temp.ok(pg_temp.item_state(301)='AVAILABLE','RPC agrees with asset/progress unlock');
reset role;

-- A module release date applies to every child even if the child has no date.
select pg_temp.login(5,'aal2');
set local role authenticated;
select public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,
  jsonb_build_array(pg_temp.item('modules',200,0,now()+interval '2 days'),pg_temp.item('lessons',301,1)));
reset role;
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.item_state(301)='LOCKED_DATE','module date inherited');
select pg_temp.ok((select (i->>'availableFrom')::timestamptz=now()+interval '2 days'
  from jsonb_array_elements(public.get_student_learning_path(pg_temp.id(100))->'items') i
  where i->>'contentId'=pg_temp.id(301)::text),'effective release date returned');
reset role;

select pg_temp.login(5,'aal2');
set local role authenticated;
insert into snapshots values('copy',public.admin_cohort_path_save(pg_temp.id(601),'CUSTOM',false,'[]',true));
select pg_temp.ok((select jsonb_array_length(v->'items')=4 from snapshots where k='copy'),
  'copy contains only published COURSE module and three lessons');
select pg_temp.ok(not exists(select 1 from snapshots s cross join lateral jsonb_array_elements(s.v->'items') i
  where s.k='copy' and i->>'contentId' in (pg_temp.id(303)::text,pg_temp.id(305)::text,pg_temp.id(800)::text,pg_temp.id(900)::text)),
  'copy excludes exclusive and draft content');
select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false);
reset role;
select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok(pg_temp.item_state(301)='AVAILABLE' and pg_temp.item_state(303) is null,'reset to DEFAULT removes exclusives');
reset role;
select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok(public.get_student_learning_path(pg_temp.id(100))->>'enrollmentStatus'='COMPLETED',
  'completed student retains custom path read');
reset role;
select pg_temp.login(3);
set local role authenticated;
select pg_temp.ok(public.get_student_learning_path(pg_temp.id(100))->'paths'->0->>'cohortId' is null,
  'no membership returns implicit default');
select pg_temp.ok(pg_temp.item_state(303) is null,'no membership never sees exclusives');
reset role;
select pg_temp.login(4);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.get_student_learning_path(pg_temp.id(100))')='42501','other course enrollment denied');
reset role;
select pg_temp.login(6,'aal2');
set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.get_student_learning_path(pg_temp.id(100))')='42501','teacher cannot impersonate student');
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role authenticated;
select pg_temp.ok(pg_temp.state('select public.get_student_learning_path(pg_temp.id(100))')='42501','authenticated role without actor denied');
reset role;
select pg_temp.ok(not has_table_privilege('authenticated','public.cohort_paths','SELECT')
  and not has_table_privilege('authenticated','public.cohort_path_items','INSERT'),'RPCs did not widen direct table grants');
set local role anon;
select pg_temp.ok(pg_temp.state('select public.admin_cohort_path_get(pg_temp.id(601))')='42501','anonymous admin get denied');
select pg_temp.ok(pg_temp.state($q$select public.admin_cohort_path_save(pg_temp.id(601),'DEFAULT',false)$q$)='42501',
  'anonymous admin save denied');
select pg_temp.ok(pg_temp.state('select public.get_student_learning_path(pg_temp.id(100))')='42501','anonymous path denied');
reset role;
rollback;
