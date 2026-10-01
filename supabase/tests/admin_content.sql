-- P18 real PostgreSQL, authenticated commands and direct-ID isolation.
begin;
insert into auth.users(id,email) values
('98000000-0000-4000-8000-000000000001','content-admin@example.test'),
('98000000-0000-4000-8000-000000000002','content-student@example.test'),
('98000000-0000-4000-8000-000000000003','content-teacher@example.test'),
('98000000-0000-4000-8000-000000000004','content-support@example.test');
insert into public.user_roles(user_id,role) values
('98000000-0000-4000-8000-000000000001','ADMIN'),
('98000000-0000-4000-8000-000000000002','STUDENT'),
('98000000-0000-4000-8000-000000000003','TEACHER'),
('98000000-0000-4000-8000-000000000004','SUPPORT');
create temp table content_ids(kind text primary key,id uuid);
grant all on content_ids to authenticated;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'P18 assertion: %',label; end if; end $$;
create function pg_temp.denied(command text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin
 begin execute command; exception when insufficient_privilege or check_violation or invalid_parameter_value or foreign_key_violation or raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Expected rejection: %',command; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
select pg_temp.denied($q$select public.admin_content_save('courses',null,'{"slug":"p18-test","title":"P18"}')$q$);
select pg_temp.denied($q$select * from public.admin_content_list('courses')$q$);
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
insert into content_ids values ('courses',public.admin_content_save('courses',null,'{"slug":"p18-test","title":"P18","active":true}'));
insert into content_ids select 'modules',public.admin_content_save('modules',null,jsonb_build_object('course_id',id,'title','P18 module','position',1)) from content_ids where kind='courses';
insert into content_ids select 'modules_b',public.admin_content_save('modules',null,jsonb_build_object('course_id',id,'title','P18 module B','position',2)) from content_ids where kind='courses';
insert into content_ids select 'lessons',public.admin_content_save('lessons',null,jsonb_build_object('module_id',id,'title','P18 lesson','slug','p18-lesson','position',1)) from content_ids where kind='modules';
insert into content_ids select 'lessons_b',public.admin_content_save('lessons',null,jsonb_build_object('module_id',id,'title','P18 lesson B','slug','p18-lesson-b','position',2)) from content_ids where kind='modules';
insert into content_ids select 'lesson_assets',public.admin_content_save('lesson_assets',null,jsonb_build_object('lesson_id',id,'asset_type','TEXT','position',1,'content',jsonb_build_object('title','P18 text','body','Usable lesson body.'))) from content_ids where kind='lessons';
insert into content_ids select 'lesson_assets_b',public.admin_content_save('lesson_assets',null,jsonb_build_object('lesson_id',id,'asset_type','LINK','position',2,'source_url','https://example.test/reference')) from content_ids where kind='lessons';
insert into content_ids select 'materials',public.admin_content_save('materials',null,jsonb_build_object('title','P18 material','material_type','SUMMARY','module_id',id,'active',true,'external_url','https://example.test/material')) from content_ids where kind='modules';
insert into content_ids select 'practice_activities',public.admin_content_save('practice_activities',null,jsonb_build_object('title','P18 practice','slug','p18-practice','skill','SPEAKING','estimated_minutes',5,'related_module_id',id,'active',true,'content','{"kind":"MANUAL_TEXT","evaluationMode":"MANUAL_PENDING","prompt":"Say hello","instructions":"Write your response"}'::jsonb)) from content_ids where kind='modules';
select pg_temp.assert_true((select bool_and(publication_status='DRAFT' and published_at is null) from public.courses where id=(select id from content_ids where kind='courses')),'new content defaults DRAFT');
select pg_temp.denied($q$select public.admin_content_save('courses',null,'{"slug":"p18-spoof","title":"Spoof","actor_user_id":"98000000-0000-4000-8000-000000000002"}')$q$);
select pg_temp.denied($q$select public.admin_content_save('courses',null,'{"slug":"p18-spoof","title":"Spoof","publication_status":"PUBLISHED"}')$q$);
select pg_temp.denied($q$insert into public.courses(slug,title) values('p18-direct','Direct')$q$);
select pg_temp.denied($q$select public.admin_content_save('modules',null,'{"course_id":"ffffffff-ffff-4fff-8fff-ffffffffffff","position":1,"title":"Broken"}')$q$);
select pg_temp.denied($q$select public.admin_content_transition('lessons',(select id from content_ids where kind='lessons'),'PUBLISHED')$q$);
select public.admin_content_save('courses',id,'{"title":"P18 updated"}') from content_ids where kind='courses';
select pg_temp.assert_true((select count(*)=1 from public.admin_content_list('courses') row where row->>'id'=(select id::text from content_ids where kind='courses')),'Admin preview sees DRAFT');

reset role;
insert into public.enrollments(user_id,course_id,status) select '98000000-0000-4000-8000-000000000002',id,'ACTIVE' from content_ids where kind='courses';
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}',true);
select pg_temp.assert_true(not exists(select 1 from public.courses where id=(select id from content_ids where kind='courses')),'course DRAFT direct UUID deny');
select pg_temp.assert_true(not exists(select 1 from public.modules where id=(select id from content_ids where kind='modules')),'module DRAFT deny');
select pg_temp.assert_true(not exists(select 1 from public.lessons where id=(select id from content_ids where kind='lessons')),'lesson DRAFT deny');
select pg_temp.assert_true(not exists(select 1 from public.lesson_assets where id=(select id from content_ids where kind='lesson_assets')),'asset DRAFT deny');
select pg_temp.assert_true(not exists(select 1 from public.materials where id=(select id from content_ids where kind='materials')),'material DRAFT deny');
select pg_temp.assert_true(not exists(select 1 from public.practice_activities where id=(select id from content_ids where kind='practice_activities')),'practice DRAFT deny');
select pg_temp.denied($q$select public.start_practice_attempt((select id from content_ids where kind='practice_activities'),gen_random_uuid())$q$);
select pg_temp.denied($q$select public.record_lesson_progress((select id from content_ids where kind='lessons'),25,0)$q$);
select pg_temp.denied($q$select * from public.admin_content_list('courses')$q$);
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',true);
select pg_temp.assert_true(not exists(select 1 from public.courses where id=(select id from content_ids where kind='courses')),'Teacher draft deny');
select pg_temp.denied($q$select * from public.admin_content_list('courses')$q$);
select pg_temp.denied($q$select public.admin_content_transition('courses',(select id from content_ids where kind='courses'),'PUBLISHED')$q$);
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000004","aal":"aal2","role":"authenticated"}',true);
select pg_temp.denied($q$select public.admin_content_save('courses',null,'{"slug":"p18-support","title":"No"}')$q$);

