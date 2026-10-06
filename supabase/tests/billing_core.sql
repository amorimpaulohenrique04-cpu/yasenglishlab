begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception '%',message; end if; end $$;
create function pg_temp.billing_event(k text, effect text, session_id uuid, sub text, cents integer, at_time text default '2026-10-06T10:00:00Z', cycle text default '2026-10-06')
returns jsonb language sql as $$
select jsonb_build_object('provider','ASAAS','eventId',k,'sourceType','fixture','occurredAt',at_time,
  'action',effect,'sessionId',session_id,'checkoutId',null,'subscriptionId',sub,'paymentId','pay_fixture',
  'amountCents',cents,'currency','BRL','cycleDate',cycle);
$$;
insert into auth.users(id) values
 ('ba000000-0000-4000-8000-000000000001'),('ba000000-0000-4000-8000-000000000002'),
 ('ba000000-0000-4000-8000-000000000003'),('ba000000-0000-4000-8000-000000000004');
insert into public.user_roles(user_id,role) select id,'STUDENT' from auth.users where id::text like 'ba000000-%';

do $$
declare reservation jsonb; s uuid; price integer; e jsonb; sub uuid; placement uuid;
begin
  reservation := public.reserve_billing_checkout('ba000000-0000-4000-8000-000000000001','START');
  s := (reservation->>'sessionId')::uuid; price := (reservation->>'amountCents')::integer;
  perform public.complete_billing_checkout(s,'bb000000-0000-4000-8000-000000000001');
  -- A later Plan price is irrelevant to the historical payment snapshot.
  update public.plans set amount_cents=amount_cents+500 where code='START';
  e := pg_temp.billing_event('evt_initial','CONFIRMED',s,'sub_initial',price);
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='APPLIED','initial payment must apply');
  select id into sub from public.subscriptions where provider_subscription_id='sub_initial';
  select id into placement from public.placement_cases where subscription_id=sub;
  perform pg_temp.assert_true((select status='PAID' from public.billing_checkout_sessions where id=s),'PAID session');
  perform pg_temp.assert_true((select status='ACTIVE' and plan_id=(select plan_id from public.billing_checkout_sessions where id=s)
    and current_period_start is null and current_period_end is null from public.subscriptions where id=sub),'ACTIVE historical plan, no fabricated period');
  perform pg_temp.assert_true((select state='PAYMENT_CONFIRMED' from public.placement_cases where id=placement),'initial Placement');
  perform pg_temp.assert_true(not exists(select 1 from public.enrollments where user_id='ba000000-0000-4000-8000-000000000001'),'no premature Enrollment');
  perform pg_temp.assert_true((select subscription_id=sub and processed_at is not null and processing_error is null from public.billing_events where event_id='evt_initial'),'linked processed immutable event');
  perform pg_temp.assert_true(exists(select 1 from public.audit_logs where actor_user_id is null and action='billing_reconciled'
    and data->>'event_id'='evt_initial' and data->>'placement_case_id'=placement::text),'system audit with provenance');
  perform pg_temp.assert_true(private.booking_entitlement('ba000000-0000-4000-8000-000000000001','monthly_private_sessions',now()) is not null,'existing entitlement recognizes new ACTIVE mirror');
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='DUPLICATE','durable retry deduplicated');
  perform pg_temp.assert_true(public.reconcile_billing_event(e||'{"amountCents":1}')='REJECTED','same event id with changed identity rejected');
  perform pg_temp.assert_true((select count(*)=1 from public.billing_events where event_id='evt_initial'),'unique event');
  perform pg_temp.assert_true((select count(*)=1 from public.subscriptions where user_id='ba000000-0000-4000-8000-000000000001'),'one mirror');
  perform pg_temp.assert_true((select count(*)=1 from public.placement_cases where user_id='ba000000-0000-4000-8000-000000000001'),'one Placement');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_stale_cancel','CANCELLED',null,'sub_initial',null,'2026-10-06T09:00:00Z',null))='STALE','older cancellation ignored');
  perform pg_temp.assert_true((select status='ACTIVE' from public.subscriptions where id=sub),'stale event cannot undo ACTIVE');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_overdue','PAYMENT_FAILED',null,'sub_initial',price,'2026-10-07T10:00:00Z','2026-11-06'))='APPLIED','known subscription goes PAST_DUE');
  perform pg_temp.assert_true((select status='PAST_DUE' from public.subscriptions where id=sub),'PAST_DUE mirror');
  perform pg_temp.assert_true(private.booking_entitlement('ba000000-0000-4000-8000-000000000001','monthly_private_sessions',now()) is null,'PAST_DUE loses booking entitlement');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_late_receipt','CONFIRMED',null,'sub_initial',price,'2026-11-07T10:00:00Z','2026-10-06'))='STALE','late receipt of previous cycle cannot restore overdue cycle');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_restore','CONFIRMED',null,'sub_initial',price,'2026-11-08T10:00:00Z','2026-11-06'))='APPLIED','new cycle confirmation restores');
  perform pg_temp.assert_true((select count(*)=1 from public.placement_cases where user_id='ba000000-0000-4000-8000-000000000001'),'renewal does not duplicate Placement');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_refund','REFUNDED',null,'sub_initial',price,'2026-11-09T10:00:00Z','2026-11-06'))='APPLIED','known full refund expires access');
  perform pg_temp.assert_true((select status='EXPIRED' from public.subscriptions where id=sub),'EXPIRED mirror');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_refunded_failure','PAYMENT_FAILED',null,'sub_initial',price,'2026-11-09T10:30:00Z','2026-11-06'))='REJECTED','failed payment cannot reopen expired cycle');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_refunded_receipt','CONFIRMED',null,'sub_initial',price,'2026-11-09T11:00:00Z','2026-11-06'))='REJECTED','late receipt cannot reactivate refunded cycle');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_cancel','CANCELLED',null,'sub_initial',null,'2026-11-10T10:00:00Z',null))='APPLIED','known cancellation');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_after_cancel','CONFIRMED',null,'sub_initial',price,'2026-11-11T10:00:00Z','2026-12-06'))='REJECTED','cancelled provider subscription cannot reopen');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_failure_after_cancel','PAYMENT_FAILED',null,'sub_initial',price,'2026-11-12T10:00:00Z','2026-12-06'))='REJECTED','payment failure cannot reopen cancelled subscription');
  perform pg_temp.assert_true((select status='CANCELLED' from public.subscriptions where id=sub),'CANCELLED remains');
