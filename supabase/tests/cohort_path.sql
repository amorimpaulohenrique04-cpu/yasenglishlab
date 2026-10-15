-- C1 / ADR 0022. Real RLS and consumption boundaries; no committed fixtures.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$
  select ('cd000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
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
insert into public.cohort_paths(cohort_id,mode,sequential) values
  (pg_temp.id(601),'CUSTOM',true),(pg_temp.id(602),'DEFAULT',false);
insert into public.cohort_path_items(cohort_id,content_kind,content_id,position,available_from) values
  (pg_temp.id(601),'modules',pg_temp.id(200),0,null),
  (pg_temp.id(601),'lessons',pg_temp.id(301),1,null),
  (pg_temp.id(601),'lessons',pg_temp.id(303),2,now()+interval '1 day'),
  (pg_temp.id(601),'materials',pg_temp.id(800),3,null),
  (pg_temp.id(601),'practice_activities',pg_temp.id(900),4,null);
set constraints all immediate;

-- Integrity: cross-course, missing parent, duplicate order and nonexistent references fail.
select pg_temp.ok(pg_temp.state($q$insert into public.cohort_path_items values
  (pg_temp.id(601),'modules',pg_temp.id(201),5,null)$q$)='23514','cross-course item denied');
select pg_temp.ok(pg_temp.state($q$insert into public.cohort_path_items values
  (pg_temp.id(602),'lessons',pg_temp.id(301),5,null)$q$)='23514','missing parent denied');
select pg_temp.ok(pg_temp.state($q$insert into public.cohort_path_items values
  (pg_temp.id(601),'lessons',pg_temp.id(302),1,null)$q$)='23505','duplicate order denied');
select pg_temp.ok(pg_temp.state($q$insert into public.cohort_path_items values
  (pg_temp.id(601),'lessons',pg_temp.id(999),8,null)$q$)='23514','dangling item denied');
select pg_temp.ok(pg_temp.state($q$delete from public.cohort_path_items where
  cohort_id=pg_temp.id(601) and content_kind='modules'$q$)='23514','deleting path parent denied');
select pg_temp.ok(pg_temp.state($q$delete from public.lessons where id=pg_temp.id(303)$q$)='23514',
  'deleting referenced content denied');
select pg_temp.ok(pg_temp.state($q$update public.modules set course_id=pg_temp.id(101)
  where id=pg_temp.id(200)$q$)='23514','moving referenced module denied');

select pg_temp.login(1);
set local role authenticated;
select pg_temp.ok((select count(*)=1 from public.courses where id in (pg_temp.id(100),pg_temp.id(101))),
  'course titles limited to enrollment');
select pg_temp.ok(not exists(select 1 from public.modules where id=pg_temp.id(201)),'other module hidden');
select pg_temp.ok((select count(*)=2 from public.lessons where module_id=pg_temp.id(200)),
  'custom path includes exactly its lessons including locked metadata');
select pg_temp.ok(exists(select 1 from public.lessons where id=pg_temp.id(303)), 'future exclusive title visible');
select pg_temp.ok(not private.can_read_lesson_asset(pg_temp.id(403)),'future asset denied');
select pg_temp.ok(not private.can_read_material(pg_temp.id(800)),'future parent blocks material');
select pg_temp.ok(not private.can_view_practice_activity(pg_temp.id(900)),'future parent blocks practice');
select pg_temp.ok(pg_temp.state('select public.start_practice_attempt(pg_temp.id(900),gen_random_uuid())')='42501',
  'future practice cannot start');
select pg_temp.ok(private.can_read_lesson_asset(pg_temp.id(401)),'available asset allowed');
select pg_temp.ok(pg_temp.state('select public.record_lesson_progress(pg_temp.id(303),100,0)')='42501',
  'future progress denied');
select pg_temp.ok(pg_temp.state('select public.record_lesson_progress(pg_temp.id(302),100,0)')='42501',
  'omitted lesson progress denied');
select pg_temp.ok(pg_temp.state('select * from public.cohort_paths')='42501','raw path tables not exposed');
select pg_temp.ok(pg_temp.state($q$insert into public.cohort_paths(cohort_id) values(pg_temp.id(601))$q$)='42501',
  'direct path mutation denied');
reset role;
-- Date elapsed, but sequence still locks lesson 3.
update public.cohort_path_items set available_from=now()-interval '1 hour' where content_id=pg_temp.id(303);
set local role authenticated;
select pg_temp.ok(not private.can_read_lesson_asset(pg_temp.id(403)),'sequence asset denied after date release');
select pg_temp.ok(pg_temp.state('select public.record_lesson_progress(pg_temp.id(303),100,0)')='42501',
  'sequence progress denied');
select public.record_lesson_progress(pg_temp.id(301),100,0);
select pg_temp.ok(private.can_read_lesson_asset(pg_temp.id(403)),'completion unlocks next lesson');
select pg_temp.ok(private.can_read_material(pg_temp.id(800)),'available parent unlocks material');
select pg_temp.ok(private.can_view_practice_activity(pg_temp.id(900)),'available parent unlocks practice');
select pg_temp.ok((public.start_practice_attempt(pg_temp.id(900),gen_random_uuid())).id is not null,
  'available practice can start');
reset role;
select pg_temp.ok((select status='ACTIVE' from public.enrollments where id=pg_temp.id(501)),
  'one of two path lessons does not complete course');
set local role authenticated;
select public.record_lesson_progress(pg_temp.id(303),100,0);
reset role;
select pg_temp.ok((select status='COMPLETED' from public.enrollments where id=pg_temp.id(501)),
  'custom completion ignores omitted published lessons');
set local role authenticated;
select pg_temp.ok(private.can_read_lesson_asset(pg_temp.id(403)),'completed enrollment retains custom path');
select pg_temp.ok((select count(*)=2 from public.lessons where module_id=pg_temp.id(200)),
  'completed enrollment does not fall back to default path');
reset role;

select pg_temp.login(2);
set local role authenticated;
select pg_temp.ok((select count(*)=3 from public.lessons where module_id=pg_temp.id(200)),
  'default path sees COURSE lessons');
select pg_temp.ok(not exists(select 1 from public.lessons where id=pg_temp.id(303)),'exclusive absent from default');
select pg_temp.ok(private.can_read_lesson_asset(pg_temp.id(402)),'default lesson available');
reset role;
-- The same exclusive item can belong to several cohorts, including a DEFAULT path.
insert into public.cohort_path_items(cohort_id,content_kind,content_id,position) values
  (pg_temp.id(602),'modules',pg_temp.id(200),0),
  (pg_temp.id(602),'lessons',pg_temp.id(303),1);
set local role authenticated;
select pg_temp.ok(exists(select 1 from public.lessons where id=pg_temp.id(303)),
  'default path may explicitly include an exclusive item shared with another cohort');
select pg_temp.ok(private.can_read_lesson_asset(pg_temp.id(403)),'explicit default exclusive is available');
select pg_temp.ok(not private.can_read_material(pg_temp.id(800)),'exclusive material needs own inclusion');
select pg_temp.ok(not private.can_view_practice_activity(pg_temp.id(900)),'exclusive practice needs own inclusion');
reset role;
-- Transfer into the custom path changes visibility and preserves per-user progress.
update public.cohort_memberships set status='LEFT',ends_at=now() where id=pg_temp.id(702);
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id)
  values(pg_temp.id(601),pg_temp.id(2),pg_temp.id(502));
