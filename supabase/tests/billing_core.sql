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

-- Transient vs terminal CHECKOUT_NOT_FOUND. A transient miss raises PT503 BILLING_EVENT_RETRY
-- and stores NOTHING, so redelivery of the same event is evaluated again.
insert into auth.users(id) values
 ('ba000000-0000-4000-8000-000000000005'),('ba000000-0000-4000-8000-000000000006'),('ba000000-0000-4000-8000-000000000007');
insert into public.user_roles(user_id,role) values
 ('ba000000-0000-4000-8000-000000000005','STUDENT'),('ba000000-0000-4000-8000-000000000006','STUDENT'),('ba000000-0000-4000-8000-000000000007','STUDENT');

do $$
declare e jsonb; before_count bigint;
begin
  -- Terminal: no CREATING session could still be linked (age every unlinked one past the window), so an
  -- unknown checkout-only event is a durable REJECTED, never an endless retry.
  update public.billing_checkout_sessions set created_at=now()-interval '2 hours' where status='CREATING' and provider_checkout_id is null;
  e := pg_temp.billing_event('evt_unknown_checkout','CONFIRMED',null,'sub_unknown_checkout',9990)||'{"checkoutId":"bb000000-0000-4000-8000-0000000000f1"}';
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='REJECTED','unknown checkout without pending link is terminal');
  perform pg_temp.assert_true((select processing_error='CHECKOUT_NOT_FOUND' from public.billing_events where event_id='evt_unknown_checkout'),'terminal CHECKOUT_NOT_FOUND recorded');
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='DUPLICATE','terminal rejection stays immutable');
end $$;

do $$
declare u constant uuid := 'ba000000-0000-4000-8000-000000000005'; r jsonb; s uuid; price integer; e jsonb;
  c constant uuid := 'bb000000-0000-4000-8000-000000000005'; retried boolean := false; events_before bigint;
begin
  r := public.reserve_billing_checkout(u,'START'); s := (r->>'sessionId')::uuid; price := (r->>'amountCents')::integer;
  e := pg_temp.billing_event('evt_transient','CONFIRMED',null,'sub_transient',price)||jsonb_build_object('checkoutId',c,'paymentId','pay_transient');
  select count(*) into events_before from public.billing_events;
  begin
    perform public.reconcile_billing_event(e);
  exception when sqlstate 'PT503' then
    retried := true;
    perform pg_temp.assert_true(sqlerrm='BILLING_EVENT_RETRY','stable retry message');
  end;
  perform pg_temp.assert_true(retried,'checkout not linked yet signals retry (PT503)');
  perform pg_temp.assert_true((select count(*) from public.billing_events)=events_before,'transient event is not stored');
  perform pg_temp.assert_true(not exists(select 1 from public.subscriptions where user_id=u),'transient event grants nothing');
  perform pg_temp.assert_true((select status='CREATING' from public.billing_checkout_sessions where id=s),'session untouched by transient miss');
  perform public.complete_billing_checkout(s,c);
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='APPLIED','same event is reprocessed after the link');
  perform pg_temp.assert_true((select processing_error is null and subscription_id is not null from public.billing_events where event_id='evt_transient'),'applied, not rejected');
  perform pg_temp.assert_true((select status='ACTIVE' from public.subscriptions where user_id=u),'ACTIVE after reprocess');
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='DUPLICATE','applied event idempotent');
  perform pg_temp.assert_true((select count(*)=1 from public.notifications where user_id=u and notification_type in ('PAYMENT_CONFIRMED','PAYMENT_RENEWED')),'single notification');
  -- A sessionId we never issued is terminal even while another checkout is pending (our own reference).
  r := public.reserve_billing_checkout('ba000000-0000-4000-8000-000000000006','START');
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_unknown_session','CONFIRMED','ba000000-0000-4000-8000-0000000000f2','sub_unknown_session',price))='REJECTED','unknown sessionId stays terminal');
  -- Other domain errors stay terminal while a link is pending (amount comparison unchanged).
  perform pg_temp.assert_true(public.reconcile_billing_event(pg_temp.billing_event('evt_terminal_amount','CONFIRMED',(r->>'sessionId')::uuid,'sub_terminal_amount',price+1))='REJECTED','amount mismatch stays terminal');
end $$;

-- Webhook that wins the race against complete_billing_checkout, and a payment arriving after the
-- orphan CREATING expired: neither is lost; complete_billing_checkout is idempotent afterwards.
do $$
declare u constant uuid := 'ba000000-0000-4000-8000-000000000007'; r jsonb; old_s uuid; price integer; e jsonb;
  c constant uuid := 'bb000000-0000-4000-8000-000000000007'; fresh jsonb;
begin
  r := public.reserve_billing_checkout(u,'START'); old_s := (r->>'sessionId')::uuid; price := (r->>'amountCents')::integer;
  update public.billing_checkout_sessions set created_at=now()-interval '2 hours' where id=old_s;
  fresh := public.reserve_billing_checkout(u,'START');
  perform pg_temp.assert_true((fresh->>'claimed')::boolean and (select status='EXPIRED' from public.billing_checkout_sessions where id=old_s),'orphan expired and user released');
  e := pg_temp.billing_event('evt_late_orphan','CONFIRMED',old_s,'sub_late_orphan',price)||jsonb_build_object('checkoutId',c,'paymentId','pay_late_orphan');
  perform pg_temp.assert_true(public.reconcile_billing_event(e)='APPLIED','payment for an expired orphan session is applied, not lost');
  perform pg_temp.assert_true((select status='PAID' and provider_checkout_id=c from public.billing_checkout_sessions where id=old_s),'expired orphan recovered to PAID');
  perform pg_temp.assert_true((select status='ACTIVE' from public.subscriptions where user_id=u),'ACTIVE after late payment');
  perform public.complete_billing_checkout(old_s,c);
  begin
    perform public.complete_billing_checkout(old_s,'bb000000-0000-4000-8000-0000000000f3');
    raise exception 'foreign checkout completed a PAID session';
  exception when raise_exception then
    if sqlerrm<>'Checkout completion conflict' then raise; end if;
  end;
  -- A paid session can never be expired by a later reservation.
  update public.billing_checkout_sessions set created_at=now()-interval '5 hours' where id=old_s;
  perform public.reserve_billing_checkout(u,'START');
  perform pg_temp.assert_true((select status='PAID' from public.billing_checkout_sessions where id=old_s),'PAID never expired');
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