select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
select public.admin_content_transition('lesson_assets',id,'PUBLISHED') from content_ids where kind='lesson_assets';
select public.admin_content_transition('lessons',id,'PUBLISHED') from content_ids where kind='lessons';
select public.admin_content_transition('modules',id,'PUBLISHED') from content_ids where kind='modules';
select public.admin_content_transition('materials',id,'PUBLISHED') from content_ids where kind='materials';
select public.admin_content_transition('practice_activities',id,'PUBLISHED') from content_ids where kind='practice_activities';
select pg_temp.denied($q$select public.admin_content_save('lessons',(select id from content_ids where kind='lessons'),'{}')$q$);
select pg_temp.denied($q$select public.admin_content_transition('modules',(select id from content_ids where kind='modules'),'PUBLISHED')$q$);

select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}',true);
select pg_temp.assert_true(not exists(select 1 from public.lessons where id=(select id from content_ids where kind='lessons')),'published child beneath draft ancestor hidden');
select pg_temp.assert_true(not exists(select 1 from public.materials where id=(select id from content_ids where kind='materials')),'linked material beneath draft course hidden');
select pg_temp.assert_true(not exists(select 1 from public.practice_activities where id=(select id from content_ids where kind='practice_activities')),'linked practice beneath draft course hidden');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
select public.admin_content_transition('courses',id,'PUBLISHED') from content_ids where kind='courses';
select pg_temp.denied($q$select public.admin_content_save('courses',(select id from content_ids where kind='courses'),'{"title":"Silent live edit"}')$q$);
select public.admin_content_reorder('modules',(select id from content_ids where kind='courses'),array[(select id from content_ids where kind='modules_b'),(select id from content_ids where kind='modules')]);
select public.admin_content_reorder('lessons',(select id from content_ids where kind='modules'),array[(select id from content_ids where kind='lessons_b'),(select id from content_ids where kind='lessons')]);
select public.admin_content_reorder('lesson_assets',(select id from content_ids where kind='lessons'),array[(select id from content_ids where kind='lesson_assets_b'),(select id from content_ids where kind='lesson_assets')]);
select pg_temp.assert_true((select position=2 from public.modules where id=(select id from content_ids where kind='modules')),'module reorder persisted');
select pg_temp.assert_true((select position=2 from public.lessons where id=(select id from content_ids where kind='lessons')),'lesson reorder persisted');
select pg_temp.assert_true((select position=2 from public.lesson_assets where id=(select id from content_ids where kind='lesson_assets')),'asset reorder persisted');
select pg_temp.denied($q$select public.admin_content_reorder('modules',(select id from content_ids where kind='courses'),array[(select id from content_ids where kind='lessons')])$q$);
select pg_temp.denied($q$select public.admin_content_reorder('modules',(select id from content_ids where kind='courses'),array[(select id from content_ids where kind='modules'),(select id from content_ids where kind='modules')])$q$);
select pg_temp.assert_true((select count(distinct action)=5 from public.audit_logs where actor_user_id=auth.uid() and action in ('content_created','content_updated','content_published','content_unpublished','content_reordered')) is false,'unpublish audit not yet present');

