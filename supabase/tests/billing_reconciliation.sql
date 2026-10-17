-- PR2 / 2A: reconciliation findings are dedupe'd, admin-only and never touch the subscription.
begin;
create function pg_temp.id(n integer) returns uuid language sql immutable as $$select ('9d200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
create function pg_temp.denied(command text,expected text default '42501') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlstate=expected then return;else raise;end if;end;
 raise exception 'Expected denial: %',command;
end$$;
create function pg_temp.as_user(n integer,aal text default 'aal2') returns void language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.id(n)::text,true),set_config('request.jwt.claims',format('{"sub":"%s","aal":"%s"}',pg_temp.id(n),aal),true)$$;
insert into auth.users(id,email) select pg_temp.id(n),'brc-'||n||'@example.test' from generate_series(1,3) n;
insert into public.user_roles(user_id,role) values(pg_temp.id(1),'STUDENT'),(pg_temp.id(2),'ADMIN'),(pg_temp.id(3),'TEACHER');
insert into public.subscriptions(id,user_id,plan_id,provider,provider_subscription_id,status)
 values(pg_temp.id(10),pg_temp.id(1),'10000000-0000-0000-0000-000000000001','ASAAS','sub_brc_1','PAST_DUE');

-- Server (service_role) side: record twice, one open finding; clear when no longer present.
set local role service_role;
select public.record_billing_finding(pg_temp.id(10),'PAST_DUE_WITHOUT_OVERDUE_CHARGE','{"provider_status":"ACTIVE"}');
select public.record_billing_finding(pg_temp.id(10),'PAST_DUE_WITHOUT_OVERDUE_CHARGE','{"provider_status":"ACTIVE","again":true}');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.billing_reconciliation_findings where status='OPEN'),'one open finding per subscription and kind');
select pg_temp.assert_true((select status from public.subscriptions where id=pg_temp.id(10))='PAST_DUE','reconciliation never edits the subscription');

set local role authenticated;
select pg_temp.as_user(1);
select pg_temp.assert_true((select count(*)=0 from public.billing_reconciliation_findings),'student cannot read findings');
select pg_temp.denied(format('select public.record_billing_finding(%L,%L,%L)',pg_temp.id(10),'PAST_DUE_WITHOUT_OVERDUE_CHARGE','{}'));
select pg_temp.as_user(3);
select pg_temp.assert_true((select count(*)=0 from public.billing_reconciliation_findings),'teacher cannot read findings');
select pg_temp.as_user(2,'aal1');
select pg_temp.assert_true((select count(*)=0 from public.billing_reconciliation_findings),'admin without aal2 reads nothing');
select pg_temp.as_user(2);
select pg_temp.assert_true((select count(*)=1 from public.billing_reconciliation_findings),'admin aal2 reads findings');
select set_config('brc.id',(select id::text from public.billing_reconciliation_findings),true);
select pg_temp.denied(format('select public.resolve_billing_finding(%L,%L)',current_setting('brc.id'),''),'23514');
select public.resolve_billing_finding(current_setting('brc.id')::uuid,'Webhook replayed manually.');
select public.resolve_billing_finding(current_setting('brc.id')::uuid,'Second click.');
reset role;
select pg_temp.assert_true((select resolution_note='Webhook replayed manually.' from public.billing_reconciliation_findings),'resolution keeps the first note');
select pg_temp.assert_true((select count(*)=1 from public.audit_logs where action='BILLING_FINDING_RESOLVED' and entity_id=current_setting('brc.id')::uuid),'resolution audited once');

set local role service_role;
select public.record_billing_finding(pg_temp.id(10),'ACTIVE_WITH_OVERDUE_CHARGE','{}');
select pg_temp.assert_true(public.clear_billing_findings(pg_temp.id(10),array['ACTIVE_WITH_OVERDUE_CHARGE'])=0,'still-present finding stays open');
select pg_temp.assert_true(public.clear_billing_findings(pg_temp.id(10),array[]::text[])=1,'absent finding is cleared by the re-check');
reset role;
rollback;
