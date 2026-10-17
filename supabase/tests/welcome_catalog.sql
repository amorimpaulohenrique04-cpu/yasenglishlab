-- PR1 / 1C: welcome catalog for paying students during placement review; closed afterwards.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9f000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',format('{"sub":"%s","aal":"aal1"}',pg_temp.id(n)),true)$$;
insert into auth.users(id,email) select pg_temp.id(n),'welcome-'||n||'@example.test' from generate_series(1,3) n;
insert into public.user_roles(user_id,role) select pg_temp.id(n),'STUDENT' from generate_series(1,3) n;
-- 1 = paid student in review, 2 = unpaid student in review, 3 = paid student who already has to decide.
insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status) values
 (pg_temp.id(1),'10000000-0000-0000-0000-000000000001','test','wc-1','ACTIVE'),
 (pg_temp.id(3),'10000000-0000-0000-0000-000000000001','test','wc-3','ACTIVE');
set local session_replication_role = replica;
insert into public.placement_cases(user_id,subscription_id,state)
 select s.user_id,s.id,'REVIEW_PENDING' from public.subscriptions s where s.provider_subscription_id in ('wc-1','wc-3');
insert into public.placement_cases(user_id,subscription_id,state)
 select pg_temp.id(2),s.id,'REVIEW_PENDING' from public.subscriptions s where s.provider_subscription_id='wc-1';
update public.placement_cases set state='PLACEMENT_READY' where user_id=pg_temp.id(3);
set local session_replication_role = origin;
insert into public.courses(id,slug,title,active,publication_status,published_at) values(pg_temp.id(100),'wc-course','Welcome course',true,'PUBLISHED',now());
insert into public.modules(id,course_id,position,title,publication_status,published_at) values(pg_temp.id(200),pg_temp.id(100),1,'Welcome module','PUBLISHED',now());
insert into public.lessons(id,module_id,position,slug,title,welcome) values
 (pg_temp.id(300),pg_temp.id(200),1,'wc-open','Open lesson',true),(pg_temp.id(301),pg_temp.id(200),2,'wc-closed','Closed lesson',false);
insert into public.lesson_assets(id,lesson_id,asset_type,position,content,publication_status,published_at) values
 (pg_temp.id(400),pg_temp.id(300),'TEXT',1,'{"title":"Open","body":"x"}','PUBLISHED',now()),
 (pg_temp.id(401),pg_temp.id(301),'TEXT',1,'{"title":"Closed","body":"x"}','PUBLISHED',now());
update public.lessons set publication_status='PUBLISHED',published_at=now() where id in (pg_temp.id(300),pg_temp.id(301));
insert into public.materials(id,title,material_type,external_url,welcome,publication_status,published_at) values
 (pg_temp.id(500),'Welcome PDF','WORKSHEET','https://example.test/w',true,'PUBLISHED',now()),
 (pg_temp.id(501),'Closed PDF','WORKSHEET','https://example.test/c',false,'PUBLISHED',now());

set local role authenticated;
select pg_temp.as_user(1);
select pg_temp.assert_true((select count(*)=1 and bool_and(slug='wc-open') from public.lessons where id in (pg_temp.id(300),pg_temp.id(301))),'only welcome lesson readable');
select pg_temp.assert_true((select count(*)=1 from public.modules where id=pg_temp.id(200)) and (select count(*)=1 from public.courses where id=pg_temp.id(100)),'its module and course are readable');
select pg_temp.assert_true((select count(*)=1 and bool_and(id=pg_temp.id(400)) from public.lesson_assets where id in (pg_temp.id(400),pg_temp.id(401))),'only welcome asset readable');
select pg_temp.assert_true((select count(*)=1 and bool_and(id=pg_temp.id(500)) from public.materials where id in (pg_temp.id(500),pg_temp.id(501))),'only welcome material readable');
select public.record_welcome_lesson_progress(pg_temp.id(300),30,12);
select public.record_welcome_lesson_progress(pg_temp.id(300),10,5);
select pg_temp.assert_true((select completion_percent=30 and status='IN_PROGRESS' from public.welcome_lesson_progress where lesson_id=pg_temp.id(300)),'progress is monotonic and stored');
select pg_temp.denied(format('select public.record_welcome_lesson_progress(%L,50)',pg_temp.id(301)));
select pg_temp.denied('select public.record_lesson_progress('''||pg_temp.id(300)||''',50)');
select pg_temp.denied('insert into public.welcome_lesson_progress(user_id,lesson_id,status) values('''||pg_temp.id(1)||''','''||pg_temp.id(300)||''',''COMPLETED'')');

select pg_temp.as_user(2);
select pg_temp.assert_true((select count(*)=0 from public.lessons where id in (pg_temp.id(300),pg_temp.id(301))),'unpaid student sees nothing');
select pg_temp.denied(format('select public.record_welcome_lesson_progress(%L,50)',pg_temp.id(300)));

select pg_temp.as_user(3);
select pg_temp.assert_true((select count(*)=0 from public.lessons where id in (pg_temp.id(300),pg_temp.id(301))),'waiting-to-confirm student sees no pedagogic content');
select pg_temp.assert_true((select count(*)=0 from public.materials where id in (pg_temp.id(500),pg_temp.id(501))),'nor materials');
select pg_temp.denied(format('select public.record_welcome_lesson_progress(%L,50)',pg_temp.id(300)));
reset role;
rollback;