end $$;

do $$
declare r jsonb; s uuid; price integer; e jsonb;
begin
  r := public.reserve_billing_checkout('ba000000-0000-4000-8000-000000000002','START');
  s := (r->>'sessionId')::uuid; price := (r->>'amountCents')::integer;
  e := pg_temp.billing_event('evt_bad_amount','CONFIRMED',s,'sub_bad',price+1);
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='REJECTED','amount mismatch rejected');
  perform pg_temp.assert_true((select processing_error='AMOUNT_MISMATCH' and processed_at is not null from public.billing_events where event_id='evt_bad_amount'),'durable sanitized amount error');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_bad_currency','CONFIRMED',s,'sub_bad',price)||'{"currency":"USD"}')='REJECTED','currency mismatch rejected');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_bad_link','CONFIRMED','ba000000-0000-4000-8000-000000000099','sub_unknown',price))='REJECTED','unknown checkout rejected');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_missing_sub','CONFIRMED',s,null,price))='REJECTED','payment id is never a subscription id');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_initial_failure','PAYMENT_FAILED',s,'sub_bad',price))='REJECTED','initial failure does not invent PAST_DUE');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_unknown_cancel','CANCELLED',null,'sub_unknown',null))='REJECTED','unmatched cancellation cannot mutate state');
  perform pg_temp.assert_true(not exists(select 1 from public.subscriptions where user_id='ba000000-0000-4000-8000-000000000002'),'invalid initial events never create subscription');
  perform pg_temp.assert_true(not exists(select 1 from public.placement_cases where user_id='ba000000-0000-4000-8000-000000000002'),'invalid events never create Placement');
  perform pg_temp.assert_true((select status='CREATING' from public.billing_checkout_sessions where id=s),'failed transaction keeps initial checkout');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_unknown','IGNORED',null,null,null))='IGNORED','valid unknown event stored neutral');
  perform pg_temp.assert_true((select event_type='IGNORED' and processing_error is null from public.billing_events where event_id='evt_unknown'),'neutral event persists');
  begin
    perform public.reconcile_billing_event(pg_temp.billing_event('evt_raw','IGNORED',null,null,null)||'{"raw":{"creditCard":"private"}}');
    raise exception 'raw provider data accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.reconcile_billing_event(pg_temp.billing_event('evt_nested','IGNORED',null,null,null)||'{"paymentId":{"creditCard":"private"}}');
    raise exception 'nested raw provider data accepted';
  exception when invalid_parameter_value then null; end;
  -- If the Placement bridge fails, session and newly inserted mirror roll back.
  delete from public.user_roles where user_id='ba000000-0000-4000-8000-000000000002';
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_bridge_failure','CONFIRMED',s,'sub_bad',price))='REJECTED','Placement failure is atomic');
  perform pg_temp.assert_true(not exists(select 1 from public.subscriptions where user_id='ba000000-0000-4000-8000-000000000002'),'bridge failure rolls back activation');
  perform pg_temp.assert_true((select status='CREATING' from public.billing_checkout_sessions where id=s),'bridge failure rolls back PAID');
