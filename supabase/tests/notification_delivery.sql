begin;
create function pg_temp.assert_notification(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message; end if; end $$;
create function pg_temp.notification_event(k text,effect text,s uuid,sub text,cents integer,at_time text default '2026-10-06T10:00:00Z') returns jsonb language sql as $$
select jsonb_build_object('provider','ASAAS','eventId',k,'sourceType','notification-fixture','occurredAt',at_time,
 'action',effect,'sessionId',s,'checkoutId',null,'subscriptionId',sub,'paymentId','pay_notification',
 'amountCents',cents,'currency','BRL','cycleDate','2026-10-06');
$$;
-- SQL exercises Billing/outbox ownership; verified email belongs to Auth adapter tests.
-- Use the minimal id-only Auth contract shared by real Supabase and CI's stub.
insert into auth.users(id) values
 ('ae000000-0000-4000-8000-000000000001'),('ae000000-0000-4000-8000-000000000002');
insert into public.user_roles(user_id,role) values
 ('ae000000-0000-4000-8000-000000000001','STUDENT'),('ae000000-0000-4000-8000-000000000002','STUDENT');

do $$
declare r jsonb; s uuid; price integer; e jsonb; before_count integer; sub uuid;
begin
 r:=public.reserve_billing_checkout('ae000000-0000-4000-8000-000000000001','START');
 s:=(r->>'sessionId')::uuid; price:=(r->>'amountCents')::integer;
 perform public.complete_billing_checkout(s,'ae000000-0000-4000-8000-000000000011');
 e:=pg_temp.notification_event('notification_confirmed','CONFIRMED',s,'sub_notification',price);
 perform pg_temp.assert_notification(public.reconcile_billing_event(e)='APPLIED','confirmation APPLIED');
 select id into sub from public.subscriptions where provider_subscription_id='sub_notification';
 perform pg_temp.assert_notification((select count(*)=1 from public.notifications where user_id='ae000000-0000-4000-8000-000000000001' and notification_type='PAYMENT_CONFIRMED'
   and title='Pagamento confirmado' and body='Seu pagamento foi confirmado e sua assinatura Yas está ativa.' and data='{}'::jsonb),'one approved notification, no provider payload');
 perform pg_temp.assert_notification((select count(*)=1 from public.notification_deliveries d join public.notifications n on n.id=d.notification_id where n.user_id='ae000000-0000-4000-8000-000000000001' and d.status='PENDING' and d.attempt_count=0),'durable pending outbox');
 perform pg_temp.assert_notification(public.reconcile_billing_event(e)='DUPLICATE','duplicate event');
 perform pg_temp.assert_notification(public.reconcile_billing_event(e||'{"eventId":"notification_equal_stale"}')='STALE','equal timestamp/priority is STALE');
 perform pg_temp.assert_notification(public.reconcile_billing_event(pg_temp.notification_event('notification_old','CANCELLED',null,'sub_notification',null,'2026-10-06T09:00:00Z'))='STALE','older event');
 perform pg_temp.assert_notification(public.reconcile_billing_event(pg_temp.notification_event('notification_ignored','IGNORED',null,null,null))='IGNORED','ignored event');
 perform pg_temp.assert_notification(public.reconcile_billing_event(pg_temp.notification_event('notification_mismatch','CONFIRMED',s,'sub_notification',price+1,'2026-10-06T11:00:00Z'))='REJECTED','amount mismatch');
 perform pg_temp.assert_notification(public.reconcile_billing_event(pg_temp.notification_event('notification_unknown','CONFIRMED','ae000000-0000-4000-8000-000000000099','sub_unknown_notification',price,'2026-10-06T11:00:00Z'))='REJECTED','unknown checkout');
 perform pg_temp.assert_notification((select count(*)=1 from public.notifications where user_id='ae000000-0000-4000-8000-000000000001'),'no email for duplicate/stale/ignored/rejected');
 perform pg_temp.assert_notification(public.reconcile_billing_event(pg_temp.notification_event('notification_issue','PAYMENT_FAILED',null,'sub_notification',price,'2026-10-06T12:00:00Z'))='APPLIED','issue APPLIED');
 perform pg_temp.assert_notification(public.reconcile_billing_event(pg_temp.notification_event('notification_ended','CANCELLED',null,'sub_notification',null,'2026-10-06T13:00:00Z'))='APPLIED','ended APPLIED');
 perform pg_temp.assert_notification((select count(*)=3 from public.notifications where user_id='ae000000-0000-4000-8000-000000000001'),'three V1 templates only');
 perform pg_temp.assert_notification((select count(distinct idempotency_key)=3 from public.notification_deliveries d join public.notifications n on n.id=d.notification_id where n.user_id='ae000000-0000-4000-8000-000000000001'),'unique delivery identity');
 perform pg_temp.assert_notification((select count(*)=1 from public.placement_cases where subscription_id=sub),'notification does not duplicate Placement');
 begin
   insert into public.notifications(user_id,notification_type,title,body,dedupe_key)
   select user_id,notification_type,title,body,dedupe_key from public.notifications where user_id='ae000000-0000-4000-8000-000000000001' limit 1;
   raise exception 'duplicate notification accepted';
 exception when unique_violation then null; end;
 begin
   insert into public.notification_deliveries(notification_id) select id from public.notifications where user_id='ae000000-0000-4000-8000-000000000001' limit 1;
   raise exception 'duplicate email delivery accepted';
 exception when unique_violation then null; end;
end $$;

-- A different owner's notification makes the own-notification RLS test non-vacuous.
with n as (insert into public.notifications(user_id,notification_type,title,body)
 values('ae000000-0000-4000-8000-000000000002','PAYMENT_ISSUE','fixture','fixture') returning id)
insert into public.notification_deliveries(notification_id) select id from n;

-- Restrict this isolated test's claims to its fixtures even when local data exists.
update public.notification_deliveries d set next_attempt_at=now()+interval '1 day' where status='PENDING'
 and not exists(select 1 from public.notifications n where n.id=d.notification_id and n.user_id='ae000000-0000-4000-8000-000000000001');
create temp table notification_claims as select * from public.claim_notification_deliveries(3);
select pg_temp.assert_notification((select count(*)=3 and min(attempt_count)=1 from notification_claims),'bounded claim increments attempts');
select pg_temp.assert_notification(not exists(select 1 from public.claim_notification_deliveries(3)),'active leases never reclaimed');

do $$
declare d record; token uuid; key text; outcome text; attempts integer;
begin
 select * into d from notification_claims where notification_type='PAYMENT_CONFIRMED';
 perform pg_temp.assert_notification(not public.complete_notification_delivery(d.delivery_id,gen_random_uuid(),'wrong-worker'),'claim fencing rejects another worker');
 perform pg_temp.assert_notification(public.complete_notification_delivery(d.delivery_id,d.claim_token,'accepted-message-id'),'accepted message persisted');
 perform pg_temp.assert_notification(not public.complete_notification_delivery(d.delivery_id,d.claim_token,'accepted-message-id'),'SENT replay does not resend');
 begin
   update public.notification_deliveries set status='PENDING',next_attempt_at=now(),provider_message_id=null,sent_at=null where id=d.delivery_id;
   raise exception 'SENT requeued';
 exception when check_violation then null; end;
 select * into d from notification_claims where notification_type='PAYMENT_ISSUE'; key:=d.idempotency_key;
 outcome:=public.fail_notification_delivery(d.delivery_id,d.claim_token,'PROVIDER_RATE_LIMIT',true);
 perform pg_temp.assert_notification(outcome='PENDING','429 scheduled for retry');
 perform pg_temp.assert_notification((select next_attempt_at between now()+interval '59 seconds' and now()+interval '65 seconds' and last_error_code='PROVIDER_RATE_LIMIT' from public.notification_deliveries where id=d.delivery_id),'persisted first backoff');
 perform pg_temp.assert_notification(not exists(select 1 from public.claim_notification_deliveries(1)),'no immediate retry');
 for attempts in 2..5 loop
   update public.notification_deliveries set next_attempt_at=now()-interval '1 second' where id=d.delivery_id;
   select * into d from public.claim_notification_deliveries(1);
   perform pg_temp.assert_notification(d.attempt_count=attempts and d.idempotency_key=key,'same key throughout bounded retry');
   outcome:=public.fail_notification_delivery(d.delivery_id,d.claim_token,'NETWORK_ERROR',true);
   perform pg_temp.assert_notification(outcome=case when attempts<5 then 'PENDING' else 'FAILED' end,'maximum five attempts');
 end loop;
 select * into d from notification_claims where notification_type='SUBSCRIPTION_ENDED';
 token:=d.claim_token;
 update public.notification_deliveries set lease_until=now()-interval '1 second' where id=d.delivery_id;
 select * into d from public.claim_notification_deliveries(1);
 perform pg_temp.assert_notification(d.attempt_count=2 and d.claim_token<>token,'abandoned claim recovered with new fence');
 perform pg_temp.assert_notification(not public.complete_notification_delivery(d.delivery_id,token,'old-worker'),'old fence remains rejected');
 update public.notification_deliveries set lease_until=now()-interval '1 second',first_attempt_at=now()-interval '24 hours' where id=d.delivery_id;
 perform pg_temp.assert_notification(not exists(select 1 from public.claim_notification_deliveries(1)),'expired provider idempotency window never resent');
 perform pg_temp.assert_notification((select status='FAILED' and last_error_code='IDEMPOTENCY_WINDOW_EXPIRED' from public.notification_deliveries where id=d.delivery_id),'expiry sanitized failure');
 begin perform public.claim_notification_deliveries(26); raise exception 'unbounded claim'; exception when invalid_parameter_value then null; end;
 begin perform public.fail_notification_delivery(d.delivery_id,d.claim_token,'secret provider response',false); raise exception 'raw error accepted'; exception when invalid_parameter_value then null; end;
end $$;

select pg_temp.assert_notification((select relrowsecurity from pg_class where oid='public.notification_deliveries'::regclass),'delivery RLS enabled');
select pg_temp.assert_notification(not has_table_privilege('anon','public.notification_deliveries','SELECT') and not has_table_privilege('authenticated','public.notification_deliveries','SELECT'),'no browser delivery grants');
select pg_temp.assert_notification(not has_function_privilege('authenticated','public.claim_notification_deliveries(integer)','EXECUTE') and not has_function_privilege('anon','public.complete_notification_delivery(uuid,uuid,text)','EXECUTE'),'no browser RPC grants');
select pg_temp.assert_notification(not has_function_privilege('service_role','private.billing_notification_outbox()','EXECUTE'),'trigger-only definer');

set local role authenticated;
select set_config('request.jwt.claim.sub','ae000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_notification((select count(*)=3 from public.notifications where user_id='ae000000-0000-4000-8000-000000000001'),'Student sees own notifications');
select pg_temp.assert_notification(not exists(select 1 from public.notifications where user_id<>'ae000000-0000-4000-8000-000000000001'),'Student sees no other notifications');
do $$ begin
 begin perform count(*) from public.notification_deliveries; raise exception 'Student read delivery'; exception when insufficient_privilege then null; end;
 begin perform public.claim_notification_deliveries(1); raise exception 'Student claimed'; exception when insufficient_privilege then null; end;
 begin update public.notification_deliveries set status='FAILED'; raise exception 'Student updated'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform count(*) from public.notification_deliveries; raise exception 'anon read delivery'; exception when insufficient_privilege then null; end;
 begin perform public.claim_notification_deliveries(1); raise exception 'anon claimed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update public.notification_deliveries d set next_attempt_at=now()-interval '1 second'
 where status='PENDING' and exists(select 1 from public.notifications n where n.id=d.notification_id and n.user_id='ae000000-0000-4000-8000-000000000002');
set local role service_role;
select pg_temp.assert_notification((select count(*)>=3 from public.notification_deliveries),'service-only operational read');
do $$ declare d record; begin
 select * into d from public.claim_notification_deliveries(1);
 perform pg_temp.assert_notification(d.user_id='ae000000-0000-4000-8000-000000000002' and d.attempt_count=1,'service-only invoker claims with least privilege');
 perform pg_temp.assert_notification(public.fail_notification_delivery(d.delivery_id,d.claim_token,'RECIPIENT_UNVERIFIED',false)='FAILED','permanent recipient failure, no retry');
end $$;
do $$ begin
 begin insert into public.notification_deliveries(notification_id) values(gen_random_uuid()); raise exception 'service manual insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select pg_temp.assert_notification((select status='CANCELLED' from public.subscriptions where provider_subscription_id='sub_notification'),'delivery failures never change Billing');
select pg_temp.assert_notification((select count(*)=1 from public.placement_cases where user_id='ae000000-0000-4000-8000-000000000001'),'delivery failures never change Placement');
rollback;
