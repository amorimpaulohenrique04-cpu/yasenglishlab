-- PR2 / 2B: plan change is a request for the next renewal; nothing is applied or charged.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9d300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',format('{"sub":"%s","aal":"aal1"}',pg_temp.id(n)),true)$$;
insert into auth.users(id,email) select pg_temp.id(n),'pcr-'||n||'@example.test' from generate_series(1,3) n;
insert into public.user_roles(user_id,role) values(pg_temp.id(1),'STUDENT'),(pg_temp.id(2),'STUDENT'),(pg_temp.id(3),'TEACHER');
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status)
 select pg_temp.id(10),pg_temp.id(1),p.id,'ASAAS','sub_pcr_1','ACTIVE' from public.plans p where p.code='START';
create temp table before_sub as select plan_id,status,current_period_end from public.subscriptions where id=pg_temp.id(10);
grant select on before_sub to authenticated;

set local role authenticated;
select pg_temp.as_user(1);
select set_config('pcr.id',public.request_plan_change('TALK')::text,true);
select pg_temp.assert_true(public.request_plan_change('TALK')=current_setting('pcr.id')::uuid,'same request twice is idempotent');
select pg_temp.denied($$select public.request_plan_change('START')$$,'23514');
select pg_temp.denied($$select public.request_plan_change('NOPE')$$,'23514');
select public.request_plan_change('BOOST');
select pg_temp.assert_true((select count(*)=1 from public.plan_change_requests where status='REQUESTED'),'a new target replaces the open request');
select pg_temp.assert_true((select count(*)=2 from public.plan_change_requests),'history keeps the replaced request');
select pg_temp.as_user(2);
select pg_temp.denied($$select public.request_plan_change('TALK')$$,'23514');
select pg_temp.assert_true((select count(*)=0 from public.plan_change_requests),'other student sees nothing');
select pg_temp.as_user(3);
select pg_temp.denied($$select public.request_plan_change('TALK')$$);
select pg_temp.as_user(1);
select public.cancel_plan_change();
select public.cancel_plan_change();
select pg_temp.assert_true((select count(*)=0 from public.plan_change_requests where status='REQUESTED'),'student can withdraw the request');
reset role;
select pg_temp.assert_true((select s.plan_id=b.plan_id and s.status=b.status from public.subscriptions s,before_sub b where s.id=pg_temp.id(10)),'subscription plan and status untouched');
select pg_temp.assert_true((select count(*)=3 from public.audit_logs where action in ('PLAN_CHANGE_REQUESTED','PLAN_CHANGE_CANCELLED') and entity_type='plan_change_requests' and actor_user_id=pg_temp.id(1)),'requests and withdrawal audited once each');
rollback;
