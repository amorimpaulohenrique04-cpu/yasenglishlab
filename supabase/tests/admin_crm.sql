begin;
create function pg_temp.crm_assert(ok boolean,message text) returns void language plpgsql as $$ begin if not coalesce(ok,false) then raise exception '%',message; end if; end $$;
create function pg_temp.crm_denied(statement text,code text default '42501') returns void language plpgsql as $$ begin
  begin execute statement; raise exception 'expected denial: %',statement;
  exception when others then if sqlstate='P0001' then raise; elsif sqlstate<>code then raise exception 'unexpected SQLSTATE %, expected %',sqlstate,code; end if; end;
end $$;
insert into auth.users(id,email) values
 ('a2000000-0000-4000-8000-000000000001','crm-admin@example.test'),
 ('a2000000-0000-4000-8000-000000000002','crm-support@example.test'),
 ('a2000000-0000-4000-8000-000000000003','crm-teacher@example.test'),
 ('a2000000-0000-4000-8000-000000000004','crm-student@example.test');
insert into public.user_roles(user_id,role) values
 ('a2000000-0000-4000-8000-000000000001','ADMIN'),
 ('a2000000-0000-4000-8000-000000000002','SUPPORT'),
 ('a2000000-0000-4000-8000-000000000003','TEACHER'),
 ('a2000000-0000-4000-8000-000000000004','STUDENT');
select pg_temp.crm_assert(not has_table_privilege('authenticated','public.crm_leads','SELECT') and not has_table_privilege('authenticated','public.crm_interactions','INSERT') and not has_table_privilege('authenticated','public.crm_tasks','UPDATE'),'authenticated has no direct CRM table access');
select pg_temp.crm_assert(has_function_privilege('authenticated','public.admin_crm_mutate(text,uuid,jsonb)','EXECUTE'),'authenticated can invoke guarded CRM RPC');
select pg_temp.crm_assert(not has_function_privilege('anon','public.admin_crm_directory(text,text,integer,integer)','EXECUTE'),'anonymous cannot invoke CRM directory');
set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
select pg_temp.crm_denied($q$select public.admin_crm_mutate('CREATE',null,'{"name":"Blocked","email":"blocked@example.test","source":"web"}')$q$);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
select pg_temp.crm_denied($q$select public.admin_crm_directory(null,null,51,0)$q$,'22023');
select set_config('crm.lead',public.admin_crm_mutate('CREATE',null,'{"name":"CRM Lead Alpha","email":"ALPHA@example.test","source":"website","temperature":"WARM"}')::text,true);
select pg_temp.crm_assert((select value->>'owner_user_id'='a2000000-0000-4000-8000-000000000001' from public.admin_crm_directory('Alpha',null,25,0) value),'Lead owner is derived from authenticated Admin');
select pg_temp.crm_assert(jsonb_array_length((select value->'tasks' from public.admin_crm_directory('Alpha',null,25,0) value))=0,'bounded directory returns lead details');
select pg_temp.crm_assert((select value->>'email'='alpha@example.test' from public.admin_crm_directory('Alpha',null,25,0) value),'email normalized and searchable');
select pg_temp.crm_assert(not exists(select 1 from public.admin_crm_directory('%',null,25,0)),'search treats LIKE wildcard literally');
select pg_temp.crm_denied($q$select public.admin_crm_mutate('STAGE',current_setting('crm.lead')::uuid,'{"stage":"WON"}')$q$,'23514');
select public.admin_crm_mutate('STAGE',current_setting('crm.lead')::uuid,'{"stage":"CONTACTED"}');
select public.admin_crm_mutate('STAGE',current_setting('crm.lead')::uuid,'{"stage":"QUALIFIED"}');
select public.admin_crm_mutate('INTERACTION',current_setting('crm.lead')::uuid,'{"type":"CALL","summary":"Requested a course overview"}');
select public.admin_crm_mutate('TASK',current_setting('crm.lead')::uuid,'{"title":"Follow up","due_at":"2026-10-05T10:00:00-03:00","owner_user_id":"a2000000-0000-4000-8000-000000000002"}');
select set_config('crm.task',(select value->'tasks'->0->>'id' from public.admin_crm_directory('Alpha',null,25,0) value),true);
select public.admin_crm_mutate('COMPLETE_TASK',current_setting('crm.task')::uuid,'{}');
select public.admin_crm_mutate('UPDATE',current_setting('crm.lead')::uuid,'{"temperature":"HOT","owner_user_id":"a2000000-0000-4000-8000-000000000002"}');
select public.admin_crm_mutate('LINK_USER',current_setting('crm.lead')::uuid,'{"user_id":"a2000000-0000-4000-8000-000000000004"}');
select pg_temp.crm_assert((select value->>'linked_user_id'='a2000000-0000-4000-8000-000000000004' from public.admin_crm_directory('Alpha',null,25,0) value),'link references existing Student identity');
select pg_temp.crm_assert((select value->>'owner_user_id'='a2000000-0000-4000-8000-000000000002' and value->>'temperature'='HOT' from public.admin_crm_directory('Alpha',null,25,0) value),'owner reassignment validates and updates existing staff only');
select pg_temp.crm_assert((select jsonb_array_length(value->'interactions')=1 and jsonb_array_length(value->'tasks')=1 and value->'next_task'='null'::jsonb and value->'tasks'->0->>'status'='COMPLETED' from public.admin_crm_directory(null,'QUALIFIED',25,0) value),'detail includes bounded interaction and completed-task projections');
select pg_temp.crm_assert((select count(*)>=7 from public.audit_logs where entity_type='crm_leads' and entity_id=current_setting('crm.lead')::uuid and action like 'CRM_%'),'critical CRM mutations are audited');
select pg_temp.crm_denied($q$select public.admin_crm_mutate('UPDATE',current_setting('crm.lead')::uuid,'{"owner_user_id":"a2000000-0000-4000-8000-000000000003"}')$q$);
select pg_temp.crm_denied($q$select public.admin_crm_mutate('LINK_USER',current_setting('crm.lead')::uuid,'{"user_id":"a2000000-0000-4000-8000-000000000003"}')$q$,'23514');
select pg_temp.crm_denied($q$select public.admin_crm_mutate('CREATE',null,'{"name":"No contact","source":"web"}')$q$,'23514');
select pg_temp.crm_denied($q$select public.admin_crm_mutate('CREATE',null,'{"name":"Role mutation","email":"role@example.test","source":"web","stage":"WON"}')$q$,'22023');
select pg_temp.crm_assert((select count(*)=4 from public.user_roles where user_id in ('a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000004')),'Lead create/link never creates or mutates roles');
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000003","aal":"aal2"}',true);
select pg_temp.crm_denied($q$select public.admin_crm_directory(null,null,25,0)$q$);
select pg_temp.crm_denied($q$select public.admin_crm_mutate('UPDATE',current_setting('crm.lead')::uuid,'{"temperature":"HOT"}')$q$);
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000004","aal":"aal1"}',true);
select pg_temp.crm_denied($q$select public.admin_crm_directory(null,null,25,0)$q$);
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a2000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
select pg_temp.crm_denied($q$select public.admin_crm_mutate('UPDATE',current_setting('crm.lead')::uuid,'{"temperature":"HOT"}')$q$);
reset role;
set local role anon;
select pg_temp.crm_denied($q$select public.admin_crm_directory(null,null,25,0)$q$,'42501');
reset role;
rollback;