select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}',true);
select pg_temp.assert_true(exists(select 1 from public.courses where id=(select id from content_ids where kind='courses')),'published course visible');
select pg_temp.assert_true(exists(select 1 from public.lessons where id=(select id from content_ids where kind='lessons')),'published lesson visible');
select pg_temp.assert_true(exists(select 1 from public.lesson_assets where id=(select id from content_ids where kind='lesson_assets')),'published asset visible');
select pg_temp.assert_true(exists(select 1 from public.materials where id=(select id from content_ids where kind='materials')),'published authorized material visible');
select pg_temp.assert_true(exists(select 1 from public.practice_activities where id=(select id from content_ids where kind='practice_activities')),'published practice visible');
select pg_temp.assert_true(not exists(select 1 from public.modules where id=(select id from content_ids where kind='modules_b')),'draft module beneath published course hidden');
select pg_temp.assert_true(not exists(select 1 from public.lessons where id=(select id from content_ids where kind='lessons_b')),'draft lesson beneath published module hidden');
select pg_temp.assert_true(not exists(select 1 from public.lesson_assets where id=(select id from content_ids where kind='lesson_assets_b')),'draft asset beneath published lesson hidden');
select public.record_lesson_progress((select id from content_ids where kind='lessons'),25,0);
select public.start_practice_attempt((select id from content_ids where kind='practice_activities'),gen_random_uuid());
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
select public.admin_content_transition('courses',id,'DRAFT') from content_ids where kind='courses';
select pg_temp.assert_true((select count(distinct action)=5 from public.audit_logs where actor_user_id=auth.uid() and action in ('content_created','content_updated','content_published','content_unpublished','content_reordered')),'all five audit actions persist with authenticated actor');
select pg_temp.assert_true(not exists(select 1 from public.audit_logs where actor_user_id=auth.uid() and action like 'content_%' and data::text ~ '(token|secret|storage_path|signed_url|Usable lesson body)'),'audit privacy');
select pg_temp.assert_true(not exists(select 1 from public.audit_logs where actor_user_id=auth.uid() and action like 'content_%' and (request_id is null or environment is null or version is null)),'audit technical correlation persists');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}',true);
select pg_temp.assert_true(not exists(select 1 from public.lessons where id=(select id from content_ids where kind='lessons')),'unpublish ancestor hides descendants');
select pg_temp.denied($q$select public.submit_practice_attempt((select id from public.practice_attempts where practice_activity_id=(select id from content_ids where kind='practice_activities') limit 1),'{"text":"hello"}')$q$);