end $$;

-- Lost checkout completion response: a confirmed event can recover CREATING via
-- externalReference without requiring a second provider POST.
do $$
declare r jsonb; s uuid; price integer; e jsonb;
begin
  r := public.reserve_billing_checkout('ba000000-0000-4000-8000-000000000003','START');
  s := (r->>'sessionId')::uuid; price := (r->>'amountCents')::integer;
  e := pg_temp.billing_event('evt_ambiguous','CONFIRMED',s,'sub_ambiguous',price)||'{"checkoutId":"bb000000-0000-4000-8000-000000000003"}';
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='APPLIED','confirmed CREATING reconciles');
  perform pg_temp.assert_true((select provider_checkout_id='bb000000-0000-4000-8000-000000000003' from public.billing_checkout_sessions where id=s),'confirmed externalReference recovers provider checkout id');
  -- Independent provider checkout id correlation when externalReference omitted.
  r := public.reserve_billing_checkout('ba000000-0000-4000-8000-000000000004','START');
  s := (r->>'sessionId')::uuid; price := (r->>'amountCents')::integer;
  perform public.complete_billing_checkout(s,'bb000000-0000-4000-8000-000000000004');
  e := pg_temp.billing_event('evt_checkout_id','CONFIRMED',null,'sub_checkout_id',price)||'{"checkoutId":"bb000000-0000-4000-8000-000000000004"}';
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='APPLIED','provider checkout linkage reconciles');
  perform set_config('request.jwt.claim.sub','ba000000-0000-4000-8000-000000000004',true);
  perform set_config('request.jwt.claims','{"role":"authenticated","aal":"aal1"}',true);
  perform pg_temp.assert_true(public.begin_placement()=(select id from public.placement_cases where user_id='ba000000-0000-4000-8000-000000000004'),'Student resumes same case');
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
end $$;

-- Grant checks plus actual role execution, not just structural assertions.
select pg_temp.assert_true(not has_function_privilege('anon','public.reconcile_billing_event(jsonb)','EXECUTE'),'anon billing RPC denied');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.reconcile_billing_event(jsonb)','EXECUTE'),'authenticated billing RPC denied');
select pg_temp.assert_true(has_function_privilege('service_role','public.reconcile_billing_event(jsonb)','EXECUTE'),'service billing RPC granted');
select pg_temp.assert_true(not has_function_privilege('service_role','private.ensure_initial_placement(uuid,uuid)','EXECUTE'),'helper not a callable impersonation API');
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated'] loop
    execute format('set local role %I',r);
    begin
      perform public.reconcile_billing_event('{}');
      raise exception 'client billing RPC allowed';
    exception when insufficient_privilege then null; end;
    begin
      insert into public.billing_events(provider,event_id,event_type,payload,occurred_at) values('ASAAS','client','IGNORED','{}',now());
      raise exception 'client billing event write allowed';
    exception when insufficient_privilege then null; end;
    begin
      insert into public.subscriptions(user_id,plan_id,provider,status) values('ba000000-0000-4000-8000-000000000001',(select id from public.plans limit 1),'ASAAS','ACTIVE');
      raise exception 'client subscription write allowed';
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;
end $$;
set local role service_role;
select pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_service','IGNORED',null,null,null))='IGNORED','actual service RPC execution');
reset role;
rollback;