set local role authenticated;
select pg_temp.ok(not exists(select 1 from public.lessons where id=pg_temp.id(302)),'transfer hides omitted lessons');
select pg_temp.ok(not private.can_read_lesson_asset(pg_temp.id(403)),'transferred student has own sequence');
select public.record_lesson_progress(pg_temp.id(301),100,0);
reset role;
select pg_temp.ok((select status='ACTIVE' from public.enrollments where id=pg_temp.id(502)),
  'student still needs second lesson of original custom path');
insert into public.cohorts(id,course_id,name,code,status,starts_at)
  values(pg_temp.id(603),pg_temp.id(100),'Short path','cp-short','ACTIVE',now());
insert into public.cohort_paths(cohort_id,mode) values(pg_temp.id(603),'CUSTOM');
insert into public.cohort_path_items(cohort_id,content_kind,content_id,position) values
  (pg_temp.id(603),'modules',pg_temp.id(200),0),(pg_temp.id(603),'lessons',pg_temp.id(301),1);
update public.cohort_memberships set status='LEFT',ends_at=now() where user_id=pg_temp.id(2) and status='ACTIVE';
insert into public.cohort_memberships(cohort_id,user_id,enrollment_id)
  values(pg_temp.id(603),pg_temp.id(2),pg_temp.id(502));
