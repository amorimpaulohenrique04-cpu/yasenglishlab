-- Stage 12 / C3: audience is writable only by ADMIN+AAL2 through admin_content_save and only COURSE|COHORTS.
begin;
insert into auth.users(id,email) values
('98a00000-0000-4000-8000-000000000001','audience-admin@example.test'),
('98a00000-0000-4000-8000-000000000002','audience-teacher@example.test');
insert into public.user_roles(user_id,role) values
('98a00000-0000-4000-8000-000000000001','ADMIN'),
('98a00000-0000-4000-8000-000000000002','TEACHER');
create temp table aud_ids(kind text primary key,id uuid);
grant all on aud_ids to authenticated;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'C3 assertion: %',label; end if; end $$;
create function pg_temp.denied(command text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin
 begin execute command; exception when insufficient_privilege or check_violation or invalid_parameter_value or foreign_key_violation or raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Expected rejection: %',command; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','98a00000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"98a00000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',true);
select pg_temp.denied($q$select public.admin_content_save('modules',null,'{"title":"x","position":1,"audience":"COHORTS"}')$q$);

select set_config('request.jwt.claim.sub','98a00000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"98a00000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}',true);
select pg_temp.denied($q$select public.admin_content_save('modules',null,'{"title":"x","position":1,"audience":"COHORTS"}')$q$);

select set_config('request.jwt.claims','{"sub":"98a00000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
insert into aud_ids values ('courses',public.admin_content_save('courses',null,'{"slug":"c3-audience","title":"C3 audience","active":true}'));
insert into aud_ids select 'modules',public.admin_content_save('modules',null,jsonb_build_object('course_id',id,'title','C3 module','position',1,'audience','COHORTS')) from aud_ids where kind='courses';
insert into aud_ids select 'lessons',public.admin_content_save('lessons',null,jsonb_build_object('module_id',id,'title','C3 lesson','slug','c3-lesson','position',1,'audience','COHORTS')) from aud_ids where kind='modules';
insert into aud_ids select 'materials',public.admin_content_save('materials',null,jsonb_build_object('title','C3 material','material_type','SUMMARY','module_id',id,'active',true,'external_url','https://example.test/c3','audience','COHORTS')) from aud_ids where kind='modules';
reset role;
select pg_temp.assert_true((select audience='COHORTS' from public.modules where id=(select id from aud_ids where kind='modules')),'module audience saved');
select pg_temp.assert_true((select audience='COHORTS' from public.lessons where id=(select id from aud_ids where kind='lessons')),'lesson audience saved');
select pg_temp.assert_true((select audience='COHORTS' from public.materials where id=(select id from aud_ids where kind='materials')),'material audience saved');
set local role authenticated;
select public.admin_content_save('modules',(select id from aud_ids where kind='modules'),'{"audience":"COURSE"}');
reset role;
select pg_temp.assert_true((select audience='COURSE' from public.modules where id=(select id from aud_ids where kind='modules')),'module audience updated');
set local role authenticated;
select pg_temp.denied($q$select public.admin_content_save('modules',(select id from aud_ids where kind='modules'),'{"audience":"SPECIAL"}')$q$);
select pg_temp.denied($q$select public.admin_content_save('lessons',(select id from aud_ids where kind='lessons'),'{"audience":"ASSIGNED"}')$q$);
select pg_temp.denied($q$select public.admin_content_save('practice_activities',null,'{"audience":"COURSE"}')$q$);
select pg_temp.denied($q$select public.admin_content_save('courses',(select id from aud_ids where kind='courses'),'{"audience":"COHORTS"}')$q$);
rollback;