-- Audit failure rolls the mutation back rather than reporting a partial success.
reset role;
create function pg_temp.reject_content_audit() returns trigger language plpgsql as $$ begin if new.action='content_updated' then raise exception 'Controlled audit failure'; end if; return new; end $$;
create trigger p18_audit_failure before insert on public.audit_logs for each row execute function pg_temp.reject_content_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
select pg_temp.denied($q$select public.admin_content_save('courses',(select id from content_ids where kind='courses'),'{"title":"Must roll back"}')$q$);
select pg_temp.assert_true((select title='P18 updated' from public.courses where id=(select id from content_ids where kind='courses')),'audit failure rolls content update back');
reset role;
drop trigger p18_audit_failure on public.audit_logs;
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
insert into content_ids values('invalid_course',public.admin_content_save('courses',null,'{"slug":"p18-invalid","title":"   "}'));
select pg_temp.denied($q$select public.admin_content_transition('courses',(select id from content_ids where kind='invalid_course'),'PUBLISHED')$q$);
select pg_temp.assert_true((select publication_status='DRAFT' from public.courses where id=(select id from content_ids where kind='invalid_course')),'invalid publication stays draft');
insert into content_ids select 'unsafe_asset',public.admin_content_save('lesson_assets',null,jsonb_build_object('lesson_id',id,'asset_type','LINK','position',3,'source_url','javascript:alert(1)')) from content_ids where kind='lessons';
select pg_temp.denied($q$select public.admin_content_transition('lesson_assets',(select id from content_ids where kind='unsafe_asset'),'PUBLISHED')$q$);
insert into content_ids values ('invalid_practice',public.admin_content_save('practice_activities',null,'{"slug":"p18-invalid-practice","title":"Invalid engine","skill":"GRAMMAR","estimated_minutes":5,"content":{"kind":"AI_GRADING","prompt":"No"}}'));
select pg_temp.denied($q$select public.admin_content_transition('practice_activities',(select id from content_ids where kind='invalid_practice'),'PUBLISHED')$q$);
insert into content_ids values ('objective_practice',public.admin_content_save('practice_activities',null,'{"slug":"p18-objective","title":"Objective","skill":"GRAMMAR","estimated_minutes":5,"content":{"kind":"MULTIPLE_CHOICE","evaluationMode":"DETERMINISTIC","prompt":"Choose","options":[{"id":"a","label":"A"},{"id":"b","label":"B"}]},"answer_key":{"optionId":"a"}}'));
select public.admin_content_transition('practice_activities',id,'PUBLISHED') from content_ids where kind='objective_practice';
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where actor_user_id=auth.uid() and action='content_published' and entity_id=(select id from content_ids where kind='objective_practice')),'supported objective practice publication audited');
-- Every command is denied at AAL1, independently of Next.js guards.
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
select pg_temp.denied($q$select public.admin_content_transition('courses',(select id from content_ids where kind='courses'),'PUBLISHED')$q$);
select pg_temp.denied($q$select public.admin_content_reorder('modules',(select id from content_ids where kind='courses'),array[(select id from content_ids where kind='modules'),(select id from content_ids where kind='modules_b')])$q$);
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.admin_content_save(text,uuid,jsonb,jsonb)','EXECUTE'),'anon command execute denied');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.lessons','UPDATE'),'no direct content DML');
rollback;