select pg_temp.ok((select status='COMPLETED' from public.enrollments where id=pg_temp.id(502)),
  'transfer immediately completes a path whose lessons were already completed');
select pg_temp.ok((select count(*)=1 from public.lesson_progress where user_id=pg_temp.id(2)),
  'transfer preserves progress without manufacturing new checkpoints');
select pg_temp.ok((select count(*)=1 from public.audit_logs where entity_id=pg_temp.id(502)
  and action='enrollment_course_completed'),'transfer completion audited exactly once');

select pg_temp.login(3);
set local role authenticated;
select pg_temp.ok((select count(*)=3 from public.lessons where module_id=pg_temp.id(200)),
  'no membership sees only COURSE');
select pg_temp.ok(pg_temp.state('select public.record_lesson_progress(pg_temp.id(301),10,0)')='42501',
  'existing no-membership progress guard retained');
reset role;
select pg_temp.login(4);
set local role authenticated;
select pg_temp.ok(not exists(select 1 from public.lessons where module_id=pg_temp.id(200)),'outsider sees no titles');
select pg_temp.ok(not private.can_read_lesson_asset(pg_temp.id(401)),'outsider asset denied');
reset role;
-- Placement may reveal the recommended course title, never its modules/lessons before enrollment.
set local session_replication_role=replica;
insert into public.placement_cases(id,user_id,subscription_id,state)
  select pg_temp.id(950),pg_temp.id(4),id,'PLACEMENT_READY' from public.subscriptions where user_id=pg_temp.id(4);
insert into public.placement_reviews(placement_case_id,recommended_course_id,actor_user_id,feedback,confidence,provenance)
  values(pg_temp.id(950),pg_temp.id(100),pg_temp.id(6),'Recommendation fixture','HIGH','{}');
set local session_replication_role=origin;
set local role authenticated;
select pg_temp.ok(exists(select 1 from public.courses where id=pg_temp.id(100)),'recommended course title preserved');
select pg_temp.ok(not exists(select 1 from public.modules where id=pg_temp.id(200)),'recommendation does not reveal modules');
reset role;
select pg_temp.login(5,'aal2');
set local role authenticated;
select pg_temp.ok((select count(*)=4 from public.lessons where module_id=pg_temp.id(200)),'admin scope preserved');
select pg_temp.ok(pg_temp.state('delete from public.cohort_paths')='42501','admin direct DML denied too');
reset role;
select pg_temp.login(6,'aal2');
set local role authenticated;
select pg_temp.ok((select count(*)=4 from public.lessons where module_id=pg_temp.id(200)),'teacher published scope preserved');
reset role;
select pg_temp.login(6,'aal1');
set local role authenticated;
select pg_temp.ok(not exists(select 1 from public.lessons where module_id=pg_temp.id(200)),'aal1 staff has no privileged titles');
reset role;
set local role anon;
select pg_temp.ok(pg_temp.state('select private.can_read_learning_metadata(''lessons'',pg_temp.id(301))')='42501',
  'anonymous cannot execute metadata helper');
select pg_temp.ok(pg_temp.state('select * from public.cohort_path_items')='42501','anonymous cannot read path');
reset role;
rollback;
